#!/usr/bin/env node
const { createSign, createPrivateKey } = require('crypto');

const args = process.argv.slice(2);
const getArg = (name) => { const idx = args.indexOf(name); return idx !== -1 ? args[idx + 1] : null; };

const shopId = getArg('--shop-id') || 'default';
const licensee = getArg('--licensee') || 'Unknown';
const days = parseInt(getArg('--days') || '365', 10);

let privateKeyB64 = process.env.PRIVATE_KEY || null;
if (!privateKeyB64) {
  const { readFileSync } = require('fs');
  const { resolve } = require('path');
  try { privateKeyB64 = readFileSync(resolve(__dirname, '..', '.license-key'), 'utf-8').trim(); }
  catch { console.error('ERROR: No private key found.'); process.exit(1); }
}

const privateKeyBytes = Buffer.from(privateKeyB64, 'base64');
const privateKey = createPrivateKey({ key: privateKeyBytes, format: 'der', type: 'pkcs8' });

const now = Math.floor(Date.now() / 1000);
const payload = { tier: 'pro', shopId, licensee, iat: now, exp: days === 0 ? 0 : now + days * 86400 };
const payloadJson = JSON.stringify(payload);

const signer = createSign('SHA256');
signer.update(payloadJson);
signer.end();
const signature = signer.sign(privateKey);

function toB64Url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
console.log(toB64Url(Buffer.from(payloadJson, 'utf-8')) + '.' + toB64Url(signature));
