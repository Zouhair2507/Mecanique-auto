'use strict';

/**
 * Définit le mot de passe de l'espace administration.
 * Utilisation : npm run set-password            (saisie interactive)
 *               npm run set-password -- monMotDePasse
 */
const path = require('node:path');
const readline = require('node:readline');

try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  /* pas de .env */
}

const { Store, hashPassword } = require('../src/store');

const dataDir = path.resolve(__dirname, '..', process.env.DATA_DIR || 'data');
const store = new Store(dataDir);

function save(password) {
  if (!password || password.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caractères.');
    process.exit(1);
  }
  store.writeAuth({ passwordHash: hashPassword(password), updatedAt: new Date().toISOString() });
  console.log('Mot de passe enregistré. Il est pris en compte immédiatement.');
  if (process.env.ADMIN_PASSWORD) {
    console.log('Attention : ADMIN_PASSWORD est défini dans l’environnement et reste prioritaire.');
  }
}

const arg = process.argv[2];
if (arg) {
  save(arg);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Nouveau mot de passe administrateur (8 caractères minimum) : ', (answer) => {
    rl.close();
    save(answer.trim());
  });
}
