import { useState, useEffect } from 'react';
import { Plus, Phone, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DealSearch } from '@/components/DealSearch';
import { AudioRecorder } from '@/components/AudioRecorder';
import { SummaryEditor } from '@/components/SummaryEditor';
import { CallCard } from '@/components/CallCard';
import { LiveChecklist } from '@/components/LiveChecklist';
import { LiveTranscription } from '@/components/LiveTranscription';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useRealtimeTranscription } from '@/hooks/useRealtimeTranscription';
import { useChecklistAnalysis } from '@/hooks/useChecklistAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PipedriveDeal, Call } from '@/types/call';

const Index = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<PipedriveDeal | null>(null);
  const [isCreatingCall, setIsCreatingCall] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();
  const recorder = useAudioRecorder();
  const transcription = useRealtimeTranscription();
  const checklist = useChecklistAnalysis(transcription.transcript, recorder.isRecording);

  // Sync transcription with recording state
  useEffect(() => {
    if (recorder.isRecording && !transcription.isListening) {
      transcription.startListening();
    } else if (!recorder.isRecording && transcription.isListening) {
      transcription.stopListening();
    }
  }, [recorder.isRecording]);

  // Load calls
  useEffect(() => {
    loadCalls();
  }, []);

  const loadCalls = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading calls:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les appels',
        variant: 'destructive',
      });
    } else {
      setCalls(data as Call[]);
    }
    setIsLoading(false);
  };

  const handleStartNewCall = () => {
    try {
      setIsCreatingCall(true);
      setSelectedCall(null);
      setSelectedDeal(null);
      recorder.resetRecording();
      transcription.resetTranscript();
      checklist.resetChecklist();

      // Scroll to recording section on mobile (after state update)
      setTimeout(() => {
        const recordingSection = document.getElementById('recording-section');
        if (recordingSection) {
          recordingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      toast({
        title: 'Nouvel appel',
        description: 'Interface d\'enregistrement ouverte',
      });
    } catch (error) {
      console.error('Error in handleStartNewCall:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de démarrer un nouvel appel',
        variant: 'destructive',
      });
    }
  };

  const handleStopRecording = async () => {
    const blob = await recorder.stopRecording();
    console.log('Recording stopped, blob ready:', blob?.size);
  };

  const handleProcessCall = async () => {
    if (!recorder.audioBlob) {
      toast({
        title: 'Erreur',
        description: 'Aucun enregistrement disponible',
        variant: 'destructive',
      });
      return;
    }

    setIsTranscribing(true);

    try {
      // Create call record
      const { data: newCall, error: createError } = await supabase
        .from('calls')
        .insert({
          pipedrive_deal_id: selectedDeal?.id || null,
          pipedrive_deal_name: selectedDeal?.title || null,
          status: 'transcribing',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Upload audio to Supabase Storage
      const audioPath = `${newCall.id}.webm`;
      console.log('Uploading audio to storage, path:', audioPath, 'size:', recorder.audioBlob.size);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('call-recordings')
        .upload(audioPath, recorder.audioBlob, {
          contentType: 'audio/webm',
          upsert: false, // Don't use upsert to avoid RLS issues
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Échec de l'upload audio: ${uploadError.message}`);
      }

      console.log('Audio uploaded successfully:', uploadData);

      // Verify the file exists before calling transcription
      const { data: fileExists } = await supabase.storage
        .from('call-recordings')
        .list('', { search: audioPath });
      
      console.log('File verification:', fileExists);
      
      if (!fileExists || fileExists.length === 0) {
        throw new Error('Le fichier audio n\'a pas été trouvé après l\'upload');
      }

      // Call transcription function with storage path
      const transcribeBody = { audioPath, callId: newCall.id };
      console.log('Calling transcribe-call with body:', transcribeBody);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(transcribeBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Échec de la transcription';
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      const { transcription, summary } = result;

      // Update call with transcription
      const { data: updatedCall, error: updateError } = await supabase
        .from('calls')
        .update({
          transcription,
          summary,
          status: 'ready',
        })
        .eq('id', newCall.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setSelectedCall(updatedCall as Call);
      setIsCreatingCall(false);
      recorder.resetRecording();
      await loadCalls();

      toast({
        title: 'Succès',
        description: 'Transcription terminée',
      });

    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Échec de la transcription';
      toast({
        title: 'Erreur de transcription',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSaveSummary = async (summary: string) => {
    if (!selectedCall) return;

    const { error } = await supabase
      .from('calls')
      .update({ summary })
      .eq('id', selectedCall.id);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder',
        variant: 'destructive',
      });
    } else {
      setSelectedCall({ ...selectedCall, summary });
      toast({
        title: 'Sauvegardé',
        description: 'Résumé mis à jour',
      });
    }
  };

  const handleUploadToPipedrive = async () => {
    if (!selectedCall?.pipedrive_deal_id || !selectedCall.summary) {
      toast({
        title: 'Erreur',
        description: 'Veuillez d\'abord lier une affaire Pipedrive',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pipedrive-add-note`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            dealId: selectedCall.pipedrive_deal_id,
            content: selectedCall.summary,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      // Update call status
      await supabase
        .from('calls')
        .update({ status: 'uploaded' })
        .eq('id', selectedCall.id);

      setSelectedCall({ ...selectedCall, status: 'uploaded' });
      await loadCalls();

      toast({
        title: 'Succès',
        description: 'Note ajoutée à Pipedrive',
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Erreur',
        description: 'Échec de l\'envoi vers Pipedrive',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkDeal = async (deal: PipedriveDeal) => {
    setSelectedDeal(deal);
    
    if (selectedCall) {
      const { error } = await supabase
        .from('calls')
        .update({
          pipedrive_deal_id: deal.id,
          pipedrive_deal_name: deal.title,
        })
        .eq('id', selectedCall.id);

      if (!error) {
        setSelectedCall({
          ...selectedCall,
          pipedrive_deal_id: deal.id,
          pipedrive_deal_name: deal.title,
        });
        await loadCalls();
      }
    }
  };

  const handleDeleteCall = async (callId: string) => {
    try {
      // Delete audio from storage if exists
      await supabase.storage
        .from('call-recordings')
        .remove([`${callId}.webm`]);

      // Delete call record
      const { error } = await supabase
        .from('calls')
        .delete()
        .eq('id', callId);

      if (error) throw error;

      // Clear selection if deleted call was selected
      if (selectedCall?.id === callId) {
        setSelectedCall(null);
      }

      await loadCalls();

      toast({
        title: 'Supprimé',
        description: 'L\'enregistrement a été supprimé',
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'enregistrement',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">CallSync</h1>
              <p className="text-xs text-muted-foreground">Pipedrive Integration</p>
            </div>
          </div>
          <Button onClick={handleStartNewCall} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel appel
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar - Call list */}
          <aside className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Historique</h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : calls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucun appel enregistré</p>
              </div>
            ) : (
              <div className="space-y-2">
                {calls.map((call) => (
                  <CallCard
                    key={call.id}
                    call={call}
                    onClick={() => {
                      setSelectedCall(call);
                      setIsCreatingCall(false);
                      setSelectedDeal(call.pipedrive_deal_id ? {
                        id: call.pipedrive_deal_id,
                        title: call.pipedrive_deal_name || '',
                        organization: null,
                        person: null,
                        value: null,
                        currency: null,
                        status: '',
                      } : null);
                    }}
                    onDelete={handleDeleteCall}
                    isActive={selectedCall?.id === call.id}
                  />
                ))}
              </div>
            )}
          </aside>

          {/* Main content */}
          <section className="lg:col-span-2">
            {isCreatingCall ? (
              <div id="recording-section" className="rounded-2xl border bg-card p-8 shadow-soft animate-slide-up">
                <h2 className="text-2xl font-bold text-foreground mb-6">Nouvel enregistrement</h2>
                
                {/* Deal search */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Lier à une affaire Pipedrive
                  </label>
                  <DealSearch
                    onSelect={setSelectedDeal}
                    selectedDeal={selectedDeal}
                  />
                  {selectedDeal && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-success">
                      <CheckCircle className="h-4 w-4" />
                      <span>Affaire sélectionnée : {selectedDeal.title}</span>
                    </div>
                  )}
                </div>

                {/* Live Checklist - Always visible during recording */}
                {(recorder.isRecording || transcription.transcript) && (
                  <div className="mb-6">
                    <LiveChecklist
                      items={checklist.items}
                      isAnalyzing={checklist.isAnalyzing}
                      onToggle={checklist.toggleItem}
                      checkedCount={checklist.checkedCount}
                      totalCount={checklist.totalCount}
                    />
                  </div>
                )}

                {/* Audio recorder */}
                <div className="py-8 border-t border-b">
                  <AudioRecorder
                    isRecording={recorder.isRecording}
                    isPaused={recorder.isPaused}
                    duration={recorder.duration}
                    onStart={recorder.startRecording}
                    onStop={handleStopRecording}
                    onPause={recorder.pauseRecording}
                    onResume={recorder.resumeRecording}
                    onReset={recorder.resetRecording}
                    hasAudio={!!recorder.audioBlob}
                  />
                </div>

                {/* Live Transcription */}
                {(recorder.isRecording || transcription.transcript) && (
                  <div className="mt-6">
                    <LiveTranscription
                      transcript={transcription.transcript}
                      interimTranscript={transcription.interimTranscript}
                      isListening={transcription.isListening}
                      isSupported={transcription.isSupported}
                      error={transcription.error}
                    />
                  </div>
                )}

                {/* Process button */}
                {recorder.audioBlob && !recorder.isRecording && (
                  <div className="mt-8 flex justify-center">
                    <Button
                      onClick={handleProcessCall}
                      size="xl"
                      disabled={isTranscribing}
                      className="min-w-[200px]"
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Transcription...
                        </>
                      ) : (
                        'Générer le résumé'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : selectedCall ? (
              <div className="rounded-2xl border bg-card p-8 shadow-soft animate-slide-up">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {selectedCall.pipedrive_deal_name || 'Appel sans affaire'}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(selectedCall.created_at).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {selectedCall.status === 'uploaded' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Envoyé à Pipedrive
                    </div>
                  )}
                </div>

                {/* Deal linking for existing call */}
                {!selectedCall.pipedrive_deal_id && (
                  <div className="mb-6 p-4 rounded-lg bg-accent/50 border border-accent">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Lier à une affaire Pipedrive
                    </label>
                    <DealSearch
                      onSelect={handleLinkDeal}
                      selectedDeal={selectedDeal}
                    />
                  </div>
                )}

                {/* Summary editor */}
                <SummaryEditor
                  summary={selectedCall.summary || ''}
                  onSave={handleSaveSummary}
                  onUpload={handleUploadToPipedrive}
                  isUploading={isUploading}
                  canUpload={!!selectedCall.pipedrive_deal_id && selectedCall.status !== 'uploaded'}
                />
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-16 shadow-soft text-center">
                <Phone className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Bienvenue sur CallSync
                </h2>
                <p className="text-muted-foreground mb-6">
                  Enregistrez vos appels, générez des résumés avec l'IA et synchronisez avec Pipedrive
                </p>
                <Button onClick={handleStartNewCall} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Commencer un enregistrement
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
