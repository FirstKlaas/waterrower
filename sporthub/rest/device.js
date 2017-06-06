const conf = require('../config.json');
const express = require('express')

var exports = module.exports = (app) => {
	let backend = app.get('backend');
	const router = express.Router() 

	router.get('/active/:id', function(req, res) {
	    backend.isDeviceActive(req.params.id,
	        function(err) {
	            res.status(500).json({"err":err});
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


	router.get('/:id', function(req, res) {
	    backend.getDevice(
	        req.params.id,
	        function(err) {
	            res.status(500).json({"err": err});
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


	router.get('/', function(req, res) {
	    backend.getDevices(
	        function(err) {
	            res.status(500).json({"err": err});
	        },
	        function(device) {
	            res.json({"device": device});	            
	        }
	    ); 
	});

	return router; 
}