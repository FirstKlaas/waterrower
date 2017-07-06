const express  = require('express')

const logDebug = require('debug')('waterrower:devices:debug')
const logError = require('debug')('waterrower:devices:error')

const authUtil = require('../auth-util.js')

var exports = module.exports = (db) => {
	const router = express.Router();

	router.use(authUtil.isLoggedIn);
	
	router.get('/devices.html', (req, res) => {
	    db.getDevices()
	    .then(devices => res.render('device', { 'devices': devices, 'user':req.user}))
	    .catch(err => res.status(500).send({'err':err}));
	})

	router.get('/device/:id', function (req, res) {
	    db.getDevice(req.params.id)
	    .then(device => res.render('device', { 'devices': device,'user':req.user}))
	    .catch(err => res.status(500).send({'err':err}));
	})

	router.get("/editdevice/:id", (req,res) => {
	    db.getDevice(req.params.id)
	    .then(device => {
	        if (device) {
	            res.render('editdevice', { 'device': device,'user':req.user});
	        } else {
	            res.status(404).json({'msg':'Device not available.'});
	        }
	    })
	})

	router.post("/set/active/device/:id", authUtil.restCall, (req,res) => {
		db.getDevice(req.params.id)
		.then( device => {
			if (device) {
				req.session.activeDevice = device;
				res.json({'device':device});
			} else {
				req.session.activeDevice = undefined;
				res.status(404).json({'msg':'Device not available.'});
			}
		})
		.catch(err => {
			logError(err);
			req.session.activeDevice = undefined;
			res.status(500).json({'msg':'Could not set active device.', 'reason':err});
		})
	})

	router.post("/editdevice", (req,res) => {
	    logDebug("Trying to change device information for device %s . New human readable name %s", req.body.mac, req.body.human);
	    let device = {
	        mac   : req.body.mac, 
	        human : req.body.human 
	    }
	    logDebug("Session:");
	    req.session.wrDevice = device;
	    logDebug("%O",req.session);
	    
	    db.updateDevice(device)
	    .then( device => res.redirect("/main"))
	    .catch( err => res.status(404).send("Could not update device"));
	    
	})

	return router;
}