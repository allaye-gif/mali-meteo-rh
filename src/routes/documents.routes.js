const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const { authRequired, roleRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired);

const DOC_DIR = path.join(__dirname, '..', '..', 'uploads', 'documents');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DOC_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `doc_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/agent/:agentId', asyncHandler(async (req, res) => {
  if (req.user.role === 'agent' && Number(req.user.agent_id) !== Number(req.params.agentId)) {
    return res.status(403).json({ error: 'Accès refusé : vous ne pouvez consulter que vos propres documents.' });
  }
  const { rows } = await pool.query(
    'SELECT * FROM documents WHERE agent_id = $1 ORDER BY date_ajout DESC', [req.params.agentId]
  );
  res.json(rows);
}));

router.post('/agent/:agentId', roleRequired('admin', 'grh'), upload.single('fichier'), asyncHandler(async (req, res) => {
  const agentId = Number(req.params.agentId);
  const { rows } = await pool.query('SELECT id FROM agents WHERE id = $1', [agentId]);
  if (!rows[0]) return res.status(404).json({ error: 'Agent introuvable.' });
  if (!req.file) return res.status(400).json({ error: 'Fichier requis.' });

  const nom_document = req.body.nom_document || req.file.originalname;
  const type_document = req.body.type_document || 'Autre';
  const chemin = `/uploads/documents/${req.file.filename}`;

  const insert = await pool.query(`
    INSERT INTO documents (agent_id, nom_document, type_document, chemin_fichier)
    VALUES ($1,$2,$3,$4) RETURNING id
  `, [agentId, nom_document, type_document, chemin]);

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'AJOUT_DOCUMENT', `Ajout du document "${nom_document}" pour l'agent #${agentId}`]);

  res.status(201).json({ id: insert.rows[0].id, chemin_fichier: chemin });
}));

router.delete('/:id', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
  const p = path.join(__dirname, '..', '..', doc.chemin_fichier);
  fs.existsSync(p) && fs.unlink(p, () => {});
  await pool.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
