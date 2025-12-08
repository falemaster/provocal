import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioPath, callId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    if (!audioPath) {
      throw new Error('No audio path provided');
    }

    console.log('Processing audio transcription for call:', callId);
    console.log('Audio path:', audioPath);

    // Create Supabase client with service role to access storage
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Download audio file from storage
    console.log('Downloading audio from storage...');
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('call-recordings')
      .download(audioPath);

    if (downloadError) {
      console.error('Storage download error:', downloadError);
      throw new Error(`Failed to download audio: ${downloadError.message}`);
    }

    // Convert blob to base64
    const arrayBuffer = await audioData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, [...chunk]);
    }
    const audioBase64 = btoa(binaryString);

    console.log('Audio downloaded, size:', uint8Array.length, 'bytes');
    console.log('Base64 length:', audioBase64.length);

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

    // Retry logic with exponential backoff
    const maxRetries = 3;
    const retryDelays = [2000, 5000, 10000];
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1}/${maxRetries} to transcribe audio`);
        
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

        if (response.ok) {
          console.log('Transcription successful on attempt', attempt + 1);
          break;
        }

        const errorText = await response.text();
        console.error(`AI API error on attempt ${attempt + 1}:`, response.status, errorText);
        
        if (response.status === 429) {
          lastError = new Error('Limite de taux atteinte. Veuillez réessayer dans quelques instants.');
        } else if (response.status === 402) {
          lastError = new Error('Crédits IA épuisés. Veuillez contacter le support.');
        } else if (response.status === 503) {
          lastError = new Error('Service temporairement indisponible. Nouvel essai en cours...');
        } else {
          lastError = new Error(`Erreur API IA: ${response.status} - ${errorText}`);
        }

        if (attempt < maxRetries - 1 && (response.status === 503 || response.status === 429)) {
          console.log(`Waiting ${retryDelays[attempt]}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        } else if (response.status === 402) {
          throw lastError;
        }

      } catch (error) {
        console.error(`Network error on attempt ${attempt + 1}:`, error);
        lastError = error instanceof Error ? error : new Error('Erreur réseau inconnue');
        
        if (attempt < maxRetries - 1) {
          console.log(`Waiting ${retryDelays[attempt]}ms before retry after network error...`);
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        }
      }
    }

    if (!response || !response.ok) {
      console.error('All retry attempts failed');
      throw lastError || new Error('Échec de la transcription après plusieurs tentatives');
    }

    const data = await response.json();
    const fullResponse = data.choices?.[0]?.message?.content || '';

    console.log('AI response received, length:', fullResponse.length);
    console.log('AI response preview:', fullResponse.substring(0, 500));

    // Parse the response
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

    if (!transcription && !summary) {
      console.log('Parsing failed, using full response as summary');
      summary = fullResponse;
      transcription = '[Voir le compte-rendu ci-dessous]';
    }

    console.log('Transcription length:', transcription.length);
    console.log('Summary length:', summary.length);

    // Cleanup: delete the audio file from storage after successful transcription
    const { error: deleteError } = await supabase.storage
      .from('call-recordings')
      .remove([audioPath]);
    
    if (deleteError) {
      console.warn('Failed to cleanup audio file:', deleteError);
    } else {
      console.log('Audio file cleaned up successfully');
    }

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