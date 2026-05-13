# Catalogue PNF 2026-2027 — DGESCO

Application web pour la gestion du Plan National de Formation continue.

## Structure

```
├── index.html       ← Page de connexion
├── catalogue.html   ← Consultation + filtres + export
├── saisie.html      ← Saisie d'une nouvelle action (super-user)
├── css/style.css    ← Styles partagés
└── js/
    ├── api.js       ← Requêtes API Grist
    ├── auth.js      ← Authentification et session
    ├── catalogue.js ← Logique catalogue
    └── saisie.js    ← Logique formulaire
```

## Connexion

Chaque utilisateur se connecte avec **sa propre clé API Grist** :
- Ouvrir [grist.numerique.gouv.fr](https://grist.numerique.gouv.fr)
- Paramètres du profil → API → Gérer la clé API

Les droits sont détectés automatiquement :
- **Éditeur** → Super-user (lecture + écriture)
- **Lecteur** → User (lecture seule)

## Déploiement GitHub Pages

1. Pousser ce dossier sur un dépôt GitHub
2. Activer GitHub Pages : Settings → Pages → Source : main branch / root
3. L'application est accessible à `https://votre-compte.github.io/nom-du-repo/`

## Configuration

Le serveur Grist et l'ID du document sont définis dans `js/api.js` :
```js
const GRIST_SERVER = 'https://grist.numerique.gouv.fr';
const DOC_ID       = 'oEE59cdA19S6';
```
