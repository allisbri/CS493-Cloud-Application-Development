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

const projectId = 'week6ships';
const datastore = new Datastore({projectId:projectId});

const SHIP = "Ship";
const SLIP = "Slip";
const CARGO = "Cargo";

const router = express.Router();

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
/* ------------- Begin Lodging Model Functions ------------- */
//creates a new ship
function post_ship(name, type, length){
    var key = datastore.key(SHIP);
	const new_ship = {"name": name, "type": type, "length": length};
	return datastore.save({"key":key, "data":new_ship}).then(() => {return key});
}


//returns a list of all ship entities
function get_ships(req){
    var shipQuery = datastore.createQuery(SHIP);
    var cargoQuery = datastore.createQuery(CARGO);
    var all = {};
    var path = "/ships/"
    if (Object.keys(req.query).includes("cursor")){
        shipQuery = shipQuery.start(req.query.cursor);
    }
    return datastore.runQuery(shipQuery).then( (queryResults) => {
            //console.log("printing end cursor from get ships " + queryResults[1].endCursor);
            queryResults[0].map(fromDatastore);
            addSelfURLs(queryResults[0], "ships", req);
            /*return datastore.runQuery(cargoQuery).then( (cargoResults) => {
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
                    }*/
                    return queryResults[0];
                    //console.log("printing query Results[0][i] " + queryResults[0][i]);
                });
                //all.items = queryResults[0];
                //all.next = addNextURL(queryResults[1], req, path, "cursor");
                
       // });

}

/*function appendShipCargo(ship){
    //create query
    var query = datastore
    .createQuery(CARGO)
    .filter('carrier', '=', ship.id);
    var cargo = [];
    return datastore.runQuery(query).then( (queryResults) => {
            //console.log("printing ship cargo query results " + queryResults[0]);

            //var ind_cargo = {};
            queryResults[0].map(fromDatastore);
            addSelfURLs(queryResults[0], "cargo", req);
            for (var i = 0; i < queryResults[0].length; i++){
                cargo[i].id = queryResults[0][i].id;
                cargo[i].self = queryResults[0][i].self;
            }
            console.log("printing new cargo array" + cargo);
            return cargo;
        });
    //append cargo array to ship
}*/

//creates a new cargo
function post_cargo(weight, content, delivery_date){
    var key = datastore.key(CARGO);
    const new_cargo = {"weight": weight, "content": content, "delivery_date": delivery_date};
    return datastore.save({"key":key, "data":new_cargo}).then(() => {return key});
}

//gets cargo data singular
function get_cargo(id, req){
    var briefShip = {};
    var key = datastore.key([CARGO, parseInt(id,10)]);
    return datastore.get(key).then(results => {
        const entity = results[0];
        if (entity.carrier){
            const sId = entity.carrier;
            var shipKey = datastore.key([SHIP, parseInt(sId,10)]);
            return datastore.get(shipKey).then((ship) => {
                briefShip.id = entity.carrier;
                briefShip.name = ship[0].name;
                addSelfURL(briefShip, "ships", req);
                entity.carrier = briefShip;
                entity.id = id;
                addSelfURL(entity, "cargo", req);
                return entity;
            });
        }
        else{
            entity.id = id;
            addSelfURL(entity, "cargo", req);
            return entity;
        }
    });       
}


//gets ship singular
function get_ship(id, req){
    //returns undefined if id does not exist
        const key = datastore.key([SHIP, parseInt(id,10)]);
        //console.log("logging key" + key);
        //var cargoQuery = datastore.createQuery(CARGO);
        return datastore.get(key).then(results => {
            //returns entity if id does exist
            const entity = results[0];
            entity.id = id;
            //entity.cargo = [];
            addSelfURL(entity, "ships", req);
            //return datastore.runQuery(cargoQuery).then( (cargoResults) => {
                //cargoResults[0].map(fromDatastore);
                //for (var i = 0; i < cargoResults[0].length; i++){
                    //if (cargoResults[0][i].carrier === entity.id){
                       // var tempCargo = new Object();
                        //tempCargo.id = cargoResults[0][i].id;
                        //addSelfURL(tempCargo, "cargo", req);
                        //entity.cargo.push(tempCargo);
                    //}
                //}
                return entity;
            //});
    });
}


//creates new slip
function post_slip(number){
    var key = datastore.key(SLIP);
    const new_slip = {"number": number, "current_boat": '', "arrival_date": ''};
    return datastore.save({"key":key, "data":new_slip}).then(() => {return key});
}

//returns list of all slip entities
function get_slips(req){
    const slipQuery = datastore.createQuery(SLIP);
    return datastore.runQuery(slipQuery).then( (results) => {
            results[0].map(fromDatastore);
            for (var i = 0; i < results[0].length; i++){
                
                addSelfURL(results[0][i], "slips", req); 
            }
            return results[0];
        });
}

//returns list of cargo on ship
function get_ship_cargo(id, req){
    var query = datastore
    .createQuery(CARGO)
    .filter('carrier', '=', id)
    .limit(3);
    const all = {};
    var path = "/ships/" + id + "/cargo";
    if (Object.keys(req.query).includes("cursor")){
        query = query.start(req.query.cursor);
    }
    return datastore.runQuery(query).then( (queryResults) => {
            //console.log("printing ship cargo query results " + queryResults[0]);
            queryResults[0].map(fromDatastore);
            addSelfURLs(queryResults[0], "cargo", req);
            all.items = queryResults[0];
            all.next = addNextURL(queryResults[1], req, path, "cursor");
            return all;
        });
}

//returns list of all cargo
function get_all_cargo(req){
    var query = datastore.createQuery(CARGO).limit(3);
    var shipQuery = datastore.createQuery(SHIP);
    var all = {};

    if (Object.keys(req.query).includes("cursor")){
        query = query.start(req.query.cursor);
    }
    return datastore.runQuery(query).then( (queryResults) => {
            queryResults[0].map(fromDatastore);
            addSelfURLs(queryResults[0], "cargo", req);
            return datastore.runQuery(shipQuery).then((shipResults) => {
                shipResults[0].map(fromDatastore);
                addSelfURLs(shipResults[0], "ships", req);
                for(var i = 0; i < queryResults[0].length; i++){
                     var ship = new Object();
                    for(var j = 0; j < shipResults[0].length; j++){
                        if (queryResults[0][i].carrier === shipResults[0][j].id){
                            ship.id = shipResults[0][j].id;
                            ship.name = shipResults[0][j].name;
                            ship.self = shipResults[0][j].self;
                            queryResults[0][i].carrier = ship;
                        }

                    }
                }
            all.items = queryResults[0];
            all.next = addNextURL(queryResults[1], req, "cargo", "cursor");
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

//Changes all data in a slip to passed in data
function put_slip(id, number, current_boat, arrival_date){
    const key = datastore.key([SLIP, parseInt(id,10)]);
    const current_slip = {"number": number, "current_boat": current_boat, "arrival_date": arrival_date};
    return datastore.save({"key": key, "data": current_slip});
}

//Changes all data in cargo item
function put_cargo(id, weight, content, delivery_date){
    const key = datastore.key([CARGO, parseInt(id,10)]);
    const current_cargo = {"weight": weight, "content": content, "delivery_date": delivery_date};
    return datastore.save({"key": key, "data": current_cargo});
}

//Changes all data in ship to passed in data
function put_ship(id, name, type, length){
    const key = datastore.key([SHIP, parseInt(id,10)]);
    const current_ship = {"name": name, "type": type, "length": length};
    return datastore.save({"key": key, "data": current_ship});
}

//deletes ship and removes it from slip if it is docked
function delete_ship(id, req){
    const key = datastore.key([SHIP, parseInt(id,10)]);
    const ship = datastore.get(key);
    const slips = get_slips(req);
    const blank1 = '';
    const blank2 = '';
    const carrier = '';
    const delivery_date = '';
    //console.log("test!");
    const slipQuery = datastore.createQuery(SLIP);
    //added return 10-27-18
    const cargoQuery = datastore.createQuery(CARGO);

    return datastore.runQuery(slipQuery).then( (results) => {
        //gcloud documentation
        const slips = results[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < slips.length; i++){
        //console.log("in loop");
            if (slips[i].current_boat == id){
                //console.log("found boat");
                 put_slip(slips[i].id, slips[i].number, blank1, blank2);
            }
        }
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
    });  
}

//deletes cargo
function delete_cargo(id){
    //deletes slip
    const key = datastore.key([CARGO, parseInt(id,10)]);
    return datastore.delete(key);
}

//deletes all cargo
function delete_all_cargo(){
    const cargoQuery = datastore.createQuery(CARGO);
    //got error unless used return here. Has something to do with promises, but not sure
    //exactly what the problem is
    return datastore.runQuery(cargoQuery).then( (results) => {
        //gcloud documentation
        const cargo = results[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < cargo.length; i++){
        //console.log("in loop");
            //console.log("found boat");
            delete_cargo(cargo[i].id);
        }
        //Did not complete request unless return statement was here. Seems that
        //promises require this, but needs more investigation. *This was actually
        //an issue with the response.
        //return true;
    });
}

//deletes all slips
function delete_all_slips(){
    const slipQuery = datastore.createQuery(SLIP);
    //got error unless used return here. Has something to do with promises, but not sure
    //exactly what the problem is
    return datastore.runQuery(slipQuery).then( (results) => {
        //gcloud documentation
        const slips = results[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < slips.length; i++){
        //console.log("in loop");
            //console.log("found boat");
            delete_slip(slips[i].id);
        }
        //Did not complete request unless return statement was here. Seems that
        //promises require this, but needs more investigation. *This was actually
        //an issue with the response.
        //return true;
    });
}

//deletes all ships
function delete_all_ships(){
    const shipQuery = datastore.createQuery(SHIP);
    //got error unless used return here. Has something to do with promises, but not sure
    //exactly what the problem is
    return datastore.runQuery(shipQuery).then( (results) => {
        //gcloud documentation
        const ships = results[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < ships.length; i++){
        //console.log("in loop")
            delete_ship(ships[i].id);
        }
        //Did not complete request unless return statement was here. Seems that
        //promises require this, but needs more investigation. *This was actually
        //an issue with the response.
        //return true;
    });
}

//deletes slip
function delete_slip(id){
    const key = datastore.key([SLIP, parseInt(id,10)]);
    return datastore.delete(key);
}

//loads cargo on ship
function load(ship_id, cargo_id, delivery_date){
    const key = datastore.key([CARGO, parseInt(cargo_id,10)]);
    return datastore.get(key).then( result => {
        const cargo = result[0];
        if (!(cargo.carrier)){
            cargo.carrier = ship_id;
            cargo.delivery_date = delivery_date;
            return datastore.save({"key":key, "data":cargo});
            //(return true);
           // changed 10/27/18
            //return true;
        }
        else {
            return false;
        }
    });
}


//docks ship to passed in slip
function dock(slip_id, ship_id, arrival_date){
    const key = datastore.key([SLIP, parseInt(slip_id,10)]);
    return datastore.get(key).then( result => {
        const slip = result[0];
        //console.log("printing slip.current_boat " + slip.current_boat);
        if (!(slip.current_boat)){
            //console.log("in if condition !slip.currentboat");
            slip.current_boat = ship_id;
            slip.arrival_date = arrival_date;
            return datastore.save({"key":key, "data":slip});
        }
        else {
            return false;
        }
    });
}

//undocks ship from passed in slip
function undock(slip_id, ship_id){
     const key = datastore.key([SLIP, parseInt(slip_id,10)]);
    return datastore.get(key).then(result => {
        const slip = result[0];
        if (slip.current_boat == ship_id){
            slip.current_boat = undefined;
            slip.arrival_date = undefined;
            return datastore.save({"key":key, "data":slip});
        }
    });
}

//unloads cargo from ship
function unload(ship_id, cargo_id){
     const key = datastore.key([CARGO, parseInt(cargo_id,10)]);
    return datastore.get(key).then(result => {
        const cargo = result[0];
        if (cargo.carrier == ship_id){
            cargo.carrier = '';
            cargo.delivery_date = '';
            return datastore.save({"key":key, "data":cargo});
        }
    });
}
/* ------------- End Model Functions ------------- */

/* ------------- Begin Ship Controller Functions ------------- */
//GET list of ships
router.get('/ships', function(req, res){
    const accepts = req.accepts(['application/json']);
    if(!accepts){
            res.status(406).send('Not Acceptable');
        }
    else{
        const ships = get_ships(req)
	   .then( (ships) => {
        //console.log(ships);
        res.status(200).json(ships);
     });
    }
});

//POST to create new ship
router.post('/ships', function(req, res){
    //console.log(req.body);
    //console.log(typeof req.body.name);
    //console.log(typeof req.body.length);
    if (!((typeof req.body.name == 'string') && (typeof req.body.type == 'string')
     && (typeof req.body.length == 'number'))){
        res.status(400).send("invalid info");
    }
    else{
    var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/ships/';
    const accepts = req.accepts(['application/json']);
    if(req.get('content-type') !== 'application/json'){
        res.status(415).send('The server only accepts application/json data.');
    }
    if(!accepts){
            res.status(406).send('Not Acceptable');
    }
    post_ship(req.body.name, req.body.type, req.body.length)
        .then( key => 
        {
            res.location(reqUrl + key.id);
            res.status(201).send('{ "id": ' + key.id + ' }');
        });
    }
});

//GET specific ship
router.get('/ships/:id', function(req, res){
    //add 404 not found cases
    //add 415 cases
   
    findObject(req.params.id, SHIP).then(result => {
        const accepts = req.accepts(['application/json', 'text/html']);
        if (result === true){
            get_ship(req.params.id, req).then( (ship) => {
        //console.log(ship);
        if(!accepts){
            res.status(406).send('Not Acceptable');
        }
        else if(accepts === 'application/json'){
            res.status(200).json(ship);
        }
        /*if (ship.id){
            res.status(200).json(ship);
        }*/
        else if(accepts === 'text/html'){
            res.set('Content-Type', 'text/html');
            res.status(200).send(new Buffer(`<ul>
                                    <li>name</li> 
                                    <li>${ship.name}</li> 
                                    <li>id</li> 
                                    <li>${ship.id}</li> 
                                    <li>type</li> 
                                    <li>${ship.type}</li> 
                                </ul>`
                                ));
            //res.status(200).send(json2html(ship).slice(1,-1);
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
router.put('/ships/:id', function(req, res){
    if (!((typeof req.body.name == 'string') && (typeof req.body.type == 'string')
     && (typeof req.body.length == 'number'))){
        res.status(400).end();
    }
    else {
    var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/ships/';
    findObject(req.params.id, SHIP).then(result => {
        if (result === true){
            if(req.get('content-type') !== 'application/json'){
                res.status(415).send('The server only accepts application/json data.');
            }
            put_ship(req.params.id, req.body.name, req.body.type, req.body.length)
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
router.delete('/ships/:id', function(req, res){
    //console.log('test');
    findObject(req.params.id, SHIP).then((result) => {
        //console.log("logging result " + result);
       if (result){
            //console.log('deleting ship');
            delete_ship(req.params.id).then(res.status(204).end());
        }
        else{
            res.status(404).end();
        }
    });
    
});

//delete all ships
router.delete('/ships', function(req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
    //delete_all_ships().then(res.status(200).end());
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

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});