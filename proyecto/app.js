"use strict"

var express = require("express");
var bodyParser = require("body-parser");

const app = express();

app.use(express.static('public'));
// Cargar rutas

var lectura_routes = require("./rutas/lectura.js");

app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

// Configurar cabeceras

app.use((req, res, next) =>
{
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method");
	res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
	res.header("Allow", "GET, POST, OPTIONS, PUT, DELETE");
	next();
})

// Rutas base
app.use("/api", lectura_routes);


/**
 * Create a new Influx client. We tell it to use the
 * `express_response_db` database by default, and give
 * it some information about the schema we're writing.
 */
 
/* curl -G "http://158.49.112.125:80/query?pretty=true" -u guest:smartpolitech --data-urlencode "db=sensors" --data-urlencode "q=SHOW MEASUREMENTS" */



module.exports = app;