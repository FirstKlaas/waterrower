'use strict'

const logDebug      = require('debug')('waterrower:auth-util:debug')
const logError      = require('debug')('waterrower:auth-util:error')

exports.isLoggedIn = function(req, res, next) {
    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        logDebug('User %s %s is authentificated %O',req.user.firstname, req.user.lastname);
        return next();

    // if they aren't redirect them to the home page
    logDebug('User is not authentificated');
    res.redirect('/');
}