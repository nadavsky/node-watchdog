const WATCHDOG_URL = "http://127.0.0.1/other/watchdog-components/";
const TEST_DONT_RUN_SIGN = "!";

defaultPrefs=require("./defaultPrefs");
PrefsUtils=require("./PrefsUtils");
var fs = require('fs');




function Configurator(received_prefs, mode = "FF") {
    this._prefs = {};
    this.prefs = received_prefs || defaultPrefs;
    this.readPrefs();
    this.tests = [];
    this.mode = mode;
}

Configurator.prototype = {
    _format_tests_urls(baseURL, testsArr) {
        return testsArr.filter(function (t) {
            return t[0] != TEST_DONT_RUN_SIGN
        }).map((test_url)=> {
            return (`${baseURL}${test_url}`).replace(/\\/g, "/")
        });
    },

    _loadTestsFromTestArray() {

        var tests_arr_res = [];
        var tests = this._prefs["watchdog_testsArray"].value;
        var testPart = this._prefs["watchdog_testsArrayPart"].value;
        var testBaseUrl = this._prefs["watchdog_testsArrayBaseUrl"].value || WATCHDOG_URL;

        try {
            var testsArr = JSON.parse(tests);
            tests_arr_res = (testPart > -1) ? testsArr[testPart] : testsArr;
            tests_arr_res = this._format_tests_urls(testBaseUrl, tests_arr_res);
            return tests_arr_res;
        }
        catch (ex) {
            console.log(ex, "We failed to parse the tests array watchdog_testsArray");
            console.log(`TestsArray : ${tests} \nTests Base URL : ${testBaseUrl}`);
            return tests_arr_res;
        }
    },

    createRequest(uri, requestParams) {
        var numberOfRetries = requestParams.numberOfRetries || 1;
        var maxNumberOfRetries = requestParams.numberOfRetries || 1;
        prepareXHR();

        function prepareXHR() {
            var xhr = new XMLHttpRequest();

            if (!requestParams.sync && requestParams.timeout) {
                console.log("This is avery strange request :( . Sync + Timeout ?!");
            }

            if (requestParams.timeout) {
                var timerId = setTimeout(function () {
                    xhr.abort();
                    _finishRequest(true);
                }, requestParams.timeout);
            }

            xhr.addEventListener("error", function () {
                xhr.removeEventListener("error", arguments.callee);
                _finishRequest(true);
            }, false);

            xhr.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    clearTimeout(timerId);
                    _finishRequest();
                }
            }

            xhr.open(requestParams.method, uri, requestParams.sync && true);

            if (requestParams.header) {
                xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            }

            console.log(`>> Sending xhr ${requestParams.method} request ${uri}  retry .... ${(maxNumberOfRetries - numberOfRetries) > 0 } data : ${requestParams.data ? JSON.stringify(requestParams.data) : "no data"}`);
            requestParams.data ? xhr.send(JSON.stringify(requestParams.data)) : xhr.send();

            function _finishRequest(wasError, aborted) {
                numberOfRetries--;
                if (wasError && numberOfRetries > 0) {
                    prepareXHR();
                }
                else {
                    console.log("<< Sending xhr received. Status: " + xhr.status + " statusText : " + xhr.statusText);
                    if (aborted) requestParams.callback(xhr.status, xhr.response);
                    else if (wasError) requestParams.callback(xhr.status, "aborted !!!");
                    else requestParams.callback(xhr.status, xhr.response);
                }
            }
        }
    },

    _loadTestsFromTestsURL() {
        var tests_arr_res = [];
        var url = this._prefs["watchdog_testsUrl"].value;
        var testBaseUrl = (url.substr(0, url.lastIndexOf("/") + 1));
        var $this = this;

        function checkTheResponse(status, response) {
            if (status == 200 || status == 304) {
                try {
                    tests_arr_res = $this._format_tests_urls(testBaseUrl, JSON.parse(response));
                    return tests_arr_res;
                }
                catch (ex) {
                    console.log(ex, "We didn't succeed to parse the result : " + response);
                    return tests_arr_res;
                }
            }
            console.log(`URL : ${url}, STATUS : ${status}, RESPONSE : ${response}`);
            return tests_arr_res;
        }

        this.createRequest(url, {
            "method": "GET",
            "timeout": 10000,
            "numberOfRetries": 2,
            "callback": checkTheResponse
        });
        return tests_arr_res;

    },

    _loadTestsTestPath() {
        var testsPath = this._prefs["watchdog_testsUrl"].value;
        var basePath = testsPath.substr(0, testsPath.lastIndexOf("/") + 1);
        var testJSON = window.FileIO.read(window.FileIO.open(testsPath), "utf8");

        if (testJSON) {
            try {
                return this._format_tests_urls(basePath, JSON.parse(testJSON))

            } catch (ex) {
                console.log(ex, `We didn't succeded to parse the ${testJSON}`);
                return [];
            }
        }
        else {
            console.log("We didn't sucees to open the file " + testsPath)
        }
    },

    _loadTestsFromDir() {
        var path = this._prefs["watchdog_path"].current_path;
        if (path.endsWith(".js")) {
            return [path]
        }
        else {
            return fs.readdirSync(path)
                .filter(function (file) {
                    return file.endsWith("js")
                })
                .sort(function (a, b) {
                    return a.localeCompare(b);
                })
                .map((file) => {
                    return path+"/"+file
                })
        }
    },

    getArrayOfTestsPaths() {
        function _checkForErrors() {
            var isFoundError = false;

            /* if((_self._prefs["watchdog_testsArray"].value  && _self._prefs["watchdog_testsUrl"].value) ||
             (_self._prefs["watchdog_testsArray"].value && _self._prefs["watchdog_path"].value) ||
             (_self._prefs["watchdog_testsUrl"].value   && _self._prefs["watchdog_path"].value)){
             _self.data["errors"].push(`We can't load the tests from 2 different sources ... \nThe loading order is :\n 1. Test Array\n 2. Test file\n 3. Test path`);
             isFoundError = true;
             }

             if(path && ((window.DirIO.open(path).exists())) == false){
             _self.data["errors"].push("Given path not found! path = " + _self._prefs["watchdog_path"].value)
             isFoundError = true;
             }*/
            return isFoundError;
        }


        var arr_tests = [];
        var _self = this;
        var isConfigError = _checkForErrors();

        if (!isConfigError) {
            //1. load the tests from test_array
            if (_self._prefs["watchdog_testsArray"].value && arr_tests.length == 0) {
                console.log("Loading the tests from test Array");
                arr_tests = this._loadTestsFromTestArray(_self._prefs["watchdog_testsArray"].value);
            }

            //2. load the test from tests file
            else if (_self._prefs["watchdog_testsUrl"].value && arr_tests.length == 0) {
                console.log("Loading the tests from test FILE");
                arr_tests = this._loadTestsFromTestsURL(_self._prefs["watchdog_testsUrl"].value);
            }

            //3. load the test from testsPATH
            else if (_self._prefs["watchdog_testsPath"].value && arr_tests.length == 0) {
                console.log("Loading the tests from test Path FILE (LOCAL)");
                arr_tests = this._loadTestsTestPath(_self._prefs["watchdog_testsPath"].value);
            }

            //4. load the test from PATH
            else if (_self._prefs["watchdog_path"].value || _self._prefs["watchdog_path"].default && arr_tests.length == 0) {
                console.log("Loading the tests from test PATH DIR");
                arr_tests = this._loadTestsFromDir();
            }
        }
        console.log("Tests to load " + arr_tests);
        return arr_tests;
    },

    prepareLoggerConfig() {
        this.data = {
            "errors": [],
            "logPath": (this._prefs["watchdog_outputPath"] && this._prefs["watchdog_outputPath"].value) || !fs.existsSync(process.env.HOME + "/watchdog") ? fs.mkdirSync(process.env.HOME  + "/watchdog") : process.env.HOME  + "/watchdog/" ,
            "logLevel": (this._prefs["watchdog_logLevel"] && this._prefs["watchdog_logLevel"].value) || "DEBUG",
            "logConsoleMode": (this._prefs["watchdog_logConsoleMode"] && this._prefs["watchdog_logConsoleMode"].value) || false,
            "localMode": (this._prefs["watchdog_local"] && this._prefs["watchdog_local"].value) || false
        };
    },

    readPrefs() {
        var self = this;
        this.prefs.forEach((ff_pref_obj) => {
            var pref_name = ff_pref_obj.pref.split(".").join("_");
            self._prefs[pref_name] = {
                pref: ff_pref_obj.pref,
                value: PrefsUtils.get(pref_name),
                default: ff_pref_obj.default,
                desc: ff_pref_obj.desc,
                expected: ff_pref_obj.expected,
                ui: ff_pref_obj.ui,
                must: ff_pref_obj.must
            }
        });
        var path = (this._prefs["watchdog_path"].value = process.argv[2] || PrefsUtils.get("watchdog_path")) || this._prefs["watchdog_path"].default;
        path = path.split(",")[0];
        this._prefs["watchdog_path"].current_path = path;
    },

    
    updateFFPrefs(pref, value) {
        console.log("updated preff " + pref + " ---> value " + value);
        var pref_name = pref.split(".").join("_");
        this._prefs[pref_name] = {
            pref: pref,
            value: value,
            default: this._prefs[pref_name] || "",
            desc: this._prefs[pref_name] || "not known",
        };
        //PrefsUtils.set(pref, value); //TODO fix set pref to set into config.json
    },

    readConfigurations() {
        this.readPrefs();

        this.data["watchdogMode"] = this._prefs["watchdog_mode"].value || this._prefs["watchdog_mode"].default;
        this.data["runUntilFailure"] = this._prefs["watchdog_runUntilFailure"].value || false;
        this.data["testsSuite"] = this.getArrayOfTestsPaths();
    },

    updateState(state) {
        
        this.readPrefs();
        this.mode = state;
    },

    _clearEnvs() {
        envsList.forEach(function(key){ pref.set(key, undefined); });
    },


    isValidPath(path) {
        return ((window.DirIO.open(path)).exists());
    },

    

    checkTheStateOfTestMgr() {
        var isErrorConfiguration, res = {};

  

 
        this.mode = res;
        return {config : res, error  : isErrorConfiguration}
    },

    _analyzeState(state){
        var curr_state = {}

        if(state.devMode){
            curr_state = {devMode: true,  dashboard : false, extWin : false, publish : false, noAPI: false};
        }
        else {
            if(state.dashboard){
                curr_state = {devMode: false, dashboard : true,  extWin : false, publish : "both", noAPI: false};
            }
            else {
                curr_state = state.extWin ?
                {devMode: false, dashboard : false, extWin : true,  publish : "both",  noAPI: false } :
                {devMode: false, dashboard : false, extWin : false, publish : "both",  noAPI: "both"}
            }
        }
        return curr_state;
    },

    isValidState(state){
        var curr_state = this._analyzeState(state);
        var valid_state = true;
        Object.keys(curr_state).forEach((key)=>{
            if(curr_state[key] !== state[key] || curr_state[key] !== "both"){
                valid_state = false;
            }
        });
        return valid_state ? { state : state, valid : valid_state }  : { state : curr_state, valid : valid_state } ;
    }

}

module.exports = Configurator;
