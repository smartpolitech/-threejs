"use strict"

var request = require('request');
var fs = require('fs');
const Influx = require('influx');
var path = require("path");

var tablas = [];
/* Elimina las tablas que no empiezen por UEXCC Esto es así para no almacenar tablas como prueba, prueba2, etc */
var FILTRO_TABLAS = "UEXCC";
/* Si está a true, hace que los sensores de temperatura aparezcan como temperatura, humedad y demás, en lugar de temp, hum, y además, añada las unidades de medida al texto */
var FORMATEO_DATOS = true;
/* Clave que debe ser enviada por POST para validar la función de actualizar nombres y aumentar la seguridad */
var CLAVE = "GzsRjy2uYrpyJ-oqp38K";

/* Array con los colores para mostrar en tiempo real las temperaturas o la humedad */
var COLORES = ["#d8d8ff", "#9393ff", "#5a5aff", "#1c1cff", "#3dff3d", "#01c101", "#ffaa00", "#ff3f00", "#ff0000", "#840101"];

/* Inicializar los parámetros de conexión */
const influx = new Influx.InfluxDB(
{
	database: 'sensors',
	host: '158.49.112.125/query?pretty=true',
	port: 80,
	username: 'guest',
	password: 'smartpolitech'
})

/* Cargamos todas las tablas disponibles que posean datos de sensores, para buscar posteriormente las indicadas por parámetros en la URL */
influx.query('SHOW MEASUREMENTS').then(results =>
{
	let maximo = results.length;

	for (var i = 0; i < maximo; i++)
	{
		if (results[i].name.indexOf(FILTRO_TABLAS) !== -1)
		{
			tablas.push(results[i].name);
		}
	}

	/* Ahora en tablas tenemos una lista con todas las tablas en las que se puede buscar los sensores de una habitación escogida*/
	console.log("LISTADO DE TABLAS:");
	console.log(tablas);
	console.log("Total de tablas: " + tablas.length);
});

/* Función para obtener los datos de una habitación seleccionada */
function getDatos(req, res)
{
	let sensor = FILTRO_TABLAS + "_" + req.body.edificio + "_" + req.body.planta + "_" + req.body.habitacion;
	let tablasABuscar = [];
	let tablasRealizadas = 1;
	var resultados = [];

	for (var i = 0; i < tablas.length; i++)
	{
		/* En caso de que encuentre alguna tabla que contenga datos de la habitacion la añadimos */
		if (tablas[i].indexOf(sensor) !== -1)
		{
			tablasABuscar.push(tablas[i]);
		}
	}

	if (tablasABuscar.length == 0)
	{
		res.status(200).send(JSON.stringify({error: "Lo sentimos, no existen sensores para la habitción " + req.body.habitacion}));
	}

	/* Con este truco escogemos el último valor capturado por el sensor (ultima fila de la base de datos) */
	for (var i = 0; i < tablasABuscar.length; i++)
	{
		let nombreSensor = tablasABuscar[i].substr(21, 20);
		influx.query('SELECT * FROM ' + tablasABuscar[i] + ' GROUP BY * ORDER BY DESC LIMIT 1').then(results =>
		{
			let datoSensor = results[0];
			datoSensor["sensor"] = nombreSensor;
			datoSensor["time"] = datoSensor["time"].toString();
			resultados.push(datoSensor);

			if (tablasRealizadas < tablasABuscar.length)
			{
				tablasRealizadas++;
			}
			else
			{
				if (FORMATEO_DATOS)
					formatearDatos(resultados, res);
				else
					res.status(200).send(JSON.stringify(resultados));
			}
		});
	}
}

/* Función que devuelve las temperaturas de una planta y edificio seleccionados */
function obtenerTemperaturas(req, res)
{

	let sensor = FILTRO_TABLAS + "_" + req.body.edificio + "_" + req.body.planta;
	let tablasABuscar = [];
	let tablasRealizadas = 1;
	var resultados = [];

	for (var i = 0; i < tablas.length; i++)
	{
		/* En caso de que encuentre alguna tabla que pertenezca al edifico y planta seleccionados, comprobamos si posee sensor de temperatura */
		if (tablas[i].indexOf(sensor) !== -1)
		{
			/* Escojemos los últimso 3 caracteres de la tabla para ver si corresponde a un sensor de temperatura */

			let tipoSensor = tablas[i].substr(-3, 3);

			/* Nos quedamos únicamente con los sensores que tengan valores de temperatura */
			if (tipoSensor == "THV" || tipoSensor == "TEH" || tipoSensor == "THC" || tipoSensor == "THR" || tipoSensor == "HV2")
			{
				tablasABuscar.push(tablas[i]);
			}
		}
	}

	if (tablasABuscar.length == 0)
	{
		let datoTemperatura = {};
		datoTemperatura["error"] = "No hay sensores de temperatura para " + req.body.edificio + "_" + req.body.planta;
		res.status(200).send(JSON.stringify(datoTemperatura));
	}

	/* Ahora realizamos la búsqueda en las tablas seleccionadas */
	for (var i = 0; i < tablasABuscar.length; i++)
	{
		let nombre = tablasABuscar[i].substr(14, 6);
		influx.query('SELECT temp FROM ' + tablasABuscar[i] + ' GROUP BY * ORDER BY DESC LIMIT 1').then(results =>
		{
			let datoTemperatura = {};
			datoTemperatura["habitacion"] = nombre;
			datoTemperatura["temperatura"] = results[0].temp;
			datoTemperatura["fecha"] = results[0].time;
			resultados.push(datoTemperatura);

			if (tablasRealizadas == tablasABuscar.length)
			{
				res.status(200).send(JSON.stringify(filtrarTemperaturas(resultados)));
			}
			else
			{
				tablasRealizadas++;
			}
		});
	}
}

function obtenerHumedades(req, res)
{

	let sensor = FILTRO_TABLAS + "_" + req.body.edificio + "_" + req.body.planta;
	let tablasABuscar = [];
	let tablasRealizadas = 1;
	var resultados = [];

	for (var i = 0; i < tablas.length; i++)
	{
		/* En caso de que encuentre alguna tabla que pertenezca al edifico y planta seleccionados, comprobamos si posee sensor de temperatura */
		if (tablas[i].indexOf(sensor) !== -1)
		{
			/* Escojemos los últimso 3 caracteres de la tabla para ver si corresponde a un sensor de temperatura */

			let tipoSensor = tablas[i].substr(-3, 3);

			if (tipoSensor == "THV" || tipoSensor == "TEH" || tipoSensor == "THC" || tipoSensor == "THR" || tipoSensor == "HV2")
			{
				tablasABuscar.push(tablas[i]);
			}
		}
	}

	if (tablasABuscar.length == 0)
	{
		let datoHumedad = {};
		datoHumedad["error"] = "No hay sensores de humedad para " + req.body.edificio + "_" + req.body.planta;
		res.status(200).send(JSON.stringify(datoHumedad));
	}

	/* Ahora realizamos la búsqueda en las tablas seleccionadas */
	for (var i = 0; i < tablasABuscar.length; i++)
	{
		let nombre = tablasABuscar[i].substr(14, 6);
		influx.query('SELECT hum FROM ' + tablasABuscar[i] + ' GROUP BY * ORDER BY DESC LIMIT 1').then(results =>
		{
			let datoHumedad = {};
			datoHumedad["habitacion"] = nombre;
			datoHumedad["humedad"] = results[0].hum;
			datoHumedad["fecha"] = results[0].time;
			resultados.push(datoHumedad);

			if (tablasRealizadas == tablasABuscar.length)
			{
				res.status(200).send(JSON.stringify(filtrarHumedades(resultados)));
			}
			else
			{
				tablasRealizadas++;
			}
		});
	}	
}

function actualizarNombresHabitacion(req, res)
{
	var edificio = req.body.edificio;
	var planta = req.body.planta;

	if (req.body.clave != CLAVE)
	{
		res.status(200).send({error: "Error. La clave de activación no es válida"});
	}
	else
	{
		var rutaFicheroDatos = "./public/modelos/" + edificio + "/" + planta + "/datos.js"
		var habitaciones;
		fs.readFile(rutaFicheroDatos, 'utf8', function (err, data)
		{
			if (err)
			{
				res.status(200).send({error: "Error. Los parámetros no son correctos"});
			}
			else
			{
				habitaciones = JSON.parse(data);
				/* Estando aquí ya hemos cargado en habitaciones todos los metadatos necesarios. Ahora cargamos el fichero que contiene los nombres, para mezclarlos */

				var rutaFicheroNombres = "./public/modelos/" + edificio + "/" + planta + "/nombresHabitacion.js"
				var nombresHabitacion;

				fs.readFile(rutaFicheroNombres, 'utf8', function (error, nombres)
				{
					if (error)
					{
						res.status(200).send({error: "Error. No existe fichero de nombres"});
					}
					else
					{
						nombresHabitacion = JSON.parse(nombres).nombres;
						/* Si estamos aquí, es que todo funciona correctamente. Ahora, actualizamos el fichero de datos con los nombres */

						for (var i = 0; i < nombresHabitacion.length; i++)
						{
							var encontrado = false;
							for (var j = 0; j < habitaciones.Edificio.length && encontrado == false; j++)
							{

								if (habitaciones.Edificio[j].habitacion == nombresHabitacion[i].habitacion)
								{
									encontrado = true;
									habitaciones.Edificio[j].nombre = nombresHabitacion[i].nombre;
								}
							}
						}

						/* Ahora convertimso ese array en JSON listo para ser grabado en un fichero y además, lo mostramos por pantalla */
						habitaciones = JSON.stringify(habitaciones, null, 2);

						fs.writeFile(rutaFicheroDatos, habitaciones, 'utf8', function (err)
						{
							if (err)
							{
								res.status(200).send({error: "Error. No se ha podido guardar el fichero"});
							}
							else
							{
								res.status(200).send(habitaciones);
							}
						});
					}
				});
			}
		});
	}
}

/* ################################################################################################################################ 
													FUNCIONES AUXILIARES
##################################################################################################################################*/

/* Función que recorre todos los datos leídos y los convierte a un formato mas amigable para el usuario */
/* Esto solo funciona con algunos de los sensores disponibles, el resto se entregará en crudo */
function formatearDatos(datosLeidos, res)
{
	var datosFormateados = [];
	var i;

	for (i = 0; i < datosLeidos.length; i++)
	{
		if(datosLeidos[i] != null)
		{
			let datoFormateado = {};

			datoFormateado["sensor"] = datosLeidos[i].sensor;
			delete datosLeidos[i].sensor;

			datoFormateado["time"] = datosLeidos[i].time;
			delete datosLeidos[i].time;

			if (datosLeidos[i].temp)
			{
				datoFormateado["Temperatura"] = datosLeidos[i].temp + "º C";
				delete datosLeidos[i].temp;
			}

			if (datosLeidos[i].hum)
			{
				datoFormateado["Humedad"] = datosLeidos[i].hum + "%";
				delete datosLeidos[i].hum;
			}

			if (datosLeidos[i].vbat)
			{
				datoFormateado["Bateria"] = datosLeidos[i].vbat + "V";
				delete datosLeidos[i].vbat;
			}

			if (datosLeidos[i].window)
			{
				datoFormateado["Ventana"] = estadoVentana(datosLeidos[i].window);
				delete datosLeidos[i].window;
			}
			else
			{
				if (datosLeidos[i].window == null)
					delete datosLeidos[i].window;
			}

			if (datosLeidos[i].C02 == null)
				delete datosLeidos[i].C02;

			/* Copiamos el resto de los valores */
			for(var indice in datosLeidos[i])
			{
				datoFormateado[indice] = datosLeidos[i][indice];
			}

			datosFormateados.push(datoFormateado);
		}
	}
	res.status(200).send(JSON.stringify(datosFormateados));
}

/* Función utilizada para el formateo de datos y que devuelve el estado de la ventana de forma textual */
function estadoVentana(estado)
{
	if (estado == 1)
		return "Cerrada";
	return "Abierta";
}

/* Función que elimina los datos repetidos de temperaturas (ya que hay habitaciones que poseen mas de un sensor) y además calcula la media de todos los sensores de la misma habitación */
function filtrarTemperaturas(arrayTemperaturas)
{
	var temperaturasFiltrado = [];

	for (let i = 0; i <  arrayTemperaturas.length; i++)
	{
		/* Comprobamos si existe o no en los resultados filtrados */
		if (!estaFiltrado(arrayTemperaturas[i].habitacion, temperaturasFiltrado))
		{
			/* En caso de que no esté filtrado, buscamos la lectura mas actual y la añadimos */
			let datoTemperatura = {};
			datoTemperatura["habitacion"] = arrayTemperaturas[i].habitacion;
			datoTemperatura["temperatura"] = temperaturaMasActual(arrayTemperaturas[i], arrayTemperaturas, i);
			temperaturasFiltrado.push(datoTemperatura);
		}
	}

	return temperaturasFiltrado;
}

function temperaturaMasActual(datosHabitacion, arrayTemperaturas, origen)
{
	let nombreHabitacion = datosHabitacion.habitacion;
	let masActual = datosHabitacion.fecha;
	let temperaturaActual = datosHabitacion.temperatura;

	/* Realizamos una búsqueda secuencial partiendo desde el origen dado por parámetro para quedarnos con el que tenga la fecha mas alta */
	for (let i = origen; i < arrayTemperaturas.length; i++)
	{
		if (arrayTemperaturas[i].habitacion == nombreHabitacion && arrayTemperaturas[i].fecha > masActual)
		{
			temperaturaActual = arrayTemperaturas[i].temperatura;
			masActual = arrayTemperaturas[i].fecha;
		}
	}

	/* Devolvemos una temperatura redondeada a enteros siempre mayor que 0. Este valor será la posición dentro del vector de temperaturas en la aplicación, donde están almacenados los tonos de colores en función de la temperatura */
	return getColorTemperatura(temperaturaActual);
}

/* Función que elimina los datos repetidos de humedades (ya que hay habitaciones que poseen mas de un sensor) y deja solo el valor mas actual */
function filtrarHumedades(arrayHumedades)
{
	var humedadesFiltrado = [];

	for (let i = 0; i <  arrayHumedades.length; i++)
	{
		if (!estaFiltrado(arrayHumedades[i].habitacion, humedadesFiltrado))
		{
			let datoHumedad = {};
			datoHumedad["habitacion"] = arrayHumedades[i].habitacion;
			datoHumedad["humedad"] = humedadMasActual(arrayHumedades[i], arrayHumedades, i);
			humedadesFiltrado.push(datoHumedad);
		}
	}
	return humedadesFiltrado;
}

function humedadMasActual(datosHabitacion, arrayHumedades, origen)
{
	let nombreHabitacion = datosHabitacion.habitacion;
	let masActual = datosHabitacion.fecha;
	let humedad = datosHabitacion.humedad;

	for (let i = origen; i < arrayHumedades.length; i++)
	{
		if (arrayHumedades[i].habitacion == nombreHabitacion && arrayHumedades[i].fecha > masActual)
		{
			humedad = arrayHumedades[i].humedad;
			masActual = arrayHumedades[i].fecha;
		}
	}
	
	/* Forzamos una división entera por 10. De esta manera, nos devuelve la posición donde estaría dentro del array de humedades. Dicho array consta de 10 valores con 10 colores diferentes en escala de azul */
	return getColorHumedad(humedad);
}

function estaFiltrado(habitacion, arrayDondeSeBusca)
{
	for (let i = 0; i < arrayDondeSeBusca.length; i++)
	{
		if (arrayDondeSeBusca[i].habitacion == habitacion)
			return true;
	}
	return false;
}

function getColorTemperatura(temperatura)
{
	let posicionArrayTemperaturas = Math.max(Math.floor(temperatura / 5), 0);

	if (posicionArrayTemperaturas >= COLORES.length)
	{
		posicionArrayTemperaturas = COLORES.length - 1;
	}

	return COLORES[posicionArrayTemperaturas];
}

function getColorHumedad(humedad)
{
	let posicionArrayHumedades = Math.max(Math.floor(humedad / 10), 0);

	if (posicionArrayHumedades >= COLORES.length)
	{
		posicionArrayHumedades = COLORES.length - 1;
	}

	return COLORES[posicionArrayHumedades];
}

module.exports = {
	getDatos,
	obtenerTemperaturas,
	obtenerHumedades,
	actualizarNombresHabitacion
}
