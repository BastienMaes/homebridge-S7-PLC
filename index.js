var Accessory, Service, Characteristic, UUIDGen;
var snap7 = require('node-snap7');


var S7accessory = {
    "S7_LightBulb": GenericS7,
    "S7_LightDimm": GenericS7,
    "S7_Outlet": GenericS7,
    "S7_HumiditySensor" : GenericS7,
    "S7_TemperatureSensor" : GenericS7,
    "S7_Thermostat" : GenericS7,
    "S7_WindowCovering": GenericS7
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
  homebridge.registerAccessory(platformName, 'S7_LightDimm', GenericS7, true);
  homebridge.registerAccessory(platformName, 'S7_LightBulb', GenericS7, true);
  homebridge.registerAccessory(platformName, 'S7_Outlet', GenericS7, true);  
  homebridge.registerAccessory(platformName, 'S7_HumiditySensor', GenericS7, true);
  homebridge.registerAccessory(platformName, 'S7_TemperatureSensor', GenericS7, true);  
  homebridge.registerAccessory(platformName, 'S7_Thermostat', GenericS7, true);  
  homebridge.registerAccessory(platformName, 'S7_WindowCovering', GenericS7, true);    
}

//Platform definitions
//S7
//config.json:

//  "platforms": [
//        {
//      "platform": "S7",
//      "ip": "10.10.10.10",
//      "rack": 0,
//      "slot": 2,
//      "accessories": []
//  }
//  ]

function S7Platform(log, config) {
    //initialize
    this.log = log;
    this.config = config;
    this.S7Client = new snap7.S7Client();
    var ip = this.config.ip;
    var rack = this.config.rack;
    var slot = this.config.slot;    
    //PLC connection synchonousely...
    this.log("S7Client connecting to %s (%s:%s)", ip, rack, slot);
    this.S7Client.ConnectTo(ip, rack, slot);
    this.connecting = false;
}

S7Platform.prototype = {    
    //Accessories retrieval
    accessories: function(callback) {
        var log = this.log;

        log("Add S7 accessories...");
        //For each device, create an accessory!
        var foundAccessories = this.config.accessories;
        //create array of accessories
        var platformAccessories = [];
        
        for (var i = 0; i < foundAccessories.length; i++) {
            log("[" + i + "/" + foundAccessories.length + "] " + foundAccessories[i].name + " (" +  foundAccessories[i].accessory + ")" );
            //Call accessoryConstruction
            var accessory = new S7accessory[foundAccessories[i].accessory](this, foundAccessories[i]);
            platformAccessories.push(accessory);
        }
        callback(platformAccessories);
    },
    
    //PLC connection check function
    S7ClientReconnect: function() {
        var log = this.log;
        var S7Client = this.S7Client;
        var ip = this.config.ip;
        var rack = this.config.rack;
        var slot = this.config.slot;
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
    }
}






function GenericS7(platform, config) {
  this.platform = platform;
  this.log = platform.log;
  this.name = config.name;
  this.buf = Buffer.alloc(4);
  var uuid = UUIDGen.generate(config.name + config.accessory);
  this.accessory = new Accessory(this.name, uuid); 

  ////////////////////////////////////////////////////////////////
  // Lightbulb
  ////////////////////////////////////////////////////////////////
  if (config.accessory == 'S7_LightBulb') {   
    this.service =  new Service.Lightbulb(this.name);
    this.accessory.addService(this.service);

    this.service.getCharacteristic(Characteristic.On)
      .on('get', function(callback) {this.getBit(callback, 
        config.db, 
        Math.floor(config.get_State), Math.floor((config.get_State*10)%10)
      )}.bind(this))
      .on('set', function(powerOn, callback) { this.setOnOffBit(powerOn, callback, 
        config.db, 
        Math.floor(config.set_On), Math.floor((config.set_On*10)%10),
        Math.floor(config.set_Off), Math.floor((config.set_Off*10)%10),
      )}.bind(this));
  }

  ////////////////////////////////////////////////////////////////
  // S7_LightBulbDim
  ////////////////////////////////////////////////////////////////
  if (config.accessory == 'S7_LightBulbDim') {   
    this.service =  new Service.Lightbulb(this.name);
    this.accessory.addService(this.service);

    this.service.getCharacteristic(Characteristic.On)
      .on('get', function(callback) {this.getBit(callback, 
        config.db, 
        Math.floor(config.get_State), Math.floor((config.get_State*10)%10)
      )}.bind(this))
      .on('set', function(powerOn, callback) { this.setOnOffBit(powerOn, callback, 
        config.db, 
        Math.floor(config.set_On), Math.floor((config.set_On*10)%10),
        Math.floor(config.set_Off), Math.floor((config.set_Off*10)%10),
      )}.bind(this));

    this.service.getCharacteristic(Characteristic.Brightness)
    .on('get', function(callback) {this.getReal(callback, 
      config.db, 
      config.get_Brightness
      )}.bind(this))
    .on('set', function(value, callback) {this.setReal(value, callback, 
      config.db, 
      config.set_Brightness
      )}.bind(this))
      .setProps({
        minValue: 20,
        maxValue: 100,
        minStep: 1
    });            
  }

  ////////////////////////////////////////////////////////////////
  // Outlet
  ////////////////////////////////////////////////////////////////    
  if (config.accessory == 'S7_Outlet') {   
    this.service =  new Service.Outlet(this.name);
    this.accessory.addService(this.service);

    this.service.getCharacteristic(Characteristic.On)
      .on('get', function(callback) {this.getBit(callback, 
        config.db, 
        Math.floor(config.get_State), Math.floor((config.get_State*10)%10)
      )}.bind(this))
      .on('set', function(powerOn, callback) { this.setOnOffBit(powerOn, callback, 
        config.db, 
        Math.floor(config.set_On), Math.floor((config.set_On*10)%10),
        Math.floor(config.set_Off), Math.floor((config.set_Off*10)%10),
      )}.bind(this));
  }

  ////////////////////////////////////////////////////////////////
  // TemperatureSensor
  //////////////////////////////////////////////////////////////// 
  if (config.accessory == 'S7_TemperatureSensor') {   
    this.service =  new Service.TemperatureSensor(this.name);
    this.accessory.addService(this.service);

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
    .on('get', function(callback) {this.getReal(callback, 
      config.db, 
      config.get_CurrentTemperature
      )}.bind(this))
    .setProps({
      minValue: -50,
      maxValue: 50,
      minStep: 0.1    
    });
  }

  ////////////////////////////////////////////////////////////////
  // HumiditySensor
  //////////////////////////////////////////////////////////////// 
  if (config.accessory == 'S7_HumiditySensor') {   
    this.service =  new Service.HumiditySensor(this.name);
    this.accessory.addService(this.service);

    this.service.getCharacteristic(Characteristic.CurrentRelativeHumidity)
    .on('get', function(callback) {this.getReal(callback, 
      config.db, 
      config.get_CurrentRelativeHumidity
      )}.bind(this))
    .setProps({
      minValue: 0,
      maxValue: 100,
      minStep: 1    
    });
  }

  ////////////////////////////////////////////////////////////////
  // Thermostat
  ////////////////////////////////////////////////////////////////  
  else if (config.accessory == 'S7_Thermostat'){
    this.service = new Service.Thermostat(this.name);
    this.accessory.addService(this.service);

  this.service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
  .on('get', function(callback) {this.getDummy(callback,
    1, // currently return fixed value inactive=0, idle=1, heating=2, cooling=3
    'CurrentHeatingCoolingState'
    )}.bind(this));

  this.service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
  .on('get', function(callback) {this.getDummy(callback,
    3, // currently return fixed value off=0, heat=1, cool=2, automatic=3
    'TargetHeatingCoolingState'
    )}.bind(this))
  .on('set', function(value, callback) {this.setDummy(value, callback, 
    'TargetHeatingCoolingState'
    )}.bind(this));  

    this.service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
    .on('get', function(callback) {this.getDummy(callback,
      0, // currently return fixed value celsium=0, fareneinheit=1
      'TemperatureDisplayUnits'
      )}.bind(this))
    .on('set', function(value, callback) {this.setDummy(value, callback, 
      'TemperatureDisplayUnits'
      )}.bind(this));  

      this.service.getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', function(callback) {this.getReal(callback, 
        config.db, 
        config.get_CurrentTemperature
        )}.bind(this));

      this.service.getCharacteristic(Characteristic.TargetTemperature)
      .on('get', function(callback) {this.getReal(callback, 
        config.db, 
        config.get_TargetTemperature
        )}.bind(this))
      .on('set', function(value, callback) {this.setReal(value, callback, 
        config.db, 
        config.set_TargetTemperature
        )}.bind(this))
        .setProps({
          minValue: 20,
          maxValue: 30,
          minStep: 1
      });                 
  }  
  ////////////////////////////////////////////////////////////////
  // WindowCovering
  ////////////////////////////////////////////////////////////////    
  else if (config.accessory == 'S7_WindowCovering'){ 
    this.service = new Service.WindowCovering(this.name);
    this.accessory.addService(this.service);

    // create handlers for required characteristics
    this.service.getCharacteristic(Characteristic.CurrentPosition)
      .on('get', function(callback) {this.getReal(callback, 
        config.db, 
        config.get_CurrentPosition
        )}.bind(this));

    this.service.getCharacteristic(Characteristic.TargetPosition)
      .on('get', function(callback) {this.getReal(callback, 
        config.db, 
        config.get_TargetPosition
        )}.bind(this))
      .on('set', function(value, callback) {this.setReal(value, callback, 
        config.db, 
        config.set_TargetPosition
        )}.bind(this));

    this.service.getCharacteristic(Characteristic.PositionState)
      .on('get', function(callback) {this.getDummy(callback,
        2,
        'PositionState'
        )}.bind(this));
      
    this.service.getCharacteristic(Characteristic.HoldPosition)
      .on('get', function(callback) {this.handleDummy(callback, 
        'HoldPosition'        
        )}.bind(this));
  }
      
  this.accessory.getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, ('manufacturer' in config) ? config.manufacturer : 'S7-PLC')
  .setCharacteristic(Characteristic.Model, config.accessory)
  .setCharacteristic(Characteristic.SerialNumber, uuid)
  .setCharacteristic(Characteristic.FirmwareRevision, '0.0.1'); 

  this.log.debug("Done " + this.name + " (" + config.accessory + ")");
}

GenericS7.prototype = {

  getServices: function() {
    return [this.accessory.getService(Service.AccessoryInformation), this.service];
  },

  //////////////////////////////////////////////////////////////////////////////
  // DUMMY
  //////////////////////////////////////////////////////////////////////////////
  setDummy: function(value, callback, text) {
    this.log.debug("setDummy("+ this.name +") " + text + ": " + value);
    callback(null);
  },

  handleDummy: function(callback, text) {
    this.log.debug("handleDummy("+ this.name +") " + text);
    callback(null);
  },

  getDummy: function(callback, value, text) {
    this.log.debug("getDummy("+ this.name +") " + text + ": " + value);
    callback(null, value);
  },


  //////////////////////////////////////////////////////////////////////////////
  // BIT
  //////////////////////////////////////////////////////////////////////////////
  setOnOffBit: function(value, callback, db, on_offset, on_bit, off_offset, off_bit) {    
    //Set single bit depending on value
    var S7Client = this.platform.S7Client;
    var buf = this.buf;
    var log = this.log;
    var name = this.name;
    //check PLC connection
    this.platform.S7ClientReconnect();
    if (S7Client.Connected()) {

      //Set the correct Bit for the operation
      const offset = value ? on_offset : off_offset;
      const bit = value ? on_bit : off_bit;

      this.buf[0] = 1;
      // Write single Bit to DB asynchonousely...
      S7Client.WriteArea(S7Client.S7AreaDB, db, ((offset*8) + bit), 1, S7Client.S7WLBit, this.buf, function(err) {
        if(err) {
          log("setOnOffBit("+ name +") >> WriteArea failed DB" + db + "DBX"+ offset + "." + bit +" Code #" + err + " - " + S7Client.ErrorText(err));
          S7Client.Disconnect();
          callback(err);
        }
        else {
          log.debug("setOnOffBit("+ name +") DB" + db + "DBX"+ offset + "." + bit + ": " + value);
          callback(null);
        }
      });
    }
    else {
      callback(new Error('PLC not connected'), false);
    }
  },

  getBit: function(callback, db, offset, bit) {
    //read single bit
    var S7Client = this.platform.S7Client;
    var log = this.log;
    var name = this.name;
    //check PLC connection
    this.platform.S7ClientReconnect();
      
    if (S7Client.Connected()) {
      // Read one bit from PLC DB asynchonousely...
      S7Client.ReadArea(S7Client.S7AreaDB, db, ((offset*8) + bit), 1, S7Client.S7WLBit, function(err, res) {
        if(err) {
          log("getBit("+ name +") >> ReadArea failed DB" + db + "DBX"+ offset + "." + bit +" Code #" + err + " - " + S7Client.ErrorText(err));
          S7Client.Disconnect();
          callback(err, 0);
        }
        else {
          const value = ((res[0]) ? 1 : 0);
          log.debug("getBit("+ name +") DB" + db + "DBX"+ offset + "." + bit + ": " + value);
          callback(null, value);
        }
      }); 
    }
    else {
      callback(new Error('PLC not connected'), false);
    }
  },
  
  //////////////////////////////////////////////////////////////////////////////
  // REAL
  //////////////////////////////////////////////////////////////////////////////
  setReal: function(value, callback, db, offset) {
    var S7Client = this.platform.S7Client;
    var log = this.log;
    var name = this.name;
    var buf = this.buf
    //check PLC connection
    this.platform.S7ClientReconnect();
    
    if (S7Client.Connected()) {
        buf.writeFloatBE(value, 0);
        // Write one real from DB asynchonousely...
        S7Client.WriteArea(S7Client.S7AreaDB, db, offset, 1, S7Client.S7WLReal, buf, function(err) {
          if(err) {
            log("setReal: >> WriteArea failed." + name +") DB" + db + "DBD"+ offset +" Code #" + err + " - " + S7Client.ErrorText(err));
            S7Client.Disconnect();
            callback(err);
          }
          else {              
            log.debug("setReal("+ name +") DB" + db + "DBD"+ offset + ": " + value);
            callback(null);
          }
        });
    }
    else {
        callback(new Error('PLC not connected'));
    }
  },
    
  getReal: function(callback, db, offset) {
    var S7Client = this.platform.S7Client;
    var log = this.log;
    var name = this.name;
    var value = 0;
    //check PLC connection
    this.platform.S7ClientReconnect();
    
    if (S7Client.Connected()) {
        // Write one real from DB asynchonousely...
        
        S7Client.ReadArea(S7Client.S7AreaDB, db, offset, 1, S7Client.S7WLReal, function(err, res) {
          if(err) {
            log("getReal("+ name +") >> ReadArea failed DB" + db + "DBD"+ offset +" Code #" + err + " - " + S7Client.ErrorText(err));
            S7Client.Disconnect();
            callback(err);
          }
          else {              
            value = res.readFloatBE(0);
            log.debug("getReal("+ name +") DB" + db + "DBD"+ offset + ": " + value);
            callback(null, value);
          }
        });
    }
    else {
        callback(new Error('PLC not connected'));
    }
  }





}

