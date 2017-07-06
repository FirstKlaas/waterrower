var socket    = io();
var session   = null;
var device    = null;

function formatDistance(value) {
	if (value < 1000) return numeral(value).format('0,0.00') + ' m';
	return numeral(value/1000).format('0,0.000') + ' km';
}

function stopSession() {
	console.log(session);
	console.log(device);

	if(!session) {
		console.log("No session to stop");
		return;
	}
	console.log("Stopping session " + session.id);
	$.getJSON( "/rest/session/stop/" + session.id, function( data ) {
		session = null;
	});
}

function setDevice(id, clb) {
	$('#current-device').text('...updating');
	console.log('##########################');
	$.post("/set/active/device/" + id, function( data ) {
		device = data.device;
		$('#current-device').text(device.human);
	    clb(device);
	});
}

function voidCall() {}

function startSession() {
	console.log('start session');
	if (!device) return;
	console.log('has device');
	if (session) return;
	console.log('has no session');
	console.log("/rest/session/start/" + device.id);
	
	var elem = $('#startstop');
	elem.removeClass('fa-play-circle-o');
	elem.removeClass('fa-stop-circle-o');
	elem.addClass('fa-cog');
	elem.one('click',function() {
		voidCall();
	});			

	$.getJSON( "/rest/session/start/" + device.id, function( data ) {
		session = data.session;
		console.log(session);
		console.log(device);
	    //setupActions();
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

	var posting = $.post( url, userdata );

	posting.done(data => {
		console.log('Nun die devices anzeigen');
		showDevices();
	})	
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
	if (session) {
		var elem = $('#startstop');
		elem.removeClass('fa-play-circle-o');
		elem.addClass('fa-stop-circle-o');
		elem.one('click',function() {
			stopSession();
		});			
	} else {
		var elem = $('#startstop');
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
			console.log(data);
			if (data && data.sessions) {
				resolve(data.sessions[0]);
			} else {
				resolve(null);
			}
		});
	});
}

function selectDevice(id) {
	if (session) {
		alert('Session is running');
	} else {
		setDevice(id,
			function(data) {
				showLive();
			}
		)
	}	
}

function onInit() {
}

socket.on('message', 
	function(data) { 
		//console.log(data)
		currentSession = data.sessionid;
		$('#dd').text(formatDistance(data.distance));
		$('#speed').text(numeral(data.speed).format('0,0.00'));
		$('#max_speed').text(numeral(data.max_speed).format('0,0.00'));
		$('#avg_speed').text(numeral(data.avg_speed).format('0,0.00'));
		$('#ds').text(numeral(data.seconds).format('00:00:00'));
		$('#ticks').text(data.ticks);
	});

socket.on('session-start',
	function(data) {
		console.log('io=> session-start ' + JSON.stringify(data));
		setupActions();
	}
);

socket.on('session-stop',
	function(data) {
		session = null;
		console.log('io=> session-stop ' + JSON.stringify(data));
		setupActions();
	}
);



