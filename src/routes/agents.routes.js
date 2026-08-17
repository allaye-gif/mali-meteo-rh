const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authRequired, roleRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired);

const PHOTO_DIR = path.join(__dirname, '..', '..', 'uploads', 'photos');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `agent_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Fichier image requis.'));
    cb(null, true);
  }
});

async function genererMatricule() {
  const annee = new Date().getFullYear();
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS c FROM agents WHERE matricule LIKE $1",
    [`MM-${annee}-%`]
  );
  const num = String(rows[0].c + 1).padStart(4, '0');
  return `MM-${annee}-${num}`;
}

// Liste + recherche (rôles admin/daf/grh -- un compte "agent" ne doit voir
// que sa propre fiche, jamais parcourir tout le personnel).
router.get('/', roleRequired('admin', 'daf', 'grh'), asyncHandler(async (req, res) => {
  const { q, direction, statut, type_contrat } = req.query;
  let sql = 'SELECT * FROM agents WHERE 1=1';
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    sql += ` AND (nom ILIKE $${i} OR prenom ILIKE $${i} OR matricule ILIKE $${i} OR fonction ILIKE $${i})`;
  }
  if (direction) { params.push(direction); sql += ` AND direction = $${params.length}`; }
  if (statut) { params.push(statut); sql += ` AND statut = $${params.length}`; }
  if (type_contrat) { params.push(type_contrat); sql += ` AND type_contrat = $${params.length}`; }
  sql += ' ORDER BY nom, prenom';
  const { rows } = await pool.query(sql, params);
  res.json(rows);
}));

// Fiche du compte "agent" connecté (doit être déclarée avant /:id, sinon
// Express interprète "me" comme une valeur du paramètre :id).
router.get('/me', asyncHandler(async (req, res) => {
  if (!req.user.agent_id) return res.status(404).json({ error: "Aucune fiche n'est liée à ce compte." });
  const { rows } = await pool.query('SELECT * FROM agents WHERE id = $1', [req.user.agent_id]);
  if (!rows[0]) return res.status(404).json({ error: 'Fiche introuvable.' });
  res.json(rows[0]);
}));

function verifierAccesFiche(req, res, agentId) {
  if (req.user.role === 'agent' && Number(req.user.agent_id) !== Number(agentId)) {
    res.status(403).json({ error: 'Accès refusé : vous ne pouvez consulter que votre propre fiche.' });
    return false;
  }
  return true;
}

router.get('/:id', asyncHandler(async (req, res) => {
  if (!verifierAccesFiche(req, res, req.params.id)) return;
  const { rows } = await pool.query('SELECT * FROM agents WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Agent introuvable.' });
  res.json(rows[0]);
}));

// Création (GRH, admin)
router.post('/', roleRequired('admin', 'grh'), upload.single('photo'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.nom || !b.prenom) {
    return res.status(400).json({ error: 'Le nom et le prénom sont requis.' });
  }
  const matricule = (b.matricule && b.matricule.trim()) || await genererMatricule();
  const exists = await pool.query('SELECT id FROM agents WHERE matricule = $1', [matricule]);
  if (exists.rows.length) return res.status(409).json({ error: 'Ce matricule existe déjà.' });

  const photo_path = req.file ? `/uploads/photos/${req.file.filename}` : null;

  const { rows } = await pool.query(`
    INSERT INTO agents (
      matricule, nom, prenom, sexe, date_naissance, lieu_naissance,
      situation_matrimoniale, nombre_enfants, adresse, telephone, email,
      fonction, direction, service, bureau, categorie, type_contrat, date_embauche, diplome,
      statut, photo_path, cree_par
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
    RETURNING id
  `, [
    matricule, b.nom.trim(), b.prenom.trim(), b.sexe || null, b.date_naissance || null,
    b.lieu_naissance || null, b.situation_matrimoniale || null, Number(b.nombre_enfants || 0),
    b.adresse || null, b.telephone || null, b.email || null, b.fonction || null,
    b.direction || null, b.service || null, b.bureau || null, b.categorie || null, b.type_contrat || null,
    b.date_embauche || null, b.diplome || null, b.statut || 'Actif', photo_path, req.user.id
  ]);
  const nouvelId = rows[0].id;

  if (b.direction) {
    await pool.query(`
      INSERT INTO affectations (agent_id, direction, service, bureau, fonction, date_debut, motif)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [nouvelId, b.direction, b.service || null, b.bureau || null, b.fonction || null,
        b.date_embauche || new Date().toISOString().slice(0, 10), 'Affectation initiale']);
  }

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'CREATION_AGENT', `Création de l'agent ${matricule} - ${b.nom} ${b.prenom}`]);

  res.status(201).json({ id: nouvelId, matricule });
}));

// Modification (GRH, admin)
router.put('/:id', roleRequired('admin', 'grh'), upload.single('photo'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT * FROM agents WHERE id = $1', [id]);
  const agent = rows[0];
  if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });

  const b = req.body || {};
  let photo_path = agent.photo_path;
  if (req.file) {
    if (agent.photo_path) {
      const old = path.join(__dirname, '..', '..', agent.photo_path);
      fs.existsSync(old) && fs.unlink(old, () => {});
    }
    photo_path = `/uploads/photos/${req.file.filename}`;
  }

  const nouvelleDirection = b.direction ?? agent.direction;
  const nouveauService = b.service ?? agent.service;
  const nouveauBureau = b.bureau ?? agent.bureau;
  const changementAffectation = (nouvelleDirection !== agent.direction) || (nouveauService !== agent.service) || (nouveauBureau !== agent.bureau);

  await pool.query(`
    UPDATE agents SET
      nom=$1, prenom=$2, sexe=$3, date_naissance=$4, lieu_naissance=$5,
      situation_matrimoniale=$6, nombre_enfants=$7, adresse=$8, telephone=$9, email=$10,
      fonction=$11, direction=$12, service=$13, bureau=$14, categorie=$15, type_contrat=$16, date_embauche=$17, diplome=$18,
      statut=$19, photo_path=$20, date_modification=to_char(now(),'YYYY-MM-DD HH24:MI:SS')
    WHERE id=$21
  `, [
    b.nom ?? agent.nom, b.prenom ?? agent.prenom, b.sexe ?? agent.sexe,
    b.date_naissance ?? agent.date_naissance, b.lieu_naissance ?? agent.lieu_naissance,
    b.situation_matrimoniale ?? agent.situation_matrimoniale,
    Number(b.nombre_enfants ?? agent.nombre_enfants ?? 0),
    b.adresse ?? agent.adresse, b.telephone ?? agent.telephone, b.email ?? agent.email,
    b.fonction ?? agent.fonction, nouvelleDirection, nouveauService, nouveauBureau, b.categorie ?? agent.categorie,
    b.type_contrat ?? agent.type_contrat, b.date_embauche ?? agent.date_embauche,
    b.diplome ?? agent.diplome, b.statut ?? agent.statut, photo_path, id
  ]);

  if (changementAffectation && nouvelleDirection) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    await pool.query(`UPDATE affectations SET date_fin = $1 WHERE agent_id = $2 AND date_fin IS NULL`, [aujourdhui, id]);
    await pool.query(`
      INSERT INTO affectations (agent_id, direction, service, bureau, fonction, date_debut, motif)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [id, nouvelleDirection, nouveauService, nouveauBureau, b.fonction || agent.fonction, aujourdhui, "Changement d'affectation"]);
  }

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'MODIFICATION_AGENT', `Modification de l'agent #${id}`]);

  res.json({ ok: true });
}));

// Suppression (GRH, admin)
router.delete('/:id', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT * FROM agents WHERE id = $1', [id]);
  const agent = rows[0];
  if (!agent) return res.status(404).json({ error: 'Agent introuvable.' });

  if (agent.photo_path) {
    const p = path.join(__dirname, '..', '..', agent.photo_path);
    fs.existsSync(p) && fs.unlink(p, () => {});
  }
  await pool.query('DELETE FROM agents WHERE id = $1', [id]);

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'SUPPRESSION_AGENT', `Suppression de l'agent ${agent.matricule} - ${agent.nom} ${agent.prenom}`]);

  res.json({ ok: true });
}));

// Historique des affectations
router.get('/:id/affectations', asyncHandler(async (req, res) => {
  if (!verifierAccesFiche(req, res, req.params.id)) return;
  const { rows } = await pool.query(
    'SELECT * FROM affectations WHERE agent_id = $1 ORDER BY date_debut DESC', [req.params.id]
  );
  res.json(rows);
}));

module.exports = router;
