const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authRequired, roleRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired, roleRequired('admin'));

const ROLES_VALIDES = ['admin', 'daf', 'grh', 'agent'];

router.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.username, u.nom_complet, u.role, u.actif, u.date_creation, u.agent_id,
           a.nom AS agent_nom, a.prenom AS agent_prenom, a.matricule AS agent_matricule
    FROM users u
    LEFT JOIN agents a ON a.id = u.agent_id
    ORDER BY u.id
  `);
  res.json(rows);
}));

async function verifierAgentLiaison(agentId, userIdActuel) {
  if (!agentId) return 'Une fiche agent doit être sélectionnée pour un compte de rôle "Agent".';
  const agent = await pool.query('SELECT id FROM agents WHERE id = $1', [agentId]);
  if (!agent.rows.length) return 'Fiche agent introuvable.';
  const dejaLie = await pool.query(
    'SELECT id FROM users WHERE agent_id = $1 AND id != $2', [agentId, userIdActuel || 0]
  );
  if (dejaLie.rows.length) return 'Cette fiche agent est déjà liée à un autre compte.';
  return null;
}

router.post('/', asyncHandler(async (req, res) => {
  const { username, password, nom_complet, role, agent_id } = req.body || {};
  if (!username || !password || !nom_complet || !role) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }
  if (!ROLES_VALIDES.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide.' });
  }
  let agentIdFinal = null;
  if (role === 'agent') {
    const erreur = await verifierAgentLiaison(agent_id);
    if (erreur) return res.status(400).json({ error: erreur });
    agentIdFinal = Number(agent_id);
  }
  const exists = await pool.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
  if (exists.rows.length) return res.status(409).json({ error: 'Cet identifiant existe déjà.' });

  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (username, password_hash, nom_complet, role, agent_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [username.trim(), hash, nom_complet.trim(), role, agentIdFinal]
  );

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'CREATION_UTILISATEUR', `Création de l'utilisateur ${username}`]);

  res.status(201).json({ id: rows[0].id });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  const target = rows[0];
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const { nom_complet, role, actif, password, agent_id } = req.body || {};
  if (role && !ROLES_VALIDES.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide.' });
  }
  if (target.role === 'admin' && target.username === 'admin' && (role && role !== 'admin')) {
    return res.status(400).json({ error: "Impossible de changer le rôle de l'administrateur principal." });
  }

  const roleFinal = role || target.role;
  let agentIdFinal = target.agent_id;
  if (roleFinal === 'agent') {
    const nouvelAgentId = agent_id !== undefined ? agent_id : target.agent_id;
    const erreur = await verifierAgentLiaison(nouvelAgentId, id);
    if (erreur) return res.status(400).json({ error: erreur });
    agentIdFinal = Number(nouvelAgentId);
  } else if (role) {
    // Le compte quitte le role "agent" (ou n'en a jamais fait partie) : pas de liaison.
    agentIdFinal = null;
  }

  await pool.query(`
    UPDATE users SET
      nom_complet = COALESCE($1, nom_complet),
      role = COALESCE($2, role),
      actif = COALESCE($3, actif),
      agent_id = $4
    WHERE id = $5
  `, [nom_complet ?? null, role ?? null, actif === undefined ? null : !!actif, agentIdFinal, id]);

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
  }

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'MODIFICATION_UTILISATEUR', `Modification de l'utilisateur #${id}`]);

  res.json({ ok: true });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  const target = rows[0];
  if (!target) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (target.username === 'admin') {
    return res.status(400).json({ error: "Impossible de supprimer l'administrateur principal." });
  }
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }
  await pool.query('DELETE FROM users WHERE id = $1', [id]);

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [req.user.id, 'SUPPRESSION_UTILISATEUR', `Suppression de l'utilisateur #${id}`]);

  res.json({ ok: true });
}));

module.exports = router;
