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
            return fromDatastore(entity);
    });
}

//used https://cloud.google.com/datastore/docs/concepts/entities
//for help with this function
function get_ship(id){
    //returns undefined if id does not exist
        const key = datastore.key([SHIP, parseInt(id,10)]);
        console.log("logging key" + key);
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
    return datastore.delete(key);
}

function delete_slip(id){
    const key = datastore.key([SLIP, parseInt(id,10)]);
    return datastore.delete(key);
}

function dock(slip_id, ship_id, arrival_date){
    const key = datastore.key([SLIP, parseInt(slip_id,10)]);
    datastore.get(key).then(result => {
        const slip = result[0];
        if (!(slip.current_boat)){
            slip.current_boat = ship_id;
            slip.arrival_date = arrival_date;
            return datastore.save({"key":key, "data":slip});
        }
        else {
            return undefined;
        }
    });
}

function undock(slip_id, ship_id){
     const key = datastore.key([SLIP, parseInt(slip_id,10)]);
    datastore.get(key).then(result => {
        const slip = result[0];
        if (!(slip.current_boat == ship_id)){
            slip.current_boat = '';
            slip.arrival_date = '';
            return datastore.save({"key":key, "data":slip});
        }
        else {
            return undefined;
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
    console.log(req.body);
    post_ship(req.body.name, req.body.type, req.body.length)
    .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
});


router.get('/slips', function(req, res){
    const slips = get_slips()
    .then( (slips) => {
        console.log(slips);
        res.status(200).json(slips);
    });
});

router.post('/slips', function(req, res){
    console.log(req.body);
    post_slip(req.body.number)
    .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
});

router.get('/slips/:id', function(req, res){
        get_slip(req.params.id).then( (slip) => {
        console.log(slip);
        res.status(200).json(slip);
    });
});

router.get('/ships/:id', function(req, res){
    get_ship(req.params.id).then( (ship) => {
        console.log(ship);
        res.status(200).json(ship);
    });
});


router.put('/slips/:id', function(req, res){
    put_slip(req.params.id, req.body.number, req.body.current_boat, req.body.arrival_date)
    .then(res.status(200).end());
});

router.put('/ships/:id', function(req, res){
    put_ship(req.params.id, req.body.name, req.body.type, req.body.length)
    .then(res.status(200).end());
});

router.delete('slips/:id', function(req, res){
    delete_slip(req.params.id).then(res.status(200).end());
});

router.delete('ships/:id', function(req, res){
    delete_ship(req.params.id).then(res.status(200).end());
});

router.delete('slips/:slip_id/ships/:ship_id', function(req, res){
    undock(req.params.slip_id, req.params.ship_id).then(res.status(200).end());
});

router.post('slips/:slip_id/ships/:ship_id', function(req, res){
   dock(req.params.slip_id, req.params.ship_id, arrival_date).then( 
    key => {res.status(200).send('{ "id": ' + key.id + ' }')}, () =>
        res.status(403).send('That slip is occupied')) ;
});


/* ------------- End Controller Functions ------------- */

app.use('', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});