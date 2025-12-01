// Content script pour détecter les deals Pipedrive

// Fonction pour extraire l'ID du deal depuis l'URL
function extractDealId() {
  const url = window.location.href;
  // Format: https://*.pipedrive.com/deal/[ID] ou /deal/[ID]/...
  const match = url.match(/\/deal\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Fonction pour extraire le nom du deal depuis le DOM
function extractDealName() {
  // Sélecteurs possibles pour le titre du deal dans Pipedrive
  const selectors = [
    '[data-test="deal-title"]',
    '.dealTitle',
    'h1[class*="title"]',
    'h1[class*="deal"]',
    '.cui4-text--heading-xl',
    '[data-testid="deal-title"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }

  // Fallback: chercher le premier h1
  const h1 = document.querySelector('h1');
  if (h1 && h1.textContent.trim()) {
    return h1.textContent.trim();
  }

  return null;
}

// Observer les changements de DOM pour détecter quand un deal est chargé
function observeDealChanges() {
  const observer = new MutationObserver(() => {
    sendDealInfo();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Envoyer aussi immédiatement au chargement
  setTimeout(sendDealInfo, 1000);
}

// Envoyer les infos du deal au service worker
function sendDealInfo() {
  const dealId = extractDealId();
  
  if (dealId) {
    const dealName = extractDealName();
    
    console.log('CallSync: Deal détecté', { dealId, dealName });
    
    chrome.runtime.sendMessage({
      type: 'DEAL_DETECTED',
      deal: {
        id: dealId,
        name: dealName || `Deal #${dealId}`
      }
    }).catch(err => {
      console.log('CallSync: Erreur envoi message', err);
    });
  }
}

// Démarrer l'observation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeDealChanges);
} else {
  observeDealChanges();
}

// Écouter les changements d'URL (navigation SPA)
let lastUrl = window.location.href;
setInterval(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(sendDealInfo, 500);
  }
}, 500);
