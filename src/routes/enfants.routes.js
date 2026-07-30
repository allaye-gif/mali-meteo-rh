const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authRequired, roleRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired);

const DOC_DIR = path.join(__dirname, '..', '..', 'uploads', 'enfants');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOC_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `enfant_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
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
    'SELECT * FROM enfants WHERE agent_id = $1 ORDER BY date_naissance', [req.params.agentId]
  );
  res.json(rows);
}));

router.post('/agent/:agentId', roleRequired('admin', 'grh'), upload.single('acte_naissance'), asyncHandler(async (req, res) => {
  const agentId = Number(req.params.agentId);
  const { rows } = await pool.query('SELECT id FROM agents WHERE id = $1', [agentId]);
  if (!rows[0]) return res.status(404).json({ error: 'Agent introuvable.' });

  const b = req.body || {};
  if (!b.nom || !b.prenom) return res.status(400).json({ error: "Le nom et le prénom de l'enfant sont requis." });

  const chemin = req.file ? `/uploads/enfants/${req.file.filename}` : null;

  const insert = await pool.query(`
    INSERT INTO enfants (agent_id, nom, prenom, date_naissance, acte_naissance_path, remarques)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [agentId, b.nom.trim(), b.prenom.trim(), b.date_naissance || null, chemin, b.remarques || null]);

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'AJOUT_ENFANT', `Ajout de l'enfant ${b.nom} ${b.prenom} pour l'agent #${agentId}`]);

  res.status(201).json({ id: insert.rows[0].id });
}));

router.delete('/:id', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM enfants WHERE id = $1', [req.params.id]);
  const enfant = rows[0];
  if (!enfant) return res.status(404).json({ error: 'Enfant introuvable.' });
  if (enfant.acte_naissance_path) {
    const p = path.join(__dirname, '..', '..', enfant.acte_naissance_path);
    fs.existsSync(p) && fs.unlink(p, () => {});
  }
  await pool.query('DELETE FROM enfants WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
