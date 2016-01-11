'use strict';

// 1/10/16: https://stackoverflow.com/questions/21184340/async-for-loop-in-node-js
var mongoose = require('mongoose');
var User = require("./dbmodels/user.js");
var Poll = require("./dbmodels/poll.js");
var db = mongoose.connection;

var User = mongoose.model("User");
var Poll = mongoose.model("Poll");

var express = require('express');
var app = express();
var mongo = require('mongodb');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt');
var async = require('async');

var app = express();
var isLoggedIn = false;
var errorMessage = "";
var successMessage = "";
var sessionEmail = "";
var sessionName = "";
var sessionID;
var sessionPolls = [];

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

app.get('/', function(req, res){
	var path = req.path;
	res.locals.path = path;
	if(isLoggedIn){
		res.redirect("/dashboard");
	}
	else{
		res.render('index', {seshName: sessionName, loggedIn: isLoggedIn});	
	}
});

app.get('/login', function(req, res){
	if(!isLoggedIn){
		res.render('login', {seshName: sessionName, loggedIn: isLoggedIn, success: successMessage});
	}
	else{
		res.redirect("/dashboard");
	}
});

app.post('/login', function(req, res){ //attempt to log in with email/password
  var email = req.body.email;
  var password = req.body.password;
  User.findOne({"email": email}, function(err, doc){
  	if(!err && doc != null){
  		var hashedPassword = doc.password;
  		if(bcrypt.compareSync(password, hashedPassword)){
  		isLoggedIn = true;
  		sessionEmail = email;
  		sessionName = doc.name;
  		sessionID = doc._id;
  		res.redirect("/dashboard");
  		}
  		else{
    	errorMessage = "Incorrect email or password. Try again.";
    	res.render("login", {seshName: sessionName, loggedIn: isLoggedIn, error: errorMessage});
    }
  	}
    else{
    	errorMessage = "Incorrect email or password. Try again.";
    	res.render("login", {seshName: sessionName, loggedIn: isLoggedIn, error: errorMessage});
    }
  });
});

app.get('/logout', function(req, res){
	isLoggedIn = false;
	sessionEmail = "";
	sessionName = "";
	sessionID = null;
	res.redirect("/");
});

app.get("/signup", function(req, res){
	if(!isLoggedIn){
		res.render('signup', {seshName: sessionName, loggedIn: isLoggedIn});
	}
	else{
		res.redirect("/dashboard");
	}
});

app.post('/signup', function(req, res){ //submit new account info
	if(isLoggedIn){
		res.redirect("/dashboard");
	}
else{
  var name = req.body.name;
  var email = req.body.email;
  var password = req.body.password;
  var hashedPassword = bcrypt.hashSync(password, 10);
  var emailRegex = /@/;
  
  if(name && email && password && name.length > 2 && email.match(emailRegex) && password.length > 6){
   var newUser = new User({"name": name, "email":email, "password": hashedPassword}); 
   newUser.save(function(){
   var userID;
   User.findOne({"email": email}).lean().exec(function(err, data){
   if(!err){
   userID = data._id;	
   successMessage = "Account successfully created!";
   errorMessage = "";
   res.redirect("/login");
   	}
   });
   });

  }
  else{
  	errorMessage = "Invalid information. Enter a valid email, a name longer than 2 characters, and a password longer than 6 characters.";
  	successMessage = "";
  	res.render('signup', {seshName: sessionName, loggedIn: isLoggedIn, error: errorMessage});
  }
}

});

app.get("/settings", function(req, res){
	if(!isLoggedIn){
		res.redirect("/");
	}
	else{
		res.render("settings", {seshName: sessionName, loggedIn: isLoggedIn});
	}
});

app.post("/settings", function(req, res){ //submit changes to account info
    if(!isLoggedIn){
		res.redirect("/");
	}
	else{
		var newName = req.body.name;
		var newEmail = req.body.email;
		var currentPassword = req.body.currentPassword;
		var newPassword = req.body.newPassword;
		
		User.findOne({"email": sessionEmail}).lean().exec(function(err, doc){
			var hashedPassword = doc.password;
  	if(doc && !err && newPassword.length > 6 && bcrypt.compareSync(currentPassword, hashedPassword)){
  		var userID = doc._id;
  		User.update({"email": sessionEmail}, {"$set": {"password": bcrypt.hashSync(newPassword, 10), "name": newName, "email": newEmail}}, function(err, data){
  			if(!err){
  					sessionEmail = newEmail;
  					sessionName = newName;
  					successMessage = "Info successfully changed!";
  					errorMessage = "";
  					res.render("settings", {seshName: sessionName, loggedIn: isLoggedIn, seshEmail: sessionEmail, success: successMessage});
  			}
  		});
  	}
    else{
    	errorMessage = "There was an error when changing your password. Make sure you entered your old one correctly, and that the new one is at least 7 characters in length.";
    	successMessage = "";
    	res.render("settings", {seshName: sessionName, loggedIn: isLoggedIn, seshEmail: sessionEmail, error: errorMessage});
    }
  });
	}
});

app.get("/dashboard", function(req, res){
	if(!isLoggedIn){
		res.redirect("/");
	} //if not logged in
	else{
		getUpdatedPollList(function(){
			res.render("dashboard", {seshName: sessionName, loggedIn: isLoggedIn, polls: sessionPolls, success: successMessage});	
		});
	} //else if not logged in
});

app.post("/dashboard", function(req, res){ //adding a poll to the user's account
	    if(!isLoggedIn){
		res.redirect("/");
	} //if logged in
	else{
		if(req.body.action == "addPoll"){
	var pollName = req.body.pollName;
	var options = req.body.options;
	var optionsWithTallies = [];
	var userID;
	async.each(options, appendOption, renderDash);
	
	function appendOption(option, callback){
		var appendThis = {"text": option, "votes": 0};
		optionsWithTallies.push(appendThis);
		return callback(null);
	}
	function renderDash(){
			if(pollName.length > 1 && options.length > 1){
   			var newPoll = new Poll({"userID": sessionID, "title": pollName, "options": optionsWithTallies});	
   			newPoll.save(function(){
   			  		getUpdatedPollList(function(){
   			  			successMessage = "Poll added!";
			res.render("dashboard", {seshName: sessionName, loggedIn: isLoggedIn, polls: sessionPolls, success: successMessage});
		}); // if no error
   			});
			}
   			else{
		errorMessage = "You submitted a poll with a title of inadequate length, a title that's already taken, or has an insufficient number of options. Try again.";
		successMessage = "";
		getUpdatedPollList(function(){
			res.render("dashboard", {seshName: sessionName, loggedIn: isLoggedIn, polls: sessionPolls, error: errorMessage});
		});
			}
	}
	}
	else if(req.body.action == "deletePoll"){
			var deleteThis = req.body.deleteID;
			console.log(deleteThis);
			sessionPolls = [];
			Poll.remove({"_id": deleteThis}).lean().exec(function(err, data){
			successMessage = "Poll removed.";
			errorMessage = "";
			getUpdatedPollList(function(){
			res.render("dashboard", {seshName: sessionName, loggedIn: isLoggedIn, polls: sessionPolls, success: successMessage, displayDelete: true});
		});
		});
	}
	else{}
	}
	});

app.get("/polls/:id", function(req, res){
	if(!isLoggedIn){
		res.redirect("/");
	}
	else{
		Poll.findOne({"polls._id": req.params.id}, {"polls.$": 1}).lean().exec(function(err, doc) {
		var thePoll = {"pollID": doc.polls[0]._id, "pollName": doc.polls[0].title, "pollOptions": doc.polls[0].options};
		res.render("poll", {seshName: sessionName, loggedIn: isLoggedIn, poll: thePoll, pollID: req.params.id});
		});
	}
}); //get poll

app.post("/polls/:id", function(req, res){  //register a vote for a poll's option
	if(!isLoggedIn){
		res.redirect("/");
	}
	else{
		var pollID = req.body.pollID;
		var optionID = req.body.incrementID;
		
		//make stackoverflow question
		Poll.update({"userID": sessionID, "polls._id": pollID, "polls.options._id": optionID}, {$inc: {"polls.options.$.votes": 1}}).lean().exec(function(err, doc){
			console.log(doc);
			console.log(err);
		});
	}
}); //post poll

app.use(function(req, res) {
	res.status(404).render("404", {seshName: sessionName, loggedIn: isLoggedIn});
});
app.use(function(error, req, res, next) {
    res.status(500).render("500", {seshName: sessionName, loggedIn: isLoggedIn});
});


app.listen(8080, function(){
	console.log("The frontend server is running on port 8080.");
}); //listen 8080
}

function getUpdatedPollList(callback){
		sessionPolls = [];
		var userPolls = Poll.find({"userID": sessionID}).stream();
		userPolls.on("data", function(pollData){
			sessionPolls.push({"id": pollData._id, "name": pollData.title});
		});
		userPolls.on("end", function(){
			callback();
		});
}
});