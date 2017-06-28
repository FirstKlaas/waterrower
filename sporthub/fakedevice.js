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

const logDebug      = require('debug')('fakedevice:debug');

logDebug('Connecting to ' + conf.mqttserver);
const mqttclient    = mqtt.connect('mqtt://' + conf.mqttserver);

const clientID     = "00:00:00:00:00:00";

mqttclient.on('connect', function() {
	logDebug('Connected');
    mqttclient.subscribe('sportshub/#')
});


/********************************************
* Listen to Commands
*********************************************/
mqttclient.subscribe(clientID + '/#');

/********************************************
* Connect to the Sportshub Server on Startup
*********************************************/
logDebug('Sending connect command for clientID ' + clientID)
mqttclient.publish("sportshub/device/connect", clientID);


