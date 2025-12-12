import { useState, useCallback } from 'react';

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

export const useChecklistAnalysis = () => {
  const [items, setItems] = useState<ChecklistItem[]>(getInitialItems);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
  }, []);

  const analyzeTranscript = useCallback(async (transcript: string) => {
    if (!transcript || transcript.length < 50) return;
    
    setIsAnalyzing(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ transcript }),
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de l\'analyse');
      }

      const result = await response.json();
      
      if (result.detectedItems && Array.isArray(result.detectedItems)) {
        setItems(prevItems =>
          prevItems.map(item => {
            if (item.isManuallySet) return item;
            const isDetected = result.detectedItems.includes(item.id);
            return {
              ...item,
              isChecked: isDetected || item.isChecked,
            };
          })
        );
      }
    } catch (error) {
      console.error('Checklist analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const checkedCount = items.filter(item => item.isChecked).length;
  const totalCount = items.length;

  return {
    items,
    isAnalyzing,
    checkedCount,
    totalCount,
    toggleItem,
    resetChecklist,
    analyzeTranscript,
  };
};
