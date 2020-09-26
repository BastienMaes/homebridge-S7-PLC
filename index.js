var debug =          require('debug')('homebridge-S7-PLC') //debug messages ->https://github.com/visionmedia/debug
var debugLightDimm = require('debug')('homebridge-S7-PLC_LightDimm') 
var debugLightBulb = require('debug')('homebridge-S7-PLC_LightBulb')
var debugSensor    = require('debug')('homebridge-S7-PLC_Sensor')
var debugThermostat   = require('debug')('homebridge-S7-PLC_Thermostat')
var Accessory, Service, Characteristic, UUIDGen;
var snap7 = require('node-snap7');


var S7accessory = {
    "S7_LightBulb": LightBulb,
    "S7_LightDimm": LightDimm,
    "S7_Outlet": LightBulb,
    "S7_Sensor" : Sensor,
    "S7_Humidity" : Sensor,
    "S7_Temperature" : Sensor,
    "S7_Thermostat" : Thermostat,
    "S7_WindowCovering": WindowCovering
}//this var is used to have a unique constructor for accessories instanciation in platform

//Exports
module.exports = function(homebridge) {
  // Service and Characteristic from hap-nodejs/lib/gen/HomeKitTypes.js
  var platformName = 'homebridge-s7-plc';
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  Accessory = homebridge.platformAccessory;
  homebridge.registerPlatform(platformName, 'S7', S7Platform);
  homebridge.registerAccessory(platformName, 'S7_LightDimm', LightDimm, true);
  homebridge.registerAccessory(platformName, 'S7_LightBulb', LightBulb, true);
  homebridge.registerAccessory(platformName, 'S7_Outlet', LightBulb, true);  
  homebridge.registerAccessory(platformName, 'S7_Sensor', Sensor, true);
  homebridge.registerAccessory(platformName, 'S7_Humidity', Sensor, true);
  homebridge.registerAccessory(platformName, 'S7_Temperature', Sensor, true);  
  homebridge.registerAccessory(platformName, 'S7_Thermostat', Thermostat, true);  
  homebridge.registerAccessory(platformName, 'S7_WindowCovering', WindowCovering, true);    
}

//Platform definitions
//S7
//config.json:

//  "platforms": [
//        {
//      "platform": "S7",
//      "IP": "10.10.10.10",
//      "RACK": 0,
//      "SLOT": 2,
//      "accessories": []
//  }
//  ]

function S7Platform(log, config) {
    //initialize
    this.log = log;
    this.config = config;
    this.ip = this.config.IP;
    this.rack = this.config.RACK;
    this.slot = this.config.SLOT;
    this.S7Client = new snap7.S7Client();
    //PLC connection synchonousely...
    this.log(">> S7Client connecting to %s (%s:%s)", this.ip, this.rack , this.slot);
    this.S7Client.ConnectTo(this.ip, this.rack , this.slot);
    this.connecting = false;
}





S7Platform.prototype = {
    
    //Accessories retrieval
    accessories: function(callback) {
        var log = this.log;

        debug('Fetching S7 devices...');
        //For each device, create an accessory!
        var foundAccessories = this.config.accessories;
        //create array of accessories
        var platformAccessories = [];
        
        for (var i = 0; i < foundAccessories.length; i++) {
            debug('Parsing accessory ' + i + ' of ' + foundAccessories.length);
            this.log('Pushing new ' + foundAccessories[i].accessory + ' device: ' + foundAccessories[i].name);
            //Call accessoryConstruction
            var accessory = new S7accessory[foundAccessories[i].accessory](this, foundAccessories[i]);
            debug('Creating ' + accessory.name + ' accessory ...');
            platformAccessories.push(accessory);
        }
        this.log(platformAccessories.length + ' accessories created');
        callback(platformAccessories);
    },
    
    //PLC connection check function
    S7ClientReconnect: function() {
        var log = this.log;
        var S7Client = this.S7Client;
        var ip = this.ip;
        var rack = this.rack;
        var slot = this.slot;
        var connecting = this.connecting;
        
        if (!S7Client.Connected()) {
            log("S7ClientReconnect: >> S7Client connecting to %s (%s:%s) connecting=%s", ip, rack, slot, connecting);

            if (!connecting) {
                this.connecting = true;
                //PLC connection asynchonousely...
                S7Client.ConnectTo(ip, rack, slot, function(err) {
                  if(err) {
                    log('S7ClientReconnect: >> Connection failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
                    log("S7ClientReconnect: >> S7Client connecting=%s", connecting);
                  }
                  else {
                    log("S7ClientReconnect: connected to %s (%s:%s)", ip, rack, slot);
                    
                  }
                  this.connecting = false;
                });
            }
        }
        else {
            debug("S7Client already connected to %s (%s:%s)", ip, rack, slot);
        }
    }
}


//Accessories definitions


//LightBulb
//config.json:
/*
    {
            "accessory": "S7_LightBulb",      //Type
            "name": "Salon",                  //Name
            "manufacturer": "Lumière du salon", //Manufacturer used as additional Description
            "DB": 1,                          //DB number
            "Byte" : 0,                       //Offset in the DB
            "ReadBitState" : 1                //Bit position of STATE status
            "WriteBitOff" : 2,                //Bit position of OFF command
            "WriteBitOn" : 3                  //Bit position of ON command
    }
*/

//LightBulb function
function LightBulb(platform, config) {
    this.FirmwareRevision = '0.0.1';
    this.platform = platform;
    this.log = platform.log;
    this.name = config.name;
    this.manufacturer = ('manufacturer' in config) ? config.manufacturer : 'S7-PLC';
    this.isOutlet = (config.accessory == 'S7_Outlet' );
    this.db = config.DB;
    this.dbbyte = config.Byte;
    this.dbbiton = config.WriteBitOn;
    this.dbbitoff = config.WriteBitOff;
    this.dbbitstate = config.ReadBitState;
    this.buf = Buffer.alloc(2);
    this.state = 0;
    debugLightBulb("Starting a S7_Lightbulb Service '" + this.name + "' on DB%d.DBB%d", this.db, this.dbbyte);
}
//LightBulb prototype
LightBulb.prototype = {

  setPowerOn: function(powerOn, callback, db, dbbyte, dbbiton, dbbitoff) {
    
    //LightBulb send PLC commands ON/OFF or value(%)
    var log = this.log;
    var platform = this.platform;
    var S7Client = this.platform.S7Client;
    var buf = this.buf;
    var state = this.state;
    
    debugLightBulb("setPowerOn: START");

    //check PLC connection
    platform.S7ClientReconnect();

    //Set the correct Bit for the operation
    if (powerOn) {
      dbbit = dbbiton;
      state=1;
    }
    else {
      dbbit = dbbitoff;
      state=0;
    }
    
    buf[0] = 1;
    log("setPowerOn poweron:"  + powerOn+ "state:" + state + " DB:" + db + " Byte:"+ dbbyte + " Bit:" + dbbit);

    // Write single Bit to DB asynchonousely...
    S7Client.WriteArea(S7Client.S7AreaDB, db, ((dbbyte*8) + dbbit), 1, S7Client.S7WLBit, buf, function(err) {
      if(err) {
        log('setPowerOn: >> DBWrite failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
        S7Client.Disconnect();
        callback(err);
      }
      else {
        log("setPowerOn: Set power state to %s. Set bit DB%d.DBX%d.%d", state, db, dbbyte, dbbit);
        callback(null);
      }
    });

    debugLightBulb("setPowerOn: END");
  },
  
    getPowerOn: function(callback, db, dbbyte, dbbit) {
    //LightBulb get PLC status ON/OFF
    var log = this.log;
    var platform = this.platform;
    var S7Client = this.platform.S7Client;
    var buf = this.buf;
    var state = this.state;
    
    debugLightBulb("getPowerOn: START");

    //check PLC connection
    platform.S7ClientReconnect();
    
    if (S7Client.Connected()) {
        // Read one bit from PLC DB asynchonousely...
        log("getPowerOn DB:" + db + " Byte:"+ dbbyte + " Bit:" + dbbit);
        S7Client.ReadArea(S7Client.S7AreaDB, db, ((dbbyte*8) + dbbit), 1, S7Client.S7WLBit, function(err, res) {
          if(err) {
            log('getPowerOn: >> DBRead failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
            S7Client.Disconnect();
            state = 0;
            callback(err, state);
          }
          else {
            if (res[0]) {
              state = 1;
              debugLightBulb("getPowerOn: Power is on");
            }
            else {
              state = 0;
              debugLightBulb("getPowerOn: Power is off");
            }
            debugLightBulb("getPowerOn: DB%d.DBX%d.%d: bitvalue=%d state=%d",  db, dbbyte, dbbit, res[0], state);
            callback(null, state);
          }
        }); 
        debugLightBulb("getPowerOn: END");
      }

      else {
        callback(new Error('PLC not connected'), false);
      }
    },
        
    getServices: function() {
        var informationService = new Service.AccessoryInformation();
        informationService
          .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
          .setCharacteristic(Characteristic.Model, this.isOutlet ? 'S7-Outlet' : 'S7-LightBulb')
          .setCharacteristic(Characteristic.SerialNumber, '085-250-085')
          .setCharacteristic(Characteristic.FirmwareRevision, this.FirmwareRevision);
        
        var service = this.isOutlet ? new Service.Outlet(this.name, this.name + 'Outlet') : new Service.Lightbulb(this.name, this.name + 'Lightbulb');        
        service
          .getCharacteristic(Characteristic.On)
          .on('get', function(callback) {this.getPowerOn(callback, this.db, this.dbbyte, this.dbbitstate)}.bind(this))
          .on('set', function(powerOn, callback) { this.setPowerOn(powerOn, callback, this.db, this.dbbyte, this.dbbiton, this.dbbitoff)}.bind(this));
        return [service,informationService];
    }
}

//LightDimm
//config.json:
/*
    {
            "accessory": "S7_LightDimm",      //Type
            "name": "Salon",                  //Name
            "descrition": "Lumière du salon", //Description
            "DB": 1,                          //DB number
            "Byte" : 0                        //Offset in the DB
    }
*/

//LightDimm function
function LightDimm(platform, config) {
    this.FirmwareRevision = '0.0.1';
    this.platform = platform;
    this.log = platform.log;
    this.name = config.name;
    this.manufacturer = ('manufacturer' in config) ? config.manufacturer : 'S7-PLC';
    this.db = config.DB;
    this.dbbyte = config.Byte;
    this.buf1 = Buffer.alloc(2);
    this.buf2 = Buffer.alloc(2);
    this.BrightnessVal = 0;
    debugLightDimm("Starting a s7_LightDimm Service '" + this.name + "' on DB%d.DBB%d", this.db, this.dbbyte);
}
//LightDimm prototype
LightDimm.prototype = {

  setPowerOn: function(powerOn, callback) { 
    //LightDimm send PLC commands ON/OFF
    var log = this.log;
    var platform = this.platform;
    var S7Client = this.platform.S7Client;
    var buf = this.buf1;
    var db = this.db;
    var dbbyte = this.dbbyte;
      
    debugLightDimm("setPowerOn: START");

    //check PLC connection
    platform.S7ClientReconnect();

    debugLightDimm("setPowerOn: powerOn=%d BrightnessVal=%d",powerOn,this.BrightnessVal);
        
    if (powerOn) {
      if (this.BrightnessVal>0)
        buf[0] = this.BrightnessVal;
      else
        buf[0] = 100;
      }
    else
      buf[0] = 0;

    // Write to DB asynchonousely...
    S7Client.DBWrite(db, dbbyte, 1, buf, function(err) {
      if(err) {
        log('setPowerOn: >> DBWrite failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
        S7Client.Disconnect();
        callback(err);
      }
      else {
        log("setPowerOn: Set power BrightnessVal to %s. Set word DB%d.DBW%d", buf[0], db, dbbyte);
        callback(null);
      }
    });

    debugLightDimm("setPowerOn: END");
  },
  
  getPowerOn: function(callback) {
    //LightDimm get PLC status ON/OFF
    var log = this.log;
    var platform = this.platform;
    var S7Client = this.platform.S7Client;
    var db = this.db;
    var dbbyte = this.dbbyte;
    var buf = this.buf1;
    var me = this;
    
    debugLightDimm("getPowerOn: START");

    //check PLC connection
    platform.S7ClientReconnect();
    if (S7Client.Connected()) {
        // Read one word from PLC DB asynchonousely...
        S7Client.ReadArea(S7Client.S7AreaDB, db, dbbyte, 1, S7Client.S7WLByte, function(err, res) {
          if(err) {
            log('getPowerOn: >> DBRead failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
            S7Client.Disconnect();
            callback(err, false);
          }
          else {
            debugLightDimm("getPowerOn: DB%d.DBW%d: %d",  db, dbbyte, res[0]);
            me.BrightnessVal=res[0];
            callback(null, res[0]!=0);
          }
        }); 
        debugLightDimm("getPowerOn: END");
      }

    else {
        callback(new Error('PLC not connected'), false);
    }
},

  setBrightness: function(brightness, callback) {
    //LightDimm send PLC commands value(%)
    var log = this.log;
    var platform = this.platform;
    var S7Client = this.platform.S7Client;
    var ip = this.ip;
    var buf = this.buf2;
    var db = this.db;
    var dbbyte = this.dbbyte;
        
    debugLightDimm("setbrightness: START");
    
    this.BrightnessVal = brightness;
    
    //check PLC connection
    platform.S7ClientReconnect();
    
     debugLightDimm("setbrightness: brightness=%d",brightness);  
       
    buf[0] = brightness;

    // Write to DB asynchonousely...
    S7Client.DBWrite(db, dbbyte, 1, buf, function(err) {
      if(err) {
        log('setbrightness: >> DBWrite failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
        S7Client.Disconnect();
        callback(err);
      }
      else {
        log("setbrightness: Set power BrightnessVal to %s. Set word DB%d.DBW%d", buf[0], db, dbbyte);
        callback(null);
      }
    });
    debugLightDimm("setbrightness: END");
  },
  
  getBrightness: function(callback) {
    //LightDimm get PLC status (%)
    var log = this.log;
    var platform = this.platform;
    var S7Client = this.platform.S7Client;
    var db = this.db;
    var dbbyte = this.dbbyte;
    var buf = this.buf2;
    var me = this;
    
    debugLightDimm("getbrightness: START");

    //check PLC connection
    platform.S7ClientReconnect();
    if (S7Client.Connected()) {
        // Read one word from PLC DB asynchonousely...
        S7Client.ReadArea(S7Client.S7AreaDB, db, dbbyte, 1, S7Client.S7WLByte, function(err, res) {
          if(err) {
            log('getbrightness: >> DBRead failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
            S7Client.Disconnect();
            callback(err, this.BrightnessVal);
          }
          else {
            debugLightDimm("getbrightness: DB%d.DBW%d: %d",  db, dbbyte, res[0]);
            me.BrightnessVal=res[0];
            callback(null, res[0]);
          }
        }); 
        debugLightDimm("getbrightness: END");
      }
      else {
        callback(new Error('PLC not connected'), 0);
    }
},
  
  getServices: function() {
    var informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, 'S7-Dim')
      .setCharacteristic(Characteristic.SerialNumber, '085-250-085')
      .setCharacteristic(Characteristic.FirmwareRevision, this.FirmwareRevision);
      
    var LightDimmService = new Service.Lightbulb(this.name, this.name + 'Lightbulb');
    LightDimmService
      .getCharacteristic(Characteristic.Brightness)
      .on('get', this.getBrightness.bind(this))
      .on('set', this.setBrightness.bind(this))
      .setProps({
                    minValue: 20,
                    maxValue: 100,
                    minStep: 1
                });
    
    LightDimmService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getPowerOn.bind(this))
      .on('set', this.setPowerOn.bind(this));
    return [LightDimmService,informationService];
  }
}




//Sensor
//config.json:
/*
        {
            "accessory": "s7_sensor",               //Type
            "name": "Extérieure",                   //Name
            "descrition": "Température extérieure", //Description
            "DB": 1,                                //DB number
            "Byte" : 0                              //Offset in the DB
        }
*/
//Sensor function
function Sensor(platform, config) {
    this.FirmwareRevision = '0.0.1';
    this.platform = platform;
    this.log = platform.log;
    this.name = config.name;
    this.manufacturer = ('manufacturer' in config) ? config.manufacturer : 'S7-PLC';
    this.isHumidity = (config.accessory == 'S7_Humidity' );
    this.db = config.DB;
    this.dbbyte = config.Byte;
    this.value = 0.0;
    debugSensor("Starting a S7_Sensor Service '" + this.name + "' on DB%d.DBD%d", this.db, this.dbbyte);
}
//Sensor prototype
Sensor.prototype = {
  
  getCurrentValue: function(callback) {
    var log = this.log;
    var platform = this.platform;
    var S7Client = this.platform.S7Client;
    var db = this.db;
    var dbbyte = this.dbbyte;
    var value= this.value;
    debugSensor("getCurrentValue: START");

    //check PLC connection
    platform.S7ClientReconnect();
    
    if (S7Client.Connected()) {
        // Read one real from DB asynchonousely...
        S7Client.ReadArea(S7Client.S7AreaDB, db, dbbyte, 1, S7Client.S7WLReal, function(err, res) {
          if(err) {
            log(' >> DBRead failed (DB' + db + '.DBD' + dbbyte + '):. Code #' + err + ' - ' + S7Client.ErrorText(err));
            S7Client.Disconnect();
            value = 0.0;
            callback(err, null);
          }
          else {
            debugSensor("getCurrentValue: DB%d.DBD%d: %f", db, dbbyte, res.readFloatBE(0));
            value = res.readFloatBE(0);
            callback(null, value);
          }
        });
        
      debugSensor("getCurrentValue: END");

    }
    else {
        callback(new Error('PLC not connected'), this.minValue);
    }
  },
  
  getServices: function() {
    var informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.isHumidity ? 'S7-Humidity' : 'S7-Temperature')
      .setCharacteristic(Characteristic.SerialNumber, '085-250-085')
      .setCharacteristic(Characteristic.FirmwareRevision, this.FirmwareRevision);
      
    var service;
    
    if (this.isHumidity) {
      service = new Service.HumiditySensor(this.name, this.name + 'HumiditySensor');
        service
          .getCharacteristic(Characteristic.CurrentRelativeHumidity)
          .on('get', this.getCurrentValue.bind(this))
          .setProps({
                        minValue: 0,
                        maxValue: 100,
                        minStep: 0.1
                    });
    }
    else{    
      service = new Service.TemperatureSensor(this.name, this.name + 'TemperatureSensor');
        service
          .getCharacteristic(Characteristic.CurrentTemperature)
          .on('get', this.getCurrentValue.bind(this))
          .setProps({
                        minValue: -50,
                        maxValue: 50,
                        minStep: 0.1
                    });
      }
    return [service,informationService];
  }
}















//Sensor
//config.json:
/*
        {
            "accessory": "S7_Thermostat",               //Type
            "name": "Extérieure",                   //Name
            "descrition": "Température extérieure", //Description
            "DB": 1,                                //DB number
            "Byte" : 0                              //Offset in the DB
        }
*/

function Thermostat(platform, config) {
    this.FirmwareRevision = '0.0.1';
    this.platform = platform;
    this.log = platform.log;
    this.name = config.name;
    this.manufacturer = ('manufacturer' in config) ? config.manufacturer : 'S7-PLC';
    this.db = config.DB;
    this.getCurrentTempOffset = config.getCurrentTempOffset
    this.getTargetTempOffset = config.getTargetTempOffset;
    this.setTargetTempOffset  = config.setTargetTempOffset;
    this.buf = Buffer.alloc(4);
    var uuid = UUIDGen.generate("this.name + 'Thermostat'");
    this.accessory = new Accessory(this.name, uuid);    
    this.service = new Service.Thermostat(this.name);
    this.accessory.addService(this.service);

    this.accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, 'S7-Thermostat')
      .setCharacteristic(Characteristic.SerialNumber, uuid)
      .setCharacteristic(Characteristic.FirmwareRevision, this.FirmwareRevision); 
      
      
      // create handlers for required characteristics
      this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .on('get', this.handleCurrentHeatingCoolingStateGet.bind(this));

      this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('get', this.handleTargetHeatingCoolingStateGet.bind(this))
        .on('set', this.handleTargetHeatingCoolingStateSet.bind(this));

      this.service.getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.handleCurrentTemperatureGet.bind(this));

      this.service.getCharacteristic(Characteristic.TargetTemperature)
        .on('get', this.handleTargetTemperatureGet.bind(this))
        .on('set', this.handleTargetTemperatureSet.bind(this));

      this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.handleTemperatureDisplayUnitsGet.bind(this))
        .on('set', this.handleTemperatureDisplayUnitsSet.bind(this));    
    this.log("Starting a S7_Thermostat Service '" + this.name + "' on DB%d.DBD%d", this.db, this.dbbyte);
}

Thermostat.prototype = {

  getServices: function() {
    return [this.accessory.getService(Service.AccessoryInformation), this.service];
  },


  getValue: function(callback, offset) {
    var log = this.log;
    var platform = this.platform;    
    var S7Client = this.platform.S7Client;
    debugSensor("getCurrentValue: START");

    //check PLC connection
    this.platform.S7ClientReconnect();
    
    if (S7Client.Connected()) {
        // Read one real from DB asynchonousely...
        S7Client.ReadArea(S7Client.S7AreaDB, this.db, offset, 1, S7Client.S7WLReal, function(err, res) {
          if(err) {
            log(' >> DBRead failed (DB' + this.db + '.DBD' + offset + '):. Code #' + err + ' - ' + S7Client.ErrorText(err));
            S7Client.Disconnect();
            callback(err, null);
          }
          else {
            log("getCurrentValue: DB%d.DBD%d: %f", this.db, offset, res.readFloatBE(0));
            var value = res.readFloatBE(0);
            callback(null, value);
          }
        });
        
      debugSensor("getCurrentValue: END");
    }
    else {
        callback(new Error('PLC not connected'), null);
    }
  },
  
  setValue: function(callback, offset, value) {
    var platform = this.platform;    
    var S7Client = this.platform.S7Client;

    //check PLC connection
    platform.S7ClientReconnect();
    
    if (S7Client.Connected()) {
        this.buf.writeFloatBE(value, 0);
        // Read one real from DB asynchonousely...
        S7Client.WriteArea(S7Client.S7AreaDB, this.db, offset, 1, S7Client.S7WLReal, this.buf, function(err) {
          if(err) {
            this.log(' >> DBWritefailed (DB' + this.db + '.DBD' + dbbyte + '):. Code #' + err + ' - ' + S7Client.ErrorText(err));
            S7Client.Disconnect();
            value = 0.0;
            callback(err);
          }
          else {
            
            callback(null);
          }
        });
    }
    else {
        callback(new Error('PLC not connected'), this.minValue);
    }
  },

  /**
   * Handle requests to get the current value of the "Current Heating Cooling State" characteristic
   */
  handleCurrentHeatingCoolingStateGet: function(callback) {
    this.log('Triggered GET CurrentHeatingCoolingState');

    // set this to a valid value for CurrentHeatingCoolingState
    const currentValue = 3;

    callback(null, currentValue);
  },


  /**
   * Handle requests to get the current value of the "Target Heating Cooling State" characteristic
   */
  handleTargetHeatingCoolingStateGet: function(callback) {
    this.log('Triggered GET TargetHeatingCoolingState');

    // set this to a valid value for TargetHeatingCoolingState
    const currentValue = 3;

    callback(null, currentValue);
  },

  /**
   * Handle requests to set the "Target Heating Cooling State" characteristic
   */
  handleTargetHeatingCoolingStateSet: function(value, callback) {
    this.log('Triggered SET TargetHeatingCoolingState %s:', value);

    callback(null);
  },

  /**
   * Handle requests to get the current value of the "Current Temperature" characteristic
   */
  handleCurrentTemperatureGet: function(callback) {
    this.log('Triggered GET CurrentTemperature');

    this.getValue(callback, this.getCurrentTempOffset);
  },


  /**
   * Handle requests to get the current value of the "Target Temperature" characteristic
   */
  handleTargetTemperatureGet: function(callback) {
    this.log('Triggered GET TargetTemperature');

    this.getValue(callback, this.getTargetTempOffset);
  },

  /**
   * Handle requests to set the "Target Temperature" characteristic
   */
  handleTargetTemperatureSet: function(value, callback) {
    this.log('Triggered SET TargetTemperature %s:', value);
    this.setValue(callback, this.setTargetTempOffset, value);
  },

  /**
   * Handle requests to set the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsSet: function(value, callback) {
    this.log('Triggered SET TemperatureDisplayUnits %s:', value);

    callback(null);
  },
  
  
    /**
   * Handle requests to get the current value of the "Temperature Display Units" characteristic
   */
  handleTemperatureDisplayUnitsGet(callback) {
    this.log.debug('Triggered GET TemperatureDisplayUnits');

    // set this to a valid value for TemperatureDisplayUnits
    const currentValue = 0;

    callback(null, currentValue);
  }
}






function WindowCovering(platform, config) {
    this.FirmwareRevision = '0.0.1';
    this.platform = platform;
    this.log = platform.log;
    this.name = config.name;
    this.manufacturer = ('manufacturer' in config) ? config.manufacturer : 'S7-PLC';
    this.db = config.DB;
    this.getCurrentPositionOffset = config.getCurrentPositionOffset
    this.getTargetPositionOffset = config.getTargetPositionOffset;
    this.setTargetPositionOffset  = config.setTargetPositionOffset;
    this.buf = Buffer.alloc(4);
    var uuid = UUIDGen.generate("this.name + 'WindowCovering'");
    this.accessory = new Accessory(this.name, uuid);    
    this.service = new Service.WindowCovering(this.name);
    this.accessory.addService(this.service);

    this.accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, 'S7-WindowCovering')
      .setCharacteristic(Characteristic.SerialNumber, uuid)
      .setCharacteristic(Characteristic.FirmwareRevision, this.FirmwareRevision); 
      
      // create handlers for required characteristics
      this.service.getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.handleCurrentPositionGet.bind(this));

      this.service.getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.handleTargetPositionGet.bind(this))
        .on('set', this.handleTargetPositionSet.bind(this));

      this.service.getCharacteristic(Characteristic.PositionState)
        .on('get', this.handlePositionStateGet.bind(this));
        
      this.service.getCharacteristic(Characteristic.HoldPosition)
        .on('set', this.handleHoldPosition.bind(this));
        
    this.log("Starting a S7_Thermostat Service '" + this.name + "' on DB%d.DBD%d", this.db, this.dbbyte);
}

WindowCovering.prototype = {

  getServices: function() {
    return [this.accessory.getService(Service.AccessoryInformation), this.service];
  },

  getValue: function(callback, offset) {
    var log = this.log;
    var platform = this.platform;    
    var S7Client = this.platform.S7Client;
    debugSensor("getCurrentValue: START");

    //check PLC connection
    this.platform.S7ClientReconnect();
    
    if (S7Client.Connected()) {
        // Read one real from DB asynchonousely...
        S7Client.ReadArea(S7Client.S7AreaDB, this.db, offset, 1, S7Client.S7WLReal, function(err, res) {
          if(err) {
            log('WindowCovering: ERROR >> DBRead failed (DB' + this.db + '.DBD' + offset + '):. Code #' + err + ' - ' + S7Client.ErrorText(err));
            S7Client.Disconnect();
            callback(err, null);
          }
          else {
            log("WindowCovering: getValue: DB%d.DBD%d: %f", this.db, offset, res.readFloatBE(0));
            var value = res.readFloatBE(0);
            callback(null, value);
          }
        });
        
      debugSensor("getCurrentValue: END");
    }
    else {
        callback(new Error('PLC not connected'), null);
    }
  },

  setValue: function(callback, offset, value) {
    var platform = this.platform;    
    var S7Client = this.platform.S7Client;

    //check PLC connection
    platform.S7ClientReconnect();
    
    if (S7Client.Connected()) {
        this.buf.writeFloatBE(value, 0);
        // Read one real from DB asynchonousely...
        S7Client.WriteArea(S7Client.S7AreaDB, this.db, offset, 1, S7Client.S7WLReal, this.buf, function(err) {
          if(err) {
            this.log('WindowCovering: ERROR >> DBWrite failed (DB' + this.db + '.DBD' + dbbyte + '):. Code #' + err + ' - ' + S7Client.ErrorText(err));
            S7Client.Disconnect();
            value = 0.0;
            callback(err);
          }
          else {
            
            callback(null);
          }
        });
    }
    else {
        callback(new Error('PLC not connected'), this.minValue);
    }
  },


  handleCurrentPositionGet(callback) {
    this.log('WindowCovering: Triggered GET CurrentPosition');
    this.getValue(callback, this.getCurrentPositionOffset);    
  },

  /**
   * Handle requests to get the current value of the "Target Position" characteristic
   */
  handleTargetPositionGet(callback) {
    this.log('WindowCovering: Triggered GET TargetPosition');
    this.getValue(callback, this.getTargetPositionOffset);
  },

  /**
   * Handle requests to set the "Target Position" characteristic
   */
  handleTargetPositionSet(value, callback) {
    this.log('WindowCovering: Triggered SET TargetPosition: %s', value);
    this.setValue(callback, this.setTargetPositionOffset, value);
  },

  /**
   * Handle requests to get the current value of the "Position State" characteristic
   */
  handlePositionStateGet(callback) {
    this.log('WindowCovering: Triggered GET PositionState');

    // set this to a valid value for PositionState
    const currentValue = 2;

    callback(null, currentValue);
  },


  /**
   * Handle requests to set the "Hold Position" characteristic
   */
  handleHoldPosition: function(callback) {
    this.log('WindowCovering: Triggered SET HoldPositionState');

    callback(null);
  }
}