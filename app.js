'use strict';

// 1/12: all the user display and delete/voting restrictions
var mongoose = require('mongoose');
var db = mongoose.connection;

var express = require('express');
var app = express();
var mongo = require('mongodb');
var bodyParser = require('body-parser');
var controller = require('./controllers/router.js');

mongoose.connect('mongodb://localhost:27017/votingapp', function (err, db)
{
 if (err) {
      throw new Error('Database failed to connect!');
   } else {
      console.log('Successfully connected to MongoDB on port 27017.');

app.use('/static', express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.set('view engine', 'jade');
app.set('views', __dirname + '/templates');

controller.set(app);  

app.listen(8080, function(){
	console.log("The frontend server is running on port 8080.");
}); //listen 8080
}
});