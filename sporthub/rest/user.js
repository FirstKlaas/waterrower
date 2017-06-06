const conf = require('../config.json');
const express = require('express')

var exports = module.exports = (app) => {
	let backend = app.get('backend');
	const router = express.Router() 

	router.get('/', function (req, res) {
	    backend.getUsers(
	        function(err)  {
	            res.status(500).json({"err":err});            
	        },
	        function (users) {
	            res.json({"user" : users});
	        }
	    );
	});


	router.get('/:userid', function (req, res) {
	    backend.getUser(req.params.userid,
	        function(err) {
	            res.status(500).json({"err":err});            
	        }, 
	        function(user) {
	            if (user == null) {
	                res.status(404).json({"userid":req.params.userid})
	            } else {
	                res.json({"user" : user});
	            }
	        }
	    )
	});

	router.get('/:userid/session', function (req, res) {
	    backend.getUserSessions(req.params.userid, function(data) {
	        res.json(data);    
	    })
	});


	return router;
}	