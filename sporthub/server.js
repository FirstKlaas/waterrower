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

mqtt_client.on('message', function (topic, message) {
  // message is Buffer 
    //console.log(topic.toString())
    if (topic === 'sportshub/data') {
        backend.insertSessionEntry(getWaterrowerDataObj(message));
    }
})

// wenn der Pfad / aufgerufen wird
app.get('/', function (req, res) {
	// so wird die Datei index.html ausgegeben
	res.sendFile(__dirname + '/public/index.html');
});


app.get('/user', function (req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    backend.getUsers(function (data) {
        res.json(data);
    });
});

app.get('/user/:userid', function (req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    backend.getUser(req.params.userid, function(data) {
       res.json(data); 
    })
});

app.get('/session', function (req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    backend.getSessions(function (data) {
        res.json(data);
    });
});


/**
* Creates a new Session in the database for the given user.
* A "start_session" command is "send" to the waterrower.
*
* author        : Klaas Nebuhr
* since         : 17/05/27
* last-modified : 17/05/27
*
* TODO:
*   - Check if the user exists
*   - Check if the device exists
**/
app.get('/session/start/:userid/:deviceid', function(req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    let device = null;

    backend.getDevice(req.params.deviceid, 
        function(err) {
            // Database error
            res.status(400).json({"err" : err});
        },
        function(device) {
            if (device) {
                backend.startSession(req.params.userid,req.params.deviceid, 
                    function(err) {
                        // Database error
                        res.status(400).json({"err" : err});
                    }, 
                    function(sessionid) {
                        if (sessionid) {

                            // Session successfully created
                            res.json({ "sessionid" : sessionid });
                            waterrower.startSession(device.mac,sessionid);
                        } else {
                            res.status(404).json({});
                        }
                    }

                );
            } else {
                // No device found
                res.status(404).json({"err" : "No such device"});
            }        
        }
    );
});

/**
* Stops the Session referenced by sessionid.
* The session values of the session entry in the database are
* updated according to the last waterrower values.
*
* A "stop_session" command is "send" to the waterrower.
*
* author        : Klaas Nebuhr
* since         : 17/05/27
* last-modified : 17/05/27
*
* TODO:
*   - Check if the session exists
*   - Updating the session values
*   
**/
app.get('/session/stop/:sessionid', function(req, res) {
    backend.stopSession(req.params.sessionid, function(err) {
        res.status(400).json({"err" : err});
    }, function(device) {
        if (device) {
            /* Session stopped successfully */
            waterrower.stopSession(device.mac,req.params.sessionid);
            /* No data in this case */      
            res.json({"device":device});
        } else {
            res.status(404).json({});
        }
    });
});

app.get('/session/:sessionid', function (req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    backend.getSession(req.params.sessionid, function(data) {
        res.json(data);
    })
});

app.get('/user/:userid/session', function (req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    backend.getUserSessions(req.params.userid, function(data) {
        res.json(data);    
    })
});

app.get('/session/:sessionid/entry', function (req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    backend.getSessionEntries(req.params.sessionid, function(data) {
        res.json(data);
    })
});

app.get('/session/:sessionid/entry/:minsec/:maxsec', function (req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    db.all("SELECT * FROM session_entry WHERE session_id=? AND seconds <= ? AND seconds >= ? ORDER BY seconds ASC",[req.params.sessionid, req.params.minsec, req.params.maxsec], function (err, rows) {
        res.json({ "session_entry" : rows });
    });
});

app.get('/device/active/:id', function(req, res) {
    backend.isDeviceActive(req.params.id,
        function(err) {
            res.status(400).json({"err":err});
        },
        function(session) {
            if (session) {
                res.json({
                    "active" : true,
                    "session" : session
                })
            } else {
                res.json({
                    "active" : false
                })
            }
        }
    );
});


app.get('/device/:id', function(req, res) {
    backend.getDevice(
        req.params.id,
        function(err) {
            res.status(400).json({"err": err});
        },
        function(device) {
            if (device) {
                res.json({"device": device});
            } else {
                res.status(404).json({"deviceid" : req.params.id});
            }
        }
    ); 
});

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