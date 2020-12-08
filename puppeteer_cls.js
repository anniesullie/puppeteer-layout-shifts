// Script to get CLS information from a page, with a lot of help from
// https://addyosmani.com/blog/puppeteer-recipes/

const { trace } = require('console');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const {default: PQueue} = require('p-queue');

function traceFilename(url) {
  return url.replace(/[\W]/g, '_') + '.json';
}
function txtFilename(url) {
  return url.replace(/[\W]/g, '_') + '.txt';
}

function getTracePath(url, outDir) {
  if (!outDir.endsWith('/')) {
    outDir = outDir + '/';
  }
  return outDir + traceFilename(url);
}

function getTxtPath(url, outDir) {
  if (!outDir.endsWith('/')) {
    outDir = outDir + '/';
  }
  return outDir + txtFilename(url);
}

// This method is injected into the document. Based on documentation in
// https://web.dev/cls
function calcCLS() {
  window.cumulativeLayoutShiftScore = 0;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        window.cumulativeLayoutShiftScore += entry.value;
      }
    }
  });

  observer.observe({ type: 'layout-shift', buffered: true });
}

// Use puppeteer to get CLS.
async function getCLS(url, traceOut, chromePath) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox'],
    timeout: 10000
  });

  try {
    const page = await browser.newPage();
    // Use devtools emulation of phone with 4G network.
    // Need to do network emulation in order to slow down enough to generate layout
    // shifts. Unclear why this is true as CLS issue reproduce manually with no
    // network emulation.
    const Regular4G = {
      'offline': false,
      'downloadThroughput': 4 * 1024 * 1024 / 8,
      'uploadThroughput': 3 * 1024 * 1024 / 8,
      'latency': 20
    };
    const client = await page.target().createCDPSession();
    await client.send('Network.emulateNetworkConditions', Regular4G);
    // Use a consistent device; Moto G4 which I did most manual testing with in
    // devtools emulation is unavailable but it matches Nexus 5.
    await page.emulate(puppeteer.devices['Nexus 5']);
    await page.evaluateOnNewDocument(calcCLS);
    // Wait for 3 seconds after load.
    if (traceOut) {
      await page.tracing.start({ screenshots: true, path: traceOut, categories: ['loading', 'disabled-by-default-layout_shift.debug'] });
    }
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
    let cls = await page.evaluate(() => {
      return window.cumulativeLayoutShiftScore;
    });
    if (traceOut) {
      await page.tracing.stop();
    }
    browser.close();
    return cls;
  } catch (error) {
    console.log(error);
    browser.close();
  }
}

async function getAllCLS(url, outDir, numRuns, chromePath) {
  let allScores = [];
  for (let i = 0; i < numRuns; i++) {
    console.log('Starting run ', i, ' for ', url);
    let cls = await getCLS(url);
    allScores.push(cls);
  }
  console.log(url, allScores);
  fs.writeFileSync(getTxtPath(url, outDir), allScores.join('\n'));
  clsForTrace = await getCLS(url, getTracePath(url, outDir), chromePath);
  return allScores;
}

(async () => {
  const args = process.argv.slice(2);
  const data = fs.readFileSync(args[4], 'utf8');
  const urls = data.split(/\s/);
  const numRuns = args[0];
  const outDir = args[1];
  const chromePath = args[2];
  const queue = new PQueue({
    concurrency: 20
  });
  for (let url of urls) {
    queue.add(async () => getAllCLS(url, outDir, numRuns, chromePath));
  }
})();
