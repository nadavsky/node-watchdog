module.exports = [

    {   "pref"    : "watchdog.outputPath",
        "desc"    : "Logs path",
        "default" : "",
        "expected": "string",
        "must"    : true
    },
    {   "pref"    : "watchdog.path",
        "desc"    : "",
        "default" : "",
        "expected": '"string","string"',
        "ui"      : true

    },
    {   "pref"    : "watchdog.mode",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.coverage",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.testsPath",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.jobName",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.testsArray",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.migrationMode",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.documentMode",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.multiply",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.noAPI",
        "desc"    : "Disable all API requests, makes tests run faster",
        "default" : false,
        "ui"      : { "uitype"  : "checkbox", "uilabel" : "No API", "group" : "Run Modes"}
    },
    {   "pref"    : "watchdog.skipPublish",
        "desc"    : "Run test without publishing",
        "default" : false,
        "expected": "boolean",
        "ui"      : { "uishortcut" : true, "uitype"  : "checkbox", "uilabel" : "Skip publish", "group" : "Run Modes"}
    },
    {   "pref"    : "watchdog.runUntilFailure",
        "desc"    : "Run the tests until failure",
        "default" : false,
        "expected": "boolean",
        "ui"  : { "uishortcut" : true, "uitype"  : "checkbox", "uilabel" : "Run until failure", "group" : "Run Modes"}
    },
    {   "pref"    : "watchdog.local",
        "desc"    : "TRUE - we write to the main.log, FALSE - we open a log for each test with the name of the test",
        "default" : false,
        "ui"      : { "uitype"  : "checkbox", "uilabel" : "Write To Main Log", "group" : "Log"}
    },
    {   "pref"    : "watchdog.logLevel",
        "desc"    : 'Can be one of the following "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL","EXCEPTION"',
        "default" : "DEBUG",
        "expected": ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL","EXCEPTION"],
        "ui"  : { "uitype"  : "dropdown", "uilabel" : "Log Level", "group" : "Log"}
    },
    {
        "pref": "watchdog.logConsoleMode",
        "desc": "TRUE - writes to the console, FALSE - writes to output file",
        "default": false,
        "ui"      : { "uitype"  : "checkbox", "uilabel" : "Log Console Mode", "group" : "Log"}
    },
    {   "pref"    : "watchdog.exclusionFile",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.reportName",
        "desc"    : "",
        "default" : ""
    },
    {   "pref"    : "watchdog.testsArrayBaseUrl",
        "desc"    : "the tests folder domain",
        "default" : ""
    },
    {
        "pref": "watchdog.testsArrayPart",
        "desc": "",
        "default": ""
    },
    {
        "pref": "watchdog.testsUrl",
        "desc": "",
        "default": ""
    },
    {
        "pref": "watchdog.user.email",
        "desc": "Email for the login to dashboard",
        "default": "",
        "ui"  : { "uitype"  : "textbox", "uilabel" : "User Email", "group" : "Login"}
    },
    {
        "pref": "watchdog.user.password",
        "desc": "Password for the login to dashboard",
        "default": "",
        "ui"  : { "uitype"  : "password", "uilabel" : "User Password", "group" : "Login"}
    },
    {
        "pref": "watchdog.requireUrl",
        "desc": "The start of the link that points from where to load the components",
        "default": "http://127.0.0.1/other/watchdog-components/",
        "ui"  : { "uitype"  : "textbox", "uilabel" : "Require Url", "group" : "Code Configurations"}
    },
    {
        "pref": "watchdog.lastRunnedTest",
        "desc": "Last loaded test",
        "default": ""
    },
    {
        "pref": "watchdog.justRunGenerate",
        "desc": "if true watchdog will generate file with zapp urls and test names and upload to s3. saveZapps=true, runUntilCommand='designer/publish'",
        "default": false
    },
    {
        "pref": "watchdog.justRun",
        "desc": "if true watchdog will load tests from test file, load zapp urls from s3 and run tests from after publish. runFromCommand='designer/publish/+1'",
        "default": false,
        "ui": { "uitype"  : "checkbox", "uilabel" : "Just run", "group" : "Run Modes"}
    },
    {
        "pref": "watchdog.justRunUrl",
        "desc": "if defined watchdog will load tests from this url in Just run mode",
        "default": "",
        "ui": { "uitype"  : "textbox", "uilabel" : "Just run url", "group" : "Run Modes"}
    },
    {
        "pref": "watchdog.saveZapps",
        "desc": "if true watchdog will not delete generated zapps after publish, forced to true if watchdog.justRunGenerate is true",
        "default": false
    },
    {
        "pref": "watchdog.dashboardMode",
        "desc": "Are we use the Dashboard or not ",
        "default": true
    },
    {
        "pref": "watchdog.extWin",
        "desc": "Run the zapp in new clean window ",
        "default": true
    },
    {
        "pref": "watchdog.runUntilCommand",
        "desc": "Run test until first encountered command syntax: 'commandModule/commandName/shift' example: 'designer/publish/+1' will run from first command after publish",
        "default": true
    },
    {
        "pref": "watchdog.runFromCommand",
        "desc": "Run test from first encountered command syntax: 'commandModule/commandName/shift' example: 'designer/publish/+1' will run untill first command after publish including",
        "default": true
    }
];


