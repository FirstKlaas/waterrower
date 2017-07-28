'use strict';

//select max(max_speed), avg(avg_speed), sum(distance), count(id) from session where device_id=10
const logDebug = require('debug')('waterrower:database:device:debug')
const logError = require('debug')('waterrower:database:device:error')

module.exports = (backend) => {
	return new Device(backend);
}

class Device {
	constructor (backend) {
		this.backend = backend;
		this.db = backend.db;
	}

	getStats(id) {
		return true;
	}

	update(devicedata) {
		let self = this;
		return new Promise((resolve,reject) => {
			if (!devicedata || !devicedata.mac) {
				logError("Cannot update device data. Provided data is %o", devicedata); 
				return reject(new Error('No valid device data'));
			}
			logDebug("Fetching device %s from database ", devicedata.mac);

			self.getDeviceByMacAddress(devicedata.mac)
			.then( device => {
				if (!device) {
					logError("No such device: %s ", devicedata.mac);
					return reject(new Error("No such device: " + devicedata.mac));
				} else {					
					logDebug("Updating device in database");
					self.db.run('UPDATE device SET human=? WHERE mac=?',
						[devicedata.human,devicedata.mac],
						function(err) {
							if (err) return reject(err);
							logDebug("Update succeded. Returning updated device information.");
							self.getDeviceByMacAddress(devicedata.mac)
							.then( device => resolve(device))	
							.catch( err => reject(err));					
						}
					)
				}
			})
			.catch( err => reject(err));		
		})
	}

	get(id) {
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

	getDeviceByMacAddress(addr) {
		return new Promise((resolve,reject) => {			
			this.db.get("SELECT * FROM device WHERE mac=?", [addr], 
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

	addNewDevice(addr) {
		return new Promise((resolve,reject) => {
			this.db.run("INSERT INTO device(mac, human) VALUES (?,?)", [addr,addr], err => {
				if (err) {
					logError("Could not insert new device " + addr);
					logError("%O",err);
					return reject(new Error("Could add new device " + addr));
				}
				resolve (this.changes);
			})
		})
	}

	getAll() {
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
}

