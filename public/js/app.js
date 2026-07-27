// ============ Contrôleur principal de l'application ============

let UTILISATEUR = null; // { id, username, role, nom_complet }
let CACHE_AGENTS = [];   // dernière liste chargée (pour impression / filtres locaux)

const MENUS = {
  admin: [
    { route: 'tableau-bord', libelle: '📊 Tableau de bord' },
    { route: 'personnel', libelle: '👥 Personnel' },
    { route: 'utilisateurs', libelle: '🔑 Utilisateurs' },
    { route: 'rapports', libelle: '📈 Rapports' },
    { route: 'parametres', libelle: '⚙️ Paramètres' },
  ],
  grh: [
    { route: 'tableau-bord', libelle: '📊 Tableau de bord' },
    { route: 'personnel', libelle: '👥 Personnel' },
    { route: 'rapports', libelle: '📈 Rapports' },
  ],
  daf: [
    { route: 'tableau-bord', libelle: '📊 Tableau de bord' },
    { route: 'personnel', libelle: '👥 Personnel' },
  ],
  agent: [
    { route: 'ma-fiche', libelle: '🧾 Ma fiche' },
  ],
};

function routeParDefaut() {
  const menu = MENUS[UTILISATEUR.role] || [];
  return menu[0] ? menu[0].route : 'tableau-bord';
}

function peutGererPersonnel() { return UTILISATEUR && (UTILISATEUR.role === 'admin' || UTILISATEUR.role === 'grh'); }

function onSessionExpiree() {
  UTILISATEUR = null;
  afficherEcranLogin();
  afficherAlerte('Votre session a expiré, veuillez vous reconnecter.', 'erreur');
}

// ---------------- Démarrage ----------------
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('form-login').addEventListener('submit', gererLogin);
  document.getElementById('btn-logout').addEventListener('click', deconnexion);
  document.getElementById('btn-changer-mdp').addEventListener('click', ouvrirChangementMdp);
  window.addEventListener('hashchange', routerVersVue);

  if (API.token) {
    try {
      const { user } = await API.get('/auth/me');
      UTILISATEUR = user;
      afficherApp();
    } catch (e) {
      afficherEcranLogin();
    }
  } else {
    afficherEcranLogin();
  }
});

function afficherEcranLogin() {
  document.getElementById('ecran-login').classList.remove('cache');
  document.getElementById('app').classList.add('cache');
}

function afficherApp() {
  document.getElementById('ecran-login').classList.add('cache');
  document.getElementById('app').classList.remove('cache');
  document.getElementById('user-nom').textContent = UTILISATEUR.nom_complet;
  document.getElementById('user-role').textContent = libelleRole(UTILISATEUR.role);
  document.getElementById('user-avatar').textContent = (UTILISATEUR.nom_complet || '?')[0].toUpperCase();
  construireMenu();
  if (!window.location.hash) window.location.hash = '#' + routeParDefaut();
  routerVersVue();
}

async function gererLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const erreurEl = document.getElementById('login-erreur');
  erreurEl.classList.add('cache');
  try {
    const data = await API.post('/auth/login', { username, password });
    API.setToken(data.token);
    UTILISATEUR = data.user;
    document.getElementById('form-login').reset();
    afficherApp();
  } catch (err) {
    erreurEl.textContent = err.message;
    erreurEl.classList.remove('cache');
  }
}

function deconnexion() {
  API.setToken(null);
  UTILISATEUR = null;
  window.location.hash = '';
  afficherEcranLogin();
}

function construireMenu() {
  const menu = MENUS[UTILISATEUR.role] || [];
  const nav = document.getElementById('nav-menu');
  nav.innerHTML = menu.map(m => `
    <button class="nav-item" data-route="${m.route}"><span class="puce"></span>${m.libelle}</button>
  `).join('');
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => { window.location.hash = '#' + btn.dataset.route; });
  });
}

function marquerNavActif(routeRacine) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('actif', btn.dataset.route === routeRacine);
  });
}

// ---------------- Routeur ----------------
async function routerVersVue() {
  if (!UTILISATEUR) return;
  const hash = (window.location.hash || '#tableau-bord').slice(1);
  const segments = hash.split('/').filter(Boolean);
  const racine = segments[0] || 'tableau-bord';
  document.getElementById('topbar-actions').innerHTML = '';

  const accesAutorise = {
    'tableau-bord': ['admin', 'daf', 'grh'],
    'personnel': ['admin', 'daf', 'grh'],
    'utilisateurs': ['admin'],
    'rapports': ['admin', 'grh'],
    'parametres': ['admin'],
    'ma-fiche': ['agent'],
  };
  if (accesAutorise[racine] && !accesAutorise[racine].includes(UTILISATEUR.role)) {
    afficherAlerte("Vous n'avez pas accès à cette section.", 'erreur');
    window.location.hash = '#' + routeParDefaut();
    return;
  }
  marquerNavActif(racine);

  try {
    if (racine === 'tableau-bord') await vueTableauBord();
    else if (racine === 'personnel' && segments.length === 1) await vuePersonnelListe();
    else if (racine === 'personnel' && segments[1] === 'nouveau') await vuePersonnelFormulaire();
    else if (racine === 'personnel' && segments[2] === 'modifier') await vuePersonnelFormulaire(segments[1]);
    else if (racine === 'personnel' && segments.length === 2) await vuePersonnelFiche(segments[1]);
    else if (racine === 'utilisateurs') await vueUtilisateurs();
    else if (racine === 'rapports') await vueRapportsAffichage();
    else if (racine === 'parametres') await vueParametresAffichage();
    else if (racine === 'ma-fiche') await vueMaFiche();
    else { document.getElementById('vue').innerHTML = '<div class="etat-vide">Page introuvable.</div>'; }
  } catch (err) {
    afficherAlerte(err.message || 'Une erreur est survenue.', 'erreur');
  }
}

function definirTitre(titre) { document.getElementById('titre-page').textContent = titre; }

// ---------------- Tableau de bord ----------------
async function vueTableauBord() {
  definirTitre('Tableau de bord');
  document.getElementById('vue').innerHTML = '<p class="text-muted">Chargement…</p>';
  const stats = await API.get('/reports/stats');
  document.getElementById('vue').innerHTML = VUES.tableauBord(stats);
}

// ---------------- Personnel : liste ----------------
async function vuePersonnelListe() {
  definirTitre('Personnel');
  document.getElementById('vue').innerHTML = '<p class="text-muted">Chargement…</p>';
  const agents = await API.get('/agents');
  CACHE_AGENTS = agents;
  rendreListePersonnel(agents);
}

function rendreListePersonnel(agents) {
  document.getElementById('vue').innerHTML = VUES.listePersonnel(agents, peutGererPersonnel());

  document.querySelectorAll('#corps-table-agents tr').forEach(tr => {
    tr.addEventListener('click', () => { window.location.hash = `#personnel/${tr.dataset.id}`; });
  });
  document.getElementById('btn-imprimer-liste').addEventListener('click', () => imprimerListePersonnel(agents));
  const btnNouveau = document.getElementById('btn-nouvel-agent');
  if (btnNouveau) btnNouveau.addEventListener('click', () => { window.location.hash = '#personnel/nouveau'; });

  let debounce = null;
  const relancerRecherche = async () => {
    const q = document.getElementById('recherche-agent').value.trim();
    const statut = document.getElementById('filtre-statut').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (statut) params.set('statut', statut);
    const resultat = await API.get('/agents?' + params.toString());
    CACHE_AGENTS = resultat;
    rendreListePersonnel(resultat);
    document.getElementById('recherche-agent').value = q;
    document.getElementById('recherche-agent').focus();
    document.getElementById('filtre-statut').value = statut;
  };
  document.getElementById('recherche-agent').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(relancerRecherche, 300);
  });
  document.getElementById('filtre-statut').addEventListener('change', relancerRecherche);
}

// ---------------- Personnel : fiche détaillée ----------------
async function vuePersonnelFiche(id) {
  definirTitre('Fiche agent');
  document.getElementById('vue').innerHTML = '<p class="text-muted">Chargement…</p>';
  const [agent, affectations, documents] = await Promise.all([
    API.get(`/agents/${id}`),
    API.get(`/agents/${id}/affectations`),
    API.get(`/documents/agent/${id}`),
  ]);
  const peutGerer = peutGererPersonnel();
  document.getElementById('vue').innerHTML = VUES.ficheAgent(agent, affectations, documents, peutGerer);

  document.getElementById('btn-imprimer-fiche').addEventListener('click', () => imprimerFicheAgent(agent, affectations));

  if (peutGerer) {
    document.getElementById('btn-modifier-agent').addEventListener('click', () => { window.location.hash = `#personnel/${id}/modifier`; });
    document.getElementById('btn-supprimer-agent').addEventListener('click', async () => {
      const ok = await confirmerAction('Supprimer cet agent', `Voulez-vous vraiment supprimer ${agent.nom} ${agent.prenom} ? Cette action est irréversible.`, 'Supprimer');
      if (!ok) return;
      try {
        await API.del(`/agents/${id}`);
        afficherAlerte('Agent supprimé avec succès.', 'succes');
        window.location.hash = '#personnel';
      } catch (err) { afficherAlerte(err.message, 'erreur'); }
    });
    const formDoc = document.getElementById('form-ajout-doc');
    if (formDoc) {
      formDoc.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(formDoc);
        try {
          await API.post(`/documents/agent/${id}`, fd, { isForm: true });
          afficherAlerte('Document ajouté.', 'succes');
          vuePersonnelFiche(id);
        } catch (err) { afficherAlerte(err.message, 'erreur'); }
      });
    }
    document.querySelectorAll('[data-suppr-doc]').forEach(lien => {
      lien.addEventListener('click', async (e) => {
        e.preventDefault();
        const ok = await confirmerAction('Supprimer le document', 'Voulez-vous vraiment supprimer ce document ?', 'Supprimer');
        if (!ok) return;
        await API.del(`/documents/${lien.dataset.supprDoc}`);
        vuePersonnelFiche(id);
      });
    });
  }
}

// ---------------- Ma fiche (rôle agent) ----------------
async function vueMaFiche() {
  definirTitre('Ma fiche');
  document.getElementById('vue').innerHTML = '<p class="text-muted">Chargement…</p>';
  const agent = await API.get('/agents/me');
  const [affectations, documents] = await Promise.all([
    API.get(`/agents/${agent.id}/affectations`),
    API.get(`/documents/agent/${agent.id}`),
  ]);
  document.getElementById('vue').innerHTML = VUES.ficheAgent(agent, affectations, documents, false);
  document.getElementById('btn-imprimer-fiche').addEventListener('click', () => imprimerFicheAgent(agent, affectations));
}

// Remplit le <select> Service selon la Direction choisie, et re-selectionne
// le service courant quand on rouvre le formulaire d'un agent existant.
function cablerSelectDirectionService(directionActuelle, serviceActuel) {
  const selDirection = document.getElementById('select-direction');
  const selService = document.getElementById('select-service');
  if (!selDirection || !selService) return;

  const remplir = (direction, serviceASelectionner) => {
    const services = ORGANISATION[direction] || [];
    selService.innerHTML = '<option value="">—</option>' +
      services.map(s => `<option ${s === serviceASelectionner ? 'selected' : ''}>${s}</option>`).join('');
    selService.disabled = services.length === 0;
  };

  remplir(directionActuelle || '', serviceActuel || '');
  selDirection.addEventListener('change', () => remplir(selDirection.value, ''));
}

// ---------------- Personnel : formulaire création / modification ----------------
async function vuePersonnelFormulaire(id) {
  definirTitre(id ? "Modifier l'agent" : 'Nouvel agent');
  let agent = {};
  if (id) {
    document.getElementById('vue').innerHTML = '<p class="text-muted">Chargement…</p>';
    agent = await API.get(`/agents/${id}`);
  }
  document.getElementById('vue').innerHTML = VUES.formulaireAgent(agent);
  document.getElementById('btn-annuler-form').addEventListener('click', () => {
    window.location.hash = id ? `#personnel/${id}` : '#personnel';
  });
  cablerSelectDirectionService(agent.direction, agent.service);
  document.getElementById('form-agent').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      if (id) {
        await API.put(`/agents/${id}`, fd, { isForm: true });
        afficherAlerte('Agent modifié avec succès.', 'succes');
        window.location.hash = `#personnel/${id}`;
      } else {
        const res = await API.post('/agents', fd, { isForm: true });
        afficherAlerte(`Agent créé avec succès (matricule ${res.matricule}).`, 'succes');
        window.location.hash = `#personnel/${res.id}`;
      }
    } catch (err) { afficherAlerte(err.message, 'erreur'); }
  });
}

// ---------------- Utilisateurs (admin) ----------------
async function vueUtilisateurs() {
  definirTitre('Utilisateurs');
  document.getElementById('vue').innerHTML = '<p class="text-muted">Chargement…</p>';
  const utilisateurs = await API.get('/users');
  rendreUtilisateurs(utilisateurs);
}

function rendreUtilisateurs(utilisateurs) {
  document.getElementById('vue').innerHTML = VUES.listeUtilisateurs(utilisateurs);
  document.getElementById('btn-nouvel-utilisateur').addEventListener('click', () => ouvrirFormulaireUtilisateur());
  document.querySelectorAll('[data-modifier-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = utilisateurs.find(x => x.id == btn.dataset.modifierUser);
      ouvrirFormulaireUtilisateur(u);
    });
  });
  document.querySelectorAll('[data-suppr-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmerAction('Supprimer cet utilisateur', 'Voulez-vous vraiment supprimer ce compte ?', 'Supprimer');
      if (!ok) return;
      try {
        await API.del(`/users/${btn.dataset.supprUser}`);
        afficherAlerte('Utilisateur supprimé.', 'succes');
        vueUtilisateurs();
      } catch (err) { afficherAlerte(err.message, 'erreur'); }
    });
  });
}

async function ouvrirFormulaireUtilisateur(u) {
  let agents = [];
  try {
    agents = await API.get('/agents');
  } catch (err) {
    afficherAlerte(err.message || 'Impossible de charger la liste des agents.', 'erreur');
  }
  ouvrirModale(VUES.formulaireUtilisateur(u || {}, agents));
  const boite = document.getElementById('modale-boite');
  boite.querySelector('[data-fermer]').addEventListener('click', fermerModale);
  boite.querySelector('[data-annuler]').addEventListener('click', fermerModale);

  const selRole = document.getElementById('select-role-utilisateur');
  const champAgentLie = document.getElementById('champ-agent-lie');
  selRole.addEventListener('change', () => {
    champAgentLie.classList.toggle('cache', selRole.value !== 'agent');
  });

  boite.querySelector('#form-utilisateur').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    if (payload.password === '') delete payload.password;
    if ('actif' in payload) payload.actif = payload.actif === '1';
    try {
      if (u && u.id) await API.put(`/users/${u.id}`, payload);
      else await API.post('/users', payload);
      fermerModale();
      afficherAlerte(u && u.id ? 'Utilisateur modifié.' : 'Utilisateur créé.', 'succes');
      vueUtilisateurs();
    } catch (err) { afficherAlerte(err.message, 'erreur'); }
  });
}

function ouvrirChangementMdp() {
  ouvrirModale(`
    <form id="form-mdp">
      <div class="modale-entete"><h3>Changer mon mot de passe</h3><button type="button" class="modale-fermer" data-fermer>✕</button></div>
      <div class="modale-corps">
        <div class="champ mb-16"><label>Mot de passe actuel</label><input type="password" name="ancien_mot_de_passe" required></div>
        <div class="champ"><label>Nouveau mot de passe</label><input type="password" name="nouveau_mot_de_passe" required></div>
      </div>
      <div class="modale-pied">
        <button type="button" class="btn btn-fantome" data-annuler>Annuler</button>
        <button type="submit" class="btn btn-primary">Valider</button>
      </div>
    </form>
  `);
  const boite = document.getElementById('modale-boite');
  boite.querySelector('[data-fermer]').addEventListener('click', fermerModale);
  boite.querySelector('[data-annuler]').addEventListener('click', fermerModale);
  boite.querySelector('#form-mdp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await API.post('/auth/change-password', payload);
      fermerModale();
      afficherAlerte('Mot de passe modifié avec succès.', 'succes');
    } catch (err) { afficherAlerte(err.message, 'erreur'); }
  });
}

// ---------------- Rapports ----------------
async function vueRapportsAffichage() {
  definirTitre('Rapports');
  document.getElementById('vue').innerHTML = '<p class="text-muted">Chargement…</p>';
  const stats = await API.get('/reports/stats');
  document.getElementById('vue').innerHTML = VUES.rapports(stats);
  document.getElementById('btn-imprimer-rapport').addEventListener('click', () => imprimerRapport(stats));
}

// ---------------- Paramètres (admin) ----------------
async function vueParametresAffichage() {
  definirTitre('Paramètres');
  document.getElementById('vue').innerHTML = '<p class="text-muted">Chargement…</p>';
  const journal = await API.get('/backup/journal');
  document.getElementById('vue').innerHTML = VUES.parametres(journal);

  document.getElementById('btn-export-backup').addEventListener('click', async () => {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await API.telechargerFichier('/backup/export', `mali_meteo_rh_sauvegarde_${stamp}.zip`);
    } catch (err) { afficherAlerte(err.message, 'erreur'); }
  });

  document.getElementById('form-restore').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await confirmerAction('Restaurer la base de données', 'Toutes les données actuelles seront remplacées par celles de la sauvegarde. Continuer ?', 'Restaurer');
    if (!ok) return;
    const fd = new FormData(e.target);
    try {
      const res = await API.post('/backup/restore', fd, { isForm: true });
      afficherAlerte(res.message, 'succes');
      vueParametresAffichage();
    } catch (err) { afficherAlerte(err.message, 'erreur'); }
  });
}

// ---------------- Impression ----------------
function enteteImpression(titre) {
  return `
    <div class="imp-entete">
      <div class="imp-entete-gauche">
        <img src="/assets/logo-mali-meteo.png" alt="" class="imp-logo">
        <div>
          <h1>MALI-MÉTÉO — ${esc(titre)}</h1>
          <div class="tricolore-imp"><span></span><span></span><span></span></div>
        </div>
      </div>
      <div style="text-align:right;font-size:11px;color:#555">
        Édité le ${new Date().toLocaleDateString('fr-FR')} par ${esc(UTILISATEUR.nom_complet)}
      </div>
    </div>
  `;
}

function imprimerFicheAgent(a, affectations) {
  const zone = document.getElementById('zone-impression');
  zone.innerHTML = `
    ${enteteImpression('Fiche agent')}
    <table class="imp-table">
      <tr><th>Matricule</th><td>${esc(a.matricule)}</td><th>Statut</th><td>${esc(a.statut)}</td></tr>
      <tr><th>Nom</th><td>${esc(a.nom)}</td><th>Prénom</th><td>${esc(a.prenom)}</td></tr>
      <tr><th>Sexe</th><td>${a.sexe === 'F' ? 'Féminin' : a.sexe === 'M' ? 'Masculin' : '—'}</td><th>Date de naissance</th><td>${formatDate(a.date_naissance)}</td></tr>
      <tr><th>Lieu de naissance</th><td>${esc(a.lieu_naissance) || '—'}</td><th>Situation matrimoniale</th><td>${esc(a.situation_matrimoniale) || '—'}</td></tr>
      <tr><th>Téléphone</th><td>${esc(a.telephone) || '—'}</td><th>E-mail</th><td>${esc(a.email) || '—'}</td></tr>
      <tr><th>Adresse</th><td colspan="3">${esc(a.adresse) || '—'}</td></tr>
      <tr><th>Fonction</th><td>${esc(a.fonction) || '—'}</td><th>Direction / service</th><td>${esc(a.direction) || '—'}${a.service ? ' / ' + esc(a.service) : ''}</td></tr>
      <tr><th>Type de contrat</th><td>${esc(a.type_contrat) || '—'}</td><th>Date d'embauche</th><td>${formatDate(a.date_embauche)}</td></tr>
      <tr><th>Catégorie</th><td>${esc(a.categorie) || '—'}</td><th>Diplôme</th><td>${esc(a.diplome) || '—'}</td></tr>
    </table>
    <p style="margin-top:16px;font-weight:bold;font-size:12px">Historique des affectations</p>
    <table class="imp-table">
      <thead><tr><th>Direction / service</th><th>Fonction</th><th>Début</th><th>Fin</th></tr></thead>
      <tbody>${affectations.map(af => `<tr><td>${esc(af.direction)}${af.service ? ' / ' + esc(af.service) : ''}</td><td>${esc(af.fonction) || '—'}</td><td>${formatDate(af.date_debut)}</td><td>${af.date_fin ? formatDate(af.date_fin) : "En cours"}</td></tr>`).join('') || '<tr><td colspan="4">Aucune</td></tr>'}</tbody>
    </table>
    <p class="imp-pied">Document généré par l'application de gestion du personnel de Mali-Météo.</p>
  `;
  window.print();
}

function imprimerListePersonnel(agents) {
  const zone = document.getElementById('zone-impression');
  zone.innerHTML = `
    ${enteteImpression('Liste du personnel')}
    <table class="imp-table">
      <thead><tr><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Fonction</th><th>Direction / service</th><th>Contrat</th><th>Statut</th></tr></thead>
      <tbody>
        ${agents.map(a => `<tr><td>${esc(a.matricule)}</td><td>${esc(a.nom)}</td><td>${esc(a.prenom)}</td><td>${esc(a.fonction) || '—'}</td><td>${esc(a.direction) || '—'}${a.service ? ' / ' + esc(a.service) : ''}</td><td>${esc(a.type_contrat) || '—'}</td><td>${esc(a.statut)}</td></tr>`).join('')}
      </tbody>
    </table>
    <p class="imp-pied">Effectif total : ${agents.length} agent(s) — Document généré par l'application de gestion du personnel de Mali-Météo.</p>
  `;
  window.print();
}

function imprimerRapport(stats) {
  const zone = document.getElementById('zone-impression');
  const table = (titre, liste, cle) => `
    <p style="margin-top:14px;font-weight:bold;font-size:12px">${esc(titre)}</p>
    <table class="imp-table"><thead><tr><th>${esc(titre)}</th><th>Effectif</th></tr></thead>
      <tbody>${liste.map(l => `<tr><td>${esc(l[cle])}</td><td>${l.total}</td></tr>`).join('')}</tbody></table>
  `;
  zone.innerHTML = `
    ${enteteImpression('Rapport statistique du personnel')}
    <p style="font-size:13px">Effectif total : <strong>${stats.total}</strong> agent(s)</p>
    ${table('Direction / service', stats.parDirection, 'direction')}
    ${table('Type de contrat', stats.parContrat, 'type_contrat')}
    ${table('Statut', stats.parStatut, 'statut')}
    ${table('Catégorie professionnelle', stats.parCategorie, 'categorie')}
    <p class="imp-pied">Document généré par l'application de gestion du personnel de Mali-Météo.</p>
  `;
  window.print();
}
