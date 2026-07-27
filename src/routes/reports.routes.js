const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authRequired);

router.get('/stats', asyncHandler(async (req, res) => {
  const total = (await pool.query('SELECT COUNT(*)::int AS c FROM agents')).rows[0].c;
  const parStatut = (await pool.query(
    'SELECT statut, COUNT(*)::int AS total FROM agents GROUP BY statut'
  )).rows;
  const parDirection = (await pool.query(
    "SELECT COALESCE(direction, 'Non renseignée') AS direction, COUNT(*)::int AS total FROM agents GROUP BY direction ORDER BY total DESC"
  )).rows;
  const parContrat = (await pool.query(
    "SELECT COALESCE(type_contrat, 'Non renseigné') AS type_contrat, COUNT(*)::int AS total FROM agents GROUP BY type_contrat"
  )).rows;
  const parSexe = (await pool.query(
    "SELECT COALESCE(sexe, 'Non renseigné') AS sexe, COUNT(*)::int AS total FROM agents GROUP BY sexe"
  )).rows;
  const parCategorie = (await pool.query(
    "SELECT COALESCE(categorie, 'Non renseignée') AS categorie, COUNT(*)::int AS total FROM agents GROUP BY categorie ORDER BY total DESC"
  )).rows;

  res.json({ total, parStatut, parDirection, parContrat, parSexe, parCategorie });
}));

module.exports = router;
