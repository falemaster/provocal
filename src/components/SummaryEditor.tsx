import { useState, useEffect } from 'react';
import { Check, Upload, Edit3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface SummaryEditorProps {
  summary: string;
  onSave: (summary: string) => void;
  onUpload: () => void;
  isUploading: boolean;
  canUpload: boolean;
  className?: string;
}

export const SummaryEditor = ({
  summary,
  onSave,
  onUpload,
  isUploading,
  canUpload,
  className,
}: SummaryEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(summary);

  useEffect(() => {
    setEditedSummary(summary);
  }, [summary]);

  const handleSave = () => {
    onSave(editedSummary);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedSummary(summary);
    setIsEditing(false);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Résumé de l'appel</h3>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              size="sm"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          ) : (
            <>
              <Button
                onClick={handleCancel}
                variant="ghost"
                size="sm"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                variant="default"
                size="sm"
              >
                <Check className="h-4 w-4 mr-2" />
                Valider
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <Textarea
          value={editedSummary}
          onChange={(e) => setEditedSummary(e.target.value)}
          className="min-h-[400px] font-mono text-sm leading-relaxed"
          placeholder="Modifiez le résumé..."
        />
      ) : (
        <div className="rounded-lg border bg-card p-6 shadow-soft">
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-card-foreground">
              {summary || 'Aucun résumé disponible'}
            </pre>
          </div>
        </div>
      )}

      {!isEditing && canUpload && (
        <div className="flex justify-end pt-4">
          <Button
            onClick={onUpload}
            variant="success"
            size="lg"
            disabled={isUploading || !summary}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Envoyer vers Pipedrive
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
