// Criptare app-level pentru token-urile de acces ale platformelor (Meta/Google/TikTok), peste criptarea
// at-rest a Firestore (defense-in-depth): chiar dacă cineva citește doc-ul, token-ul rămâne ilizibil fără
// cheia master din Secret Manager (TOKEN_ENC_KEY). AES-256-GCM (autentificat → tamper = throw). PUR: cheia
// vine ca parametru (nu citește Secret Manager aici) → testabil headless + nu cere secrete la deploy.
const crypto = require('crypto');

/** Derivă o cheie de 32 octeți: hex de 64 caractere → bytes direcți; altceva → sha256 (orice secret e ok). */
function deriveKey(raw) {
  const s = typeof raw === 'string' ? raw : '';
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
  return crypto.createHash('sha256').update(s, 'utf8').digest();
}

/** Criptează un string → „v1.<ivB64>.<tagB64>.<ctB64>". IV aleator pe fiecare apel. */
function encryptToken(plaintext, keyRaw) {
  const key = deriveKey(keyRaw);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext == null ? '' : plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'v1.' + iv.toString('base64') + '.' + tag.toString('base64') + '.' + ct.toString('base64');
}

/** Decriptează un payload produs de encryptToken. Aruncă dacă e corupt/modificat (GCM auth) sau format greșit. */
function decryptToken(payload, keyRaw) {
  const key = deriveKey(keyRaw);
  const parts = String(payload == null ? '' : payload).split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('token payload invalid');
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

module.exports = { deriveKey, encryptToken, decryptToken };
