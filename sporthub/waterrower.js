var exports = module.exports = (mqtt_client) => {
	return new Waterrower(mqtt_client);
};

// const clientID = "60:01:94:0B:DA:C7";

const FAKE_DEVICE       = 0x01;
const REAL_DEVICE       = 0x00;
const START_SESSION_CMD = 0x01;
const STOP_SESSION_CMD  = 0x02;

class Waterrower {
	constructor(client) {
		this.mqtt = client
	}

	onConnect() {
		this.mqtt.subscribe('sportshub/#')
	}

	startSession(mac,id) {
        const payload = Buffer.allocUnsafe(4);
        payload[0] = START_SESSION_CMD;        // CMD StartSession
        payload[1] = (id >> 8) & 0xFF // HighByte Session
        payload[2] = id & 0xFF;       // Lowbyte Session
        payload[3] = FAKE_DEVICE               // Using Fake Device
        this.mqtt.publish(mac, payload);
	}

	stopSession(mac, sessionid) {
		
        const payload = Buffer.allocUnsafe(3);
        payload[0] = STOP_SESSION_CMD;  // CMD Stop Session
        payload[1] = (sessionid >> 8) & 0xFF;
        payload[2] = sessionid & 0xFF;
        this.mqtt.publish(mac, payload);
	}
}