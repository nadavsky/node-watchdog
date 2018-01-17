/**
 * Created by nadav on 8/15/16.
 */

var AScript=require("./AScript")


global.Test=function Test(testObj){
    this.id = testObj.id;
    this.path = testObj.path;
    this.content = testObj.testContent;
    this.name = testObj.name;
    this.fileName = testObj.fileName;
    this.runtimeProps = testObj.runtimeProps;
    this.beforeCommand = testObj.beforeCmd ? { cmd : testObj.beforeCmd, idx : 0 } : null;
    this.compiledScript = new AScript(this.content, undefined, undefined, this.path, this.id, this.beforeCommand, this.runtimeProps);
    this.meta=this.compiledScript.topScript.meta;
    Logger.info("--create new test--");
    this.invalid = testObj.invalid || this.compiledScript.invalid || !this.content;
    this.excludeJustRun = this.meta && this.meta.excludeJustRun;
    this.update(this.compiledScript._data);
}

Test.prototype= {
    run: function(from, to , props = {}){
        var $this = this;
        this.props = props;
        if (this.invalid) return skipWithError("Skipping invalid test: " + this.name + " Error: " + this.invalid + "\n");
        this._prepareToRun(function(){
            $this.stdout("Running test: " + $this.name + " ... from (" + $this.path + ")");
            $this.compiledScript.run({},from && $this.compiledScript._data[from - 1], to && $this.compiledScript._data[to - 1]);
            EventBus.dispatch("test/start", $this.id,{startTime : $this.startTime});
        });
        function skipWithError(errMsg){
            Logger.error(errMsg);
            $this.stdout(errMsg);
            $this.results.failures.push("Invalid Script");
            EventBus.dispatch("test/end", $this.id, $this);
        }

    },
    _prepareToRun(callback){
        var $this = this;
        initParams();
        if ($this.props.cleanTestEnv) {this._saveWindowState(callback); console.log("clean test env!!")}
        else callback();
        function initParams(){
            $this.runTimeParams.timeoutTimer = setTimeout(function() {
                Logger.error("Script Timeout after" + ($this.props.testTimeout || $this.runTimeParams.Timeout));
                $this.compiledScript.abort("Script Timeout after " + ($this.props.testTimeout || $this.runTimeParams.Timeout) + "ms!!");
            }, $this.meta.testTimeout || $this.props.testTimeout || $this.runTimeParams.Timeout);
            EventBus.addListener("action/start",function(e){
                Logger.debug("on action start...");
                $this.onActionStart(e);
            },$this.id);
            EventBus.addListener("action/end",function(e){
                Logger.debug("on action end");
                $this.onActionEnd(e);
            },$this.id);
            EventBus.addListener("script/start",function(e){
                Logger.debug("on script start...");
                $this.onScriptStart(e);
            },$this.id);
            EventBus.addListener("script/end",function(e){
                Logger.debug("on script end");
                $this.onScriptEnd(e);
            },$this.id);
            EventBus.addListener("action/clearError",function(e){
                Logger.debug("on clearError: " + e.error);
                $this.results.failures = $this.results.failures.filter(function(item){
                    return !(item.includes(e.cmdId) && item.includes(e.error));
                })
            },$this.id);
            $this.compiledScript._runtimeData["delay"]= $this.props.delay || 10; // define the default delay for top script only
            $this.compiledScript._runtimeData["findDelay"]= $this.props.findDelay || $this.props.findDelay || 200;
            $this.results = {failures: [], stdout: [], duration: 0, coverage: {} , collectData:{}, runtimeTestData: {}};
            $this.winArray = [];
            $this.stack = [];
        }
    },
    _saveWindowState: function (callback) {
        var $this=this;
        var browserEnum = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getEnumerator(null);
        save();
        function save(){
            var _win, winArray=[];
            while(browserEnum.hasMoreElements()){
                _win = browserEnum.getNext();
                Logger.debug("in save window state, pushing: " + _win.document.title);
                $this.winArray.push(_win);
            }
            $this.winArray=winArray;
            callback();
        }

    },
    onActionStart : function(e) {
        Logger.info("action start...");
        var cmdNum = e["stack"].toString().replace(/,/g,".");
        var actnStr = e["action"].toString();
        var stackElement = new actionInStack(cmdNum ,e["action"], actnStr);
        this.updateTestStack(stackElement);
        if(e["stack"].length == 2) {
            this.stdout(" - " + cmdNum.substring(cmdNum.indexOf(".")+1) + " " + actnStr);
        }
        Logger.debug("actnStr " + actnStr);
        Logger.info(cmdNum + " RUNNING: " + actnStr + " >>>");
    },
    onActionEnd : function(e) {
        var $this=this;
        Logger.info("action end.");
        var cmdNum = e["stack"].toString().replace(/,/g,".");
        var actnStr = e["action"].toString();
        if(e["err"]){
            Logger.error(" - " + cmdNum + " FAILED: " + actnStr + " FOR: " + e["err"]);
            Logger.debug("onActionEnd: this is errFromNested action : "  + (errFromNested(e["action"]) ? true : false));
            if(this.stack[this.stack.length-1].index == cmdNum || !errFromNested(e["action"])) {
                this.results.failures.push(e["err"]);
                this.printStackTrace(e["action"]);
                this.stdout(" ! " + cmdNum.substring(cmdNum.indexOf(".")+1) + " FAILED: " + actnStr + " FOR: " + e["err"] + "\n");
                setDataCollection(this, e["action"], cmdNum);
                //this.stdout("\n", true);

                //this.stdout("\n", true);
            }

        }
        else{
            Logger.info(cmdNum + " PASSED: " + actnStr + "<<<",null, true, {actionDuration:e["duration"]});
        }

        function errFromNested(action){ // check if the error comes from entire action or not
            var i = $this.stack.length-1, tmpArr= [], id="";
            var errorArr = action.verifyThat.errors.map((err) =>{return { id: err.id, topic: err.topic}} );
            while ($this.stack[i].index != cmdNum){
                tmpArr = errorArr.slice(0);
                Logger.trace("errFromNested : errorArr.length = " + errorArr.length);
                errorArr.forEach((err)=>{
                    //Logger.trace("topic = " + topic + "\n $this.stack[i].action.verifyThat.toString() : \n" + $this.stack[i].action.verifyThat.toString(true));
                    if($this.stack[i].action.verifyThat.hasError(err.topic, false, err.id)){
                        tmpArr.splice(tmpArr.indexOf(err.topic), 1);
                    }
                });
                errorArr = tmpArr.slice(0);
                if(!errorArr.length) return true;  //means that all the errors comes from entire action.
                i--;

            }
            return false
        }

    },
    onScriptStart : function(e) {
        Logger.info("on script start...");
        if (e.top) this.onTestStart();
        else this.update(e["scriptData"]);
    },
    onScriptEnd : function(e){
        Logger.info("on script end. top =" + e["top"]);
        if(e["top"]) this.onTestEnd(e);
    },
    onTestStart : function() {
        Logger.info("Test start...");
        this.startTime = new Date();
    },
    onTestEnd : function  (e) {
        var $this = this;

        $this.results.runtimeTestData.testData = e.testData;
        this.startTime ? this.results.duration = Math.round((Date.now() - this.startTime.getTime()) / 1000) : this.results.duration="no start time";
        if (this.props.cleanTestEnv && (!this.compiledScript._abort || (AScript._abortMsg && (AScript._abortMsg.includes("Script Timeout") || AScript._abortMsg.includes("exit!"))))) closeOpenWindows(end);
        else end();


        function closeOpenWindows(callback){
            $this.stdout("*** next win ***");
            var curWin;
            var browserEnum = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getEnumerator(null);
            var timer = setTimeout(function(){
                $this.stdout("closeOpenWindows(): failed to close all windows");
                callback();
            },10000);
            closeNext();
            function closeNext(){
                if(browserEnum.hasMoreElements()){
                    curWin=browserEnum.getNext();
                    console.log("----------------------------------"+curWin.document.title);
                    curWin.addEventListener("unload",function(){
                        curWin.removeEventListener("unload",arguments.callee);
                        closeNext();
                    });
                    if($this.winArray.indexOf(curWin) == -1 && !(typeof(curWin.document.title) == "string" && curWin.document.title.includes("Watchdog")) && !(curWin.document.title == "Script Unit tests")){
                        console.log("*** closing window: " +  curWin.document.title);
                        curWin.close();
                    }
                    else {
                        $this.winArray.pop($this.winArray.indexOf(curWin));
                        console.log("*** this win was opened before the test ran: " + curWin.document.title);
                        closeNext();
                    }
                }
                else {
                    clearTimeout(timer);
                    callback();
                }
            }
        }
        function end(){
            console.log("=========================test '" + $this.name + "' (" + $this.id + ") end===========================");
            clearTimeout($this.runTimeParams.timeoutTimer);
            this.props={};
            EventBus.dispatch("test/end", $this.id, $this);
            EventBus.clearAll($this.id);

        }
    },
    update : function (data) {
        Logger.trace("test update -----");
        var jsonTest = this.toJson(data);
        if(jsonTest.actions.length || this.invalid) EventBus.dispatch("test/update", this.id, jsonTest);
    },
    toJson : function(sentData){
        function updateTestWithAction(action , index){
            var currentStack = $this.compiledScript.stack;
            currentStack = currentStack.slice(1,currentStack.length);
            var actionId = currentStack.toString() + (currentStack.length ? "," :  "") + (index + 1).toString();
            scriptStringArr.push({
                "text": action.desc,
                "comment": action.comment,
                "lineNum": action.lineNumber || "?",
                "moduleName": action.moduleName || "Global",
                "id": actionId,
                "beforeCmd": action.beforeCmd
            });
            Logger.trace("test actions index = " + actionId)
        }
        
        var data = sentData ? sentData : this.compiledScript._data,
            scriptStringArr=[],
            $this = this;
        
        if (!$this.compiledScript.invalid && $this.content) { //if disable in just run still want to get test rep to check if test has publish
            if (Array.isArray(data)) data.forEach((item, index)=> {                       // in case of new script (nested or on Test compilation).
                updateTestWithAction(item, index);
            });
            else updateTestWithAction(data); //in case of action added to topScript
        }
        return {actions: scriptStringArr , invalid: $this.invalid, meta: $this.meta};
    },
    updateTestStack : function(action){
        this.stack.push(action);
    },
    printStackTrace : function(){
        var length =this.stack.length-1, cmdNum, switchArr= [],$this=this;
        for(var i=length ; i > 0; i--) {
            cmdNum = this.stack[i]["index"].split(".");
            switchArr.push(this.stack[i]);
            if (cmdNum.length == 2) break;
        }
        switchArr.reverse().forEach(function(item){
            $this.stdout(" - " + Array(item.index.split(".").length).join("   ") + item.index.substring(item.index.indexOf(".")+1) + " " + item.actionString);
        })
    },
    stdout : function(msg,noTimestamp){
        this.results.stdout.push((!noTimestamp ? "[" + (new Date()).toTimeString().substr(0,8) + "] " : "") + msg);
        window.stdout && window.stdout(msg,null,noTimestamp);
    },
    abort : function(){
        this.compiledScript.abort("Test aborted");
    },
    removeCommands : function(startIdx, endIdx) {
        this.compiledScript._data.splice(startIdx, endIdx - startIdx);
    },
    results :{
        failures: [],
        stdout: [],
        duration: 0,
        coverage: {},
        collectData:{},
        runtimeTestData: {testData:{}}
    },
    runTimeParams:{Timeout : 600000},
    winArray: [],
    stack : []
}

module.exports=Test;


function setDataCollection(test,action, cmdNum){
    try{var collectData = getCollectData(action)}
    catch(ex){Logger.debug("-- collect data failed --")}


    if(collectData){
        try{collectData.data.forEach(function(item){
            if(item.format.includes("rowData")) setFile(cmdNum + "-[error.image]-" + test.name + ".png", item.content);
            else if(item.format.includes("png")) setFile(cmdNum + "-[error.image]-" + test.name + ".png", item.content.toDataURL());
            else setFile(item.name+".log", item.content);
        })}
        catch(ex){Logger.error("collectData : " + ex)}
    }
    function getCollectData(action){
        var parentAction=action;
        while ((parentAction && !parentAction.collectData) && (parentAction.script.topScript._curAction != parentAction)){
            Logger.debug("in getCollectData: parentAction= " + parentAction.desc);
            parentAction = parentAction.script.parentAction;
        }
        if(!parentAction || !parentAction.collectData) return Logger.error("getCollectData: there is no collectData method");
        try{return parentAction.collectData();}
        catch(ex){Logger.error("getCollectData: collect data failed, exception: " + ex)}


    }
    function setFile(fileName, data ){
        test.results.collectData[fileName] = data;
        test.stdout(fileName, true);
    }
}

function actionInStack(cmdNum, action, actnStr, scriptActions){
    this.nesting = scriptActions;
    this.index= cmdNum;
    this.action=action;
    this.actionString= actnStr;
    this.dataCollection={};
}
