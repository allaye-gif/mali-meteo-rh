const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { JWT_SECRET, authRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
  }
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
  const user = rows[0];
  if (!user || !user.actif) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
  }
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
  }
  const payload = { id: user.id, username: user.username, role: user.role, nom_complet: user.nom_complet, agent_id: user.agent_id || null };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '10h' });

  await pool.query('INSERT INTO journal_activite (user_id, action, details) VALUES ($1,$2,$3)',
    [user.id, 'CONNEXION', `Connexion de ${user.username}`]);

  res.json({ token, user: payload });
}));

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', authRequired, asyncHandler(async (req, res) => {
  const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body || {};
  if (!ancien_mot_de_passe || !nouveau_mot_de_passe) {
    return res.status(400).json({ error: 'Champs requis manquants.' });
  }
  if (nouveau_mot_de_passe.length < 4) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 4 caractères.' });
  }
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  if (!bcrypt.compareSync(ancien_mot_de_passe, user.password_hash)) {
    return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
  }
  const hash = bcrypt.hashSync(nouveau_mot_de_passe, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
  res.json({ ok: true });
}));

module.exports = router;
