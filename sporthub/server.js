const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const conf = require('./config.json');
const sqlite3 = require('sqlite3').verbose();
const mqtt = require('mqtt');

var db = new sqlite3.Database(conf.database);

// Statische Files aus diesem Pfad ausliefern
app.use(express.static(conf.static_dir));

// wenn der Pfad / aufgerufen wird
app.get('/', function (req, res) {
	// so wird die Datei index.html ausgegeben
	res.sendFile(__dirname + '/public/index.html');
});

app.get('/user', function (req, res) {
    res.setHeader("Content-Type", conf.json_content_type);
    db.all("SELECT * FROM user", function (err, rows) {
        res.json({ "users" : rows });
    });
});

app.get('/user/:id', function (req, res) {
    res.setHeader("Content-Type", "application/json");
    db.get("SELECT * FROM user WHERE id=?", [req.params.id], function (err, row) {
        res.json({ "user" : row });
    });
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