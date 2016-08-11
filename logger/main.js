// Logger
// César González Segura, 2016

// Imports
const fs = require("fs");
const execSync = require("child_process").execSync;

// Global variables
var settings = null;
var data = null;
const settingsPath = "./config.json";

function main()
{
	// Read the logger settings
	settings = JSON.parse(fs.readFileSync(settingsPath));
	
	// Set the data update interval
	setInterval(onUpdateData, settings.updateInterval * 1000);
	
	// Set the saving update interval
	setInterval(onSaveData, settings.saveInterval * 1000);
	
	// Initialize the data
	data = {
		"updateRate": settings.updateInterval,
		"maxReplicas": 0,
		"minReplicas": 0,
		"currentInstances": [
		],
		"desiredInstances" : [
		],
		"cpuLoad": [
		]
	};
}

function saveData(fn, fmt)
{
	if (fmt == "dlm")
	{
		
	}
	else if (fmt == "json")
	{
		fs.writeFileSync(fn, JSON.stringify(data));
	}
}

function onUpdateData()
{
	if (settings.verbose)
	{
		console.log("[UPDATE] Logging new data from Kubernetes cluster...");
	}
	
	// Attempt to run kubectl to retrieve the HPA status
	var result = execSync("kubectl get hpa " + settings.hpaName + " -o json");
	
	console.log(result);
}

function onSaveData()
{
	var fileName = settings.output;
	
	// Check if there are any macros in the
	// filename
	if (fileName.indexOf("[date]") != -1)
	{
		fileName = fileName.replace("[date]", (new Date()).toISOString());
	}
	
	// Append the format extension
	fileName += "." + settings.format;
	
	// Use the appropriate method depending on the
	// output format
	saveData(fileName, settings.format);
	
	if (settings.verbose)
	{
		console.log("[SAVE] Saved result to " + fileName);
	}
}

main();
