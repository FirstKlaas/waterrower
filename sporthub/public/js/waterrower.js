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
	});
}

function setDevice(id, clb) {
	$.getJSON( "/rest/device/" + id , function( data ) {
		device = data.device;
		$('#current-device').text(device.human);
	    clb(device);
	});
}

function setUser(id, clb) {
	$.getJSON( "/rest/user/" + id , function( data ) {
		user = data.user;
		$('#current-user').text(user.firstname);
		if (user.twitter_profile) {
			$('#profileimage').attr('src',user.twitter_profile.profile_image_url_https_200);
		} else {
			$('#profileimage').attr('src','/img/aang.png');
		}
	    clb(user);
	});
}

function startSession() {
	console.log('start session');
	if (!user) return;
	console.log('has user');
	if (!device) return;
	console.log('has device');
	if (session) return;
	console.log('has no session');
	console.log("/rest/session/start/" + user.id + "/" + device.id);
	$.getJSON( "/rest/session/start/" + user.id + "/" + device.id, function( data ) {
		session = data.session;
		console.log(session);
		console.log(user);
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

function findUser(id, userarr) {
	return userarr.find(user => {
		return user.id == id;
	});
}

function showSessionsComplex() {
	$.getJSON( "/rest/user", data => {
		$('#content').load('/sessions.html',
			function() {
				$("div[userid]").each( function(index) {
					var userid = $( this ).attr('userid');
					var user = findUser(userid, data.user);
					if (user) {
						$( this ).text(user.firstname);
					} else {
						$( this ).text('Guest');
					}
				});

				$('#pagetopic').text('Workouts');
			}
		);
	});
}

function deleteSession(id, update, sender) {
	$.getJSON( "/rest/session/delete/" + id, data => {
		if (update) {
			$(sender).parent().hide();
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

function showUser() {
	$('#content').load('/user.html',
		function() {
			$('#pagetopic').text('Sportler');
		}
	);
}

function testGraph() {
	var ctx = document.getElementById("myChart").getContext('2d');
	var myChart = new Chart(ctx, {
	    type: 'bar',
	    data: {
	        labels: ["Red", "Blue", "Yellow", "Green", "Purple", "Orange"],
	        datasets: [{
	            label: '# of Votes',
	            data: [12, 19, 3, 5, 2, 3],
	            backgroundColor: [
	                'rgba(255, 99, 132, 0.2)',
	                'rgba(54, 162, 235, 0.2)',
	                'rgba(255, 206, 86, 0.2)',
	                'rgba(75, 192, 192, 0.2)',
	                'rgba(153, 102, 255, 0.2)',
	                'rgba(255, 159, 64, 0.2)'
	            ],
	            borderColor: [
	                'rgba(255,99,132,1)',
	                'rgba(54, 162, 235, 1)',
	                'rgba(255, 206, 86, 1)',
	                'rgba(75, 192, 192, 1)',
	                'rgba(153, 102, 255, 1)',
	                'rgba(255, 159, 64, 1)'
	            ],
	            borderWidth: 1
	        }]
	    },
	    options: {
	        scales: {
	            yAxes: [{
	                ticks: {
	                    beginAtZero:true
	                }
	            }]
	        }
	    }
	});
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
	if (user && device) {
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
		}
	})
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
		onInit();
	}
);

socket.on('session-stop',
	function(data) {
		session = null;
		console.log('io=> session-stop ' + JSON.stringify(data));
		onInit();
	}
);



