'use strict'

const configuration = require('./config.json');
const conf          = configuration['development'];

const logDebug      = require('debug')('waterrower:auth-util:debug')
const logError      = require('debug')('waterrower:auth-util:error')

exports.isLoggedIn = function(req, res, next) {
    // if user is authenticated in the session, carry on 
    console.log('TEST ########################');
    if (req.isAuthenticated())
        logDebug('User %s %s is authentificated %O',req.user.firstname, req.user.lastname);
    	console.log('JA ######################## '  + req.user);
        return next();

    // if they aren't redirect them to the home page
    logDebug('User is not authentificated');
    console.log('NEIN ########################');
    res.redirect('/');
}


exports.restCall = function(req, res, next) {
    res.setHeader("Content-Type", conf.json_content_type);
    logDebug('JSON Request')
    next();
}