//============================================================================
// Name        : conversorModelos.cpp
// Author      : Jose Luis Martin Avila
// Version     :
// Copyright   : Your copyright notice
// Description : Hello World in C++, Ansi-style
//============================================================================

#include <iostream>
#include <vector>
#include <string>
#include <windows.h>
#include <dirent.h>
#include <io.h>
#include <stdio.h>
#include <fstream>

using namespace std;

/* VARIABLES GLOBALES */

ofstream FICHERO_JSON("datos.js");

/* Indica si el fichero es un OBJ */
bool esFicheroObjeto(string nombreFichero)
{
	if (nombreFichero.substr(nombreFichero.find_last_of(".") + 1) == "obj")
	{
		return true;
	}
	return false;
}

/* Establece la primera línea del fichero de datos */
void iniciarJson()
{
	system("md Convertido");
	FICHERO_JSON<<"{\n\"Edificio\": ["<<endl;
}

/* Cada línea que escribe contiene los metadatos de cada submodelo */
void escribirEnJson(string nombreFichero, bool &esPrimero)
{
	string habitacion = nombreFichero.substr(0, nombreFichero.find("."));
	/* Siempre escribe una "," y salto de línea primero, antes de escribir la línea con la información.
	De esta forma no es neceasrio hacer ninguna operación extra al escribir la última (que no lleva una coma al final)
	En caso de ser la primera línea, no escribe la coma para evitar que salga al principio. El resultado total es un fichero en formato JSON */
	if (!esPrimero)
	{
		FICHERO_JSON<<","<<endl;
	}
	else
	{
		esPrimero = false;
	}
	FICHERO_JSON<<"\t{ \"nombreFichero\":\""<<habitacion<<".js\" , \"habitacion\":\""<<habitacion<<"\" }";
}

/* Cierra el fichero JSON escribiendo los últimos caracteres necesarios para completar la estructura */
void finalizarJson()
{
	FICHERO_JSON<<endl<<"]\n}";
	FICHERO_JSON.close();
	string comandoMoveJS = "MOVE datos.js Convertido\\datos.js";
	system(comandoMoveJS.c_str());
}

/* Ejecuta la orden para convertir el fichero, con el script de Python que debe estar en la misma ruta de ejecución */
void lanzarConversor(string nombreFichero)
{
	/* python convert_obj_three_for_python3.py -i PabellonInformatica2.obj -o pabellonInformatica.js */
	string nombreFicheroSinExtension = nombreFichero.substr(0, nombreFichero.find("."));
	string ficheroSalida = nombreFicheroSinExtension + ".js";

	string comando = "python convert_obj_three_for_python3.py -i " + nombreFichero + " -o " + ficheroSalida;
	string comandoMoveJS = "MOVE " + ficheroSalida + " Convertido\\" + ficheroSalida;
	string comandoMove = "COPY " + nombreFicheroSinExtension + "\\*.* Convertido\\*.* /Y";

	/* Para mostrar durante la conversión */
	cout<<"Convirtiendo "<<nombreFichero<<endl<<"----------------------------------------------------"<<endl;
	system(comando.c_str());
	system(comandoMoveJS.c_str());
	system(comandoMove.c_str());
	cout<<"------------------------------------------------------------------------------------------"<<endl;
}

int main() {

	vector<string> cadenas;

	DIR *dir;
	struct dirent *ent;
	bool esPrimero = true;

	iniciarJson();
	if ((dir = opendir (".")) != NULL)
	{
		/* Recorremos todos los archivos del directorio y comprobamos si es un fichero que contenga un modelo para ser convertido a .js */
		while ((ent = readdir (dir)) != NULL)
		{
			if (esFicheroObjeto(ent->d_name))
			{
				escribirEnJson(ent->d_name, esPrimero);
				lanzarConversor(ent->d_name);
			}
		}
		closedir (dir);

		/* Finalizamos el JSON */
		finalizarJson();

		system("pause");
	}
	else
	{
		/* could not open directory */
		perror ("");
		return EXIT_FAILURE;
	}
}
