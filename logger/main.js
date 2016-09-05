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
		"targetCpu": 0,
		"timeStamp": new Array(),
		"currentInstances": new Array(),
		"desiredInstances" : new Array(),
		"cpuLoad": new Array(),
		"mysqlMemUsage": new Array(),
		"mysqlCpuUsage": new Array()
	};
}

function saveData(fn, fmt)
{
	if (fmt == "dlm")
	{
		// Save the const settings as a separate dlm file
		// if it doesn't exist
		var constFn = "hpa_const.dlm";
		
		try
		{
			fs.statSync(constFn);
		}
		catch (e)
		{
			var dt = data.updateRate + " " + data.maxReplicas + " " + data.minReplicas +
					 " " + data.targetCpu;
			fs.writeFileSync(constFn, dt);
		}
		
		// Save the logged data as a dlm matrix
		// Column format:
		// | Time | CurrentInstances | DesiredInstances | CPULoad |
		var dt = "";
		
		for (var i = 0; i < data.timeStamp.length; i++)
		{
			dt += data.timeStamp[i].getTime().toString() + " " + data.currentInstances[i] + " " + data.desiredInstances[i] +
				  " " + data.cpuLoad[i] + " " + data.mysqlMemUsage[i] + " " + data.mysqlCpuUsage[i] + "\n";
		}
		
		fs.writeFileSync(fn, dt);
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
	var jr = JSON.parse(result.toString());
	
	// Add timestamp
	data.timeStamp.push(new Date());
	
	// Add current instance count
	data.currentInstances.push(jr.status.currentReplicas);
	
	// Add desired instance count
	data.desiredInstances.push(jr.status.desiredReplicas);
	
	// Add current CPU load
	data.cpuLoad.push(jr.status.currentCPUUtilizationPercentage);
	
	// Update the const settings
	data.maxReplicas = jr.spec.maxReplicas;
	data.minReplicas = jr.spec.minReplicas;
	data.targetCpu = jr.spec.targetCPUUtilizationPercentage;
	
	// Request to Heapster the MySQL pod current memory usage
	var mem = requestMysqlMemoryUsage();
	data.mysqlMemUsage.push(mem);
	
	// Request the MySQL CPU usage
	var cpu = requestMysqlCpuUsage();
	data.mysqlCpuUsage.push(cpu);
	
	if (settings.verbose)
	{
		console.log("[UPDATE] HPA status (" + data.timeStamp[data.timeStamp.length - 1].toISOString() + "):");
		console.log("[UPDATE] Current replicas: " + data.currentInstances[data.currentInstances.length - 1]);
		console.log("[UPDATE] Desired replicas: " + data.desiredInstances[data.desiredInstances.length - 1]);
		console.log("[UPDATE] Current CPU load: " + data.cpuLoad[data.cpuLoad.length - 1]);
		console.log("[UPDATE] Current MySQL status: " + cpu + "% / " + mem / 1000000.0 + " MB");
	}
}

function requestMysqlMemoryUsage()
{
	var url = "https://" + settings.kubeAddr + "/api/v1/proxy/namespaces/kube-system/services/heapster/api/v1/model/namespaces/default/pods/" + settings.mysqlPodName + "/metrics/memory/usage";
	var result = execSync("curl -k -u admin:" + settings.kubePass + " " + url);
	var jr = JSON.parse(result.toString());
	
	return jr.metrics[jr.metrics.length - 1].value;
}

function requestMysqlCpuUsage()
{
	var url = "https://" + settings.kubeAddr + "/api/v1/proxy/namespaces/kube-system/services/heapster/api/v1/model/namespaces/default/pods/" + settings.mysqlPodName + "/metrics/cpu/usage_rate";
	var result = execSync("curl -k -u admin:" + settings.kubePass + " " + url);
	var jr = JSON.parse(result.toString());
	
	return jr.metrics[jr.metrics.length - 1].value;
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
