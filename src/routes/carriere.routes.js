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
    'SELECT * FROM carriere WHERE agent_id = $1 ORDER BY date_effet DESC', [req.params.agentId]
  );
  res.json(rows);
}));

router.post('/agent/:agentId', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const agentId = Number(req.params.agentId);
  const { rows } = await pool.query('SELECT id FROM agents WHERE id = $1', [agentId]);
  if (!rows[0]) return res.status(404).json({ error: 'Agent introuvable.' });

  const b = req.body || {};
  if (!b.type_evenement || !b.date_effet) {
    return res.status(400).json({ error: "Le type d'événement et la date d'effet sont requis." });
  }

  const insert = await pool.query(`
    INSERT INTO carriere (agent_id, type_evenement, grade, echelon, date_effet, reference_decision, observations)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
  `, [agentId, b.type_evenement, b.grade || null, b.echelon || null, b.date_effet,
      b.reference_decision || null, b.observations || null]);

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'AJOUT_CARRIERE', `Ajout d'un événement de carrière (${b.type_evenement}) pour l'agent #${agentId}`]);

  res.status(201).json({ id: insert.rows[0].id });
}));

router.delete('/:id', roleRequired('admin', 'grh'), asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id FROM carriere WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Événement introuvable.' });
  await pool.query('DELETE FROM carriere WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
