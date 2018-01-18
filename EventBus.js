/**
 * Created by nadav on 9/1/16.
 */
var EventEmitter = require('events');

function eventBus(ruleFunc, clearFunc) {
    this.eventsMap = {};
    this.ruleFunc = ruleFunc;
    this.clearFunc = clearFunc;
}
Object.extend = function(target, source, descriptor) {
    if (source) {
        var props = Object.getOwnPropertyNames(source);
        for (var i = 0; i < props.length; i++)
            Object.defineProperty(target, props[i], Object.extend(Object.getOwnPropertyDescriptor(source, props[i]), descriptor));
    }
    return target;
}

Object.extend(eventBus.prototype, {
        addListener: function (eventType, callback, id) {
            id= id && id.toString();
            Logger.trace("EventBus : add listener called with " + eventType + "  id= " + id);
            var $this = this;
            if (typeof callback != "function") return;
            if (!this.eventsMap[eventType]) this.eventsMap[eventType] = [];

            var index = this.eventsMap[eventType].push({callback: callback, id: id}) - 1;
            // Provide handle back for removal of topic
            return {
                remove: function () {
                    delete $this.eventsMap[eventType][index];
                }
            };
        },
        removeListener: function (eventType, id) {
            Logger.trace("EventBus : remove listener " + eventType + " with id " + id);
            if (id){
                id = id.toString();
                var $this = this;
                this.eventsMap[eventType] && this.eventsMap[eventType].forEach(function (item,i){if (item.id == id) delete $this.eventsMap[eventType][i];})
            }
            else delete this.eventsMap[eventType];
        },
        dispatch: function (eventType, id, retVal) {
            var $this = this;
            id= id && id.toString();
            Logger.trace("EventBus : in event bus dispatch with " + eventType + "  id = " + id);
            if (!this.eventsMap[eventType]) return;
            this.eventsMap[eventType].filter(function (item) {
                return ((item.id && id) ? $this.ruleFunc(item.id, id) : false);
            }).forEach(function (item) {
                Logger.trace("EventBus : in dispatch executing  " + eventType + "  id= " + id);
                try {item.callback(retVal != undefined ? retVal : {});} catch(e){console.log("EventBus - exception in callback: " + e)}
            });
        },
        clearAll : function(id) {
            var $this=this;
            Object.keys(this.eventsMap).forEach(function(key) {
                $this.eventsMap[key].forEach(function (item, index) {
                    if ($this.clearFunc(item.id, id)) delete $this.eventsMap[key][index];
                })
            })
        }

    });

var busInstance = new eventBus(function(actualId, expectedId) {
    if (!actualId || !expectedId) return false;
    var actual = actualId.toString().split(",").toString();
    var exp = expectedId.toString().split(",").toString();
    return (exp == actual);
},
    function(actualId, expectedId){
        if (!actualId || !expectedId) return false;
        var actual = actualId.toString().split(",").toString();
        var exp = expectedId.toString().split(",").toString();
        return (actual.startsWith(exp));
    }

);

EventBus = {
    addListener : function (eventType, callback, id) {
        return busInstance.addListener(eventType, callback, id);
    },
    removeListener : function (eventType, id) {
        busInstance.removeListener(eventType, id);
    },
    dispatch : function(eventType, id, retVal){
        busInstance.dispatch(eventType, id, retVal)
    },
    clearAll : function(id){
        id ? busInstance.clearAll(id) : busInstance.eventsMap = {};

    }
}

module.exports = EventBus;

