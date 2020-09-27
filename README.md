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
  - Install this plugin using: `npm install -g homebridge-s7-plc`    **NOTE this REPRO has currently no prebuild npm install the mentioned and copy the index.js**
  - Edit `config.json` to add the plc platform and its accessories.
  - Run Homebridge

- Install via Homebridge Web UI 
  - Search for `s7` on the plugin screen of [config-ui-x](https://github.com/oznu/homebridge-config-ui-x) .
  - Find `Homebridge S7 Plc`
  - Click install.

## Homebridge configuration

- `S7` platform for 1 PLC (the plugin is not tested for more than 1 PLC)
  - `ip`: the IPv4 address of the PLC
  - `rack`: the rack number of the PLC typically 0
  - `slot`: the slot number of the PLC for S7 300/400 typically `2`, for 1200/1500 typically `1`
- in the platform, you can declare different types of accessories:
    - `S7_LightDimm`: it represent a 0/100% dimmable light 
    - `S7_LightBulb`: it represent a ON/OFF light 
    - `S7_TemperatureSensor`: it represent a temperature sensor
    - `S7_HumiditySensor`: it represent a humidity sensor
    - `S7_Thermostat`: it represent a temperature controlling unit
    - `S7_WindowCovering`: it represent a window blind
- 
#### Config.json Example
    {
        "platforms": [
        {
            "name": "Config",
            "port": 80,
            "platform": "config"
        },
        {
            "platform": "S7",
            "ip": "10.10.10.32",
            "rack": 0,
            "slot": 2,
            "accessories": [
                {
                    "accessory": "S7_LightBulb",
                    "name": "Büro DG",
                    "db": 6094,
                    "set_On": 0.9,
                    "set_Off": 0.8,
                    "get_State": 0
                },
                {
                    "accessory": "S7_Outlet",
                    "name": "Terassensteckdose",
                    "db": 6107,
                    "set_On": 0.9,
                    "set_Off": 0.8,
                    "get_State": 0
                },
                {
                    "accessory": "S7_HumiditySensor",
                    "name": "Außen %",
                    "manufacturer": "Dach",
                    "db": 1901,
                    "get_CurrentRelativeHumidity": 16
                },
                {
                    "accessory": "S7_TemperatureSensor",
                    "name": "Außen °C",
                    "manufacturer": "Dach",
                    "db": 1901,
                    "get_CurrentTemperature": 4
                },
                {
                    "accessory": "S7_Thermostat",
                    "name": "Büro DG °C",
                    "manufacturer": "DG",
                    "db": 6610,
                    "get_CurrentTemperature": 2,
                    "get_TargetTemperature": 6,
                    "set_TargetTemperature": 10
                },
                {
                    "accessory": "S7_WindowCovering",
                    "name": "Wohnzimmer Rollo",
                    "manufacturer": "EG",
                    "db": 2602,
                    "get_CurrentPosition": 2,
                    "get_TargetPosition": 8,
                    "set_TargetPosition": 8
                }
            ]
        }
    ]
    }

## PLC configuration

To be continued...