// CallSync Side Panel - Panneau latéral intégré à la page
console.log('CallSync: Side Panel module chargé');

// État de l'application
let state = {
  isRecording: false,
  isPaused: false,
  duration: 0,
  currentDeal: null,
  mediaRecorder: null,
  audioChunks: [],
  audioBlob: null,
  timerInterval: null,
  summary: null,
  searchTimeout: null
};

// Configuration (sera chargée depuis config.js)
let CONFIG = null;

// Éléments DOM du panneau
let elements = {};

// Initialiser le panneau
function initSidePanel(panelContainer, config) {
  CONFIG = config;
  console.log('CallSync: Initialisation du panneau latéral');
  
  // Créer le contenu du panneau
  panelContainer.innerHTML = createPanelHTML();
  
  // Récupérer les références DOM
  elements = {
    dealInfo: panelContainer.querySelector('#callsync-dealInfo'),
    dealName: panelContainer.querySelector('#callsync-dealName'),
    dealHint: panelContainer.querySelector('#callsync-dealHint'),
    dealSearchInput: panelContainer.querySelector('#callsync-dealSearchInput'),
    clearSearchBtn: panelContainer.querySelector('#callsync-clearSearchBtn'),
    searchResults: panelContainer.querySelector('#callsync-searchResults'),
    searchLoading: panelContainer.querySelector('#callsync-searchLoading'),
    status: panelContainer.querySelector('#callsync-status'),
    timer: panelContainer.querySelector('#callsync-timer'),
    recordBtn: panelContainer.querySelector('#callsync-recordBtn'),
    pauseBtn: panelContainer.querySelector('#callsync-pauseBtn'),
    stopBtn: panelContainer.querySelector('#callsync-stopBtn'),
    recordingSection: panelContainer.querySelector('#callsync-recordingSection'),
    summarySection: panelContainer.querySelector('#callsync-summarySection'),
    summaryText: panelContainer.querySelector('#callsync-summaryText'),
    uploadBtn: panelContainer.querySelector('#callsync-uploadBtn'),
    newRecordingBtn: panelContainer.querySelector('#callsync-newRecordingBtn'),
    loadingOverlay: panelContainer.querySelector('#callsync-loadingOverlay'),
    loadingText: panelContainer.querySelector('#callsync-loadingText')
  };
  
  // Récupérer le deal actuel depuis le background
  chrome.runtime.sendMessage({ type: 'GET_CURRENT_DEAL' }, (response) => {
    if (response && response.deal) {
      setCurrentDeal(response.deal);
    }
  });
  
  // Event listeners
  elements.recordBtn.addEventListener('click', startRecording);
  elements.pauseBtn.addEventListener('click', togglePause);
  elements.stopBtn.addEventListener('click', stopRecording);
  elements.uploadBtn.addEventListener('click', uploadToPipedrive);
  elements.newRecordingBtn.addEventListener('click', resetForNewRecording);
  elements.dealSearchInput.addEventListener('input', handleSearchInput);
  elements.clearSearchBtn.addEventListener('click', clearSearch);
  
  // Fermer les résultats si clic en dehors
  panelContainer.addEventListener('click', (e) => {
    if (!e.target.closest('.callsync-deal-search')) {
      elements.searchResults.style.display = 'none';
    }
  });
}

// Créer le HTML du panneau
function createPanelHTML() {
  return `
    <div class="callsync-panel-content">
      <!-- Header -->
      <div class="callsync-panel-header">
        <h1>📞 CallSync</h1>
      </div>

      <!-- Deal Info -->
      <div class="callsync-deal-info" id="callsync-dealInfo">
        <div class="callsync-deal-label">🎯 Deal Pipedrive</div>
        <div class="callsync-deal-name" id="callsync-dealName">Aucun deal détecté</div>
        <div class="callsync-deal-hint" id="callsync-dealHint">📍 Ouvrez une page deal ou recherchez ci-dessous</div>
      </div>

      <!-- Deal Search -->
      <div class="callsync-deal-search">
        <div class="callsync-search-label">Rechercher un deal</div>
        <div class="callsync-search-input-wrapper">
          <input 
            type="text" 
            id="callsync-dealSearchInput" 
            class="callsync-search-input" 
            placeholder="Nom du deal..."
          />
          <button id="callsync-clearSearchBtn" class="callsync-clear-btn" style="display: none;">✕</button>
        </div>
        <div id="callsync-searchResults" class="callsync-search-results" style="display: none;"></div>
        <div id="callsync-searchLoading" class="callsync-search-loading" style="display: none;">
          <div class="callsync-search-spinner"></div>
          <span>Recherche...</span>
        </div>
      </div>

      <!-- Recording Section -->
      <div class="callsync-recording-section" id="callsync-recordingSection">
        <div class="callsync-status" id="callsync-status">
          <span class="callsync-status-dot"></span>
          <span class="callsync-status-text">Prêt à enregistrer</span>
        </div>

        <div class="callsync-timer" id="callsync-timer">00:00</div>

        <div class="callsync-controls">
          <button class="callsync-btn callsync-btn-record" id="callsync-recordBtn">
            <span class="callsync-btn-icon">🎙️</span>
            <span class="callsync-btn-text">Démarrer</span>
          </button>
          <button class="callsync-btn callsync-btn-pause" id="callsync-pauseBtn" style="display: none;">
            <span class="callsync-btn-icon">⏸️</span>
            <span class="callsync-btn-text">Pause</span>
          </button>
          <button class="callsync-btn callsync-btn-stop" id="callsync-stopBtn" style="display: none;">
            <span class="callsync-btn-icon">⏹️</span>
            <span class="callsync-btn-text">Arrêter</span>
          </button>
        </div>
      </div>

      <!-- Summary Section -->
      <div class="callsync-summary-section" id="callsync-summarySection" style="display: none;">
        <div class="callsync-summary-label">Résumé généré</div>
        <textarea 
          class="callsync-summary-textarea" 
          id="callsync-summaryText" 
          rows="10"
          placeholder="Le résumé apparaîtra ici..."
        ></textarea>
        
        <button class="callsync-btn callsync-btn-upload" id="callsync-uploadBtn">
          <span class="callsync-btn-icon">📤</span>
          <span class="callsync-btn-text">Envoyer à Pipedrive</span>
        </button>

        <button class="callsync-btn callsync-btn-new" id="callsync-newRecordingBtn">
          <span class="callsync-btn-icon">🔄</span>
          <span class="callsync-btn-text">Nouvel enregistrement</span>
        </button>
      </div>

      <!-- Loading overlay -->
      <div class="callsync-loading-overlay" id="callsync-loadingOverlay" style="display: none;">
        <div class="callsync-loading-spinner"></div>
        <div class="callsync-loading-text" id="callsync-loadingText">Transcription en cours...</div>
      </div>
    </div>
  `;
}

// Définir le deal actuel
function setCurrentDeal(deal) {
  console.log('CallSync Panel: Deal défini', deal);
  state.currentDeal = deal;
  elements.dealName.textContent = deal.name;
  elements.dealName.title = deal.name;
  elements.dealHint.style.display = 'none';
  elements.dealInfo.classList.add('active');
  
  elements.dealSearchInput.value = '';
  elements.clearSearchBtn.style.display = 'none';
  elements.searchResults.style.display = 'none';
}

// Obtenir l'URL d'un endpoint
function getEndpointUrl(endpoint) {
  const endpoints = {
    transcribe: `${CONFIG.SUPABASE_URL}/functions/v1/transcribe-call`,
    pipedriveSearch: `${CONFIG.SUPABASE_URL}/functions/v1/pipedrive-search`,
    pipedriveAddNote: `${CONFIG.SUPABASE_URL}/functions/v1/pipedrive-add-note`
  };
  return endpoints[endpoint];
}

// Rechercher des deals
async function searchDeals(query) {
  if (!query || query.length < 2) {
    elements.searchResults.style.display = 'none';
    return;
  }

  elements.searchLoading.style.display = 'flex';
  elements.searchResults.style.display = 'none';

  try {
    const searchUrl = getEndpointUrl('pipedriveSearch');
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) throw new Error('Erreur de recherche');

    const data = await response.json();
    displaySearchResults(data.deals || []);

  } catch (error) {
    console.error('Erreur recherche:', error);
    elements.searchResults.innerHTML = `<div class="callsync-search-error">Erreur de recherche</div>`;
    elements.searchResults.style.display = 'block';
  } finally {
    elements.searchLoading.style.display = 'none';
  }
}

// Afficher les résultats de recherche
function displaySearchResults(deals) {
  if (deals.length === 0) {
    elements.searchResults.innerHTML = '<div class="callsync-search-empty">Aucun deal trouvé</div>';
    elements.searchResults.style.display = 'block';
    return;
  }

  elements.searchResults.innerHTML = deals
    .map(deal => `
      <div class="callsync-search-result-item" data-deal-id="${deal.id}" data-deal-name="${deal.title}">
        <div class="callsync-result-title">${deal.title}</div>
        ${deal.person_name ? `<div class="callsync-result-person">${deal.person_name}</div>` : ''}
        ${deal.org_name ? `<div class="callsync-result-org">${deal.org_name}</div>` : ''}
      </div>
    `)
    .join('');

  elements.searchResults.style.display = 'block';

  elements.searchResults.querySelectorAll('.callsync-search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const dealId = parseInt(item.dataset.dealId);
      const dealName = item.dataset.dealName;
      setCurrentDeal({ id: dealId, name: dealName });
      clearSearch();
    });
  });
}

// Gérer l'input de recherche avec debounce
function handleSearchInput(e) {
  const query = e.target.value.trim();
  elements.clearSearchBtn.style.display = query ? 'flex' : 'none';

  if (state.searchTimeout) clearTimeout(state.searchTimeout);
  state.searchTimeout = setTimeout(() => searchDeals(query), 300);
}

// Effacer la recherche
function clearSearch() {
  elements.dealSearchInput.value = '';
  elements.clearSearchBtn.style.display = 'none';
  elements.searchResults.style.display = 'none';
  elements.searchLoading.style.display = 'none';
}

// Formater la durée
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Démarrer l'enregistrement
async function startRecording() {
  console.log('CallSync Panel: Démarrage enregistrement');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('CallSync Panel: Accès microphone OK');
    
    state.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    state.audioChunks = [];

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        state.audioChunks.push(event.data);
      }
    };

    state.mediaRecorder.onstop = async () => {
      state.audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());
      await transcribeAudio();
    };

    state.mediaRecorder.start(1000);
    state.isRecording = true;
    state.isPaused = false;
    state.duration = 0;

    updateUI();
    startTimer();

  } catch (error) {
    console.error('CallSync Panel: Erreur microphone:', error);
    let errorMessage = 'Erreur: Impossible d\'accéder au microphone.';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Permission refusée: Autorisez l\'accès au microphone.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'Aucun microphone détecté.';
    }
    
    alert(errorMessage);
  }
}

// Toggle pause/resume
function togglePause() {
  if (state.isPaused) {
    state.mediaRecorder.resume();
    state.isPaused = false;
    startTimer();
  } else {
    state.mediaRecorder.pause();
    state.isPaused = true;
    stopTimer();
  }
  updateUI();
}

// Arrêter l'enregistrement
function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
    state.isRecording = false;
    state.isPaused = false;
    stopTimer();
    updateUI();
  }
}

// Timer
function startTimer() {
  state.timerInterval = setInterval(() => {
    state.duration++;
    elements.timer.textContent = formatDuration(state.duration);
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// Mettre à jour l'UI
function updateUI() {
  elements.status.className = 'callsync-status';
  if (state.isRecording) {
    elements.status.classList.add('recording');
    elements.status.querySelector('.callsync-status-text').textContent = state.isPaused 
      ? 'En pause' 
      : 'Enregistrement en cours...';
  } else {
    elements.status.querySelector('.callsync-status-text').textContent = 'Prêt à enregistrer';
  }

  elements.recordBtn.style.display = state.isRecording ? 'none' : 'flex';
  elements.pauseBtn.style.display = state.isRecording ? 'flex' : 'none';
  elements.stopBtn.style.display = state.isRecording ? 'flex' : 'none';

  if (state.isPaused) {
    elements.pauseBtn.querySelector('.callsync-btn-text').textContent = 'Reprendre';
    elements.pauseBtn.querySelector('.callsync-btn-icon').textContent = '▶️';
  } else {
    elements.pauseBtn.querySelector('.callsync-btn-text').textContent = 'Pause';
    elements.pauseBtn.querySelector('.callsync-btn-icon').textContent = '⏸️';
  }
}

// Afficher/masquer le loading
function showLoading(message) {
  elements.loadingText.textContent = message;
  elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  elements.loadingOverlay.style.display = 'none';
}

// Transcrire l'audio
async function transcribeAudio() {
  showLoading('Envoi de l\'audio...');

  try {
    const callId = `ext-${Date.now()}`;
    const audioPath = `${callId}.webm`;
    
    // Upload vers Supabase Storage
    const uploadUrl = `${CONFIG.SUPABASE_URL}/storage/v1/object/call-recordings/${audioPath}`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: state.audioBlob
    });

    if (!uploadResponse.ok) {
      throw new Error(`Échec de l'upload audio: ${uploadResponse.status}`);
    }

    showLoading('Transcription et génération du résumé...');

    // Appeler la fonction de transcription
    const transcribeUrl = getEndpointUrl('transcribe');
    const response = await fetch(transcribeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ audioPath, callId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    state.summary = data.summary || data.transcription;
    
    elements.summaryText.value = state.summary;
    elements.recordingSection.style.display = 'none';
    elements.summarySection.style.display = 'block';

    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('Erreur transcription:', error);
    alert(`Erreur lors de la transcription: ${error.message}`);
  }
}

// Uploader vers Pipedrive
async function uploadToPipedrive() {
  if (!state.currentDeal) {
    alert('Veuillez sélectionner un deal avant d\'envoyer');
    return;
  }

  const summary = elements.summaryText.value.trim();
  if (!summary) {
    alert('Le résumé est vide');
    return;
  }

  showLoading('Envoi à Pipedrive...');
  elements.uploadBtn.disabled = true;

  try {
    const addNoteUrl = getEndpointUrl('pipedriveAddNote');
    const response = await fetch(addNoteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        dealId: state.currentDeal.id,
        content: `📞 Résumé d'appel CallSync\n\n${summary}`
      })
    });

    if (!response.ok) throw new Error(`Erreur ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    hideLoading();
    alert('✅ Résumé envoyé avec succès à Pipedrive !');
    resetForNewRecording();

  } catch (error) {
    hideLoading();
    console.error('Erreur upload:', error);
    alert(`Erreur lors de l'envoi à Pipedrive: ${error.message}`);
    elements.uploadBtn.disabled = false;
  }
}

// Réinitialiser
function resetForNewRecording() {
  state.audioBlob = null;
  state.audioChunks = [];
  state.summary = null;
  state.duration = 0;
  
  elements.timer.textContent = '00:00';
  elements.summaryText.value = '';
  elements.summarySection.style.display = 'none';
  elements.recordingSection.style.display = 'block';
  elements.uploadBtn.disabled = false;
  
  updateUI();
}

// Exporter la fonction d'initialisation
window.CallSyncSidePanel = { init: initSidePanel };
