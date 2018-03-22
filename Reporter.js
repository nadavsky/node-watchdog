var xmlbuilder = require('xmlbuilder');

function Reporter(tests, reportName,reportPath){
    if(arguments.length == 0){throw new Error("Missing arguments");}
    if(!Array.isArray(tests)){throw new Error("Expected to receive not empty array of tests");}
    this.tests = tests;
    this.reportName = reportName;
    this.reportPath = reportPath;
}


Reporter.prototype = {


    generateJenkinsReport(){
        this.tests = this.tests.filter((item)=>{return (item.test.wasRun || item.test.invalid)});
        var testSuitesElem = xmlbuilder.create("testsuites");
        //var testSuitesElem = doc.appendChild(doc.createElement("testsuites"));
        var failuresCounter = 0, totalTime = 0;

        this.tests.forEach((test, id)=>{
            if(!test.test.wasRun && !test.test.invalid) return;
            var curr_test = test.test;
            var testElem =testSuitesElem.ele("testsuite");
            this._updateTestSuiteElem(testElem,curr_test, id);

            var testCaseElem = testElem.ele("testcase");
            this._updateTestCaseElem(testCaseElem,curr_test);

            failuresCounter += curr_test.results.failures.length > 0 ? 1 : 0 ;
            totalTime += curr_test.results.duration.inSec
        });
        this._updateTestSuitesElem(testSuitesElem,failuresCounter,totalTime);

        return testSuitesElem;
    },

    _updateTestSuitesElem(testSuitesElem,failuresCounter,totalTime){
        this._copyObjectPropsToElemAttributes(testSuitesElem, {
            "name"      : this.reportName,
            "hostname"	: "localhost",
            "tests"		: this.tests.length,
            "failures"	: failuresCounter,
            "errors"	: "0",
            "time"		: totalTime,
            "timestamp"	:(new Date()).toISOString()
        });
    },

    _updateTestCaseElem(testCaseElem,test){
        var reportPath = this.reportPath;
        this._copyObjectPropsToElemAttributes(testCaseElem, {
            "name"		: test.name,
            "classname" : test.name,
            "time"		: test.results.duration
        });
        var data=[];
        test.results.failures.forEach((failure) => {
            var failureElem = testCaseElem.ele("failure");
            this._copyObjectPropsToElemAttributes(failureElem, {
                "type" : "AssertionFailedError",
                "message" : failure });
        });

        var logPath = `${this.reportPath}${Utils.OS.slashFormatter("/")}${test.name}.log`;
        if (test.results.stdout.length > 0) {
            //var data = `${test.results.stdout.join("\n")}\n\nError image :\n[[ATTACHMENT|${logPath}]]\n${Object.keys(test.results.collectData).map(key => {return `[[ATTACHMENT|${this.reportPath}/${key}]]\n`}).toString().replace(",","")}`;
            test.results.stdout.forEach((item, i, arr)=>{
                if(item.includes("[error.image]")) arr[i] = `Error image:\n[[ATTACHMENT|${this.reportPath+Utils.OS.slashFormatter("/")}${arr[i]}]]\n\n`;
                data[i] = arr[i];
            });
            data[data.length]= `Log file:\n[[ATTACHMENT|${logPath}]]\n`;
            data = data && data.join("\n");
            testCaseElem.ele("system-out").dat(data);
        }


    },

    _updateTestSuiteElem(testCaseElem,test, id){
        this._copyObjectPropsToElemAttributes(testCaseElem, {
            "package"   : test.packageName ? test.packageName : "com.domain.watchdog",
            "name"      : test.name,
            "id"		: id,
            "hostname"	: "localhost",
            "tests"		: "1",
            "failures"	: test.results.failures.length > 0 ? 1 : 0,
            "errors"	: "0",
            "time"		: test.results.duration,
            //"stepsTimes": test.results.stepsTimes,
            "timestamp"	: test.startTime && test.startTime.toISOString()
        })
    },

    _copyObjectPropsToElemAttributes(elem,receivedObject){
        Object.keys(receivedObject).forEach((propName)=>{
            try{elem.att(propName, receivedObject[propName]);} catch(ex){console.log(ex)}
        });
        return elem;
    }


}
module.exports = Reporter;