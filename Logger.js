
const DEBUG_LEVELS  = {
    TRACE   : ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL","EXCEPTION"],
    DEBUG   : ["DEBUG", "INFO", "WARN", "ERROR", "FATAL","EXCEPTION"],
    INFO    : ["INFO", "WARN", "ERROR", "FATAL","EXCEPTION"],
    WARN    : ["WARN", "ERROR", "FATAL","EXCEPTION"],
    ERROR   : ["ERROR", "FATAL","EXCEPTION"],
    FATAL   : ["FATAL","EXCEPTION"],
    OFF     : ["EXCEPTION"]
};

let instance = null;
var fs = require('fs');

function LoggerClass (outputPath, filename, debugLevel,suffix = ".log", consoleMode = false) {
    this._cleanOldObservers();
    this._init(outputPath, filename, debugLevel,suffix, consoleMode);
    this._buildMethods();
    if(!consoleMode){
        this._initOutputFiles();
        this._initConsoleHook()

    }
    instance = this;
    this.writeHeader();
    setInterval(this.dump.bind(this), 2000);
}

LoggerClass.prototype =  {
    // should be with props


    _init(outputPath, filename, debugLevel,suffix = ".log", consoleMode = false){
        this.path         = outputPath;
        this.filename     = ( typeof(filename) == "string" ?  filename : "main") + ( suffix || ".log");
        this.debugLevel   = debugLevel || "DEBUG";
        this.consoleMode  = consoleMode ;
        this.log          = [];
        this.stamp = "watchdog";
    },

    _cleanOldObservers(){
        if(instance &&  !instance.consoleMode) instance._destroyListenrs();
    },

    get filePath(){
        return (this.path + Utils.OS.slashFormatter("/") + this.filename);
    },

    _initOutputFiles(){
        var path = this.path ?  this.path :  Utils.OS.getUserHome() + Utils.OS.slashFormatter("/watchdog");
        var filePath = path + Utils.OS.slashFormatter("/") +this.filename;
        if(!fs.existsSync(path)) fs.mkdirSync(path);
        if(!fs.existsSync(filePath)) fs.appendFileSync(filePath,"");
        else fs.unlinkSync(path + Utils.OS.slashFormatter("/") +this.filename )
        this.outputDir    =  path;
        this.outputFile   =  fs.openSync(path + Utils.OS.slashFormatter("/") + this.filename,'a');
        //fs.appendFileSync(this.outputFile);
    },

    _supportedLevels(){
        return ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
    },

    _timer(){
        var date = new Date();
        function str10(num) { return num < 10 ? "0" + num : num; }
        function str100(num) { return num < 10 ? "00" + num : (num < 100 ? "0" + num : num); }
        return "".concat(str10(date.getHours()), ":", str10(date.getMinutes()), ":", str10(date.getSeconds()), ".",  str100(date.getMilliseconds()));
    },

    _initConsoleHook(){
        var _self = this;

        console.log = function(msg) {
            //_self.debug(msg.filename + " - " + msg.lineNumber + " - " + this.log.caller.name + " - " + msg.level + " - " + msg.arguments[0], "console  ");
            _self.debug(msg, "console  ");
            process.stdout.write(msg + '\n');
        };


    },

    _destroyListenrs(){
        //instance.obsService.removeObserver(instance.listener, 'console-api-log-event', false);
    },

    _buildMethods(){
        var debugLevel = this.debugLevel;
        this._supportedLevels().forEach((level) => {
            this[level.toLowerCase()] = function(msg, stamp, timestamp = true, data = undefined){
                if(level !== "OFF" && (DEBUG_LEVELS[debugLevel].indexOf(level) !== -1)){
                    this.write(` ${stamp || this.stamp}  - ${level} - ${msg} ${data ? ` ${JSON.stringify(data)}` : ''}\n`, timestamp);
                }
            }
        })
    },

    exception(ex, msg, stamp,  timestamp = true){
        msg = msg ? msg + "\n" : "";
        if (ex) {
            var stack = ex.stack;
            if (!stack) try { throw new Error(); } catch(err) { stack = err.stack; }
            msg += (ex.message || "").concat("\n", stack);
        }
        this.write(`${stamp || this.stamp} - ${"EXCEPTION"} - ${msg}` + "\n", timestamp);
    },

    writeHeader(){
        this.write(`=-=-=-=-=-=-=-=-=-=- ${(new Date()).toString()} -=-=-=-=-=-=-=-=-=-= \n`, false);
    },

    write (msg, timestamp = false) {
        if(msg.length != 0) {
            var formatted_msg = (timestamp ? (this._timer() + "") : "") + `${msg}`;
            this.log.push(formatted_msg);
        }
    },

    dump(force){
        var joined = this.log.join("");
        if (this.log.length) {
            this.consoleMode ?
                console.log(joined) : fs.writeFile(this.outputFile, joined,()=>{});
            this.log.splice(0);
        }
    },

    dumpSync(){
        var joined = this.log.join("");
        if (this.log.length) {
            this.consoleMode ?
                console.log(joined) : fs.writeFileSync(this.outputFile, joined, "utf8");
            this.log.splice(0);
        }
    }


}

module.exports = LoggerClass;