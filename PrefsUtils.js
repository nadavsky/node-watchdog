




module.exports = {

    get : function(pref, ifc) {
        try {
            console.log("//TODO get config from config file")
        } catch(ex) { }
    },

    set : function(pref, value, type, keepOldValue) {
        if (pref.indexOf("watchdog.") == -1 || keepOldValue) {
            try { var origPrefs = JSON.parse(pref.getPref("extensions.origPrefs")) } catch(ex) {};
            if (origPrefs && origPrefs[pref] === undefined) {
                var origVal = pref.getPref(pref);
                origPrefs[pref] = origVal === undefined ? null : origVal;
            }
        }

        if (value === undefined) return prefs.clearUserPref(pref);

        var setPrefMethod;
        if (type) setPrefMethod = prefs["set".concat(type, "Pref")];
        else try {
            switch (prefs.getPrefType(pref)) {
                case Ci.nsIPrefBranch.PREF_STRING	: setPrefMethod = prefs.setCharPref; break;
                case Ci.nsIPrefBranch.PREF_INT		: setPrefMethod = prefs.setIntPref; break;
                case Ci.nsIPrefBranch.PREF_BOOL		: setPrefMethod = prefs.setBoolPref; break;
            }
        } catch(ex) {}

        if (!setPrefMethod) {
            switch (typeof value) {
                case "string"	: setPrefMethod = prefs.setCharPref; break;
                case "number"	: setPrefMethod = prefs.setIntPref; break;
                case "boolean"	: setPrefMethod = prefs.setBoolPref; break;
            }
        }

        if (!setPrefMethod) return Logger.error("Utils.setPref: preference type is either not supported or unknown");

        if (origPrefs && origPrefs[pref] !== undefined) pref.setPref("extensions.origPrefs", JSON.stringify(origPrefs));

        setPrefMethod.call(prefs, pref, value);
    },

    getChildList : function(pref, obj) {
        try { return prefs.getChildList(pref, obj || {}); }
        catch(ex) {
            console.log("[Prefer] exception -> " + ex.msg)
        }

        return [];
    },

    buildUserPrefStr : function(prefName, prefValue) {
        if (typeof prefValue == "string") {
            prefValue = prefValue.replace(/\\/g, "\\\\");
            prefValue = prefValue.replace(/\"/g, "\\\"");
            prefValue = "\"".concat(prefValue, "\"");
        }

        return "user_pref(\"".concat(prefName, "\",", prefValue, ");\n");
    }
}