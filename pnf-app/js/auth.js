// auth.js — Gestion authentification et session

const ROLES = { owners: 'super', editors: 'super', viewers: 'user' };

async function login(apiKey) {
  sessionStorage.setItem('grist_key', apiKey);
  try {
    const [profile, access] = await Promise.all([getProfile(), getDocAccess()]);
    const userEmail = profile.email;
    // Déterminer le rôle à partir des droits sur le document
    let role = 'user';
    const rules = access.users || [];
    for (const u of rules) {
      if (u.email === userEmail && ROLES[u.access]) {
        role = ROLES[u.access]; break;
      }
    }
    // Si maxInheritedRole == 'owners' ou access == 'owners/editors'
    if (access.maxInheritedRole === 'owners' || access.maxInheritedRole === 'editors') role = 'super';
    sessionStorage.setItem('grist_role', role);
    sessionStorage.setItem('grist_email', userEmail);
    sessionStorage.setItem('grist_name', profile.name || userEmail);
    return { role, email: userEmail, name: profile.name };
  } catch(e) {
    sessionStorage.clear();
    throw e;
  }
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

function requireAuth(allowedRole) {
  const key  = sessionStorage.getItem('grist_key');
  const role = sessionStorage.getItem('grist_role');
  if (!key || !role) { window.location.href = 'index.html'; return false; }
  if (allowedRole === 'super' && role !== 'super') {
    window.location.href = 'catalogue.html'; return false;
  }
  return true;
}

function setupNav() {
  const role  = sessionStorage.getItem('grist_role');
  const email = sessionStorage.getItem('grist_email') || '';
  const name  = sessionStorage.getItem('grist_name')  || email;

  const profileEl = document.getElementById('nav-profile');
  const emailEl   = document.getElementById('nav-email');
  const saisieLnk = document.getElementById('nav-saisie');

  if (profileEl) {
    profileEl.textContent = role === 'super' ? 'Super-user' : 'Lecteur';
    if (role === 'super') profileEl.classList.add('super');
  }
  if (emailEl) emailEl.textContent = name;
  if (saisieLnk && role === 'super') saisieLnk.style.display = 'inline-flex';
}

// Toast global
let _toastTimer;
function toast(msg, type='inf', duration=3000) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}
