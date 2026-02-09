

# Ajout du type d'appel "Expert Comptable" avec titres et descriptions detaillees

## Ce qui va changer

Avant de demarrer un enregistrement, un selecteur permettra de choisir entre deux types d'appel :
- **Client final** (6 points) -- la checklist actuelle
- **Expert comptable** (16 points) -- nouvelle checklist

Chaque point affichera :
- **Ligne titre** : le sujet en gras
- **Sous-ligne** : une phrase de contexte pour se rappeler de quoi il s'agit

L'analyse audio Gemini toutes les 60 secondes fonctionnera de la meme maniere pour les deux types.

---

## Details techniques

### 1. Mise a jour du hook (`src/hooks/useChecklistAnalysis.ts`)

- Ajouter un type `CallType = 'client' | 'expert_comptable'`
- Renommer `CHECKLIST_ITEMS` en `CLIENT_CHECKLIST_ITEMS`
- Enrichir les descriptions des 6 points "Client final" pour qu'elles soient plus explicites
- Ajouter `EXPERT_COMPTABLE_CHECKLIST_ITEMS` avec les 16 points suivants (titre + description) :

| ID | Titre | Description |
|---|---|---|
| `objectif_rdv` | Objectif unique : obtenir un rendez-vous | Rappeler que le telephone n'est pas le bon format, l'objectif est de fixer un RDV visio ou presentiel |
| `cadrage_technique` | Cadrage immediat : echange technique | Installer un ton juriste a juriste, pas de vente, on expose un cadre juridique |
| `positionnement_structure` | Positionnement : conseil + avocats | Expliquer la structure de conseil et le cabinet d'avocats pour la conformite |
| `dossiers_vises` | Dossiers vises : societes en situation critique | Societes dont le passif conduit a la liquidation, dirigeant cherche sortie sans procedure collective |
| `pain_dirigeant` | Pain du dirigeant | "Je ne peux pas" (procedure intrusive) / "Je ne veux pas" (credibilite bancaire detruite) |
| `prerequis_reprise` | Pre-requis : aucune reprise possible | On intervient uniquement sans repreneur possible, c'est une solution de sortie encadree |
| `etape1_cession` | Etape 1 : reprise de 100% des parts | Contrat de cession, le dirigeant sort totalement du capital |
| `etape2_holding` | Etape 2 : actionnaire unique via holding | Societe reprise par une holding, le dirigeant ne conserve aucun controle |
| `etape3_tup` | Etape 3 : TUP (article 1844-5) | Transmission Universelle de Patrimoine, disparition de la personnalite morale |
| `formule_juridique` | Formule juridique a repeter | "La societe absorbante reprend actif et passif et vient aux droits et obligations" |
| `encadrement_relais` | Encadrement : relais juridique | Ce n'est pas magique, on prend le relais en tant qu'actionnaire et on gere le suivi complet |
| `timing_opposition` | Timing : delai d'opposition | Apres le delai legal de 30 jours, le dirigeant est definitivement separe de la societe |
| `autorite_jurisprudence` | Autorite : Cour de cassation (mai 2022) | La TUP transfrontaliere a ete validee, le dispositif repose sur un cadrage precis |
| `conditions_substance` | 6 conditions cumulatives | La societe ne peut pas etre fictive, il faut une substance et un suivi reel |
| `sujets_sensibles` | Sujets sensibles : fisc, creanciers | A traiter en rendez-vous avec documents a l'appui, cadre legal securise |
| `cloture_rdv` | Cloture : proposition de rendez-vous | Proposer un creneau, montrer les documents et repondre aux questions |

- Ajouter un parametre `callType` au hook et l'utiliser pour initialiser les bons items
- Envoyer le `callType` dans le body de la requete a l'edge function
- Reset automatique de la checklist quand le type change

### 2. Mise a jour de l'edge function (`supabase/functions/analyze-checklist-audio/index.ts`)

- Ajouter les 16 items expert comptable avec leurs descriptions pour Gemini
- Accepter le parametre `callType` dans le body
- Selectionner le bon jeu d'items et adapter le prompt systeme selon le type :
  - Client : "analyse d'un appel de conseil en entreprise"
  - Expert comptable : "analyse d'un appel de prospection aupres d'un expert comptable sur un dispositif juridique de sortie de societe"

### 3. Selecteur de type d'appel dans l'UI (`src/pages/Index.tsx`)

- Ajouter un state `callType` avec valeur par defaut `'client'`
- Afficher deux boutons avant le demarrage de l'enregistrement :
  - "Client final" (icone User)
  - "Expert comptable" (icone Briefcase)
- Le selecteur est desactive pendant l'enregistrement
- Passer `callType` au hook `useChecklistAnalysis`

### 4. Composant LiveChecklist (`src/components/LiveChecklist.tsx`)

- Aucun changement structurel necessaire : il affiche deja `label` (titre) et `description` (sous-ligne)
- Fonctionnera automatiquement avec 6 ou 16 items selon le type selectionne

