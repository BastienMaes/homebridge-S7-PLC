<span align="center">

# homebridge-S7-PLC

[![NPM Version](https://img.shields.io/npm/v/homebridge-s7-plc.svg)](https://www.npmjs.com/package/homebridge-s7-plc)
[![npm](https://img.shields.io/npm/l/homebridge-s7-plc.svg)](https://www.npmjs.com/package/homebridge-s7-plc) [![npm](https://img.shields.io/npm/dt/homebridge-s7-plc.svg)](https://www.npmjs.com/package/homebridge-s7-plc)

<p>SIEMENS S7 PLC plugin for 
  <a href="https://homebridge.io">Homebridge</a>. 
</p>

</span>



## Installation

- Basic Installation
  - Install this plugin using: `npm install -g homebridge-s7-plc`
  - Edit `config.json` to add the plc platform and its accessories.
  - Run Homebridge

- Install via Homebridge Web UI 
  - Search for `s7` on the plugin screen of [config-ui-x](https://github.com/oznu/homebridge-config-ui-x) .
  - Find `Homebridge S7 Plc`
  - Click install.

## Homebridge configuration

- `S7` platform for 1 PLC (the plugin is not tested for more than 1 PLC)
  - `IP`: the IPv4 address of the PLC
  - `RACK`: the rack number of the PLC typically 0
  - `SLOT`: the slot number of the PLC for S7 300/400 typically `2`, for 1200/1500 typically `1`
- in the platform, you can declare different types of accessories:
    - `S7_LightDimm`: it represent a 0/100% dimmable light 
    - `S7_LightBulb`: it represent a ON/OFF light 
    - `S7_Sensor`: it represent a Temperature sensor

#### Config.json Example
    {
        "platforms": [
            {
            "platform": "S7",
            "IP": "192.168.0.25",
			"RACK": "0",
			"SLOT": "1",
            "accessories": [

                {
                    "accessory": "S7_LightDimm",
                    "name": "Palier",
                    "DB": 10,
                    "Byte" : 598 
                },
                {
                    "accessory": "S7_LightBulb",
                    "name": "Chambre",
                    "DB": 10,
                    "Byte" : 280,
                    "WriteBitOn" : 3,
                    "WriteBitOff" : 2,
                    "ReadBitState" : 1
                },
                {
                    "accessory": "S7_Sensor",
                    "name": "Température de la chambre",
                    "DB": 10,
                    "Byte" : 888
                }
            ]
        }
        ]
    }

## PLC configuration

To be continued...