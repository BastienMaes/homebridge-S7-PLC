var debug =          require('../homebridge/node_modules/hap-nodejs/node_modules/debug')('homebridge-S7') //debug messages ->https://github.com/visionmedia/debug
var debugLightDimm = require('../homebridge/node_modules/hap-nodejs/node_modules/debug')('homebridge-S7_LightDimm') 
var debugLightBulb = require('../homebridge/node_modules/hap-nodejs/node_modules/debug')('homebridge-S7_LightBulb')
var debugSensor    = require('../homebridge/node_modules/hap-nodejs/node_modules/debug')('homebridge-S7_Sensor')
var Service, Characteristic;
var snap7 = require('node-snap7');
var S7Client = new snap7.S7Client();
var ip;

var S7accessory = {
    "S7_LightBulb": LightBulb,
    "S7_LightDimm": LightDimm,
    "S7_Sensor" : Sensor   
}//this var is used to have a unique constructor for accessories instanciation in platform

//Exports
module.exports = function(homebridge) {
  // Service and Characteristic from hap-nodejs/lib/gen/HomeKitTypes.js
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform('homebridge-platform-S7', 'S7', S7Platform);
  homebridge.registerAccessory('homebridge-s7plc', 'S7_LightDimm', LightDimm, true);
  homebridge.registerAccessory('homebridge-s7plc', 'S7_LightBulb', LightBulb, true);
  homebridge.registerAccessory('homebridge-s7plc', 'S7_Sensor', Sensor, true);
}

//Platform definitions
//S7
//config.json:

//	"platforms": [
//        {
//		"platform": "S7",
//		"IP": "10.10.10.10",
//		"accessories": []
//	}
//  ]

function S7Platform(log, config) {
	this.log = log;
	this.config = config;
    ip = this.config.IP;
    
    S7PLCConnection(this.log, ip);
}

S7Platform.prototype = {
    accessories: function(callback) {
    
        debug('Fetching S7 devices...');
        //For each device, create an accessory!
        var foundAccessories = this.config.accessories;
        //create array of accessories
        var platformAccessories = [];
        
        for (var i = 0; i < foundAccessories.length; i++) {
            debug('Parsing accessory ' + i + ' of ' + foundAccessories.length);
            this.log('Pushing new ' + foundAccessories[i].accessory + ' device: ' + foundAccessories[i].name);
            //Call accessoryConstruction
            var accessory = new S7accessory[foundAccessories[i].accessory](this.log, foundAccessories[i]);
            debug('Creating ' + accessory.name + ' accessory ...');
            platformAccessories.push(accessory);
        }
        this.log(platformAccessories.length + ' accessories created');
        callback(platformAccessories);
    }
}


//Accessories definitions


//LightBulb
//config.json:
/*
   	{
           	"accessory": "S7_LightBulb",      //Type
           	"PLC_IP_Adr": "1.1.1.1",          //PLC IP address
           	"name": "Salon",                  //Name
           	"descrition": "Lumière du salon", //Description
           	"DB": 1,                          //DB number
           	"Byte" : 0,                       //Offset in the DB
            "ReadBitState" : 1                //Bit position of STATE status
           	"WriteBitOff" : 2,                //Bit position of OFF command
           	"WriteBitOn" : 3,                 //Bit position of ON command
    }
*/

//LightBulb function
function LightBulb(log, config) {
    this.FirmwareRevision = '0.0.1';
    this.log = log;
    this.name = config.name;
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

  setPowerOn: function(powerOn, callback) {
    
    //LightBulb send PLC commands ON/OFF or value(%)
    var log = this.log;
    var buf = this.buf;
    var db = this.db;
    var dbbyte = this.dbbyte;
    var dbbiton = this.dbbiton;
    var dbbitoff = this.dbbitoff;
    var dbbit = 0;
    
    debugLightBulb("setPowerOn: START");

    //check PLC connection
    S7PLCConnection(log, ip);

    //Set the correct Bit for the operation
    if (powerOn) 
      dbbit = dbbiton;
    else 
      dbbit = dbbitoff;
      
    buf[0] = Math.pow(2, dbbit);

    // Write to DB asynchonousely...
    S7Client.DBWrite(db, dbbyte, 1, buf, function(err) {
      if(err) {
        log('setPowerOn: >> DBWrite failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
        S7Client.Disconnect();
        callback(err);
      }
      else {
        log("setPowerOn: Set power state to %s. Set bit DB%d.DBX%d.%d", this.state, db, dbbyte, dbbit);
        callback(null);
      }
    });

    debugLightBulb("setPowerOn: END");
  },
  
  getPowerOn: function(callback) {
    //LightBulb get PLC status ON/OFF
    var log = this.log;
    var db = this.db;
    var dbbyte = this.dbbyte;
    var dbbit = this.dbbitstate;
    var value = Math.pow(2, dbbit);
    var buf = this.buf;
    var state = this.state;
    
    debugLightBulb("getPowerOn: START");

    //check PLC connection
    S7PLCConnection(log, ip);
 
    // Read one byte from PLC DB asynchonousely...
    S7Client.ReadArea(S7Client.S7AreaDB, db, dbbyte, 1, S7Client.S7WLByte, function(err, res) {
      if(err) {
        log('getPowerOn: >> DBRead failed. Code #' + err + ' - ' + S7Client.ErrorText(err));
        S7Client.Disconnect();
        state = 0;
        callback(err, state);
      }
      else {
        if ((res[0] & value) == value) {
          state = 1;
          debugLightBulb("getPowerOn: Power is on");
        }
        else {
          state = 0;
          debugLightBulb("getPowerOn: Power is off");
        }
        debugLightBulb("getPowerOn: DB%d.DBX%d.%d: bytevalue=%d value=%d state=%d",  db, dbbyte, dbbit, res[0], value, state);
        callback(null, state);
      }
    }); 
    debugLightBulb("getPowerOn: END");
  },
  
  getServices: function() {
    var informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'BMA')
      .setCharacteristic(Characteristic.Model, 'S7-Sensor')
      .setCharacteristic(Characteristic.SerialNumber, '085-250-085')
      .setCharacteristic(Characteristic.FirmwareRevision, this.FirmwareRevision);
      
    var lightbulbService = new Service.Lightbulb(this.name);
    lightbulbService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getPowerOn.bind(this))
      .on('set', this.setPowerOn.bind(this));
    return [lightbulbService,informationService];
  }
}

//LightDimm
//config.json:
/*
   	{
           	"accessory": "S7_LightDimm",      //Type
           	"PLC_IP_Adr": "1.1.1.1",          //PLC IP address
           	"name": "Salon",                  //Name
           	"descrition": "Lumière du salon", //Description
           	"DB": 1,                          //DB number
           	"Byte" : 0,                       //Offset in the DB
    }
*/

//LightDimm function
function LightDimm(log, config) {
    this.FirmwareRevision = '0.0.1';
    this.log = log;
    this.name = config.name;
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
    var buf = this.buf1;
    var db = this.db;
    var dbbyte = this.dbbyte;
      
    debugLightDimm("setPowerOn: START");

    //check PLC connection
    S7PLCConnection(log, ip);

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
    var db = this.db;
    var dbbyte = this.dbbyte;
    var buf = this.buf1;
    var me = this;
    
    debugLightDimm("getPowerOn: START");

    //check PLC connection
    S7PLCConnection(log, ip);
 
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
  },

  setBrightness: function(brightness, callback) {
    //LightDimm send PLC commands value(%)
    var log = this.log;
    var ip = this.ip;
    var buf = this.buf2;
    var db = this.db;
    var dbbyte = this.dbbyte;
        
    debugLightDimm("setbrightness: START");
    
    this.BrightnessVal = brightness;
    
    //check PLC connection
    S7PLCConnection(log, ip);
    
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
    var db = this.db;
    var dbbyte = this.dbbyte;
    var buf = this.buf2;
    var me = this;
    
    debugLightDimm("getbrightness: START");

    //check PLC connection
    S7PLCConnection(log, ip);
 
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
  },
  
  getServices: function() {
    var informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'BMA')
      .setCharacteristic(Characteristic.Model, 'S7-Sensor')
      .setCharacteristic(Characteristic.SerialNumber, '085-250-085')
      .setCharacteristic(Characteristic.FirmwareRevision, this.FirmwareRevision);
      
    var LightDimmService = new Service.Lightbulb(this.name);
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
           	"PLC_IP_Adr": "1.1.1.1",                //PLC IP address
           	"name": "Extérieure",                   //Name
           	"descrition": "Température extérieure", //Description
           	"DB": 1,                                //DB number
           	"Byte" : 0                              //Offset in the DB
        }
*/
//Sensor function
function Sensor(log, config) {
    this.FirmwareRevision = '0.0.1';
    this.log = log;
    this.name = config.name;
    this.db = config.DB;
    this.dbbyte = config.Byte;
    this.value = 0.0;
    debugSensor("Starting a S7_Sensor Service '" + this.name + "' on DB%d.DBD%d", this.db, this.dbbyte);
}
//Sensor prototype
Sensor.prototype = {
  
  getCurrentValue: function(callback) {
    var log = this.log;
    var db = this.db;
    var dbbyte = this.dbbyte;
    var value= this.value;
    debugSensor("getCurrentValue: START");

    //check PLC connection
    S7PLCConnection(log, ip);

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

  },
  
  getServices: function() {
    var informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, 'BMA')
      .setCharacteristic(Characteristic.Model, 'S7-Sensor')
      .setCharacteristic(Characteristic.SerialNumber, '085-250-085')
      .setCharacteristic(Characteristic.FirmwareRevision, this.FirmwareRevision);
      
    var sensorService = new Service.TemperatureSensor(this.name);
    sensorService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on('get', this.getCurrentValue.bind(this))
      .setProps({
                    minValue: -50,
					maxValue: 50,
					minStep: 0.1
				});

    return [sensorService,informationService];
  }
}

//Common functions
//PLC connection
function S7PLCConnection(log, ip) {
  //PLC connection check function
  if (!S7Client.Connected()) {
    log(">> S7Client connecting to %s", ip);
    //PLC connection synchonousely...
    S7Client.ConnectTo(ip, 0, 1);
  }
  else {
    debug("S7Client %s already connected", ip);
  }
}
