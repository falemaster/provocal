-- Table pour stocker les appels et leurs transcriptions
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipedrive_deal_id INTEGER,
  pipedrive_deal_name TEXT,
  audio_url TEXT,
  transcription TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'transcribing', 'ready', 'uploaded')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_calls_pipedrive_deal_id ON public.calls(pipedrive_deal_id);
CREATE INDEX idx_calls_status ON public.calls(status);
CREATE INDEX idx_calls_created_at ON public.calls(created_at DESC);

-- Trigger pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS désactivé car pas d'auth pour ce MVP
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Politique publique pour permettre toutes les opérations
CREATE POLICY "Allow all operations on calls" ON public.calls
  FOR ALL USING (true) WITH CHECK (true);