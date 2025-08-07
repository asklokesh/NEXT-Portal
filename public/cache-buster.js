// Cache busting utility for webpack module loading issues
(function() {
 'use strict';
 
 // Check for webpack module loading errors
 window.addEventListener('error', function(event) {
 const error = event.error;
 const message = event.message || '';
 
 // Detect webpack module loading errors
 if (
 message.includes('Cannot read properties of undefined (reading \'call\')') ||
 message.includes('webpack.js') ||
 (error && error.stack && error.stack.includes('__webpack_require__'))
 ) {
 console.warn('Webpack module loading error detected, clearing cache...');
 
 // Clear all caches
 if ('caches' in window) {
 caches.keys().then(function(names) {
 names.forEach(function(name) {
 caches.delete(name);
 });
 });
 }
 
 // Clear localStorage plugin and cache entries
 Object.keys(localStorage).forEach(function(key) {
 if (
 key.startsWith('plugin-') || 
 key.includes('cache') || 
 key.includes('query') ||
 key.includes('webpack')
 ) {
 localStorage.removeItem(key);
 }
 });
 
 // Show user-friendly message
 const notification = document.createElement('div');
 notification.innerHTML = `
 <div style="
 position: fixed;
 top: 20px;
 right: 20px;
 background: #ef4444;
 color: white;
 padding: 16px 20px;
 border-radius: 8px;
 box-shadow: 0 4px 12px rgba(0,0,0,0.15);
 z-index: 10000;
 max-width: 300px;
 font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
 font-size: 14px;
 line-height: 1.4;
 ">
 <strong>Module Loading Error</strong><br>
 Cache cleared. Reloading page...
 <div style="margin-top: 8px;">
 <button onclick="window.location.reload()" style="
 background: rgba(255,255,255,0.2);
 border: 1px solid rgba(255,255,255,0.3);
 color: white;
 padding: 4px 8px;
 border-radius: 4px;
 cursor: pointer;
 font-size: 12px;
 ">Reload Now</button>
 </div>
 </div>
 `;
 document.body.appendChild(notification);
 
 // Auto-reload after 3 seconds
 setTimeout(function() {
 window.location.reload();
 }, 3000);
 }
 });
 
 // Add cache-busting for dynamic imports
 const originalImport = window.__webpack_require__;
 if (originalImport) {
 window.__webpack_require__ = function(moduleId) {
 try {
 return originalImport.call(this, moduleId);
 } catch (error) {
 console.warn('Webpack require failed for module:', moduleId, error);
 throw error;
 }
 };
 }
 
 // Check for stale service worker
 if ('serviceWorker' in navigator) {
 navigator.serviceWorker.getRegistrations().then(function(registrations) {
 registrations.forEach(function(registration) {
 registration.update();
 });
 });
 }
})();