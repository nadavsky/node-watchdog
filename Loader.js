var fs=require("fs")
var syncRequest = require('sync-request');

function Loader(path){
    if(Array.isArray(path)) {
        this.arrayOfPaths = path;
        this.numberOfFilesLoad = path.length;
        this.loadedFiles = [];
        this.error = null;
    }
}

Loader.prototype = {

    loadFiles(cb){
        var counNumberOfLoadedFiles = 0;
        var maxNumberOfFilesToLoad = this.numberOfFilesLoad;
        var files = this.loadedFiles = [];
        var callbackFunc = cb;

        function buildDataInput(data, filePath, fileName){
                var obj = {
                    path: filePath,
                    fileName: fileName,
                    testContent: data,
                };

                //We have the file now we can dispatch event or retturn an array of tests after the build ....
                files.push(obj);
                if(++counNumberOfLoadedFiles === maxNumberOfFilesToLoad){
                    callbackFunc(files);
                }
            }

        function isURL(path) {
              return (path.startsWith("http") || path.startsWith("https"));
         }

        function loadFileFromOS(path) {
             console.log("[Loader] The file is saved at the file system");
             if(fs.existsSync(path)){
                 fs.readFile(path,'utf8', (err,data)=>{buildDataInput(data,path, path.substr(path.lastIndexOf(Utils.OS.slashFormatter("/")) + 1))})
             }
             else {
                 callbackFunc([],"The path " + path + " no longer exist");
             }
         }

        function loadFileFromTheServer(path){

            var response = syncRequest("GET", path);
            buildDataInput(response.body.toString('utf-8'), path, path.substr(path.lastIndexOf('/') + 1));
        }

        this.arrayOfPaths.forEach((path) => {
            console.log("[Loader] Loading File from the path : " + path);

            if(isURL(path) == false){
                loadFileFromOS(path)
            }
            else {
                loadFileFromTheServer(path);
            }
        })
    }
}

module.exports = Loader;