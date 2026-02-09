import { useState, useCallback, useRef, useEffect } from 'react';

export type CallType = 'client' | 'expert_comptable';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  isChecked: boolean;
  isManuallySet: boolean;
}

type ChecklistDef = Omit<ChecklistItem, 'isChecked' | 'isManuallySet'>[];

export const CLIENT_CHECKLIST_ITEMS: ChecklistDef = [
  { id: 'historique', label: 'Historique société', description: 'Activité, contexte, création' },
  { id: 'passif_actif', label: 'Passif et Actif', description: 'Situation financière actuelle' },
  { id: 'avis_comptable', label: 'Avis du comptable', description: 'Opinion sur la situation' },
  { id: 'declarations', label: 'Déclarations', description: 'Fiscales, sociales, TVA' },
  { id: 'dette_urssaf', label: 'Dette URSSAF', description: 'Configuration TNS, cotisations' },
  { id: 'intention_continuer', label: 'Intention de continuer', description: 'Poursuite ou arrêt activité' },
];

export const EXPERT_COMPTABLE_CHECKLIST_ITEMS: ChecklistDef = [
  { id: 'objectif_rdv', label: 'Objectif unique : obtenir un rendez-vous', description: 'Rappeler que le téléphone n\'est pas le bon format, l\'objectif est de fixer un RDV visio ou présentiel' },
  { id: 'cadrage_technique', label: 'Cadrage immédiat : échange technique', description: 'Installer un ton juriste à juriste, pas de vente, on expose un cadre juridique' },
  { id: 'positionnement_structure', label: 'Positionnement : conseil + avocats', description: 'Expliquer la structure de conseil et le cabinet d\'avocats pour la conformité' },
  { id: 'dossiers_vises', label: 'Dossiers visés : sociétés en situation critique', description: 'Sociétés dont le passif conduit à la liquidation, dirigeant cherche sortie sans procédure collective' },
  { id: 'pain_dirigeant', label: 'Pain du dirigeant', description: '"Je ne peux pas" (procédure intrusive) / "Je ne veux pas" (crédibilité bancaire détruite)' },
  { id: 'prerequis_reprise', label: 'Pré-requis : aucune reprise possible', description: 'On intervient uniquement sans repreneur possible, c\'est une solution de sortie encadrée' },
  { id: 'etape1_cession', label: 'Étape 1 : reprise de 100% des parts', description: 'Contrat de cession, le dirigeant sort totalement du capital' },
  { id: 'etape2_holding', label: 'Étape 2 : actionnaire unique via holding', description: 'Société reprise par une holding, le dirigeant ne conserve aucun contrôle' },
  { id: 'etape3_tup', label: 'Étape 3 : TUP (article 1844-5)', description: 'Transmission Universelle de Patrimoine, disparition de la personnalité morale' },
  { id: 'formule_juridique', label: 'Formule juridique à répéter', description: '"La société absorbante reprend actif et passif et vient aux droits et obligations"' },
  { id: 'encadrement_relais', label: 'Encadrement : relais juridique', description: 'Ce n\'est pas magique, on prend le relais en tant qu\'actionnaire et on gère le suivi complet' },
  { id: 'timing_opposition', label: 'Timing : délai d\'opposition', description: 'Après le délai légal de 30 jours, le dirigeant est définitivement séparé de la société' },
  { id: 'autorite_jurisprudence', label: 'Autorité : Cour de cassation (mai 2022)', description: 'La TUP transfrontalière a été validée, le dispositif repose sur un cadrage précis' },
  { id: 'conditions_substance', label: '6 conditions cumulatives', description: 'La société ne peut pas être fictive, il faut une substance et un suivi réel' },
  { id: 'sujets_sensibles', label: 'Sujets sensibles : fisc, créanciers', description: 'À traiter en rendez-vous avec documents à l\'appui, cadre légal sécurisé' },
  { id: 'cloture_rdv', label: 'Clôture : proposition de rendez-vous', description: 'Proposer un créneau, montrer les documents et répondre aux questions' },
];

const CHECKLIST_BY_TYPE: Record<CallType, ChecklistDef> = {
  client: CLIENT_CHECKLIST_ITEMS,
  expert_comptable: EXPERT_COMPTABLE_CHECKLIST_ITEMS,
};

const getInitialItems = (callType: CallType): ChecklistItem[] =>
  CHECKLIST_BY_TYPE[callType].map(item => ({
    ...item,
    isChecked: false,
    isManuallySet: false,
  }));

interface UseChecklistAnalysisOptions {
  isRecording: boolean;
  getAudioSnapshot: () => Blob | null;
  analysisInterval?: number;
  callType?: CallType;
}

export const useChecklistAnalysis = (options?: UseChecklistAnalysisOptions) => {
  const callType = options?.callType ?? 'client';
  const [items, setItems] = useState<ChecklistItem[]>(() => getInitialItems(callType));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(false);
  const prevCallTypeRef = useRef(callType);

  // Reset when callType changes
  useEffect(() => {
    if (prevCallTypeRef.current !== callType) {
      prevCallTypeRef.current = callType;
      setItems(getInitialItems(callType));
      setLastAnalysisTime(null);
    }
  }, [callType]);

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
    setItems(getInitialItems(callType));
    setIsAnalyzing(false);
    setLastAnalysisTime(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [callType]);

  const analyzeAudio = useCallback(async (audioBlob: Blob) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const audioBase64 = btoa(binary);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-checklist-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ audioBase64, callType }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur d\'analyse');
      }

      const result = await response.json();

      if (result.detectedItems && Array.isArray(result.detectedItems)) {
        setItems(prevItems =>
          prevItems.map(item => {
            if (item.isManuallySet) return item;
            const isDetected = result.detectedItems.includes(item.id);
            return { ...item, isChecked: isDetected || item.isChecked };
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
  }, [callType]);

  useEffect(() => {
    if (!options) return;
    const { isRecording, getAudioSnapshot, analysisInterval = 60000 } = options;

    if (isRecording) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => {
        const snapshot = getAudioSnapshot();
        if (snapshot && snapshot.size > 0) analyzeAudio(snapshot);
      }, analysisInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
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
