var LocalStrategy   = require('passport-local').Strategy;
const logDebug      = require('debug')('waterrower:passwort:debug')
const logError      = require('debug')('waterrower:passport:error')

// expose this function to our app using module.exports
module.exports = function(passport,db) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        //logDebug("Serializing user %O", user)
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser((id, done) => {
        //logDebug("Deserialize user with id %d", id);
        db.getUser(id,false)
        	.then(user => {
                done(null,user)
            })
        	.catch(err => done(err));
    });

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use('local-signup', new LocalStrategy({
        usernameField : 'login',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, login, password, done) {

        // asynchronous
        // User.findOne wont fire unless data is sent back
        process.nextTick(function() {

	        db.getUserByLogin(login)
	        	.then(user => {
	        		if (user) {
	        			done(null, false, req.flash('signupMessage', 'That account name is already taken.'));
	        		} else {
	        			// Nun einen neuen User anlegen
	        			db.addNewUser(login,password)
	        				.then(userid => {
        						db.getUser(userid)
        							.then(user => done(null, user))
        							.catch(err => done(err));
	        				})
	        				.catch(err => done(err));
	        		}
	        	})
	        	.catch(err => done(err));
    	});
	}));

	// =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'

    passport.use('local-login', new LocalStrategy({
        usernameField : 'login',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, login, password, done) {
    	db.validatePassword(login,password)
    	.then(user => {
    		if (!user) {
    			done(null, false, req.flash('loginMessage', 'Falsche Anmeldedaten'));
    		} else {
    			done(null,user);
    		}

    	})
    	.catch(err => done(err));
    }));
};
