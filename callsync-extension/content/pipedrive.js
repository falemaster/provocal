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
  // Sélecteurs possibles pour le titre du deal dans Pipedrive (mis à jour 2024)
  const selectors = [
    '[data-test="deal-title"]',
    '[data-testid="deal-title"]',
    '[data-testid="deal-name"]',
    '[aria-label*="deal"]',
    '.dealTitle',
    '.deal-title',
    'h1[class*="title"]',
    'h1[class*="deal"]',
    'h1[class*="heading"]',
    '.cui4-text--heading-xl',
    '.cui4-text--heading-lg',
    '[class*="DetailViewHeader"] h1',
    '[class*="detailView"] h1',
    'header h1',
    '[role="heading"][aria-level="1"]'
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      const text = element.textContent.trim();
      // Éviter les titres trop longs ou vides
      if (text.length > 3 && text.length < 200) {
        return text;
      }
    }
  }

  // Fallback: chercher le premier h1 visible
  const h1Elements = document.querySelectorAll('h1');
  for (const h1 of h1Elements) {
    if (h1.offsetParent !== null && h1.textContent.trim()) {
      const text = h1.textContent.trim();
      if (text.length > 3 && text.length < 200) {
        return text;
      }
    }
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
