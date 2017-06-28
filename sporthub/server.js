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
const FileStore     = require('session-file-store')(session);
var Twitter         = require('twitter');

var conf            = configuration[app.get('env')];
var twitter_conf    = require('./twitter.json');


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

let session_config = {
    cookie : 'waterrower.sid',
    secret : 'secret',
    store  : new FileStore({path:"sessions"}) 
}

/**
    store: session_config.store,
**/
app.use(session({
    key: session_config.cookie,
    secret: session_config.secret,
    resave: true,
    saveUninitialized: true 
})); // session secret

logDebug(session_config.secret);

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
    io.emit('message', data);
});

waterrower.on('device-connected', function(sender, payload) {
    logDebug("External device registered. Checking, if device exists in database.");
    
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


app.get('/', (req,res) => {
    res.render('login', {message: req.flash('loginMessage')});
})

app.get('/logout', isLoggedIn, (req,res) => {
    req.logout();
    res.redirect('/');
})

app.get('/signup', (req,res) => {
    res.render('signup', {});
})

app.get('/profile', isLoggedIn, (req,res) => {
    res.render('profile', {user:req.user});
})

app.post('/profile', isLoggedIn, (req, res) => {
    let data = {};
    data.id        = req.user.id;
    data.twitter   = req.body.twitter;
    data.firstname = req.body.firstname;
    data.lastname  = req.body.lastname;
    logDebug("New User Data: %O", data);
    backend.updateUser(data)
    .then(user => {
        req.user = user;
        res.redirect("/main");    
    })
    .catch( err => {
        logError(err);
        res.redirect('/');
    })
    
})

// wenn der Pfad / aufgerufen wird
app.get('/main', isLoggedIn, function (req, res) {
    logDebug('/main: Session %O',  req.session.passport); 
    if (req.user) { 
        res.render('index', {user:req.user});
    } else {
        res.redirect('/');
    }
});

app.post('/login', passport.authenticate('local-login', {
    successRedirect : '/main', 
    failureRedirect : '/', // redirect back to the signup page if there is an error
    failureFlash : true // allow flash messages
}))

app.post('/signup', passport.authenticate('local-signup', {
    successRedirect : '/profile', // redirect to the secure profile section
    failureRedirect : '/signup', // redirect back to the signup page if there is an error
    failureFlash : true // allow flash messages
}));

app.get('/menu.html', isLoggedIn, function (req, res) {
    res.render('main_menu', {});
});

app.get('/livedata.html', isLoggedIn, function (req, res) {
    res.render('live', {});
});

app.get('/user.html', isLoggedIn, function (req, res) {
    backend.getUsers()
    .then(users => res.render('user', { 'users': users}))
    .catch(err => res.status(500).send({'err':err}));
});

app.get('/sessions.html', isLoggedIn, function (req, res) {
    backend.getSessions()
    .then(sessions => res.render('sessions', { 'sessions': sessions}))
    .catch(err => res.status(500).send({'err':err}));
});

app.get('/usersessions/:id', isLoggedIn, function (req, res) {
    backend.getUserSessions(req.params.id)
    .then(sessions => res.render('sessions', { 'sessions': sessions}))
    .catch(err => res.status(500).send({'err':err}));
});


app.get('/devices.html', isLoggedIn, function (req, res) {
    backend.getDevices()
    .then(devices => res.render('device', { 'devices': devices}))
    .catch(err => res.status(500).send({'err':err}));
})

app.get('/device/:id', isLoggedIn, function (req, res) {
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
    logDebug('Der Server läuft nun auf port %d', conf.port);    
});

function isLoggedIn(req, res, next) {
    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        logDebug('User is authentificated %O',req.user);
        return next();

    // if they aren't redirect them to the home page
    logDebug('User is not authentificated');
    res.redirect('/');
}
