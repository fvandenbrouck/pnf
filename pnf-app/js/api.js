// api.js — Toutes les requêtes vers l'API Grist
// Schéma aligné sur le code Python Grist (Actions_formation + tables de référence)

const GRIST_SERVER = 'https://grist.numerique.gouv.fr';
const DOC_ID       = 'oEE59cdA19S6';
const BASE         = `${GRIST_SERVER}/api/docs/${DOC_ID}`;

function headers() {
  const key = sessionStorage.getItem('grist_key');
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// ── Authentification ───────────────────────────────────────────────────────
async function getProfile() {
  const r = await fetch(`${GRIST_SERVER}/api/profile`, { headers: headers() });
  if (!r.ok) throw new Error('Clé API invalide');
  return r.json();
}

async function getDocAccess() {
  const r = await fetch(`${BASE}/access`, { headers: headers() });
  if (!r.ok) throw new Error('Accès document refusé');
  return r.json();
}

// ── Lecture générique ──────────────────────────────────────────────────────
async function fetchTable(tableName) {
  const r = await fetch(`${BASE}/tables/${tableName}/records`, { headers: headers() });
  if (!r.ok) throw new Error(`Erreur lecture ${tableName}: ${r.status}`);
  const data = await r.json();
  return data.records.map(rec => ({ id: rec.id, ...rec.fields }));
}

// ── Helper : index id → valeur ─────────────────────────────────────────────
function idx(arr, field = 'libelle') {
  return Object.fromEntries(arr.map(r => [r.id, r[field] ?? '']));
}

// ── Helper : résoudre une ReferenceList (tableau d'ids) → chaîne jointe ───
function resolveList(ids, map, sep = ' · ') {
  if (!ids) return '';
  const arr = Array.isArray(ids) ? ids : [ids];
  return arr.map(i => map[i]).filter(Boolean).join(sep);
}

// ── Lire toutes les tables de référence ───────────────────────────────────
async function fetchAllRefs() {
  const [volets, axes, actAxes, structs, contacts, publics, modalites, annees, lieux, academies] =
    await Promise.all([
      fetchTable('Volets'),
      fetchTable('Axes'),
      fetchTable('Actions_axes'),
      fetchTable('Structures'),
      fetchTable('Contacts'),
      fetchTable('Publics'),
      fetchTable('Modalites'),
      fetchTable('Annees').catch(() => []),
      fetchTable('Lieux').catch(() => []),
      fetchTable('Academies').catch(() => []),
    ]);

  // Enrichir Contacts : résoudre la FK structure (Reference → Structures)
  const structCode = idx(structs, 'code');
  const contactsEnriched = contacts.map(c => ({
    ...c,
    _struct: structCode[c.structure] || '',
  }));

  // Enrichir Lieux : résoudre la FK Academie (Reference → Academies)
  const acadNom = idx(academies, 'Nom');
  const lieuxEnriched = lieux.map(l => ({
    ...l,
    _academie: acadNom[l.Academie] || '',
    _label: [l.ville, acadNom[l.Academie] || ''].filter(Boolean).join(' — '),
  }));

  return {
    volets, axes, actAxes, structs,
    contacts: contactsEnriched,
    publics, modalites, annees,
    lieux: lieuxEnriched,
    academies,
  };
}

// ── Lire Actions_formation avec toutes les jointures résolues ──────────────
async function fetchActions() {
  const [actions, refs] = await Promise.all([
    fetchTable('Actions_formation'),
    fetchAllRefs(),
  ]);

  const V  = idx(refs.volets);
  const AX = idx(refs.axes);
  const AA = idx(refs.actAxes);
  const S  = idx(refs.structs, 'code');
  const C  = Object.fromEntries(refs.contacts.map(c => [c.id, c.nom_prenom]));
  const P  = idx(refs.publics);
  const M  = idx(refs.modalites);
  const AN = idx(refs.annees);
  // Lieux : id → label "Ville — Académie"
  const L  = Object.fromEntries(refs.lieux.map(l => [l.id, l._label || l.ville]));

  return actions.map(a => ({
    ...a,
    _volet:    V[a.id_volet]          || '',
    _axe:      AX[a.id_axe]           || '',
    _action:   AA[a.id_action_axe]    || '',
    _struct:   S[a.id_structure]      || '',
    _modalite: M[a.id_modalite]       || '',
    _annee:    AN[a.id_annee]         || '',
    // ReferenceList → jointure multiple
    _contacts: resolveList(a.id_contacts, C, ', '),
    _publics:  resolveList(a.id_publics,  P, ' · '),
    _lieux:    resolveList(a.id_lieu,     L, ', '),
  }));
}

// ── Créer une action ───────────────────────────────────────────────────────
// Règles de typage Grist :
//   Reference     → entier (id de la ligne liée)
//   ReferenceList → tableau d'entiers ["L", id1, id2, …] au format Grist
//   Date          → timestamp Unix (secondes)
//   Numeric       → float
async function createAction(fields) {
  // Convertir les ReferenceList au format natif Grist : ["L", id1, id2, ...]
  ['id_contacts', 'id_publics', 'id_lieu'].forEach(key => {
    const val = fields[key];
    if (Array.isArray(val) && val.length) {
      fields[key] = ['L'].concat(val);   // format attendu par l'API Grist
    } else {
      delete fields[key];
    }
  });
  // Supprimer les champs vides
  Object.keys(fields).forEach(k => {
    if (fields[k] === null || fields[k] === undefined || fields[k] === '' || fields[k] === 0)
      delete fields[k];
  });

  const r = await fetch(`${BASE}/tables/Actions_formation/records`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Erreur création (${r.status})`);
  }
  return r.json();
}
