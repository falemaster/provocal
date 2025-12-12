import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHECKLIST_ITEMS = [
  { id: 'historique', description: 'Histoire de la société, activité, création, contexte' },
  { id: 'passif_actif', description: 'Passif et actif, dettes, créances, trésorerie, situation financière' },
  { id: 'avis_comptable', description: 'Avis du comptable sur la situation' },
  { id: 'declarations', description: 'Déclarations fiscales, sociales, TVA' },
  { id: 'dette_urssaf', description: 'Dette URSSAF, TNS, cotisations personnelles du dirigeant' },
  { id: 'intention_continuer', description: 'Intention de continuer ou arrêter l\'activité' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64 } = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: 'Aucun audio fourni' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY non configurée');
    }

    console.log('Analyzing audio for checklist, size:', audioBase64.length);

    const checklistDescription = CHECKLIST_ITEMS
      .map((item, i) => `${i + 1}. ${item.id}: ${item.description}`)
      .join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant qui analyse des appels téléphoniques de conseil en entreprise.
Tu dois identifier quels sujets ont été abordés dans la conversation.

Voici les 6 points à détecter :
${checklistDescription}

Réponds UNIQUEMENT avec un JSON valide au format : {"detectedItems": ["historique", "passif_actif"]}
N'inclus que les points qui ont clairement été discutés dans l'audio.
Si aucun point n'a été abordé, réponds : {"detectedItems": []}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Écoute cet audio et identifie les points de la checklist qui ont été abordés.',
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: audioBase64,
                  format: 'webm',
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit atteint, réessayez dans quelques secondes' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erreur API: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);

    // Parse the JSON response
    let detectedItems: string[] = [];
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*"detectedItems"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        detectedItems = parsed.detectedItems || [];
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Try to extract item IDs directly from text
      const validIds = CHECKLIST_ITEMS.map(i => i.id);
      detectedItems = validIds.filter(id => content.toLowerCase().includes(id));
    }

    // Validate detected items
    const validIds = CHECKLIST_ITEMS.map(i => i.id);
    detectedItems = detectedItems.filter(id => validIds.includes(id));

    console.log('Detected checklist items:', detectedItems);

    return new Response(
      JSON.stringify({ detectedItems }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analyze checklist error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur d\'analyse';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
