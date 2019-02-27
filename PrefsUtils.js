

var fs= require("fs");

var prefsObj;
module.exports = {
    get : function(pref, ifc) {
        if (!prefsObj){
            try {
                prefsObj= global.command;
                let path = global.command.configPath || Utils.OS.slashFormatter("./config.json");
                if(fs.existsSync(path)){
                    var prefs_config = fs.readFileSync(path , 'utf8');
                    Object.extend(prefsObj,JSON.parse(prefs_config));
                }

            } catch(ex) { console.log("check your config file!  : " + ex)}
        }
        return prefsObj[pref];
    },

    set : function(pref, value, type, keepOldValue) {
        try {
            prefsObj= global.command;
            var path = global.command.configPath || Utils.OS.slashFormatter("./config.json");
            if(fs.existsSync(path)){
                var prefs_config = fs.readFileSync(path , 'utf8');
                Object.extend(prefsObj,JSON.parse(prefs_config));
                prefsObj[pref]=value;
            }
            else throw "there is no config file"
        } catch(ex) { console.log(ex)}

        if (value === undefined) delete prefsObj[pref];
        else {
            fs.writeFileSync(path,JSON.stringify(prefsObj,null,4));
        }
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