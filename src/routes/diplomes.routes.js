const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authRequired, roleRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired);

const DOC_DIR = path.join(__dirname, '..', '..', 'uploads', 'diplomes');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOC_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `diplome_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function verifierAcces(req, res, agentId) {
  if (req.user.role === 'agent' && Number(req.user.agent_id) !== Number(agentId)) {
    res.status(403).json({ error: 'Accès refusé : vous ne pouvez consulter que votre propre fiche.' });
    return false;
  }
  return true;
}

router.get('/agent/:agentId', asyncHandler(async (req, res) => {
  if (!verifierAcces(req, res, req.params.agentId)) return;
  const { rows } = await pool.query(
    'SELECT * FROM diplomes WHERE agent_id = $1 ORDER BY annee_obtention DESC NULLS LAST', [req.params.agentId]
  );
  res.json(rows);
}));

router.post('/agent/:agentId', roleRequired('admin', 'grh'), upload.single('fichier'), asyncHandler(async (req, res) => {
  const agentId = Number(req.params.agentId);
  const { rows } = await pool.query('SELECT id FROM agents WHERE id = $1', [agentId]);
  if (!rows[0]) return res.status(404).json({ error: 'Agent introuvable.' });

  const b = req.body || {};
  if (!b.intitule) return res.status(400).json({ error: "L'intitulé du diplôme/attestation est requis." });

  const chemin = req.file ? `/uploads/diplomes/${req.file.filename}` : null;

  const insert = await pool.query(`
    INSERT INTO diplomes (agent_id, intitule, etablissement, annee_obtention, type_diplome, fichier_path)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [agentId, b.intitule.trim(), b.etablissement || null, b.annee_obtention || null,
      b.type_diplome || 'Diplôme', chemin]);

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'AJOUT_DIPLOME', `Ajout du diplôme "${b.intitule}" pour l'agent #${agentId}`]);

  res.status(201).json({ id: insert.rows[0].id });
}));

router.delete('/:id', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM diplomes WHERE id = $1', [req.params.id]);
  const diplome = rows[0];
  if (!diplome) return res.status(404).json({ error: 'Diplôme introuvable.' });
  if (diplome.fichier_path) {
    const p = path.join(__dirname, '..', '..', diplome.fichier_path);
    fs.existsSync(p) && fs.unlink(p, () => {});
  }
  await pool.query('DELETE FROM diplomes WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
