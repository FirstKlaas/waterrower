'use strict';

const logDebug = require('debug')('waterrower:database:session:debug')
const logError = require('debug')('waterrower:database:session:error')

module.exports = (backend) => {
	return new Session(backend);
}

class Session {
	constructor (backend) {
		this.backend = backend;
		this.db      = backend.db;
		this.device  = backend.device;		
	}

	getSessions() {
		return new Promise((resolve,reject) => {
			this.db.all("SELECT * FROM session ORDER BY start DESC", (err, rows) => {
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

	getActiveSessionForUser(id) {
		return new Promise((resolve,reject) => {
		    this.db.get("SELECT * FROM session WHERE active=1 AND user_id=?", [id], (err, row) => {
				if (err) return reject(err);
	            resolve(row);
	    	});
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

	stopSession(id) {
		let self = this;
		return new Promise((resolve, reject) => {
			self.getSession(id)
			.then(session => {
				if (!session) return resolve(null);
				if (session.active === 0) return resolve(null);

				self.device.get(session.device_id)
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
			self.device.isDeviceActive(deviceid).then(
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

	getUserSessions(userid) {
		return new Promise((resolve, reject) => {
		    this.db.all("SELECT session.*, device.human, device.mac FROM session, device WHERE user_id=? AND device.id=session.device_id ORDER BY start DESC",[userid], 
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