'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

// Charge le fichier .env s'il existe (Node.js >= 20.12)
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  /* pas de fichier .env : on utilise les variables d'environnement */
}

const { createApp } = require('./src/app');
const { hashPassword } = require('./src/store');

const port = Number(process.env.PORT) || 3000;
const dataDir = path.resolve(__dirname, process.env.DATA_DIR || 'data');

const app = createApp({
  dataDir,
  adminPassword: process.env.ADMIN_PASSWORD || null,
  timeZone: process.env.GARAGE_TIMEZONE || 'Europe/Paris',
  trustProxy: process.env.TRUST_PROXY === '1',
});

// « npm run demo » : remplit le site avec des rendez-vous et demandes fictifs
if (process.argv.includes('--demo')) {
  const { seedDemo } = require('./src/demo');
  const n = seedDemo(app.locals.store, { timeZone: process.env.GARAGE_TIMEZONE || 'Europe/Paris' });
  console.log(`Données de démonstration générées : ${n.appointments} rendez-vous, ${n.tickets} demandes de support.`);
  console.log('Elles peuvent être supprimées en un clic depuis /admin (Tableau de bord).');
}

// Premier démarrage sans ADMIN_PASSWORD : on génère un mot de passe et on l'affiche une seule fois.
const store = app.locals.store;
if (!process.env.ADMIN_PASSWORD && !store.readAuth().passwordHash) {
  const password = crypto.randomBytes(9).toString('base64url');
  store.writeAuth({ passwordHash: hashPassword(password), createdAt: new Date().toISOString() });
  console.log('\n================================================================');
  console.log('  Mot de passe de l’espace administration (/admin) généré :');
  console.log(`      ${password}`);
  console.log('  Notez-le. Pour le changer : npm run set-password');
  console.log('================================================================\n');
}

app.listen(port, () => {
  console.log(`Site du garage démarré : http://localhost:${port}`);
  console.log(`Espace administration  : http://localhost:${port}/admin`);
});
