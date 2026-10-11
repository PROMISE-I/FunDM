var benchmarkOL = document.getElementById("benchmarks-ol")
var buttonsDiv = document.getElementById("buttons");
var globalResTBody = document.getElementById("global-result-tbody");
var bwdResTBody = document.getElementById("backward-result-tbody");
var anaResTBody = document.getElementById("analysis-result-tbody");

var progressBox = document.getElementById("progress-box");
var progressMeter = progressBox.querySelector("meter");
var loaderSpan = document.getElementById("loader");

progressBox.style.display = "none";
loaderSpan.style.display = "none";


var benchmarks = [
    { name: "Counter", select: true },
    { name: "Calculator", select: true },
    { name: "Conf Surplus", select: true },
    { name: "Fitness App", select: true },
    { name: "Flight Book", select: true },
    { name: "Doodle", select: true },
    { name: "ToDo List", select: true },
    { name: "Exp Tracker", select: true },
    { name: "Dice Game", select: true },
    { name: "Estate Retail", select: true }
];
const avg = 5;


/** 
 *  backward & analysis
*/
async function backwardAndAnalysis() {
    // fetch benchmarks and deltas 
    for (var i = 0; i < benchmarks.length; i++) {
        var benchmark = benchmarks[i].name.replace(' ', '');
        var isSelected = benchmarks[i].select;

        if (!isSelected) continue;  

        await (fetch('http://localhost:3000/api/benchmarks/' + benchmark)
        .then(response => response.json())
        .then(async data => {
            var oldCode = data['src'];
            var deltas = data['deltas'];
            
            for (var key in deltas) {
                if (deltas.hasOwnProperty(key)) {
                    // run backward in `avg` time
                    for (var n = 0; n < avg; n++) {
                        var delta = deltas[key];
                        var deltaName = key;

                        var fwdBeginTime = Date.now();
                        var fwdInfo = window.fwdFunc(oldCode);
                        var fwdEndTime = Date.now();
                        var fwdDuration = fwdEndTime - fwdBeginTime;
    
                        // Record the time of performing backward
                        var bwdBeginTime = Date.now();
                        var updatedInfo = window.bwdFunc(oldCode)(delta);
                        var bwdEndTime = Date.now();
                        var bwdDuration = bwdEndTime - bwdBeginTime;
                        
                        var backwardStatus = updatedInfo.$;
                        var newCode = updatedInfo.a;

                        var deltaSize = window.deltaSizeFunc(delta);
                        
                        // error handling   
                        if (backwardStatus !== 'Ok') {
                            console.log(`Backward Update Error: ${benchmark}-${deltaName}-${i}; info: ${newCode}`);
                            continue;
                        } 
                        
                        // console.log(`Get Backward Result: ${benchmark}-${deltaName}-${i}; duration: ${bwdDuration}`);
    
                        // Save the backward result into server
                        await (fetch('http://localhost:3000/api/saveUpdateResult', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ 
                                benchmark: benchmark, 
                                deltaName: deltaName, 
                                deltaSize: deltaSize,
                                oldCode: oldCode, 
                                newCode: newCode, 
                                fwdDuration: fwdDuration,
                                bwdDuration: bwdDuration 
                            })
                        })
                        .then(response => response.json())
                        .then(result => {
                            fillBwdResult(bwdResTBody, result);
                        })
                        .catch(error => {
                            alert('Backward Error:', error);
                        }));
    
                        // Perform analysis
                        if (n == 0) { 
                            var analysisResult = window.diffFunc(oldCode)(newCode);
    
                            // console.log(analysisResult);
                            // console.log(analysisResult.a);
                            
                            var analysisStatus = analysisResult.$;
                            var diffHeight = analysisResult.a.a;
                            var diffOperation = analysisResult.a.b;
                            
                            // error handling
                            if (analysisStatus !== 'Ok') {
                                console.log(`Analysis Error: ${benchmark}-${deltaName}-${i}; diffHeight: ${diffHeight}`);
                                console.log(`Analysis Error: updatedCode ${newCode}`);
                                continue;
                            } 
    
                            // Save the analysis result into server
                            await (fetch('http://localhost:3000/api/saveAnalysisResult', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ 
                                    benchmark: benchmark, 
                                    deltaName: deltaName, 
                                    diffHeight: diffHeight, 
                                    diffOperation: diffOperation 
                                })   
                            })
                            .then(response => response.json())
                            .then(result => {
                                fillAnalysisResult(anaResTBody, result);
                            })
                            .catch(error => {
                                alert('Analysis Error:', error);
                            }));
                        }

                        updateProgressMeter();
                    }
                }
            }
            await getGlobalResult(benchmark);
        })
        .catch(error => {
            alert(`Fetch Benchmarks Error: ${error}`);
        }));
    }
    updateProgressMeter();
}

function addTdToRow(row, content) {
    var contentTD = document.createElement("td");
    contentTD.textContent = content;
    row.appendChild(contentTD);
} 

function fillGlobalResult(tableBody, globalResult) {
    var row = document.createElement("tr");

    var keys = [
        'benchmark', 'LOC', 'fwd-avg-duration',
        'bwd-0-avg-duration', 'bwd-0-avg-duration-pct',
        'bwd-1-avg-duration', 'bwd-1-avg-duration-pct',
        'bwd-2-avg-duration', 'bwd-2-avg-duration-pct',
        'bwd-3-avg-duration', 'bwd-3-avg-duration-pct',
        // 'bwd-mid-duration', 
        'bwd-avg-duration',
        // 'bwd-min-diff-ast-height', 
        'bwd-avg-diff-ast-height', 
        // 'bwd-max-diff-ast-height',
        // 'bwd-min-diff-line-numbers', 
        'bwd-avg-diff-line-numbers', 
        // 'bwd-mid-diff-line-numbers', 
        // 'bwd-max-diff-line-numbers', 'bwd-avg-diff-line-numbers-pct', 
        // 'avg-delta-size'
    ];

    keys.forEach(key => {
        var value = globalResult[key];
        if (key.endsWith('pct')) {
            value = (value * 100).toFixed(2) + '%';
        } else if (typeof value === 'number' && !Number.isInteger(value)) {
            value = value.toFixed(2); 
        }
        addTdToRow(row, value);
    });

    tableBody.appendChild(row);
}

function fillBwdResult(tableBody, bwdResult) {
    var row = document.createElement("tr");
    // console.log(bwdResult);

    addTdToRow(row, bwdResult.res);
    addTdToRow(row, bwdResult.benchmark);
    addTdToRow(row, bwdResult.deltaName);
    addTdToRow(row, bwdResult.deltaSize);
    addTdToRow(row, bwdResult.bwdDuration);
    addTdToRow(row, bwdResult.fwdDuration);
    addTdToRow(row, bwdResult.diffLineNumbers);

    tableBody.insertBefore(row, tableBody.firstChild);
}


function fillAnalysisResult(tableBody, anaResult) {
    var row = document.createElement("tr");

    addTdToRow(row, anaResult.res);
    addTdToRow(row, anaResult.benchmark);
    addTdToRow(row, anaResult.deltaName);
    addTdToRow(row, anaResult.diffASTHeight);

    tableBody.insertBefore(row, tableBody.firstChild);
}

async function getGlobalResult(benchmark) {
    await (fetch('http://localhost:3000/api/exportGlobalResult/' + benchmark)
    .then(response => response.json())
    .then(data => {
        fillGlobalResult(globalResTBody, data['data']);
    })
    .catch(error => {
        alert(`Global Result Error: ${benchmark} ${error}`);
    }));
}

/**
 * Below codes are related to reset and run button.
 */
function initWebPageAndServer() {
    // init web page
    initPage();

    // init server
    compileELMScript();
    clearAllSummaries();
}

function initPage() {
    globalResTBody.innerHTML = "";
    bwdResTBody.innerHTML = "";
    anaResTBody.innerHTML = "";
}

async function compileELMScript() {
    await fetch('http://localhost:3000/api/genELMScript')
        .then(response => response.json())
        .then(data => {
            console.log('Compile ELM Script:', data);
        })
        .catch(error => {
            alert('Compile ELM Script Error:', error);
        });
}

function clearAllSummaries() {
    benchmarks.forEach(async benchmarkInfo => {
        var benchmark = benchmarkInfo.name.replace(' ', '');

        await fetch('http://localhost:3000/api/clearSummaries/' + benchmark)
        .then(response => response.json())
        .then(data => {
            console.log(`Clear Summaries: ${benchmark}`);
        })
        .catch(error => {
            alert(`Clear Summaries Error: ${benchmark} ${error}`);
        });
    });
}

function showProgressMeter() {
    var len = 0;
    benchmarks.forEach(benchmarkInfo => {if (benchmarkInfo.select) { len += 1; }});

    progressMeter.min = 0;
    progressMeter.max = len * avg * 12 + 1; // 12 is the number of deltas in each benchmark
    progressMeter.value = 0;

    progressBox.style.display = "block";
    loaderSpan.style.display = "inline-block";
}

function updateProgressMeter() {
    progressMeter.value += 1;
    if (progressMeter.value >= progressMeter.max) {
        progressBox.style.display = "none";
        loaderSpan.style.display = "none";
        setTimeout(() => {alert("Experiment completed!")}, 1);
    }
}

function runBtn() {
    initWebPageAndServer();

    // add a meter to show the progress
    showProgressMeter()

    // perform backward and analysis
    backwardAndAnalysis();
}

function setAll(isSelected) {
    // reset all selected benchmarks
    benchmarks.forEach(benchmarkInfo => {
        benchmarkInfo.select = isSelected;
    });
    benchmarkOL.childNodes.forEach(benchmarkLi => {
        var checkbox = benchmarkLi.querySelector("input[type='checkbox']");
        if (checkbox) {
            checkbox.checked = isSelected;
        }
    });
}

/**
 * Initialize the benchmark list in the web page.
 */

benchmarkOL.innerHTML = "";
for (let i = 0; i < benchmarks.length; i++) {
    var benchmarkInfo = benchmarks[i];
    var benchmark = benchmarkInfo.name;
    var isSelected = benchmarkInfo.select;

    var benchmarkLi = document.createElement("li");
    var checkbox = document.createElement("input");
    
    benchmarkLi.id = "benchmark";
    benchmarkLi.style.listStyleType = "none";
    checkbox.type = "checkbox";
    checkbox.value = benchmark;
    checkbox.checked = isSelected;

    checkbox.onchange =  function() {
        benchmarks[i].select = this.checked;
    } 

    benchmarkLi.appendChild(checkbox);
    benchmarkLi.appendChild(document.createTextNode(benchmark));
    benchmarkOL.appendChild(benchmarkLi);
}

// window.bwdFunc = $author$project$Experiment$backward; 
// window.diffFunc = $author$project$Experiment$analysis;