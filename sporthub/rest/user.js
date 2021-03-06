const express  = require('express')

const logDebug      = require('debug')('waterrower:rest:user:debug')
const logError      = require('debug')('waterrower:rest:user:error')

const authUtil = require('../auth-util.js');

var exports = module.exports = (app) => {
	let backend = app.get('backend');

	const router = express.Router() 

	router.use(authUtil.restCall);
	router.use(authUtil.isLoggedInForRest);
	
	router.get('/', function (req, res) {
	    backend.getUsers()
	    .then(users => res.json({"user" : users}))
	    .catch(error => res.status(500).json({"err":err}));
	});

	router.get('/me', (req,res) => {
		res.json(req.user);
	})

	router.get('/:userid', function (req, res) {
	    backend.getUser(req.params.userid)
	    	.then(user => {
	            if (user == null) {
	                res.status(404).json({"userid":req.params.userid})
	            } else {	            	
	                res.json({"user" : user});
	            }	    		
	    	})
	    	.catch(err => res.status(500).json({"err":err}));
	});

	router.get('/:userid/session', function (req, res) {
	    backend.getUserSessions(req.params.userid)
	    	.then(data => res.json(data))
	    	.catch(error => res.status(500).json({"err":err}));    
	});

	return router;
}	