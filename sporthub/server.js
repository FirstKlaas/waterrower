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

app.locals.numeral = require('numeral');

waterrower.on('data', function (sender, data) {
    backend.insertSessionEntry(data);
    io.emit('message', data);
});

waterrower.on('device-connected', function(sender, payload) {
    console.log("Device registered.");
});


waterrower.on('session-start', function(sender, id) {
    backend.getSession(id).then(
        session => io.emit('session-start', session) 
    ) 
});

waterrower.on('session-stop', function(sender, sessionid) {
    backend.getSession(sessionid).then(
        session => io.emit('session-stop', session)
    )
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

app.get('/menu.html', function (req, res) {
    res.render('main_menu', {});
});

app.get('/livedata.html', function (req, res) {
    res.render('live', {});
});

app.get('/user.html', function (req, res) {
    backend.getUsers()
    .then(users => res.render('user', { 'users': users}))
    .catch(err => res.status(500).send({'err':err}));
});

app.get('/sessions.html', function (req, res) {
    backend.getSessions()
    .then(sessions => res.render('sessions', { 'sessions': sessions}))
    .catch(err => res.status(500).send({'err':err}));
});

app.get('/devices.html', function (req, res) {
    backend.getDevices()
    .then(devices => res.render('device', { 'devices': devices}))
    .catch(err => res.status(500).send({'err':err}));
})

app.get('/device/:id', function (req, res) {
    backend.getDevice()
    .then(device => res.render('device', { 'devices': [device]}))
    .catch(err => res.status(500).send({'err':err}));
})

const halloffame_router = require('./routes/hall-of-fame.js')(app);
app.use('/hof', halloffame_router);

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

backend.stopActiveSessions().then(values => {
    // webserver
    // auf den Port x schalten
    server.listen(conf.port);

    // Portnummer in die Konsole schreiben
    console.log('Der Server läuft nun unter http://127.0.0.1:' + conf.port + '/');    
});
