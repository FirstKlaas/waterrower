var exports = module.exports = (db) => {
	return new Backend(db);
};

class Backend {
	constructor (db) {
		this.db = db;
	}

	getUsers() {
		return new Promise((resolve, reject) => {
			this.db.all("SELECT * FROM user", function(err, rows) {
				if (err) return reject(err);
				resolve(rows);
	        });
		});
	}

	getUser(id) {
		return new Promise((resolve,reject) => {
		    this.db.get("SELECT * FROM user WHERE id=?", [id],function (err, row) {
				if (err) return reject(err);
	            resolve(row);
	    	});
		});
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
