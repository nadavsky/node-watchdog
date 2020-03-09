# node-watchdog

Run watchdog scripts with node.js , supports JUnit report.

How to use:
1. clone the project.
2. cd node-watchdog.
3. node watchdog.js <path to test | path to tests folder | test url> <options>

NOTE: config file is also supported (example) :
./node-watchdog/config.json : 
 {
   "watchdog_requireUrl": "http://localhost/watchdog-components/",
   "watchdog_path": "http://localhost/watchdog/test.js",
   "watchdog_logLevel": "DEBUG",
   "watchdog_logConsoleMode": true
 }

options:

--watchdog_outputPath /your/output/path

--watchdog_runUntilFailure true/false

--watchdog_logLevel Can be one of the following "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL","EXCEPTION" 

--watchdog_logConsoleMode "TRUE - writes to the console, FALSE(default) - writes to output file" 

--watchdog_requireUrl base url of watchodg components


