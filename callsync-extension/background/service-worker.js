// Service worker pour gérer la communication entre le content script et le popup

let currentDeal = null;

// Configurer le side panel pour s'ouvrir uniquement sur Pipedrive
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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
  } else if (message.type === 'OPEN_SIDE_PANEL') {
    // Ouvrir le side panel dans l'onglet actuel
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id })
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('Erreur ouverture side panel:', error);
          sendResponse({ success: false, error: error.message });
        });
    } else {
      // Fallback: obtenir l'onglet actif
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.sidePanel.open({ tabId: tabs[0].id })
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((error) => {
              console.error('Erreur ouverture side panel:', error);
              sendResponse({ success: false, error: error.message });
            });
        }
      });
    }
    return true; // Async response
  } else if (message.type === 'TOGGLE_SIDE_PANEL') {
    // Toggle le side panel (ouvrir/fermer)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ tabId: tabs[0].id })
          .then(() => sendResponse({ success: true }))
          .catch((error) => sendResponse({ success: false, error: error.message }));
      }
    });
    return true;
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
