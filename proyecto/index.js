"use strict"

var app = require("./app");
var puerto = process.env.PORT || 3977;

app.listen(puerto, function()
	{
		console.log("Servidor del api rest para la lectura de datos funcionando en http://localhost:" + puerto);
	});