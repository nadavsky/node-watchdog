global.EventBus = require("./EventBus");
global.Utils = require("./Utils");
global.PrefsUtils=require("./PrefsUtils");
global.command={};
for(var i = 2 ; i < process.argv.length ; i++){
    //console.log(i + ': ' + process.argv[i]);
    if (process.argv[i].startsWith("--") && process.argv[i+1]){
        global.command[process.argv[i].slice(2)]  =  process.argv[i+1]
    }
}
var TestMgr = require("./TestMgr");

TestMgr.init();
