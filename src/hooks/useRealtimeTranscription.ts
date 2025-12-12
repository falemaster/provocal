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
  const shouldRestartRef = useRef<boolean>(false);
  const errorCountRef = useRef<number>(0);
  const maxRetries = 3;

  const startListening = useCallback(() => {
    if (!state.isSupported) {
      setState(prev => ({ 
        ...prev, 
        error: 'La reconnaissance vocale n\'est pas supportée par ce navigateur. Utilisez Chrome ou Edge.' 
      }));
      return;
    }

    // Reset error count on manual start
    errorCountRef.current = 0;
    shouldRestartRef.current = true;

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Reset error count on successful result
        errorCountRef.current = 0;
        
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
        
        // Ignore no-speech errors - they're normal
        if (event.error === 'no-speech') {
          return;
        }

        // Handle network errors (common in iframes/preview environments)
        if (event.error === 'network') {
          errorCountRef.current++;
          
          if (errorCountRef.current >= maxRetries) {
            shouldRestartRef.current = false;
            setState(prev => ({ 
              ...prev, 
              error: 'Erreur réseau : la transcription live nécessite une connexion directe. Testez dans un nouvel onglet ou utilisez Chrome.',
              isListening: false,
            }));
            return;
          }
          
          // Don't show error for first few retries
          return;
        }

        // Handle aborted errors silently (happens when we stop manually)
        if (event.error === 'aborted') {
          return;
        }
        
        setState(prev => ({ 
          ...prev, 
          error: `Erreur de reconnaissance: ${event.error}`,
          isListening: false,
        }));
        shouldRestartRef.current = false;
      };

      recognition.onend = () => {
        // Only auto-restart if we should and haven't exceeded error count
        if (shouldRestartRef.current && recognitionRef.current && errorCountRef.current < maxRetries) {
          try {
            // Small delay before restart to prevent tight loop
            setTimeout(() => {
              if (shouldRestartRef.current && recognitionRef.current) {
                recognition.start();
              }
            }, 500);
          } catch (e) {
            console.log('Recognition restart failed');
            setState(prev => ({ ...prev, isListening: false }));
          }
        } else if (!shouldRestartRef.current) {
          setState(prev => ({ ...prev, isListening: false }));
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
    shouldRestartRef.current = false;
    
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition.abort();
      } catch (e) {
        // Ignore errors when stopping
      }
    }
    
    setState(prev => ({ 
      ...prev, 
      isListening: false,
      interimTranscript: '',
    }));
  }, []);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = '';
    errorCountRef.current = 0;
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
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore
        }
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
