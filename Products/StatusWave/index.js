const express = require("express");
const app = express();
const qs = require("qs");
const request = require("request");
const bodyParser = require("body-parser");
var getRequestToken = require("./src/twitter/get-request-token.js");
const bcrypt = require('bcryptjs');
const config = require('./src/config');

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));


var LocalStorage = require("node-localstorage").LocalStorage;
var localStorage = new LocalStorage("./data");

function signup(name, email, password) {
  //localStorage.setItem("name", signupDetails.name);
  const userId = email.toLowerCase().trim();

  var passwordHash = bcrypt.hashSync(password, config.salt);

  var user = {name, email, passwordHash};
  localStorage.setItem(userId, JSON.stringify(user));
}

function getTwitterTokenForUser(userId){
  var user = JSON.parse(localStorage.getItem(userId));
  return user.twitterToken;
}

function saveTokenToUser(userId, tokenDetails){
  var user = JSON.parse(localStorage.getItem(userId));

  user.twitterToken = tokenDetails;

  localStorage.setItem(userId, JSON.stringify(user));
}

function verifyUser(email, password) {

  const userId = email.toLowerCase().trim();

  var userString = localStorage.getItem(userId);

  if (!userString){
    return false;
  }

  const user = JSON.parse(userString);

  var hash = bcrypt.hashSync(password, config.salt);

  return user.passwordHash === hash;
}

app.post("/signup", function(request, response) {
  var signupDetails = request.body;
  var userId = signupDetails.email;
  //2. we need to check if the user already exists

  var res = [];
  for (var i = 0; i < localStorage.length; i++) {
    res.push(localStorage.key(i));
  }
  if (res.indexOf(userId) > 0) {
    console.log(Error("user already exists"));
  }
  //using bcrypt

  signup(signupDetails.name, signupDetails.email, signupDetails.password);

  response.status(201).end();

});

function authenticate(auth){
  try {
    var baseValue = auth.split(" ")[1];

    var authString = Buffer.from(baseValue, 'base64').toString('ascii');
    var userPasswordSplit = authString.split(":");

    const email = userPasswordSplit[0];
    const password = userPasswordSplit[1];

    if (!verifyUser(email, password)) {
      return null;
    }

    return email;

  }
  catch(e){
    return null;
  }
}

app.post("/login", function(request, response) {
  if (!authenticate(request.headers.authorization)) 
 {
    response.status(401).end(); 
    return;
 } 

  response.status(200).end();
});

app.get("/authorize/twitter", (request, response) => {
var userId = authenticate(request.headers.authorization);
  if (!userId) 
 {
    response.status(401).end(); 
    return;
 } 

  console.log("Requesting a refresh token from twitter");

  const callback = (err, data) => {
    if (err) {
      response.statusCode(500);
    }
    response.send(data.oauth_token);
  };

  getRequestToken(callback, userId);
});

app.post("/message", (request,response) => {
  var message = request.body.message;

  var userId = authenticate(request.headers.authorization);
  if (!userId) {
    response.status(401).end();
    return;
  } 

  var tokenDetails = getTwitterTokenForUser(userId);

  tweet(message, tokenDetails.oauth_token, tokenDetails.oauth_token_secret);
});

app.get("/twitter/callback", (req, res) => {
  var tokenDetails = qs.parse(req.query);

  getAccessToken(
    tokenDetails.oauth_verifier,
    tokenDetails.oauth_token,
    (err, data) => {
      console.log('at data', data);
      if (err) {
        console.log("error when getting access token", err);
        res.send(
          "<h1>Something went wrong while giving access, please try again.</h1>"
        );
      } else {
        console.log("the access token is: ", data);
        saveTokenToUser(tokenDetails.userId, data);

        res.send("<h1>congrats, you have authorized us</h1><a href='/post.html'>Post</a>");
      }
    }
  );
});

function getAccessToken(oauthVerifier, oauthToken, cb) {
  var oauth = {
    consumer_key: config.consumerKey,
    consumer_secret: config.consumerSecret,
    token: oauthToken // in the documentation this says that it should be oauth_token but that does not work, it should just be token like the other requests and then it works.
  };
  request.post(
    {
      url: "https://api.twitter.com/oauth/access_token",
      oauth: oauth,
      qs: { oauth_verifier: oauthVerifier }
    },
    function(error, response, body) {
      if (error) {
        console.log(error);
        cb(error);
        return;
      }

      var data = qs.parse(body);
      cb(null, data);
    }
  );
}

app.listen(3000, () =>
  console.log("The server started correctly and is listening on port 3000!")
);

function tweet(message, token, tokenSecret) {
  const url = "https://api.twitter.com/1.1/statuses/update.json";

  var oauth = {
    consumer_key: config.consumerKey,
    consumer_secret: config.consumerSecret,
    token: token,
    token_secret: tokenSecret
  };

  var options = {
    url: url,
    oauth: oauth,
    qs: { status: message }
  };

  request.post(options, function(err, httpResponse, body) {
    console.log("http response code", httpResponse.statusCode);
    console.log("http response body", httpResponse.body);

    if (err) {
      console.log(err);
    }
    //cb(err, httpResponse.body);

  });
}
