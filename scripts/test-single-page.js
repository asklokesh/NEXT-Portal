// Test single page for webpack errors
const puppeteer = require('puppeteer');

(async () => {
 const url = process.argv[2] || 'http://localhost:4400/dashboard';
 
 console.log(`Testing ${url} for webpack errors...`);
 
 const browser = await puppeteer.launch({ 
 headless: true,
 args: ['--no-sandbox', '--disable-setuid-sandbox']
 });
 
 try {
 const page = await browser.newPage();
 
 // Collect console errors
 const errors = [];
 page.on('console', msg => {
 if (msg.type() === 'error') {
 const text = msg.text();
 if (text.includes('Cannot read properties of undefined') || 
 text.includes('webpack') || 
 text.includes('call')) {
 errors.push(text);
 }
 }
 });
 
 page.on('pageerror', error => {
 errors.push(error.message);
 });
 
 const response = await page.goto(url, { 
 waitUntil: 'networkidle0',
 timeout: 30000 
 });
 
 await new Promise(resolve => setTimeout(resolve, 2000));
 
 console.log(`Status: ${response.status()}`);
 
 if (errors.length > 0) {
 console.log('\n WEBPACK/MODULE ERRORS FOUND:');
 errors.forEach(err => console.log(` - ${err}`));
 process.exit(1);
 } else {
 console.log(' No webpack errors found!');
 process.exit(0);
 }
 
 } catch (error) {
 console.error('Error:', error.message);
 process.exit(1);
 } finally {
 await browser.close();
 }
})();