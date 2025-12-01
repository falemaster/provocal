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
  summary: null
};

// Éléments DOM
const elements = {
  dealInfo: document.getElementById('dealInfo'),
  dealName: document.getElementById('dealName'),
  dealHint: document.getElementById('dealHint'),
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
}

// Définir le deal actuel
function setCurrentDeal(deal) {
  console.log('Deal reçu:', deal);
  state.currentDeal = deal;
  elements.dealName.textContent = deal.name;
  elements.dealHint.style.display = 'none';
  elements.dealInfo.classList.add('active');
  elements.recordBtn.disabled = false;
}

// Formater la durée en MM:SS
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Démarrer l'enregistrement
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    state.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm'
    });

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

    state.mediaRecorder.start(1000); // Collecter les données toutes les secondes
    state.isRecording = true;
    state.isPaused = false;
    state.duration = 0;

    updateUI();
    startTimer();

  } catch (error) {
    console.error('Erreur lors du démarrage:', error);
    alert('Erreur: Impossible d\'accéder au microphone. Vérifiez les permissions.');
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

    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/functions/v1/transcribe-call`,
      {
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
      }
    );

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
    alert(`Erreur lors de la transcription: ${error.message}`);
  }
}

// Uploader vers Pipedrive
async function uploadToPipedrive() {
  if (!state.currentDeal) {
    alert('Aucun deal sélectionné');
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
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/functions/v1/pipedrive-add-note`,
      {
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
      }
    );

    if (!response.ok) {
      throw new Error(`Erreur ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    hideLoading();
    alert('✅ Résumé envoyé avec succès à Pipedrive !');
    
    // Retour à l'écran d'enregistrement
    resetForNewRecording();

  } catch (error) {
    hideLoading();
    console.error('Erreur upload:', error);
    alert(`Erreur lors de l'envoi: ${error.message}`);
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
