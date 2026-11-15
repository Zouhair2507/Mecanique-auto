# Mécanique Auto — site du garage

Site web complet pour un garage automobile :

- **Tarifs des prestations** : entretien, freinage, distribution, pneus, climatisation, diagnostic, suspension… (prix TTC, mention « à partir de », durée indicative).
- **Taux horaires** de main d’œuvre, affichés en TTC avec l’équivalent HT.
- **Horaires d’ouverture**, avec le statut « Ouvert / Fermé » en temps réel, les jours fériés et les fermetures exceptionnelles.
- **Prise de rendez-vous en ligne** en 4 étapes : prestations → date et heure (créneaux réellement disponibles) → véhicule → coordonnées. Le client reçoit une référence, peut ajouter le rendez-vous à son agenda, puis le consulter ou l’annuler.
- **Support client** : FAQ, formulaire de demande (devis, question, réclamation…), suivi de la demande et échange de messages avec le garage.
- **Espace garage** (`/admin`) protégé par mot de passe : tableau de bord, gestion des rendez-vous (confirmer, terminer, annuler, notes internes), réponses au support, et modification des **tarifs, taux horaires, horaires, fermetures, coordonnées et FAQ sans toucher au code**.

Aucune base de données à installer : tout est enregistré dans `data/db.json`.

## Démarrage rapide

Prérequis : [Node.js](https://nodejs.org) 20.12 ou plus récent.

```bash
npm install
```

```bash
npm start
```

Le site est disponible sur <http://localhost:3000> et l’espace garage sur <http://localhost:3000/admin>.

Au premier démarrage, si aucun mot de passe n’est défini, un mot de passe administrateur est **généré et affiché une seule fois dans la console**. Pour en choisir un :

```bash
npm run set-password
```

## Mode démonstration

Pour voir le site « en conditions réelles » avec un garage fictif (Garage des Tilleuls, à Villeurbanne), des rendez-vous passés et à venir et des conversations de support :

```bash
npm run demo
```

- Environ 50 rendez-vous et 6 demandes de support **fictifs** sont générés autour de la date du jour (clients et véhicules inventés, téléphones dans la plage 06 39 98 xx xx réservée par l’ARCEP à la fiction, e-mails en `@example.com`).
- Vos vrais rendez-vous, vos vraies demandes et vos réglages sont conservés ; relancer la commande remplace seulement les éléments de démonstration.
- Dans `/admin`, le tableau de bord affiche un bandeau « Mode démonstration » avec un bouton **Supprimer les données de démonstration**.
- Les informations du garage (nom, adresse, téléphone, e-mail, SIRET volontairement invalide, mentions légales), les tarifs et les horaires sont des **exemples** : modifiez-les dans `/admin` › « Horaires & infos » et « Tarifs & prestations ».

## Configuration

Copiez `.env.example` en `.env` et adaptez :

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `PORT` | Port du serveur | `3000` |
| `ADMIN_PASSWORD` | Mot de passe de `/admin` (prioritaire sur `npm run set-password`) | — |
| `DATA_DIR` | Dossier des données (rendez-vous, demandes, réglages) | `./data` |
| `GARAGE_TIMEZONE` | Fuseau horaire du garage | `Europe/Paris` |
| `TRUST_PROXY` | `1` si le site est derrière un reverse proxy / hébergeur avec HTTPS | `0` |

## Personnaliser le garage

Tout se fait depuis l’espace garage (`/admin`) :

- **Tarifs & prestations** : taux horaires (prix TTC, le HT est calculé), catégories et prestations (nom, description, prix, « à partir de », durée).
- **Horaires & infos** : horaires par jour (plusieurs plages possibles, par ex. fermeture le midi), fermetures exceptionnelles, réglages des rendez-vous (durée d’un créneau, nombre de véhicules par créneau, délai minimum, réservation jusqu’à N jours), jours fériés, nom, adresse, téléphone, e-mail, SIRET, bandeau d’information, FAQ.

Les valeurs fournies au départ (garage fictif, prix, horaires, coordonnées, responsable de la publication, hébergeur) sont des **exemples** : remplacez-les par les vôtres depuis `/admin`. Elles sont définies dans `src/defaults.js` et copiées dans `data/db.json` au premier démarrage.

## Mise en ligne

Le site est une application Node.js classique. Points importants :

1. Le dossier `data/` doit être **persistant** (disque conservé entre les redémarrages) et **sauvegardé régulièrement**. Une copie de la version précédente est conservée automatiquement (`db.json.bak`).
2. Servez le site en **HTTPS** et mettez `TRUST_PROXY=1` lorsque le HTTPS est géré par l’hébergeur ou un reverse proxy (Nginx, Caddy…).
3. Définissez `ADMIN_PASSWORD` (ou utilisez `npm run set-password` sur le serveur).

Exemple sur un VPS avec [pm2](https://pm2.keymetrics.io) :

```bash
npm ci --omit=dev
```

```bash
pm2 start server.js --name garage
```

Hébergeurs adaptés : un VPS (OVH, Scaleway…), ou une plateforme comme Render / Railway / Fly.io avec un volume persistant monté sur `DATA_DIR`.

## Développement

```bash
npm run dev
```

```bash
npm test
```

Structure :

```
server.js              démarrage du serveur
src/app.js             API (rendez-vous, support, administration)
src/schedule.js        horaires, jours fériés, créneaux disponibles
src/validate.js        validation des données
src/defaults.js        réglages par défaut (tarifs, horaires, FAQ…)
src/demo.js            données de démonstration (npm run demo)
src/store.js           enregistrement dans data/db.json
public/                pages du site (HTML, CSS, JavaScript sans framework)
test/                  tests automatisés (node --test)
```

Sécurité : en-têtes CSP stricts, cookie de session `HttpOnly` / `SameSite=Strict`, mot de passe haché (scrypt), limitation du nombre de requêtes, champ anti-robot sur les formulaires, aucune ressource externe (polices système, pas de traceur).
