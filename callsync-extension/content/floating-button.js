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
let popupWindow = null;
let isDragging = false;
let hasMoved = false;
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

  // Bouton principal avec icône SVG moderne
  const button = document.createElement('div');
  button.id = 'callsync-floating-btn';
  button.innerHTML = `
    <svg id="callsync-floating-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="19" cy="5" r="3" fill="#10b981" stroke="white" stroke-width="1.5"/>
    </svg>
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
  // Ne pas ouvrir si on a bougé le bouton
  if (hasMoved) {
    hasMoved = false;
    return;
  }
  
  togglePopup();
}

// Toggle le popup CallSync
function togglePopup() {
  // Vérifier si la fenêtre popup existe et est ouverte
  if (popupWindow && !popupWindow.closed) {
    // Fenêtre existe, la fermer
    popupWindow.close();
    popupWindow = null;
    console.log('CallSync: Popup fermé');
  } else {
    // Ouvrir une nouvelle fenêtre popup
    openPopup();
  }
}

// Ouvrir le popup CallSync dans une fenêtre indépendante
function openPopup() {
  console.log('CallSync: Ouverture du popup window');
  
  // Calculer la position (en haut à droite)
  const width = 380;
  const height = 550;
  const left = window.screenX + window.outerWidth - width - 20;
  const top = window.screenY + 80;
  
  // Obtenir l'URL du popup
  const popupUrl = chrome.runtime.getURL('popup/popup.html');
  
  // Ouvrir la fenêtre
  popupWindow = window.open(
    popupUrl,
    'CallSync',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no,location=no`
  );
  
  if (popupWindow) {
    popupWindow.focus();
    console.log('CallSync: Popup ouvert avec succès');
  } else {
    console.error('CallSync: Impossible d\'ouvrir le popup (bloqué par le navigateur?)');
  }
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
    hasMoved = false;
    button.classList.add('dragging');
  }
}

function drag(e) {
  if (!isDragging) return;
  
  e.preventDefault();
  hasMoved = true;
  
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
