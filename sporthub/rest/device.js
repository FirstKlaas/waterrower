const express  = require('express')

const logDebug = require('debug')('waterrower:rest:device:debug')
const logError = require('debug')('waterrower:rest:device:error')

const conf     = require('../config.json');
const authUtil = require('../auth-util.js');

var exports = module.exports = (app) => {
	let backend = app.get('backend');
	const router = express.Router() 

	router.use(authUtil.restCall);
	router.use(authUtil.isLoggedInForRest);
	
	router.get('/active/:id', function(req, res) {
		backend.device.isDeviceActive(req.params.id)
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
	    backend.device.get(req.params.id)
	    .then(device => {
	    	if (device) {
                res.json({"device": device});
            } else {
                res.status(404).json({"deviceid" : req.params.id});
            }
	    })
	});

	router.get('/', function(req, res) {
	    backend.device.getAll()
    	.then (device => res.json({"device": device}))	            
	    .catch(err =>  res.status(500).json({"err": err}));  
	});

	return router; 
}