// ============ Utilitaires d'interface ============

// Organigramme Directions / Services de Mali-Météo. Une direction sans liste
// (Agence Comptable) n'a pas de service : le champ Service reste vide/masqué.
const ORGANISATION = {
  'DECA': ['SCCC', 'SA'],
  'DIPM': ['SIGROM', 'SPM'],
  'DAF': ['SGRH', 'SBA'],
  'Agence Comptable': [],
};

// Nom complet de chaque service, affiché en infobulle au survol de son
// abréviation partout où elle apparaît (formulaire, fiche agent, historique
// des affectations, impressions).
const SERVICES_NOMS = {
  'SIGROM': "Service Infrastructure et Gestion du Réseau d'Observation Météorologique",
  'SPM': 'Service Prévision Météorologique',
  'SCCC': 'Service Climatologie et Changement Climatique',
  'SA': 'Service Agrométéorologie',
  'SGRH': 'Service Gestion des Ressources Humaines',
  'SBA': 'Service Budget et Approvisionnement',
};

// Bureaux rattachés à chaque service : second niveau du menu en cascade
// Direction > Service > Bureau du formulaire agent.
const BUREAUX = {
  'SIGROM': ['Bureau Infrastructure et Équipements', "Bureau Gestion du Réseau d'Observation Météorologique"],
  'SPM': ['Bureau Prévision Météorologique', 'Bureau Veille et Alertes Météorologiques'],
  'SCCC': ['Bureau Archives des Données Climatologiques', 'Bureau des Services Climatologiques et du Cadre National des Services Climatologiques'],
  'SA': ['Bureau Assistance au Monde Rural', 'Bureau Développement Agrométéorologique'],
  'SGRH': ['Bureau Emploi, Carrière et Formation', 'Bureau Solde et Affaires Sociales'],
  'SBA': ['Bureau Budget', 'Bureau Approvisionnement'],
};

// Types de personnel (catégorie professionnelle) : liste fixe utilisée à la
// fois par le formulaire agent et par la répartition du tableau de bord.
const TYPES_PERSONNEL = [
  'Personnel Administratif',
  'Personnel Observateurs',
  'Personnel Ingénieurs',
  'Personnel Techniciens et Techniciens Supérieurs',
  'Personnel Chauffeurs et Plantons',
];

function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// Affiche une abréviation avec le nom complet correspondant en infobulle
// (survol de la souris) quand ce nom est connu dans `dico`, sinon
// l'abréviation seule. Retourne du HTML déjà échappé, à insérer tel quel.
function libelleAbrev(valeur, dico) {
  if (!valeur) return '';
  const complet = dico[valeur];
  return complet ? `<span title="${esc(complet)}">${esc(valeur)}</span>` : esc(valeur);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso.replace(' ', 'T'));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR');
}

function formatDateHeure(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return iso;
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function initiales(nom, prenom) {
  return `${(prenom || '?')[0] || ''}${(nom || '?')[0] || ''}`.toUpperCase();
}

function libelleRole(role) {
  return { admin: 'Administrateur', daf: 'DAF', grh: 'GRH', agent: 'Agent' }[role] || role;
}

function badgeStatut(statut) {
  const map = {
    'Actif': 'badge-actif', 'En congé': 'badge-conge',
    'Suspendu': 'badge-suspendu', 'Retraité': 'badge-retraite'
  };
  return `<span class="badge ${map[statut] || 'badge-actif'}">${esc(statut || 'Actif')}</span>`;
}

function badgeCongeStatut(statut) {
  const map = { 'Approuvé': 'badge-actif', 'En attente': 'badge-conge', 'Refusé': 'badge-suspendu' };
  return `<span class="badge ${map[statut] || 'badge-conge'}">${esc(statut || 'En attente')}</span>`;
}

let timeoutAlerte = null;
function afficherAlerte(message, type = 'info', dureeMs = 4500) {
  const el = document.getElementById('alerte-globale');
  el.className = `alerte alerte-${type}`;
  el.textContent = message;
  el.classList.remove('cache');
  clearTimeout(timeoutAlerte);
  timeoutAlerte = setTimeout(() => el.classList.add('cache'), dureeMs);
}

// ---------- Modale générique ----------
function ouvrirModale(html, { large = false } = {}) {
  const boite = document.getElementById('modale-boite');
  boite.className = 'modale-boite' + (large ? ' large' : '');
  boite.innerHTML = html;
  document.getElementById('modale-overlay').classList.remove('cache');
}
function fermerModale() {
  document.getElementById('modale-overlay').classList.add('cache');
  document.getElementById('modale-boite').innerHTML = '';
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modale-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modale-overlay') fermerModale();
  });
});

function confirmerAction(titre, message, libelleBouton = 'Confirmer', variante = 'btn-danger') {
  return new Promise((resolve) => {
    ouvrirModale(`
      <div class="modale-entete"><h3>${esc(titre)}</h3><button class="modale-fermer" data-fermer>✕</button></div>
      <div class="modale-corps"><p>${esc(message)}</p></div>
      <div class="modale-pied">
        <button class="btn btn-fantome" data-annuler>Annuler</button>
        <button class="btn ${variante}" data-confirmer>${esc(libelleBouton)}</button>
      </div>
    `);
    const boite = document.getElementById('modale-boite');
    boite.querySelector('[data-fermer]').onclick = () => { fermerModale(); resolve(false); };
    boite.querySelector('[data-annuler]').onclick = () => { fermerModale(); resolve(false); };
    boite.querySelector('[data-confirmer]').onclick = () => { fermerModale(); resolve(true); };
  });
}
