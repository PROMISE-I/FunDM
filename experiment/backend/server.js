var fs = require('fs');
var path = require('path');
var cors = require('cors');
var diff = require('diff');
var { execSync } = require('child_process');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

const port = 3000;
const benchmarksDir = '../Benchmarks';
// const deltasDirStr = 'fixedSeqDeltas';
const deltasDirStr = 'deltas';
const summariesDirStr = 'summaries';

// 使Express能够解析大JSON请求体
app.use(bodyParser.json({limit: '5000mb'}));
app.use(bodyParser.urlencoded({limit: '5000mb', extended: true}));

// set CORS header
app.use(cors());


app.get('/api/clearSummaries/:benchmark', (req, res) => {
    var benchmark = req.params.benchmark;
    clearSummaries(benchmark);
    res.json({ 'res': 'Ok' });
});

app.get('/api/genELMScript', (req, res) => {
    genELMScript();
    res.json({ 'res': 'Ok' });
});

app.get('/api/benchmarks/:benchmark', (req, res) => {
    var benchmark = req.params.benchmark;    
    var srcPath = path.join(benchmarksDir, benchmark, lowercaseFirstChar(benchmark) + 'SourceCode');
    var deltasPath = path.join(benchmarksDir, benchmark, deltasDirStr);

    console.log("Received request for benchmark: " + benchmark);
    genELMScript();
    // clear last summaries results
    clearSummaries(benchmark);

    // read benchmark source code and deltas
    var sourceCode = fs.readFileSync(srcPath, 'utf8');
    var deltas = fs.readdirSync(deltasPath).map(delta => {
        var deltaPath = path.join(deltasPath, delta);
        return { [delta]: fs.readFileSync(deltaPath, 'utf8') };
    }).reduce((acc, delta) => {
        return { ...acc, ...delta };  
    }, {});

    res.json({ 'src': sourceCode, 'deltas': deltas });
});

app.post('/api/saveUpdateResult', (req, res) => {
    var benchmark = req.body.benchmark;
    var deltaName = req.body.deltaName;
    var deltaSize = req.body.deltaSize;
    var oldCode = req.body.oldCode;
    var newCode = req.body.newCode;
    var fwdDuration = req.body.fwdDuration;
    var bwdDuration = req.body.bwdDuration;

    var summariesPath = path.join(benchmarksDir, benchmark, summariesDirStr);
    var summaryPath = path.join(summariesPath, deltaName);
    var lineDiffPath = path.join(summaryPath, 'lineDiff.json');
    var newCodePath = path.join(summaryPath, 'updatedCode');
    var coreInfoPath = path.join(summaryPath, 'coreRes.json');

    console.log(`Received request to save delta for benchmark: ${req.body.benchmark}-${deltaName}...`);

    if (!fs.existsSync(summariesPath)) {
        fs.mkdirSync(summariesPath, { recursive: true });
    }
    if (!fs.existsSync(summaryPath)) {
        fs.mkdirSync(summaryPath, { recursive: true });
    }

    // Line diff info
    var lineDiff = diff.diffLines(oldCode, newCode);
    var diffLN = diffLineNumbers(lineDiff);
    fs.writeFileSync(lineDiffPath, JSON.stringify(lineDiff, null, 2), 'utf8');

    // New code
    fs.writeFileSync(newCodePath, newCode, 'utf8');

    // Core high level info: duration, diffLineNumbers
    var newCoreInfo = 
        { benchmark: benchmark
        , deltaName: deltaName
        , deltaSize: deltaSize
        , fwdDurations: [fwdDuration]
        , bwdDurations: [bwdDuration]
        , diffLineNumbers: diffLN
        };
    var coreInfo = {};
    if (fs.existsSync(coreInfoPath)) {
        const oldCoreInfoContent = fs.readFileSync(coreInfoPath, 'utf8');
        coreInfo = JSON.parse(oldCoreInfoContent);
    } 
    if (coreInfo.hasOwnProperty('bwdDurations')) {
        newCoreInfo.bwdDurations = newCoreInfo.bwdDurations.concat(coreInfo.bwdDurations);
    }
    if (coreInfo.hasOwnProperty('fwdDurations')) {
        newCoreInfo.fwdDurations = newCoreInfo.fwdDurations.concat(coreInfo.fwdDurations);
    }
    coreInfo = { ...coreInfo, ...newCoreInfo };
    fs.writeFileSync(coreInfoPath, JSON.stringify(coreInfo, null, 2), 'utf8');

    res.json({ 'res': 'Ok', 'benchmark': benchmark, 'deltaName': deltaName,'deltaSize': deltaSize, 'bwdDuration': bwdDuration, 'fwdDuration': fwdDuration,'diffLineNumbers': diffLN });
});

app.post('/api/saveAnalysisResult', (req, res) => {
    var benchmark = req.body.benchmark;
    var deltaName = req.body.deltaName;
    var diffHeight = req.body.diffHeight;
    var diffOperation = req.body.diffOperation;

    var summariesPath = path.join(benchmarksDir, benchmark, summariesDirStr);
    var summaryPath = path.join(benchmarksDir, benchmark, summariesDirStr, deltaName);
    var astDiffPath = path.join(summaryPath, 'astDiff.json');
    var coreInfoPath = path.join(summaryPath, 'coreRes.json');

    console.log(`Received analysis result for benchmark: ${benchmark}-${deltaName}...`);

    if (!fs.existsSync(summariesPath)) {
        fs.mkdirSync(summariesPath, { recursive: true });
    }
    if (!fs.existsSync(summaryPath)) {
        fs.mkdirSync(summaryPath, { recursive: true });
    }

    // AST diff info
    fs.writeFileSync(astDiffPath, diffOperation, 'utf8');

    // Core high level info: diffASTHeight
    var newCoreInfo = 
        { benchmark: benchmark
        , deltaName: deltaName
        , diffASTHeight: diffHeight
        };
    var coreInfo = {};
    if (fs.existsSync(coreInfoPath)) {
        var oldCoreInfoContent = fs.readFileSync(coreInfoPath, 'utf8');
        coreInfo = JSON.parse(oldCoreInfoContent);
    } 
    coreInfo = { ...coreInfo, ...newCoreInfo };
    fs.writeFileSync(coreInfoPath, JSON.stringify(coreInfo, null, 2), 'utf8');

    res.json({ 'res': 'Ok', 'benchmark': benchmark, 'deltaName': deltaName,'diffASTHeight': diffHeight });
});

app.get('/api/exportGlobalResult/:benchmark', (req, res) => {
    var resInfo = {};

    var benchmark = req.params.benchmark;
    var srcPath = path.join(benchmarksDir, benchmark, lowercaseFirstChar(benchmark) + 'SourceCode');
    var summariesPath = path.join(benchmarksDir, benchmark, summariesDirStr);
    var mergedAttrNames = ['deltaSizes', 'fwdDurationList', 'bwdDurationList', 'diffASTHeightList', 'diffLineNumbersList'];
    var result = {};

    mergedAttrNames.forEach(attrName => { result[attrName] = []; });

    if (fs.existsSync(summariesPath)) {
        var summaryDirs = fs.readdirSync(summariesPath).filter(file => fs.statSync(path.join(summariesPath, file)).isDirectory());

        summaryDirs.forEach(dir => {
            var key = dir.charAt(0);
            if (!result[key]) {
                result[key] = { bwdDurationList: []};
            }

            var coreResPath = path.join(summariesPath, dir, 'coreRes.json');
            if (fs.existsSync(coreResPath)) {
                var coreRes = JSON.parse(fs.readFileSync(coreResPath, 'utf8'));
                if (coreRes.bwdDurations && Array.isArray(coreRes.bwdDurations)) {
                    result[key].bwdDurationList.push(...coreRes.bwdDurations);
                    result['bwdDurationList'].push(...coreRes.bwdDurations);
                }
                if (coreRes.fwdDurations && Array.isArray(coreRes.fwdDurations)) {
                    result['fwdDurationList'].push(...coreRes.fwdDurations);
                }
                if (coreRes.diffLineNumbers !== undefined) {
                    result['diffLineNumbersList'].push(coreRes.diffLineNumbers);
                }
                if (coreRes.diffASTHeight !== undefined) {
                    result['diffASTHeightList'].push(coreRes.diffASTHeight);
                }
                if (coreRes.deltaSize !== undefined) {
                    result['deltaSizes'].push(coreRes.deltaSize);
                }
            }

            /* Gen Global Result */
            // benchmark
            resInfo['benchmark'] = benchmark;
            // LOC
            if (fs.existsSync(srcPath)) {
                resInfo['LOC'] = fs.readFileSync(srcPath, 'utf8').split('\n').length;
            } else {
                resInfo['LOC'] = 1; 
            }
            // fwd-avg-duration
            resInfo['fwd-avg-duration'] = listAvg(result['fwdDurationList']);

            // bwd-0-avg-duration, bwd-0-avg-duration-pct, bwd-1-avg-duration, bwd-1-avg-duration-pct, bwd-2-avg-duration, bwd-2-avg-duration-pct, bwd-3-avg-duration, bwd-3-avg-duration-pct
            for (var key in result) {
                if (!mergedAttrNames.includes(key)) {
                    var avgKey = `bwd-${String(key)}-avg-duration`;
                    var avgKeyPct = `bwd-${String(key)}-avg-duration-pct`;
                    resInfo[avgKey] = listAvg(result[key].bwdDurationList);
                    resInfo[avgKeyPct] = resInfo[avgKey] / resInfo['fwd-avg-duration'];
                }
            }

            // bwd-mid-duration, bwd-avg-duration
            resInfo['bwd-mid-duration'] = result['bwdDurationList'][Math.floor(result['bwdDurationList'].length / 2)];
            resInfo['bwd-avg-duration'] = listAvg(result['bwdDurationList']);

            // bwd-min-diff-line-numbers, bwd-avg-diff-line-numbers, bwd-max-diff-line-numbers, bwd-avg-diff-line-numbers-pct
            resInfo['bwd-min-diff-line-numbers'] = Math.min(...result['diffLineNumbersList']);
            resInfo['bwd-avg-diff-line-numbers'] = listAvg(result['diffLineNumbersList']);
            resInfo['bwd-mid-diff-line-numbers'] = result['diffLineNumbersList'][Math.floor(result['diffLineNumbersList'].length / 2)];
            resInfo['bwd-max-diff-line-numbers'] = Math.max(...result['diffLineNumbersList']);
            resInfo['bwd-avg-diff-line-numbers-pct'] = resInfo['bwd-avg-diff-line-numbers'] / resInfo['LOC'];
            // bwd-min-diff-ast-height, bwd-avg-diff-ast-height, bwd-max-diff-ast-height
            resInfo['bwd-min-diff-ast-height'] = Math.min(...result['diffASTHeightList']);
            resInfo['bwd-avg-diff-ast-height'] = listAvg(result['diffASTHeightList']);
            resInfo['bwd-max-diff-ast-height'] = Math.max(...result['diffASTHeightList']);

            // avg-delta-size
            resInfo['avg-delta-size'] = listAvg(result['deltaSizes']);
        });

        res.json({ 'res': 'Ok', 'data': resInfo });
    } else {
        res.json({ 'res': 'No summaries found for benchmark: ' + benchmark });
    }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

function lowercaseFirstChar(str) {
  if (!str) return str; 
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function diffLineNumbers(lineDiff) {
    let addedLines = 0;
    let removedLines = 0;

    lineDiff.forEach(diff => {
        if (diff.added) {
            addedLines += diff.count;
        }
        if (diff.removed) {
            removedLines += diff.count;
        }
    });

    return Math.max(addedLines, removedLines);
}

const elmScriptDir = '../elm.js';
const genElmScriptCmd = 'elm make ./src/Experiment.elm  --output=experiment/elm.js';
const genElmScriptCwd = '../../';

function genELMScript() {
    // run elm make to generate raw elm script 
    try {
        const stdout = execSync(genElmScriptCmd, { cwd: genElmScriptCwd });
    } catch (error) {
        console.log("Error generating Elm.js: ", error);
    }

    if (!fs.existsSync(elmScriptDir)) {
        console.log("Elm.js not found, copying it from Elm runtime...");
        fs.copyFileSync('./elm.js', elmScriptDir);
    }

    var elmScriptContent = fs.readFileSync(elmScriptDir, 'utf8');

    // 在 var $author$project$Experiment$main 之前插入两行代码
    var modifiedContent = elmScriptContent.replace(
        /var \$author\$project\$Experiment\$main/,
        'window.fwdFunc = $author$project$Experiment$forward;\n'+
        'window.bwdFunc = $author$project$Experiment$backward;\n'+
        'window.diffFunc = $author$project$Experiment$analysis;\n'+
        'window.deltaSizeFunc = $author$project$Experiment$calcDeltaSize;\n'+
        'var $author$project$Experiment$main'
    );

    fs.writeFileSync(elmScriptDir, modifiedContent, 'utf8');
}

function clearSummaries(benchmark) {
    var summariesPath = path.join(benchmarksDir, benchmark, summariesDirStr);
    if (fs.existsSync(summariesPath)) {
        fs.rmSync(summariesPath, { recursive: true, force: true });
        console.log(`Deleted summaries folder for benchmark: ${benchmark}`);
    }
}

function listAvg(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}