import { Check, Loader2, Circle, Clock } from 'lucide-react';
import { ChecklistItem } from '@/hooks/useChecklistAnalysis';
import { cn } from '@/lib/utils';

interface LiveChecklistProps {
  items: ChecklistItem[];
  isAnalyzing: boolean;
  onToggle: (itemId: string) => void;
  checkedCount: number;
  totalCount: number;
  lastAnalysisTime?: number | null;
}

const formatTimeSince = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `il y a ${minutes}min`;
};

export const LiveChecklist = ({
  items,
  isAnalyzing,
  onToggle,
  checkedCount,
  totalCount,
  lastAnalysisTime,
}: LiveChecklistProps) => {
  return (
    <div className="rounded-xl border bg-card/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Points à aborder
          {isAnalyzing && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyse...
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {lastAnalysisTime && !isAnalyzing && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeSince(lastAnalysisTime)}
            </span>
          )}
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
            {checkedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Analysis info */}
      <div className="mb-3 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
        🎙️ Analyse automatique toutes les 60 secondes. Cliquez pour cocher/décocher manuellement.
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={cn(
              'w-full flex items-start gap-3 p-2 rounded-lg text-left transition-all duration-300',
              'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
              item.isChecked 
                ? 'bg-success/5' 
                : 'bg-accent/30'
            )}
          >
            {/* Checkbox */}
            <div
              className={cn(
                'flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300',
                item.isChecked
                  ? 'bg-success border-success text-success-foreground scale-110'
                  : 'border-muted-foreground/40'
              )}
            >
              {item.isChecked && <Check className="h-3 w-3" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'transition-all duration-300',
                  item.isChecked
                    ? 'text-sm text-muted-foreground line-through'
                    : 'text-base font-bold text-foreground'
                )}
              >
                {item.label}
                {item.isManuallySet && (
                  <span className="ml-2 text-xs text-muted-foreground">(manuel)</span>
                )}
              </p>
              <p
                className={cn(
                  'text-xs transition-all',
                  item.isChecked
                    ? 'text-muted-foreground/60'
                    : 'text-muted-foreground'
                )}
              >
                {item.description}
              </p>
            </div>

            {/* Status indicator */}
            {!item.isChecked && (
              <Circle className="h-2 w-2 text-primary flex-shrink-0 mt-1.5 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {checkedCount === totalCount && (
        <div className="mt-3 p-2 rounded-lg bg-success/10 text-success text-xs text-center font-medium">
          ✓ Tous les points ont été abordés !
        </div>
      )}
    </div>
  );
};
