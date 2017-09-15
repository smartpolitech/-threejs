/* ---------------- VARIABLES GLOBALES --------------------- */

// Render
var Render = new THREE.WebGLRenderer();

var ancho = $("#render").width();
var alto = $("#render").height();

// Escenario
var Escenario;

//Teclado
var teclado;

//Posiciones buenas de la cámara
var CAMX = 33, CAMY = 47, CAMZ = 28;
var CAMRX = -0.7408537006636182, CAMRY = 0.29919445016969104, CAMRZ = 0.2633346990493383;

// Controles y cámara
var controls, Camara;

// Cargador de modelos
var loader = new THREE.JSONLoader();

/* Variables para mostrar el modelo */
var pabellonActivo, plantaActiva;

/* Variables referentes a la muestra de colores en tiempo real según temperatura o grados de humedad */
var temperaturasPared = false;
var humedadesPared = false;
var backupDeMaterialesOriginales = [];

var temperaturasPorHabitacion = [];
var humedadesPorHabitacion = [];

/* Esta variable permanecerá verdadera mientras dura el proceso de cambiar los materiales de las temperaturas a tiempo real. Se hace de esta manera para evitar errores a la hora de seleccionar una habitacion mientras esta está cambiando sus materiales */
var cambiandoColoresHabitacion = false;

/* Hover */
var projector, mouse = { x: 0, y: 0 }, INTERSECTED, INTERSECTEDMATERIAL, TARGET;
var raycaster = new THREE.Raycaster();

/* Colores */
var SELECCIONADO; /* Color cuando pasa el ratón por encima de una habitación */

/* Si está vacío, es por que el servidor de lectura está en la misma IP */
var URL_SERVIDOR = "";

/* Intervalo de tiempo por el que se hacen peticiones para averiguar la temperatura y humedad */
var INTERVALO_TIEMPO;

/* URL para la lectura de datos */
SERVIDOR_LECTURA_DATOS = URL_SERVIDOR + "/api/obtenerDatos";
SERVIDOR_LECTURA_TEMPERATURAS = URL_SERVIDOR + "/api/obtenerTemperaturas";
SERVIDOR_LECTURA_HUMEDADES = URL_SERVIDOR + "/api/obtenerHumedades";
SERVIDOR_LECTURA_NOMBRES = URL_SERVIDOR + "api/obtenerNombresHabitacion";

var cargados = 0;

/* Botones de la interfaz */
$("#pabellonInformatica").click(function(){ pabellonActivo = "INF"; cambiarPiso();});
$("#pabellonCentral").click(function(){ pabellonActivo = "SCO"; cambiarPiso();});
$("#pabellonObrasPublicas").click(function(){ pabellonActivo = "OPU"; cambiarPiso();});
$("#pabellonArquitectura").click(function(){ pabellonActivo = "ATE"; cambiarPiso();});
$("#pabellonTeleco").click(function(){ pabellonActivo = "TEL"; cambiarPiso();});
$("#pabellonInvestigacion").click(function(){ pabellonActivo = "INV"; cambiarPiso();});
$("#pabellonComunicaciones").click(function(){ pabellonActivo = "AIN"; cambiarPiso();});
$("#planta0").click(function(){ plantaActiva = "P00"; cambiarPiso();});
$("#planta1").click(function(){ plantaActiva = "P01"; cambiarPiso();});
$("#planta2").click(function(){ plantaActiva = "P02"; cambiarPiso();});
$("#sotano").click(function(){ plantaActiva = "PS1"; cambiarPiso();});
$("#temperaturasPared").click(activacionTemperaturas);
$("#humedadesPared").click(activacionHumedades);
// función que se ejecuta cuando se mueve el ratón, y que sirve para el hover
document.addEventListener( 'mousemove', onDocumentMouseMove, false );

function inicio()
{
	// Cambiamos el tamaño del render y lo agregamos
	Render.setSize(ancho, alto);
	document.getElementById("render").appendChild(Render.domElement);

	Camara = new THREE.PerspectiveCamera(45, ancho / alto, 1, 1000 );

	// Inicialización del Escenario
	Escenario = new THREE.Scene();

	//Teclado
	teclado = new THREEx.KeyboardState();

	Camara.useTarget = false;
	Camara.position.set(parseFloat(CAMX), parseFloat(CAMY), parseFloat(CAMZ));
	Camara.rotation.set(CAMRX, CAMRY, 0);
	console.log("Todo Cargado");

	// Agregamos la cámara al escenario
	Escenario.add(Camara);

	// Cargamos la luz
	cargarLuz();

	/* Establecemos por defecto el pabellón de informática planta 0*/
	pabellonActivo = "INF";
	plantaActiva = "P00";

	// Cargamos el modelo de uno de los pabellones
	mostrarPiso();

	/* Controlador de cámara para el ratón */
	controls = new THREE.OrbitControls(Camara, Render.domElement);
	controls.update();

	// Para impedir que se puedan mover los modelos con las teclas
	controls.enableKeys = false;

	// initialize object to perform world/screen calculations
	projector = new THREE.Projector();

	/* Color para el hover al ir seleccionando */
	SELECCIONADO = new THREE.MeshLambertMaterial({ color: 0x668899} );

	/* Definimos el intervalo de tiempo en milisegundos. 60000 = 1 minuto */
	INTERVALO_TIEMPO = 60000;
}

/* Función que resalta una habitacion cuando se pasa el ratón por erncima de ella */
function onDocumentMouseMove( event )
{
	/* FLAG DE SEGURIDAD. Mientras se está llevando el proceso de cambiar le material de las habitaciones según su tempertura en tiempo real, no es posible utilizar el hover.
	De esta manera se evita la posible alteración al pasar el ratón mientras se cambian los materiales */
	if (!cambiandoColoresHabitacion)
	{
		// Obtenemos primero la posición del div que tiene el renderizador
		var rect = Render.domElement.getBoundingClientRect();

		// Calculamos la posición del ratón
		mouse.x = ( ( event.clientX - rect.left ) / rect.width ) * 2 - 1;
		mouse.y = - ( ( event.clientY - rect.top ) / rect.height ) * 2 + 1;

		raycaster.setFromCamera( mouse, Camara );

		intersects = raycaster.intersectObjects( Escenario.children );

		if ( intersects.length > 0)
		{
			/* Preguntamos si el objeto nuevo que se ha pasado el ratón por encima es diferente al anterior y que además no corresponda al modelo BASE
			BASE es la parte  de modelo de la cual no hay datos, por lo que no es necesario interactuar con el */
			if ( intersects[0].object != INTERSECTED && intersects[0].object.habitacion != "BASE")
			{
				// Restauramos el color original del anterior (Si existe)
				if ( INTERSECTED )
				{
					if (Array.isArray(INTERSECTEDMATERIAL))
					{
						INTERSECTED.material = INTERSECTEDMATERIAL.slice();
					}
					else
					{
						INTERSECTED.material = INTERSECTEDMATERIAL;
					}
				}

				// Almacenanos en INTERSECTED el nuevo objeto al cual se le ha pasado el ratón por encima
				INTERSECTED = intersects[0].object;

				// Guardamos el material del nuevo seleccionado. El cual puede ser un array de materiales o un color sólido (Como es el caso de las temperaturas o humedades en tiempo real)
				if (Array.isArray(INTERSECTED.material))
				{
					INTERSECTEDMATERIAL = INTERSECTED.material.slice();
				}
				else
				{
					INTERSECTEDMATERIAL = INTERSECTED.material;
				}

				INTERSECTED.material = SELECCIONADO;
			}
		} 
		else // En caso de no encontrar nada
		{
			// Restauramos el material de la intersección previa (en caso de que exista)
			if ( INTERSECTED )
			{
				if (Array.isArray(INTERSECTEDMATERIAL))
				{
					INTERSECTED.material = INTERSECTEDMATERIAL.slice();
				}
				else
				{
					INTERSECTED.material = INTERSECTEDMATERIAL;
				}
			}
			// Eliminamos la intersección previa
			INTERSECTED = null;
		}
	}
}

/* Carga las luces necesarias para visualizar el modelo dentro de la aplicación */
function cargarLuz()
{
	var luz = new THREE.PointLight(0xffffff);
	luz.position.set(-100, 200, 100);
	Escenario.add(luz);

	var luz2 = new THREE.PointLight(0xffffff);
	luz2.position.set(100, 0, 0);
	Escenario.add(luz2);
}

/* Esta es la función de callback */
function animacion()
{
	requestAnimationFrame(animacion);
	// Agregamos todo el escenario y la cámara al render
	Render.render(Escenario, Camara);
}

/* Elimina el piso mostrado por pantalla */
function eliminarPiso()
{
	while(Escenario.children.length > 0)
	{ 
		Escenario.remove(Escenario.children[0]); 
	}
}

/* Carga el modelo de un piso y lo muestra por pantalla */
function mostrarPiso()
{
	let urlCarpetaModelo = "modelos/" + pabellonActivo + "/" + plantaActiva + "/";
	let urlModelo = urlCarpetaModelo +  "datos.js";

	$.ajax({
		dataType: "text",
		url: urlModelo,

		success: function(respuesta)
		{
			ficheros = JSON.parse(respuesta);

			for (i = 0; i < ficheros.Edificio.length; i++)
			{
				let habitacion = ficheros.Edificio[i].habitacion;
				let nombre = (ficheros.Edificio[i].nombre) ? ficheros.Edificio[i].nombre : "";

				loader.load(urlCarpetaModelo + ficheros.Edificio[i].nombreFichero,	function (geometry, materials)
				{
					let object = new THREE.Mesh(geometry, materials);
					object.habitacion = habitacion;
					/* Esta variable se usa para saber si se le ha cambiado el color con las temperaturas o humedad, ya que si está en verdadero existe un backup de los colores originales */
					object.colorCambiado = false;
					/* Nombre no nemotécnico en caso de que exista */
					object.nombre = nombre;
					Escenario.add(object);
				});
			}
		}
	});
}

/* Función para eliminar el piso mostrado actualmente y recargar el nuevo seleccionado */
function cambiarPiso()
{
	eliminarPiso();

	/* Establecemos las temperaturas a tiempo real en falso de nuevo */
	if (temperaturasPared)
	{
		desactivarBotonTemperaturasEnTiempoReal();
	}

	if (humedadesPared)
	{
		desactivarBotonHumedadesEnTiempoReal();
	}

	backupDeMaterialesOriginales = [];
	obtenerTemperaturas();
	obtenerHumedades();

	cargarLuz();
	segundaPlanta();
	sotano();
	mostrarPiso();
	actualizarInformacionEdificiodInterfaz();
}

/* Comprueba si el pabellón escogido posee una segunda planta (Como es el caso de obras públicas o investigación) */
function segundaPlanta()
{
	if (pabellonActivo == "SCO" || pabellonActivo == "INV")
	{
		$("#botonSegundaPlanta").show();
	}
	else
	{	
		$("#botonSegundaPlanta").hide();

		if (plantaActiva == "P02")
			plantaActiva = "P00";
	}
}

function sotano()
{
	if (pabellonActivo == "INF" || pabellonActivo == "TEL" || pabellonActivo == "INV")
	{
		$("#botonSotano").show();
	}
	else
	{
		$("#botonSotano").hide();

		if (plantaActiva == "PS1")
			plantaActiva = "P00";
	}
}

/* Cargar los datos del edificio seleccionado */
$("#render").click(function()
{
	if(!cambiandoColoresHabitacion)
	{
		if (INTERSECTED !=null && INTERSECTED.habitacion != "BASE")
		{
			TARGET = INTERSECTED;
			if (TARGET.nombre != "")
			{
				$("#nombreHabitacion").html("<strong>" + TARGET.nombre + "</strong> (" + TARGET.habitacion + ")");
			}
			else
			{
				$("#nombreHabitacion").html(TARGET.habitacion);
			}
			obtenerDatos();		
		}
	}
});

/* Funcion que cambia el mostrado de las temperaturas en tiempo real */
function activacionTemperaturas()
{
	desactivarTarget();

	// Si estaba desactivada, la activamos y hacemos una copia de los materiales utilizados
	if (temperaturasPared == false)
	{
		if (humedadesPared)
		{
			desactivarBotonHumedadesEnTiempoReal();
		}

		activarBotonTemperaturasEnTiempoReal();
	}
	else
	{
		desactivarBotonTemperaturasEnTiempoReal();
	}

	activarTarget();
}

function activacionHumedades()
{
	desactivarTarget();

	/* En caso de que no se estén mostrando las habitaciones según su grado de humedad */
	if (humedadesPared == false)
	{
		/* Comprobamos si está activo el cambio de color de las paredes con respecto a la temperatura. Si lo está, no realizamos un backup de los materiales originales y activamos temperaturasPared */
		if (temperaturasPared)
		{
			desactivarBotonTemperaturasEnTiempoReal();
		}

		activarBotonHumedadesEnTiempoReal();

	} /* Y aquí en caso de que si se estén mostrando las habitaciones según su grado de humedad */
	else
	{
		desactivarBotonHumedadesEnTiempoReal();
	}

	activarTarget();
}

/* Método utilizado para obtener las temperaturas de una planta y edificio determinados */
function obtenerTemperaturas()
{
	$.ajax({
		type: "POST",
		url: SERVIDOR_LECTURA_TEMPERATURAS,
		data: {
		'planta': plantaActiva,
		'edificio': pabellonActivo
	 	},

		success: function(respuesta)
		{
			/* Vaciamos primero el array por si acaso */
			temperaturasPorHabitacion = [];

			/* Se rellena el Array con los nuevos colores respecto a la temperatura */
			temperaturasPorHabitacion = JSON.parse(respuesta);

			/* Comprobamos antes si hay algún problema con los datos recibidos. En caso de no encontrar nada, devuevle un error que se muestra y vaciamos el array */
			if (temperaturasPorHabitacion.error)
			{
				console.info("ADVERTENCIA: " + temperaturasPorHabitacion.error);
				temperaturasPorHabitacion = [];
			}
		}
	});
}

/* Método utilizado para obtener las temperaturas de una planta y edificio determinados */
function obtenerHumedades()
{
	$.ajax({
		type: "POST",
		url: SERVIDOR_LECTURA_HUMEDADES,
		data: {
		'planta': plantaActiva,
		'edificio': pabellonActivo
	 	},

		success: function(respuesta)
		{
			/* Vaciamos primero el array por si acaso */
			humedadesPorHabitacion = [];

			/* Se rellena el Array con los nuevos colores con respecto al grado de humedad */
			humedadesPorHabitacion = JSON.parse(respuesta);

			/* Comprobamos antes si hay algún problema con los datos recibidos. En caso de no encontrar nada, devuevle un error que se muestra y vaciamos el array */
			if (humedadesPorHabitacion.error)
			{
				console.info("ADVERTENCIA: " + humedadesPorHabitacion.error);
				humedadesPorHabitacion = [];
			}
	}
	});
}


/* El primer parámetro indica el número de habitación que se va a cambiar, el segundo la temperatura de la misma y el tercer parámetro indica si hay que hacer un backup del material original.
El backup es necesario si se está mostrando el modelo original sin temperaturas en tiempo real, mientras que no se realiza si ya se están mostrando a tiempo real y solo hay que actualizar visualmente el color de la temperatura */
function cambiarColorHabitacion(habitacion, colorHabitacion, backupDeMateriales)
{
	let objeto  = new Object();

	/* Primero buscamos el objeto en la escena que tenga el mismo nombre de habitación */
	for (let i = 0; i < Escenario.children.length; i++)
	{
		if (Escenario.children[i].habitacion && Escenario.children[i].habitacion == habitacion)
		{
			if (backupDeMateriales)
			{
				objeto.habitacion = Escenario.children[i].habitacion;

				/* Hay que comprobar si el material está formado por varios (array) o color único, para que no de errores durante la copia o sustitución */
				if (Array.isArray(Escenario.children[i].material))
				{
					objeto.material = Escenario.children[i].material.slice();
				}
				else
				{
					objeto.material = Escenario.children[i].material;
				}
				backupDeMaterialesOriginales.push(objeto);
			}
			Escenario.children[i].material = new THREE.MeshLambertMaterial({ color: colorHabitacion} );
			Escenario.children[i].colorCambiado = true;
		}
	}
}

/* Restaura los materiales del piso cargados originalmente */
function restaurarMaterialesHabitacion(habitacionCambiada)
{
	for (let i = 0; i < backupDeMaterialesOriginales.length; i++)
	{
		/* Encontrados sus materiales originales y procedemos a sustituirlos */
		if (backupDeMaterialesOriginales[i].habitacion == habitacionCambiada.habitacion)
		{
			if (Array.isArray(backupDeMaterialesOriginales[i].material))
			{
				habitacionCambiada.material = backupDeMaterialesOriginales[i].material.slice();
			}
			else
			{
				habitacionCambiada.material = backupDeMaterialesOriginales[i].material;
			}
			habitacionCambiada.colorCambiado = false;
		}
	}
}

/* Obtiene los datos de los sensores asociados a una habitacion, planta y edificio */
function obtenerDatos()
{
	/* Primero, comprobamos si hay alguna sala targeteada */
	if (TARGET)
	{
		$.ajax({
			type: "POST",
			url: SERVIDOR_LECTURA_DATOS,
			data: {
			'habitacion': TARGET.habitacion,
			'planta': plantaActiva,
			'edificio': pabellonActivo
		 	},

			success: function(respuesta)
			{
				var informacionSala = JSON.parse(respuesta);
				actualizarDatosSensores(informacionSala);
			}
		});
	}
}

/* Función para actualizar en pantalla los datos recopilados de los sensores. */
function actualizarDatosSensores(datos)
{
	/* Vaciamos la tabla para añadir nuevos elementos */
	$("#tablaDatos tr").remove();
	$("#tablaDatos").append("<tr></tr>");

	/* Si hay algún mensaje de error, lo mostramos y si no, mostramos el contenido de los datos recibidos */
	if (datos.error)
	{
		$('#tablaDatos tr:last').after('<tr><td colspan="2" class="alert alert-danger">' + datos.error + '</td></tr>');
	}
	else
	{
		for (var i = 0; i < datos.length; i++)
		{
			/* Mostramos primero los datos mas relevantes*/
			$('#tablaDatos tr:last').after('<tr class="nombreSensor" ><td>Sensor</td><td>' + datos[i].sensor + '</td></tr>');
			$('#tablaDatos tr:last').after('<tr class="fechaSensor" ><td colspan="2">' + datos[i].time + '</td></tr>');
			for(var indice in datos[i])
			{
				if (indice != "sensor" && indice != "time")
				$('#tablaDatos tr:last').after('<tr><td>' + indice + '</td><td>' + datos[i][indice] + '</td></tr>');
			}
		}
	}
}

/* Función que se ejecuta cada minuto y comprueba si están activadas las temperaturas en tiempo real. En caso de que estén activas, actualiza sus valores y cambia los colores */
function actualizarEnTiempoReal()
{
	/* Función que obtiene los valores actuales de temperaturas y humedad para las paredes y si está activa alguna de las dos las muestra */
	obtenerTemperaturas();
	obtenerHumedades();

	if (temperaturasPared == true)
	{
		for (let i = 0; i < temperaturasPorHabitacion.length; i++)
		{
			cambiarColorHabitacion(temperaturasPorHabitacion[i].habitacion, temperaturasPorHabitacion[i].temperatura, false);
		}
	}

	if (humedadesPared == true)
	{
		for (let i = 0; i < humedadesPorHabitacion.length; i++)
		{
			cambiarColorHabitacion(humedadesPorHabitacion[i].habitacion, humedadesPorHabitacion[i].humedad, false);
		}
	}
}

function actualizarInformacionEdificiodInterfaz()
{
	let tituloEdificio, plantaEdificio;

	switch(pabellonActivo)
	{
		case "ATE":
			tituloEdificio = "Pabellón de Arquitectura";
		break;
		case "INF":
			tituloEdificio = "Pabellon de Informática";
		break;
		case "INV":
			tituloEdificio = "Edificio de Investigación";
		break;
		case "OPU":
			tituloEdificio = "Pabellón de Obras Públicas";
		break;
		case "SCO":
			tituloEdificio = "Edificio de Usos Comunes";
		default:
		case "TEL":
			tituloEdificio = "Pabellón de Telecomunicaciones";
		break;
	}

	switch(plantaActiva)
	{
		case "P00":
			plantaEdificio = "Planta Baja";
		break;
		case "P01":
			plantaEdificio = "Primera Planta";
		break;
		case "P02":
			plantaEdificio = "Segunda Planta";
		break;
		case "PS1":
			plantaEdificio = "Planta Sótano 1";
		break;
	}

	$("#tituloEdificio").html("<h2>" + tituloEdificio + "</h2>");
	$("#plantaEdificio").html("<h3>" + plantaEdificio + "</h3>");
}

/* Sustituye los materiales originales por el color correspondiente al de sus temperaturas (si la hubiera) y además crea una copia del material original*/
function activarBotonTemperaturasEnTiempoReal()
{
	for (let i = 0; i < temperaturasPorHabitacion.length; i++)
	{
		cambiarColorHabitacion(temperaturasPorHabitacion[i].habitacion, temperaturasPorHabitacion[i].temperatura, true);
	}

	$("#temperaturasPared").attr("src", "img/botones/botonTemperaturaActivo.png");
	temperaturasPared = true;
}

function desactivarBotonTemperaturasEnTiempoReal()
{
	for (let i = 0; i < Escenario.children.length; i++)
	{
		/* Preguntamos si se ha cambiado su material original, por el de una temperatura o humedad a tiempo real */
		if (Escenario.children[i].colorCambiado == true)
		{
			restaurarMaterialesHabitacion(Escenario.children[i]);
		}
	}

	$("#temperaturasPared").attr("src", "img/botones/botonTemperatura.png");
	temperaturasPared = false;
	backupDeMaterialesOriginales = [];
}

function activarBotonHumedadesEnTiempoReal()
{
	for (let i = 0; i < humedadesPorHabitacion.length; i++)
	{
		cambiarColorHabitacion(humedadesPorHabitacion[i].habitacion, humedadesPorHabitacion[i].humedad, true);
	}
	$("#humedadesPared").attr("src", "img/botones/botonHumedadActivo.png");
	humedadesPared = true;
}

function desactivarBotonHumedadesEnTiempoReal()
{
	for (let i = 0; i < Escenario.children.length; i++)
	{
		/* Preguntamos si se ha cambiado su material original, por el de una temperatura o humedad a tiempo real */
		if (Escenario.children[i].colorCambiado == true)
		{
			restaurarMaterialesHabitacion(Escenario.children[i]);
		}
	}

	$("#humedadesPared").attr("src", "img/botones/botonHumedad.png");
	humedadesPared = false;
	backupDeMaterialesOriginales = [];
}

function activarTarget()
{
	cambiandoColoresHabitacion = false;
}

function desactivarTarget()
{
	cambiandoColoresHabitacion = true;
}

inicio();
obtenerTemperaturas();
obtenerHumedades();
segundaPlanta();
sotano();

setInterval(actualizarEnTiempoReal, INTERVALO_TIEMPO);

animacion();