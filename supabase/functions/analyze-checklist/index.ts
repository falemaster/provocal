import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHECKLIST_ITEMS = [
  {
    id: 'historique',
    description: 'Historique de la société : activité, contexte, quand et comment elle a été créée',
    keywords: ['création', 'créé', 'fondé', 'activité', 'historique', 'contexte', 'depuis', 'année', 'début', 'démarré', 'lancé', 'société', 'entreprise', 'métier', 'secteur'],
  },
  {
    id: 'passif_actif',
    description: 'Passif et Actif actuel de la société : dettes, créances, trésorerie, actifs',
    keywords: ['passif', 'actif', 'dette', 'créance', 'trésorerie', 'bilan', 'capital', 'actifs', 'passifs', 'patrimoine', 'valeur', 'immobilier', 'véhicule', 'stock', 'matériel'],
  },
  {
    id: 'avis_comptable',
    description: 'Avis du comptable sur la situation',
    keywords: ['comptable', 'expert-comptable', 'cabinet', 'avis', 'opinion', 'conseil', 'recommand', 'préconise', 'pense', 'dit le comptable', 'selon le comptable'],
  },
  {
    id: 'declarations',
    description: 'État des déclarations fiscales, sociales et TVA',
    keywords: ['déclaration', 'fiscal', 'TVA', 'social', 'impôt', 'taxe', 'urssaf', 'cotisation', 'liasse', 'IS', 'IR', 'CFE', 'CVAE', 'charges sociales', 'régularisation'],
  },
  {
    id: 'dette_urssaf',
    description: 'Configuration de la dette URSSAF : TNS, cotisations personnelles, gérant, travailleur non salarié',
    keywords: ['URSSAF', 'TNS', 'travailleur non salarié', 'cotisation personnelle', 'gérant', 'SARL', 'EURL', 'fiche de paie', 'rappel', 'mise en demeure', 'dette personnelle', 'RSI', 'sécurité sociale indépendant'],
  },
  {
    id: 'intention_continuer',
    description: 'Intention de continuer l\'activité ou pas',
    keywords: ['continuer', 'arrêter', 'cesser', 'fermer', 'liquidation', 'redressement', 'poursuite', 'avenir', 'projet', 'intention', 'envisage', 'souhaite', 'veut', 'compte', 'prévoit', 'abandon', 'relancer'],
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing transcript, length:', transcript.length);

    // Build the prompt for Gemini
    const checklistDescriptions = CHECKLIST_ITEMS.map(
      (item, i) => `${i + 1}. ${item.id}: ${item.description}`
    ).join('\n');

    const prompt = `Tu es un assistant d'analyse de conversation téléphonique.

Voici la transcription d'un appel de téléprospection :
"""
${transcript}
"""

Voici les 6 points que le téléprospecteur doit aborder :
${checklistDescriptions}

Pour chaque point, détermine si le sujet a été abordé dans la conversation (même partiellement ou indirectement).

Réponds UNIQUEMENT avec un objet JSON contenant un tableau "detectedItems" avec les IDs des points qui ont été abordés.
Exemple: {"detectedItems": ["historique", "passif_actif"]}

Si aucun point n'a été abordé, réponds: {"detectedItems": []}`;

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
            content: 'Tu es un assistant d\'analyse de conversations. Tu réponds uniquement en JSON valide.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '{"detectedItems": []}';
    
    console.log('AI response content:', content);

    // Parse the JSON response
    let detectedItems: string[] = [];
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/```json?\n?/g, '').replace(/```/g, '');
      }
      
      const parsed = JSON.parse(cleanedContent);
      if (Array.isArray(parsed.detectedItems)) {
        // Validate that all items are valid IDs
        const validIds = CHECKLIST_ITEMS.map(item => item.id);
        detectedItems = parsed.detectedItems.filter((id: string) => validIds.includes(id));
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      // Fallback: try to detect items from keywords
      const lowerTranscript = transcript.toLowerCase();
      detectedItems = CHECKLIST_ITEMS
        .filter(item => item.keywords.some(kw => lowerTranscript.includes(kw.toLowerCase())))
        .map(item => item.id);
    }

    console.log('Detected items:', detectedItems);

    return new Response(
      JSON.stringify({ detectedItems }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analyze checklist error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
