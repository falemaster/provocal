import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration centralisée de l'extension
const EXTENSION_CONFIG = {
  // Version actuelle de l'extension
  version: "1.0.0",
  
  // URLs des services
  api: {
    baseUrl: "https://apxsxhaftjqqidysiktn.supabase.co/functions/v1",
    endpoints: {
      transcribe: "/transcribe-call",
      pipedriveSearch: "/pipedrive-search",
      pipedriveAddNote: "/pipedrive-add-note",
    }
  },
  
  // Messages personnalisables
  messages: {
    updateAvailable: "Une nouvelle version de CallSync est disponible !",
    updateButton: "Mettre à jour",
    microphoneError: "Erreur d'accès au microphone. Veuillez autoriser l'accès.",
    transcriptionError: "Erreur lors de la transcription. Veuillez réessayer.",
    searchError: "Erreur de recherche. Veuillez réessayer.",
    noDealsFound: "Aucun deal trouvé.",
    uploadSuccess: "Résumé envoyé à Pipedrive avec succès !",
    uploadError: "Erreur lors de l'envoi à Pipedrive.",
    noDealSelected: "Veuillez sélectionner un deal avant d'envoyer.",
    recordingStarted: "Enregistrement en cours...",
    recordingStopped: "Enregistrement terminé.",
  },
  
  // Paramètres de l'extension
  settings: {
    maxRecordingDuration: 7200, // 2 heures en secondes
    audioBitrate: 32000, // 32kbps
    autoSaveInterval: 30, // secondes
  },
  
  // Lien de mise à jour (peut être Chrome Web Store ou téléchargement direct)
  updateUrl: "https://github.com/votre-repo/callsync-extension/releases/latest",
  
  // Annonces/notifications optionnelles
  announcement: null, // { title: "...", message: "...", type: "info|warning|success" }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const clientVersion = url.searchParams.get('version');
    
    // Vérifier si une mise à jour est disponible
    let updateAvailable = false;
    if (clientVersion && clientVersion !== EXTENSION_CONFIG.version) {
      updateAvailable = compareVersions(EXTENSION_CONFIG.version, clientVersion) > 0;
    }
    
    const response = {
      ...EXTENSION_CONFIG,
      updateAvailable,
      clientVersion: clientVersion || 'unknown',
      serverTime: new Date().toISOString(),
    };

    console.log(`Extension config requested. Client version: ${clientVersion}, Update available: ${updateAvailable}`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in extension-config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Compare deux versions semver (retourne 1 si v1 > v2, -1 si v1 < v2, 0 si égales)
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}
