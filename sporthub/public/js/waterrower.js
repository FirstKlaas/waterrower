var socket    = io();
var session   = null;
var user      = null;
var device    = null;

function formatDistance(value) {
	if (value < 1000) return numeral(value).format('0,0.00') + ' m';
	return numeral(value/1000).format('0,0.000') + ' km';
}

function stopSession() {
	console.log(session);
	console.log(user);
	console.log(device);

	if(!session) {
		console.log("No session to stop");
		return;
	}
	console.log("Stopping session " + session.id);
	$.getJSON( "/rest/session/stop/" + session.id, function( data ) {
		session = null;
		//setupActions();
	});
}

function setDevice(id, clb) {
	$.getJSON( "/rest/device/" + id , function( data ) {
		device = data.device;
	    clb(device);
	});
}

function setUser(id, clb) {
	$.getJSON( "/rest/user/" + id , function( data ) {
		user = data.user;
	    clb(user);
	});
}

function startSession() {
	if (!user) return;
	if (!device) return;
	if (session) return;
	
	$.getJSON( "/rest/session/start/" + user.id + "/" + device.id, function( data ) {
		session = data.session;
		console.log(session);
		console.log(user);
		console.log(device);
	    //setupActions();
	});
}

function showSessions() {
	$('#content').load('/sessions.html',
		function() {
		}
	);
}

function showDevices() {
	$('#content').load('/devices.html',
		function() {
			setupActions();
		}
	);
}

function showUser() {
	$('#content').load('/user.html',
		function() {
			setupActions();
		}
	);
}

function showHallOfFame() {
	$('#content').load('/hof',
		function() {
		}
	);
}

function showHofMaxSpeed() {
	$('#content').load('/hof/maxspeed.html',
		function() {
		}
	);
}

function showHofDistance() {
	$('#content').load('/hof/distance.html',
		function() {
		}
	);
}

function showLive() {
	if (user && device) {
		$('#content').load('/livedata.html', function() {
			setupActions();
		});
	};
}

function startStopSession() {
	if (session == null) {
		startSession();
	} else {
		stopSession();
	}
}

function setupActions() {
	if (user) {
		$('#name').text('Hallo ' + user.firstname);
	}
	if (session) {
		$('#startstop').text('[STOP]');
		$('#startstop').one('click',function() {
			stopSession();
		});			
	} else {
		$('#startstop').text('[START]');
		$('#startstop').one('click',function() {
			startSession();
		});
	}
}

function checkForActiveSession() {
	return new Promise((resolve, reject) => {
		$.getJSON( "/rest/session/active", function( data ) {
			console.log(data);
			if (data && data.sessions) {
				resolve(data.sessions[0]);
			} else {
				resolve(null);
			}
		});
	});
}

function selectUser(id) {
	if (session) {
		alert('Session is running');
	} else {
		setUser(id,
			function(data) {
				if (!device) {
					showDevices();
				} else {
					showLive();
				}
			}
		)
	}	
}

function selectDevice(id) {
	if (session) {
		alert('Session is running');
	} else {
		setDevice(id,
			function(data) {
				if (!user) {
					showUser();
				} else {
					showLive();
				}
			}
		)
	}	
}

function onInit() {
	// Testen, ob eine Session gerade laeuft.
	
	checkForActiveSession().then(server_session => {
		if(server_session) {
			session = server_session;
			setUser(session.user_id,
				function(rUser) {
					setDevice(session.device_id,
						function(rDevice) {
							showLive();
						}
					);
				}
			);
		} else {
			// We don't have an existing session
			if (!user) {
				showUser();
			} else if (!device) {
				showDevices();
			} else {
				setupActions();
			}
		}
	})
}

socket.on('message', 
	function(data) { 
		//console.log(data)
		currentSession = data.sessionid;
		$('#dd').text(formatDistance(data.distance));
		$('#speed').text(numeral(data.speed).format('0,0.00') + ' m/s');
		$('#max_speed').text(numeral(data.max_speed).format('0,0.00') + ' m/s');
		$('#avg_speed').text(numeral(data.avg_speed).format('0,0.00') + ' m/s');
		$('#ds').text(numeral(data.seconds).format('00:00:00'));
		$('#ticks').text(data.ticks);
	});

socket.on('session-start',
	function(data) {
		console.log('io=> session-start' + data);
		onInit();
	}
);

socket.on('session-stop',
	function(data) {
		session = null;
		console.log('io=> session-stop ' + data);
		onInit();
	}
);



