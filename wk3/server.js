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
function post_ship(name, type, length, state){
    var key = datastore.key(SHIP);
	const new_ship = {"name": name, "type": type, "length": length, "state": state};
	return datastore.save({"key":key, "data":new_ship}).then(() => {return key});
}

function get_ships(){
	const shipQuery = datastore.createQuery(SHIP);
	return datastore.runQuery(shipQuery).then( (entities) => {
			return entities[0].map(fromDatastore);
		});
}

function post_slip(number, current_boat, arrival_date, state){
    var key = datastore.key(SLIP);
    const new_slip = {"number": number, "current_boat": current_boat, "arrival_date": arrival_date};
    return datastore.save({"key":key, "data":new_slip}).then(() => {return key});
}

function get_slip(){
    const shipQuery = datastore.createQuery(SHIP);
    return datastore.runQuery(shipQuery).then( (entities) => {
            return entities[0].map(fromDatastore);
        });
}

function put_lodging(id, name, description, price){
    const key = datastore.key([LODGING, parseInt(id,10)]);
    const lodging = {"name": name, "description": description, "price": price};
    return datastore.save({"key":key, "data":lodging});
}

function delete_lodging(id){
    const key = datastore.key([LODGING, parseInt(id,10)]);
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
    post_ship(req.body.name, req.body.type, req.body.length, req.body.state)
    .then( key => {res.status(200).send('{ "id": ' + key.id + ' }')} );
});

router.put('/:id', function(req, res){
    put_lodging(req.params.id, req.body.name, req.body.description, req.body.price)
    .then(res.status(200));
});

router.delete('/:id', function(req, res){
    delete_lodging(req.params.id).then(res.status(200).end())
});

/* ------------- End Controller Functions ------------- */

app.use('', router);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});