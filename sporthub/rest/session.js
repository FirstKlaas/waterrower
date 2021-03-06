const express = require('express')

const logDebug      = require('debug')('waterrower:rest:session:debug')
const logError      = require('debug')('waterrower:rest:session:error')

const authUtil = require('../auth-util.js');

var exports = module.exports = (app) => {

	let backend    = app.get('backend')
	let waterrower = app.get('waterrower')
	const router = express.Router() 

	router.use(authUtil.restCall);
	router.use(authUtil.isLoggedInForRest);
	
	router.get('/', function (req, res) {
	    backend.getSessions()
	    .then(data => {
	    	data.forEach( session => {
	    	});
	    	res.json({"sessions":data})
	    })
	    .catch(err => res.status(500).json({"err":err}));
	});

	router.get('/user/:userid', function (req, res) {
	    backend.getUserSessions(req.params.userid)
	    .then(data => {
	    	data.forEach( session => {
	    	});
	    	res.json({"sessions":data})
	    })
	    .catch(err => res.status(500).json({"err":err}));
	});

	router.get('/delete/:id', function (req, res) {
		backend.getSession(req.params.id)
		.then( session => {
			// Is the session to be deleted owned 
			// by the logged in user or is user admin?
			if (session.user_id === req.user.id || req.user.isadmin === 1) {
				return backend.deleteSession(req.params.id);
			} else {
				return Promise.reject("Session not owned by user and user is no admin.")
			}
		})
	    .then(() => res.json({"sessionid":req.params.id}))
	    .catch(err => res.status(500).json({"err":err}));
	});


	/**
	*
	**/
	router.get('/active', function (req, res) {
	    backend.getActiveSessionForUser(req.user.id)
	    .then(data => {
	    	if (data) {
	    		res.json({"session":data});
	    	} else {
	    		res.json({"user":req.user});
	    	}
	    })
	    .catch(er => res.status(500).json({"err":err}));
	});

	/**
	* Creates a new Session in the database for the given user.
	* A "start_session" command is "send" to the waterrower.
	*
	* A status 500 is send back, if any error occurs. The body
	* contains an error object.
	*
	* A status 404 is send back, if a session for this device is 
	* already running. The body contains the requested user id and
	* the requested device id.
	*
	* author        : Klaas Nebuhr
	* since         : 17/05/27
	* last-modified : 17/05/27
	*
	**/
	router.get('/start/:deviceid', function(req, res) {
	    let device = null;
	    if (!req.user) {
	    	logError("No user. Cannot start a new session.")
	    }
    	logDebug("Starting session for user %d on device %d", req.user.id, req.params.deviceid);
	
	    backend.device.get(req.params.deviceid)
	    .then(device => {
	    	if (!device) {
	    		logError("No device with id %d in database. Shouldn't be the case.", req.params.deviceid);
	    		res.status(404).json({"err" : "No such device"})
	    	} else {
	    		backend.startSession(req.user.id,req.params.deviceid)
	    		.then(session => {
	    			logDebug("Started new session: %o",session)
	    			res.json({"session" : session});
                    waterrower.startSession(device.mac,session.id);
	                        
	    		}).catch( err => res.status(500).json({"err" : err}));
	    	}

	    })
	    .catch(err => res.status(500).json({"err" : err}));
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
	router.get('/stop/:sessionid', function(req, res) {
		backend.stopSession(req.params.sessionid).then(device => {
			if (device) {
                /* Session stopped successfully in database */
                /* Now sending stop command to the device   */
                waterrower.stopSession(device.mac,req.params.sessionid);
                /* No data in this case */      
                res.json({"device" : device});
            } else {
                res.status(404).json({});
            }
	    }).catch((err) => res.status(500).json({"err" : err}));
	});

	router.get('/:sessionid', function (req, res) {
	    backend.getSession(req.params.sessionid)
	    .then(data => res.json(data))
	    .catch((err) => res.status(500).json({"err" : err}));
	});

	router.get('/entry/:sessionid', function (req, res, next) {
		backend.getSessionEntries(req.params.sessionid)
	    .then(data => res.json(data))
	    .catch(err => res.status(500).json({"err" : err}));
	});

	return router;
}