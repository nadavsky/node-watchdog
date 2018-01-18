
/*
 * UiController.triger("test/run", "start id", "end id", "test id")
 * -runUntilHere "end id"
 * -runFromHere  "start id"
 * -runThisCommand "start id", "end id" ("start id" === "end id")
 * -RunTest no "start id" & "end id"
 * */

/* Test API
 *      Test.trigger("test/start") + testId 
 *      Test.trigger("test/end", passed/failed + Error message, overallTime) + testId
 *      Test.trigger("action/start", commandIdx) + testId
 *      Test.trigger("action/finish", commandIdx, passed/failed + ErrorTxt, time) + testId
 * */

//Test.toJson should return obj of this format
TestJson = {
    "name": "",
    "id": "",
    "meta": "",//*
    "actions": [{
        "text": "str",
        "lineNum": "int",
        "comment": "bool",
        "moduleName": "str",
        "id": "",
        actions:[{}]//*
    }],
}
/*
proxyListener(event, commandId){
    this.test.addListener("action/start", function(commandIdx){
        UiController.trigger("action/start", commandIdx, this.test.id);
    });

}
*/
var Test = require("./Test")

function RunnableTest(test, runUntilEx, runFromEx) {
    function updateFromUntilActions(actions){
        if(runUntilEx) self.runUntil = self._findActionId(runUntilEx, actions);
        if(runFromEx) self.runFrom = self._findActionId(runFromEx, actions);
    };
    function setDataForUI(testsContent){
        that.actions = testsContent.actions;
        that.invalid = testsContent.invalid || "";
        that.meta = testsContent.meta;
        that.excluded = Configurator._prefs["watchdog_justRun"].value && ((testsContent.meta.excludeJustRun && "Test excluded in Just Run mode") ||
            (!self.hasPublish && "Test excluded in Just Run mode - no publish") || test.excluded);
    };

    var that = test,
        self = this;

    self.test = new Test(test);
    var jsonRep = self.test.toJson();
    updateFromUntilActions(jsonRep.actions);
    self.hasPublish = self._findActionId('designer/publish', jsonRep.actions);

    if (test.beforeCmd && self.runFrom) { //delete actions between before command and runFrom
        var startIdx = jsonRep.actions.filter((item)=>{ return item.beforeCmd; }).length;
        self.test.removeCommands(startIdx, self.runFrom - 1);
        jsonRep = self.test.toJson(); //get new representation after command deletion
        updateFromUntilActions(jsonRep.actions); //update run from - run until actions ids
    }

    setDataForUI(jsonRep);
    //UiController.Dispatcher.trigger("add/testsContent", [that]);
}

RunnableTest.prototype = {

    initTestEventListeners(){
        var _test = this.test;

        EventBus.addListener("action/find/start", function(commandIdx){
            var nestedCommandInd = commandIdx["stack"].slice(1).join(",");
            var topCommandInd = commandIdx.stack[1];
            Logger.trace(`runnableTest : action/find/start TestName : ${_test.name} TestId : ${_test.id} TopActionIndex : ${topCommandInd}`);
            //UiController.Dispatcher.trigger("action/find/start", topCommandInd, _test.id);
        },this.test.id);

        EventBus.addListener("action/find/end", function(commandIdx){
            var nestedCommandInd = commandIdx["stack"].slice(1).join(",");
            var topCommandInd = commandIdx.stack[1];
            Logger.trace(`runnableTest : action/find/end TestName : ${_test.name} TestId : ${_test.id} TopActionIndex : ${topCommandInd}`);
            //UiController.Dispatcher.trigger("action/find/end", topCommandInd, _test.id);
        },this.test.id);
        
        EventBus.addListener("action/start", function(commandIdx){
            var commandInd = commandIdx["stack"].slice(1).join(",");
            Logger.trace(`runnableTest : action/start TestName : ${_test.name} TestId : ${_test.id} ActionIndex : ${commandInd}`);
            UiController.Dispatcher.trigger("action/start", commandInd, _test.id);
        },this.test.id);

        EventBus.addListener("action/end", function(resultData){ //TODO results format need to be settled
            var error = resultData.err === "" ? null : resultData.err;
            var index = resultData["stack"].slice(1).join(",");
            var state = resultData.err === "";
            var time  = Date.now() - _test.startTime.getTime() || "0:00";
            time = pad(Math.floor(time/60000)) + ":" + pad(Math.round(time/1000) % 60);
            Logger.trace(`runnableTest : action/end TestName : ${_test.name} TestId : ${_test.id} ActionIndex : ${index} Results : ${error}`);
            //UiController.Dispatcher.trigger("action/end", index, _test.id, {pass: state, time: time, error : error});
        },this.test.id);

        EventBus.addListener("test/start", function(){
           console.log(`runnableTest : test/start TestName : ${_test.name} TestId : ${_test.id}`);
            //UiController.Dispatcher.trigger("test/start", _test.id);
        },this.test.id);

        EventBus.addListener("test/update", function(testsContent){ //Add listener to update nested commands
            Logger.trace("in test/update runtime");
            _test.actions = testsContent.actions;
            _test.invalid = testsContent.invalid || "";
            //UiController.Dispatcher.trigger("add/testsContent", [_test]);
        },_test.id);

        /*EventBus.addListener("test/end", function(results){
           console.log(`runnableTest : test/end TestName : ${_test.name} TestId : ${_test.id}`);
            EventBus.dispatch("runTest/finished", _test.id, this);
        },this.test.id);*/

    },

    initUIEventListeners(){

    },
    
    run(startIndex, endIndex, clearWindows){
        this.initTestEventListeners();
        endIndex = endIndex || this.runUntil;
        startIndex = startIndex || this.runFrom;
        this.test.run(startIndex, endIndex, {cleanTestEnv: clearWindows});
    },
/** @commandDesc = 'moduleName/commandName/+ or - integer'
    */
    _findActionId(commandDesc, actions) {
        var module, command, shift, idx;
        try{
            module = commandDesc.split('/')[0]; 
            command = commandDesc.split('/')[1];
            shift = commandDesc.split('/')[2];
    
            actions.some((action, index, array)=>{
                var ret = action.text.indexOf(command) !== -1 && action.moduleName.toLowerCase() == module.toLowerCase();
                if(ret) idx = index;
                return ret;
            });
            if(typeof idx == 'undefined') return null;
            if(shift) return Number(actions[idx].id) + Number(shift);
            else return Number(actions[idx].id);
        }
        catch(ex){Logger.error("watchdog.runFromCommand OR watchdog.runUntilCommand is on, correct syntax: 'commandModule/commandName/shift' example: 'designer/publish/+1' " + ex)}
    }
}

function pad(n) {
    return n < 10 ? '0' + n : n;
}

module.exports=RunnableTest;