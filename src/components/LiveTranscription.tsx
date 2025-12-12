import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LiveTranscriptionProps {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
}

export const LiveTranscription = ({
  transcript,
  interimTranscript,
  isListening,
  isSupported,
  error,
}: LiveTranscriptionProps) => {
  if (!isSupported) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Reconnaissance vocale non supportée. Utilisez Chrome ou Edge.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
            isListening
              ? 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isListening ? (
            <>
              <Mic className="h-3 w-3 animate-pulse" />
              <span>Écoute active</span>
            </>
          ) : (
            <>
              <MicOff className="h-3 w-3" />
              <span>En pause</span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Transcription temps réel
        </span>
      </div>

      {error && (
        <div className="mb-3 p-2 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      <div className="max-h-32 overflow-y-auto rounded-lg bg-background/50 p-3">
        {transcript || interimTranscript ? (
          <p className="text-sm text-foreground leading-relaxed">
            {transcript}
            {interimTranscript && (
              <span className="text-muted-foreground italic">
                {interimTranscript}
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {isListening
              ? 'En attente de parole...'
              : 'La transcription apparaîtra ici pendant l\'enregistrement'}
          </p>
        )}
      </div>
    </div>
  );
};
