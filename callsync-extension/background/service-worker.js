// Service worker pour gérer la communication entre le content script et le popup

let currentDeal = null;
let callsyncWindowId = null;

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
  } else if (message.type === 'OPEN_CALLSYNC_WINDOW') {
    // Ouvrir une vraie fenêtre Chrome séparée et déplaçable
    const pos = message.position || { width: 380, height: 620, left: 100, top: 100 };
    
    // Vérifier si la fenêtre existe déjà
    if (callsyncWindowId) {
      chrome.windows.get(callsyncWindowId, (win) => {
        if (chrome.runtime.lastError || !win) {
          // La fenêtre n'existe plus, en créer une nouvelle
          createCallSyncWindow(pos, sendResponse);
        } else {
          // Focus sur la fenêtre existante
          chrome.windows.update(callsyncWindowId, { focused: true });
          sendResponse({ success: true, windowId: callsyncWindowId });
        }
      });
    } else {
      createCallSyncWindow(pos, sendResponse);
    }
    return true; // Async response
  } else if (message.type === 'OPEN_CALLSYNC_TAB') {
    // Fallback: ouvrir dans un nouvel onglet
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
    sendResponse({ success: true });
  }
  
  return true; // Garde le canal de message ouvert pour sendResponse asynchrone
});

// Créer une nouvelle fenêtre CallSync
function createCallSyncWindow(pos, sendResponse) {
  // Utiliser type: 'normal' au lieu de 'popup' pour avoir les permissions microphone complètes
  chrome.windows.create({
    url: chrome.runtime.getURL('popup/popup.html'),
    type: 'normal',
    width: pos.width,
    height: pos.height,
    left: pos.left,
    top: pos.top,
    focused: true
  }, (win) => {
    if (win) {
      callsyncWindowId = win.id;
      sendResponse({ success: true, windowId: win.id });
    } else {
      sendResponse({ success: false, error: 'Failed to create window' });
    }
  });
}

// Nettoyer l'ID de fenêtre quand elle est fermée
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === callsyncWindowId) {
    callsyncWindowId = null;
  }
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
