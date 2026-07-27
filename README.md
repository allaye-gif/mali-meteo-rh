# Mali-Météo — Application de Gestion du Personnel

Application web complète (back-end + front-end) pour la gestion du personnel de
Mali-Météo, avec trois niveaux d'utilisateurs : **Administrateur**, **DAF** et **GRH**.

---

## 🚀 Démarrage rapide sous Windows (recommandé)

**Double-cliquez sur `start.bat`** — c'est tout ce qu'il y a à faire.

Le script :
1. Vérifie si **Node.js** est installé ; sinon, l'installe automatiquement
   (via `winget` si disponible, sinon téléchargement direct).
2. Vous demande votre utilisateur/mot de passe PostgreSQL souhaité (une seule
   fois — réutilisés ensuite automatiquement).
3. Vérifie si **PostgreSQL** est installé ; sinon, tente de l'installer
   automatiquement (via `winget`). Si une fenêtre d'installation PostgreSQL
   s'ouvre, suivez les étapes en utilisant le mot de passe que vous venez de
   saisir.
4. Crée la base de données de l'application si elle n'existe pas encore.
5. Installe toutes les dépendances et démarre l'application, puis ouvre
   votre navigateur sur `http://localhost:3000`.

**Astuce :** pour que l'installation automatique de logiciels fonctionne au
mieux, faites un clic droit sur `start.bat` → *Exécuter en tant
qu'administrateur*. Sans droits administrateur, le script fonctionne quand
même, mais l'installation automatique de Node.js/PostgreSQL peut échouer
(dans ce cas, le script ouvre la page de téléchargement officielle pour une
installation manuelle guidée).

Pour l'arrêter : fermez la fenêtre noire intitulée "Serveur".

Si quelque chose ne fonctionne pas, l'erreur exacte s'affiche dans la fenêtre —
copiez-la et envoyez-la pour obtenir de l'aide.

Le reste de ce document explique l'installation manuelle (macOS/Linux, ou pour
comprendre ce que `start.bat` fait automatiquement).

---

## 1. Prérequis

- [Node.js](https://nodejs.org) version 18 ou supérieure (testé avec Node 22).
- **PostgreSQL** version 13 ou supérieure. Deux options :
  - **Option A — Docker (le plus simple)** : un fichier `docker-compose.yml` est fourni.
  - **Option B — PostgreSQL installé localement** (ou un service cloud comme Neon, Supabase, Render, AWS RDS...).

## 2. Démarrer PostgreSQL

### Option A : avec Docker
```bash
docker compose up -d
```
Cela démarre un PostgreSQL sur `localhost:5432` avec la base `mali_meteo_rh` déjà créée
(utilisateur `postgres`, mot de passe `postgres` — voir `docker-compose.yml`).

### Option B : PostgreSQL déjà installé
Créez simplement la base de données :
```bash
createdb mali_meteo_rh
# ou : psql -U postgres -c "CREATE DATABASE mali_meteo_rh;"
```

### Option C : base de données cloud
Renseignez `DATABASE_URL` dans le fichier `.env` (voir plus bas) avec la chaîne de
connexion fournie par votre hébergeur.

## 3. Configuration

Un fichier `.env` est déjà fourni avec des valeurs par défaut fonctionnant avec
l'option Docker ci-dessus :
```
PORT=3000
JWT_SECRET=...
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=mali_meteo_rh
```
Si vous utilisez un hébergeur cloud, remplacez ces lignes par une seule variable :
```
DATABASE_URL=postgres://utilisateur:motdepasse@hote:5432/nom_base
PGSSL=true
```

## 4. Installation

```bash
npm install
```

## 5. Démarrage

```bash
npm start
```

Le serveur démarre sur **http://localhost:3000** et crée automatiquement les tables
nécessaires dans PostgreSQL au premier lancement (aucune migration manuelle requise).

## 6. Comptes de démonstration

Au tout premier démarrage, la base de données est peuplée automatiquement avec
trois comptes :

| Rôle          | Identifiant | Mot de passe |
|---------------|-------------|--------------|
| Administrateur| `admin`     | `admin123`   |
| DAF           | `daf`       | `daf123`     |
| GRH           | `grh`       | `grh123`     |

**⚠️ Changez ces mots de passe dès la mise en production** (menu *Changer mon
mot de passe*, ou en modifiant les utilisateurs depuis l'espace Administrateur).

## 7. Fonctionnalités par rôle

### 👤 Administrateur
- Authentification sécurisée (mots de passe hachés, session par jeton JWT).
- Gestion complète des utilisateurs : créer, modifier, désactiver, supprimer,
  attribuer les rôles (Administrateur, DAF, GRH).
- Accès à l'ensemble des fonctionnalités de l'application (personnel, rapports).
- Sauvegarde de la base de données (téléchargement d'une archive `.zip`).
- Restauration de la base de données à partir d'une sauvegarde.
- Consultation du journal d'activité (traçabilité des actions).

### 👤 DAF (accès en lecture seule)
- Consulter la liste du personnel.
- Rechercher un agent (nom, prénom, matricule, fonction).
- Consulter la fiche détaillée d'un agent.
- Imprimer la fiche d'un agent ou la liste complète du personnel.
- **Ne peut ni ajouter, ni modifier, ni supprimer** d'informations (les boutons
  correspondants sont automatiquement masqués et l'API refuse ces actions
  même en cas de tentative directe).

### 👤 GRH
- Ajouter, modifier, supprimer un agent.
- Consulter et rechercher le personnel.
- Gérer les affectations : tout changement de direction/service est historisé
  automatiquement (historique visible sur la fiche de l'agent).
- Gérer les documents administratifs de chaque agent (contrat, diplôme,
  pièce d'identité, etc.).
- Imprimer les fiches et la liste du personnel.
- Générer et imprimer des rapports statistiques (effectifs par direction,
  type de contrat, statut, catégorie professionnelle).

## 8. Sécurité mise en œuvre

- Mots de passe stockés uniquement sous forme de hachage `bcrypt`.
- Authentification par jeton JWT (expiration automatique après 10 h).
- Contrôle des droits **côté serveur** pour chaque route de l'API (le
  masquage des boutons côté interface n'est qu'un confort visuel : la
  véritable protection est faite dans le back-end).
- Requêtes SQL entièrement paramétrées (`$1, $2, ...`) contre les injections SQL.
- Journal d'activité enregistrant les actions sensibles (connexions,
  créations/modifications/suppressions, sauvegardes, restaurations).

## 9. Structure du projet

```
mali-meteo-rh/
├── server.js                  Point d'entrée du serveur
├── docker-compose.yml         PostgreSQL prêt à l'emploi (optionnel)
├── src/
│   ├── db.js                  Connexion PostgreSQL (pool) + schéma
│   ├── middleware/auth.js     Authentification JWT + contrôle des rôles
│   ├── middleware/asyncHandler.js  Gestion des erreurs asynchrones
│   └── routes/                Routes de l'API (auth, users, agents, documents,
│                               reports, backup)
├── public/                    Front-end (HTML / CSS / JS, aucun framework requis)
│   ├── index.html
│   ├── css/style.css
│   └── js/ (api.js, ui.js, vues.js, app.js)
└── uploads/                   Photos et documents administratifs des agents
```

## 10. Sauvegarde et restauration

- **Sauvegarde** : menu *Paramètres* (Administrateur uniquement) → *Télécharger
  une sauvegarde*. Une archive `.zip` horodatée est téléchargée, contenant :
  - `database.json` (toutes les tables : utilisateurs, agents, affectations, documents, journal) ;
  - le dossier `uploads/` (photos et pièces jointes).

  Conservez cette archive en lieu sûr (clé USB, cloud, etc.).
- **Restauration** : menu *Paramètres* → sélectionnez une archive `.zip` générée
  par l'application et cliquez sur *Restaurer*. **Attention : cette opération
  remplace toutes les données et fichiers actuels.**
- Pour les administrateurs systèmes qui préfèrent les outils natifs PostgreSQL,
  `pg_dump`/`pg_restore` fonctionnent aussi directement sur la base
  `mali_meteo_rh` (les fichiers uploadés restent alors à sauvegarder séparément
  via le dossier `uploads/`).

## 11. Déploiement

Cette application est prête à être utilisée en local. Pour un déploiement sur
un serveur (intranet Mali-Météo ou hébergement cloud), il est recommandé de :
1. Utiliser une base PostgreSQL managée ou dédiée (pas la base de démonstration Docker).
2. Définir une variable d'environnement `JWT_SECRET` forte (fichier `.env`).
3. Utiliser un gestionnaire de processus comme `pm2` pour garder le serveur actif.
4. Mettre le trafic derrière HTTPS (reverse proxy Nginx/Apache, ou un service
   gérant automatiquement les certificats).
5. Planifier des sauvegardes régulières (archive `.zip` intégrée, et/ou `pg_dump`).

---
Application développée sur mesure pour la Direction Générale de Mali-Météo.
