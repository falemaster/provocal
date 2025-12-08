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

// Éléments DOM
const elements = {
  dealInfo: document.getElementById('dealInfo'),
  dealName: document.getElementById('dealName'),
  dealHint: document.getElementById('dealHint'),
  dealSearchInput: document.getElementById('dealSearchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  searchResults: document.getElementById('searchResults'),
  searchLoading: document.getElementById('searchLoading'),
  status: document.getElementById('status'),
  timer: document.getElementById('timer'),
  recordBtn: document.getElementById('recordBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopBtn: document.getElementById('stopBtn'),
  recordingSection: document.getElementById('recordingSection'),
  summarySection: document.getElementById('summarySection'),
  summaryText: document.getElementById('summaryText'),
  uploadBtn: document.getElementById('uploadBtn'),
  newRecordingBtn: document.getElementById('newRecordingBtn'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingText: document.getElementById('loadingText')
};

// Initialisation
async function init() {
  console.log('CallSync: Initialisation du popup');
  
  // Charger la configuration distante
  await loadRemoteConfig();
  
  // Récupérer le deal actuel depuis le service worker
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_DEAL' });
    if (response && response.deal) {
      setCurrentDeal(response.deal);
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du deal:', error);
  }

  // Event listeners
  elements.recordBtn.addEventListener('click', startRecording);
  elements.pauseBtn.addEventListener('click', togglePause);
  elements.stopBtn.addEventListener('click', stopRecording);
  elements.uploadBtn.addEventListener('click', uploadToPipedrive);
  elements.newRecordingBtn.addEventListener('click', resetForNewRecording);
  elements.dealSearchInput.addEventListener('input', handleSearchInput);
  elements.clearSearchBtn.addEventListener('click', clearSearch);
  
  // Cacher les résultats si on clique en dehors
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.deal-search')) {
      elements.searchResults.style.display = 'none';
    }
  });
}

// Définir le deal actuel
function setCurrentDeal(deal) {
  console.log('CallSync Popup: Deal défini', deal);
  state.currentDeal = deal;
  elements.dealName.textContent = deal.name;
  elements.dealName.title = deal.name; // Ajouter tooltip pour les longs noms
  elements.dealHint.style.display = 'none';
  elements.dealInfo.classList.add('active');
  
  // Cacher le champ de recherche si un deal est détecté
  elements.dealSearchInput.value = '';
  elements.clearSearchBtn.style.display = 'none';
  elements.searchResults.style.display = 'none';
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

    if (!response.ok) {
      throw new Error('Erreur de recherche');
    }

    const data = await response.json();
    displaySearchResults(data.deals || []);

  } catch (error) {
    console.error('Erreur recherche:', error);
    const errorMsg = getMessage('searchError', 'Erreur de recherche');
    elements.searchResults.innerHTML = `<div class="search-error">${errorMsg}</div>`;
    elements.searchResults.style.display = 'block';
  } finally {
    elements.searchLoading.style.display = 'none';
  }
}

// Afficher les résultats de recherche
function displaySearchResults(deals) {
  if (deals.length === 0) {
    elements.searchResults.innerHTML = '<div class="search-empty">Aucun deal trouvé</div>';
    elements.searchResults.style.display = 'block';
    return;
  }

  elements.searchResults.innerHTML = deals
    .map(deal => `
      <div class="search-result-item" data-deal-id="${deal.id}" data-deal-name="${deal.title}">
        <div class="result-title">${deal.title}</div>
        ${deal.person_name ? `<div class="result-person">${deal.person_name}</div>` : ''}
        ${deal.org_name ? `<div class="result-org">${deal.org_name}</div>` : ''}
      </div>
    `)
    .join('');

  elements.searchResults.style.display = 'block';

  // Gérer les clics sur les résultats
  elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
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
  
  // Afficher/masquer le bouton clear
  elements.clearSearchBtn.style.display = query ? 'flex' : 'none';

  // Debounce de 300ms
  if (state.searchTimeout) {
    clearTimeout(state.searchTimeout);
  }

  state.searchTimeout = setTimeout(() => {
    searchDeals(query);
  }, 300);
}

// Effacer la recherche
function clearSearch() {
  elements.dealSearchInput.value = '';
  elements.clearSearchBtn.style.display = 'none';
  elements.searchResults.style.display = 'none';
  elements.searchLoading.style.display = 'none';
}

// Formater la durée en MM:SS
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Démarrer l'enregistrement
async function startRecording() {
  console.log('CallSync: Tentative de démarrage de l\'enregistrement');
  console.log('CallSync: Deal actuel:', state.currentDeal);
  
  try {
    console.log('CallSync: Demande d\'accès au microphone...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('CallSync: Accès au microphone accordé');
    
    state.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm'
    });
    console.log('CallSync: MediaRecorder créé');

    state.audioChunks = [];

    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        state.audioChunks.push(event.data);
        console.log('CallSync: Chunk audio reçu, taille:', event.data.size);
      }
    };

    state.mediaRecorder.onstop = async () => {
      console.log('CallSync: Enregistrement arrêté, traitement...');
      state.audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
      console.log('CallSync: Audio Blob créé, taille:', state.audioBlob.size);
      stream.getTracks().forEach(track => track.stop());
      await transcribeAudio();
    };

    state.mediaRecorder.start(1000); // Collecter les données toutes les secondes
    state.isRecording = true;
    state.isPaused = false;
    state.duration = 0;
    
    console.log('CallSync: Enregistrement démarré avec succès');

    updateUI();
    startTimer();

  } catch (error) {
    console.error('CallSync: ERREUR lors du démarrage:', error);
    console.error('CallSync: Type d\'erreur:', error.name);
    console.error('CallSync: Message:', error.message);
    
    let errorMessage = 'Erreur: Impossible d\'accéder au microphone.';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Permission refusée: Autorisez l\'accès au microphone dans les paramètres de Chrome.';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'Aucun microphone détecté sur cet appareil.';
    } else if (error.name === 'NotReadableError') {
      errorMessage = 'Microphone déjà utilisé par une autre application.';
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
  // Status
  elements.status.className = 'status';
  if (state.isRecording) {
    elements.status.classList.add('recording');
    elements.status.querySelector('.status-text').textContent = state.isPaused 
      ? 'En pause' 
      : 'Enregistrement en cours...';
  } else {
    elements.status.querySelector('.status-text').textContent = 'Prêt à enregistrer';
  }

  // Boutons
  elements.recordBtn.style.display = state.isRecording ? 'none' : 'flex';
  elements.pauseBtn.style.display = state.isRecording ? 'flex' : 'none';
  elements.stopBtn.style.display = state.isRecording ? 'flex' : 'none';

  if (state.isPaused) {
    elements.pauseBtn.querySelector('.btn-text').textContent = 'Reprendre';
    elements.pauseBtn.querySelector('.btn-icon').textContent = '▶️';
  } else {
    elements.pauseBtn.querySelector('.btn-text').textContent = 'Pause';
    elements.pauseBtn.querySelector('.btn-icon').textContent = '⏸️';
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

// Convertir blob en base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Transcrire l'audio
async function transcribeAudio() {
  showLoading('Transcription et génération du résumé...');

  try {
    const audioBase64 = await blobToBase64(state.audioBlob);

    const transcribeUrl = getEndpointUrl('transcribe');
    const response = await fetch(transcribeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        audioBase64,
        callId: `ext-${Date.now()}`
      })
    });

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    state.summary = data.summary || data.transcription;
    
    // Afficher le résumé
    elements.summaryText.value = state.summary;
    elements.recordingSection.style.display = 'none';
    elements.summarySection.style.display = 'block';

    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('Erreur de transcription:', error);
    const errorMsg = getMessage('transcriptionError', 'Erreur lors de la transcription');
    alert(`${errorMsg}: ${error.message}`);
  }
}

// Uploader vers Pipedrive
async function uploadToPipedrive() {
  if (!state.currentDeal) {
    const msg = getMessage('noDealSelected', 'Veuillez sélectionner un deal avant d\'envoyer');
    alert(msg);
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

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    hideLoading();
    const successMsg = getMessage('uploadSuccess', 'Résumé envoyé avec succès à Pipedrive !');
    alert(`✅ ${successMsg}`);
    
    // Retour à l'écran d'enregistrement
    resetForNewRecording();

  } catch (error) {
    hideLoading();
    console.error('Erreur upload:', error);
    const errorMsg = getMessage('uploadError', 'Erreur lors de l\'envoi à Pipedrive');
    alert(`${errorMsg}: ${error.message}`);
    elements.uploadBtn.disabled = false;
  }
}

// Réinitialiser pour un nouvel enregistrement
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

// Démarrer l'application
init();
