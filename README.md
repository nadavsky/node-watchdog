# node-watchdog

Run watchdog scripts with node.js , supports JUnit report.

How to use:
1. clone the project.
2. cd node-watchdog.
3. node watchdog.js <path to test | path to tests folder | test url> <options>


options:

--watchdog_outputPath /your/output/path

--watchdog_runUntilFailure true/false

--watchdog_logLevel Can be one of the following "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL","EXCEPTION" 

--watchdog_logConsoleMode "TRUE - writes to the console, FALSE(default) - writes to output file" 

--watchdog.requireUrl base url of watchodg components


