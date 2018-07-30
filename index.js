#!/usr/bin/env node

const puppeteer = require('puppeteer');
const program = require('commander');
const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

var pageurl;

program
  .version('1.0.0', '-v, --version')
  .description("Generate a PDF of a webpage using Chrome in headless mode")
  .usage('[options] <url>')
  .arguments('<url>')
  .action(function (url) {
    pageurl = url;
  });

program
  .option('-s, --selector <selector>', 'query selector for an element whose existance in DOM will be checked prior to generating the PDF')
  .option('-p, --path <path>', 'the file path to save the PDF to. If path is a relative path, then it is resolved relative to current working directory', 'output.pdf')
  .option('-t, --title <title>', 'title to show in header of every page')
  .option('-n, --page-numbers', 'show page numbers in the footer')
  .option('-l, --enable-logging [path]', 'enable logging. Optional path can be specified for the logfile. If enabled, default filename is pooppdf.log')

program.on('--help', function(){
  console.log('');
  console.log('  Examples:');
  console.log('');
  console.log('    $ pooppdf "http://localhost:3000/dashboard/?print=1&token=f8s3h482s"');
  console.log('    $ pooppdf --selector "div.header" "http://localhost:3000/dashboard/?print=1&token=f8s3h482s"');
  console.log('    $ pooppdf --selector "div.header" --path dashboard.pdf "http://localhost:3000/dashboard/?print=1&token=f8s3h482s"');
  console.log('    $ pooppdf --selector "div.header" --path dashboard.pdf "http://localhost:3000/dashboard/?print=1&token=f8s3h482s" -n -t "Dashboard"');
  console.log('    $ pooppdf --selector "div.header" --path dashboard.pdf "http://localhost:3000/dashboard/?print=1&token=f8s3h482s" -n -t "Dashboard" -l ../Documents/pooppdf.log');
  console.log('');
});

program.parse(process.argv);

if (typeof pageurl === 'undefined') {
  console.error('No url given!');
  process.exit(1);
}


/**
 * Configure logging
 */

var logger = {
  log : () => {}
};

if(program.enableLogging){
  const logFormat = printf(info => {
    return `${info.timestamp} ${info.level}: ${info.message}`;
  });

  logger = winston.createLogger({
    level: 'info',
    format: combine(
      timestamp(),
      logFormat
    ),
    transports: [
      // - Write to all logs with level `info` and below to `combined.log` 
      new winston.transports.File({ filename: typeof program.enableLogging === 'string' ? program.enableLogging : 'pooppdf.log', handleExceptions: true })
    ]
  });
}


/**
 * Styles for header and footer
 */

var cssb = [];
cssb.push('<style>');
cssb.push('h1 { font-size:10px; width: 100%; }');
cssb.push('</style>');
var css = cssb.join('');

logger.log({
  level: 'info',
  message : "Generating PDF for URL : " + pageurl
});

(async () => {
  try{
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(pageurl, { waitUntil: 'networkidle0' });
    
    if(program.selector){
      await page.waitForFunction(selector => !!document.querySelector(selector), { polling: 'mutation' }, program.selector);
    }

    var options = {
      path: program.path,
      displayHeaderFooter: true,
      margin: {
        top: "80px",
        bottom: "80px"
      },
      scale : 0.8,
      width: 1080
    };

    if(program.title){
      Object.assign(options, {
        headerTemplate: css + '<h1 align="center">' + program.title + '</h1>',
      });
    }

    if(program.pageNumbers){
      Object.assign(options, {
        footerTemplate: css + '<h1 align="center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></h1>',
      })
    }

    await page.emulateMedia('screen');
    await page.pdf(options);

    logger.log({
      level: 'info',
      message : "PDF generated successfully!"
    });

    await browser.close();
    process.exit(0);
  } catch(err){
    logger.log({ level : 'error', message : err });
    process.exit(1);
  }
})();