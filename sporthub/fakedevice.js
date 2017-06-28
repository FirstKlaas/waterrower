'use strict';

/**********************************************
* Emulation of a Fakedevice to be able to test
* without the need of real hardware.
*
* @autor : Klaas Nebuhr
* @since : 2017-06-28
*
***********************************************/

const mqtt          = require('mqtt');
const EventEmitter  = require('events');

const configuration = require('./config.json');
const conf          = configuration['development'];
const mqttutil      = require('./mqtt-device-util.js')

const mqtt          = mqtt.connect('mqtt://' + conf.mqttserver);

const clientdID     = "00:00:00:00:00:00";

mqtt.on('connect', function() {
    mqtt.subscribe('sportshub/#')
});


/********************************************
* Listen to Commands
*********************************************/
mqtt.subscribe(clientdID + '/#');

/********************************************
* Connect to the Sportshub Server on Startup
*********************************************/
mqtt.publish("sportshub/device/connect", clientdID);


