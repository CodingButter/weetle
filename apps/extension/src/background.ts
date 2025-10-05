// Background script for browser extension
console.log("Weetle extension background script loaded");

// Example: Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Weetle extension installed");
});
