const express  = require('express')
const authUtil = require('../auth-util.js')

var exports = module.exports = (db) => {
	const router = express.Router();

	router.get('/', (req,res) => {
	    res.render('login', {message: req.flash('loginMessage')});
	})

	router.get('/logout', authUtil.isLoggedIn, (req,res) => {
	    req.logout();
	    res.redirect('/');
	})

	router.get('/signup', (req,res) => {
	    res.render('signup', {});
	})

	router.get('/profile', authUtil.isLoggedIn, (req,res) => {
	    logDebug("Profile anzeigen");
	    if (req.user) {
	        res.render('profile', {user:req.user});
	    } else {
	        logError("No user object althoug authentificated. Weired.");
	        res.redirect('/');
	    }
	})

	return router;
}