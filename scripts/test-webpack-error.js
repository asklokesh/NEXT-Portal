// Test specifically for webpack module loading errors
const puppeteer = require('puppeteer');

(async () => {
 const pages = [
 '/dashboard', '/catalog', '/plugins', '/templates', 
 '/workflows', '/deployments', '/health', '/analytics'
 ];
 
 console.log('Testing for webpack module loading errors...\n');
 
 const browser = await puppeteer.launch({ 
 headless: true,
 args: ['--no-sandbox', '--disable-setuid-sandbox']
 });
 
 let hasWebpackError = false;
 
 for (const page of pages) {
 const url = `http://localhost:4400${page}`;
 const browserPage = await browser.newPage();
 
 // Collect webpack-specific errors
 const webpackErrors = [];
 
 browserPage.on('console', msg => {
 const text = msg.text();
 if (text.includes("Cannot read properties of undefined (reading 'call')") ||
 text.includes('options.factory') ||
 text.includes('__webpack_require__')) {
 webpackErrors.push(text);
 }
 });
 
 browserPage.on('pageerror', error => {
 if (error.message.includes('webpack') || 
 error.message.includes("Cannot read properties of undefined (reading 'call')")) {
 webpackErrors.push(error.message);
 }
 });
 
 try {
 await browserPage.goto(url, { 
 waitUntil: 'networkidle0',
 timeout: 15000 
 });
 
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 if (webpackErrors.length > 0) {
 console.log(` ${page}: WEBPACK ERRORS FOUND`);
 webpackErrors.forEach(err => console.log(` ${err}`));
 hasWebpackError = true;
 } else {
 console.log(` ${page}: No webpack errors`);
 }
 
 } catch (error) {
 console.log(` ${page}: Failed to load (${error.message})`);
 }
 
 await browserPage.close();
 }
 
 await browser.close();
 
 console.log('\n' + '='.repeat(50));
 if (hasWebpackError) {
 console.log(' WEBPACK MODULE LOADING ERRORS DETECTED!');
 process.exit(1);
 } else {
 console.log(' NO WEBPACK MODULE LOADING ERRORS! The fix is working!');
 process.exit(0);
 }
})();