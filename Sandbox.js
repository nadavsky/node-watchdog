
var Sandbox=require("sandbox");
var AScript=require("./AScript");

Object.extend(Sandbox.prototype ,{
    eval(data, url) { return this.run(data); },

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
        this.global.cmd({ comment : true, desc : desc });
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
                var request = new XMLHttpRequest();
                request.open('GET', url, false);  // "false" makes the request synchronous
                request.send(null);

                if (request.status === 200) {
                    GlobalCache[url] = request.responseText;
                } else {
                    var msg = `require("${url}") - Failed to download module. status=${request.status}`;
                    Logger.error(msg);
                    throw { message : msg , fileName : Components.stack.caller.filename, lineNumber : Components.stack.caller.lineNumber }
                }
            }

            var sandbox = new Sandbox(url, this._topSb);
            try {
                var res;
                sandbox.global.exports = function(obj) { res = obj; };
                sandbox.eval(GlobalCache[url], url);
                this._topSb.moduleMap[url] = res || sandbox.global.module.exports;
                sandbox.global.exports = null;
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
})

module.exports = Sandbox;

function getPref(pref, ifc) {
    try {
        var prefs_config = fs.readFileSync(process.env.HOME  + "/watchdog/config.json", 'utf8');
        prefsObj = JSON.parse(prefs_config);
        return prefsObj[pref];
    } catch(ex) { }
}

Object.extend = function(target, source, descriptor) {
    if (source) {
        var props = Object.getOwnPropertyNames(source);
        for (var i = 0; i < props.length; i++)
            Object.defineProperty(target, props[i], Object.extend(Object.getOwnPropertyDescriptor(source, props[i]), descriptor));
    }
    return target;
}