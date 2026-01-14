// background service worker: create context menu and handle commands
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'copy_clean_selection',
    title: 'Copy selection (clean)',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === 'copy_clean_selection') {
    // send selection text (if available) to content script to copy
    chrome.tabs.sendMessage(tab.id, { action: 'copy-selection', selectionText: info.selectionText });
  }
});

// keyboard command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'copy-selection') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0] || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'copy-selection' });
    });
  }
});