"use strict"

var express = require("express");
var LecturaController = require("../controladores/lectura.js");
var api = express.Router();

api.post("/obtenerDatos", LecturaController.getDatos);
api.post("/obtenerTemperaturas", LecturaController.obtenerTemperaturas);
api.post("/obtenerHumedades", LecturaController.obtenerHumedades);
api.post("/actualizarNombresHabitacion", LecturaController.actualizarNombresHabitacion);

module.exports = api;