#!/usr/bin/env node
// Reusable test submitter — fires real form submissions at the live Apps Script
// endpoint, so confirm/boss emails actually send. Needs a real Google ID token.
//
// Get a token: open form.html, sign in, open DevTools console, run:
//   idToken
// (it's a global var set after sign-in) and copy the string.
//
// Usage:
//   node scripts/test-submit.js YOUR_ID_TOKEN [count] [contactEmail]
//
// count defaults to 1. Each run uses a random suffix so names don't collide.
// contactEmail overrides the business's public contact email on every submission.

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbw3yK823DH4sQqc1nFkvPKMbAhq2-oa0jrXDS_af_bXADEdrayXn5_XUrvfQE5gSx7wJg/exec';

const TEMPLATES = [
  { businessName: 'Test Harbor Bakery', category: 'Food & Drinks', desc: 'Fresh bread every morning', phone: '941-555-0301', email: 'harborbakery@example.com', website: 'harborbakery.example.com' },
  { businessName: 'Test Sunshine Salon', category: 'Beauty, Salons & Fitness', desc: 'Cuts, color and calm', phone: '941-555-0302', email: 'sunshinesalon@example.com', website: 'sunshinesalon.example.com' },
  { businessName: 'Test Quick Fix Plumbing', category: 'Local Trades & Repairs', desc: 'Fast fixes, fair prices', phone: '941-555-0303', email: 'quickfix@example.com', website: 'quickfix.example.com' },
  { businessName: 'Test Coastal Consulting', category: 'Professional & Online Services', desc: 'Plans that fit small budgets', phone: '941-555-0304', email: 'coastalconsult@example.com', website: 'coastalconsult.example.com' },
  { businessName: 'Test Garden Gate Nursery', category: 'Home & Garden Services', desc: 'Plants for Florida yards', phone: '941-555-0305', email: 'gardengate@example.com', website: 'gardengate.example.com' },
];

async function submitOne(idToken, tmpl, suffix, contactEmail) {
  const payload = {
    idToken,
    name: 'Test Owner', title: 'Owner', how: tmpl.phone,
    businessName: `${tmpl.businessName} ${suffix}`, pubName: '', pubTitle: '',
    category: tmpl.category, about: '', other: '',
    describe: `Mobile - No fixed location\n\n${tmpl.desc}`,
    street: '', street2: '', city: '', state: '', zip: '', area: '',
    phone: tmpl.phone, website: tmpl.website, email: contactEmail || tmpl.email,
    facebook: '', ndBiz: '', ndPersonal: '', slogan: '',
    logoData: '', logoName: '',
    originalName: '', logoAction: 'none', licensed: '',
  };

  const body = new URLSearchParams({ payload: JSON.stringify(payload) });
  const res = await fetch(ENDPOINT, { method: 'POST', body, redirect: 'follow' });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  console.log(`${payload.businessName} ->`, json);
}

async function main() {
  const idToken = process.argv[2];
  const count = Math.min(Number(process.argv[3] || 1), TEMPLATES.length);
  const contactEmail = process.argv[4] || '';
  if (!idToken) {
    console.error('Usage: node scripts/test-submit.js YOUR_ID_TOKEN [count] [contactEmail]');
    process.exit(1);
  }
  const suffix = Date.now().toString(36);
  for (let i = 0; i < count; i++) {
    await submitOne(idToken, TEMPLATES[i], suffix, contactEmail);
  }
}

main();
