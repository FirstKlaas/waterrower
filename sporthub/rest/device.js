const conf = require('../config.json');
const express = require('express')

var exports = module.exports = (app) => {
	let backend = app.get('backend');
	const router = express.Router() 

	router.get('/active/:id', function(req, res) {
		backend.isDeviceActive(req.params.id)
		.then( sessionid => {
			if (sessionid) {
                res.json({
                    "active" : true,
                    "sessionid" : sessionid
                })
            } else {
                res.json({
                    "active" : false
                })
            }
        })
	    .catch(err =>  res.status(500).json({"err": err})); 
	});


	router.get('/:id', function(req, res) {
	    backend.getDevice(req.params.id)
	    .then(device => {
	    	if (device) {
                res.json({"device": device});
            } else {
                res.status(404).json({"deviceid" : req.params.id});
            }
	    })
	});

	router.get('/', function(req, res) {
	    backend.getDevices()
    	.then (device => res.json({"device": device}))	            
	    .catch(err =>  res.status(500).json({"err": err}));  
	});

	return router; 
}