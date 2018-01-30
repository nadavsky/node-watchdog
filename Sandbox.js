
var vm=require("vm");
var fs=require("fs");
var request = require('sync-request');
const { URL } = require('url');

function Sandbox(url,topSandbox){


    var context = this.context = vm.createContext({
        "nesting" :true,
        "sandbox"	: SandboxPrototype,
        "sandboxName"			: url
    });

    Object.extend(context, SandboxPrototype);


    this._topSb = topSandbox || this;

    this.cmdSequence = this._topSb.cmdSequence || [];
    context.context = context;
    context.cmd = context.cmd.bind(this);
    this.test = topSandbox ?  this._topSb.test : new test();
    this.test._topSb = this._topSb;
    context.Logger = Object.extend({}, context.Logger);
    var fileMatch = url.match(/([^/\.]*)(\.js)?$/);
    context.Logger.filename = fileMatch ? fileMatch[1].toMinLength(10) : "[unknown] ";
    context.runScript = context.runScript.bind(this);
    context.require = context.require.bind(this);
    this.module = context.module = {
        url		: url,
        exports	: {},
    };
    this.moduleMap = {};


    /*var file = fs.readFileSync(url);
    var _global = this._global = Sandbox.prototype;

    Object.extend(_global, SandboxPrototype);
    Object.extend(this, _global.__proto__);

    this._topSb = topSandbox || this;
    this.cmdSequence = this._topSb.cmdSequence || [];
    _global._global = _global;
    _global.Utils = Object.extend({}, _global.Utils);
    _global.Logger = Object.extend({}, _global.Logger);
    _global.CovarageReport = Object.extend({}, _global.CovarageReport);
    var fileMatch = url.match(/([^/\.]*)(\.js)?$/);
    _global.Logger.filename = fileMatch ? fileMatch[1].toMinLength(10) : "[unknown] ";
    _global.cmd = _global.cmd.bind(this);
    _global.describe = _global.describe.bind(this);
    _global.test = topSandbox ?  this._topSb._global.test : new test();
    _global.test._topSb = this._topSb;
    _global.runScript = _global.runScript.bind(this);
    _global.require = _global.require.bind(this);
    _global.xfind = _global.xfind.bind(this);
    this.module = _global.module = {
        url		: url,
        exports	: {},
    };
    this.moduleMap = {};*/









   /* this._topSb = topSandbox || this;
    this.test = topSandbox ?  this._topSb._global.test : new test();
    this.test._topSb = this._topSb;
    this.module = _global.module = {
        url		: url,
        exports	: {},
    };
    this.moduleMap = {}*/

}
Sandbox.prototype = {
    eval(data, url) {
        return vm.runInContext(data, this.context, {displayErrors:true, filename:this.context.sandboxName});
    },
}
SandboxPrototype={

    cmdSequence : [],

    Utils : {
        splitWords : function(str) {
            var words = [];
            str.split(/ |_|-|\./).forEach(function(w) { words = words.concat(w.split(/((?:[A-Z]+[a-z]*)|\d+)/)); });
            return words.filter(function(w) { return !!w; });
        },

        extend : function(target, source, descriptor) {
            if (source) {
                if (source instanceof Array && target instanceof Array) {
                    target.push.apply(target, source);
                } else {
                    var props = Object.getOwnPropertyNames(source);
                    for (var i = 0; i < props.length; i++)
                        Object.defineProperty(target, props[i], Object.extend(Object.getOwnPropertyDescriptor(source, props[i]), descriptor));
                }
            }
            return target;
        }

        //getPref : getPref,
    },

    Logger : {
        filename : "",
        debug(msg) {
            Logger.debug(msg, this.filename);
        },

        info(msg) {
            Logger.info(msg, this.filename);
        },

        error(msg) {
            Logger.error(msg, this.filename);
        },

        trace(msg) {
            Logger.trace(msg, this.filename);
        },

        write(msg) {
            Logger.write(msg);
        },

        exception(ex, msg) {
            Logger.exception(ex, msg, this.filename);
        }
    },

    console : console,


    runScript : function(scriptFunc, action) {
        Logger.trace("running script from script infra with " + action.getScript().topScript.stack)
        var s = new AScript(scriptFunc, action.getScript().topScript, action);
        EventBus.addListener("script/end", e => {
            Logger.trace("action end from scriptInfra with " + action.getScript().topScript.stack);
            if (!action.async) action.end(e.retVal); }, action.getScript().topScript.stack);
        s.run();
    },

    cmd: function (obj, arg2) {
        if (typeof obj == "function") obj = { cmd : obj, desc : "[function]" };
        else if (typeof obj == "string") obj = { cmd : arg2, desc : obj };
        this._topSb.cmdSequence.push(obj);
        obj.then = __then;
        obj.catch = __catch;
        obj.allowQuestion = true;
        return obj;
    },

    CovarageReport : {
        docMode : function(){ return CovarageReport.enabledDocMode() },

        loadedCommands : {
            push(data, module){
                if(CovarageReport.enabledDocMode()){
                    if(!CovarageReport.loadedCommands[module])
                        CovarageReport.loadedCommands[module] =[];
                    CovarageReport.loadedCommands[module].push(data);
                }
            }}
    },

    describe : function(desc, func) {
        this._global.cmd({ comment : true, desc : desc });
        func();
    },

    require: function(url) {
        var domain;
        if(url[0] == "."){
            if(this.module.url.includes("http")){
                domain = this.module.url.match(/.*\//)[0];
            }
            else{
                //support relative serving in test that loaded from the file system
                domain = "file://" + this.module.url;
            }

        }
        else domain = requireUrl;
        try { url = new URL(url, domain).href; } catch(ex) {}

        if (!this._topSb.moduleMap[url]) {
            if (!GlobalCache[url]) {

                var response = request('GET', url); //synchronous request

                if (response.statusCode === 200) {
                    GlobalCache[url] = response.body.toString('utf-8');
                } else {
                    var msg = `require("${url}") - Failed to download module. status=${response.status}`;
                    Logger.error(msg);
                    throw { message : msg , fileName : "to do : file name", lineNumber : "to do : line number" }
                }
            }

            var sandbox = new Sandbox(url, this._topSb);
            try {
                var res;
                sandbox.context.exports = function(obj) { res = obj; };
                sandbox.eval(GlobalCache[url], url);
                this._topSb.moduleMap[url] = res || sandbox.context.module.exports;
                sandbox.context.exports = null;
            } catch(ex) {
                Logger.error(`require("${url}") - Failed during eval. ex=${ex}`);
                throw ex;
            }
        }

        return this._topSb.moduleMap[url];
    },

    xfind: function (expr, context, extended) {
        function xpathResolver() {
            return "http://www.w3.org/1999/xhtml";
        }

        var doc = context.nodeType == Node.DOCUMENT_NODE ? context : context.ownerDocument, res;

        if (!expr) return [];

        if (expr[2] == ":") {
            if (expr.startsWith("js")) {		// todo: move to ffutils
                if (!doc.__sandbox) {
                    doc.__sandbox = new Components.utils.Sandbox([ doc ], {});
                    Components.utils.exportFunction(Utils.xfind, doc.__sandbox, { defineAs: "xfind" });
                }
                doc.__sandbox.ctx = context;
                doc.__sandbox.window = doc.defaultView;
                doc.__sandbox.console = doc.defaultView.console;

                res = Components.utils.evalInSandbox(expr.substr(3), doc.__sandbox);
                if (typeof res == "number" || typeof res == "string" || typeof res == "boolean") return [ res ];
                if (res) return !res.nodeType ? Array.prototype.slice.call(res, 0) : [ res ];
                return [];
            }

            if (expr.startsWith("re"))
                return [ (new RegExp(expr.substr(3))).exec(typeof context == "string" ? context : context.textContent)[1] ];

            if (expr.startsWith("cs"))
                return context.querySelectorAll ? Array.prototype.slice.call(context.querySelectorAll(expr.substr(3))) : [];

            if (expr.startsWith("[]")) {
                var exprs = expr.substr(3).split("[][]"), ctxs = Utils.xfind(exprs[0], context, extended), newCtxs = [];
                for (var i = 1; i < exprs.length; ++i) {
                    for (var j = 0; j < ctxs.length; ++j)
                        newCtxs = newCtxs.concat(Utils.xfind(exprs[i], ctxs[j], extended));
                    ctxs = newCtxs;
                    newCtxs = [];
                }
                return ctxs;
            }
        }

        if (extended) {
            var index = expr.indexOf("<<IFRAME>>");
            if (index > -1) {
                var results = [];
                var expr1 = expr.slice(0, index), expr2 = expr.slice(index + 10);
                Utils.xfind(expr1, context).forEach(function (elem) {
                    var iframeDoc = elem.parentNode == elem.ownerDocument ? elem.ownerDocument.defaultView.frameElement : elem.contentDocument;
                    results = results.concat(Utils.xfind(expr2, iframeDoc, true));
                });
                return results;
            }

            var error = false;
            expr = expr.replace(/{{(.*[^}][^}])}}/g, function (str, p1) {
                var res = Utils.xfind(p1, context);
                if (res.length == 1) return res[0];
                else error = true;
            });
            if (error) return [];
        }

        try {
            res = doc.evaluate(expr, context, xpathResolver, XPathResult.ANY_TYPE, null);
        } catch (ex) {
            //Error.reportException(ex, "Invalid XPath expression: " + expr);
            Logger.error("Invalid XPath expression: " + expr);
            return [];
        }

        switch (res.resultType) {
            case XPathResult.STRING_TYPE    :
                return [ res.stringValue ];
            case XPathResult.NUMBER_TYPE    :
                return [ res.numberValue ];
            case XPaObjectthResult.BOOLEAN_TYPE    :
                return [ res.booleanValue ];
            default:
                var retVal = [], elem;
                while (elem = res.iterateNext()) retVal.push(elem);
                return retVal;
        }
    },

    getPref : getPref
}
var moreProps=["Node","setTimeout","clearTimeout","KeyEvent", "FormData", "File", ""];
moreProps.forEach(function(item){ SandboxPrototype[item] = global[item]; });
module.exports = Sandbox;

function getPref(pref, ifc) {
    try {
        var prefs_config = fs.readFileSync(process.env.HOME  + "/watchdog/config.json", 'utf8');
        prefsObj = JSON.parse(prefs_config);
        return prefsObj[pref];
    } catch(ex) { }
}
function test(){

    this.on = function(eventType, cb, isCmd){
        //this.eventsMap[eventType] = cb.toString().contains("cmd") ? 1 : 0;
        if(isCmd){
            Logger.debug("on event '" + eventType+ "' on " + this.testPath())
            this.eventsMap[eventType] ? this.eventsMap[eventType].push(cb) : this.eventsMap[eventType] = [cb];
        }
        else this._topSb.test.addListener(eventType, cb);
    };

    this.off = function(eventType, listener){ // todo : clean the specific events map if there are no more listeners with cmds
        if(this.eventsMap[eventType]){
            this.eventsMap[eventType].forEach((cb,i, arr)=>{if(cb == listener) arr.splice(i,1) })
        }
        else this._topSb.test.removeListener(eventType ,listener);
    };

    this.dispatch =  function(type, props){
        if(this.eventsMap[type]){
            Logger.debug("dispatch event '" + type+ "' on " + this.testPath())
            var $this=this;
            props.topScript.addScriptCommands($this.eventsMap[type], $this.testPath(), props);
        }
        Object.dispatch.apply(this,[type, props]);
    };

    this.exit =  function(errorMessage) {
        this._topSb.cmd({
            cmd		:  (action) => {
                if(errorMessage) {
                    action.verifyThat.fatal(errorMessage);
                } else {
                    action.script.topScript._abort = true;
                    action.script.topScript._abortOnError = false;
                    action.script.topScript._abortTrigger = true; //will clean the AScript._abort on script termination
                    AScript._abortMsg = "exit!";
                }

                action.end();
            },
            delay	: 1,
            desc	: "exit"
        });
    };

    this.testPath = function(){return this._topSb.module.url;};

    this.eventsMap = {};

    this.name = function(){
        if(this.testPath().indexOf("/") != -1)
            return this.testPath().match(/([^/]*(?=\.js))|([^/]*$)/)[0];
        else
            return this.testPath().match(/[^\\]*(?=\.js)/)[0];
    };

    this.props = {
        data : {},
        set(prop,data){ this.data[prop] = data},
        get(prop){return this.data[prop]}
    };

    this.zappId  = "create a zapp first";
}
var GlobalCache = {};
var requireUrl = getPref("watchdog.requireUrl") || "http://127.0.0.1/other/watchdog-components/";
var __then = function(onFulfilled, onRejected){
    if (onFulfilled) this.onFulfilled = onFulfilled;
    if (onRejected) this.onRejected = onRejected;
};

var __catch = function(onRejected) { this.onRejected = onRejected; }

Object.extend = function(target, source, descriptor) {
    if (source) {
        var props = Object.getOwnPropertyNames(source);
        for (var i = 0; i < props.length; i++)
            Object.defineProperty(target, props[i], Object.extend(Object.getOwnPropertyDescriptor(source, props[i]), descriptor));
    }
    return target;
}