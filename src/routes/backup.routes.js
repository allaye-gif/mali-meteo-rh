const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const { pool } = require('../db');
const { authRequired, roleRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired, roleRequired('admin'));

const upload = multer({ dest: os.tmpdir() });
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ordre important : respecte les dépendances de clés étrangères à la restauration
const TABLES = {
  users: ['id', 'username', 'password_hash', 'nom_complet', 'role', 'actif', 'date_creation'],
  agents: ['id', 'matricule', 'nom', 'prenom', 'sexe', 'date_naissance', 'lieu_naissance',
    'situation_matrimoniale', 'nombre_enfants', 'adresse', 'telephone', 'email', 'fonction',
    'direction', 'service', 'bureau', 'categorie', 'type_contrat', 'date_embauche', 'diplome', 'statut', 'photo_path',
    'date_creation', 'date_modification', 'cree_par'],
  affectations: ['id', 'agent_id', 'direction', 'service', 'bureau', 'fonction', 'date_debut', 'date_fin', 'motif'],
  documents: ['id', 'agent_id', 'nom_document', 'type_document', 'chemin_fichier', 'date_ajout'],
  journal_activite: ['id', 'user_id', 'action', 'details', 'date_action'],
};

// ---------------- Export : télécharger une sauvegarde .zip (données + fichiers) ----------------
router.get('/export', async (req, res) => {
  try {
    const dump = {};
    for (const table of Object.keys(TABLES)) {
      const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
      dump[table] = rows;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mali_meteo_rh_sauvegarde_${stamp}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => { throw err; });
    archive.pipe(res);
    archive.append(JSON.stringify(dump, null, 2), { name: 'database.json' });
    if (fs.existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'uploads');
    await archive.finalize();

    await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
      [req.user.id, 'SAUVEGARDE', `Export de la base de données (${filename})`]);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur lors de la génération de la sauvegarde.' });
  }
});

// ---------------- Restauration : importer une sauvegarde .zip précédente ----------------
router.post('/restore', upload.single('fichier'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier de sauvegarde requis (.zip).' });
  const client = await pool.connect();
  try {
    const zip = new AdmZip(req.file.path);
    const entry = zip.getEntry('database.json');
    if (!entry) throw new Error('Le fichier fourni ne contient pas de database.json valide.');
    const dump = JSON.parse(zip.readAsText(entry));
    for (const table of Object.keys(TABLES)) {
      if (!Array.isArray(dump[table])) throw new Error(`Table "${table}" manquante dans la sauvegarde.`);
    }

    await client.query('BEGIN');
    // Suppression dans l'ordre inverse des dépendances
    await client.query('DELETE FROM documents');
    await client.query('DELETE FROM affectations');
    await client.query('DELETE FROM journal_activite');
    await client.query('DELETE FROM agents');
    await client.query('DELETE FROM users');

    for (const [table, colonnes] of Object.entries(TABLES)) {
      for (const ligne of dump[table]) {
        const placeholders = colonnes.map((_, i) => `$${i + 1}`).join(',');
        await client.query(
          `INSERT INTO ${table} (${colonnes.join(',')}) VALUES (${placeholders})`,
          colonnes.map((c) => ligne[c] ?? null)
        );
      }
      // Recale la séquence SERIAL sur le plus grand id restauré
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1,'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
        [table]
      );
    }

    await client.query('COMMIT');

    // Restauration des fichiers (photos / documents)
    for (const dossier of ['photos', 'documents']) {
      const cible = path.join(UPLOADS_DIR, dossier);
      fs.rmSync(cible, { recursive: true, force: true });
      fs.mkdirSync(cible, { recursive: true });
    }
    zip.getEntries()
      .filter((e) => e.entryName.startsWith('uploads/') && !e.isDirectory)
      .forEach((e) => {
        const dest = path.join(UPLOADS_DIR, e.entryName.replace(/^uploads\//, ''));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, e.getData());
      });

    fs.unlink(req.file.path, () => {});

    await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
      [req.user.id, 'RESTAURATION', 'Restauration de la base de données depuis une sauvegarde']);

    res.json({ ok: true, message: 'Base de données restaurée avec succès. Veuillez vous reconnecter.' });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    fs.existsSync(req.file.path) && fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: `Échec de la restauration : ${e.message}` });
  } finally {
    client.release();
  }
});

// ---------------- Journal d'activité ----------------
router.get('/journal', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT j.*, u.username FROM journal_activite j
    LEFT JOIN users u ON u.id = j.user_id
    ORDER BY j.date_action DESC LIMIT 200
  `);
  res.json(rows);
}));

module.exports = router;
