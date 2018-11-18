//Name: Brian Allison
//Course: CS493 
//Date: 10/21/2018
//: cid: 1021029081363-d54rsqg7encvkbg6g57ko85hk0p212b1.apps.googleusercontent.com
//:cs: nk2CDERgVGyj7OccSJkxSxI0
//References: Google's API for datastore and the course lectures were 
//the primary resources used for this assignment. As a result, some of the
//functions are pretty similar to what is shown in those resources.

const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const projectId = 'wk7oauth';
const datastore = new Datastore({projectId:projectId});

const SHIP = "Ship";
const SLIP = "Slip";

const router = express.Router();

var handlebars = require('express-handlebars').create({defaultLayout:'main'});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('port', 3000);

app.use(bodyParser.json());

var rp = require('request-promise');

//adds id to entity since it is not automatically provided by datastore
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

//undocks ship from passed in slip
function undock(slip_id, ship_id){
     const key = datastore.key([SLIP, parseInt(slip_id,10)]);
    return datastore.get(key).then(result => {
        const slip = result[0];
        if (slip.current_boat == ship_id){
            slip.current_boat = '';
            slip.arrival_date = '';
            return datastore.save({"key":key, "data":slip});
        }
    });
}
/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */
//GET list of ships
router.get('/',function(req,res){
  res.render('index');
});

router.get('/user',function(req,res){
    //console.log("logging code ", req.query.code);
    //post style from https://www.npmjs.com/package/request-promise
    console.log('access_token is ' + req.body.access_token);
    if (!req.body.access_token)
    {
    console.log("inside if")
    var fields = {
    method: 'POST',
    uri: 'https://www.googleapis.com/oauth2/v4/token',
    body: {
        code: req.query.code,
        client_id: '1021029081363-d54rsqg7encvkbg6g57ko85hk0p212b1.apps.googleusercontent.com',
        client_secret: 'nk2CDERgVGyj7OccSJkxSxI0',
        redirect_uri: 'https://wk7oauth.appspot.com/user',
        grant_type: 'authorization_code'
    },
    json: true 
    };

    rp(fields)
    .then(function (parsedBody) {
        console.log("post worked, response is " + parsedBody.access_token);
        //res.redirect('https://wk7oauth.appspot.com/info?tok=' + String(parsedBody.access_token));
        var token = parsedBody.access_token;
        var t = 'Bearer ' + token;
        console.log('made it here and token is ' + token);
        var f = {
        method: 'GET',
        uri: 'https://www.googleapis.com/plus/v1/people/me',
        headers: {
        'Authorization': t
        },
        json: true 

        };
    
    //get google + page GET https://www.googleapis.com/plus/v1/people/userId
    //get google+ info https://www.googleapis.com/plus/v1/people/me
    //pass to html page
    
    rp(f)
    .then(function (parsedBody) {
        console.log("post worked" + parsedBody);
        //res.render('info', parsedBody.displayName);
        res.send("name is " + parsedBody.displayName + ", state is secret700," + " and url is https://plus.google.com/" + parsedBody.id);
    })
    .catch(function (err) {
        console.log("info could not load error is " + err);
    });
    })
    .catch(function (err) {
        console.log("post did not work");
        console.log("logging error " + err);
    });
}
    
  //res.render('user', res);
});
 
router.get('/info',function(req,res){
    //get token
        //req.body.access_token
    //add token to header and get first name, last name, and profile link
    
    var token = req.params.tok;
    var t = 'Bearer ' + token;
    console.log('made it here and token is ' + token);
    var fields = {
    method: 'GET',
    uri: 'https://www.googleapis.com/plus/v1/people/me',
    headers: {
        'Authorization': token
    },
    json: true 

    };
    
    //get google + page GET https://www.googleapis.com/plus/v1/people/userId
    //get google+ info https://www.googleapis.com/plus/v1/people/me
    //pass to html page
    
    rp(fields)
    .then(function (parsedBody) {
        console.log("post worked" + parsedBody);
        res.render('info');
    })
    .catch(function (err) {
        console.log("info could not load error is " + err);
    });
});


//GET list of slips
router.get('/slips', function(req, res){
    const slips = get_slips()
    .then( (slips) => {
        //console.log(slips);
        res.status(200).json(slips);
    });
});

//POST to create new slip
router.post('/slips', function(req, res){
    //console.log(req.body);
    if (typeof req.body.number == 'number') {
         post_slip(req.body.number)
        .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
    }
    else{
        res.status(200).send("invalid info");
    }
});

//GET specific slip
router.get('/slips/:id', function(req, res){
        get_slip(req.params.id).then( (slip) => {
        //console.log(slip);
        res.status(200).json(slip);
    });
});

//GET specific ship
router.get('/ships/:id', function(req, res){
    get_ship(req.params.id).then( (ship) => {
        //console.log(ship);
        res.status(200).json(ship);
    });
});

//PUT to edit specific slip
router.put('/slips/:id', function(req, res){
    if ((typeof req.body.number == 'number') && (typeof req.body.current_boat == 'string')
        && (typeof req.body.arrival_date == 'string')) {
        put_slip(req.params.id, req.body.number, req.body.current_boat, req.body.arrival_date)
        .then(res.status(200).end());
    }
    else{
        res.status(200).send("invalid info");
    }
});

//PUT to edit specific ship
router.put('/ships/:id', function(req, res){
    if ((typeof req.body.name == 'string') && (typeof req.body.type == 'string')
     && (typeof req.body.length == 'number')){
        put_ship(req.params.id, req.body.name, req.body.type, req.body.length)
        .then(res.status(200).end());
    }
    else{
        res.status(200).send("invalid info");
    }
});

//delete specific slip
router.delete('/slips/:id', function(req, res){
    delete_slip(req.params.id).then(res.status(200).end());
});

//delete specific ship
router.delete('/ships/:id', function(req, res){
    delete_ship(req.params.id).then(res.status(200).end());
});

//delete all ships
router.delete('/ships', function(req, res){
    delete_all_ships().then(res.status(200).end());
});

//delete all slips
router.delete('/slips', function(req, res){
    delete_all_slips().then(res.status(200).end());
});

//remove ship from slip
router.delete('/slips/:slip_id/ships/:ship_id', function(req, res){
    undock(req.params.slip_id, req.params.ship_id).then(res.status(200).end());
});

//add ship to slip
router.post('/slips/:slip_id/ships/:ship_id', function(req, res){
    if(typeof req.body.arrival_date == 'string'){
        dock(req.params.slip_id, req.params.ship_id, req.body.arrival_date).then( (value) => {
            if (value == true){
                res.status(200).end();
            }
            else{
                //return if slip is already taken
                res.status(403).end('slip occupied');
            }
        })
    }
    else{
        res.status(200).send('invalid info');
    }
  
});


/* ------------- End Controller Functions ------------- */

app.use('', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});