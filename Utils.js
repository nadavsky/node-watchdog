Object.extend = function(target, source, descriptor) {
    if (source) {
        var props = Object.getOwnPropertyNames(source);
        for (var i = 0; i < props.length; i++)
            Object.defineProperty(target, props[i], Object.extend(Object.getOwnPropertyDescriptor(source, props[i]), descriptor));
    }
    return target;
}
Object.extend(String.prototype, {

    toMinLength : function(minLength, indentStr) {
        indentStr = indentStr || " ";
        var str = this;
        while (str.length < minLength) str += indentStr;
        return str;
    },

    normalizeSpace : function() { return this.replace(/\s+/g, " ").trim(); },

    xpathEscape : function() {
        if (this.indexOf("'") == -1) return "'" + this + "'";
        // if (this.indexOf('"') == -1) return '"' + this + '"';
        return '"' + this + '"';
        // ToDo: Handle cases were string contains both " & ' (using xpath concat)
    }

}, { enumerable : false });
Object.extend(Array.prototype, {
    get lastItem() { return this[this.length - 1]; },

    xIndexOf : function(item, count) {
        var idx = -1;
        do { idx = this.indexOf(item, idx + 1);
        } while(idx != -1 && --count >= 0)
        return idx;
    },

    propIndexOf : function(obj, prop) {
        for (var i = 0; i < this.length; ++i)
            if (this[i][prop] == obj) return i;
        return -1;
    },

    functionIndexOf : function(callback, thisArg) {
        thisArg = thisArg || window;
        for (var i=0; i<this.length; ++i)
            if (callback.call(thisArg,this[i]))
                return i;
        return -1;
    },

    find : function(extractor, value, thisArg) {
        for (var i=0; i<this.length; ++i) {
            var obj = this[i];
            var val = (typeof extractor == "function") ? extractor.call(thisArg || window, obj) : obj[extractor];
            if (val===value) return obj;
        }
    },

    mapAndFilter : function(callback, thisArg) {
        var res = [];
        thisArg = thisArg || window;
        Array.prototype.forEach.call(this, function (obj,index) {
            var mappedObj = callback.call(thisArg,obj,index);
            if (mappedObj!=undefined && mappedObj!=null) res.push(mappedObj);
        });
        return res;
    },

    isSet : function() {
        var onlyObjects = true;
        var res = this.every(function(obj) {
            if (obj === undefined || obj === null || obj.__appears__) return false;
            else if (typeof obj == "boolean" || typeof obj == "number") return onlyObjects = false;
            else return obj.__appears__ = true;
        });
        this.forEach(function(obj) {
            if (obj) delete obj.__appears__;
        });
        if (!onlyObjects) {
            res = this.every(function(obj,index) {
                return this.indexOf(obj,index+1)==-1;
            },this);
        }
        return res;
    },

    contains : function(arr) {
        var $this = this;
        return arr.every(function(obj) {
            return $this.indexOf(obj)>-1;
        });
    },

    createMap : function(callback, thisArg) {
        var res = {};
        thisArg = thisArg || window;
        Array.prototype.forEach.call(this, function (obj,index) {
            var key = callback.call(thisArg,obj,index);
            if (key) res[key] = obj;
        });
        return res;
    },

    sameAs : function(arr, callback) {
        return this.length==arr.length &&
            this.every(function(obj,index) {
                return callback(obj,arr[index]);
            });
    },

    mapSort : function(mapFunction, compareFunction) {
        compareFunction = compareFunction || function(a,b) { return a - b; };
        var map = this.map(function(obj) { return { obj: obj, val: mapFunction(obj) }; });
        map.sort(function(a,b) { return compareFunction(a.val, b.val); });
        return map.map(function(obj) { return obj.obj; });
    },

    arrayOfAttributes : function(attribute){
        return this.mapAndFilter(function(val) { return val[attribute]; });
    },

    pushToSet : function(obj) {
        if (this.indexOf(obj)==-1) this.push(obj);
    },

    /**
     * Return a shallow copy of this array and remove from it the elements that exist in the given array.
     */
    diffFromArray : function(arr) {
        if (!Array.isArray(arr)){
            Logger.error("Bad use of function diffFromArr() in Array, the argument is not an Array:" + arr);
            return null;
        }
        var diffArr = [];
        this.forEach(function (elem) {
            if(arr.indexOf(elem) === -1) diffArr.push(elem);
        });
        return diffArr;
    }

}, { enumerable : false });
Object.extend(Function.prototype, {
    asyncCall : function(thisObj) {
        var $this = this, args = Array.prototype.slice.call(arguments, 1);
        asyncCalls.push(function() { $this.apply(thisObj || window, args); });
        asyncCalls.lastItem._realFunc = this;
        postMessage("asyncCall", "*");
    },

    clearAsyncCall : function() {
        for (var i = 0; i < asyncCalls.length; ++i)
            if (asyncCalls[i]._realFunc == this)
                return asyncCalls.splice(i, 1)[0];
    }
}, { enumerable : false });


(function(){

    const __listeners__ = '__listeners__';
    const __delayedEvents__ = '__delayedEvents__';

    var EventsProto = {
        addListener : function(type, listener) {
            if (typeof listener != "function") return;

            var listeners = this[__listeners__];
            if (!listeners) {
                listeners = {};
                Object.defineProperty(this, __listeners__, { value : listeners, configurable : true });
            }

            type.trim().split(/\s+/).forEach(function(type) {
                var typeListeners = listeners[type];
                if (!typeListeners)	listeners[type] = [ listener ];
                else if (typeListeners.indexOf(listener) == -1) typeListeners.push(listener);
            });
        },

        addOnetimeListener : function(type, listener) {
            function wrapperListener() {
                $this.removeListener(type, wrapperListener);
                return listener.apply(this, arguments);
            }

            var $this = this;
            this.addListener(type, wrapperListener);
            return wrapperListener;
        },

        addScopedEvent : function(type, listener, scope) {
            var $this = this;
            function addOrigListener() {
                if (scope.filter && !scope.filter()) return;
                logger.trace("Scope start:" + scope.id + " . add listener on type: " + type);
                $this.addListener(type,listener);
            }
            function removeOrigListener() {
                logger.trace("Scope end: " + scope.id + " . remove listener on type: " + type);
                $this.removeListener(type,listener);
            }

            logger.trace("addScopedEvent on  type: " + type + " scope obj:" + scope.id );
            if (scope.inScope()) addOrigListener();
            if(scope.obj) {
                scope.obj.addListener(scope.startEvent, addOrigListener);
                scope.obj.addListener(scope.stopEvent, removeOrigListener);
            } else {
                logger.error("Add Scoped event is trying to register and object which is not exist. scope: " + scope.id);
            }
        },

        addBatchListener : function(type, listener) {
            function wrapperListener(e) {
                event = e;
                if (!dispatchPending) {
                    dispatchPending = true;
                    eventStack[0].listeners.push(dispatch);
                }
            }

            function dispatch() {
                dispatchPending = false;
                listener.call(e.target, e);
            }

            var dispatchPending = false, event;
            this.addListener(type, wrapperListener);
            return wrapperListener;
        },

        removeListener : function (type, listener) {
            var listeners = this[__listeners__], removed = false;
            if (!listeners) return false;

            type.trim().split(/\s+/).forEach(function(type) {
                var typeListeners = listeners[type];
                if (!typeListeners) return;
                for (var i = 0; i < typeListeners.length; ++i) {
                    if (typeListeners[i] == listener) {
                        if (typeListeners.length == 1)
                            delete listeners[type];
                        else
                            typeListeners.splice(i, 1);
                        return removed = true;
                    }
                }
            });
            return removed;
        },

        delayedDispatch : function(type) {
            function dispatch() {
                if (dispatched) return;
                dispatched = true;
                delete $this[__delayedEvents__][type];
                $this.dispatch.apply($this, $arguments);
            }

            if (!this[__delayedEvents__])
                Object.defineProperty(this, __delayedEvents__, { value : {} });
            else if (this[__delayedEvents__][type]) return;

            this[__delayedEvents__][type] = true;

            var $this = this, $arguments = arguments, dispatched = false;
            if (eventStack.length > 0 && (eventStack.length > 1 || eventStack[0].canTriggerDelayed))
                delayedListeners.push(dispatch);
            dispatch.asyncCall();
        },

        dispatch : function (type, props) {
            function doDispatch(obj) {
                var listeners = obj[__listeners__] && obj[__listeners__][type];
                if (listeners) {
                    listeners = listeners.concat([]);
                    if (!event) {
                        if (eventsLogger) logEvent(target, type, props);
                        event = new Event(type, target, props);
                        eventStack.push(event);
                    }
                    event.listeners = listeners;
                    for (var i = 0; i < listeners.length; ++i)
                        try { listeners[i].call(target, event);	} catch(ex) { Logger.exception(ex); }

                    if (event._stop) return;
                }

                var constructor = obj._constructor || obj.constructor;
                if (constructor) doDispatch(constructor);
            }

            if (eventStack.length > 30) {
                logger.error("Too many nested events: " + eventStack.map(function(event) { return event.type; }));
                logger.stack();
                return;
            }

            var target = this, event;
            doDispatch(this);
            if (event) {
                if (event._lastListeners && !event._stop) {
                    for (var i = 0; i < event._lastListeners.length; ++i)
                        try { event._lastListeners[i].call(target, event); } catch(ex) { Logger.exception(ex); }
                }
                eventStack.pop();
                if (eventStack.length == 0 && delayedListeners.length > 0) {
                    for (var i = 0; i < delayedListeners.length; ++i) delayedListeners[i]();
                    delayedListeners = [];
                }
            }
            return event;
        }
    };

    function Event(type, target, props) {
        Object.extend(this, props);
        this.type = type;
        this.target = target;
    }

    Object.extend(Event, {
        get currentEvent() { return eventStack.lastItem; }
    });

    Event.prototype = {
        stopPropagation : function() {
            this._stop = true;
        },

        stopImmediatePropagation : function() {
            this.listeners.splice(0);
            this.stopPropagation();
        },

        addLastListener : function(listener) {
            (this._lastListeners = this._lastListeners || []).push(listener);
        }
    }

    var eventStack = [], delayedListeners = [];
    var eventsLogger;

    Object.extend(Object.prototype, EventsProto, { enumerable : false });
    Object._constructor = Function._constructor = { constructor : null };

    function logEvent(target, type, props) {
        eventsLogger.debug(function() {
            return "".toMinLength(eventStack.length,"   ").concat(
                type," --> ",(typeof target == "function" ? "function" : target.toString())," --> ",Object.keys(props || {}).mapAndFilter(function(key) {
                    if (typeof props[key] != "function") return key + ":" + (props[key] && props[key].toString());
                }).join(", "));
        });
    }

}());