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
    const new_slip = {"number": number};
    return datastore.save({"key":key, "data":new_slip}).then(() => {return key});
}

function get_slip(){
    const slipQuery = datastore.createQuery(SLIP);
    return datastore.runQuery(slipQuery).then( (entities) => {
            return entities[0].map(fromDatastore);
        });
}

function put_slip(id, number, current_boat, arrival_date){
    const key = datastore.key([SHIP, parseInt(id,10)]);
    const current_slip = {"number": number, "current_boat": current_boat, "arrival_date": arrival_date};
    return datastore.save({"key":key, "data":current_slip);
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
    post_ship(req.body.number)
    .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
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
    delete_slip(req.params.id).then(res.status(200).end())
});

router.delete('ships/:id', function(req, res){
    delete_ship(req.params.id).then(res.status(200).end())
});


/* ------------- End Controller Functions ------------- */

app.use('', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});