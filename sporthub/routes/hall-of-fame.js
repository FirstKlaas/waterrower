const express = require('express')

var exports = module.exports = (app) => {
	let backend = app.get('backend');
	const router = express.Router();

	router.get('/',function (req, res) {
    	res.render('hall_of_fame', {});
	})

	router.get('/maxspeed.html',function (req, res) {
		backend.getHallOfFameMaxSpeed()
		.then(entries => res.render('hof_maxspeed', { 'hof': entries}))
		.catch(err => res.status(500).send({'err':err}));
	})

	router.get('/distance.html',function (req, res) {
	    backend.getHallOfFameDistance()
	    .then(entries => res.render('hof_distance', { 'hof': entries}))
	    .catch(err => res.status(500).send({'err':err}));
	})

	return router;
}