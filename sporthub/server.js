const express       = require('express');
const app           = express();
const server        = require('http').createServer(app);
const io            = require('socket.io').listen(server);
const configuration = require('./config.json');
const sqlite3       = require('sqlite3').verbose();
const logDebug      = require('debug')('waterrower:server:debug')
const logError      = require('debug')('waterrower:server:error')
var passport        = require('passport');
var flash           = require('connect-flash');
var cookieParser    = require('cookie-parser');
var bodyParser      = require('body-parser');
var session         = require('express-session');
var SQLiteStore     = require('connect-sqlite3')(session);
var Twitter         = require('twitter');
    
var conf            = configuration[app.get('env')];
var twitter_conf    = require('./twitter.json');
const authUtil      = require('./auth-util.js');

var twitter_client = new Twitter({
  consumer_key: twitter_conf.consumer_key,
  consumer_secret: twitter_conf.consumer_secret,
  access_token_key: twitter_conf.access_token_key,
  access_token_secret: twitter_conf.access_token_secret
});

var twitter_util = require('./twitter-util.js')(twitter_client);

logDebug('We are in ' + app.get('env') + ' mode');

var db = new sqlite3.Database(conf.database);

var backend = require('./database.js')(db,twitter_util);

const passportConfig = require('./config/passport.js')(passport,backend);

// Statische Files aus diesem Pfad ausliefern
app.use(express.static(conf.static_dir));
app.set('view engine', 'pug');
app.use(cookieParser()); // read cookies (needed for auth)

app.use(bodyParser.urlencoded({extended: true}));

app.use(bodyParser.json());

io.on('connection', data => {
    logError("Socket connection established");
})

let session_config = {
    cookie : 'waterrower.sid',
    secret : 'secret',
    store  : new SQLiteStore
}

function emitToView(view, topic, data) {
    //io.of(view).emit(topic,data);
    io.emit(topic,data);
    
    let nsView = io.of(view);
    nsView.clients((err,clients) => {
        clients.forEach(client => {
            let socket = nsView.connected[client];
            if (socket) {
                socket.emit(topic, data);
            }
        })
    })
    
}

/**
    store: session_config.store,
**/
app.use(session({
    store: session_config.store,
    key: session_config.cookie,
    secret: session_config.secret,
    resave: true,
    saveUninitialized: true 
})); // session secret

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

app.use(flash()); // use connect-flash for flash messages stored in session

const waterrower = require('./waterrower.js')(conf.mqttserver);

app.set('backend',backend);
app.set('waterrower',waterrower);
app.set('twitter', twitter_util);

app.locals.numeral = require('numeral');

waterrower.on('data', function (sender, data) {
    backend.insertSessionEntry(data);
    backend.getSession(data.sessionid)
    .then( session => { 
        if (session) return backend.getUser(session.user_id);
        logError("Not a valid session.");
        logError("%O", data);
        Promise.reject(new Error('Not a valid session. This is an inconsistency.'));
    })
    .then( user => {
        if (!user) return Promise.reject(new Error("No user for given session"));
        emitToView(`/${user.login}`,'message', data) 
        //logDebug("Emitting data record to %s.",user.login);
    })

    .catch( err => logError("Error while dispatching data record from device. %o", err) )
});

waterrower.on('device-connected', function(sender, mac) {
    logDebug("External device registered. Checking, if device exists in database.");
    backend.device.getDeviceByMacAddress(mac).then( device => {
        if (device) {
            logDebug("Device %s already registered. Welcome back",device.human);
            return Promise.resolve(device);
        } else {
            logDebug("New device %s. Try to register.", mac);
            return backend.device.addNewDevice(mac);
        }
    })
    .then(device => logDebug("Device is %j",device))
    .catch(err => logError("%O",err));    
});

waterrower.on('session-start', function(sender, id) {
    let s = null;

    backend.getSession(id)
    .then(session => {
        if (!session) return Promise.reject(new Error("No session found"));
        s = session;
        return backend.getUser(session.user_id);
    })
    .then( user => {
        if (!user) return Promise.reject(new Error("No user found"));
        logDebug('Going to emit session-start for user %s', user.login);
        emitToView(`/${user.login}`,'session-start', s);
    })
    .catch(err => logError("Could not notify sockets about session start. %s %O", id, err));
});

waterrower.on('session-stop', function(sender, sessionid) {
    let s = null;
    backend.getSession(sessionid)
    .then(session => {
        if (!session) return Promise.reject('No session');
        s = session;
        return backend.getUser(session.user_id);
    })
    .then( user => {
        logDebug('Going to emit session-stop for user %s (%d)', user.login, s.id)
        emitToView(`/${user.login}`,'session-stop', s)
    })
    .catch(err => logError("Could not retrieve session %d or user. (%o)", id, err));
});

// Setting up the REST routes
const rest_user_router    = require('./rest/user.js')(app);
const rest_session_router = require('./rest/session.js')(app);
const rest_device_router  = require('./rest/device.js')(app);

app.use('/rest/user', rest_user_router);
app.use('/rest/session', rest_session_router);
app.use('/rest/device', rest_device_router);

// Everything dealing with the accounting
let account_router = require('./routes/account.js')(passport,backend);
app.use('/', account_router);

// wenn der Pfad /main aufgerufen wird
app.get('/main', authUtil.isLoggedIn, function (req, res) {
    if (req.user) { 
        res.render('index', {user:req.user,device:req.session.activeDevice});
    } else {
        res.redirect('/');
    }
});

app.get('/menu.html', authUtil.isLoggedIn, function (req, res) {
    res.render('main_menu', {});
});

app.get('/livedata.html', authUtil.isLoggedIn, function (req, res) {
    res.render('live', {});
});

app.get('/user.html', authUtil.isLoggedIn, function (req, res) {
    backend.getUsers()
    .then(users => res.render('user', { 'users': users}))
    .catch(err => res.status(500).send({'err':err}));
});

app.get('/sessions.html', authUtil.isLoggedIn, function (req, res) {
    backend.getSessions()
    .then(sessions => res.render('sessions', { 'sessions': sessions}))
    .catch(err => res.status(500).send({'err':err}));
});

app.get('/usersessions', authUtil.isLoggedIn, function (req, res) {
    backend.getUserSessions(req.user.id)
    .then(sessions => res.render('sessions', { 'sessions': sessions}))
    .catch(err => res.status(500).send({'err':err}));
});

let device_router = require('./routes/devices.js')(backend);
app.use('/', device_router);


const halloffame_router = require('./routes/hall-of-fame.js')(app);

app.use('/hof', halloffame_router);

// Websocket
/**
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
**/

//backend.stopActiveSessions().then(values => {
    // webserver
    // auf den Port x schalten
server.listen(conf.port);

// Portnummer in die Konsole schreiben
logDebug('Der Server läuft nun auf port %d', conf.port);    
//}).catch(err => console.log(err));

