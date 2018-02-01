//var  Configurator, UiController, jrManager;
const TEST_START_INDEX = 100;

var _Configurator= require("./Configurator");
var LoggerClass= require("./Logger");
var Loader= require("./Loader");
var RunnableTest= require("./RunnableTest");
var Reporter= require("./Reporter");
var fs = require("fs");


TestMgr = module.exports = {
    Loader              : {},
    Tests               : [],
    TestsIdsQueueForRun : [],
    ClearTestCacheAuto  : false,
    abortRun            : false,

    init : function(){
        function initTests(error) {
            if(error) TestMgr.quit();
            console.log("4. Load the tests suite and compile the tests -> Update the UI");
            TestMgr.loadTestsAndCompile(TestMgr.runInSelectedMode);
        }

        console.log("1. Loading Logger Configurations");
        global.Configurator = Configurator = new _Configurator();
        Configurator.prepareLoggerConfig();

        console.log("2. Loading Logger");
        global.Logger = new LoggerClass(Configurator.data.logPath, null, Configurator.data.logLevel, null
            ,Configurator.data.logConsoleMode);
        process.on('uncaughtException',this.quit)

        //console.log("2*. Some small preparations");
        //TestMgr._exceptionRecorder.start();

        /*console.log("3. Initizalize UI");
        UiController = new UIController();
        this._initEventListeners();

        UiController.Dispatcher.trigger("set/settings", Object.keys(Configurator.ff_prefs).map(key => Configurator.ff_prefs[key]).filter(pref => !!pref.ui));
        UiController.Dispatcher.trigger("set/runState",  Configurator.checkTheStateOfTestMgr());*/

        //runMode == "error" ? TestMgr.sendError("You have mismatch of prefs, please select one of the available modes (devMode/Browser/Dashboard)") : UiController.Dispatcher.trigger("set/runmode", Configurator.getMode());



       initTests();
    },

    _initEventListeners(){
        UiController.Dispatcher.on("test/run",  this._onTestRun);
        UiController.Dispatcher.on("tests/run", this._onTestsRun);
        UiController.Dispatcher.on("pref/change", this._onPrefChange);
        UiController.Dispatcher.on("reload", this._onReload);
        UiController.Dispatcher.on("abort/current/test", this._onAbort);
        UiController.Dispatcher.on("config/runStateChange", this._onConfigChange);
        UiController.Dispatcher.on("runmode/change", this._runModeChange);
    },

    _runModeChange(mode){
        switch(mode) {
            case "devMode"   : {
                Configurator.updateState({devMode: true, dashboard: false, extWin: false, publish:false, noAPI: false});
                UiController.Dispatcher.trigger("update/settings", Object.keys(Configurator.ff_prefs).map(key => Configurator.ff_prefs[key]).filter(pref => !!pref.ui));
                break;
            }
            case "dashboard" : {
                Configurator.updateState({devMode: false, dashboard: true, extWin: false, publish:true, noAPI: false});
                UiController.Dispatcher.trigger("update/settings", Object.keys(Configurator.ff_prefs).map(key => Configurator.ff_prefs[key]).filter(pref => !!pref.ui));
                break;
            }
            case "extWin"    : {
                Configurator.updateState({devMode: false, dashboard: false, extWin: true, publish:true, noAPI: false});
                UiController.Dispatcher.trigger("update/settings", Object.keys(Configurator.ff_prefs).map(key => Configurator.ff_prefs[key]).filter(pref => !!pref.ui));
                break;
            }
        };

    },

    _onConfigChange(state){
        var result = Configurator.isValidState(state);
        if(result.valid){
            Configurator.updateState(state);
        }
        else {
            UiController.Dispatcher.trigger("set/runStateUpdate",  result.state);
        }
    },

    _onAbort(){
        TestMgr.Tests[TestMgr.CurrentRunningTest].test.abort();
        TestMgr.abortRun = true;
    },

    _onReload(path){
        if(!path){
            TestMgr.sendError(`Please insert a path ${path}`, "Fatal");
            return;
        }

        if(path){
            try{
                if(Configurator.isValidPath(path) == false){
                    TestMgr.sendError(`Failed to load the path ${path}`, "Fatal");
                    return;
                }
                else{
                    var curr_path = `${path},${Configurator.ff_prefs["watchdog_path"].value}`;
                    var unique = curr_path.split(",").filter(function(item, i, ar){ return ar.indexOf(item) === i; });
                    Configurator.updateFFPrefs("watchdog.path",unique.join(","));
                    TestMgr.loadTestsAndCompile(TestMgr.runInSelectedMode);
                }
            }
            catch(ex){
                TestMgr.sendError(`Failed to load the path ${path}`, "Fatal");
                return;
            }
        }


    },

    _onPrefChange(prefs){


            Configurator.updateFFPrefs(prefs.pref,prefs.value);
            if(prefs.pref.includes("logLevel") || prefs.pref.includes("local")) Configurator.prepareLoggerConfig();
        /*}

        if(prefs.pref === "watchodg.devMode"){
            Configurator.updateFFPrefs("watchdog.skipPublish", true);
            Configurator.readConfigurations();
            UiController.Dispatcher.trigger("update/settings", Object.keys(Configurator.ff_prefs).map(key => Configurator.ff_prefs[key]).filter(pref => !!pref.ui));
        }*/
    },

    _onTestRun(runInfo){
        TestMgr.abortRun = false;
        TestMgr.ClearTestCacheAuto = false;
        TestMgr.TestsIdsQueueForRun.push(runInfo.testId);
        var startId = runInfo.startId ? runInfo.startId : null;
        var endId   = runInfo.endId   ? runInfo.endId   : null;
        TestMgr.runTest(TestMgr.TestsIdsQueueForRun.pop(), startId,endId);
    },

    _onTestsRun(testsId){
        TestMgr.abortRun = false;
        TestMgr.TestsIdsQueueForRun = testsId.reverse();
        TestMgr.ClearTestCacheAuto = true;
        TestMgr.runTest(TestMgr.TestsIdsQueueForRun.pop());
    },

    runTest(testId,startId,endId){
        global.Logger = new LoggerClass(Configurator.data.logPath, (Configurator.data.localMode || TestMgr.Tests[testId-TEST_START_INDEX].test.name), Configurator.data.logLevel, null, Configurator.data.logConsoleMode);

        TestMgr.CurrentRunningTest = testId -TEST_START_INDEX;
        TestMgr.abortRun = false;

        Configurator.updateFFPrefs("watchdog.lastRunnedTest", TestMgr.Tests[TestMgr.CurrentRunningTest].test.name);
        EventBus.addListener("test/end", TestMgr._onFinishTestRun, testId);
        TestMgr.Tests[TestMgr.CurrentRunningTest].filePath =  Logger.filePath;
        TestMgr.Tests[TestMgr.CurrentRunningTest].run(startId , endId, TestMgr.ClearTestCacheAuto);
    },

    _onFinishTestRun(test){
        function onFinishPostTasks() {
            Logger.debug("*****************onFinishPostTasks function");
            if(Configurator.data.watchdogMode == "auto" && !TestMgr.abortRun) {
                Logger.debug("*****************calling TestMgr.quit");
                TestMgr.quit();
            } 
        }
        
        var curTest = TestMgr.Tests[test.id-TEST_START_INDEX].test;
        curTest.wasRun = true;
        var pass = curTest.results.failures.length === 0;
        //UiController.Dispatcher.trigger("test/end", test.id, {pass: pass});
        //EventBus.clearAll(testId.id);

        if(TestMgr.abortRun){
            TestMgr.TestsIdsQueueForRun =[];
            pass = false;
        }

        if(Configurator._prefs["watchdog_runUntilFailure"].value && pass){
            TestMgr.TestsIdsQueueForRun.unshift(TestMgr.CurrentRunningTest + TEST_START_INDEX);
        }

        if(TestMgr.TestsIdsQueueForRun.length === 0) {
            var timeoutId = setTimeout(onFinishPostTasks, 15000);
            Logger.debug("start waiting for postTasks/end");
            TestMgr.addListener("postTasks/end", ()=>{
                Logger.debug("on postTasks/end");
                clearTimeout(timeoutId);
                try{onFinishPostTasks();} catch (e){stdout("exception in onFinishPostTasks callback : " + e)};
            });
            TestMgr.runPostTasks();
        }
        else {
            setTimeout(function(){TestMgr.runTest(TestMgr.TestsIdsQueueForRun.pop())},0) //this timeout solves the sync issue between two tests and allow clearAll func (from Test.js)to invoke
        }
    },

    sendError(msg,errorLevel){
        //UiController.Dispatcher.trigger("onError", {msg : `${msg}`, errorLevel : `${errorLevel}`});
        console.log(msg);
    },

    runPostTasks(){
        if(Configurator._prefs["watchdog_justRunGenerate"].value){
            TestMgr.updateJustRunTests(()=>{
                Logger.debug("*****************dispatch postTasks/end");
                //TestMgr.printResults();
                TestMgr.dispatch("postTasks/end");
            });
        }
        else {
            TestMgr.printResults();
            TestMgr.dispatch("postTasks/end");
        }
    },

    updateJustRunTests(cb){
        //Create test files
        jrManager.proccessTests(TestMgr.Tests, cb);
    },
    
    printResults(){
        function printFile(fileName, data ){
            function createFile(name, outputDir){
                var snapshotFile = fs.openSync(fs.appendFileSync(outputDir, name).path);
                if (snapshotFile.exists()) fs.unlink(snapshotFile);
                return snapshotFile;
            }
            var logFile = createFile(`${fileName}`, outputDir);
            if(Array.isArray(data)){
                data.forEach(function(datapiece){fs.WriteStream(logFile, `${datapiece}` + "\n", "a");})
            }
            else fs.WriteStream(logFile, data, logFile.exists() ? "a" : undefined, "utf8");
        }


        var reporter = new Reporter(TestMgr.Tests, "watchdog",Configurator._prefs["watchdog_outputPath"].value || process.env.HOME + "/watchdog");
        var result = reporter.generateJenkinsReport();
        var outputDir= Configurator._prefs["watchdog_outputPath"].value || process.env.HOME + "/watchdog"
        if(!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
        var outputFile = fs.openSync(outputDir + "/watchdog.xml","a");
        if (fs.existsSync(outputDir)) fs.ftruncateSync(outputFile);
        fs.writeFileSync(outputFile, result, fs.existsSync() ? "a" : undefined, "utf8");
        
        TestMgr.Tests.forEach((test)=>{
            Object.keys(test.test.results.collectData).forEach((key)=>{
                printFile(key, test.test.results.collectData[key]);
            })
        });
        stdout("printResults - end.  " + (Configurator._prefs["watchdog_outputPath"].value || process.env.HOME + "/watchdog" || "none"));
    },

    runInSelectedMode(){
        //we are in auto mode
        if(Configurator.data.watchdogMode == "auto"){
            console.log("5. In auto modeee");
            //UiController.Dispatcher.trigger("select/all/tests");
            TestMgr._onTestsRun([100]) //UiController.Dispatcher.trigger("run/selected/tests");
        }
        else {
            //just wait ...
            console.log("6. Waiting for user actions :)");
        }
    },

    loadTestsAndCompile(cb){
        TestMgr.Tests = [];
        TestMgr.LastRunnedTest = TEST_START_INDEX;

        Configurator.readConfigurations();
        this.Loader = new Loader(Configurator.data.testsSuite);
        this.Loader.loadFiles(function(tests,error){

            if(error){
                TestMgr.sendError(error, "Fatal");
            }
            //set testsMgr map
            tests.forEach((test, index)=>{
                var obj = test;
                obj["id"]        = `${index + TEST_START_INDEX}`;
                obj["actions"]   = [];
                obj["name"]      = test.fileName.split(".")[0];

                if(Configurator._prefs["watchdog_lastRunnedTest"].value == obj.name){
                    TestMgr.LastRunnedTest = obj.id;
                }
                TestMgr.Tests.push(obj);
            });

            //update the UI
            //UiController.Dispatcher.trigger("set/basicConfig", { user : Configurator.ff_prefs["watchdog_user_email"].value});
            //UiController.Dispatcher.trigger("set/tests", TestMgr.Tests);

            //compile tests
            TestMgr.compileTests(cb);
        });

    },

    compileTests(cb){
        var compiledTests = [];
        var firstTestForCompile = (TestMgr.LastRunnedTest - TEST_START_INDEX) || 0;
        var runUntilEx = Configurator._prefs["watchdog_runUntilCommand"].value;
        var runFromEx = Configurator._prefs["watchdog_runFromCommand"].value;
        
        compileTest(firstTestForCompile);

        function compileTest(id){
            console.log("Comp test "  + id);
            var test = TestMgr.Tests[id];
            if (Configurator._prefs["watchdog_justRun"].value) jrManager.setTestProps(test);
            var runnableTest = new RunnableTest(test, runUntilEx, runFromEx);
            compiledTests[id] = runnableTest;
        }

        //this is sync for now
        TestMgr.Tests.forEach((test, id)=>{
            if(Configurator.data.mode ="auto"){
                if(id != firstTestForCompile) {compileTest(id);}
            }
            else {
                setTimeout(function () {
                    if(id != firstTestForCompile) {compileTest(id);}
                }, 3);
            }

        });

        //UiController.Dispatcher.trigger("set/loadTest", TestMgr.LastRunnedTest);
        TestMgr.Tests = compiledTests;
        cb();
    },

    quit : function() {
        Logger.dumpSync();
        setTimeout(function(){
            process.exit()
            //Services.startup.quit(Services.startup.eForceQuit);
        }, 100);
    },

    /*_exceptionRecorder : {
        start : function() {
            this.listener = {
                observe : function (msg) {
                    try {
                        var err = msg.QueryInterface(Components.interfaces.nsIScriptError);
                        if (!(err.flags & $this.WARN_FLAG) && (err.category == "chrome javascript" || (err.category == "content javascript"))) {
                            stdout(" - Uncaught Exception (".concat(err.category, "): '", err.errorMessage, '" (', err.sourceName, ":", err.lineNumber, ":", err.columnNumber, ") flags: ", err.flags));
                            Logger.error(" - Uncaught Exception (".concat(err.category, "): '", err.errorMessage, '" (', err.sourceName, ":", err.lineNumber, ":", err.columnNumber, ") flags: ", err.flags));
                        }
                    } catch(ex) {}
                }
            };

            var $this = this;
            this.consoleService.registerListener(this.listener);
            this.exceptions = [];
        },

        stop : function() {
            this.consoleService.unregisterListener(this.listener);
        },

        WARN_FLAG : (1 << 0), //   1
        consoleService : Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService)
    },*/

}



function stdout(msg, test, noTimestamp) {
    if (!noTimestamp) msg = "[" + (new Date()).toTimeString().substr(0,8) + "] " + msg;
    //dump(msg + "\n");
    console.log(msg + "\n");
}

console.log("Start the loading of TestManager");
