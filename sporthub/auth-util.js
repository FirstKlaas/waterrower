'use strict'

const configuration = require('./config.json');
const conf          = configuration['development'];

const logDebug      = require('debug')('waterrower:auth-util:debug')
const logError      = require('debug')('waterrower:auth-util:error')

exports.isLoggedIn = function(req, res, next) {
    // if user is authenticated in the session, carry on 
    logDebug('Checking authentification status');
    logDebug('req.isAuthenticated() = %O',req.isAuthenticated());
    logDebug('req.user = %O',req.user);
    
    if (req.isAuthenticated() && req.user != undefined) {
        logDebug('User %s %s is authentificated',req.user.firstname, req.user.lastname);
    	return next();
    }

    logDebug('User is not authentificated');
    res.redirect('/');  
}

exports.isLoggedInForRest = function(req, res, next) {
    // if user is authenticated in the session, carry on 
    logDebug('Checking authentification status');
    logDebug('req.isAuthenticated() = %O',req.isAuthenticated());
    logDebug('req.user = %O',req.user);
    
    if (req.isAuthenticated() && req.user != undefined) {
        logDebug('User %s %s is authentificated',req.user.firstname, req.user.lastname);
        return next();
    }

    logDebug('User is not authentificated');
    res.status(401).json({msg:"Unauthorized"});  
}

exports.restCall = function(req, res, next) {
    res.setHeader("Content-Type", conf.json_content_type);
    logDebug('JSON Request')
    next();
}