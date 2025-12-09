// Configuration de l'API CallSync
// Version locale - sera mise à jour dynamiquement depuis le serveur
const CONFIG = {
  // Version de l'extension (doit correspondre à manifest.json)
  VERSION: '2.5.0',
  
  // URLs de base (fallback si le serveur est inaccessible)
  SUPABASE_URL: 'https://apxsxhaftjqqidysiktn.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFweHN4aGFmdGpxcWlkeXNpa3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODEyMTQsImV4cCI6MjA4MDE1NzIxNH0.AiyD_H7_GzcAcoesqVB8z9vE71imfRlhw3oBCOX6tWM',
  
  // URL de l'endpoint de configuration
  CONFIG_ENDPOINT: 'https://apxsxhaftjqqidysiktn.supabase.co/functions/v1/extension-config',
  
  // Configuration dynamique (sera remplacée par les valeurs du serveur)
  dynamic: null,
  
  // État de la configuration
  loaded: false,
  updateAvailable: false,
  updateUrl: null,
  announcement: null,
};

// Charger la configuration depuis le serveur
async function loadRemoteConfig() {
  try {
    console.log('CallSync: Chargement de la configuration distante...');
    
    const response = await fetch(`${CONFIG.CONFIG_ENDPOINT}?version=${CONFIG.VERSION}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const remoteConfig = await response.json();
    console.log('CallSync: Configuration distante chargée:', remoteConfig);
    
    // Mettre à jour la configuration
    CONFIG.dynamic = remoteConfig;
    CONFIG.loaded = true;
    CONFIG.updateAvailable = remoteConfig.updateAvailable || false;
    CONFIG.updateUrl = remoteConfig.updateUrl || null;
    CONFIG.announcement = remoteConfig.announcement || null;
    
    // Notifier si mise à jour disponible
    if (CONFIG.updateAvailable) {
      console.log('CallSync: Mise à jour disponible!');
      notifyUpdate(remoteConfig);
    }
    
    // Afficher annonce si présente
    if (CONFIG.announcement) {
      showAnnouncement(CONFIG.announcement);
    }
    
    return remoteConfig;
  } catch (error) {
    console.warn('CallSync: Impossible de charger la config distante, utilisation des valeurs par défaut', error);
    CONFIG.loaded = true; // Marquer comme chargé même en cas d'erreur
    return null;
  }
}

// Notifier l'utilisateur d'une mise à jour disponible
function notifyUpdate(config) {
  // Créer une notification dans le DOM si on est dans le popup
  if (typeof document !== 'undefined') {
    const existingBanner = document.getElementById('callsync-update-banner');
    if (existingBanner) return;
    
    const banner = document.createElement('div');
    banner.id = 'callsync-update-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 10px 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    const message = config.messages?.updateAvailable || 'Une nouvelle version est disponible !';
    const buttonText = config.messages?.updateButton || 'Mettre à jour';
    
    banner.innerHTML = `
      <span>🚀 ${message}</span>
      <div style="display: flex; gap: 8px;">
        <a href="${config.updateUrl}" target="_blank" style="
          background: white;
          color: #d97706;
          padding: 5px 12px;
          border-radius: 4px;
          text-decoration: none;
          font-weight: 600;
          font-size: 12px;
        ">${buttonText}</a>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 16px;
          padding: 0 5px;
        ">✕</button>
      </div>
    `;
    
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Ajuster le padding du body
    document.body.style.paddingTop = '50px';
  }
}

// Afficher une annonce
function showAnnouncement(announcement) {
  if (typeof document === 'undefined' || !announcement) return;
  
  const existingAnnouncement = document.getElementById('callsync-announcement');
  if (existingAnnouncement) return;
  
  const colors = {
    info: { bg: '#3b82f6', text: 'white' },
    warning: { bg: '#f59e0b', text: 'white' },
    success: { bg: '#10b981', text: 'white' },
  };
  
  const style = colors[announcement.type] || colors.info;
  
  const banner = document.createElement('div');
  banner.id = 'callsync-announcement';
  banner.style.cssText = `
    background: ${style.bg};
    color: ${style.text};
    padding: 10px 15px;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;
  
  banner.innerHTML = `
    <div>
      <strong>${announcement.title}</strong>
      <span style="margin-left: 8px;">${announcement.message}</span>
    </div>
    <button onclick="this.parentElement.remove()" style="
      background: transparent;
      border: none;
      color: ${style.text};
      cursor: pointer;
      font-size: 16px;
    ">✕</button>
  `;
  
  const updateBanner = document.getElementById('callsync-update-banner');
  if (updateBanner) {
    updateBanner.after(banner);
  } else {
    document.body.insertBefore(banner, document.body.firstChild);
  }
}

// Obtenir un message depuis la config (avec fallback)
function getMessage(key, defaultMessage) {
  if (CONFIG.dynamic?.messages?.[key]) {
    return CONFIG.dynamic.messages[key];
  }
  return defaultMessage;
}

// Obtenir un paramètre depuis la config (avec fallback)
function getSetting(key, defaultValue) {
  if (CONFIG.dynamic?.settings?.[key] !== undefined) {
    return CONFIG.dynamic.settings[key];
  }
  return defaultValue;
}

// Obtenir l'URL d'un endpoint
function getEndpointUrl(endpoint) {
  if (CONFIG.dynamic?.api?.endpoints?.[endpoint]) {
    return CONFIG.dynamic.api.baseUrl + CONFIG.dynamic.api.endpoints[endpoint];
  }
  // Fallback aux URLs par défaut
  const endpoints = {
    transcribe: '/functions/v1/transcribe-call',
    pipedriveSearch: '/functions/v1/pipedrive-search',
    pipedriveAddNote: '/functions/v1/pipedrive-add-note',
  };
  return CONFIG.SUPABASE_URL + (endpoints[endpoint] || '');
}
