require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { init } = require('./src/db');

const authRoutes = require('./src/routes/auth.routes');
const usersRoutes = require('./src/routes/users.routes');
const agentsRoutes = require('./src/routes/agents.routes');
const documentsRoutes = require('./src/routes/documents.routes');
const reportsRoutes = require('./src/routes/reports.routes');
const backupRoutes = require('./src/routes/backup.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dossiers de fichiers (photos, documents)
const uploadsDir = path.join(__dirname, 'uploads');
['photos', 'documents'].forEach(d => {
  const p = path.join(uploadsDir, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});
app.use('/uploads', express.static(uploadsDir));

// API
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/backup', backupRoutes);

// Frontend statique
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route API introuvable.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gestion des erreurs (ex : multer)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erreur serveur.' });
});

async function main() {
  try {
    await init();
    app.listen(PORT, () => {
      console.log(`Mali-Météo RH démarré sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Échec du démarrage : impossible de se connecter à PostgreSQL.');
    console.error(err.message);
    process.exit(1);
  }
}

main();
