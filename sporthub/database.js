var exports = module.exports = (db) => {
	return new Backend(db);
};

class Backend {
	constructor (db) {
		this.db = db;
		console.log('constructor');
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
	    this.db.all("SELECT * FROM session", function (err, rows) {
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

	getActiveSession(id, onError, onSuccess) {
	    this.db.all("SELECT * FROM session WHERE id=? AND active=1", [id], function (err, rows) {
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

	stopSession(id, onError, onSuccess) {
		let self = this;
		// First test, if there is a session at all.
		this.getActiveSession(id,
			function(err) {
				onError(err);
			},
			function(session) {
				if (session) {
					console.log("Trying to stop session " + session.id);
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

	startSession(userid, deviceid, onError, onSuccess) {
		let database = this.db;

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
								onSuccess(this.lastID);
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
