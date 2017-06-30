const EventEmitter = require('events');
const mqtt     = require('mqtt');
const mqttutil = require('./mqtt-device-util.js'); 

var exports = module.exports = (server) => {
	return new Waterrower(server);
};

function getWaterrowerDataObj(payload) {
    let data = {};
    data.sessionid = mqttutil.getPayloadIntValue(payload,0); 
    data.ticks     = mqttutil.getPayloadIntValue(payload,2); 
    data.seconds   = mqttutil.getPayloadIntValue(payload,4);
    data.speed     = mqttutil.getPayloadIntValue(payload,6) / 100;
    data.distance  = mqttutil.getPayloadLongValue(payload,8) / 100;
    data.max_speed = mqttutil.getPayloadIntValue(payload,12) / 100;
    data.avg_speed = mqttutil.getPayloadIntValue(payload,14) / 100;
    return data;        
}

class Waterrower extends EventEmitter {

	constructor(server) {
        super();
		let self = this;
		this.sessionid = null;
		this.mqtt = mqtt.connect('mqtt://' + server);
		this.mqtt.on('connect', function() {
            self.mqtt.subscribe('sportshub/#')
        });
        this.mqtt.on('message', function (topic, message) {
			if (topic === 'sportshub/data') {
    		    self.emit('data', self, getWaterrowerDataObj(message));
    		} else if (topic === 'sportshub/device/connect') {
                // Payload ist die MAC Adresse des Device als Sring.
    			self.emit('device-connected', self, message.toString());
    		}
		});
        
	}
    
	startSession(mac,id) {
        const payload = Buffer.allocUnsafe(4);
        payload[0] = mqttutil.START_SESSION_CMD;   // CMD StartSession
        payload[1] = (id >> 8) & 0xFF              // HighByte Session
        payload[2] = id & 0xFF;                    // Lowbyte Session
        payload[3] = mqttutil.REAL_DEVICE;         // Using Real Device
        this.mqtt.publish(mac, payload);
        this.emit('session-start', this, id);
	}

	getSessionId() {
		return this.sessionid;
	}

	stopSession(mac, sessionid) {		
        const payload = Buffer.allocUnsafe(3);
        payload[0] = mqttutil.STOP_SESSION_CMD;    // CMD Stop Session
        payload[1] = (sessionid >> 8) & 0xFF;      // HighByte Session
        payload[2] = sessionid & 0xFF;             // Lowbyte Session
        this.mqtt.publish(mac, payload);
        this.sessionid = null;
        this.emit('session-stop', this, sessionid);
	}
}