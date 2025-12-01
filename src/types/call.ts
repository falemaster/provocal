export interface PipedriveDeal {
  id: number;
  title: string;
  organization: string | null;
  person: string | null;
  value: number | null;
  currency: string | null;
  status: string;
}

export interface Call {
  id: string;
  pipedrive_deal_id: number | null;
  pipedrive_deal_name: string | null;
  audio_url: string | null;
  transcription: string | null;
  summary: string | null;
  status: 'draft' | 'transcribing' | 'ready' | 'uploaded';
  created_at: string;
  updated_at: string;
}
