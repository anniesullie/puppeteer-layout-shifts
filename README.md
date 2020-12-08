# puppeteer-layout-shifts

This repository contains some Node.js/[Puppeteer](https://developers.google.com/web/tools/puppeteer) scripts which automate measuring layout shifts on a large number of pages. They're currently pretty thrown together, but if they're useful they may evolve into a more polished tool.

## puppeteer_cls.js

Usage:
`node puppeteer_cls.js <numRuns> <outDir> <chromePath> <urlFile>`
 * `numRuns`: number of times to run the page to gather CLS. The script will perform an additional run to gather a trace with debug layout shift info. This run won't be counted in the results in case the tracing affects the page shifts.
 * `outDir`: output directory. The script generates url.txt and url.json for each URL into this output directory.
   * url.txt contains newline-separated results
   * url.json contains the trace of the run with debug layout shifts
 * `chromePath` is the path to the Chrome executable. This allows the script to be used with a custom build of chromium.
 * `urlFile` is a newline-separated list of urls.
 
This script runs the specified build of Chrome on the specified list of URLs, repeating the specified number of times, and calculates the layout shift for each run in JavaScript using the LayoutStability API. It outputs a .txt file with newline-separated CLS score results for each run into the specified output directory. Then it runs again to collect a trace with debug layout shift info, which it also outputs to the specified directory.

It runs devtools mobile emulation as a Nexus 5 with 4G network.

## analyze_results.js
Usage:
`node analyze_results.js`
This script makes a lot of assumptions about the directory it is run from:
  * It assumes there is a file called `url_list.txt` which is a newline-separated list of URLs also used in `puppeteer_cls.js`.
  * It assumes there are paired subdirectories with chromium revision numbers, e.g. `r786800`, `r786801`, `r786854`, `r786855`. For each pair of directories, it looks for a .txt file for each url, and compares the results to see if they are statistically significant, and if so whether there was a regression or progression.
