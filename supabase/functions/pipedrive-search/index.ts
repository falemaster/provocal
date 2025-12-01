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
    const { query } = await req.json();
    const PIPEDRIVE_API_KEY = Deno.env.get('PIPEDRIVE_API_KEY');

    if (!PIPEDRIVE_API_KEY) {
      throw new Error('PIPEDRIVE_API_KEY is not configured');
    }

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ deals: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching Pipedrive deals for:', query);

    // Search deals in Pipedrive
    const response = await fetch(
      `https://api.pipedrive.com/v1/deals/search?term=${encodeURIComponent(query)}&api_token=${PIPEDRIVE_API_KEY}&limit=10`,
      { method: 'GET' }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Pipedrive API error:', response.status, errorText);
      throw new Error(`Pipedrive API error: ${response.status}`);
    }

    const data = await response.json();
    
    const deals = data.data?.items?.map((item: any) => ({
      id: item.item.id,
      title: item.item.title,
      organization: item.item.organization?.name || null,
      person: item.item.person?.name || null,
      value: item.item.value,
      currency: item.item.currency,
      status: item.item.status,
    })) || [];

    console.log(`Found ${deals.length} deals`);

    return new Response(
      JSON.stringify({ deals }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pipedrive-search:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
