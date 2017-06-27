var ddl_user = `CREATE TABLE IF NOT EXISTS "user" (
    id         INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
    login      TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,
    firstname  TEXT NOT NULL,
    lastname   TEXT NOT NULL,
    session_id INTEGER,
    twitter    TEXT
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
		this.db = db;
		this.twitter = twitter;
	}

	getUsers() {
		return new Promise((resolve, reject) => {
			let users = []; 
			let self = this;
			let promises = [];

			this.db.each("SELECT * FROM user",
				function(err, row) {
					if (err) return reject(err);
					if (row.twitter) {
						promises.push(self.twitter.getUserInfo(row.twitter));
					}
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

	getUser(id,twitter=true) {
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
			if (!userdata || !userdata.id) return reject(new Error('No valid userdata'));
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

	getSessions() {
		return new Promise((resolve,reject) => {
			this.db.all("SELECT * FROM session ORDER BY id DESC", (err, rows) => {
		    	if (err) return reject(err);
				resolve(rows);
		    });			
		})
	}

	getSession(id) {
	    return new Promise((resolve,reject) => {
			this.db.get("SELECT * FROM session WHERE id=?", [id], (err, row) => {
				if (err) return reject(err);
				resolve(row);
	    	});
	    });
	}

	deleteSession(id) {
		return new Promise((resolve,reject) => {
			this.db.parallelize(() => {
				this.db.run("DELETE FROM session_entry WHERE session_id=?", [id]);
				this.db.run("DELETE FROM session WHERE id=?", [id]);
				
			});
			resolve();
			
		});
	}

	getActiveSessions() {
		return new Promise((resolve,reject) => {
		    this.db.all("SELECT * FROM session WHERE session.active=1", (err, rows) => {
				if (err) return reject(err);
	            resolve(rows);
	    	});
		});
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

	stopSession(id) {
		let self = this;
		return new Promise((resolve, reject) => {
			self.getSession(id)
			.then(session => {
				if (!session) return resolve(null);
				if (session.active === 0) return resolve(null);

				self.getDevice(session.device_id)
				.then(device => {
					if (!device) return reject(new Error("No such device"));
					self.db.run("UPDATE session SET active=0, end=CURRENT_TIMESTAMP WHERE id=?",[id],
						err => {
							if (err) return reject(err);
							resolve(device);
						}
					);								
				}).catch( err => reject(err));
			})
			.catch(err => reject(err));
		});
	}


	stopActiveSessions() {
		let self = this;
		return new Promise((resolve,reject) => {
		    this.db.all("SELECT * FROM session WHERE session.active=1", function (err, rows) {
				if (err) {
	            	reject(err);
	        	} else {
	        		let promises = [];
	        		rows.forEach((session) => {
	        			promises.push(self.stopSession(session.id));
	        		})
	        		Promise.all(promises).then(values => {
	        			resolve(values);
	        		}).catch(reason => { 
  						reject(reason);
					});
	            }
	    	});
		});
	}

	startSession(userid, deviceid) {
		let database = this.db;
		let self = this;
		return new Promise((resolve, reject) => {
			self.isDeviceActive(deviceid).then(
				session => {
					if (session) return resolve(session);
					database.run("INSERT into session(user_id,device_id, active) VALUES (?,?,1)",[userid,deviceid],
						function(err) {
							if (err) return reject(new Error(err));
							self.getSession(this.lastID).then(
								session => {
									if (session) return resolve(session);
									reject(new Error('Could not create new Session'));
								}
							).catch ( err => reject(err));
						}
					)	
				}
			).catch( err => reject(err));	
		})
	}

	getDevice(id) {
		return new Promise((resolve,reject) => {			
			this.db.get("SELECT * FROM device WHERE id=?", [id], 
				function(err,row) {
					if (err) { 
						reject(err);
					} else {
						resolve(row);
					}
				}
			)
		})
	}

	getDevices() {
		return new Promise((resolve, reject) => {
			this.db.all("SELECT * FROM device ORDER BY human", 
				(err,rows) => {
					if (err) {
						reject(err);
					} else {
						resolve(rows);
					}
				}
			)
		});
	}

	isDeviceActive(deviceid, onError, onSuccess) {
		return new Promise((resolve, reject) => {
			this.db.get("SELECT id FROM session WHERE device_id=? AND active=1", [deviceid], 
				(err,row) => {
					if (err) return reject(err);
					return resolve(row);
				}
			);	
		});
	}

	getSessionEntries(sessionid) {
		return new Promise((resolve, reject) => {
			let result = [];
			this.db.each("SELECT * FROM session_entry WHERE session_id=? ORDER BY seconds ASC",[sessionid], 
				(err, row) => {
					if (err) { 
						reject(err);
					} else {
            			result.push(row);
            		}
            	},
            	(err, count) => {
					if (err) { 
            			reject(err);
            		} else {
            			resolve(result);
            		}	
            	}
    		);	
		})
	}

	getUserSession(userid) {
		return new Promise((resolve, reject) => {
		    this.db.all("SELECT * FROM session WHERE user_id=? ORDER BY start",[userid], 
		    	(err, rows) => {
					if (err) return reject(err);
	            	resolve(rows);
	            }
	    	);			
		})
	}

	insertSessionEntry(data) {
        this.db.run("INSERT into session_entry(seconds,avg_speed, speed, distance, session_id) VALUES (?,?,?,?,?)",[data.seconds,data.avg_speed,data.speed,data.distance,data.sessionid]);
        this.db.run("UPDATE session SET distance=?, max_speed=?, avg_speed=?, end=CURRENT_TIMESTAMP WHERE id=?", [data.distance, data.max_speed, data.avg_speed, data.sessionid]);
	}
}
