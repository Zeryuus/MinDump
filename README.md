# MinDump

PWA de prise de notes ultra-rapide — capture texte ou vocale, stockage local, rappels.

## Prérequis

- Node.js 20+
- Navigateur moderne (Chrome Android recommandé pour la voix)

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

Ouvrir l’URL affichée (souvent `http://localhost:5173`). Le micro et les notifications nécessitent HTTPS en production ; `localhost` suffit en dev.

## Build production

```bash
npm run build
npm run preview
```

## Tester la PWA

1. Lancer `npm run build && npm run preview`
2. Ouvrir dans Chrome
3. Menu → « Installer l’application » / « Ajouter à l’écran d’accueil »

## Icônes PWA

Les fichiers `public/icon-192.png` et `public/icon-512.png` sont générés via :

```bash
npm run icons
```

## Fonctionnalités v1

- **Capture** (`/`) : saisie texte ou vocale, enregistrement instantané, commande « sauvegarder » en mode vocal
- **Flux** (`/flux`) : liste chronologique, peaufiner, rappel local, suppression
- **Stockage** : IndexedDB (aucun compte, données locales)
- **PWA** : installable, cache offline des assets

## Limitations connues

- **Reconnaissance vocale** : meilleur support sur Chrome ; Safari iOS partiel
- **Rappels** : fiables surtout si l’app reste ouverte (pas de push background en v1)
- **Notifications / micro** : permission utilisateur requise
