const express = require('express');
const session = require('express-session');
const genomeLink = require('genomelink-node');
const request = require('request');
const sha1 = require('sha1');
require('dotenv').config();

const app = express();
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(session({
  secret: process.env.GENOMELINK_CLIENT_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 30 * 60 * 1000
  }
}));

app.get('/', async (req, res) => {
  const scope = 'report:bmi report:body-fat-mass report:body-fat-percentage report:caffeine-consumption report:excessive-daytime-sleepiness report:height report:job-related-exhaustion report:muscular-strength report:weight';
  const authorizeUrl = genomeLink.OAuth.authorizeUrl({ scope: scope });

  // Fetching a protected resource using an OAuth2 token if exists.
  let reports = [];
  if (req.session.oauthToken) {
    const scopes = scope.split(' ');
    reports = await Promise.all(scopes.map( async (name) => {
      return await genomeLink.Report.fetch({
        name: name.replace(/report:/g, ''),
        population: 'european',
        token: req.session.oauthToken
      });
    }));
  }

  if(reports.length > 0) {
    let reportData = {};
    for(let i=0; i<reports.length; i++) {
      let rep = reports[i];
      if(typeof rep["_data"]["phenotype"] !== 'undefined') {
        reportData[rep["_data"]["phenotype"]["url_name"]] = rep["_data"];
      }
    }

    let reportToken = sha1(req.session.oauthToken).substring(0, 6);
    console.log(`Token------------> ${reportToken}`);
    // console.log(reportData);
    let postData = {
      method: 'POST',
      url: 'https://genomedb.herokuapp.com/reports',
      body: {"token": reportToken, "report": reportData},
      json: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    request.post(postData, (err, resp, body) => {
      if (err) {
        console.log(err);
        res.send('Error');
        return;
      }
      res.send(`Token: ${reportToken}`);
    });



  }
  else {
    res.render('index', {
      authorize_url: authorizeUrl,
      reports: reports,
    });
  }

});

app.get('/callback', async (req, res) => {
  // The user has been redirected back from the provider to your registered
  // callback URL. With this redirection comes an authorization code included
  // in the request URL. We will use that to obtain an access token.
  req.session.oauthToken = await genomeLink.OAuth.token({ requestUrl: req.url });

  // At this point you can fetch protected resources but lets save
  // the token and show how this is done from a persisted token in index page.
  res.redirect('/');
});

// Run local server on port 3000.
const port = process.env.PORT || 3000;
const server = app.listen(port, function () {
  console.log('Server running at http://127.0.0.1:' + port + '/');
});
