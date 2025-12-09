// Service worker pour gérer la communication entre le content script et le popup

const VERSION = '2.4.0';
let currentDeal = null;

// Afficher la version sur le badge au démarrage
chrome.action.setBadgeText({ text: 'v2.4' });
chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });

// Écouter les messages du content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Service Worker: Message reçu', message);
  
  if (message.type === 'DEAL_DETECTED') {
    console.log('Service Worker: Deal détecté et stocké', message.deal);
    currentDeal = message.deal;
    
    // Mettre à jour le badge de l'extension
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    
    sendResponse({ success: true });
  } else if (message.type === 'GET_CURRENT_DEAL') {
    console.log('Service Worker: Envoi du deal actuel', currentDeal);
    sendResponse({ deal: currentDeal });
  }
  
  return true; // Garde le canal de message ouvert pour sendResponse asynchrone
});

// Réinitialiser le deal quand l'utilisateur change d'onglet
chrome.tabs.onActivated.addListener(() => {
  currentDeal = null;
  chrome.action.setBadgeText({ text: 'v2.4' });
  chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
});

// Réinitialiser le deal quand l'URL change
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && !changeInfo.url.includes('pipedrive.com/deal/')) {
    currentDeal = null;
    chrome.action.setBadgeText({ text: 'v2.4' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  }
});
