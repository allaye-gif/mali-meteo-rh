const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mali-meteo-rh-secret-dev-key-change-me';

function authRequired(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé : droits insuffisants.' });
    }
    next();
  };
}

module.exports = { authRequired, roleRequired, JWT_SECRET };
