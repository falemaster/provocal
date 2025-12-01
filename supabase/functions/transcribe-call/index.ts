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
1. **Transcrire** l'audio en identifiant clairement les deux interlocuteurs :
   - **Conseiller** : Le représentant du cabinet de conseil
   - **Client** : L'interlocuteur externe

2. **Analyser** le contenu pour extraire toutes les informations pertinentes

3. **Générer** un compte-rendu structuré professionnel

## Format de transcription attendu
Utilise ce format pour la transcription :
**Conseiller** : [propos du conseiller]
**Client** : [propos du client]
...

## Format du compte-rendu attendu (markdown)
Adapte les sections selon les informations disponibles dans l'appel :

## Coordonnées
- Nom de la société : [nom ou "Non mentionné"]
- Localisation : [ville/région ou "Non mentionnée"]
- Contacts clés : [noms, rôles, emails si mentionnés]

## Contexte Historique
[Description de l'entreprise, son activité, historique pertinent évoqué]

## Difficultés
- [Problème 1 avec montant si applicable]
- [Problème 2...]

## Particularités
- [Points spécifiques à noter sur le dossier]

## Solution
- [Solutions envisagées ou proposées durant l'appel]

## Échéances
- [Délais importants mentionnés]

## Prochaines étapes
- [Actions à mener suite à l'appel]

## Instructions importantes
- Sois précis et factuel, ne fabrique pas d'informations non présentes dans l'audio
- Utilise des listes à puces pour la clarté
- Indique "Non mentionné" si une information n'est pas évoquée
- Capture les montants, dates et noms propres avec exactitude`;

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
                text: 'Transcris cet appel commercial en identifiant les deux interlocuteurs (Conseiller et Client), puis génère un compte-rendu structuré. Réponds avec deux sections clairement séparées : "## TRANSCRIPTION" suivi de la transcription complète, puis "## COMPTE-RENDU" suivi du résumé structuré.' 
              },
              { 
                type: 'input_audio', 
                input_audio: {
                  data: audioBase64,
                  format: 'webm'
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
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const fullResponse = data.choices?.[0]?.message?.content || '';

    console.log('AI response received, length:', fullResponse.length);

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
      transcription = '[Transcription intégrée au compte-rendu]';
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
