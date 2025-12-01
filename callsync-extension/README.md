# 📞 CallSync - Extension Chrome

Extension Chrome pour enregistrer vos appels et synchroniser automatiquement avec Pipedrive.

## 🚀 Installation

### Mode Développeur (Recommandé pour tester)

1. **Télécharger l'extension**
   - Téléchargez le dossier `callsync-extension` complet

2. **Ouvrir Chrome**
   - Ouvrez Google Chrome (ou Brave, Edge)
   - Allez à `chrome://extensions/`

3. **Activer le mode développeur**
   - Activez l'interrupteur "Mode développeur" en haut à droite

4. **Charger l'extension**
   - Cliquez sur "Charger l'extension non empaquetée"
   - Sélectionnez le dossier `callsync-extension`

5. **Vérifier l'installation**
   - L'icône CallSync devrait apparaître dans la barre d'outils
   - Épinglez-la pour un accès facile

## 📖 Utilisation

### 1. Ouvrir un deal Pipedrive
- Naviguez vers un deal dans votre compte Pipedrive
- L'extension détecte automatiquement le deal
- Un badge vert ✓ apparaît sur l'icône

### 2. Enregistrer un appel
- Cliquez sur l'icône CallSync
- Le nom du deal est automatiquement détecté
- Cliquez sur "Démarrer" pour commencer l'enregistrement
- Utilisez "Pause" si nécessaire
- Cliquez sur "Arrêter" quand l'appel est terminé

### 3. Éditer et envoyer
- Le résumé est généré automatiquement par l'IA
- Éditez le résumé si nécessaire
- Cliquez sur "Envoyer à Pipedrive"
- La note est ajoutée au deal automatiquement

## ⚙️ Fonctionnalités

- ✅ Détection automatique des deals Pipedrive
- 🎙️ Enregistrement audio avec pause/reprise
- 🤖 Transcription et résumé par IA (Lovable AI)
- 📝 Édition du résumé avant envoi
- 📤 Synchronisation automatique avec Pipedrive
- 🔒 Fonctionne directement dans votre navigateur

## 🔧 Configuration

L'extension est préconfigurée pour fonctionner avec votre backend CallSync. Aucune configuration supplémentaire n'est nécessaire.

Les identifiants API sont dans le fichier `config.js`.

## 📝 Notes

- **Permissions requises** : Microphone, accès à Pipedrive
- **Navigateurs compatibles** : Chrome, Brave, Edge, Opera
- **Manifest** : Version 3 (dernière norme Chrome)

## 🐛 Dépannage

### L'extension ne détecte pas le deal
- Assurez-vous d'être sur une page deal : `https://*.pipedrive.com/deal/[ID]`
- Rechargez la page Pipedrive
- Rechargez l'extension dans `chrome://extensions/`

### Erreur d'enregistrement audio
- Vérifiez les permissions du microphone dans Chrome
- Paramètres → Confidentialité → Paramètres du site → Microphone

### Erreur lors de l'envoi
- Vérifiez votre connexion internet
- Assurez-vous que l'API Pipedrive est configurée

## 📦 Publication (Optionnel)

Pour publier l'extension sur le Chrome Web Store :

1. Créez un compte développeur Chrome ($5 unique)
2. Créez un zip du dossier `callsync-extension`
3. Téléchargez sur le [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Remplissez les informations (description, captures d'écran, etc.)
5. Soumettez pour révision

## 🔐 Sécurité

- L'audio n'est jamais stocké localement
- Communication sécurisée avec l'API (HTTPS)
- Permissions minimales requises
- Code source auditable

## 📄 Licence

Propriété de CallSync - Tous droits réservés
