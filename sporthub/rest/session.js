const express = require('express')

var exports = module.exports = (app) => {

	let backend    = app.get('backend')
	let waterrower = app.get('waterrower')
	const router = express.Router() 

	router.get('/', function (req, res) {
	    backend.getSessions(
	        function (err) {
	            res.status(500).json({"err":err});
	        },
	        function (data) {
	            res.json({"sessions":data});
	        }
	    );
	});


	router.get('/active', function (req, res) {
	    backend.getActiveSessions(
	        function (err) {
	            res.status(500).json({"err":err});
	        },
	        function (data) {
	            res.json({"sessions":data});
	        }
	    );
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
	* TODO:
	*   - Check if the user exists
	*   - Check if the device exists
	**/
	router.get('/start/:userid/:deviceid', function(req, res) {
	    let device = null;

	    backend.getDevice(req.params.deviceid, 
	        function(err) {
	            // Database error
	            res.status(500).json({"err" : err});
	        },
	        function(device) {
	            if (device) {
	                backend.startSession(req.params.userid,req.params.deviceid, 
	                    function(err) {
	                        // Database error
	                        res.status(500).json({"err" : err});
	                    }, 
	                    function(session) {
	                        res.json({"session" : session});
	                        waterrower.startSession(device.mac,session.id);
	                        //console.log('Sending start command to mqtt session id = ' + session.id)
	                
	                        waterrower.startSession()
	                    }

	                );
	            } else {
	                // No device found (Status File not Found)
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
	router.get('/stop/:sessionid', function(req, res) {
		backend.stopSession(req.params.sessionid).then((device) => {
			if (device) {
                /* Session stopped successfully in database */
                /* Now sending stop command to the device   */
                waterrower.stopSession(device.mac,req.params.sessionid);
                /* No data in this case */      
                res.json({});
            } else {
                res.status(404).json({});
            }
	    }).catch((err) => {
	    	res.status(500).json({"err" : err});
	    });
	});

	router.get('/:sessionid', function (req, res) {
	    backend.getSession(req.params.sessionid, function(data) {
	        res.json(data);
	    })
	});

	router.get('/:sessionid/entry', function (req, res) {
	    backend.getSessionEntries(req.params.sessionid, function(data) {
	        res.json(data);
	    })
	});

	router.get('/:sessionid/entry/:minsec/:maxsec', function (req, res) {
	    db.all("SELECT * FROM session_entry WHERE session_id=? AND seconds <= ? AND seconds >= ? ORDER BY seconds ASC",[req.params.sessionid, req.params.minsec, req.params.maxsec], function (err, rows) {
	        res.json({ "session_entry" : rows });
	    });
	});

	return router;
}