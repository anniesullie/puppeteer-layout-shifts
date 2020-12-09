const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const mwu = require('mann-whitney-utest');

function clsFilename(url) {
  return url.replace(/[\W]/g, '_') + '.txt';
}

function median(vals) {
  if (vals.length == 0) {
    return ''; // So it writes nothing in CSV
  } else if (vals.length == 1) {
    return vals[0];
  }

  vals.sort(function(a, b){return a - b;});
  var half = Math.floor(vals.length / 2);
  if (vals.length % 2) {
    return vals[half];
  }

  return (vals[half - 1] + vals[half]) / 2.0;
}

const args = process.argv.slice(2);
const data = fs.readFileSync(args[0], 'utf8');
const urls = data.split(/\s/);
let revisionDirs = process.argv.slice(4);
let csvHeader = [
  {id: 'url', title: 'Url'}
]
// If no revision dirs specified, read from current dir
if (revisionDirs.length == 0) {
  fs.readdirSync('.').forEach(file => {
    if (file.startsWith('r')) {
      revisionDirs.push(file);
    }
  });
}
let beforeRev = null;
for (let revisionDir of revisionDirs) {
  csvHeader.push({id: revisionDir, title: revisionDir});
  if (beforeRev) {
    csvHeader.push({id: beforeRev + revisionDir, title: beforeRev + ' to ' + revisionDir});
    beforeRev = null;
  } else {
    beforeRev = revisionDir;
  }
}

const csvWriter = createCsvWriter({
  path: args[1],
  header: csvHeader
})

const rows = [];
for (let url of urls) {
  if (url == '') {
    continue;
  }
  let row = {'url': url};
  for (let i = 0; i < revisionDirs.length; i += 2) {
    let rev1 = revisionDirs[i];
    let rev2 = revisionDirs[i + 1];
    let rev1Path = rev1 + '/' + clsFilename(url);
    let rev2Path = rev2 + '/' + clsFilename(url);
    let rev1Vals = [];
    let rev2Vals = [];
    let rev1Median = '';
    let rev2Median = '';
    if (!fs.existsSync(rev1Path)) {
      rev1Vals = [];
    } else {
      const data = fs.readFileSync(rev1Path, 'utf8');
      rev1Vals = data.split(/\s/);
      rev1Vals = rev1Vals.filter(n => {return n != '' && !isNaN(n)});
      rev1Vals = rev1Vals.map(n => Number(n));
      rev1Median = median(rev1Vals);
      row[rev1] = rev1Median;
    }
    if (!fs.existsSync(rev2Path)) {
      rev2Vals = [];
    } else {
      const data = fs.readFileSync(rev2Path, 'utf8');
      rev2Vals = data.split(/\s/);
      rev2Vals = rev2Vals.filter(n => {return n != '' && !isNaN(n)});
      rev2Vals = rev2Vals.map(n => Number(n));
      rev2Median = median(rev2Vals);
      row[rev2] = rev2Median;
    }
    let result = 'UNKOWN';
    if (rev1Vals.length > 0 && rev2Vals.length > 0) {
      const samples = [rev1Vals, rev2Vals]
      const u = mwu.test(samples);
      if (mwu.significant(u, samples)) {
        if (rev2Median > rev1Median) {
          result = 'REGRESSION';
        } else {
          result = 'IMPROVEMENT';
        }
      } else {
        result = 'NO CHANGE';
      }
    }
    row[rev1 + rev2] = result;
  }
  rows.push(row)
}

csvWriter.writeRecords(rows);
