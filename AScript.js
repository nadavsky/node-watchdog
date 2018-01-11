
EventBus = require("./EventBus.js");


var ASBaseError = (function() {
    var nextId = 1;
    return function ASBaseError() {this.id = nextId++;}
})();

global.ASError = function(msg, fatal) {
	var err = new ASBaseError();
    err.topic = msg;
	err.msg = 'Fatal Error: ' + msg;
	err.fatal = fatal;
	return err;
}

global.ASVerifyError = function(prop, expected, actual) {
	var err = new ASBaseError();
	err.topic = prop;
	err.msg = arguments.length > 1 ?
		'Verification failed: "' + prop + '" expected="' + expected + '" actual="' + actual + '"' :
		'Verification failed: ' + prop;
	err.fatal = false;
	return err;
}

global.ASVerifier = function(actionName) {
	this.actionName = actionName || "";
	this.errors = [];
}

ASVerifier.prototype = {
	equals : function(prop, expected, actual,pushError = true) {
        var fail;
        if(Array.isArray(expected) && Array.isArray(actual)){
            if(expected.length != actual.length) fail = true;
            else fail = expected.some(function(item,i){ return item != actual[i]; });
        }
        else fail = expected !== actual;
		if(fail && pushError) this.errors.push(ASVerifyError(prop, expected, actual));
        return !fail;
	},

    greaterOrEqual : function(prop, expected, actual,pushError = true) {
        var fail = expected > actual;
        if(fail && pushError) this.errors.push(ASVerifyError(prop, expected, actual));
        return !fail;
    },

    lessOrEqual : function(prop, expected, actual,pushError = true) {
        var fail = expected < actual;
        if(fail && pushError) this.errors.push(ASVerifyError(prop, expected, actual));
        return !fail;
    },

    true : function(errNsg, expression,pushError = true) {
        var fail = !expression;
        if (fail && pushError) this.errors.push(ASVerifyError(errNsg));
        return !fail;
    },

    false : function(errNsg, expression,pushError = true) {
        if (expression && pushError) this.errors.push(ASVerifyError(errNsg));
        return !expression;
    },

    contains : function(prop, container, element,pushError = true) {
        var fail = !container.includes(element);
        if(fail && pushError) this.errors.push(ASVerifyError(prop, element, container));
        return fail;
    },

    exists : function(error){
        if(error) this.errors.push(ASVerifyError(error));
        var fail  = error ? true : false;
        return fail;
    },

	fatal(msg) { this.errors.push(ASError(msg, true)); },
	
	hasError : function(topic, clean = true, id) {
	    var idx, topics = this.errors.map(err => err.topic);
        if(id) {
            var ids = this.errors.map(err => err.id);
            idx = ids.indexOf(id);
        }
        else idx = topics.indexOf(topic);
		if (clean) {
			if (idx != -1) {this.errors.splice(idx, 1); EventBus.dispatch("action/clearError", this.actionName.substr(0, this.actionName.indexOf(".")) ,{cmdId: this.actionName.substr(0, this.actionName.indexOf(" ")), id :id , error : topic})}
			else this.errors.push(ASVerifyError("Verification missing", topic, JSON.stringify(topics)));
		}
		return idx != -1;
	},
	
	toString : function() { return this.errors.map(err => this.actionName + " - " + err.msg).join("\n"); },

    hasErrors() { return this.errors.length > 0; },
	
	_import(errorObj) {
		if (errorObj instanceof ASVerifier)
			this.errors = this.errors.concat(errorObj.errors);
		else if (errorObj instanceof ASBaseError)
			this.errors.push(errorObj);
		else if (typeof errorObj == "string")
			this.errors.push(ASError(errorObj, true));
	},

	getFatalError() { return this.errors.find("fatal", true); },
	
	_clearFatals() { this.errors = this.errors.filter(err => {
	    if(err.fatal)
	        var testId = this.actionName.substr(0, this.actionName.indexOf("."));
	        var actionId = this.actionName.substr(0, this.actionName.indexOf(" "));
            EventBus.dispatch("action/clearError", testId ,{cmdId : actionId , error : err.topic})
	    return !err.fatal});
	},
	
	get isFatal() { return this.errors.some(err => err.fatal); }
}

global.AScript = function(data, topScript, parentAction, filename, id, beforeCmd, runtimeProps) {
    var sandbox = this.sandbox = topScript ? topScript.sandbox : new Sandbox(filename),
        self = this;

    this._props = runtimeProps || {};
    Object.keys(this._props).forEach(function (key) {self.sandbox.global.test.props.set(key, self._props[key]);});
    sandbox.cmdSequence.splice(0);

    if (typeof data == "string" || typeof data == "function") {
        try {
			typeof data == "string" ? sandbox.eval(data, filename || "<AScript>") : data(parentAction);
			data = [].concat(sandbox.cmdSequence);
        } catch(ex){
			if (typeof ex != "string") sandbox.global.Logger.exception(ex, "AScript script");
			data = [];
			data.invalid = typeof ex == "string" ? ex : "Exception: " + (ex.message || "Invalid") + ` (${ex.fileName}:${ex.lineNumber})`;
		}
    }
	this._data = data || [];
    this.invalid = this._data.invalid || false;
	this.topScript = topScript || this;
    this.parentAction = parentAction;
    if (this.topScript == this) {
        this.topScript.stack = [id,];
        this.topScript.meta = sandbox.global.meta || {};
    }
	this._endAction = this._endAction.bind(this);

    /*
     * The run time data of the script, attr and such the script has gotten from parent 'action'.
     * On topscript it's the test global params, for - 1. first test line 2. cmd return val 3. saving values inside CMDs.
     */
    this._runtimeData = {filter:["watchdog  - "]};

    if (beforeCmd && this.topScript == this) {
        this.addScriptCommands(beforeCmd.cmd, null, { topScript: this, beforeCmd : true, startIdx: beforeCmd.idx });
    }
}

Object.extend(AScript, {
	Cmds : {},
	CmdPrototypes : {},
	CmdStrings : {},
	runUntilAction : null,
    schemaErrors: 0,

	Logger	:	function(){ return new Logger("watchdog"); },

    getActionString : function(action, dontLog) {
        var format = AScript.CmdStrings[action.cmd[0] == "!" ? action.cmd.substr(1) : action.cmd] ?
			(AScript.CmdStrings[action.cmd[0] == "!" ? action.cmd.substr(1) : action.cmd].desc) :
			action.desc || "inline cmd";
		if (typeof format == "function")
            format = format(action);
		return format ? format.replace(/{{([^}]+)}}/g, function(str, p1) { return action[p1] }) : action.cmd;
	}
});

Object.extend(AScript.prototype, {
	run : function(runtimeData, startAction, runUntilAction) {
		this._abort = false;
		this._errors = new ASVerifier();
        
        if (!this._data || this._data.invalid) return this._doScriptEnd(!this._data ? "No Script" : this._data.invalid);
        
        EventBus.dispatch("script/start", this.topScript.stack[0], {scriptData: this._data, index : this.topScript.stack, top: (this.topScript == this)});
		this.runUntilAction = runUntilAction;
        Object.extend(this._runtimeData, runtimeData || {});
		this._curIndex = startAction ? this._data.indexOf(startAction) - 1 : -1;
		this.startNextAction();
	},

	abort : function(errorMessage) {
        /*
         * AScript._abort - global for child scripts to stop,
         * this._abortTrigger - the script who started the abort (all it's child script will abort)
         * this._abort - if script is forced to stop after some time (abort hasn't worked yet)
         * then child script who continued will stop with this local var
         */
		AScript._abort = this._abort = this._abortTrigger = true;
        if(errorMessage) AScript._abortMsg = errorMessage;
		AScript._abortOnError = !!errorMessage;
	},

	startNextAction : function() {
        var curAction = this._curAction;
        if (curAction && !curAction.ended && curAction.verifyThat.hasErrors()) {
            curAction.end(curAction.verifyThat);
            return;
        }
        if (++this._curIndex >= this._data.length && this.topScript == this) {
            dispached = true;
            var dataLength = this._data.length;
            this.sandbox.global.test.dispatch("topScript/beforeExit", { errors :this._errors.errors, topScript: this });
        }
		if ((this._curIndex >= this._data.length) || (this.runUntilAction && this._curIndex-1 == this._data.indexOf(this.runUntilAction))) {
			this._doScriptEnd();
			return;
		}

		var rawAction = this._data[this._curIndex], $this = this;
		this._curAction = new Action(this, rawAction);
		if (rawAction.condition && !this._curAction.condition) {
            this.startNextAction();
		}
        else if (global.TestMgr && TestMgr.skipPublish && this._curAction.desc && this._curAction.desc.includes("Designer: publish")) {
			this._doScriptEnd();
		}
        else if (typeof this._curAction.cmd == "function") {
            Logger.trace("about to wait in function: " +(this._curAction.delay || 1000));
            setTimeout(function() {
                Logger && Logger.trace("$this._curAction.getPositionInScript() = " + $this._curAction.getPositionInScript())
                $this.topScript.stack.push($this._curAction.getPositionInScript());
                Logger.trace("stack = " + $this.topScript.stack.toString())
                EventBus.dispatch("action/start",$this.topScript.stack[0],  {action : $this._curAction, stack : [].concat($this.topScript.stack)} );
                if ($this._handleAbort($this._curAction)) return;
                $this._curAction.start();
            }, this._curAction.delay || this.topScript._runtimeData.delay || 1000);
		}
        else if(!this._curAction.cmd && this._curAction.comment){
            Logger.debug("Describe : " + this._curAction.comment);
            this.startNextAction();
        }
        else if (!this._curAction.cmd || this._curAction.cmd[0] == "!") {
			this.startNextAction();
		}
        else {
            var topScriptDelay = this.topScript == this && this.getTopScriptParam("delay");
            Logger.trace("about to wait in : " + this._curAction.cmd + " ---> time : " +  (this._curAction.delay || ($this._curIndex == 0 ? 0 : topScriptDelay || 100)));
            setTimeout(function() {
                $this.topScript.stack.push($this._curAction.getPositionInScript());
                EventBus.dispatch("action/start", $this.topScript.stack[0], {action : $this._curAction, stack : [].concat($this.topScript.stack)});
                if ($this._handleAbort($this._curAction)) return;

                $this._curAction.start();
                // default delay (apart from top script delay) is 1000
            }, this._curAction.delay || ($this._curIndex == 0 ? 0 : topScriptDelay || 1000));
		}
	},

    getTopScriptParam : function(name) {
        return this.topScript ? this.topScript._runtimeData[name] : this._runtimeData[name];
    },

    setTopScriptParam : function(name, value) {
        if(value) this.topScript._runtimeData[name] = value;
    },

    addToScriptParamValue : function(name, value) {
        if(this.topScript._runtimeData[name]) {
            if (value) this.topScript._runtimeData[name].push(value);
        }
        else {
            this.topScript._runtimeData[name] = [];
            if (value) this.topScript._runtimeData[name].push(value);
        }
    },

    getParam : function(name) {
        return this._runtimeData[name];
    },

    //on the current
    setParam : function(name, value) {
        this._runtimeData[name] = value;
    },

    _endAction : function(errorObj) {
        if (errorObj) this._errors._import(errorObj);

        EventBus.dispatch("action/end",this.topScript.stack[0], {
            action		 : this._curAction,
            err			 : errorObj && errorObj.toString(),
            stack		 : [].concat(this.topScript.stack),
            duration     : this._curAction.duration
        });
        this.topScript.stack.pop();
        this.sandbox.global.test.dispatch("action/end", { retVal : this._errors });

        if (!this._handleAbort()){
			if (errorObj && errorObj.isFatal) this._doScriptEnd();
            else setTimeout(() => { this.startNextAction() }, 0);
        }
    },

	_shouldAbort : function() { return this._abort || AScript._abort; },

	_handleAbort : function(action) {
		if (!this._shouldAbort()) return false;
		if (this._abortTrigger) {
			this._abortTrigger = false;
			AScript._abort = false;
		}

        if(!AScript._abortOnError)
	        this._doScriptEnd();
        else if(action)
            action.end(ASError(AScript._abortMsg, true));
        else
		    this._doScriptEnd("Aborted!");
		return true;
	},

	_doScriptEnd : function(errorObj) {
        --this.topScript.depth;
		this._errors._import(errorObj);
        var isTop = this.topScript == this,
            testData = isTop && this.sandbox.global.test.props.data;
        if(isTop){
            this.sandbox.global.test.dispatch("topScript/exit", { errors : this._errors.errors});
        }
        console.log("_do script end with " + this.topScript.stack.toString())
        EventBus.dispatch("script/end", this.topScript.stack.toString(),  { retVal : this._errors ,top: isTop, testData: testData});
    },

    get hasCommands(){
        return this._data && this._data.length;
    },

    addScriptCommands : function(data,fileName, props){
        var $this=this;
        var sp = this.sandbox.global;
        var sandbox = this.topScript.sandbox;
        sandbox.cmdSequence = [];

        if (props.beforeCmd) {
            try {
                Components.utils.evalInSandbox(data, sp);
                data = sandbox.cmdSequence;
                data.forEach((item)=>{item.beforeCmd = true});
                this._data.splice(0, 0, ...data);
                return this;
            } catch(ex){
                sp.Logger.exception(ex, "AScript script");
                data = [];
                data.invalid = "EXCEPTION:" + (ex.message || "Invalid");
            }
        }
        else if (typeof data == "string") {
            try {
                Components.utils.evalInSandbox(data, sandbox, "1.8", filename || "<AScript>", 1);
                data = sandbox.cmdSequence;
            } catch(ex){
                sp.Logger.exception(ex, "AScript script");
                data = [];
                data.invalid = "EXCEPTION:" + (ex.message || "Invalid");
            }
        } else if (typeof data == "function") {
            try {
                data(props);
                data = sandbox.cmdSequence;
            } catch(ex){
                sp.Logger.exception(ex, "AScript function");
                data = [];
                data.invalid = "EXCEPTION:" + (ex.message || "Invalid");
            }
        }
        else if (Array.isArray(data)) {
            data.forEach((func)=>{arguments.callee.apply($this,[func, fileName, props])});
            return
        }

        data.forEach((item)=>{this._data.push(item)})
        return this;
    },

    loadCommands : function(){
        this._data = this.sandbox.cmdSequence;
        return this;
    }
});

function Action(script, rawAction) {
    this.positionInScript = script._curIndex + 1;
    var verifier = new ASVerifier(script.topScript.stack.concat(this.positionInScript).join(".") + " " + rawAction.desc);
	Object.defineProperty(this, "script", { value : script });
    Object.defineProperty(this, "verifyThat", { value : verifier });
    Object.defineProperty(this, "theWindow", { value : window });
	Object.defineProperty(this, "end", { value : this.end.bind(this) });

	Object.keys(rawAction).forEach(function(prop) { this[prop] = rawAction[prop]; }, this);
	if (this.redirectCmd)
		Object.keys(script._runtimeData).forEach(function(prop) { if (nonCopyKeywords.indexOf(prop) == -1 && !this.hasOwnProperty(prop)) this[prop] = script._runtimeData[prop]; }, this);

	var cmdProto = AScript.CmdPrototypes[this.cmd];
	if (cmdProto) Object.keys(cmdProto).forEach(function(prop) { if (!this.hasOwnProperty(prop)) this[prop] = cmdProto[prop]; }, this);
}

Action.prototype = {
	start : function() {
		var $this = this;
        this.duration = new Date();
		if (typeof this.cmd == "function") {
            if (this.runTimeout) this._runTimer = setTimeout(function() {
                this._runTimer = undefined;
                $this.end(ASError("Action Timeout", true));
            }, this.runTimeout);

            this.cmd(this);
        } else{
            this.verifyThat.fatal("Unknown Command - " + this.cmd);
            this.end();
        }
	},

	end : function(res) {
	    var $this = this;
        var time = pad(Math.floor(time/60000)) + ":" + pad(Math.round(time/1000) % 60);
        ($this.duration && $this.duration.getTime) ? this.duration = (Date.now() - $this.duration.getTime()) : "error: failed to set action duration";
		if (this.ended) {
			Logger.error("end() called on an already ended action, called by: " + arguments.callee.caller);
			return;
		}
		
        if (this._runTimer !== undefined) {
            clearTimeout(this._runTimer);
            this._runTimer = undefined;
        }
        this.ended = true;
		this.verifyThat._import(res);

		var fatalError = this.verifyThat.getFatalError();
        var promiseCallback = fatalError ? this.onRejected : this.onFulfilled;
        if (promiseCallback && !this.script.topScript._abort) {
			if (fatalError) this.verifyThat._clearFatals();
            var promiseScript = new AScript(promiseCallback, this.script.topScript, fatalError ? { message : fatalError.topic, action : this, toString : ()=>fatalError.topic} : this);
            this.script.topScript.stack.push("then");
            EventBus.addListener("script/end", e => {
				this.verifyThat._import(e.retVal);
                var stack = this.script.topScript.stack;
                if(stack[stack.length -1] == "then") this.script.topScript.stack.pop();
                Logger.trace("action.end(): in callback of promise script end, stack = " + this.script.topScript.stack.toString())
				this.script._endAction(this.verifyThat);
			},this.script.topScript.stack.toString());
            promiseScript.run();
            return;
        }
		
		if (this.result) this.setTopScriptParam(this.result, res);
		this.script._endAction(this.verifyThat);
	},

	findTarget : function(finder, cb, async) {
		function find() {
            if ($this.script._handleAbort($this)) return;

            var res;

            if (!async){
                res = finder();
                callback(res);
                Logger.trace("in SYNC finder :"  + res );
            }
            else {
                finder(function(err,finderResult){
                    Logger.debug("in ASYNC finder :"  + finderResult );
                    res = finderResult;
                    callback(res);
                });
            }
            Logger.trace("findTarget: res = " + res);

            function callback(res) {
                var callEnd = true;
                function onEnd(){
                    var stack = $this.getScript().topScript.stack;
                    var testId = $this.getScript().topScript.stack[0];
                    EventBus.dispatch("action/find/end", testId ,{stack : stack});
                }
                if (res.length == 1) {
                    var topScriptFindDelay = $this.topScript == $this && $this.getParam("finDelay");
                    setTimeout(function () {
                        $this.script.dispatch("action/find", {
                            elem: res[0],
                            stack: $this.script.topScript.stack,
                            action: $this
                        });
                        cb(res[0]);
                        // default findDelay (apart from top script default) is 200
                    }, $this.findDelay || topScriptFindDelay || 200);
                } else if(res.flags) {
                    console.log("in ascript " + res.flags);
                    if(res.flags.error) {
                        $this.end(ASError(res.flags.error, true));
                    }
                }
                else if (res.notReady) {
                    if ((readyTimeout = readyTimeout - 1000) > 0) {
                        callEnd = false;
                        setTimeout(find, 1000);
                    } else {
                        $this.end(ASError(res.notReady["reason"] || "Page not ready", true));
                    }
                } else if ((timeout = timeout - 1000) > 0) {
                    callEnd = false;
                    setTimeout(find, 1000);
                } else if ($this.optional) {
                    $this.end(null, true);
                } else {
                    if (res.html) $this._saveDomFile(res.html);
                    $this.end(ASError(res.errorMsg || (res.length == 0 ? "Target not found. (" + ($this.target || $this.value) + ") in " + $this.cmd : res.length + " potential targets were found"), true));
                }
                callEnd && onEnd();
            }
        }
		
		var $this = this;
		var timeout = this.timeout || 30000;
		var readyTimeout = this.pageTimeout || 40000;
        var stack = this.getScript().topScript.stack;
        var testId = this.getScript().topScript.stack[0];
        EventBus.dispatch("action/find/start", testId ,{stack : stack});
		find();
	},

    verifyCmd : function(verifierFunc, onEnd) {
        var that = this;
        function verify(){
            if (that.script._handleAbort(that)) return;

            var verifierBean = new ASVerifier();
            verifierBean = verifierFunc(verifierBean) || verifierBean;
            if (!verifierBean.hasErrors() || !timeout || ((timeout = timeout - 1000) <= 0)) {
                if(typeof(onEnd) == "function") onEnd(verifierBean);
                else that.end(verifierBean);
            }
            else setTimeout(verify, 1000);
        }

        var timeout = this.verifyTimeout;
        verify();
    },

    toString : function() { return AScript.getActionString(this) },

    getTopScriptParam : function(name) { return this.script.getTopScriptParam(name) },

	setTopScriptParam : function(name, value) { this.script.setTopScriptParam(name, value) },

    addToScriptParamValue : function(name, value) { this.script.addToScriptParamValue(name, value) },

    getParam : function(name) { return this.script.getParam(name) },

    setParam : function(name, value) { this.script.setParam(name, value) },

    getRawAction : function() { return this.script._data[this.script._curIndex] },

    getScript : function() { return this.script },

    getPositionInScript : function() { return this.positionInScript },

    getDomFile : function() { return this.domSnapshotName && Utils.getFile(this.domSnapshotName) },

    _saveDomFile : function(str) {
        this.domSnapshotName = "DOM-Snapshot." + (++domSnapshotCount) + ".html";
        Utils.saveStringAsFile(this.domSnapshotName, str);
    }
};
function pad(n) {
    return n < 10 ? '0' + n : n;
}

var domSnapshotCount = 0;
const nonCopyKeywords = ["cmd", "condition", "delay", "findDelay", "optional", "optionalAbort", "timeout", "redirectCmd", "allowQuestion", "scriptTimeout"];
const alertsWhichAreNotQuestions = [
    'Please select all relevant entries to be included in the group',
    'Please select all relevant entries to be included in the checkbox list',
    'Please select all relevant entries to be included in the drop-down menu',
    'The item\'s search region, is a rectangular area on the page that contains it. Adjust this region by resizing or moving it.'
];