import { Mic, Square, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  hasAudio: boolean;
  className?: string;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const AudioRecorder = ({
  isRecording,
  isPaused,
  duration,
  onStart,
  onStop,
  onPause,
  onResume,
  onReset,
  hasAudio,
  className,
}: AudioRecorderProps) => {
  return (
    <div className={cn('flex flex-col items-center gap-6', className)}>
      {/* Duration display */}
      <div className="text-center">
        <p className={cn(
          'font-mono text-5xl font-bold tracking-wider transition-colors',
          isRecording && !isPaused ? 'text-destructive' : 'text-foreground'
        )}>
          {formatDuration(duration)}
        </p>
        {isRecording && (
          <p className={cn(
            'mt-2 text-sm font-medium',
            isPaused ? 'text-muted-foreground' : 'text-destructive'
          )}>
            {isPaused ? 'En pause' : 'Enregistrement en cours...'}
          </p>
        )}
      </div>

      {/* Recording indicator */}
      {isRecording && !isPaused && (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-destructive animate-pulse-recording" />
          <span className="h-2 w-2 rounded-full bg-destructive/60 animate-pulse-recording" style={{ animationDelay: '0.2s' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-destructive/40 animate-pulse-recording" style={{ animationDelay: '0.4s' }} />
        </div>
      )}

      {/* Control buttons */}
      <div className="flex items-center gap-4">
        {!isRecording && !hasAudio && (
          <Button
            onClick={onStart}
            variant="glow"
            size="icon-lg"
            className="rounded-full"
          >
            <Mic className="h-6 w-6" />
          </Button>
        )}

        {isRecording && (
          <>
            <Button
              onClick={isPaused ? onResume : onPause}
              variant="outline"
              size="icon-lg"
              className="rounded-full"
            >
              {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </Button>
            <Button
              onClick={onStop}
              variant="recording"
              size="icon-lg"
              className="rounded-full"
            >
              <Square className="h-5 w-5 fill-current" />
            </Button>
          </>
        )}

        {hasAudio && !isRecording && (
          <Button
            onClick={onReset}
            variant="outline"
            size="icon"
            className="rounded-full"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!isRecording && !hasAudio && (
        <p className="text-sm text-muted-foreground">
          Cliquez pour démarrer l'enregistrement
        </p>
      )}
    </div>
  );
};
