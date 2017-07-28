let socket    = io();
var session   = null;
var device    = null;

socket.on("connect", () => {
	console.log("Socket connected");
})

function formatDistance(value) {
	if (value < 1000) return numeral(value).format('0,0.00') + ' m';
	return numeral(value/1000).format('0,0.000') + ' km';
}

function stopSession() {
	if(!session) {
		console.log("No session to stop");
		return;
	}
	$.getJSON( "/rest/session/stop/" + session.id, function( data ) {
	});
}

function setDeviceName(name) {
	$('#current-device').text(name);
}

function setDevice(id, clb) {
	setDeviceName('...updating');
	$.post("/set/active/device/" + id, function( data ) {
		device = data.device;
		setDeviceName(device.human);
	    clb(device);
	});
}

function voidCall() {}

function startSession() {
	if (session) return;
	session = {};
	var elem = $('#startstop');
	elem.removeClass('fa-play-circle-o');
	elem.removeClass('fa-stop-circle-o');
	elem.addClass('fa-cog');
	elem.one('click',function() {
		voidCall();
	});			

	$.getJSON( "/rest/session/start/" + device.id, function( data ) {
	});
}

function showMainMenu() {
	$('#content').load('/menu.html',
		function() {
			$('#pagetopic').text('Main Menu');
		}
	);
}

function deleteSession(id, update, sender) {
	$.getJSON( "/rest/session/delete/" + id, data => {
		if (update) {
			$(sender).parent().remove();
		}
	});
}

function showDevices() {
	$('#content').load('/devices.html',
		function() {
			$('#pagetopic').text('Geräte');
		}
	);
}

function setUsername(name) {
	$('#current-user').text(name);
}

function showUser() {
	$('#content').load('/user.html',
		function() {
			$('#pagetopic').text('Sportler');
		}
	);
}

function showProfile() {
	$('#content').load('/profile',
		function() {
			$('#pagetopic').text('My Profile');
		}
	);	
}

function showDeviceForm(id) {
	$('#content').load('/editdevice/' + id,
		function() {
			$('#pagetopic').text('Edit Device');
		}
	);	
}

function updateDeviceInfo( event ) {
	event.preventDefault();
	var $form = $( this );
	url = $form.attr( "action" );

	let devicedata = {
		mac   : $form.find("input[name='mac']").val(),
		human : $form.find("input[name='human']").val()
	}

	var posting = $.post( url, devicedata );

	posting.done(data => {
		showDevices();
	})	

	return false;
}

function updateProfile( event ) {
	event.preventDefault();
	var $form = $( this );
	url = $form.attr( "action" );
	let userdata = {
		firstname : $form.find("input[name='firstname']").val(),
		lastname  : $form.find("input[name='lastname']").val(),
		twitter   : $form.find("input[name='twitter']").val()
	};
	
	var posting = $.post( url, userdata );

	posting.done(data => {
		setUsername(userdata.firstname);
		showMainMenu();
	})	

	return false;
}

function showHallOfFame() {
	$('#content').load('/hof',
		function() {
			$('#pagetopic').text('Bestenliste');
		}
	);
}

function showHofMaxSpeed() {
	$('#content').load('/hof/maxspeed.html',
		function() {
			$('#pagetopic').text('Höchstes Tempo');
		}
	);
}

function showHofDistance() {
	$('#content').load('/hof/distance.html',
		function() {
			$('#pagetopic').text('Gesamtstrecke');
		}
	);
}

function showSessions() {
	$('#content').load('/usersessions',
		function() {
			$('#pagetopic').text('Workouts');
		}
	);
}

function showLive() {
	if (device) {
		$('#content').load('/livedata.html', function() {
			$('#pagetopic').text('Live Data');
			checkForActiveSession().then(s => {
				console.log("Checked for active session: " + s);
				session = s;
				setupActions();
			})
		});
	};
}

function setupActions() {
	let elem = $('#startstop');
	if (session) {
		elem.removeClass('fa-cog');
		elem.removeClass('fa-play-circle-o');
		elem.addClass('fa-stop-circle-o');
		elem.one('click',function() {
			stopSession();
		});			
	} else {
		elem.removeClass('fa-cog');
		elem.removeClass('fa-stop-circle-o');
		elem.addClass('fa-play-circle-o');
		elem.one('click',function() {
			startSession();
		});
	}
}

function checkForActiveSession() {
	return new Promise((resolve, reject) => {
		$.getJSON( "/rest/session/active", function( data ) {
			console.log("active session rest call");
			console.log(data);
			if (data && data.session) {
				resolve(data.session);
			} else {
				resolve(null);
			}
		});
	});
}

function selectDevice(id) {
	checkForActiveSession()
	.then( session => {
		if (session) return Promise.reject(new Error("Session already running"));
		return checkForRunningDevice(id);
	})
	.then(data => {
		if (data && data.active) return Promise.reject(new Error("Device is busy. Cannot be selected."));
		setDevice(id,
			function(data) {
				showLive();
			}
		)				
	})
	.catch(err => console.error(err));	
}

function checkForRunningDevice(id) {
	return new Promise((resolve, reject) => {
		$.getJSON( "/rest/device/active/" + id, function( data ) {
			console.log("Checked for running device");
			console.log(data);
			return resolve(data);
		}).fail( jqXHR => {
			return resolve(null);
		});
	})
}

function checkForActiveDevice() {
	return new Promise((resolve,reject) => {
		$.getJSON( "/active/device", function( data ) {
			if (data && data.device) {
				return resolve(data.device);
			} 
			return resolve(null);
		}).fail( jqXHR => {
			return resolve(null);
		})	
	})	
} 

function getMe() {
	return new Promise((resolve, reject) => {
		$.getJSON( "/rest/user/me", function( user ) {
			return resolve(user);
		}).fail( jqXHR => {
			return resolve(null);
		})
	});
}

var nsp_user = null;

function onInit() {
	console.log("Document Ready");
	checkForActiveDevice().then(dev => {
		if (dev) { device = dev };
	}).catch(err => console.log(err));

	initSocketIO();

/**
	io('/klaas').on('session-start',
		function(data) {
			console.log("io(/klaas).session.start");
			session = data;
			setupActions();
		}
	);

	io('/klaas').on('session-stop',
		function(data) {
			console.log("io(/klaas).session-stop");
			session = null;
			setupActions();
		}	
	);

	io('/klaas').on('message', 
		function(data) { 
			console.log("io(/klaas).message");
			currentSession = data.sessionid;
			$('#dd').text(formatDistance(data.distance));
			$('#speed').text(numeral(data.speed).format('0,0.00'));
			$('#max_speed').text(numeral(data.max_speed).format('0,0.00'));
			$('#avg_speed').text(numeral(data.avg_speed).format('0,0.00'));
			$('#ds').text(numeral(data.seconds).format('00:00:00'));
			$('#ticks').text(data.ticks);
		}
	);

	socket.on('session-start',
		function(data) {
			console.log("io.session.start");
			session = data;
			setupActions();
		}
	);

	socket.on('session-stop',
		function(data) {
			console.log("io.session-stop");
			session = null;
			setupActions();
		}	
	);

	socket.on('message', 
		function(data) { 
			console.log("io.message");
			currentSession = data.sessionid;
			$('#dd').text(formatDistance(data.distance));
			$('#speed').text(numeral(data.speed).format('0,0.00'));
			$('#max_speed').text(numeral(data.max_speed).format('0,0.00'));
			$('#avg_speed').text(numeral(data.avg_speed).format('0,0.00'));
			$('#ds').text(numeral(data.seconds).format('00:00:00'));
			$('#ticks').text(data.ticks);
		}
	);
**/		
}

var nsp_user = null;

function initSocketIO() {
	console.log("init nsp_user");
	if (nsp_user) {
		console.log("nsp_user already initialized");
	}
	getMe().then( user => {
		if (!user) {
			console.log("Not logged in. No user namespace for socket connection.")
			return;
		}
		
		if(nsp_user) return;
		console.log("Init socket namespace /" + user.login);
		let nsp = '/' + user.login;

		nsp_user = io(nsp);
		nsp_user.emit('bingo',{});
		
		io(nsp).on('connect', function(data) {
			console.log('nsp connected');
		})
		
		io(nsp).on('session-start',
			function(data) {
				console.log("io('" + nsp + "').session-start");
				session = data;
				setupActions();
			}
		);

		io(nsp).on('session-stop',
			function(data) {
				console.log("io('" + nsp + "').session-stop");
				session = null;
				setupActions();
			}
		);

		io(nsp).on('message', 
			function(data) { 
				console.log("io('" + nsp + "').message");
				currentSession = data.sessionid;
				$('#dd').text(formatDistance(data.distance));
				$('#speed').text(numeral(data.speed).format('0,0.00'));
				$('#max_speed').text(numeral(data.max_speed).format('0,0.00'));
				$('#avg_speed').text(numeral(data.avg_speed).format('0,0.00'));
				$('#ds').text(numeral(data.seconds).format('00:00:00'));
				$('#ticks').text(data.ticks);
			}
		);
	});
}

$().ready(onInit);