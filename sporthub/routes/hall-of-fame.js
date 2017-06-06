const express = require('express')

var exports = module.exports = (app) => {
	let backend = app.get('backend');
	const router = express.Router();

	router.get('/maxspeed.html',function (req, res) {
		let device = backend.getHallOfFameMaxSpeed(
	        function(err) {
	            res.status(500).send({'err':err})
	        },
	        function(entries) {
	        	res.render('hof_maxspeed', { 'hof': entries});
	        }
	    )
	})

	router.get('/distance.html',function (req, res) {
	    let device = backend.getHallOfFameDistance(
	        function(err) {
	            res.status(500).send({'err':err})
	        },
	        function(entries) {
	            res.render('hof_distance', { 'hof': entries});
	        }
	    )
	})

	return router;
}