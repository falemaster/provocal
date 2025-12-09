// Bouton flottant CallSync pour Pipedrive
console.log('CallSync: Floating button script chargé');

// Vérifier si on est sur une page deal
function isDealPage() {
  const url = window.location.href;
  return url.includes('/deal/') || 
         url.includes('/deals/') || 
         url.match(/\/deal\d+/) ||
         url.includes('selectedItem=deal');
}

// État
let isPanelOpen = false;
let isDragging = false;
let hasMoved = false;
let currentX = 0;
let currentY = 0;
let initialX = 0;
let initialY = 0;
let xOffset = 0;
let yOffset = 0;

// Configuration
let CONFIG = null;

// Charger la configuration
async function loadConfig() {
  try {
    // Essayer de charger config.js
    const configUrl = chrome.runtime.getURL('config.js');
    const response = await fetch(configUrl);
    const configText = await response.text();
    
    // Extraire les valeurs de CONFIG
    const supabaseUrlMatch = configText.match(/SUPABASE_URL:\s*['"]([^'"]+)['"]/);
    const supabaseKeyMatch = configText.match(/SUPABASE_ANON_KEY:\s*['"]([^'"]+)['"]/);
    
    if (supabaseUrlMatch && supabaseKeyMatch) {
      CONFIG = {
        SUPABASE_URL: supabaseUrlMatch[1],
        SUPABASE_ANON_KEY: supabaseKeyMatch[1]
      };
      console.log('CallSync: Config chargée');
    }
  } catch (error) {
    console.error('CallSync: Erreur chargement config:', error);
    // Fallback
    CONFIG = {
      SUPABASE_URL: 'https://apxsxhaftjqqidysiktn.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFweHN4aGFmdGpxcWlkeXNpa3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODEyMTQsImV4cCI6MjA4MDE1NzIxNH0.AiyD_H7_GzcAcoesqVB8z9vE71imfRlhw3oBCOX6tWM'
    };
  }
}

// Créer le bouton flottant
function createFloatingButton() {
  if (document.getElementById('callsync-floating-btn')) {
    return;
  }

  console.log('CallSync: Création du bouton flottant');

  const button = document.createElement('div');
  button.id = 'callsync-floating-btn';
  button.innerHTML = `
    <svg id="callsync-floating-btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="19" cy="5" r="3" fill="#10b981" stroke="white" stroke-width="1.5"/>
    </svg>
    <div id="callsync-floating-badge">✓</div>
  `;

  // Position initiale
  const savedPosition = localStorage.getItem('callsync-button-position');
  if (savedPosition) {
    const pos = JSON.parse(savedPosition);
    button.style.right = pos.right;
    button.style.bottom = pos.bottom;
  } else {
    button.style.right = '30px';
    button.style.bottom = '30px';
  }

  document.body.appendChild(button);

  // Events
  button.addEventListener('click', handleButtonClick);
  button.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Touch
  button.addEventListener('touchstart', dragStart);
  document.addEventListener('touchmove', drag);
  document.addEventListener('touchend', dragEnd);

  console.log('CallSync: Bouton créé avec succès');
}

// Créer le panneau latéral
function createSidePanel() {
  if (document.getElementById('callsync-side-panel')) {
    return document.getElementById('callsync-side-panel');
  }

  console.log('CallSync: Création du panneau latéral');

  const panel = document.createElement('div');
  panel.id = 'callsync-side-panel';
  
  // Header du panneau avec bouton fermer
  const header = document.createElement('div');
  header.id = 'callsync-panel-header';
  header.innerHTML = `
    <button id="callsync-panel-close" title="Fermer">✕</button>
  `;
  panel.appendChild(header);

  // Contenu du panneau
  const content = document.createElement('div');
  content.id = 'callsync-panel-body';
  panel.appendChild(content);

  document.body.appendChild(panel);

  // Bouton fermer
  document.getElementById('callsync-panel-close').addEventListener('click', closePanel);

  return panel;
}

// Ouvrir le panneau
async function openPanel() {
  console.log('CallSync: Ouverture du panneau');
  
  // Charger la config si pas déjà fait
  if (!CONFIG) {
    await loadConfig();
  }
  
  const panel = createSidePanel();
  const body = document.getElementById('callsync-panel-body');
  
  // Charger le side-panel.js si pas déjà fait
  if (!window.CallSyncSidePanel) {
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/side-panel.js');
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }
  
  // Initialiser le panneau
  if (window.CallSyncSidePanel) {
    window.CallSyncSidePanel.init(body, CONFIG);
  }
  
  // Afficher avec animation
  requestAnimationFrame(() => {
    panel.classList.add('open');
    isPanelOpen = true;
    
    // Mettre à jour le bouton
    const btn = document.getElementById('callsync-floating-btn');
    if (btn) btn.classList.add('active');
  });
}

// Fermer le panneau
function closePanel() {
  console.log('CallSync: Fermeture du panneau');
  
  const panel = document.getElementById('callsync-side-panel');
  if (panel) {
    panel.classList.remove('open');
    isPanelOpen = false;
    
    // Mettre à jour le bouton
    const btn = document.getElementById('callsync-floating-btn');
    if (btn) btn.classList.remove('active');
  }
}

// Toggle le panneau
function togglePanel() {
  if (isPanelOpen) {
    closePanel();
  } else {
    openPanel();
  }
}

// Gérer le clic sur le bouton
function handleButtonClick(e) {
  if (hasMoved) {
    hasMoved = false;
    return;
  }
  togglePanel();
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
  
  // Sauvegarder
  const rect = button.getBoundingClientRect();
  const position = {
    right: `${window.innerWidth - rect.right}px`,
    bottom: `${window.innerHeight - rect.bottom}px`
  };
  localStorage.setItem('callsync-button-position', JSON.stringify(position));
}

// Badge deal détecté
function showDealBadge() {
  const badge = document.getElementById('callsync-floating-badge');
  if (badge) badge.classList.add('active');
}

// Écouter les messages
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DEAL_DETECTED') {
    console.log('CallSync: Deal détecté', message.deal);
    showDealBadge();
  }
});

// Initialiser
function init() {
  console.log('CallSync: Initialisation sur', window.location.href);
  
  const tryCreateButton = () => {
    if (isDealPage()) {
      const existingButton = document.getElementById('callsync-floating-btn');
      if (!existingButton) {
        createFloatingButton();
      }
    }
  };
  
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
  
  // Observer les changements d'URL (SPA)
  let lastUrl = window.location.href;
  setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      
      const button = document.getElementById('callsync-floating-btn');
      if (isDealPage()) {
        if (!button) createFloatingButton();
      } else if (button) {
        button.remove();
        // Fermer le panneau aussi
        const panel = document.getElementById('callsync-side-panel');
        if (panel) panel.remove();
        isPanelOpen = false;
      }
    }
  }, 500);
}

// Démarrer
init();
