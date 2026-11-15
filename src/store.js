'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { defaultSettings } = require('./defaults');

/**
 * Stockage simple dans un fichier JSON (data/db.json).
 * Suffisant pour un garage : aucune base de données à installer.
 * Chaque écriture passe par un fichier temporaire puis un renommage atomique,
 * et une copie de la version précédente est conservée (db.json.bak).
 */
class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    this.authFile = path.join(dir, 'admin.json');
    this.data = null;
  }

  load() {
    fs.mkdirSync(this.dir, { recursive: true });
    this.data = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
    this.data.settings ??= structuredClone(defaultSettings);
    this.data.appointments ??= [];
    this.data.tickets ??= [];
    this.save();
    return this;
  }

  save() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, `${this.file}.bak`);
    fs.renameSync(tmp, this.file);
  }

  get settings() {
    return this.data.settings;
  }

  set settings(value) {
    this.data.settings = value;
    this.save();
  }

  // --- Authentification admin (fichier séparé, modifiable par « npm run set-password ») ---

  readAuth() {
    try {
      return JSON.parse(fs.readFileSync(this.authFile, 'utf8'));
    } catch {
      return {};
    }
  }

  writeAuth(auth) {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.authFile, JSON.stringify(auth, null, 2), { mode: 0o600 });
  }
}

// Alphabet sans caractères ambigus (pas de 0/O, 1/I/L)
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeRef(prefix, existing) {
  for (;;) {
    const bytes = crypto.randomBytes(6);
    let code = '';
    for (const b of bytes) code += REF_ALPHABET[b % REF_ALPHABET.length];
    const ref = `${prefix}-${code}`;
    if (!existing.some((x) => x.ref === ref)) return ref;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt:')) return false;
  const [, saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { Store, makeRef, hashPassword, verifyPassword };
