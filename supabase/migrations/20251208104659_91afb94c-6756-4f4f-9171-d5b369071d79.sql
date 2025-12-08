-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload recordings
CREATE POLICY "Users can upload recordings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'call-recordings');

-- Allow authenticated users to read their recordings
CREATE POLICY "Users can read recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'call-recordings');

-- Allow service role to read all recordings (for edge function)
CREATE POLICY "Service role can read all recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'call-recordings');