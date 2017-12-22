const request = require("request");
const qs = require("qs");

const config = require('../config');

function getRequestToken(cb, userId) {
  var oauth = {
    callback: 'http://localhost:3000/twitter/callback?userId=' + userId,
    consumer_key: config.consumerKey,
    consumer_secret: config.consumerSecret
  };
  request.post(
    {
      url: "https://api.twitter.com/oauth/request_token",
      oauth: oauth
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

module.exports = getRequestToken;