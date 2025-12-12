import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface RealtimeTranscriptionState {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
}

export const useRealtimeTranscription = () => {
  const [state, setState] = useState<RealtimeTranscriptionState>({
    transcript: '',
    interimTranscript: '',
    isListening: false,
    isSupported: typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    error: null,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>('');

  const startListening = useCallback(() => {
    if (!state.isSupported) {
      setState(prev => ({ 
        ...prev, 
        error: 'La reconnaissance vocale n\'est pas supportée par ce navigateur. Utilisez Chrome ou Edge.' 
      }));
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          transcriptRef.current += finalTranscript;
        }

        setState(prev => ({
          ...prev,
          transcript: transcriptRef.current,
          interimTranscript,
          error: null,
        }));
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        
        // Don't stop for 'no-speech' errors, just continue
        if (event.error === 'no-speech') {
          return;
        }
        
        setState(prev => ({ 
          ...prev, 
          error: `Erreur de reconnaissance: ${event.error}`,
          isListening: false,
        }));
      };

      recognition.onend = () => {
        // Auto-restart if still supposed to be listening
        if (recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.log('Recognition restart failed, stopping');
            setState(prev => ({ ...prev, isListening: false }));
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      
      setState(prev => ({ 
        ...prev, 
        isListening: true, 
        error: null,
      }));
      
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Impossible de démarrer la reconnaissance vocale',
        isListening: false,
      }));
    }
  }, [state.isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition.stop();
    }
    
    setState(prev => ({ 
      ...prev, 
      isListening: false,
      interimTranscript: '',
    }));
  }, []);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = '';
    setState(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
      error: null,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    resetTranscript,
  };
};
