const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'mali_meteo_rh',
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    });

pool.on('error', (err) => {
  console.error('Erreur inattendue du pool PostgreSQL :', err.message);
});

const HORODATAGE = `to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`;

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nom_complet TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','daf','grh','agent')),
      agent_id INTEGER,
      actif BOOLEAN NOT NULL DEFAULT true,
      date_creation TEXT NOT NULL DEFAULT ${HORODATAGE}
    );

    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      matricule TEXT UNIQUE NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      sexe TEXT CHECK (sexe IN ('M','F')),
      date_naissance TEXT,
      lieu_naissance TEXT,
      situation_matrimoniale TEXT,
      nombre_enfants INTEGER DEFAULT 0,
      adresse TEXT,
      telephone TEXT,
      email TEXT,
      fonction TEXT,
      direction TEXT,
      categorie TEXT,
      type_contrat TEXT,
      date_embauche TEXT,
      diplome TEXT,
      statut TEXT NOT NULL DEFAULT 'Actif',
      photo_path TEXT,
      date_creation TEXT NOT NULL DEFAULT ${HORODATAGE},
      date_modification TEXT,
      cree_par INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS affectations (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      service TEXT,
      fonction TEXT,
      date_debut TEXT NOT NULL,
      date_fin TEXT,
      motif TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      nom_document TEXT NOT NULL,
      type_document TEXT,
      chemin_fichier TEXT NOT NULL,
      date_ajout TEXT NOT NULL DEFAULT ${HORODATAGE}
    );

    CREATE TABLE IF NOT EXISTS journal_activite (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      date_action TEXT NOT NULL DEFAULT ${HORODATAGE}
    );

    CREATE TABLE IF NOT EXISTS enfants (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      date_naissance TEXT,
      acte_naissance_path TEXT,
      remarques TEXT,
      date_creation TEXT NOT NULL DEFAULT ${HORODATAGE}
    );

    CREATE TABLE IF NOT EXISTS carriere (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      type_evenement TEXT NOT NULL,
      grade TEXT,
      echelon TEXT,
      date_effet TEXT NOT NULL,
      reference_decision TEXT,
      observations TEXT,
      date_creation TEXT NOT NULL DEFAULT ${HORODATAGE}
    );

    CREATE TABLE IF NOT EXISTS conges (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      type_conge TEXT NOT NULL,
      date_debut TEXT NOT NULL,
      date_fin TEXT,
      nombre_jours INTEGER,
      motif TEXT,
      statut TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN ('Approuvé','En attente','Refusé')),
      date_creation TEXT NOT NULL DEFAULT ${HORODATAGE}
    );

    CREATE TABLE IF NOT EXISTS diplomes (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      intitule TEXT NOT NULL,
      etablissement TEXT,
      annee_obtention TEXT,
      type_diplome TEXT,
      fichier_path TEXT,
      date_creation TEXT NOT NULL DEFAULT ${HORODATAGE}
    );
  `);

  // ---------------------------------------------------------
  // Migrations idempotentes (tables deja existantes avant l'ajout
  // du champ "service" et du role "agent" -- ADD COLUMN IF NOT
  // EXISTS ne fait rien si la colonne est deja presente).
  // ---------------------------------------------------------
  await pool.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS service TEXT`);
  await pool.query(`ALTER TABLE affectations ADD COLUMN IF NOT EXISTS service TEXT`);
  await pool.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS bureau TEXT`);
  await pool.query(`ALTER TABLE affectations ADD COLUMN IF NOT EXISTS bureau TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_id INTEGER`);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_agent_id_fkey'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_agent_id_fkey
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  // Le role "agent" (employe consultant sa propre fiche) a ete ajoute apres
  // coup : la contrainte CHECK d'origine sur une base deja initialisee ne le
  // connait pas encore, on la remplace.
  await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','daf','grh','agent'))`);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (rows[0].c === 0) {
    const insert = `INSERT INTO users (username, password_hash, nom_complet, role) VALUES ($1,$2,$3,$4)`;
    await pool.query(insert, ['admin', bcrypt.hashSync('admin123', 10), 'Administrateur Système', 'admin']);
    await pool.query(insert, ['daf', bcrypt.hashSync('daf123', 10), 'Agent DAF', 'daf']);
    await pool.query(insert, ['grh', bcrypt.hashSync('grh123', 10), 'Agent GRH', 'grh']);
    console.log('>> Comptes par défaut créés : admin/admin123, daf/daf123, grh/grh123');
  }
}

module.exports = { pool, init };
