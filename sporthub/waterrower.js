const EventEmitter = require('events');
const mqtt = require('mqtt');

var exports = module.exports = (server) => {
	return new Waterrower(server);
};

// const clientID = "60:01:94:0B:DA:C7";

const FAKE_DEVICE       = 0x01;
const REAL_DEVICE       = 0x00;
const START_SESSION_CMD = 0x01;
const STOP_SESSION_CMD  = 0x02;


function getPayloadIntValue(payload, index) {
    return payload[index] << 8 | payload[index+1]
}

function getPayloadLongValue(payload, index) {
    return payload[index++] << 24 | payload[index++] << 16 | payload[index++] << 8 | payload[index]
}

function getWaterrowerDataObj(payload) {
    let data = {};
    data.sessionid = getPayloadIntValue(payload,0); 
    data.ticks     = getPayloadIntValue(payload,2); 
    data.seconds   = getPayloadIntValue(payload,4);
    data.speed     = getPayloadIntValue(payload,6) / 100;
    data.distance  = getPayloadLongValue(payload,8) / 100;
    data.max_speed = getPayloadIntValue(payload,12) / 100;
    data.avg_speed = getPayloadIntValue(payload,14) / 100;
    return data;        
}

const hex = '0123456789ABFDEF';

function byteToHexString(b) {
    let result = '';
    result += hex[(b >> 4) & 0x0F];
    result += hex[b & 0x0F];
    return result;   
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
    			self.emit('device-connected', self, payload);
    		}
		});
        
	}
    
	startSession(mac,id) {
        const payload = Buffer.allocUnsafe(4);
        payload[0] = START_SESSION_CMD;        // CMD StartSession
        payload[1] = (id >> 8) & 0xFF // HighByte Session
        payload[2] = id & 0xFF;       // Lowbyte Session
        payload[3] = REAL_DEVICE; // FAKE_DEVICE               // Using Fake Device
        this.mqtt.publish(mac, payload);
        this.emit('session-start', this);
	}

	getSessionId() {
		return this.sessionid;
	}

	stopSession(mac, sessionid) {		
        const payload = Buffer.allocUnsafe(3);
        payload[0] = STOP_SESSION_CMD;  // CMD Stop Session
        payload[1] = (sessionid >> 8) & 0xFF;
        payload[2] = sessionid & 0xFF;
        this.mqtt.publish(mac, payload);
        this.sessionid = null;
        this.emit('session-stop', this, sessionid);
	}
}