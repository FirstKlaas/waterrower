var exports = module.exports = (db) => {
	return new Backend(db);
};

class Backend {
	constructor (db) {
		this.db = db;
	}

	getUsers(onError, onSuccess) {
		this.db.all("SELECT * FROM user", function(err, rows) {
			if (err) {
            	onError(err);
        	} else {
            	onSuccess(rows);
            }
        });
	}

	getUser(id, onError, onSuccess) {
	    this.db.all("SELECT * FROM user WHERE id=?", [id],function (err, rows) {
			if (err) {
            	onError(err);
        	} else {
        		if (rows.length === 0) {
        			onSuccess(null);	
        		} else {
            		onSuccess(rows[0]);
            	}
            }
    	});
	}

	getSessions(onError, onSuccess) {
	    this.db.all("SELECT * FROM session ORDER BY id DESC", function (err, rows) {
			if (err) {
            	onError(err);
        	} else {
            	onSuccess(rows);
            }
	    });
	}

	getSession(id, onError, onSuccess) {
	    this.db.all("SELECT * FROM session WHERE id=?", [id], function (err, rows) {
			if (err) {
            	onError(err);
        	} else {
        		if (rows.length === 0) {
        			onSuccess(null);	
        		} else {
        			onSuccess(rows[0]);
        		}
            }
    	});
	}

	getActiveSessions(onError, onSuccess) {
	    this.db.all("SELECT * FROM session WHERE session.active=1", function (err, rows) {
			if (err) {
            	onError(err);
        	} else {
        		if (rows.length === 0) {
        			onSuccess(null);	
        		} else {
        			onSuccess(rows);
        		}
            }
    	});
	}


	getHallOfFameDistance(onError, onSuccess) {
		this.db.all('select sum(distance) as distance, user_id, session.id as session_id, user.firstname, user.lastname from session, user where session.user_id = user.id group by user_id order by distance desc',
			function(err, rows) {
				if (err) {
	            	onError(err);
	        	} else {
	        		onSuccess(rows);
	            }
			}
		)
	}

	getHallOfFameMaxSpeed(onError, onSuccess) {
		this.db.all('select max(max_speed) as max_speed, user_id, session.id as session_id, user.firstname, user.lastname from session, user where session.user_id = user.id group by user_id order by max_speed desc',
			function(err, rows) {
				if (err) {
	            	onError(err);
	        	} else {
	        		onSuccess(rows);
	            }
			}
		)
	}

	stopSession(id, onError, onSuccess) {
		let self = this;
		// First test, if there is a session at all.
		this.getSession(id,
			function(err) {
				onError(err);
			},
			function(session) {
				if (session) {
					// Nun das device ermitteln.
					self.getDevice(session.device_id,
						function(err) {
							onError(err);
						},
						function(device) {
							if (device) {
								self.db.run("UPDATE session SET active=0, end=CURRENT_TIMESTAMP WHERE id=?",[id],function(err) {
									if (err) {
										onError(err)
									} else {
										// Session stopped
										onSuccess(device)
									}
								});								
							} else {
								// No such device
								onSuccess(null);
							}
						})

				} else {
					// No such session
					onSuccess(null);
				}
			}
		);
	}

	stopActiveSessions() {
		let self = this;
		this.getActiveSessions(
			function(err) {

			},
			function(sessions) {
				if (sessions != null) {
					sessions.forEach(function(session) {
						self.stopSession(session.id, function(err){},function(device){});
					})					
				}
			}
		);
	}

	stopActiveSessionsPromise() {
		let self = this;
		return new Promise((resolve,reject) => {
		    this.db.all("SELECT * FROM session WHERE session.active=1", function (err, rows) {
				if (err) {
	            	reject(err);
	        	} else {
	        		let promises = [];
	        		rows.forEach((session) => {
	        			promises.push(self.stopActiveSessionPromise());
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

	stopActiveSessionPromise() {
		return new 
	}

	stopSessionPromise(id) {
		return new Promise((resolve,reject) => {
			stopSession(id,
				(error) => {
					reject(error);
				},
				() => {
					resolve();
				}
			);
		});
	}

	startSession(userid, deviceid, onError, onSuccess) {
		let database = this.db;
		let self = this;

		this.isDeviceActive(deviceid, 
			function(err) {
				onError(err);
			},
			function(session) {
				if (session) {
					// Es gibt bereits eien active session fuer 
					// dieses device.
					return onSuccess(null); 
				} else {
					database.run("INSERT into session(user_id,device_id, active) VALUES (?,?,1)",[userid,deviceid],
						function(err) {
							if (err) {
								onError(err);
							} else {
								let lastID = this.lastID;
								self.getSession(this.lastID,
									function(err) {
	                            		onError(err);
	                            	},
	                            	function(data) {
	                            		if (data) {
	                            			// Session successfully created
	                            			onSuccess(data);
	                            		} else {
	                            			onError("No such session with id " + lastID);		
	                            		}	                           
	                            	}	
								);
							}
			    		}
			    	);					
				}
			}
		)
	}

	getDevice(id, onError, onSuccess) {
		this.db.all("SELECT * FROM device WHERE id=?", [id], 
			function(err,rows) {
				if (err) {
					onError(err);
				} else {
					if (rows.length === 0) {
						onSuccess(null);
					} else {
						onSuccess(rows[0]);
					}
				}
			}
		)
	}

	getDevices(onError, onSuccess) {
		this.db.all("SELECT * FROM device ORDER BY human", 
			function(err,rows) {
				if (err) {
					onError(err);
				} else {
					onSuccess(rows);
				}
			}
		)
	}

	isDeviceActive(deviceid, onError, onSuccess) {
		this.db.all("SELECT id FROM session WHERE device_id=? AND active=1", [deviceid], function(err,rows) {
			if (err) {
				onError(err);
			} else {
				if (rows.length === 0) {
					onSuccess(null);
				} else {
					onSuccess(rows[0]);
				}
			}
		});
	}

	getSessionEntries(sessionid,clbk) {
	    this.db.all("SELECT * FROM session_entry WHERE session_id=? ORDER BY seconds ASC",[sessionid], function (err, rows) {
			if (err) {
            	clbk({ "err" : err });
        	} else {
            	clbk({ "session_entry" : rows });
            }
    	});
	}

	getUserSession(userid, clbk) {
	    this.db.all("SELECT * FROM session WHERE user_id=? ORDER BY start",[userid], function (err, rows) {
			if (err) {
            	clbk({ "err" : err });
        	} else {
            	clbk({ "sessions" : rows });
            }
    	});
	}

	insertSessionEntry(data) {
        this.db.run("INSERT into session_entry(seconds,avg_speed, speed, distance, session_id) VALUES (?,?,?,?,?)",[data.seconds,data.avg_speed,data.speed,data.distance,data.sessionid]);
        this.db.run("UPDATE session SET distance=?, max_speed=?, avg_speed=?, end=CURRENT_TIMESTAMP WHERE id=?", [data.distance, data.max_speed, data.avg_speed, data.sessionid]);
	}
}
