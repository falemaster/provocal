import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealId, content } = await req.json();
    const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

    if (!PIPEDRIVE_API_KEY) {
      throw new Error('PIPEDRIVE_API_KEY is not configured');
    }

    if (!dealId || !content) {
      throw new Error('Deal ID and content are required');
    }

    console.log('Adding note to Pipedrive deal:', dealId);

    const response = await fetch(
      `https://api.pipedrive.com/v1/notes?api_token=${PIPEDRIVE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deal_id: dealId,
          content: content,
          pinned_to_deal_flag: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pipedrive API error:', response.status, errorText);
      throw new Error(`Pipedrive API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Note added successfully:', data.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        noteId: data.data?.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pipedrive-add-note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
