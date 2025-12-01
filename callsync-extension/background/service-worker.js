// Service worker pour gérer la communication entre le content script et le popup

let currentDeal = null;

// Écouter les messages du content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DEAL_DETECTED') {
    console.log('Service Worker: Deal reçu', message.deal);
    currentDeal = message.deal;
    
    // Mettre à jour le badge de l'extension
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    
    sendResponse({ success: true });
  } else if (message.type === 'GET_CURRENT_DEAL') {
    sendResponse({ deal: currentDeal });
  }
  
  return true; // Garde le canal de message ouvert pour sendResponse asynchrone
});

// Réinitialiser le deal quand l'utilisateur change d'onglet
chrome.tabs.onActivated.addListener(() => {
  currentDeal = null;
  chrome.action.setBadgeText({ text: '' });
});

// Réinitialiser le deal quand l'URL change
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && !changeInfo.url.includes('pipedrive.com/deal/')) {
    currentDeal = null;
    chrome.action.setBadgeText({ text: '' });
  }
});
