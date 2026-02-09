import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ITEMS = [
  { id: 'historique', description: 'Histoire de la société, activité, création, contexte' },
  { id: 'passif_actif', description: 'Passif et actif, dettes, créances, trésorerie, situation financière' },
  { id: 'avis_comptable', description: 'Avis du comptable sur la situation' },
  { id: 'declarations', description: 'Déclarations fiscales, sociales, TVA' },
  { id: 'dette_urssaf', description: 'Dette URSSAF, TNS, cotisations personnelles du dirigeant' },
  { id: 'intention_continuer', description: 'Intention de continuer ou arrêter l\'activité' },
];

const EXPERT_COMPTABLE_ITEMS = [
  { id: 'objectif_rdv', description: 'Objectif de fixer un rendez-vous visio ou présentiel, le téléphone n\'est pas le bon format' },
  { id: 'cadrage_technique', description: 'Ton juriste à juriste, échange technique pas commercial, cadre juridique' },
  { id: 'positionnement_structure', description: 'Structure de conseil + cabinet d\'avocats pour conformité' },
  { id: 'dossiers_vises', description: 'Sociétés dont le passif conduit à la liquidation, dirigeant cherche sortie sans procédure collective' },
  { id: 'pain_dirigeant', description: '"Je ne peux pas" (procédure intrusive) / "Je ne veux pas" (crédibilité bancaire détruite)' },
  { id: 'prerequis_reprise', description: 'Aucun repreneur possible, pas de retournement, solution de sortie encadrée' },
  { id: 'etape1_cession', description: 'Reprise 100% des parts via contrat de cession, dirigeant sort du capital' },
  { id: 'etape2_holding', description: 'Société reprise par holding, dirigeant ne conserve aucun contrôle' },
  { id: 'etape3_tup', description: 'Transmission Universelle de Patrimoine, article 1844-5, disparition personnalité morale' },
  { id: 'formule_juridique', description: 'Base légale : société absorbante reprend actif et passif, vient aux droits et obligations' },
  { id: 'encadrement_relais', description: 'Relais juridique complet, gestion contentieux éventuel, pas magique' },
  { id: 'timing_opposition', description: 'Délai d\'opposition 30 jours, séparation définitive du dirigeant' },
  { id: 'autorite_jurisprudence', description: 'Cour de cassation mai 2022, TUP transfrontalière validée' },
  { id: 'conditions_substance', description: '6 conditions cumulatives, société non fictive, substance et suivi réel' },
  { id: 'sujets_sensibles', description: 'Fisc, créanciers, conformité — à traiter en rendez-vous avec documents' },
  { id: 'cloture_rdv', description: 'Proposition de créneau, montrer documents, répondre aux questions' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioBase64, callType = 'client' } = await req.json();

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ error: 'Aucun audio fourni' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY non configurée');

    const items = callType === 'expert_comptable' ? EXPERT_COMPTABLE_ITEMS : CLIENT_ITEMS;
    const itemCount = items.length;

    const checklistDescription = items
      .map((item, i) => `${i + 1}. ${item.id}: ${item.description}`)
      .join('\n');

    const systemContext = callType === 'expert_comptable'
      ? `Tu es un assistant qui analyse des appels de prospection auprès d'un expert comptable sur un dispositif juridique de sortie de société (TUP, cession de parts, etc.).`
      : `Tu es un assistant qui analyse des appels téléphoniques de conseil en entreprise.`;

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
            content: `${systemContext}
Tu dois identifier quels sujets ont été abordés dans la conversation.

Voici les ${itemCount} points à détecter :
${checklistDescription}

Réponds UNIQUEMENT avec un JSON valide au format : {"detectedItems": ["id1", "id2"]}
N'inclus que les points qui ont clairement été discutés dans l'audio.
Si aucun point n'a été abordé, réponds : {"detectedItems": []}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Écoute cet audio et identifie les points de la checklist qui ont été abordés.' },
              { type: 'input_audio', input_audio: { data: audioBase64, format: 'webm' } },
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

    let detectedItems: string[] = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*"detectedItems"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        detectedItems = parsed.detectedItems || [];
      }
    } catch {
      const validIds = items.map(i => i.id);
      detectedItems = validIds.filter(id => content.toLowerCase().includes(id));
    }

    const validIds = items.map(i => i.id);
    detectedItems = detectedItems.filter(id => validIds.includes(id));

    return new Response(
      JSON.stringify({ detectedItems }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analyze checklist error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erreur d\'analyse' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
