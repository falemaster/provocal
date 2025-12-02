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
  console.log('CallSync: Recherche du nom du deal dans le DOM...');
  
  // Sélecteurs possibles pour le titre du deal dans Pipedrive (2024)
  const selectors = [
    // Sélecteurs principaux
    'h1[class*="dealTitle"]',
    'h1[class*="deal-title"]',
    'h1[data-test="deal-title"]',
    'h1[data-testid="deal-title"]',
    'h1[data-testid="deal-name"]',
    
    // Sélecteurs génériques Pipedrive
    '.detailView h1',
    '.detailViewHeader h1',
    '[class*="DetailView"] h1',
    '[class*="detailView"] h1',
    
    // Sélecteurs par texte visible
    'h1.cui4-text--heading-xl',
    'h1.cui4-text--heading-lg',
    'h1.cui4-text',
    
    // Sélecteurs de fallback
    'header h1',
    '[role="heading"][aria-level="1"]',
    'h1'
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`CallSync: Sélecteur "${selector}" trouvé ${elements.length} élément(s)`);
    
    for (const element of elements) {
      if (element && element.textContent.trim()) {
        const text = element.textContent.trim();
        // Vérifier que ce n'est pas un titre de navigation
        const isNavigation = text.toLowerCase().includes('affaires') || 
                           text.toLowerCase().includes('deals') ||
                           text.toLowerCase().includes('pipedrive');
        
        if (!isNavigation && text.length > 3 && text.length < 200 && element.offsetParent !== null) {
          console.log(`CallSync: Nom du deal trouvé avec "${selector}": "${text}"`);
          return text;
        }
      }
    }
  }

  console.log('CallSync: Aucun nom de deal trouvé dans le DOM');
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
  
  console.log('CallSync: Vérification deal - URL:', window.location.href);
  console.log('CallSync: Deal ID extrait:', dealId);
  
  if (dealId) {
    const dealName = extractDealName();
    
    console.log('CallSync: Deal détecté', { dealId, dealName, url: window.location.href });
    
    chrome.runtime.sendMessage({
      type: 'DEAL_DETECTED',
      deal: {
        id: dealId,
        name: dealName || `Deal #${dealId}`
      }
    }).then(response => {
      console.log('CallSync: Message envoyé avec succès', response);
    }).catch(err => {
      console.error('CallSync: Erreur envoi message', err);
    });
  } else {
    console.log('CallSync: Aucun deal détecté dans l\'URL');
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
