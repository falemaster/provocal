import { useState, useCallback, useRef, useEffect } from 'react';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  isChecked: boolean;
  isManuallySet: boolean;
}

export const CHECKLIST_ITEMS: Omit<ChecklistItem, 'isChecked' | 'isManuallySet'>[] = [
  {
    id: 'historique',
    label: 'Historique société',
    description: 'Activité, contexte, création',
  },
  {
    id: 'passif_actif',
    label: 'Passif et Actif',
    description: 'Situation financière actuelle',
  },
  {
    id: 'avis_comptable',
    label: 'Avis du comptable',
    description: 'Opinion sur la situation',
  },
  {
    id: 'declarations',
    label: 'Déclarations',
    description: 'Fiscales, sociales, TVA',
  },
  {
    id: 'dette_urssaf',
    label: 'Dette URSSAF',
    description: 'Configuration TNS, cotisations',
  },
  {
    id: 'intention_continuer',
    label: 'Intention de continuer',
    description: 'Poursuite ou arrêt activité',
  },
];

const getInitialItems = (): ChecklistItem[] => 
  CHECKLIST_ITEMS.map(item => ({
    ...item,
    isChecked: false,
    isManuallySet: false,
  }));

interface UseChecklistAnalysisOptions {
  isRecording: boolean;
  getAudioSnapshot: () => Blob | null;
  analysisInterval?: number; // in milliseconds, default 60000 (1 min)
}

export const useChecklistAnalysis = (options?: UseChecklistAnalysisOptions) => {
  const [items, setItems] = useState<ChecklistItem[]>(getInitialItems);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(false);

  const toggleItem = useCallback((itemId: string) => {
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, isChecked: !item.isChecked, isManuallySet: true }
          : item
      )
    );
  }, []);

  const resetChecklist = useCallback(() => {
    setItems(getInitialItems());
    setIsAnalyzing(false);
    setLastAnalysisTime(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const analyzeAudio = useCallback(async (audioBlob: Blob) => {
    if (isAnalyzingRef.current) {
      console.log('Analysis already in progress, skipping');
      return;
    }

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const audioBase64 = btoa(binary);

      console.log('Sending audio for checklist analysis, size:', audioBase64.length);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-checklist-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ audioBase64 }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur d\'analyse');
      }

      const result = await response.json();
      
      if (result.detectedItems && Array.isArray(result.detectedItems)) {
        console.log('Detected items:', result.detectedItems);
        
        setItems(prevItems =>
          prevItems.map(item => {
            // Don't override manually set items
            if (item.isManuallySet) return item;
            const isDetected = result.detectedItems.includes(item.id);
            return {
              ...item,
              isChecked: isDetected || item.isChecked,
            };
          })
        );
        
        setLastAnalysisTime(Date.now());
      }
    } catch (error) {
      console.error('Checklist audio analysis error:', error);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  // Start/stop periodic analysis based on recording state
  useEffect(() => {
    if (!options) return;

    const { isRecording, getAudioSnapshot, analysisInterval = 60000 } = options;

    if (isRecording) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Start periodic analysis
      intervalRef.current = window.setInterval(() => {
        const snapshot = getAudioSnapshot();
        if (snapshot && snapshot.size > 0) {
          console.log('Running periodic audio analysis, blob size:', snapshot.size);
          analyzeAudio(snapshot);
        }
      }, analysisInterval);

      console.log('Started periodic checklist analysis every', analysisInterval / 1000, 'seconds');
    } else {
      // Stop periodic analysis when not recording
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('Stopped periodic checklist analysis');
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [options?.isRecording, options?.getAudioSnapshot, options?.analysisInterval, analyzeAudio]);

  const checkedCount = items.filter(item => item.isChecked).length;
  const totalCount = items.length;
  const uncheckedItems = items.filter(item => !item.isChecked);

  return {
    items,
    isAnalyzing,
    checkedCount,
    totalCount,
    uncheckedItems,
    lastAnalysisTime,
    toggleItem,
    resetChecklist,
    analyzeAudio,
  };
};
