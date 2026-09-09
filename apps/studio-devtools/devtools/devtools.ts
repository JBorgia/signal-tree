/// <reference types="chrome" />

/**
 * The DevTools page. Its only job is to register the panel; it holds no state
 * and speaks no Studio protocol.
 */
chrome.devtools.panels.create('SignalTree', '', 'panel/index.html');
