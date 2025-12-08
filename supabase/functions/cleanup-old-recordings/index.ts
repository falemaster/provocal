import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List all files in the call-recordings bucket
    const { data: files, error: listError } = await supabase.storage
      .from('call-recordings')
      .list();

    if (listError) {
      console.error('Error listing files:', listError);
      throw listError;
    }

    if (!files || files.length === 0) {
      console.log('No files to clean up');
      return new Response(JSON.stringify({ deleted: 0, message: 'No files to clean up' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Filter files older than 24 hours
    const oldFiles = files.filter(file => {
      const createdAt = new Date(file.created_at);
      return createdAt < twentyFourHoursAgo;
    });

    if (oldFiles.length === 0) {
      console.log('No old files to delete');
      return new Response(JSON.stringify({ deleted: 0, message: 'No old files to delete' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete old files
    const filesToDelete = oldFiles.map(file => file.name);
    console.log(`Deleting ${filesToDelete.length} old recordings:`, filesToDelete);

    const { error: deleteError } = await supabase.storage
      .from('call-recordings')
      .remove(filesToDelete);

    if (deleteError) {
      console.error('Error deleting files:', deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted ${filesToDelete.length} old recordings`);

    return new Response(JSON.stringify({ 
      deleted: filesToDelete.length, 
      files: filesToDelete,
      message: `Deleted ${filesToDelete.length} recordings older than 24 hours` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in cleanup-old-recordings:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
