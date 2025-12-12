import { useState, useRef, useCallback, useEffect } from 'react';

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

export interface ChecklistAnalysisState {
  items: ChecklistItem[];
  isAnalyzing: boolean;
  lastAnalyzedAt: Date | null;
  error: string | null;
}

export const useChecklistAnalysis = (transcript: string, isRecording: boolean) => {
  const [state, setState] = useState<ChecklistAnalysisState>({
    items: CHECKLIST_ITEMS.map(item => ({
      ...item,
      isChecked: false,
      isManuallySet: false,
    })),
    isAnalyzing: false,
    lastAnalyzedAt: null,
    error: null,
  });

  const analysisIntervalRef = useRef<number | null>(null);
  const lastTranscriptRef = useRef<string>('');

  const analyzeChecklist = useCallback(async (text: string) => {
    if (!text || text.length < 50) return; // Skip if transcript too short
    if (text === lastTranscriptRef.current) return; // Skip if no new text
    
    lastTranscriptRef.current = text;
    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ transcript: text }),
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de l\'analyse');
      }

      const result = await response.json();
      
      if (result.detectedItems && Array.isArray(result.detectedItems)) {
        setState(prev => ({
          ...prev,
          items: prev.items.map(item => {
            // Don't override manually set items
            if (item.isManuallySet) return item;
            
            const isDetected = result.detectedItems.includes(item.id);
            return {
              ...item,
              isChecked: isDetected || item.isChecked, // Keep checked once detected
            };
          }),
          isAnalyzing: false,
          lastAnalyzedAt: new Date(),
        }));
      }
    } catch (error) {
      console.error('Checklist analysis error:', error);
      setState(prev => ({ 
        ...prev, 
        isAnalyzing: false,
        error: error instanceof Error ? error.message : 'Erreur d\'analyse',
      }));
    }
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            isChecked: !item.isChecked,
            isManuallySet: true,
          };
        }
        return item;
      }),
    }));
  }, []);

  const resetChecklist = useCallback(() => {
    lastTranscriptRef.current = '';
    setState({
      items: CHECKLIST_ITEMS.map(item => ({
        ...item,
        isChecked: false,
        isManuallySet: false,
      })),
      isAnalyzing: false,
      lastAnalyzedAt: null,
      error: null,
    });
  }, []);

  // Start/stop periodic analysis based on recording state
  useEffect(() => {
    if (isRecording && transcript) {
      // Initial analysis after a delay
      const initialTimeout = setTimeout(() => {
        analyzeChecklist(transcript);
      }, 10000); // Wait 10 seconds before first analysis

      // Periodic analysis every 20 seconds
      analysisIntervalRef.current = window.setInterval(() => {
        analyzeChecklist(transcript);
      }, 20000);

      return () => {
        clearTimeout(initialTimeout);
        if (analysisIntervalRef.current) {
          clearInterval(analysisIntervalRef.current);
          analysisIntervalRef.current = null;
        }
      };
    } else {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }
    }
  }, [isRecording, transcript, analyzeChecklist]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
    };
  }, []);

  const checkedCount = state.items.filter(item => item.isChecked).length;
  const totalCount = state.items.length;

  return {
    ...state,
    checkedCount,
    totalCount,
    toggleItem,
    resetChecklist,
    analyzeNow: () => analyzeChecklist(transcript),
  };
};
