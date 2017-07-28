const express  = require('express')

const logDebug = require('debug')('waterrower:account:debug')
const logError = require('debug')('waterrower:account:error')

const authUtil = require('../auth-util.js')

var exports = module.exports = (passport, backend) => {
	const router = express.Router();

	router.get('/', (req,res) => {
		if (req.user) {
			res.redirect("/main");
		} else {
	    	res.render('login', {message: req.flash('loginMessage')});
	    }
	})

	router.get('/logout', authUtil.isLoggedIn, (req,res) => {
	    req.logout();
	    res.redirect('/');
	})

	router.get('/signup', (req,res) => {
	    res.render('signup', {});
	})

	router.get('/profile', authUtil.isLoggedIn, (req,res) => {
	    if (req.user) {
	    	let data = {
	    		user : req.user
	    	}
	    	if (req.session && req.session.activeDevice) {
	    		data.activeDevice = req.session.activeDevice
	    	}
	        res.render('profile', data);
	    } else {
	        logError("No user object althoug authentificated. Weired.");
	        res.redirect('/');
	    }
	})

	router.post('/login', passport.authenticate('local-login', {
	    successRedirect : '/main', 
	    failureRedirect : '/', // redirect back to the signup page if there is an error
	    failureFlash : true // allow flash messages
	}))

	router.post('/signup', passport.authenticate('local-signup', {
	    successRedirect : '/profile', // redirect to the secure profile section
	    failureRedirect : '/signup', // redirect back to the signup page if there is an error
	    failureFlash : true // allow flash messages
	}));

	router.post('/profile', authUtil.isLoggedIn, (req, res) => {
	    let data = {
	    	'id'        : req.user.id,
	    	'twitter'   : req.body.twitter,
	    	'firstname' : req.body.firstname,
	    	'lastname'  : req.body.lastname
	    }

	    logDebug("Userprofile Changed. New Values: %O", data);
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



	return router;
}