const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const conf = require('./config.json');
const sqlite3 = require('sqlite3').verbose();


var db = new sqlite3.Database(conf.database);

var backend = require('./database.js')(db);

// Statische Files aus diesem Pfad ausliefern
app.use(express.static(conf.static_dir));
app.set('view engine', 'pug');

const waterrower = require('./waterrower.js')(conf.mqttserver);

app.set('backend',backend);
app.set('waterrower',waterrower);
/**
mqtt_client.on('connect', function () {
    waterrower.onConnect();
    console.log("connected to mqtt server @ " + conf.mqttserver);
});
**/

waterrower.on('data', function (sender, data) {
    backend.insertSessionEntry(data);
    io.emit('message', data);
});

waterrower.on('device-connected', function(sender, payload) {
    console.log("Device registered.");
});

// Setting up routes
const rest_user_router    = require('./rest/user.js')(app);
const rest_session_router = require('./rest/session.js')(app);
const rest_device_router  = require('./rest/device.js')(app);

app.get('/rest', function(req, res, next) {
    res.setHeader("Content-Type", conf.json_content_type);
    next('route');
});

app.use('/rest/user', rest_user_router);
app.use('/rest/session', rest_session_router);
app.use('/rest/device', rest_device_router);


// wenn der Pfad / aufgerufen wird
app.get('/main.html', function (req, res) {
    res.render('index', {});
});

app.get('/livedata.html', function (req, res) {
    res.render('live', {});
});

app.get('/user.html', function (req, res) {
    let users = backend.getUsers(
        function(err) {
            res.status(500).send({'err':err})
        },
        function(users) {
            res.render('user', { 'users': users});
        }
    )
});

app.get('/sessions.html', function (req, res) {
    let users = backend.getSessions(
        function(err) {
            res.status(500).send({'err':err})
        },
        function(sessions) {
            res.render('sessions', { 'sessions': sessions});
        }
    )
});

app.get('/devices.html', function (req, res) {
    let devices = backend.getDevices(
        function(err) {
            res.status(500).send({'err':err})
        },
        function(devices) {
            io.emit('message', 'Tadaa')
            res.render('device', { 'devices': devices});
        }
    )
})

app.get('/device/:id', function (req, res) {
    let device = backend.getDevice(
        req.params.id,
        function(err) {
            res.status(500).send({'err':err})
        },
        function(device) {
            res.render('device', { 'devices': [device]});
        }
    )
})

app.get('/hof/maxspeed.html',function (req, res) {
    let device = backend.getHallOfFameMaxSpeed(
        function(err) {
            res.status(500).send({'err':err})
        },
        function(entries) {
            res.render('hof_maxspeed', { 'hof': entries});
        }
    )
})

app.get('/hof/distance.html',function (req, res) {
    let device = backend.getHallOfFameDistance(
        function(err) {
            res.status(500).send({'err':err})
        },
        function(entries) {
            res.render('hof_distance', { 'hof': entries});
        }
    )
})

// Websocket
io.sockets.on('connection', function (socket) {
	// der Client ist verbunden
	//console.log('Connected');
	socket.emit('chat', { zeit: new Date(), text: 'Du bist nun mit dem Server verbunden!' });
	// wenn ein Benutzer einen Text senden
	socket.on('chat', function (data) {
		// so wird dieser Text an alle anderen Benutzer gesendet
        //console.log('Message: ' + data.text);
		io.sockets.emit('chat', { zeit: new Date(), name: data.name || 'Anonym', text: data.text });
	});
});

backend.stopActiveSessions();
// webserver
// auf den Port x schalten
server.listen(conf.port);

// Portnummer in die Konsole schreiben
console.log('Der Server läuft nun unter http://127.0.0.1:' + conf.port + '/');