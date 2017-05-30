const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const conf = require('./config.json');
const sqlite3 = require('sqlite3').verbose();
const mqtt = require('mqtt');


var db = new sqlite3.Database(conf.database);

var backend = require('./database.js')(db);

// Statische Files aus diesem Pfad ausliefern
app.use(express.static(conf.static_dir));

/* 
* MQTT Einrichten
*/
var mqtt_client  = mqtt.connect('mqtt://' + conf.mqttserver);

const waterrower = require('./waterrower.js')(mqtt_client);

app.set('backend',backend);
app.set('waterrower',waterrower);

mqtt_client.on('connect', function () {
    waterrower.onConnect();
    console.log("connected to mqtt server @ " + conf.mqttserver);
});


function getPayloadIntValue(payload, index) {
    return payload[index] << 8 | payload[index+1]
}

function getWaterrowerDataObj(payload) {
    let data = {};
    data.sessionid = getPayloadIntValue(payload,0); 
    data.ticks     = getPayloadIntValue(payload,2); 
    data.seconds   = getPayloadIntValue(payload,4);
    data.speed     = getPayloadIntValue(payload,6);
    data.distance  = getPayloadIntValue(payload,8);
    data.max_speed = getPayloadIntValue(payload,10);
    data.avg_speed = getPayloadIntValue(payload,12);
    return data;        
}

const hex = '0123456789ABFDEF';

function byteToHexString(b) {
    let result = '';
    result += hex[(b >> 4) & 0x0F];
    result += hex[b & 0x0F];
    return result;   
}

mqtt_client.on('message', function (topic, message) {
    // message is Buffer 
    console.log('Got message. Topic: ' + topic.toString());
    if (topic === 'sportshub/data') {
        backend.insertSessionEntry(getWaterrowerDataObj(message));
    } else {
        if (topic === 'sportshub/device/connect') {
            console.log("Device registered. Now converting mac address from payload.");
            //TODO: Converting mac adress
            /**
            console.log('B0 = ' + message[0]); 
            let clientString =  byteToHexString(message[0]) + ':';
            clientString     += byteToHexString(message[1]) + ':';  
            clientString     += byteToHexString(message[2]) + ':';  
            clientString     += byteToHexString(message[3]) + ':';  
            clientString     += byteToHexString(message[4]) + ':';  
            clientString     += byteToHexString(message[5])
            **/  
            console.log(message.toString()); 
        }
    }
})

// wenn der Pfad / aufgerufen wird
app.get('/', function (req, res) {
	// so wird die Datei index.html ausgegeben
	res.sendFile(__dirname + '/public/index.html');
});


app.get('/rest', function(req, res, next) {
    res.setHeader("Content-Type", conf.json_content_type);
    next('route');
});


require('./rest/user.js')(app);
require('./rest/session.js')(app);
require('./rest/device.js')(app);


// Websocket
io.sockets.on('connection', function (socket) {
	// der Client ist verbunden
	console.log('Connected');
	socket.emit('chat', { zeit: new Date(), text: 'Du bist nun mit dem Server verbunden!' });
	// wenn ein Benutzer einen Text senden
	socket.on('chat', function (data) {
		// so wird dieser Text an alle anderen Benutzer gesendet
        console.log('Message: ' + data.text);
		io.sockets.emit('chat', { zeit: new Date(), name: data.name || 'Anonym', text: data.text });
	});
});

// webserver
// auf den Port x schalten
server.listen(conf.port);

// Portnummer in die Konsole schreiben
console.log('Der Server läuft nun unter http://127.0.0.1:' + conf.port + '/');