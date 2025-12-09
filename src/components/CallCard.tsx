import { Calendar, Building2, FileText, CheckCircle, Clock, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Call } from '@/types/call';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CallCardProps {
  call: Call;
  onClick: () => void;
  onDelete: (id: string) => void;
  isActive: boolean;
}

const statusConfig: Record<Call['status'], { label: string; icon: typeof Clock; color: string; animate?: boolean }> = {
  draft: { label: 'Brouillon', icon: Clock, color: 'text-muted-foreground' },
  transcribing: { label: 'Transcription...', icon: Loader2, color: 'text-primary', animate: true },
  ready: { label: 'Prêt', icon: FileText, color: 'text-accent-foreground' },
  uploaded: { label: 'Envoyé', icon: CheckCircle, color: 'text-success' },
};

export const CallCard = ({ call, onClick, onDelete, isActive }: CallCardProps) => {
  const status = statusConfig[call.status];
  const StatusIcon = status.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-all duration-200 relative group',
        'hover:shadow-medium hover:border-primary/20',
        isActive 
          ? 'bg-accent border-primary/30 shadow-soft' 
          : 'bg-card border-border'
      )}
    >
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground truncate">
              {call.pipedrive_deal_name || 'Appel sans affaire'}
            </h4>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(call.created_at)}</span>
            </div>
            {call.pipedrive_deal_name && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate">{call.pipedrive_deal_name}</span>
              </div>
            )}
          </div>
          <div className={cn('flex items-center gap-1.5 text-xs font-medium', status.color)}>
            <StatusIcon className={cn('h-3.5 w-3.5', status.animate && 'animate-spin')} />
            <span>{status.label}</span>
          </div>
        </div>
      </button>
      
      {/* Delete button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/10 hover:bg-destructive/20 text-destructive"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet enregistrement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'enregistrement et son résumé seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(call.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
