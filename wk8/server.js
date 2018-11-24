//Name: Brian Allison
//Course: CS493 
//Date: 10/21/2018

//References: Google's API for datastore and the course lectures were 
//the primary resources used for this assignment. As a result, some of the
//functions are pretty similar to what is shown in those resources.

const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');

const projectId = 'wk8jwt';
const datastore = new Datastore({projectId:projectId});

const WISH_LIST = "Wish_list";
const SLIP = "Slip";
const ITEM = "Item";

const router = express.Router();
var rp = require('request-promise');

app.use(bodyParser.json());

//adds id to entity since it is not automatically provided by datastore
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

//adds the url that directs the user to GET ship
function addShipURL(item, req){
    var url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + "ships" + "/";
    if (item.current_boat){
        item.self = url + item.current_boat;
    }
}

//adds self url singular
function addSelfURL(item, type, req){
    //console.log("adding self url for " + item);
    item.self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + type + "/" + item.id;
    //console.log(item.self);
}

//adds self URLs plural
function addSelfURLs(obj, type, req){
    for (var i = 0; i < obj.length; i++){
        addSelfURL(obj[i], type, req);
    }
}

//adds next url
function addNextURL(queryResults, req, category, URLquery){
    var next = {};
    if (queryResults.moreResults !== datastore.NO_MORE_RESULTS){
        next = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + category + "?" + URLquery + "=" + queryResults.endCursor;
    }
    //console.log("printing endcursor " + queryResults.endCursor);
    //console.log("printing next: " + next);
    return next;
}

function findObject(id, type){
    var q = datastore.createQuery(type);
    return datastore.runQuery(q).then( (queryResults) => {
            //console.log("printing end cursor from get ships " + queryResults[1].endCursor);
            queryResults[0].map(fromDatastore);
            //console.log(queryResults[0]);
            //console.log('before loop');
            var found = false;
            for (var i = 0; i < queryResults[0].length; i++){
                //console.log('here now');
                if (queryResults[0][i].id === id){
                    found = true; 
                }
            }
            //console.log('before return false');
            return found;
    });
}

const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: 'https://wk8jwt.auth0.com/.well-known/jwks.json'
    }),

    issuer: 'https://wk8jwt.auth0.com/',
    algorithms: ['RS256']
});


/* ------------- Begin Model Functions ------------- */
//users: first name, last name, birthdate 
//wish_lists: title, wish_list date, category
//items: name, price, department


//creates a new ship
function post_item(name, price, department){
    var key = datastore.key(ITEM);
    const new_item= {"name": name, "price": price, "department": department};
    return datastore.save({"key":key, "data":new_item}).then(() => {return key});
}

//creates a new ship
function post_wish_list(name, date, type){
    var key = datastore.key(WISH_LIST);
	const new_wish_list = {"name": name, "date": date, "type": type};
	return datastore.save({"key":key, "data":new_wish_list}).then(() => {return key});
}


//returns a list of all ship entities
function get_wish_lists(req){
    var wish_list_query = datastore.createQuery(WISH_LIST).limit(5);
    var wish_list_query_l = datastore.createQuery(WISH_LIST);
    var wish_list_query
    var cargoQuery = datastore.createQuery(CARGO);
    var all = {};
    var path = "/wish_lists/"
    if (Object.keys(req.query).includes("cursor")){
        wish_list_query = wish_list_query.start(req.query.cursor);
    }
     return datastore.runQuery(wish_list_query_l).then( (queryResultsl) => {
       all.collection_size = queryResultsl[0].length;
        return datastore.runQuery(wish_list_query).then( (queryResults) => {
                //console.log("printing end cursor from get shaips " + queryResults[1].endCursor);
                queryResults[0].map(fromDatastore);
                addSelfURLs(queryResults[0], "wish_lists", req);
                return datastore.runQuery(cargoQuery).then( (cargoResults) => {
                    cargoResults[0].map(fromDatastore);
                     addSelfURLs(cargoResults[0], "cargo", req);
                    for (var i = 0; i < queryResults[0].length; i++){
                        queryResults[0][i].cargo = [];
                        for (var j = 0; j < cargoResults[0].length; j++){
                            if (queryResults[0][i].id === cargoResults[0][j].carrier){
                                var carg = new Object();
                                carg.id = cargoResults[0][j].id;
                                carg.self = cargoResults[0][j].self;
                                queryResults[0][i].cargo.push(carg);
                            }
                        }
                        //return queryResults[0];
                        console.log("printing query Results[0][i] " + queryResults[0][i]);
                    }
                    //col = list(queryResults.fetch());
                    //all.collection_size = len(col);
                    all.items = queryResults[0];

                    all.next = addNextURL(queryResults[1], req, path, "cursor");
                    return all;
            });

        });
    });
}

//gets cargo data singular
function get_item(id, req){
    var brief_wish_list = {};
    var key = datastore.key([ITEM, parseInt(id,10)]);
    return datastore.get(key).then(results => {
        const entity = results[0];
        if (entity.parent_wish_list){
            const sId = entity.parent_wish_list;
            var wish_list_key = datastore.key([WISH_LIST, parseInt(sId,10)]);
            return datastore.get(wish_list_key).then((wish_list) => {
                brief_wish_list.id = entity.carrier;
                brief_wish_list.name = wish_list[0].name;
                addSelfURL(brief_wish_list, "wish_lists", req);
                entity.parent_wish_list = brief_wish_list;
                entity.id = id;
                addSelfURL(entity, "item", req);
                return entity;
            });
        }
        else{
            entity.id = id;
            addSelfURL(entity, "wish_list", req);
            return entity;
        }
    });       
}


//returns list of all cargo
function get_all_items(req){
    var query = datastore.createQuery(ITEM).limit(3);
    var wish_list_query = datastore.createQuery(WISH_LIST);
    var all = {};

    if (Object.keys(req.query).includes("cursor")){
        query = query.start(req.query.cursor);
    }
    return datastore.runQuery(query).then( (queryResults) => {
            queryResults[0].map(fromDatastore);
            addSelfURLs(queryResults[0], "items", req);
            return datastore.runQuery(wish_list_query).then((wish_list_results) => {
                wish_list_results[0].map(fromDatastore);
                addSelfURLs(wish_list_results[0], "wish_lists", req);
                for(var i = 0; i < queryResults[0].length; i++){
                     var wish_list = new Object();
                    for(var j = 0; j < wish_list_results[0].length; j++){
                        if (queryResults[0][i].parent_wish_list === wish_list_results[0][j].id){
                            wish_list.id = wish_list_results[0][j].id;
                            wish_list.name = wish_list_results[0][j].name;
                            wish_list.self = wish_list_results[0][j].self;
                            queryResults[0][i].parent_wish_list = wish_list;
                        }

                    }
                }
            all.items = queryResults[0];
            all.next = addNextURL(queryResults[1], req, "item", "cursor");
            return all;
            });
        });

}

//used https://cloud.google.com/datastore/docs/concepts/entities
//for help with this function. Returns a single slip
function get_slip(id, req){
    //returns undefined if id does not exist
        const key = datastore.key([SLIP, parseInt(id,10)]);
        return datastore.get(key).then(results => {
            //returns entity if id does exist
            const entity = results[0];
            addShipURL(entity, req);
            fromDatastore(entity);
            addSelfURL(entity, "slips", req);
            return entity;
    });
}

//gets ship singular
function get_wish_list(id, req){
    //returns undefined if id does not exist
        const key = datastore.key([WISH_LIST, parseInt(id,10)]);
        //console.log("logging key" + key);
        var cargoQuery = datastore.createQuery(CARGO);
        return datastore.get(key).then(results => {
            //returns entity if id does exist
            const entity = results[0];
            entity.id = id;
            entity.cargo = [];
            addSelfURL(entity, "wish_lists", req);
            return datastore.runQuery(cargoQuery).then( (cargoResults) => {
                cargoResults[0].map(fromDatastore);
                for (var i = 0; i < cargoResults[0].length; i++){
                    if (cargoResults[0][i].carrier === entity.id){
                        var tempCargo = new Object();
                        tempCargo.id = cargoResults[0][i].id;
                        addSelfURL(tempCargo, "cargo", req);
                        entity.cargo.push(tempCargo);
                    }
                }
                return entity;
            });
    });
}

function get_ships_by_owner(owner){
    const q = datastore.createQuery(SHIP);
    return datastore.runQuery(q).then( (entities) => {
            return entities[0].map(fromDatastore).filter( item => item.owner === owner );
        });
}

//Changes all data in ship to passed in data
function put_wish_list(id, name, type, date){
    const key = datastore.key([WISH_LIST, parseInt(id,10)]);
    const wish_list = {"name": name, "type": type, "date": date};
    return datastore.save({"key": key, "data": wish_list});
}

//deletes ship and removes it from slip if it is docked
function delete_wish_list(id, req){
    const key = datastore.key([WISH_LIST, parseInt(id,10)]);
    const wish_list = datastore.get(key);
    //const slips = get_slips(req);
    //const blank1 = '';
    //const blank2 = '';
    //const carrier = '';
    //const delivery_date = '';
    //console.log("test!");
    //const slipQuery = datastore.createQuery(SLIP);
    //added return 10-27-18
    const cargoQuery = datastore.createQuery(CARGO);

/*    return datastore.runQuery(slipQuery).then( (results) => {
        //gcloud documentation
        const slips = results[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < slips.length; i++){
        //console.log("in loop");
            if (slips[i].current_boat == id){
                //console.log("found boat");
                 put_slip(slips[i].id, slips[i].number, blank1, blank2);
            }
        }*/
        //console.log("before return");
        return datastore.runQuery(cargoQuery).then((cargoResults) =>{
            //console.log("after return");
            const cargo = cargoResults[0].map(fromDatastore);
           // console.log("logging cargo" + cargo);
            for (var j = 0; j < cargo.length; j++){
                if (cargo[i].carrier === id){
                    put_cargo(cargo[i].id, cargo[i].weight, 
                        cargo[i].content);
                }
            }
            return datastore.delete(key);
        });
    //});  
}

//loads cargo on ship
function load(wish_list_id, item_id){
    const key = datastore.key([ITEM, parseInt(item_id,10)]);
    return datastore.get(key).then( result => {
        const item = result[0];
        if (!(item.parent_wish_list)){
            item.parent_wish_list = wish_list_id;
            return datastore.save({"key":key, "data":item});
            //(return true);
           // changed 10/27/18
            //return true;
        }
        else {
            return false;
        }
    });
}

//deletes all ships
function delete_all_wish_lists(){
    const wish_listQuery = datastore.createQuery(WISH_LIST);
    //got error unless used return here. Has something to do with promises, but not sure
    //exactly what the problem is
    return datastore.runQuery(wish_listQuery).then( (results) => {
        //gcloud documentation
        const wish_lists = results[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < wish_lists.length; i++){
        //console.log("in loop")
            delete_ship(wish_lists[i].id);
        }
        //Did not complete request unless return statement was here. Seems that
        //promises require this, but needs more investigation. *This was actually
        //an issue with the response.
        //return true;
    });
}


/* ------------- End Model Functions ------------- */

/* ------------- Begin Ship Controller Functions ------------- */

router.post('/users', function(req, res){
    const username = req.body.username;
    const pass = req.body.password;
    console.log(username);
    var options = {
        method: 'POST',
        url: 'https://wk8jwt.auth0.com/api/v2/users',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik5USkdRelJEUWpWQlF6bEJNekV5TmtGR1FqRTNRelV5T0RaRVEwTkNOa00yTXprelJEZzJPUSJ9.eyJpc3MiOiJodHRwczovL3drOGp3dC5hdXRoMC5jb20vIiwic3ViIjoiMWhnSE5FODRmald0MFM3YUFka1hjTWNmQUxIYmJVc1pAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vd2s4and0LmF1dGgwLmNvbS9hcGkvdjIvIiwiaWF0IjoxNTQyNDM5Mjc1LCJleHAiOjE1NDUwMzEyNzUsImF6cCI6IjFoZ0hORTg0ZmpXdDBTN2FBZGtYY01jZkFMSGJiVXNaIiwic2NvcGUiOiJyZWFkOmNsaWVudF9ncmFudHMgY3JlYXRlOmNsaWVudF9ncmFudHMgZGVsZXRlOmNsaWVudF9ncmFudHMgdXBkYXRlOmNsaWVudF9ncmFudHMgcmVhZDp1c2VycyB1cGRhdGU6dXNlcnMgZGVsZXRlOnVzZXJzIGNyZWF0ZTp1c2VycyByZWFkOnVzZXJzX2FwcF9tZXRhZGF0YSB1cGRhdGU6dXNlcnNfYXBwX21ldGFkYXRhIGRlbGV0ZTp1c2Vyc19hcHBfbWV0YWRhdGEgY3JlYXRlOnVzZXJzX2FwcF9tZXRhZGF0YSBjcmVhdGU6dXNlcl90aWNrZXRzIHJlYWQ6Y2xpZW50cyB1cGRhdGU6Y2xpZW50cyBkZWxldGU6Y2xpZW50cyBjcmVhdGU6Y2xpZW50cyByZWFkOmNsaWVudF9rZXlzIHVwZGF0ZTpjbGllbnRfa2V5cyBkZWxldGU6Y2xpZW50X2tleXMgY3JlYXRlOmNsaWVudF9rZXlzIHJlYWQ6Y29ubmVjdGlvbnMgdXBkYXRlOmNvbm5lY3Rpb25zIGRlbGV0ZTpjb25uZWN0aW9ucyBjcmVhdGU6Y29ubmVjdGlvbnMgcmVhZDpyZXNvdXJjZV9zZXJ2ZXJzIHVwZGF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGRlbGV0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGNyZWF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIHJlYWQ6ZGV2aWNlX2NyZWRlbnRpYWxzIHVwZGF0ZTpkZXZpY2VfY3JlZGVudGlhbHMgZGVsZXRlOmRldmljZV9jcmVkZW50aWFscyBjcmVhdGU6ZGV2aWNlX2NyZWRlbnRpYWxzIHJlYWQ6cnVsZXMgdXBkYXRlOnJ1bGVzIGRlbGV0ZTpydWxlcyBjcmVhdGU6cnVsZXMgcmVhZDpydWxlc19jb25maWdzIHVwZGF0ZTpydWxlc19jb25maWdzIGRlbGV0ZTpydWxlc19jb25maWdzIHJlYWQ6ZW1haWxfcHJvdmlkZXIgdXBkYXRlOmVtYWlsX3Byb3ZpZGVyIGRlbGV0ZTplbWFpbF9wcm92aWRlciBjcmVhdGU6ZW1haWxfcHJvdmlkZXIgYmxhY2tsaXN0OnRva2VucyByZWFkOnN0YXRzIHJlYWQ6dGVuYW50X3NldHRpbmdzIHVwZGF0ZTp0ZW5hbnRfc2V0dGluZ3MgcmVhZDpsb2dzIHJlYWQ6c2hpZWxkcyBjcmVhdGU6c2hpZWxkcyBkZWxldGU6c2hpZWxkcyB1cGRhdGU6dHJpZ2dlcnMgcmVhZDp0cmlnZ2VycyByZWFkOmdyYW50cyBkZWxldGU6Z3JhbnRzIHJlYWQ6Z3VhcmRpYW5fZmFjdG9ycyB1cGRhdGU6Z3VhcmRpYW5fZmFjdG9ycyByZWFkOmd1YXJkaWFuX2Vucm9sbG1lbnRzIGRlbGV0ZTpndWFyZGlhbl9lbnJvbGxtZW50cyBjcmVhdGU6Z3VhcmRpYW5fZW5yb2xsbWVudF90aWNrZXRzIHJlYWQ6dXNlcl9pZHBfdG9rZW5zIGNyZWF0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIGRlbGV0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIHJlYWQ6Y3VzdG9tX2RvbWFpbnMgZGVsZXRlOmN1c3RvbV9kb21haW5zIGNyZWF0ZTpjdXN0b21fZG9tYWlucyByZWFkOmVtYWlsX3RlbXBsYXRlcyBjcmVhdGU6ZW1haWxfdGVtcGxhdGVzIHVwZGF0ZTplbWFpbF90ZW1wbGF0ZXMgcmVhZDptZmFfcG9saWNpZXMgdXBkYXRlOm1mYV9wb2xpY2llcyByZWFkOnJvbGVzIGNyZWF0ZTpyb2xlcyBkZWxldGU6cm9sZXMgdXBkYXRlOnJvbGVzIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIn0.TmO7BtHu66ZLuXcVGwMvFLY0BfaBXLo5HigoOKBCGFqBddfCYIIEV9pg_UyYdRlU3oU-U5pnGr_7fuKa-qzFCwfY6XQGhEIANcbE4R51PgJAjYirlaavc-NB9-VloZMvQ2AFaBEBkpmnsTGjevmjtiZuhmCI3i_iR9609q_ZzFE-dREWqh8iWevot-F9hlp-jMJchGy5CDx84toaC8qHQRSBcPPBJRuOwEuN7CzdoiDNSUwgmqqITi9_7eB1_1mq-Y9-NFgNM1UpDwKQFXbCzVweJZiHyPdrJ9-4zXU8fNxnVNfVhUPe7Hz_EpOXvP9_lg8Txqc6g9ZSx7ZVwDBjbw'
        },
        body:
        {
            connection: "Username-Password-Authentication",
            email: username,
            password: pass,
            email_verified: false,
            verify_email: false
        },
        json: true
    };

    rp(options)
    .then(function (body) {
        console.log("post worked" + body);
        //res.render('info', parsedBody.displayName);
        res.send(body);
    })
    .catch(function (error) {
        console.log("info could not load error is " + error);
    });
        
});


router.post('/login', function(req, res){
    const username = req.body.username;
    const pass = req.body.password;

    var options = {
        method: 'POST',
        url: 'https://wk8jwt.auth0.com/oauth/token',
        headers: {'content-type': 'application/json'},
        body:
        {
            scope: 'openid',
            grant_type: 'password',
            username: username,
            password: pass,
            client_id: 'BOq4CsJC1D0RUXsNhz5LdPx1GrZ31gzG',
            client_secret: 'bUrWmH93UDSJUIHNdhWzkdTcQPyaamSjw7kw-6eNSKjC9mwtPRsC3kSaTrWZWyCT'
        },
        json: true
    };

    rp(options)
    .then(function (body) {
        console.log("post worked" + body);
        //res.render('info', parsedBody.displayName);
        res.send(body);
    })
    .catch(function (error) {
        console.log("info could not load error is " + error);
    });
        
});


//GET list of slips
router.get('/wish_lists', function(req, res){
    const wish_lists = get_wish_lists(req)
    .then( (slips) => {
        //console.log(slips);
        res.status(200).json(slips);
    });
});


//GET list of ships
router.get('/wish_list', function(req, res){
    const accepts = req.accepts(['application/json']);
    if(!accepts){
            res.status(406).send('Not Acceptable');
        }
    else{
        const wish_list = get_wish_list(req)
	   .then( (wish_list) => {
        //console.log(ships);
        res.status(200).json(wish_list);
     });
    }
});

router.get('/users/:userid/wish_lists', checkJwt, function(req, res){
    const accepts = req.accepts(['application/json']);
    const u = req.params.userid;
    if(!accepts){
            res.status(406).send('Not Acceptable');
        }
    else if (u === req.user.name) {
       const wish_lists = get_wish_lists_by_user(req.user.name)
        .then( (wish_lists) => {
        res.status(200).json(wish_lists);
    });
    }
});

//users: first name, last name, birthdate 
//wish_lists: name, wish_list date, category
//items: name, price, department

//POST to create new ship
router.post('/items', function(req, res){
    //console.log(req.body);
    //console.log(typeof req.body.name);
    //console.log(typeof req.body.length);
    if (!((typeof req.body.name == 'string') && (typeof req.body.price == 'number')
     && (typeof req.body.department == 'string'))){
        res.status(400).send("invalid info");
    }
    else{
    var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/items/';
    const accepts = req.accepts(['application/json']);
    if(req.get('content-type') !== 'application/json'){
        res.status(415).send('The server only accepts application/json data.');
    }
    if(!accepts){
            res.status(406).send('Not Acceptable');
    }
    post_item(req.body.name, req.body.price, req.body.department)
        .then( key => 
        {
            res.location(reqUrl + key.id);
            res.status(201).send('{ "id": ' + key.id + ' }');
        });
    }
});

//POST to create new ship
router.post('/wish_list', checkJwt, function(req, res){
    //console.log(req.body);
    //console.log(typeof req.body.name);
    //console.log(typeof req.body.length);
    if (!((typeof req.body.name == 'string') && (typeof req.body.date == 'string')
     && (typeof req.body.type == 'string'))){
        res.status(400).send("invalid info");
    }
    else{
    var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/wish_lists/';
    const accepts = req.accepts(['application/json']);
    if(req.get('content-type') !== 'application/json'){
        res.status(415).send('The server only accepts application/json data.');
    }
    if(!accepts){
            res.status(406).send('Not Acceptable');
    }
    post_wish_list(req.body.name, req.body.date, req.body.type, req.user.name)
        .then( key => 
        {
            res.location(reqUrl + key.id);
            res.status(201).send('{ "id": ' + key.id + ' }');
        });
    }
});

//GET list of cargo
router.get('/items', function(req, res){
    const items = get_all_items(req)
    .then( (items) => {
        //console.log(slips);
        res.status(200).json(items);
    });
});

//GET specific ship
router.get('/wish_lists/:id', function(req, res){
    //add 404 not found cases
    //add 415 cases
   
    findObject(req.params.id, WISH_LIST).then(result => {
        const accepts = req.accepts(['application/json', 'text/html']);
        if (result === true){
            get_wish_list(req.params.id, req).then( (wish_list) => {
        //console.log(ship);y
        if(!accepts){
            res.status(406).send('Not Acceptable');
        }
        else if(accepts === 'application/json'){
            res.status(200).json(wish_list);
        }
        /*if (ship.id){
            res.status(200).json(ship);
        }*/
        else if(accepts === 'text/html'){
            res.set('Content-Type', 'text/html');
            res.status(200).json(wish_list);
        }
        else{
            res.status(500).send("There was an error with the content type");
        }
        
    });
        }
        else{
            res.status(404).end();
        }
    });
    
});

//GET specific ship
router.get('/items/:id', function(req, res){
    //add 404 not found cases
    //add 415 cases
   
    findObject(req.params.id, ITEM).then(result => {
        const accepts = req.accepts(['application/json', 'text/html']);
        if (result === true){
            get_item(req.params.id, req).then( (item) => {
        //console.log(ship);y
        if(!accepts){
            res.status(406).send('Not Acceptable');
        }
        else if(accepts === 'application/json'){
            res.status(200).json(item);
        }
        /*if (ship.id){
            res.status(200).json(ship);
        }*/
        else if(accepts === 'text/html'){
            res.set('Content-Type', 'text/html');
            res.status(200).json(item);
        }
        else{
            res.status(500).send("There was an error with the content type");
        }
        
    });
        }
        else{
            res.status(404).end();
        }
    });
    
});

//PUT to edit specific ship
router.put('/wish_lists/:id', function(req, res){
    if (!((typeof req.body.name == 'string') && (typeof req.body.type == 'string')
     && (typeof req.body.date== 'string'))){
        res.status(400).end();
    }
    else {
    var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/wish_lists/';
    findObject(req.params.id, WISH_LIST).then(result => {
        if (result === true){
            if(req.get('content-type') !== 'application/json'){
                res.status(415).send('The server only accepts application/json data.');
            }
            put_wish_list(req.params.id, req.body.name, req.body.type, req.body.date)
            .then(() =>
                {
                    var location = reqUrl + req.params.id;
                    res.location(location);
                    res.status(303).end();
                });
        }
        else{
            res.status(404).end();
        }
    });
}
    
});

//delete specific ship
router.delete('/wish_lists/:id', function(req, res){
    //console.log('test');
    findObject(req.params.id, WISH_LIST).then((result) => {
        //console.log("logging result " + result);
       if (result){
            //console.log('deleting ship');
            delete_wish_list(req.params.id).then(res.status(204).end());
        }
        else{
            res.status(404).end();
        }
    });
    
});

//delete all ships
router.delete('/wish_lists', function(req, res){
    //res.set('Accept', 'GET, POST');
    //res.status(405).end();
    delete_all_wish_lists().then(res.status(200).end());
});

//add cargo to ship
router.put('/wish_lists/:wish_list_id/items/:item_id', function(req, res){
        add_item(req.params.wish_list_id, req.params.item_id).then( (value) => {
            if (value){
                res.status(200).end();
            }
            else{
                //return if slip is already taken
                res.status(403).end('cargo already on another ship');
            }
        }); 
});

//remove cargo from ship
router.delete('/ships/:ship_id/cargo/:cargo_id', function(req, res){
    unload(req.params.ship_id, req.params.cargo_id).then(res.status(200).end());
});


//delete all ships
router.put('/ships', function(req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});
/* ------------- End Ship Controller Functions ------------- */

/*//PUT to edit specific ship
router.get('/ships/:id/cargo', function(req, res){
    get_ship_cargo(req.params.id, req).then( (cargo) => {
    res.status(200).json(cargo);
        //res.status(200).send("invalid info");
    });
});

//remove ship from slip
router.delete('/slips/:slip_id/ships/:ship_id', function(req, res){
    undock(req.params.slip_id, req.params.ship_id).then(res.status(200).end());
});

//add ship to slip
router.post('/slips/:slip_id/ships/:ship_id', function(req, res){
    if(typeof req.body.arrival_date == 'string'){
        dock(req.params.slip_id, req.params.ship_id, req.body.arrival_date).then( (value) => {
            //console.log("printing value " + value);
            if (value){
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

//add cargo to ship
router.post('/ships/:ship_id/cargo/:cargo_id', function(req, res){
    if(typeof req.body.delivery_date == 'string'){
        load(req.params.ship_id, req.params.cargo_id, req.body.delivery_date).then( (value) => {
            if (value){
                res.status(200).end();
            }
            else{
                //return if slip is already taken
                res.status(403).end('cargo already on another ship');
            }
        })
    }
    else{
        res.status(200).send('invalid info');
    }
  
});

//remove cargo from ship
router.delete('/ships/:ship_id/cargo/:cargo_id', function(req, res){
    unload(req.params.ship_id, req.params.cargo_id).then(res.status(200).end());
});


//add cargo
router.post('/cargo', function(req, res){
    //console.log(req.body);
    //console.log(typeof req.body.name);
    //console.log(typeof req.body.length);
    if ((typeof req.body.weight == 'number')
     && (typeof req.body.content == 'string')) {
        post_cargo(req.body.weight, req.body.content, req.body.delivery_date )
        .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')});
    }
    else{
        res.status(200).send("invalid info");
    }
});

//GET list of slips
router.get('/slips', function(req, res){
    const slips = get_slips(req)
    .then( (slips) => {
        //console.log(slips);
        res.status(200).json(slips);
    });
});

//GET list of cargo
router.get('/cargo', function(req, res){
    const cargo = get_all_cargo(req)
    .then( (cargo) => {
        //console.log(slips);
        res.status(200).json(cargo);
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
        get_slip(req.params.id, req).then( (slip) => {
        //console.log(slip);
        res.status(200).json(slip);
    });
});

//get cargo info
router.get('/cargo/:id', function(req, res){
    get_cargo(req.params.id, req).then( (cargo) => {
        //console.log(ship);
        res.status(200).json(cargo);
    });
});

//PUT to edit specific slip
router.put('/cargo/:id', function(req, res){
    if ((typeof req.body.weight == 'number') && (typeof req.body.content == 'string')
        && ((typeof req.body.delivery_date == 'string') || (typeof req.body.delivery_date == 'undefined'))) {
        put_cargo(req.params.id, req.body.weight, req.body.content, req.body.delivery_date)
        .then(res.status(200).end());
    }
    else{
        res.status(200).send("invalid info");
    }
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



//delete specific slip
router.delete('/slips/:id', function(req, res){
    delete_slip(req.params.id).then(res.status(200).end());
});

//delete cargo
router.delete('/cargo/:id', function(req, res){
    delete_cargo(req.params.id).then(res.status(200).end());
});


//delete all ships
router.delete('/cargo', function(req, res){
    delete_all_cargo().then(res.status(200).end());
});

//delete all slips
router.delete('/slips', function(req, res){
    delete_all_slips().then(res.status(200).end());
});

*/

/* ------------- End Controller Functions ------------- */

app.use('', router);
//app.use('/user', user);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});