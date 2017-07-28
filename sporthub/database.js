var ddl_user = `CREATE TABLE IF NOT EXISTS "user" (
    id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
    login      TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    firstname  TEXT NOT NULL,
    lastname   TEXT NOT NULL,
    session_id INTEGER,
    twitter    TEXT,
    isadmin    INTEGER NOT NULL DEFAULT 0
);`;

var ddl_session_entry = `CREATE TABLE IF NOT EXISTS "session_entry" (
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
    seconds     INTEGER NOT NULL DEFAULT 0,
    avg_speed   REAL NOT NULL DEFAULT 0.0,
    speed       REAL NOT NULL DEFAULT 0.0,
    session_id  INTEGER NOT NULL,
    distance    INTEGER NOT NULL DEFAULT 0
);`;

var ddl_session = `
CREATE TABLE IF NOT EXISTS "session" (
    id        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
    distance  INTEGER NOT NULL DEFAULT 0,
    max_speed REAL NOT NULL DEFAULT 0.0,
    avg_speed REAL DEFAULT 0.0,
    start     INTEGER NOT NULL DEFAULT current_timestamp,
    end       INTEGER NOT NULL DEFAULT current_timestamp,
    user_id   INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    active    INTEGER NOT NULL DEFAULT 1
);`;

var ddl_device = `
CREATE TABLE IF NOT EXISTS "device" (
    id        INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
    mac       TEXT NOT NULL UNIQUE,
    human     TEXT NOT NULL UNIQUE,
    active    INTEGER NOT NULL DEFAULT 0
);`;

const bcrypt = require('bcrypt-nodejs')

const logDebug = require('debug')('waterrower:database:debug')
const logError = require('debug')('waterrower:database:error')

const dbDevice = require('debug');

var exports = module.exports = (db,twitter) => {

	db.serialize(function() {
	    db.run(ddl_user);
	    db.run(ddl_session_entry);
	    db.run(ddl_session);
	    db.run(ddl_device);
	});

	return new Backend(db,twitter);
};

class Backend {
	constructor (db,twitter) {
		this.db      = db;
		this.twitter = twitter;
		this.device  = require('./backend/backend-device.js')(this);
		this.session = require('./backend/backend-session.js')(this);
	}

	getUsers() {
		return new Promise((resolve, reject) => {
			let users = []; 
			let self = this;
			let promises = [];

			this.db.each("SELECT * FROM user",
				function(err, row) {
					if (err) return reject(err);
					/**
					if (row.twitter) {
						promises.push(self.twitter.getUserInfo(row.twitter));
					}
					**/
					users.push(row);
				},
				function(err,count) {
					if (err) return reject(err);
					if (promises.length != 0) {
						Promise.all(promises)
						.then(values => {
							values.forEach(value => {
								let sn = value.screen_name;
								let index = users.findIndex(user => {
									return user.twitter == sn;
								});
								if (index >= 0) users[index].twitter_profile = value;
							})
							resolve(users);
						});
						
					} else {
						resolve(users);
					}
						
				}	
	        );
		});
	}

	getUser(id,twitter=false) {
		let self = this;
		return new Promise((resolve,reject) => {
		    self.db.get("SELECT * FROM user WHERE id=?", [id], (err, row) => {
				if (err) return reject(err);
				if (twitter && row.twitter) {
					this.twitter.getUserInfo(row.twitter)
					.then( data => {
						if (!data) return resolve(row); 
						row.twitter_profile = data;
						return resolve(row);
					})
					.catch(err => {
						logError("Could not retrieve Twitter Profile Data");
						logError("%O",err);
						return resolve(row)
					})
				} else {
	            	resolve(row);
	            }
	    	});
		});
		return resolve(row)
	}

	updateUser(userdata) {
		let self = this;
		return new Promise((resolve,reject) => {
			if (!userdata || !userdata.id) return reject(new Error('No valid user data'));
			this.getUser(userdata.id, false)
			.then( user => {
				if (!user) return reject(new Error('Not a valid user.'));
				user.firstname  = userdata.firstname;
				user.lastname   = userdata.lastname;
				user.twitter    = userdata.twitter;
				logDebug("Updating %s %s (Twitter: %s) [%d]", user.firstname, user.lastname, user.twitter, user.id)
				self.db.run('UPDATE user SET firstname=?, lastname=?, twitter=? WHERE id=?', 
					[user.firstname,user.lastname,user.twitter,user.id], 
					function(err) {
						if (err) return reject(new Error(err.message));
						resolve(user);
					}
				)
			})
			.catch( err => reject(err));
		})
	}

	addNewUser(login, password, firstname='', lastname= '') {
		let self = this;
		return new Promise((resolve, reject) => {
			if (!login) return reject(new Error('No login'));
			if (!password) return reject(new Error('No password'));

			self.getUserByLogin(login, false)
				.then( user => {
					if ( user ) return reject(new Error('User already exists'));
					bcrypt.hash(password, null, null, function(err, hash) {
						if(err) return reject(err);
						self.db.run('INSERT INTO user(login,password,firstname, lastname) VALUES (?,?,?,?)', [login,hash,firstname,lastname], function(err) {
							if (err) return reject(err);
							resolve(this.lastID);
						})	
					});		
					
				})
				.catch(err => reject(err));
		})
	}

	getUserByLogin(login, loadtwitter=true) {
		let self = this;
		return new Promise((resolve,reject) => {
			if ( !login ) return reject(new Error('No login'));
		    self.db.get("SELECT * FROM user WHERE login=?", [login], function(err, row) {
				if (err) return reject(err);
				if ( !row ) return resolve(null);
				if (loadtwitter) {
					if (row.twitter) {
						this.twitter.getUserInfo(row.twitter)
						.then( data => {
							if (!data) return resolve(row); 
							row.twitter_profile = data;
							return resolve(row);
						})
					} else {
		            	resolve(row);
		            }
				} else {
	            	resolve(row);
	            }
	    	});
		});
	}


	validatePassword(login, password) {
		let self = this;
		return new Promise((resolve,reject) => {
			if ( !login ) return reject(new Error('No login to validate against'));
			if ( !password ) return reject(new Error('No password to validate'));
			
			self.getUserByLogin(login,false)
				.then((user) => {
					if (!user) return resolve(null);
					let result = bcrypt.compareSync(password, user.password);
					resolve(result ? user : null);	
				})
				.catch((err) => reject(err));
		})
	}

	updatePassword(password, userid) {
		let self = this;
		return new Promise((resolve,reject) => {
			bcrypt.hash(password, null, null, function(err, hash) {
    			if (err) return reject(err);
    			self.db.run('UPDATE user SET password=? WHERE id=?',[hash,userid], (err) => {
    				if (err) return reject(err);
    				resolve(hash);	
    			})
			});
		})
	}

	getHallOfFameDistance() {
		return new Promise((resolve, reject) => {
			this.db.all("select sum(distance) as distance, user_id, session.id as session_id, user.firstname, user.lastname from session, user where session.user_id = user.id group by user_id order by distance desc",
				(err, rows) => {
					if (err) return reject(err);
					resolve(rows);
				}
			)
		});
	}

	getHallOfFameMaxSpeed(onError, onSuccess) {
		return new Promise((resolve,reject) => {
			this.db.all('select max(max_speed) as max_speed, user_id, session.id as session_id, user.firstname, user.lastname from session, user where session.user_id = user.id group by user_id order by max_speed desc',
				(err, rows) => {
					if (err) reject(err);
					resolve(rows);
				}
			)			
		})
	}

	getSessions() {
		return this.session.getSessions();
	}

	getSession(id) {
	    return this.session.getSession(id);
	}

	deleteSession(id) {
		return this.session.deleteSession(id);
	}

	getActiveSessionForUser(id) {
		return this.session.getActiveSessionForUser(id);
	}

	getActiveSessions() {
		return this.session.getActiveSessions();
	}

	stopSession(id) {
		return this.session.stopSession(id);
	}


	stopActiveSessions() {
		return this.session.stopActiveSessions();
	}

	startSession(userid, deviceid) {
		return this.session.startSession(userid, deviceid);
	}

	getSessionEntries(sessionid) {
		return this.session.getSessionEntries(sessionid);
	}

	getUserSessions(userid) {
		return this.session.getUserSessions(userid);
	}

	insertSessionEntry(data) {
        return this.session.insertSessionEntry(data);
	}
}

