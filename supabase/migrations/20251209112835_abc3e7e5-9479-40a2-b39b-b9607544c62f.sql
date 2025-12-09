-- Drop existing overly restrictive policies on call-recordings bucket
DROP POLICY IF EXISTS "Users can upload recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can read recordings" ON storage.objects;
DROP POLICY IF EXISTS "Service role can read all recordings" ON storage.objects;

-- Create permissive policies for the call-recordings bucket (no auth required)
-- Allow anyone to upload to call-recordings bucket
CREATE POLICY "Anyone can upload call recordings"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'call-recordings');

-- Allow anyone to read from call-recordings bucket
CREATE POLICY "Anyone can read call recordings"
ON storage.objects
FOR SELECT
USING (bucket_id = 'call-recordings');

-- Allow anyone to delete from call-recordings bucket (for cleanup)
CREATE POLICY "Anyone can delete call recordings"
ON storage.objects
FOR DELETE
USING (bucket_id = 'call-recordings');