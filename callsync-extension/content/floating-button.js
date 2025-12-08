// Bouton flottant CallSync pour Pipedrive
console.log('CallSync: Floating button script chargé');

// Vérifier si on est sur une page deal (supporte plusieurs formats d'URL Pipedrive)
function isDealPage() {
  const url = window.location.href;
  return url.includes('/deal/') || 
         url.includes('/deals/') || 
         url.match(/\/deal\d+/) ||
         url.includes('selectedItem=deal');
}

// État du bouton
let isIframeOpen = false;
let isDragging = false;
let currentX = 0;
let currentY = 0;
let initialX = 0;
let initialY = 0;
let xOffset = 0;
let yOffset = 0;

// Créer le bouton flottant
function createFloatingButton() {
  if (document.getElementById('callsync-floating-btn')) {
    console.log('CallSync: Bouton déjà créé');
    return;
  }

  console.log('CallSync: Création du bouton flottant');

  // Bouton principal
  const button = document.createElement('div');
  button.id = 'callsync-floating-btn';
  button.innerHTML = `
    <div id="callsync-floating-btn-icon">📞</div>
    <div id="callsync-floating-badge">✓</div>
  `;

  // Position initiale (bas droit)
  const savedPosition = localStorage.getItem('callsync-button-position');
  if (savedPosition) {
    const pos = JSON.parse(savedPosition);
    button.style.right = pos.right;
    button.style.bottom = pos.bottom;
  } else {
    button.style.right = '30px';
    button.style.bottom = '30px';
  }

  // Ajouter au DOM
  document.body.appendChild(button);

  // Events
  button.addEventListener('click', handleButtonClick);
  button.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Touch events pour mobile
  button.addEventListener('touchstart', dragStart);
  document.addEventListener('touchmove', drag);
  document.addEventListener('touchend', dragEnd);

  console.log('CallSync: Bouton créé avec succès');
}

// Gérer le clic sur le bouton
function handleButtonClick(e) {
  if (!isDragging) {
    if (isIframeOpen) {
      closeIframe();
    } else {
      openIframe(e.currentTarget);
    }
  }
}

// Ouvrir CallSync dans une fenêtre popup (contourne les restrictions microphone de l'iframe)
function openIframe(button) {
  console.log('CallSync: Ouverture du popup CallSync');
  
  const popupUrl = chrome.runtime.getURL('popup/popup.html');
  const width = 380;
  const height = 620;
  
  // Positionner le popup à droite de l'écran, aligné avec le bouton flottant
  const screenWidth = window.screen.availWidth;
  const screenHeight = window.screen.availHeight;
  const left = screenWidth - width - 20; // 20px du bord droit
  const top = Math.max(50, Math.min(window.screenY + 100, screenHeight - height - 50));
  
  // Fermer l'ancien popup s'il existe
  if (window.callsyncPopup && !window.callsyncPopup.closed) {
    window.callsyncPopup.focus();
    return;
  }
  
  const popup = window.open(
    popupUrl,
    'callsync-recorder',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no,popup=yes`
  );
  
  if (popup) {
    window.callsyncPopup = popup;
    popup.focus();
    isIframeOpen = true;
    
    // Surveiller la fermeture
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        isIframeOpen = false;
        window.callsyncPopup = null;
      }
    }, 500);
  } else {
    // Si le popup est bloqué, informer l'utilisateur
    alert('CallSync: Veuillez autoriser les popups pour ce site afin d\'utiliser l\'enregistreur.');
  }
}

// Fermer le popup (géré automatiquement par la fenêtre)
function closeIframe() {
  console.log('CallSync: Fermeture demandée');
  isIframeOpen = false;
}

// Drag & Drop
function dragStart(e) {
  const button = document.getElementById('callsync-floating-btn');
  
  if (e.type === 'touchstart') {
    initialX = e.touches[0].clientX - xOffset;
    initialY = e.touches[0].clientY - yOffset;
  } else {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
  }
  
  if (e.target === button || button.contains(e.target)) {
    isDragging = true;
    button.classList.add('dragging');
  }
}

function drag(e) {
  if (!isDragging) return;
  
  e.preventDefault();
  
  const button = document.getElementById('callsync-floating-btn');
  
  if (e.type === 'touchmove') {
    currentX = e.touches[0].clientX - initialX;
    currentY = e.touches[0].clientY - initialY;
  } else {
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
  }
  
  xOffset = currentX;
  yOffset = currentY;
  
  // Limites de l'écran
  const maxX = window.innerWidth - button.offsetWidth;
  const maxY = window.innerHeight - button.offsetHeight;
  
  const x = Math.max(0, Math.min(currentX, maxX));
  const y = Math.max(0, Math.min(currentY, maxY));
  
  button.style.left = `${x}px`;
  button.style.top = `${y}px`;
  button.style.right = 'auto';
  button.style.bottom = 'auto';
}

function dragEnd(e) {
  if (!isDragging) return;
  
  const button = document.getElementById('callsync-floating-btn');
  
  initialX = currentX;
  initialY = currentY;
  
  isDragging = false;
  button.classList.remove('dragging');
  
  // Sauvegarder la position
  const rect = button.getBoundingClientRect();
  const position = {
    right: `${window.innerWidth - rect.right}px`,
    bottom: `${window.innerHeight - rect.bottom}px`
  };
  localStorage.setItem('callsync-button-position', JSON.stringify(position));
}

// Afficher le badge quand un deal est détecté
function showDealBadge() {
  const badge = document.getElementById('callsync-floating-badge');
  if (badge) {
    badge.classList.add('active');
  }
}

// Écouter les messages du background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DEAL_DETECTED') {
    console.log('CallSync Floating: Deal détecté', message.deal);
    showDealBadge();
  }
});

// Initialiser
function init() {
  console.log('CallSync: Initialisation sur', window.location.href);
  
  // Créer le bouton après un court délai pour laisser Pipedrive charger
  const tryCreateButton = () => {
    if (isDealPage()) {
      const existingButton = document.getElementById('callsync-floating-btn');
      if (!existingButton) {
        console.log('CallSync: Création du bouton flottant');
        createFloatingButton();
      }
    }
  };
  
  // Essayer immédiatement puis après un délai
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      tryCreateButton();
      setTimeout(tryCreateButton, 1000);
    });
  } else {
    tryCreateButton();
    setTimeout(tryCreateButton, 1000);
    setTimeout(tryCreateButton, 2000);
  }
  
  // Observer les changements d'URL (navigation SPA)
  let lastUrl = window.location.href;
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('CallSync: Changement d\'URL détecté', currentUrl);
      
      const button = document.getElementById('callsync-floating-btn');
      if (isDealPage()) {
        if (!button) {
          createFloatingButton();
        }
      } else if (button) {
        button.remove();
      }
    }
  }, 500);
}

// Démarrer
init();
