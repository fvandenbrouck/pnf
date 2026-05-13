// saisie.js — Formulaire de saisie d'une nouvelle action (super-user)

async function initSaisie() {
  if (!requireAuth('super')) return;
  setupNav();
  showLoader(true);
  try {
    const refs = await fetchAllRefs();
    buildForm(refs);
  } catch(e) {
    toast('Erreur chargement références : ' + e.message, 'err');
  } finally {
    showLoader(false);
  }
}

function buildForm(refs) {
  fillSel('s-volet',   refs.volets,   'libelle');
  fillSel('s-axe',     refs.axes,     'libelle');
  fillSel('s-struct',  refs.structs,  'code');
  fillSel('s-modalite',refs.modalites,'libelle');

  // Actions filtrées selon l'axe
  document.getElementById('s-axe').addEventListener('change', () => {
    const axeId = +document.getElementById('s-axe').value;
    const sel = document.getElementById('s-action');
    sel.innerHTML = '<option value="">— sélectionner une action —</option>';
    refs.actAxes
      .filter(a => a.id_axe === axeId)
      .sort((a,b) => a.num_action - b.num_action)
      .forEach(a => {
        const o = document.createElement('option');
        o.value = a.id;
        o.textContent = `Action ${a.num_action} – ${a.libelle}`;
        sel.appendChild(o);
      });
  });

  // Année
  fillSel('s-annee', refs.annees, 'libelle');

  // Lieux (multi-select chips — ReferenceList)
  buildLieuxChips(refs.lieux);

  // Contacts (multi-select chips — ReferenceList)
  buildContactList(refs.contacts);

  // Publics (chips)
  buildPublicsChips(refs.publics);
}

function fillSel(id, items, labelField) {
  const sel = document.getElementById(id);
  if (!sel) return;
  items.sort((a,b)=>(a[labelField]||'').localeCompare(b[labelField]||''));
  items.forEach(item => {
    const o = document.createElement('option');
    o.value = item.id; o.textContent = item[labelField]||'';
    sel.appendChild(o);
  });
}

function buildContactList(contacts) {
  const wrap = document.getElementById('s-contacts');
  if (!wrap) return;
  wrap.innerHTML = '';
  contacts.sort((a,b)=>a.nom_prenom.localeCompare(b.nom_prenom)).forEach(c => {
    const lbl = document.createElement('label');
    lbl.className = 'chip';
    lbl.innerHTML = `<input type="checkbox" name="contact" value="${c.id}">
      <span class="cb"></span><span class="cl">${c.nom_prenom}</span>`;
    wrap.appendChild(lbl);
  });
}

function buildLieuxChips(lieux) {
  const wrap = document.getElementById('s-lieux');
  if (!wrap) return;
  wrap.innerHTML = '';
  lieux.sort((a,b)=>(a._label||'').localeCompare(b._label||'')).forEach(l => {
    const lbl = document.createElement('label');
    lbl.className = 'chip';
    lbl.innerHTML = `<input type="checkbox" name="lieu" value="${l.id}">
      <span class="cb"></span><span class="cl">${l._label||l.ville}</span>`;
    wrap.appendChild(lbl);
  });
}

function buildPublicsChips(publics) {
  const wrap = document.getElementById('s-publics');
  if (!wrap) return;
  wrap.innerHTML = '';
  const cats = ['IA-IPR','IEN 1D','IEN 2D','Conseillers pédagogiques',
    'Formateurs académiques','Référents spécialisés','Professeurs',
    'Haut-encadrement',"Pilotes d'établissement",'Autres cadres en service déconcentré'];
  cats.forEach(cat => {
    const items = publics.filter(p => p.categorie === cat || p.libelle === cat);
    if (!items.length) return;
    const gl = document.createElement('div'); gl.className='chip-group'; gl.textContent=cat;
    wrap.appendChild(gl);
    const row = document.createElement('div'); row.className='chips-row';
    items.forEach(p => {
      const lbl = document.createElement('label'); lbl.className='chip';
      lbl.innerHTML = `<input type="checkbox" name="public" value="${p.id}">
        <span class="cb"></span><span class="cl">${p.libelle}</span>`;
      row.appendChild(lbl);
    });
    wrap.appendChild(row);
  });
}

async function submitAction() {
  // Validation
  const required = ['s-titre','s-volet','s-axe','s-action','s-struct'];
  let valid = true;
  required.forEach(id => {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { el?.classList.add('invalid'); valid=false; }
    else el.classList.remove('invalid');
  });
  if (!valid) { toast('Merci de renseigner les champs obligatoires', 'err'); return; }

  const contactIds = [...document.querySelectorAll('input[name=contact]:checked')].map(c=>+c.value);
  const lieuxIds   = [...document.querySelectorAll('input[name=lieu]:checked')].map(c=>+c.value);
  const publicIds  = [...document.querySelectorAll('input[name=public]:checked')].map(c=>+c.value);

  const toTs = v => v ? Math.floor(new Date(v).getTime()/1000) : null;

  const fields = {
    titre:               document.getElementById('s-titre').value.trim(),
    objectif:            document.getElementById('s-objectif').value.trim(),
    code_gaia:           document.getElementById('s-gaia').value.trim(),
    journees_stagiaires: parseFloat(document.getElementById('s-jours').value)||null,
    date_debut:          toTs(document.getElementById('s-debut').value),
    date_fin:            toTs(document.getElementById('s-fin').value),
    id_volet:            +document.getElementById('s-volet').value   || null,
    id_axe:              +document.getElementById('s-axe').value     || null,
    id_action_axe:       +document.getElementById('s-action').value  || null,
    id_structure:        +document.getElementById('s-struct').value  || null,
    id_modalite:         +document.getElementById('s-modalite').value|| null,
    id_contacts:         contactIds.length ? contactIds : null,
    id_publics:          publicIds.length  ? publicIds  : null,
    id_lieu:             lieuxIds.length   ? lieuxIds   : null,
    id_annee:            +document.getElementById('s-annee')?.value || null,
    periode:             document.getElementById('s-periode').value  || null,
  };
  // Nettoyer les nulls
  Object.keys(fields).forEach(k => { if(fields[k]===null||fields[k]===0) delete fields[k]; });

  const btn = document.getElementById('btn-submit');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  try {
    await createAction(fields);
    toast('Action enregistrée avec succès ✓', 'ok', 4000);
    resetForm();
  } catch(e) {
    toast('Erreur : ' + e.message, 'err');
  } finally {
    btn.disabled=false; btn.textContent='Enregistrer l\'action';
  }
}

function resetForm() {
  ['s-titre','s-objectif','s-gaia','s-jours','s-debut','s-fin'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['s-volet','s-axe','s-action','s-struct','s-modalite','s-periode'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('s-action').innerHTML='<option value="">— sélectionner un axe d\'abord —</option>';
  document.querySelectorAll('input[name=contact],input[name=public],input[name=lieu]').forEach(c=>c.checked=false);
  document.querySelectorAll('.invalid').forEach(el=>el.classList.remove('invalid'));
}

function showLoader(v) {
  document.getElementById('loader')?.classList.toggle('hidden',!v);
}
