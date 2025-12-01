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
    const { audioBase64, callId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!audioBase64) {
      throw new Error('No audio data provided');
    }

    console.log('Processing audio transcription for call:', callId);
    console.log('Audio data length:', audioBase64.length);

    const systemPrompt = `Tu es un assistant expert en transcription et analyse d'appels commerciaux pour un cabinet de conseil.

## Ta mission
1. **Écouter attentivement** l'audio fourni
2. **Transcrire** fidèlement ce qui est dit en identifiant les interlocuteurs :
   - **Conseiller** : Le représentant du cabinet de conseil
   - **Client** : L'interlocuteur externe
3. **Générer** un compte-rendu structuré basé UNIQUEMENT sur le contenu réel de l'appel

## Format de transcription attendu
**Conseiller** : [propos exacts du conseiller]
**Client** : [propos exacts du client]
...

## Format du compte-rendu attendu (markdown)
Adapte les sections selon les informations RÉELLEMENT présentes dans l'appel :

## Coordonnées
- Nom de la société : [nom mentionné ou "Non mentionné"]
- Localisation : [ville/région ou "Non mentionnée"]
- Contacts clés : [noms, rôles, emails si mentionnés]

## Contexte Historique
[Uniquement ce qui a été évoqué dans l'appel]

## Difficultés
- [Problèmes mentionnés avec montants si applicable]

## Particularités
- [Points spécifiques évoqués]

## Solution
- [Solutions discutées durant l'appel]

## Échéances
- [Délais mentionnés]

## Prochaines étapes
- [Actions convenues]

## RÈGLES CRITIQUES
- NE FABRIQUE JAMAIS d'informations non présentes dans l'audio
- Si l'audio est inaudible ou vide, indique-le clairement
- Transcris EXACTEMENT ce qui est dit, pas ce que tu imagines
- Indique "Non mentionné" pour les sections sans information`;

    // Using the correct format for Gemini multimodal with audio
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { 
                type: 'text', 
                text: 'Écoute attentivement cet enregistrement audio et transcris-le fidèlement. Identifie les deux interlocuteurs (Conseiller et Client), puis génère un compte-rendu structuré basé UNIQUEMENT sur ce que tu entends. Réponds avec "## TRANSCRIPTION" suivi de la transcription exacte, puis "## COMPTE-RENDU" suivi du résumé. Si l\'audio est vide ou inaudible, indique-le.' 
              },
              { 
                type: 'image_url',
                image_url: {
                  url: `data:audio/webm;base64,${audioBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const fullResponse = data.choices?.[0]?.message?.content || '';

    console.log('AI response received, length:', fullResponse.length);
    console.log('AI response preview:', fullResponse.substring(0, 500));

    // Parse the response to separate transcription and summary
    let transcription = '';
    let summary = '';

    const transcriptionMatch = fullResponse.match(/## TRANSCRIPTION\s*([\s\S]*?)(?=## COMPTE-RENDU|$)/i);
    const summaryMatch = fullResponse.match(/## COMPTE-RENDU\s*([\s\S]*)/i);

    if (transcriptionMatch) {
      transcription = transcriptionMatch[1].trim();
    }
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    // Fallback if parsing fails
    if (!transcription && !summary) {
      console.log('Parsing failed, using full response as summary');
      summary = fullResponse;
      transcription = '[Voir le compte-rendu ci-dessous]';
    }

    console.log('Transcription length:', transcription.length);
    console.log('Summary length:', summary.length);

    return new Response(
      JSON.stringify({ 
        transcription,
        summary 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcribe-call:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
