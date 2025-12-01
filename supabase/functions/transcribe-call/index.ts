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

    const systemPrompt = `Tu es un assistant spécialisé dans la création de comptes-rendus d'appels commerciaux structurés et professionnels pour un cabinet de conseil.

Tu dois produire un résumé structuré au format markdown avec les sections suivantes (adapte selon les informations disponibles):

## Coordonnées
- Nom de la société
- Localisation
- Contacts clés (noms, rôles, emails)

## Contexte Historique
Description de l'entreprise, son activité, son historique pertinent.

## Difficultés
Liste des problèmes identifiés avec montants si applicable.

## Particularités
Points spécifiques à noter sur le dossier.

## Solution
Solutions envisagées ou proposées.

## Échéances
Délais importants à respecter.

## Prochaines étapes
Actions à mener suite à l'appel.

Sois précis, factuel et professionnel. Utilise des listes à puces pour la clarté.`;

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
          { role: 'user', content: 'Génère un template de compte-rendu d\'appel vide mais structuré que l\'utilisateur pourra remplir. Ajoute des indications [À compléter] dans chaque section.' }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || '';

    console.log('Summary generated successfully');

    return new Response(
      JSON.stringify({ 
        transcription: '[Transcription audio - fonctionnalité en développement]',
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
