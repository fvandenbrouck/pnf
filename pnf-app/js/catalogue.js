// catalogue.js — Filtres, affichage, exports

let ALL_ACTIONS = [];
let FILTERED    = [];
let VIEW_MODE   = 'table'; // 'table' | 'cards'

// ── Init ──────────────────────────────────────────────
async function initCatalogue() {
  if (!requireAuth()) return;
  setupNav();
  showLoader(true);
  try {
    const refs = await fetchAllRefs();
    populateFilters(refs);
    ALL_ACTIONS = await fetchActions();
    applyFilters();
  } catch(e) {
    toast('Erreur chargement : ' + e.message, 'err');
  } finally {
    showLoader(false);
  }
}

// ── Filtres ───────────────────────────────────────────
function populateFilters(refs) {
  fillSelect('f-volet',   refs.volets,   'libelle');
  fillSelect('f-axe',     refs.axes,     'libelle');
  fillSelect('f-struct',  refs.structs,  'code');
  fillSelect('f-modalite',refs.modalites,'libelle');
  fillSelect('f-public',  refs.publics,  'libelle');
  fillSelect('f-lieu',    refs.lieux,    '_label');
  // Périodes statiques
  const periods = ['Au fil de l\'année','Septembre–décembre 2026','Janvier–mars 2027','Avril–juin 2027'];
  const sel = document.getElementById('f-periode');
  periods.forEach(p => { const o=document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o); });
}

function fillSelect(id, items, labelField) {
  const sel = document.getElementById(id);
  if (!sel) return;
  items.sort((a,b)=>(a[labelField]||'').localeCompare(b[labelField]||''));
  items.forEach(item => {
    const o = document.createElement('option');
    o.value = item.id;
    o.textContent = item[labelField] || '';
    sel.appendChild(o);
  });
}

function applyFilters() {
  const volet   = document.getElementById('f-volet')?.value;
  const axe     = document.getElementById('f-axe')?.value;
  const struct  = document.getElementById('f-struct')?.value;
  const modal   = document.getElementById('f-modalite')?.value;
  const pub     = document.getElementById('f-public')?.value;
  const periode = document.getElementById('f-periode')?.value;
  const lieu     = document.getElementById('f-lieu')?.value;
  const search  = document.getElementById('f-search')?.value.toLowerCase();

  FILTERED = ALL_ACTIONS.filter(a => {
    if (volet   && a.id_volet     != volet)   return false;
    if (axe     && a.id_axe       != axe)     return false;
    if (struct  && a.id_structure  != struct)  return false;
    if (modal   && a.id_modalite   != modal)   return false;
    if (pub) {
      const pubs = Array.isArray(a.id_publics) ? a.id_publics : [a.id_publics];
      if (!pubs.map(String).includes(String(pub))) return false;
    }
    if (lieu) {
      const lieux = Array.isArray(a.id_lieu) ? a.id_lieu : [a.id_lieu];
      if (!lieux.map(String).includes(String(lieu))) return false;
    }
    if (periode && a.periode !== periode) return false;
    if (search  && !(a.titre||'').toLowerCase().includes(search) &&
                   !a._axe.toLowerCase().includes(search)) return false;
    return true;
  });

  document.getElementById('results-count').textContent =
    `${FILTERED.length} action${FILTERED.length>1?'s':''} trouvée${FILTERED.length>1?'s':''}`;
  render();
}

function resetFilters() {
  ['f-volet','f-axe','f-struct','f-modalite','f-public','f-periode'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  const s = document.getElementById('f-search'); if(s) s.value='';
  applyFilters();
}

// ── Rendu ─────────────────────────────────────────────
function render() {
  const container = document.getElementById('results-container');
  if (!container) return;
  if (!FILTERED.length) {
    container.innerHTML = '<p style="color:var(--ink3);font-size:13px;text-align:center;padding:40px">Aucune action ne correspond aux filtres.</p>';
    return;
  }
  if (VIEW_MODE === 'table') renderTable(container);
  else renderCards(container);
}

function renderTable(container) {
  const cols = [
    { label:'Titre',      key:'titre' },
    { label:'Axe',        key:'_axe' },
    { label:'Volet',      key:'_volet' },
    { label:'Période',    key:'periode' },
    { label:'Public',     key:'_publics' },
    { label:'Structure',  key:'_struct' },
    { label:'Modalité',   key:'_modalite' },
    { label:'Code GAIA',  key:'code_gaia' },
  ];
  const rows = FILTERED.map(a =>
    `<tr>${cols.map(c=>`<td title="${(a[c.key]||'').replace(/"/g,'&quot;')}">${esc(a[c.key]||'')}</td>`).join('')}</tr>`
  ).join('');
  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${cols.map(c=>`<th>${c.label}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderCards(container) {
  const cards = FILTERED.map(a => `
    <div class="action-card">
      <div class="ac-title">${esc(a.titre||'Sans titre')}</div>
      <div class="ac-meta">
        ${a._axe    ? `<span class="tag tag-blue">${esc(a._axe)}</span>` : ''}
        ${a._volet  ? `<span class="tag tag-gray">${esc(a._volet)}</span>` : ''}
        ${a.periode ? `<span class="tag tag-amber">${esc(a.periode)}</span>` : ''}
        ${a._modalite?`<span class="tag tag-green">${esc(a._modalite)}</span>` : ''}
      </div>
      ${a._publics ? `<div style="font-size:11px;color:var(--ink3);margin-bottom:4px">${esc(a._publics)}</div>`:''}
      ${a.code_gaia? `<div style="font-family:var(--mono);font-size:10px;color:var(--ink3)">GAIA : ${esc(a.code_gaia)}</div>`:''}
      ${a._lieux?  `<div style="font-size:11px;color:var(--ink3)">📍 ${esc(a._lieux)}</div>`:''}
      <div class="ac-contact">${esc(a._contacts||a._struct||'')}</div>
    </div>`).join('');
  container.innerHTML = `<div class="cards-grid">${cards}</div>`;
}

function setView(mode) {
  VIEW_MODE = mode;
  document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${mode}`)?.classList.add('active');
  render();
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Export Excel ──────────────────────────────────────
async function exportExcel() {
  showLoader(true);
  try {
    const all = await fetchActions(); // toutes les colonnes
    const cols = [
      'titre','code_gaia','periode','objectif',
      '_volet','_axe','_action','_struct','_contact','_publics','_modalite','_annee',
      'journees_stagiaires',
    ];
    const headers = [
      'Titre','Code GAIA','Période','Objectif',
      'Volet','Axe','Action','Structure','Contact','Publics','Modalité','Année',
      'Journées stagiaires',
    ];
    // Filtrer selon les filtres actifs
    const filtered = all.filter(a => FILTERED.some(f => f.id === a.id));
    const rows = filtered.map(a => cols.map(c => a[c] ?? ''));

    // Construire CSV UTF-8 (téléchargeable sans dépendance)
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'))
      .join('\n');
    dl('\uFEFF' + csv, `PNF_catalogue_${dateStr()}.csv`, 'text/csv');
    toast('Export CSV téléchargé', 'ok');
  } catch(e) {
    toast('Erreur export : ' + e.message, 'err');
  } finally {
    showLoader(false);
  }
}

// ── Export PDF ────────────────────────────────────────
function exportPDF() {
  if (!FILTERED.length) { toast('Aucune action à exporter', 'err'); return; }
  const w = window.open('', '_blank');
  const logoUrl = 'https://upload.wikimedia.org/wikipedia/fr/thumb/9/93/Logo_DGESCO.svg/200px-Logo_DGESCO.svg.png';
  const rows = FILTERED.map(a => `
    <tr>
      <td>${esc(a.titre||'')}</td>
      <td>${esc(a._axe||'')}</td>
      <td>${esc(a._volet||'')}</td>
      <td>${esc(a.periode||'')}</td>
      <td>${esc(a._publics||'')}</td>
      <td>${esc(a._struct||'')}</td>
      <td>${esc(a._modalite||'')}</td>
      <td>${esc(a.code_gaia||'')}</td>
    </tr>`).join('');
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <title>Catalogue PNF</title>
    <style>
      @page{size:A4 portrait;margin:18mm 14mm 14mm}
      body{font-family:Arial,sans-serif;font-size:9px;color:#222}
      .header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #0052cc;padding-bottom:10px;margin-bottom:14px}
      .header img{height:40px}
      .header h1{font-size:15px;color:#0052cc;margin:0}
      .header p{font-size:9px;color:#888;margin:2px 0 0}
      table{width:100%;border-collapse:collapse;font-size:8px}
      th{background:#0052cc;color:#fff;padding:5px 6px;text-align:left;font-weight:600}
      td{padding:4px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}
      tr:nth-child(even) td{background:#f8fafc}
      .footer{font-size:7px;color:#aaa;text-align:right;margin-top:10px}
    </style></head><body>
    <div class="header">
      <img src="${logoUrl}" alt="DGESCO" onerror="this.style.display='none'">
      <div>
        <h1>Catalogue PNF 2026-2027</h1>
        <p>Export du ${new Date().toLocaleDateString('fr-FR')} — ${FILTERED.length} action(s) filtrée(s)</p>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>Titre</th><th>Axe</th><th>Volet</th><th>Période</th>
        <th>Public</th><th>Structure</th><th>Modalité</th><th>GAIA</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Direction générale de l'enseignement scolaire – PNF 2026-2027</div>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}

// ── Utilitaires ───────────────────────────────────────
function showLoader(v) {
  document.getElementById('loader')?.classList.toggle('hidden', !v);
}
function dl(content, filename, mime='text/csv') {
  const a = document.createElement('a');
  a.href = 'data:'+mime+';charset=utf-8,'+encodeURIComponent(content);
  a.download = filename; a.click();
}
function dateStr() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
