const express = require('express');
const app = express();

const Datastore = require('@google-cloud/datastore');
const bodyParser = require('body-parser');

const projectId = 'service-218004';
const datastore = new Datastore({projectId:projectId});

const SHIP = "Ship";
const SLIP = "Slip";

const router = express.Router();

app.use(bodyParser.json());

//adds id to entity since it is not automatically provided by datastore
function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

function addURL(item){
    var url = 'http://localhost:8080/ships/';
    if (item.current_boat){
        item.boat_url = url + item.current_boat;
    }
    else{
        item.boat_url = '';
    }
}

/* ------------- Begin Lodging Model Functions ------------- */
function post_ship(name, type, length){
    var key = datastore.key(SHIP);
	const new_ship = {"name": name, "type": type, "length": length};
	return datastore.save({"key":key, "data":new_ship}).then(() => {return key});
}

function get_ships(){
	const shipQuery = datastore.createQuery(SHIP);
	return datastore.runQuery(shipQuery).then( (entities) => {
			return entities[0].map(fromDatastore);
		});
}

function post_slip(number){
    var key = datastore.key(SLIP);
    const new_slip = {"number": number, "current_boat": '', "arrival_date": ''};
    return datastore.save({"key":key, "data":new_slip}).then(() => {return key});
}

function get_slips(){
    const slipQuery = datastore.createQuery(SLIP);
    return datastore.runQuery(slipQuery).then( (entities) => {
            entities[0].map(addURL);
            return entities[0].map(fromDatastore);
        });
}

//used https://cloud.google.com/datastore/docs/concepts/entities
//for help with this function
function get_slip(id){
    //returns undefined if id does not exist
        const key = datastore.key([SLIP, parseInt(id,10)]);
        return datastore.get(key).then(results => {
            //returns entity if id does exist
            const entity = results[0];
            addURL(entity);
            return fromDatastore(entity);
    });
}

//used https://cloud.google.com/datastore/docs/concepts/entities
//for help with this function
function get_ship(id){
    //returns undefined if id does not exist
        const key = datastore.key([SHIP, parseInt(id,10)]);
        //console.log("logging key" + key);
        return datastore.get(key).then(results => {
            //returns entity if id does exist
            const entity = results[0];
            entity.id = id;
            return entity;
    });
}

function put_slip(id, number, current_boat, arrival_date){
    const key = datastore.key([SLIP, parseInt(id,10)]);
    const current_slip = {"number": number, "current_boat": current_boat, "arrival_date": arrival_date};
    return datastore.save({"key":key, "data":current_slip});
}

function put_ship(id, name, type, length){
    const key = datastore.key([SHIP, parseInt(id,10)]);
    const current_ship = {"name": name, "type": type, "length": length};
    return datastore.save({"key":key, "data":current_ship});
}

function delete_ship(id){
    const key = datastore.key([SHIP, parseInt(id,10)]);
    const ship = datastore.get(key);
    const slips = get_slips();
    const blank1 = '';
    const blank2 = '';
    //console.log("test!");
    const slipQuery = datastore.createQuery(SLIP);
    datastore.runQuery(slipQuery).then( (entities) => {
        //gcloud documentation
        const slips = entities[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < slips.length; i++){
        //console.log("in loop");
        if (slips[i].current_boat == id){
            console.log("found boat");
            put_slip(slips[i].id, slips[i].number, blank1, blank2);
        }
    }
    });
    
    return datastore.delete(key);
}

function delete_all_slips(){
    const slipQuery = datastore.createQuery(SLIP);
    //got error unless used return here. Has something to do with promises, but not sure
    //exactly what the problem is
    return datastore.runQuery(slipQuery).then( (entities) => {
        //gcloud documentation
        const slips = entities[0].map(fromDatastore);
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

function delete_all_ships(){
    const shipQuery = datastore.createQuery(SHIP);
    //got error unless used return here. Has something to do with promises, but not sure
    //exactly what the problem is
    return datastore.runQuery(shipQuery).then( (entities) => {
        //gcloud documentation
        const ships = entities[0].map(fromDatastore);
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


function delete_slip(id){
    const key = datastore.key([SLIP, parseInt(id,10)]);
    return datastore.delete(key);
}

function dock(slip_id, ship_id, arrival_date){
    const key = datastore.key([SLIP, parseInt(slip_id,10)]);
    return datastore.get(key).then( result => {
        const slip = result[0];
        if (!(slip.current_boat)){
            slip.current_boat = ship_id;
            slip.arrival_date = arrival_date;
            datastore.save({"key":key, "data":slip});
            return true;
        }
        else {
            return false;
        }
    });
}

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

router.get('/ships', function(req, res){
    const ships = get_ships()
	.then( (ships) => {
        console.log(ships);
        res.status(200).json(ships);
    });
});

router.post('/ships', function(req, res){
    //console.log(req.body);
    //console.log(typeof req.body.name);
    //console.log(typeof req.body.length);
    if ((typeof req.body.name == 'string') && (typeof req.body.type == 'string')
     && (typeof req.body.length == 'number')) {
        post_ship(req.body.name, req.body.type, req.body.length)
        .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')});
    }
    else{
        res.status(200).send("invalid info");
    }
});


router.get('/slips', function(req, res){
    const slips = get_slips()
    .then( (slips) => {
        //console.log(slips);
        res.status(200).json(slips);
    });
});

router.post('/slips', function(req, res){
    //console.log(req.body);
    if (typeof req.body.number == 'number') {
         post_slip(req.body.number)
        .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
    }
    /*else{
        res.status(403).send();
    }*/
});

router.get('/slips/:id', function(req, res){
        get_slip(req.params.id).then( (slip) => {
        //console.log(slip);
        res.status(200).json(slip);
    });
});

router.get('/ships/:id', function(req, res){
    get_ship(req.params.id).then( (ship) => {
        //console.log(ship);
        res.status(200).json(ship);
    });
});


router.put('/slips/:id', function(req, res){
    if ((typeof req.body.number == 'number') && (typeof req.body.current_boat == 'string')
        && (typeof req.body.arrival_date == string)) {
    put_slip(req.params.id, req.body.number, req.body.current_boat, req.body.arrival_date)
    .then(res.status(200).end());
    }
    /*else{
        res.status(403).end();
    }*/
});

router.put('/ships/:id', function(req, res){
    if ((typeof req.body.name == 'string') && (typeof req.body.type == 'string')
     && (typeof req.body.length == 'number')){
        put_ship(req.params.id, req.body.name, req.body.type, req.body.length)
        .then(res.status(200).end());
    }
    /*else{
        res.status(403).end();
    }*/
});

router.delete('/slips/:id', function(req, res){
    delete_slip(req.params.id).then(res.status(200).end());
});

router.delete('/ships/:id', function(req, res){
    delete_ship(req.params.id).then(res.status(200).end());
});

router.delete('/ships', function(req, res){
    delete_all_ships().then(res.status(200).end());
});

router.delete('/slips', function(req, res){
    delete_all_slips().then(res.status(200).end());
});

router.delete('/slips/:slip_id/ships/:ship_id', function(req, res){
    undock(req.params.slip_id, req.params.ship_id).then(res.status(200).end());
});

router.post('/slips/:slip_id/ships/:ship_id', function(req, res){
    if(typeof req.body.arrival_date == 'string'){
   dock(req.params.slip_id, req.params.ship_id, req.body.arrival_date).then( (value) => {
    if (value == true){
        res.status(200).end();
    }
    else{
        res.status(403).end();
    }
    })
}
/*else{
    res.status(403).end();
}*/
  
});


/* ------------- End Controller Functions ------------- */

app.use('', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});