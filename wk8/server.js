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

const PROJECT = "Project";
const SLIP = "Slip";
const EMPLOYEE = "Employee";

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

function check_relationship(employee_id, project_id){
    var key = datastore.key([EMPLOYEE, parseInt(id,10)]);
    return datastore.get(key).then((results) => {
        if (results[0].assignment === project_id){
            return 0;
            //equal assignment
        }
        else if (!results[0].assignment){
            return 1;
            //no assignment
        }
        else{
            return 2;
            //unequal assignment
        }
    });
}

//creates a new ship
function post_employee(name, job_title, department){
    var key = datastore.key(EMPLOYEE);
    const new_employee = {"name": name, "job_title": job_title, "department": department};
    return datastore.save({"key":key, "data":new_employee}).then(() => {return key});
}

//creates a new ship
function post_project(name, start_date, deadline, project_leader){
    var key = datastore.key(PROJECT);
	const new_project = {"name": name, "start_date": start_date, "deadline": deadline, "project_leader": project_leader};
	return datastore.save({"key":key, "data":new_project}).then(() => {return key});
}

//Changes all data in cargo item
function put_employee(id, name, job_title, department){
    const key = datastore.key([EMPLOYEE, parseInt(id,10)]);
    const employee = datastore.get(key);
    var assignment = {};

    if (employee.assignment){
        assignment = employee.assignment;
        const employee = {"name": name, "job_title": job_title, "department": department, "assignment": assignment};
    }
    else{
        const employee = {"name": name, "job_title": job_title, "department": department};
    }
    return datastore.save({"key": key, "data": employee});
}

//returns a list of all ship entities
function get_projects(req){
    var projects_query = datastore.createQuery(PROJECT).limit(5);
    var projects_query_l = datastore.createQuery(PROJECT);

    var employee_query = datastore.createQuery(EMPLOYEE);
    var all = {};
    var path = "/projects/"
    if (Object.keys(req.query).includes("cursor")){
        projects_query = projects_query.start(req.query.cursor);
    }
     return datastore.runQuery(projects_query_l).then( (queryResultsl) => {
       all.collection_size = queryResultsl[0].length;
        return datastore.runQuery(projects_query).then( (queryResults) => {
                //console.log("printing end cursor from get shaips " + queryResults[1].endCursor);
                queryResults[0].map(fromDatastore);
                addSelfURLs(queryResults[0], "projects", req);
                return datastore.runQuery(employee_query).then( (employeeResults) => {
                    employeeResults[0].map(fromDatastore);
                     addSelfURLs(employeeResults[0], "employees", req);
                    for (var i = 0; i < queryResults[0].length; i++){
                        queryResults[0][i].employees = [];
                        for (var j = 0; j < employeeResults[0].length; j++){
                            if (queryResults[0][i].id === employeeResults[0][j].assignment){
                                var emp= new Object();
                                emp.id = employeeResults[0][j].id;
                                emp.self = employeeResults[0][j].self;
                                queryResults[0][i].employees.push(emp);
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

//returns list of all cargo
function get_employees(req){
    var query = datastore.createQuery(EMPLOYEE).limit(5);
    var project_query = datastore.createQuery(PROJECT);
    var query_l = datastore.createQuery(EMPLOYEE);
    var all = {};

    if (Object.keys(req.query).includes("cursor")){
        query = query.start(req.query.cursor);
    }
    return datastore.runQuery(query).then( (queryResults) => {
        return datastore.runQuery(query_l).then( (query_lResults) => {
            all.collection_size = query_lResults[0].length;
            queryResults[0].map(fromDatastore);
            addSelfURLs(queryResults[0], "employees", req);
            return datastore.runQuery(project_query).then((project_results) => {
                project_results[0].map(fromDatastore);
                addSelfURLs(project_results[0], "wish_lists", req);
                for(var i = 0; i < queryResults[0].length; i++){
                     var project = new Object();
                    for(var j = 0; j < project_results[0].length; j++){
                        if (queryResults[0][i].assignment === project_results[0][j].id){
                            project.id = project_results[0][j].id;
                            project.name = project_results[0][j].name;
                            project.self = project_results[0][j].self;
                            queryResults[0][i].assignment = project;
                        }

                    }
                }
            all.items = queryResults[0];
            all.next = addNextURL(queryResults[1], req, "item", "cursor");
            return all;
            });
        });
    });

}

//gets cargo data singular
function get_employee(id, req){
    var brief_project = {};
    var key = datastore.key([EMPLOYEE, parseInt(id,10)]);
    return datastore.get(key).then(results => {
        const entity = results[0];
        if (entity.assignment){
            const sId = entity.assignment;
            var assignment_key = datastore.key([PROJECT, parseInt(sId,10)]);
            return datastore.get(assignment_key).then((assignment) => {
                brief_project.id = entity.assignment;
                brief_project.name = assignment[0].name;
                addSelfURL(brief_project, "projects", req);
                entity.assignment = brief_project;
                entity.id = id;
                addSelfURL(entity, "employees", req);
                return entity;
            });
        }
        else{
            entity.id = id;
            addSelfURL(entity, "projects", req);
            return entity;
        }
    });       
}




//gets ship singular
function get_project(id, req){
    //returns undefined if id does not exist
        const key = datastore.key([PROJECT, parseInt(id,10)]);
        //console.log("logging key" + key);
        var employeeQuery = datastore.createQuery(EMPLOYEE);
        return datastore.get(key).then(results => {
            //returns entity if id does exist
            const entity = results[0];
            entity.id = id;
            entity.employees = [];
            addSelfURL(entity, "projects", req);
            return datastore.runQuery(employeeQuery).then( (employeeResults) => {
                employeeResults[0].map(fromDatastore);
                for (var i = 0; i < employeeResults[0].length; i++){
                    if (employeeResults[0][i].assignment === entity.id){
                        var tempEmployee = new Object();
                        tempEmployee.id = employeeResults[0][i].id;
                        addSelfURL(tempEmployee, "employees", req);
                        entity.employees.push(tempEmployee);
                    }
                }
                return entity;
            });
    });
}

function get_projects_by_user(owner){
    const q = datastore.createQuery(PROJECT);
    return datastore.runQuery(q).then( (entities) => {
            return entities[0].map(fromDatastore).filter( item => item.project_leader === owner );
        });
}

//Changes all data in ship to passed in data
function put_project(id, name, start_date, deadline, user){
    const key = datastore.key([PROJECT, parseInt(id,10)]);
    const project = {"name": name, "start_date": start_date, "deadline": deadline, "project_leader": user};
    return datastore.save({"key": key, "data": project});
}

//deletes ship and removes it from slip if it is docked
function delete_project(id, req){
    const key = datastore.key([PROJECT, parseInt(id,10)]);
    const project = datastore.get(key);
    const employeeQuery = datastore.createQuery(EMPLOYEE);
        return datastore.runQuery(employeeQuery).then((employeeResults) =>{
            //console.log("after return");
            const employees = employeeResults[0].map(fromDatastore);
           // console.log("logging cargo" + cargo);
            for (var j = 0; j < employees.length; j++){
                if (employees[i].assignment === id){
                    unassign(id, employees[i].id);
                }
            }
            return datastore.delete(key);
        });
    //});  
}

//loads cargo on ship
function assign(project_id, employee_id){
    const key = datastore.key([EMPLOYEE, parseInt(employee_id,10)]);
    return datastore.get(key).then( result => {
        const employee = result[0];
        if (!(employee.assignment)){
            employee.assignment = project_id;
            return datastore.save({"key":key, "data":employee});
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
function delete_all_projects(){
    const projectQuery = datastore.createQuery(PROJECT);
    //got error unless used return here. Has something to do with promises, but not sure
    //exactly what the problem is
    return datastore.runQuery(projectQuery).then( (results) => {
        //gcloud documentation
        const projects = results[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < projects.length; i++){
        //console.log("in loop")
            delete_project(projects[i].id);
        }
        //Did not complete request unless return statement was here. Seems that
        //promises require this, but needs more investigation. *This was actually
        //an issue with the response.
        //return true;
    });
}

//deletes cargo
function delete_employee(id){
    //deletes slip
    const key = datastore.key([EMPLOYEE, parseInt(id,10)]);
    return datastore.delete(key);
}

//deletes all cargo
function delete_all_employees(){
    const employeeQuery = datastore.createQuery(EMPLOYEE);
    //got error unless used return here. Has something to do with promises, but not sure
    //exactly what the problem is
    return datastore.runQuery(employeeQuery).then( (results) => {
        //gcloud documentation
        const employees = results[0].map(fromDatastore);
        //console.log(slips.length);
        for (var i = 0; i < employees.length; i++){
        //console.log("in loop");
            //console.log("found boat");
            delete_employee(employees[i].id);
        }
        //Did not complete request unless return statement was here. Seems that
        //promises require this, but needs more investigation. *This was actually
        //an issue with the response.
        //return true;
    });
}

//unloads cargo from ship
function unassign(project_id, employee_id){
     const key = datastore.key([EMPLOYEE, parseInt(employee_id,10)]);
    return datastore.get(key).then(result => {
        const employee = result[0];
        if (employee.assignment == project_id){
            employee.assignment = '';
            return datastore.save({"key":key, "data":employee});
        }
    });
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Ship Controller Functions ------------- */

router.post('/users', function(req, res){
    const email = req.body.email;
    const pass = req.body.password;
    const nickname = req.body.nickname;
    const name = req.body.name;
    //console.log(username);
    var options = {
        method: 'POST',
        url: 'https://wk8jwt.auth0.com/api/v2/users',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik5USkdRelJEUWpWQlF6bEJNekV5TmtGR1FqRTNRelV5T0RaRVEwTkNOa00yTXprelJEZzJPUSJ9.eyJpc3MiOiJodHRwczovL3drOGp3dC5hdXRoMC5jb20vIiwic3ViIjoidk1VMWZCZzBDQzZHa1hkMk0wNnNYYzdoOVAyRXgyWmRAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vd2s4and0LmF1dGgwLmNvbS9hcGkvdjIvIiwiaWF0IjoxNTQzNzMzMDI2LCJleHAiOjE1NDYzMjUwMjYsImF6cCI6InZNVTFmQmcwQ0M2R2tYZDJNMDZzWGM3aDlQMkV4MlpkIiwic2NvcGUiOiJyZWFkOmNsaWVudF9ncmFudHMgY3JlYXRlOmNsaWVudF9ncmFudHMgZGVsZXRlOmNsaWVudF9ncmFudHMgdXBkYXRlOmNsaWVudF9ncmFudHMgcmVhZDp1c2VycyB1cGRhdGU6dXNlcnMgZGVsZXRlOnVzZXJzIGNyZWF0ZTp1c2VycyByZWFkOnVzZXJzX2FwcF9tZXRhZGF0YSB1cGRhdGU6dXNlcnNfYXBwX21ldGFkYXRhIGRlbGV0ZTp1c2Vyc19hcHBfbWV0YWRhdGEgY3JlYXRlOnVzZXJzX2FwcF9tZXRhZGF0YSBjcmVhdGU6dXNlcl90aWNrZXRzIHJlYWQ6Y2xpZW50cyB1cGRhdGU6Y2xpZW50cyBkZWxldGU6Y2xpZW50cyBjcmVhdGU6Y2xpZW50cyByZWFkOmNsaWVudF9rZXlzIHVwZGF0ZTpjbGllbnRfa2V5cyBkZWxldGU6Y2xpZW50X2tleXMgY3JlYXRlOmNsaWVudF9rZXlzIHJlYWQ6Y29ubmVjdGlvbnMgdXBkYXRlOmNvbm5lY3Rpb25zIGRlbGV0ZTpjb25uZWN0aW9ucyBjcmVhdGU6Y29ubmVjdGlvbnMgcmVhZDpyZXNvdXJjZV9zZXJ2ZXJzIHVwZGF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGRlbGV0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGNyZWF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIHJlYWQ6ZGV2aWNlX2NyZWRlbnRpYWxzIHVwZGF0ZTpkZXZpY2VfY3JlZGVudGlhbHMgZGVsZXRlOmRldmljZV9jcmVkZW50aWFscyBjcmVhdGU6ZGV2aWNlX2NyZWRlbnRpYWxzIHJlYWQ6cnVsZXMgdXBkYXRlOnJ1bGVzIGRlbGV0ZTpydWxlcyBjcmVhdGU6cnVsZXMgcmVhZDpydWxlc19jb25maWdzIHVwZGF0ZTpydWxlc19jb25maWdzIGRlbGV0ZTpydWxlc19jb25maWdzIHJlYWQ6ZW1haWxfcHJvdmlkZXIgdXBkYXRlOmVtYWlsX3Byb3ZpZGVyIGRlbGV0ZTplbWFpbF9wcm92aWRlciBjcmVhdGU6ZW1haWxfcHJvdmlkZXIgYmxhY2tsaXN0OnRva2VucyByZWFkOnN0YXRzIHJlYWQ6dGVuYW50X3NldHRpbmdzIHVwZGF0ZTp0ZW5hbnRfc2V0dGluZ3MgcmVhZDpsb2dzIHJlYWQ6c2hpZWxkcyBjcmVhdGU6c2hpZWxkcyBkZWxldGU6c2hpZWxkcyB1cGRhdGU6dHJpZ2dlcnMgcmVhZDp0cmlnZ2VycyByZWFkOmdyYW50cyBkZWxldGU6Z3JhbnRzIHJlYWQ6Z3VhcmRpYW5fZmFjdG9ycyB1cGRhdGU6Z3VhcmRpYW5fZmFjdG9ycyByZWFkOmd1YXJkaWFuX2Vucm9sbG1lbnRzIGRlbGV0ZTpndWFyZGlhbl9lbnJvbGxtZW50cyBjcmVhdGU6Z3VhcmRpYW5fZW5yb2xsbWVudF90aWNrZXRzIHJlYWQ6dXNlcl9pZHBfdG9rZW5zIGNyZWF0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIGRlbGV0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIHJlYWQ6Y3VzdG9tX2RvbWFpbnMgZGVsZXRlOmN1c3RvbV9kb21haW5zIGNyZWF0ZTpjdXN0b21fZG9tYWlucyByZWFkOmVtYWlsX3RlbXBsYXRlcyBjcmVhdGU6ZW1haWxfdGVtcGxhdGVzIHVwZGF0ZTplbWFpbF90ZW1wbGF0ZXMgcmVhZDptZmFfcG9saWNpZXMgdXBkYXRlOm1mYV9wb2xpY2llcyByZWFkOnJvbGVzIGNyZWF0ZTpyb2xlcyBkZWxldGU6cm9sZXMgdXBkYXRlOnJvbGVzIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIn0.ujTh3qxgzcgqwMQzUK_nO3IjRklscblxyGJJhXQZ3dkM2QeZFLvNEl_ktzOqpFRwY6_tXdRXjRAWWsH8uJMbYhrCKkQZzvJAn6XkYDlFC-nXHB2UYlUu4WEARb-qkYa0_xv_f7tnkHE7SHnmfIQgj4vckeBr_XOtQ5XP263bfWUyUyXh3kOdQgXdBfadatu1bl4tgAO6qN6AfFp1Z5-ugOnwkPHgDQ_sSnL6FPLKA1zXdk3d4eaV9Li7Ws156bGfS5rG4jHMhveu-6XzAkwv4wjqgfB4CwcwMyMkJW0a_k_FFJMUMsNjyuG2K7BcWxZC0C84fW_bFKxh0Amzfr9SuQ'
        },
        body:
        {
            connection: "Username-Password-Authentication",
            email: email,
            name: name,
            nickname: nickname,
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
        res.status(error.statusCode).end();
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
        res.status(error.statusCode).end();
    });
        
});

router.delete('/users/:userid', checkJwt, function(req, res){
    const username = req.body.username;
    const pass = req.body.password;
    const u = req.params.userid;
    console.log(username);
    if (!req.user.name){
        res.status(401).end();
    }
    else if (u !== req.user.sub){
        res.status(403).end();
    }
    else{
        var options = {
            method: 'DELETE',
            url: 'https://wk8jwt.auth0.com/api/v2/users/' + u,
            headers: {
                'content-type': 'application/json',
                'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik5USkdRelJEUWpWQlF6bEJNekV5TmtGR1FqRTNRelV5T0RaRVEwTkNOa00yTXprelJEZzJPUSJ9.eyJpc3MiOiJodHRwczovL3drOGp3dC5hdXRoMC5jb20vIiwic3ViIjoidk1VMWZCZzBDQzZHa1hkMk0wNnNYYzdoOVAyRXgyWmRAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vd2s4and0LmF1dGgwLmNvbS9hcGkvdjIvIiwiaWF0IjoxNTQzNzMzMDI2LCJleHAiOjE1NDYzMjUwMjYsImF6cCI6InZNVTFmQmcwQ0M2R2tYZDJNMDZzWGM3aDlQMkV4MlpkIiwic2NvcGUiOiJyZWFkOmNsaWVudF9ncmFudHMgY3JlYXRlOmNsaWVudF9ncmFudHMgZGVsZXRlOmNsaWVudF9ncmFudHMgdXBkYXRlOmNsaWVudF9ncmFudHMgcmVhZDp1c2VycyB1cGRhdGU6dXNlcnMgZGVsZXRlOnVzZXJzIGNyZWF0ZTp1c2VycyByZWFkOnVzZXJzX2FwcF9tZXRhZGF0YSB1cGRhdGU6dXNlcnNfYXBwX21ldGFkYXRhIGRlbGV0ZTp1c2Vyc19hcHBfbWV0YWRhdGEgY3JlYXRlOnVzZXJzX2FwcF9tZXRhZGF0YSBjcmVhdGU6dXNlcl90aWNrZXRzIHJlYWQ6Y2xpZW50cyB1cGRhdGU6Y2xpZW50cyBkZWxldGU6Y2xpZW50cyBjcmVhdGU6Y2xpZW50cyByZWFkOmNsaWVudF9rZXlzIHVwZGF0ZTpjbGllbnRfa2V5cyBkZWxldGU6Y2xpZW50X2tleXMgY3JlYXRlOmNsaWVudF9rZXlzIHJlYWQ6Y29ubmVjdGlvbnMgdXBkYXRlOmNvbm5lY3Rpb25zIGRlbGV0ZTpjb25uZWN0aW9ucyBjcmVhdGU6Y29ubmVjdGlvbnMgcmVhZDpyZXNvdXJjZV9zZXJ2ZXJzIHVwZGF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGRlbGV0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGNyZWF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIHJlYWQ6ZGV2aWNlX2NyZWRlbnRpYWxzIHVwZGF0ZTpkZXZpY2VfY3JlZGVudGlhbHMgZGVsZXRlOmRldmljZV9jcmVkZW50aWFscyBjcmVhdGU6ZGV2aWNlX2NyZWRlbnRpYWxzIHJlYWQ6cnVsZXMgdXBkYXRlOnJ1bGVzIGRlbGV0ZTpydWxlcyBjcmVhdGU6cnVsZXMgcmVhZDpydWxlc19jb25maWdzIHVwZGF0ZTpydWxlc19jb25maWdzIGRlbGV0ZTpydWxlc19jb25maWdzIHJlYWQ6ZW1haWxfcHJvdmlkZXIgdXBkYXRlOmVtYWlsX3Byb3ZpZGVyIGRlbGV0ZTplbWFpbF9wcm92aWRlciBjcmVhdGU6ZW1haWxfcHJvdmlkZXIgYmxhY2tsaXN0OnRva2VucyByZWFkOnN0YXRzIHJlYWQ6dGVuYW50X3NldHRpbmdzIHVwZGF0ZTp0ZW5hbnRfc2V0dGluZ3MgcmVhZDpsb2dzIHJlYWQ6c2hpZWxkcyBjcmVhdGU6c2hpZWxkcyBkZWxldGU6c2hpZWxkcyB1cGRhdGU6dHJpZ2dlcnMgcmVhZDp0cmlnZ2VycyByZWFkOmdyYW50cyBkZWxldGU6Z3JhbnRzIHJlYWQ6Z3VhcmRpYW5fZmFjdG9ycyB1cGRhdGU6Z3VhcmRpYW5fZmFjdG9ycyByZWFkOmd1YXJkaWFuX2Vucm9sbG1lbnRzIGRlbGV0ZTpndWFyZGlhbl9lbnJvbGxtZW50cyBjcmVhdGU6Z3VhcmRpYW5fZW5yb2xsbWVudF90aWNrZXRzIHJlYWQ6dXNlcl9pZHBfdG9rZW5zIGNyZWF0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIGRlbGV0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIHJlYWQ6Y3VzdG9tX2RvbWFpbnMgZGVsZXRlOmN1c3RvbV9kb21haW5zIGNyZWF0ZTpjdXN0b21fZG9tYWlucyByZWFkOmVtYWlsX3RlbXBsYXRlcyBjcmVhdGU6ZW1haWxfdGVtcGxhdGVzIHVwZGF0ZTplbWFpbF90ZW1wbGF0ZXMgcmVhZDptZmFfcG9saWNpZXMgdXBkYXRlOm1mYV9wb2xpY2llcyByZWFkOnJvbGVzIGNyZWF0ZTpyb2xlcyBkZWxldGU6cm9sZXMgdXBkYXRlOnJvbGVzIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIn0.ujTh3qxgzcgqwMQzUK_nO3IjRklscblxyGJJhXQZ3dkM2QeZFLvNEl_ktzOqpFRwY6_tXdRXjRAWWsH8uJMbYhrCKkQZzvJAn6XkYDlFC-nXHB2UYlUu4WEARb-qkYa0_xv_f7tnkHE7SHnmfIQgj4vckeBr_XOtQ5XP263bfWUyUyXh3kOdQgXdBfadatu1bl4tgAO6qN6AfFp1Z5-ugOnwkPHgDQ_sSnL6FPLKA1zXdk3d4eaV9Li7Ws156bGfS5rG4jHMhveu-6XzAkwv4wjqgfB4CwcwMyMkJW0a_k_FFJMUMsNjyuG2K7BcWxZC0C84fW_bFKxh0Amzfr9SuQ'
            },
            body:
            {
                
            },
            json: true
        };

        rp(options)
        .then(function (body) {
            console.log("delete worked" + body);
            //res.render('info', parsedBody.displayName);
            res.send(body);
        })
        .catch(function (error) {
            console.log("info could not load error is " + error);
            res.status(error.statusCode).end();
        });
    }
        
});

router.put('/users/:userid', checkJwt, function(req, res){
    const u = req.params.userid;
    const email = req.body.email;
    const pass = req.body.password;
    const nickname = req.body.nickname;
    const name = req.body.name;
    //console.log("logging u " + u);
    //console.log("logging req.user.user_id " + JSON.parse(req.user));
    if (!req.user.name){
        res.status(401).end();
    }
    else if (!(u === req.user.sub)){
        res.status(403).end();
    }
    else{
        var options = {
            method: 'PATCH',
            url: 'https://wk8jwt.auth0.com/api/v2/users/' + u,
            headers: {
                'content-type': 'application/json',
                'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik5USkdRelJEUWpWQlF6bEJNekV5TmtGR1FqRTNRelV5T0RaRVEwTkNOa00yTXprelJEZzJPUSJ9.eyJpc3MiOiJodHRwczovL3drOGp3dC5hdXRoMC5jb20vIiwic3ViIjoidk1VMWZCZzBDQzZHa1hkMk0wNnNYYzdoOVAyRXgyWmRAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vd2s4and0LmF1dGgwLmNvbS9hcGkvdjIvIiwiaWF0IjoxNTQzNzMzMDI2LCJleHAiOjE1NDYzMjUwMjYsImF6cCI6InZNVTFmQmcwQ0M2R2tYZDJNMDZzWGM3aDlQMkV4MlpkIiwic2NvcGUiOiJyZWFkOmNsaWVudF9ncmFudHMgY3JlYXRlOmNsaWVudF9ncmFudHMgZGVsZXRlOmNsaWVudF9ncmFudHMgdXBkYXRlOmNsaWVudF9ncmFudHMgcmVhZDp1c2VycyB1cGRhdGU6dXNlcnMgZGVsZXRlOnVzZXJzIGNyZWF0ZTp1c2VycyByZWFkOnVzZXJzX2FwcF9tZXRhZGF0YSB1cGRhdGU6dXNlcnNfYXBwX21ldGFkYXRhIGRlbGV0ZTp1c2Vyc19hcHBfbWV0YWRhdGEgY3JlYXRlOnVzZXJzX2FwcF9tZXRhZGF0YSBjcmVhdGU6dXNlcl90aWNrZXRzIHJlYWQ6Y2xpZW50cyB1cGRhdGU6Y2xpZW50cyBkZWxldGU6Y2xpZW50cyBjcmVhdGU6Y2xpZW50cyByZWFkOmNsaWVudF9rZXlzIHVwZGF0ZTpjbGllbnRfa2V5cyBkZWxldGU6Y2xpZW50X2tleXMgY3JlYXRlOmNsaWVudF9rZXlzIHJlYWQ6Y29ubmVjdGlvbnMgdXBkYXRlOmNvbm5lY3Rpb25zIGRlbGV0ZTpjb25uZWN0aW9ucyBjcmVhdGU6Y29ubmVjdGlvbnMgcmVhZDpyZXNvdXJjZV9zZXJ2ZXJzIHVwZGF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGRlbGV0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGNyZWF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIHJlYWQ6ZGV2aWNlX2NyZWRlbnRpYWxzIHVwZGF0ZTpkZXZpY2VfY3JlZGVudGlhbHMgZGVsZXRlOmRldmljZV9jcmVkZW50aWFscyBjcmVhdGU6ZGV2aWNlX2NyZWRlbnRpYWxzIHJlYWQ6cnVsZXMgdXBkYXRlOnJ1bGVzIGRlbGV0ZTpydWxlcyBjcmVhdGU6cnVsZXMgcmVhZDpydWxlc19jb25maWdzIHVwZGF0ZTpydWxlc19jb25maWdzIGRlbGV0ZTpydWxlc19jb25maWdzIHJlYWQ6ZW1haWxfcHJvdmlkZXIgdXBkYXRlOmVtYWlsX3Byb3ZpZGVyIGRlbGV0ZTplbWFpbF9wcm92aWRlciBjcmVhdGU6ZW1haWxfcHJvdmlkZXIgYmxhY2tsaXN0OnRva2VucyByZWFkOnN0YXRzIHJlYWQ6dGVuYW50X3NldHRpbmdzIHVwZGF0ZTp0ZW5hbnRfc2V0dGluZ3MgcmVhZDpsb2dzIHJlYWQ6c2hpZWxkcyBjcmVhdGU6c2hpZWxkcyBkZWxldGU6c2hpZWxkcyB1cGRhdGU6dHJpZ2dlcnMgcmVhZDp0cmlnZ2VycyByZWFkOmdyYW50cyBkZWxldGU6Z3JhbnRzIHJlYWQ6Z3VhcmRpYW5fZmFjdG9ycyB1cGRhdGU6Z3VhcmRpYW5fZmFjdG9ycyByZWFkOmd1YXJkaWFuX2Vucm9sbG1lbnRzIGRlbGV0ZTpndWFyZGlhbl9lbnJvbGxtZW50cyBjcmVhdGU6Z3VhcmRpYW5fZW5yb2xsbWVudF90aWNrZXRzIHJlYWQ6dXNlcl9pZHBfdG9rZW5zIGNyZWF0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIGRlbGV0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIHJlYWQ6Y3VzdG9tX2RvbWFpbnMgZGVsZXRlOmN1c3RvbV9kb21haW5zIGNyZWF0ZTpjdXN0b21fZG9tYWlucyByZWFkOmVtYWlsX3RlbXBsYXRlcyBjcmVhdGU6ZW1haWxfdGVtcGxhdGVzIHVwZGF0ZTplbWFpbF90ZW1wbGF0ZXMgcmVhZDptZmFfcG9saWNpZXMgdXBkYXRlOm1mYV9wb2xpY2llcyByZWFkOnJvbGVzIGNyZWF0ZTpyb2xlcyBkZWxldGU6cm9sZXMgdXBkYXRlOnJvbGVzIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIn0.ujTh3qxgzcgqwMQzUK_nO3IjRklscblxyGJJhXQZ3dkM2QeZFLvNEl_ktzOqpFRwY6_tXdRXjRAWWsH8uJMbYhrCKkQZzvJAn6XkYDlFC-nXHB2UYlUu4WEARb-qkYa0_xv_f7tnkHE7SHnmfIQgj4vckeBr_XOtQ5XP263bfWUyUyXh3kOdQgXdBfadatu1bl4tgAO6qN6AfFp1Z5-ugOnwkPHgDQ_sSnL6FPLKA1zXdk3d4eaV9Li7Ws156bGfS5rG4jHMhveu-6XzAkwv4wjqgfB4CwcwMyMkJW0a_k_FFJMUMsNjyuG2K7BcWxZC0C84fW_bFKxh0Amzfr9SuQ'
            },
            body:
            {
                email: email,
                nickname: nickname,
                name: name
            },
            json: true
        };

        rp(options)
        .then(function (body) {
            console.log("put worked" + body);
            //res.render('info', parsedBody.displayName);
            res.send(body);
        })
        .catch(function (error) {
            console.log("info could not load error is " + error);
            res.status(error.statusCode).end();
        });
   }     
});


router.get('/users', function(req, res){
    const accepts = req.accepts(['application/json', 'text/html']);
        if(!accepts){
            res.status(406).send('Not Acceptable');
        }
    const username = req.body.username;
    const pass = req.body.password;

    var options = {
        method: 'GET',
        url: 'https://wk8jwt.auth0.com/api/v2/users',
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik5USkdRelJEUWpWQlF6bEJNekV5TmtGR1FqRTNRelV5T0RaRVEwTkNOa00yTXprelJEZzJPUSJ9.eyJpc3MiOiJodHRwczovL3drOGp3dC5hdXRoMC5jb20vIiwic3ViIjoidk1VMWZCZzBDQzZHa1hkMk0wNnNYYzdoOVAyRXgyWmRAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vd2s4and0LmF1dGgwLmNvbS9hcGkvdjIvIiwiaWF0IjoxNTQzNzMzMDI2LCJleHAiOjE1NDYzMjUwMjYsImF6cCI6InZNVTFmQmcwQ0M2R2tYZDJNMDZzWGM3aDlQMkV4MlpkIiwic2NvcGUiOiJyZWFkOmNsaWVudF9ncmFudHMgY3JlYXRlOmNsaWVudF9ncmFudHMgZGVsZXRlOmNsaWVudF9ncmFudHMgdXBkYXRlOmNsaWVudF9ncmFudHMgcmVhZDp1c2VycyB1cGRhdGU6dXNlcnMgZGVsZXRlOnVzZXJzIGNyZWF0ZTp1c2VycyByZWFkOnVzZXJzX2FwcF9tZXRhZGF0YSB1cGRhdGU6dXNlcnNfYXBwX21ldGFkYXRhIGRlbGV0ZTp1c2Vyc19hcHBfbWV0YWRhdGEgY3JlYXRlOnVzZXJzX2FwcF9tZXRhZGF0YSBjcmVhdGU6dXNlcl90aWNrZXRzIHJlYWQ6Y2xpZW50cyB1cGRhdGU6Y2xpZW50cyBkZWxldGU6Y2xpZW50cyBjcmVhdGU6Y2xpZW50cyByZWFkOmNsaWVudF9rZXlzIHVwZGF0ZTpjbGllbnRfa2V5cyBkZWxldGU6Y2xpZW50X2tleXMgY3JlYXRlOmNsaWVudF9rZXlzIHJlYWQ6Y29ubmVjdGlvbnMgdXBkYXRlOmNvbm5lY3Rpb25zIGRlbGV0ZTpjb25uZWN0aW9ucyBjcmVhdGU6Y29ubmVjdGlvbnMgcmVhZDpyZXNvdXJjZV9zZXJ2ZXJzIHVwZGF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGRlbGV0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGNyZWF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIHJlYWQ6ZGV2aWNlX2NyZWRlbnRpYWxzIHVwZGF0ZTpkZXZpY2VfY3JlZGVudGlhbHMgZGVsZXRlOmRldmljZV9jcmVkZW50aWFscyBjcmVhdGU6ZGV2aWNlX2NyZWRlbnRpYWxzIHJlYWQ6cnVsZXMgdXBkYXRlOnJ1bGVzIGRlbGV0ZTpydWxlcyBjcmVhdGU6cnVsZXMgcmVhZDpydWxlc19jb25maWdzIHVwZGF0ZTpydWxlc19jb25maWdzIGRlbGV0ZTpydWxlc19jb25maWdzIHJlYWQ6ZW1haWxfcHJvdmlkZXIgdXBkYXRlOmVtYWlsX3Byb3ZpZGVyIGRlbGV0ZTplbWFpbF9wcm92aWRlciBjcmVhdGU6ZW1haWxfcHJvdmlkZXIgYmxhY2tsaXN0OnRva2VucyByZWFkOnN0YXRzIHJlYWQ6dGVuYW50X3NldHRpbmdzIHVwZGF0ZTp0ZW5hbnRfc2V0dGluZ3MgcmVhZDpsb2dzIHJlYWQ6c2hpZWxkcyBjcmVhdGU6c2hpZWxkcyBkZWxldGU6c2hpZWxkcyB1cGRhdGU6dHJpZ2dlcnMgcmVhZDp0cmlnZ2VycyByZWFkOmdyYW50cyBkZWxldGU6Z3JhbnRzIHJlYWQ6Z3VhcmRpYW5fZmFjdG9ycyB1cGRhdGU6Z3VhcmRpYW5fZmFjdG9ycyByZWFkOmd1YXJkaWFuX2Vucm9sbG1lbnRzIGRlbGV0ZTpndWFyZGlhbl9lbnJvbGxtZW50cyBjcmVhdGU6Z3VhcmRpYW5fZW5yb2xsbWVudF90aWNrZXRzIHJlYWQ6dXNlcl9pZHBfdG9rZW5zIGNyZWF0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIGRlbGV0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIHJlYWQ6Y3VzdG9tX2RvbWFpbnMgZGVsZXRlOmN1c3RvbV9kb21haW5zIGNyZWF0ZTpjdXN0b21fZG9tYWlucyByZWFkOmVtYWlsX3RlbXBsYXRlcyBjcmVhdGU6ZW1haWxfdGVtcGxhdGVzIHVwZGF0ZTplbWFpbF90ZW1wbGF0ZXMgcmVhZDptZmFfcG9saWNpZXMgdXBkYXRlOm1mYV9wb2xpY2llcyByZWFkOnJvbGVzIGNyZWF0ZTpyb2xlcyBkZWxldGU6cm9sZXMgdXBkYXRlOnJvbGVzIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIn0.ujTh3qxgzcgqwMQzUK_nO3IjRklscblxyGJJhXQZ3dkM2QeZFLvNEl_ktzOqpFRwY6_tXdRXjRAWWsH8uJMbYhrCKkQZzvJAn6XkYDlFC-nXHB2UYlUu4WEARb-qkYa0_xv_f7tnkHE7SHnmfIQgj4vckeBr_XOtQ5XP263bfWUyUyXh3kOdQgXdBfadatu1bl4tgAO6qN6AfFp1Z5-ugOnwkPHgDQ_sSnL6FPLKA1zXdk3d4eaV9Li7Ws156bGfS5rG4jHMhveu-6XzAkwv4wjqgfB4CwcwMyMkJW0a_k_FFJMUMsNjyuG2K7BcWxZC0C84fW_bFKxh0Amzfr9SuQ'
        },
        body:
        {
           
        },
        json: true
    };

    rp(options)
    .then(function (body) {
        console.log("put worked" + body);
        //res.render('info', parsedBody.displayName);
        res.send(body);
    })
    .catch(function (error) {
        console.log("info could not load error is " + error);
        res.status(error.statusCode).end();
    });
        
});

router.get('/users/:userid', function(req, res){
    const username = req.body.username;
    const pass = req.body.password;
    const u = req.params.userid;
    var options = {
        method: 'GET',
        url: 'https://wk8jwt.auth0.com/api/v2/users/' + u,
        headers: {
            'content-type': 'application/json',
            'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Ik5USkdRelJEUWpWQlF6bEJNekV5TmtGR1FqRTNRelV5T0RaRVEwTkNOa00yTXprelJEZzJPUSJ9.eyJpc3MiOiJodHRwczovL3drOGp3dC5hdXRoMC5jb20vIiwic3ViIjoidk1VMWZCZzBDQzZHa1hkMk0wNnNYYzdoOVAyRXgyWmRAY2xpZW50cyIsImF1ZCI6Imh0dHBzOi8vd2s4and0LmF1dGgwLmNvbS9hcGkvdjIvIiwiaWF0IjoxNTQzNzMzMDI2LCJleHAiOjE1NDYzMjUwMjYsImF6cCI6InZNVTFmQmcwQ0M2R2tYZDJNMDZzWGM3aDlQMkV4MlpkIiwic2NvcGUiOiJyZWFkOmNsaWVudF9ncmFudHMgY3JlYXRlOmNsaWVudF9ncmFudHMgZGVsZXRlOmNsaWVudF9ncmFudHMgdXBkYXRlOmNsaWVudF9ncmFudHMgcmVhZDp1c2VycyB1cGRhdGU6dXNlcnMgZGVsZXRlOnVzZXJzIGNyZWF0ZTp1c2VycyByZWFkOnVzZXJzX2FwcF9tZXRhZGF0YSB1cGRhdGU6dXNlcnNfYXBwX21ldGFkYXRhIGRlbGV0ZTp1c2Vyc19hcHBfbWV0YWRhdGEgY3JlYXRlOnVzZXJzX2FwcF9tZXRhZGF0YSBjcmVhdGU6dXNlcl90aWNrZXRzIHJlYWQ6Y2xpZW50cyB1cGRhdGU6Y2xpZW50cyBkZWxldGU6Y2xpZW50cyBjcmVhdGU6Y2xpZW50cyByZWFkOmNsaWVudF9rZXlzIHVwZGF0ZTpjbGllbnRfa2V5cyBkZWxldGU6Y2xpZW50X2tleXMgY3JlYXRlOmNsaWVudF9rZXlzIHJlYWQ6Y29ubmVjdGlvbnMgdXBkYXRlOmNvbm5lY3Rpb25zIGRlbGV0ZTpjb25uZWN0aW9ucyBjcmVhdGU6Y29ubmVjdGlvbnMgcmVhZDpyZXNvdXJjZV9zZXJ2ZXJzIHVwZGF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGRlbGV0ZTpyZXNvdXJjZV9zZXJ2ZXJzIGNyZWF0ZTpyZXNvdXJjZV9zZXJ2ZXJzIHJlYWQ6ZGV2aWNlX2NyZWRlbnRpYWxzIHVwZGF0ZTpkZXZpY2VfY3JlZGVudGlhbHMgZGVsZXRlOmRldmljZV9jcmVkZW50aWFscyBjcmVhdGU6ZGV2aWNlX2NyZWRlbnRpYWxzIHJlYWQ6cnVsZXMgdXBkYXRlOnJ1bGVzIGRlbGV0ZTpydWxlcyBjcmVhdGU6cnVsZXMgcmVhZDpydWxlc19jb25maWdzIHVwZGF0ZTpydWxlc19jb25maWdzIGRlbGV0ZTpydWxlc19jb25maWdzIHJlYWQ6ZW1haWxfcHJvdmlkZXIgdXBkYXRlOmVtYWlsX3Byb3ZpZGVyIGRlbGV0ZTplbWFpbF9wcm92aWRlciBjcmVhdGU6ZW1haWxfcHJvdmlkZXIgYmxhY2tsaXN0OnRva2VucyByZWFkOnN0YXRzIHJlYWQ6dGVuYW50X3NldHRpbmdzIHVwZGF0ZTp0ZW5hbnRfc2V0dGluZ3MgcmVhZDpsb2dzIHJlYWQ6c2hpZWxkcyBjcmVhdGU6c2hpZWxkcyBkZWxldGU6c2hpZWxkcyB1cGRhdGU6dHJpZ2dlcnMgcmVhZDp0cmlnZ2VycyByZWFkOmdyYW50cyBkZWxldGU6Z3JhbnRzIHJlYWQ6Z3VhcmRpYW5fZmFjdG9ycyB1cGRhdGU6Z3VhcmRpYW5fZmFjdG9ycyByZWFkOmd1YXJkaWFuX2Vucm9sbG1lbnRzIGRlbGV0ZTpndWFyZGlhbl9lbnJvbGxtZW50cyBjcmVhdGU6Z3VhcmRpYW5fZW5yb2xsbWVudF90aWNrZXRzIHJlYWQ6dXNlcl9pZHBfdG9rZW5zIGNyZWF0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIGRlbGV0ZTpwYXNzd29yZHNfY2hlY2tpbmdfam9iIHJlYWQ6Y3VzdG9tX2RvbWFpbnMgZGVsZXRlOmN1c3RvbV9kb21haW5zIGNyZWF0ZTpjdXN0b21fZG9tYWlucyByZWFkOmVtYWlsX3RlbXBsYXRlcyBjcmVhdGU6ZW1haWxfdGVtcGxhdGVzIHVwZGF0ZTplbWFpbF90ZW1wbGF0ZXMgcmVhZDptZmFfcG9saWNpZXMgdXBkYXRlOm1mYV9wb2xpY2llcyByZWFkOnJvbGVzIGNyZWF0ZTpyb2xlcyBkZWxldGU6cm9sZXMgdXBkYXRlOnJvbGVzIiwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIn0.ujTh3qxgzcgqwMQzUK_nO3IjRklscblxyGJJhXQZ3dkM2QeZFLvNEl_ktzOqpFRwY6_tXdRXjRAWWsH8uJMbYhrCKkQZzvJAn6XkYDlFC-nXHB2UYlUu4WEARb-qkYa0_xv_f7tnkHE7SHnmfIQgj4vckeBr_XOtQ5XP263bfWUyUyXh3kOdQgXdBfadatu1bl4tgAO6qN6AfFp1Z5-ugOnwkPHgDQ_sSnL6FPLKA1zXdk3d4eaV9Li7Ws156bGfS5rG4jHMhveu-6XzAkwv4wjqgfB4CwcwMyMkJW0a_k_FFJMUMsNjyuG2K7BcWxZC0C84fW_bFKxh0Amzfr9SuQ'
        },
        body:
        {
            
        },
        json: true
    };

    rp(options)
    .then(function (body) {
        console.log("put worked" + body);
        //res.render('info', parsedBody.displayName);
        res.send(body);
    })
    .catch(function (error) {
        console.log("info could not load error is " + error);
        res.status(error.statusCode).end();
    });
        
});


//GET list of ships
router.get('/projects', function(req, res){
    const accepts = req.accepts(['application/json']);
    if(!accepts){
            res.status(406).send('Not Acceptable');
        }
    else{
        const projects = get_projects(req)
	   .then( (projects) => {
        //console.log(ships);
        res.status(200).json(projects);
     });
    }
});

router.get('/employees', function(req, res){
    const accepts = req.accepts(['application/json']);
    if(!accepts){
            res.status(406).send('Not Acceptable');
        }
    else{
        const employees = get_employees(req)
       .then( (employees) => {
        //console.log(ships);
        res.status(200).json(employees);
     });
    }
});

//POST to create new ship
router.post('/projects', checkJwt, function(req, res){
    const u = req.params.userid;
    if (!req.user.name){
        res.status(401).end();
    }
    var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/projects/';
    post_project(req.body.name, req.body.start_date, req.body.deadline, req.user.name)
        .then( key => 
        {
            res.location(reqUrl + key.id);
            res.status(201).send('{ "id": ' + key.id + ' }');
        });
});


//GET specific ship
router.get('/projects/:id', function(req, res){
    //add 404 not found cases
    //add 415 cases
   
    findObject(req.params.id, PROJECT).then(result => {
        const accepts = req.accepts(['application/json']);
        if (result !== true){
            res.status(404).end();
        }

        get_project(req.params.id, req).then( (project) => {
        //console.log(ship);y
        
            if(!accepts){
                res.status(406).send('Not Acceptable');
            }
            else if(accepts === 'application/json'){
                res.status(200).json(project);
            } 

        });
        
    });
    
});

//GET specific ship
router.get('/employees/:id', function(req, res){
    findObject(req.params.id, EMPLOYEE).then(result => {
        const accepts = req.accepts(['application/json']);
        if (result !== true){
            res.status(404).end();
        }
        if(!accepts){
            res.status(406).send('Not Acceptable');
        }
        get_employee(req.params.id, req).then( (employee) => {
        res.status(200).json(employee);  
    });
    }); 
});

//POST to create new ship
router.post('/employees', function(req, res){
    var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/employees/';
    const accepts = req.accepts(['application/json']);
    post_employee(req.body.name, req.body.job_title, req.body.department)
        .then( key => 
        {
            res.location(reqUrl + key.id);
            res.status(201).send('{ "id": ' + key.id + ' }');
        });
});

//PUT to edit specific ship
router.put('/projects/:id', checkJwt, function(req, res){
        const id = req.params.id;
        if (!req.user.name){
            res.status(401).end();
        }
        var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/projects/';
        findObject(req.params.id, PROJECT).then((result) => {
        console.log("find result is " + result);
        if (result !== true){
            res.status(404).end();
        }
        const proj = get_project(id, req).then((proj) => {
            console.log("get proj result is " + proj);
            if (!(proj.project_leader === req.user.name)){
                res.status(403).end();
            }
            put_project(req.params.id, req.body.name, req.body.start_date, req.body.deadline, req.user.name)
            .then(() =>
            {
                res.status(200).end();
            });
        });
        
    });  
});

router.put('/employees', function(req, res){
        var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/employees/';
        findObject(req.params.id, PROJECT).then(result => {
            if (result !== true){
                res.status(404).end();
            }
            put_project(req.params.id, req.body.name, req.body.start_date, req.body.deadline, req.user.name)
            .then(() =>
                {
                    res.status(200).end();
                });
    });   
});

//delete specific ship
router.delete('/projects/:id', checkJwt, function(req, res){
    //console.log('test');
    const id = req.params.id;
        if (!req.user.name){
            res.status(401).end();
        }
        var reqUrl = req.protocol + "://" + req.get('host') + req.baseUrl + '/projects/';
        findObject(req.params.id, PROJECT).then((result) => {
        console.log("find result is " + result);
        if (result !== true){
            res.status(404).end();
        }
        const proj = get_project(id, req).then((proj) => {
            console.log("get proj result is " + proj);
            if (!(proj.project_leader === req.user.name)){
                res.status(403).end();
            }
            delete_project(req.params.id).
            then(() =>
            {
                res.status(204).end();
            });
        });
        
    });  
    
});

//delete specific ship
router.delete('/employees/:id', checkJwt, function(req, res){
    //console.log('test');
    findObject(req.params.id, EMPLOYEE).then((result) => {
        //console.log("logging result " + result);
        const u = req.params.userid;
       if (result){
            //console.log('deleting ship');
            delete_employee(req.params.id).then(res.status(204).end());
        }
        else{
            res.status(404).end();
        }
    });
    
});

//delete all ships
router.delete('/employees', function(req, res){
    //res.set('Accept', 'GET, POST');
    //res.status(405).end();
    delete_all_employees().then(res.status(200).end());
});

//delete all ships
router.delete('/projects', function(req, res){
    //res.set('Accept', 'GET, POST');
    //res.status(405).end();
    delete_all_projects().then(res.status(200).end());
});

router.put('/employees', function(req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

//delete all ships
router.put('/projects', function(req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

//add cargo to ship
router.put('/projects/:project_id/employees/:employee_id', function(req, res){
    findObject(req.params.project_id, PROJECT).then(result1 => {
    findObject(req.params.employee_id, EMPLOYEE).then( (result2) => {
        if (!(result1 && result2))
        {
            res.status(404).end();
        }
        if (check_relationship(req.params.project_id) === 2){
            res.status(404).end();
        }
        if (check_relationship(req.params.project_id) === 0){
            res.status(405).end();
        }
        assign(req.params.project_id, req.params.employee_id).then( (value) => {
            if (value){
                res.status(200).end();
            }
        }); 
});
});
});

//remove cargo from ship
router.delete('/projects/:project_id/employees/:employee_id', function(req, res){
     findObject(req.params.project_id, PROJECT).then(result1 => {
        findObject(req.params.employee_id, PROJECT).then( (result2) => {
        if (!(result1 && result2))
        {
            res.status(404).end();
        }
        if (!(check_relationship(req.params.project_id) === 0)){
            res.status(404).end();
        }
        unassign(req.params.project_id, req.params.employee_id).then(res.status(200).end());
    });
});
});


/* ------------- End Controller Functions ------------- */

app.use('', router);
//app.use('/user', user);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
