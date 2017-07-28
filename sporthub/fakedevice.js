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


const dispatcher = new EventEmitter();

logDebug(`Connecting to ${conf.mqttserver}`);
const mqttclient    = mqtt.connect(`mqtt://${conf.mqttserver}`);

function sendData(fakedevice) {
	logDebug("New send data promise");
	return new Promise((resolve,reject) => {
		if (!fakedevice) {
			logError("No device given. Cannot send data.");
			return reject(new Error("No device given. Cannot send data."));
		} 
		logDebug("Fakedevice %s, Session %d: ",fakedevice.clientID, fakedevice.sessionid);
		const payload = Buffer.allocUnsafe(16);
		payload[0] = (fakedevice.sessionid >> 8) & 0xFF;      // HighByte Session
		payload[1] = fakedevice.sessionid & 0xFF;             // Lowbyte Session
		payload[2] = (fakedevice.tick >> 8) & 0xFF;           // HighByte Tick
		payload[3] = fakedevice.tick & 0xFF;                  // Lowbyte Tick
		payload[4] = (fakedevice.tick >> 8) & 0xFF;           // HighByte Seconds
		payload[5] = fakedevice.tick & 0xFF;                  // Lowbyte Seconds
		payload[6] = 0;
		payload[7] = 0;
		payload[8]  = (fakedevice.distance >> 24) & 0xFF;     // Distance
		payload[9]  = (fakedevice.distance >> 16) & 0xFF;     // Distance
		payload[10] = (fakedevice.distance >> 8) & 0xFF;      // Distance
		payload[11] = (fakedevice.distance) & 0xFF;           // Distance
		payload[12] = 0;
		payload[13] = 0;
		payload[14] = 0;
		payload[15] = 0;
		mqttclient.publish("sportshub/data", payload);
		resolve(fakedevice);
	})
}

/********************************************
* Listen to Commands
*********************************************/
//mqttclient.subscribe(clientID + '/#');

mqttclient.on('message', function(topic,payload) {
	logDebug("Got mqtt message. Topic %s", topic);
	dispatcher.emit(topic,payload);
});
	
class FakeDevice {
	constructor(id) {
		this.tick            = 0;
		this.sessionid       = 0;
		this.distance        = 0;
		this.sessionid       = null;

		let self = this;
		let b4 = (id >> 24) & 0xff;
		let b3 = (id >> 16) & 0xff;
		let b2 = (id >> 8) & 0xff;
		let b1 = (id) & 0xff;
		this.clientID = `00:00:${mqttutil.byteToHexString(b4)}:${mqttutil.byteToHexString(b3)}:${mqttutil.byteToHexString(b2)}:${mqttutil.byteToHexString(b1)}`;

		logDebug("New Fake Device with ID %s",this.clientID);
		logDebug('Subscribing to messages for ' + self.clientID);
		mqttclient.subscribe(self.clientID + '/#');

		/********************************************
		* Connect to the Sportshub Server on Startup
		*********************************************/
		logDebug('Sending connect command for clientID ' + self.clientID)
		mqttclient.publish("sportshub/device/connect", self.clientID);

		dispatcher.on(this.clientID, function(payload) {
			logDebug(`Received message. ID is '${self.clientID}'`);

			if (mqttutil.START_SESSION_CMD == payload[0]) {
				logDebug("payload[1] = %d, payload[2] = %d",payload[1], payload[2])
				self.sessionid = payload[1] << 8 | payload[2];
				logDebug(`Session started id=${self.sessionid}`);
				self.timerObj = setInterval(() => {
					self.tick++;
					self.distance += Math.floor((Math.random() * 10));
					sendData(self).then(fd => logDebug("Sent data for device %s", fd.clientID))
				},1000);
			} else if(mqttutil.STOP_SESSION_CMD == payload[0]) {
				self.tick = 0;
				self.distance = 0;
				clearInterval(self.timerObj);
				self.timerObj = null;
				logDebug(`Session stopped id=${self.sessionid}`);
				this.sessionid = null;	
			}
		});

	}
}

mqttclient.on('connect', function() {
	logDebug('Connected');
    new FakeDevice(4);
	new FakeDevice(0x23456789);
	new FakeDevice(6);
	new FakeDevice(5);
});

