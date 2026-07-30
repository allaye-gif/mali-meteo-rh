const express = require('express');
const { pool } = require('../db');
const { authRequired, roleRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired);

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
    'SELECT * FROM conges WHERE agent_id = $1 ORDER BY date_debut DESC', [req.params.agentId]
  );
  res.json(rows);
}));

router.post('/agent/:agentId', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const agentId = Number(req.params.agentId);
  const { rows } = await pool.query('SELECT id FROM agents WHERE id = $1', [agentId]);
  if (!rows[0]) return res.status(404).json({ error: 'Agent introuvable.' });

  const b = req.body || {};
  if (!b.type_conge || !b.date_debut) {
    return res.status(400).json({ error: 'Le type de congé et la date de début sont requis.' });
  }

  const insert = await pool.query(`
    INSERT INTO conges (agent_id, type_conge, date_debut, date_fin, nombre_jours, motif, statut)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [agentId, b.type_conge, b.date_debut, b.date_fin || null,
      b.nombre_jours ? Number(b.nombre_jours) : null, b.motif || null, b.statut || 'En attente']);

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'AJOUT_CONGE', `Ajout d'un congé (${b.type_conge}) pour l'agent #${agentId}`]);

  res.status(201).json({ id: insert.rows[0].id });
}));

router.put('/:id', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM conges WHERE id = $1', [req.params.id]);
  const conge = rows[0];
  if (!conge) return res.status(404).json({ error: 'Congé introuvable.' });
  const statut = (req.body || {}).statut;
  if (!['Approuvé', 'En attente', 'Refusé'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }
  await pool.query('UPDATE conges SET statut = $1 WHERE id = $2', [statut, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/:id', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id FROM conges WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Congé introuvable.' });
  await pool.query('DELETE FROM conges WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
