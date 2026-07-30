// ============ Gabarits HTML des vues ============
// Ces fonctions ne font que retourner du HTML (aucun accès réseau ici).

const VUES = {};

// ---------------- Tableau de bord ----------------
VUES.tableauBord = function (stats) {
  const rep = (liste, cle) => {
    const max = Math.max(1, ...liste.map(l => l.total));
    return liste.slice(0, 8).map(l => `
      <div class="ligne-repartition">
        <span class="nom" title="${esc(l[cle])}">${esc(l[cle])}</span>
        <span class="barre-fond"><span class="barre-remplie" style="width:${Math.round(l.total / max * 100)}%"></span></span>
        <span class="total">${l.total}</span>
      </div>`).join('') || '<p class="text-muted text-sm">Aucune donnée</p>';
  };
  const nbActifs = (stats.parStatut.find(s => s.statut === 'Actif') || {}).total || 0;
  const nbDirections = stats.parDirection.length;
  const nbFemmes = (stats.parSexe.find(s => s.sexe === 'F') || {}).total || 0;

  return `
    <div class="cartes-stats">
      <div class="carte-stat accent-ciel"><div class="valeur">${stats.total}</div><div class="libelle">Agents au total</div></div>
      <div class="carte-stat accent-vert"><div class="valeur">${nbActifs}</div><div class="libelle">Agents actifs</div></div>
      <div class="carte-stat accent-or"><div class="valeur">${nbDirections}</div><div class="libelle">Directions / services</div></div>
      <div class="carte-stat accent-rouge"><div class="valeur">${nbFemmes}</div><div class="libelle">Femmes</div></div>
    </div>
    <div class="grille-2">
      <div class="panneau"><h3>Répartition par direction / service</h3><div class="barre-repartition">${rep(stats.parDirection, 'direction')}</div></div>
      <div class="panneau"><h3>Répartition par type de contrat</h3><div class="barre-repartition">${rep(stats.parContrat, 'type_contrat')}</div></div>
      <div class="panneau"><h3>Répartition par statut</h3><div class="barre-repartition">${rep(stats.parStatut, 'statut')}</div></div>
      <div class="panneau"><h3>Répartition par type de personnel</h3><div class="barre-repartition">${rep(stats.parCategorie, 'categorie')}</div></div>
    </div>
  `;
};

// ---------------- Liste du personnel ----------------
VUES.listePersonnel = function (agents, peutGerer) {
  const lignes = agents.map(a => `
    <tr class="lien-ligne" data-id="${a.id}">
      <td>
        <div class="cellule-agent">
          <div class="mini-avatar">${a.photo_path ? `<img src="${esc(a.photo_path)}" alt="">` : initiales(a.nom, a.prenom)}</div>
          <div><strong>${esc(a.nom)} ${esc(a.prenom)}</strong><div class="text-muted text-sm">${esc(a.matricule)}</div></div>
        </div>
      </td>
      <td>${esc(a.fonction || '—')}</td>
      <td>${esc(a.direction || '—')}${a.service ? ' / ' + esc(a.service) : ''}</td>
      <td>${esc(a.type_contrat || '—')}</td>
      <td>${badgeStatut(a.statut)}</td>
      <td>${esc(a.telephone || '—')}</td>
      <td>${esc(a.email || '—')}</td>
    </tr>
  `).join('');

  return `
    <div class="barre-outils">
      <div class="champ-recherche"><input type="text" id="recherche-agent" placeholder="Rechercher par nom, prénom, matricule, fonction…"></div>
      <select id="filtre-statut" class="filtre">
        <option value="">Tous les statuts</option>
        <option>Actif</option><option>En congé</option><option>Suspendu</option><option>Retraité</option>
      </select>
      <button id="btn-imprimer-liste" class="btn btn-fantome">🖶 Imprimer la liste</button>
      ${peutGerer ? '<button id="btn-nouvel-agent" class="btn btn-primary">+ Nouvel agent</button>' : ''}
    </div>
    <div class="table-wrap">
      ${agents.length ? `
      <table>
        <thead><tr><th>Agent</th><th>Fonction</th><th>Direction / service</th><th>Contrat</th><th>Statut</th><th>Téléphone</th><th>E-mail</th></tr></thead>
        <tbody id="corps-table-agents">${lignes}</tbody>
      </table>` : `
      <div class="etat-vide"><div class="icone">👤</div><p>Aucun agent ne correspond à votre recherche.</p></div>`}
    </div>
  `;
};

// ---------------- Fiche agent ----------------
VUES.ficheAgent = function (a, donnees, peutGerer) {
  const { affectations, documents, enfants, carriere, conges, diplomes } = donnees;
  const ligne = (lib, val) => `<div class="ligne-info"><span class="lib">${esc(lib)}</span><span class="val">${esc(val ?? '—') || '—'}</span></div>`;

  const affectationsHtml = affectations.length ? affectations.map(af => `
    <div class="ligne-info">
      <span class="lib">${esc(af.direction)}${af.service ? ' / ' + esc(af.service) : ''} ${af.fonction ? '· ' + esc(af.fonction) : ''}</span>
      <span class="val">${formatDate(af.date_debut)} → ${af.date_fin ? formatDate(af.date_fin) : "aujourd'hui"}</span>
    </div>`).join('') : '<p class="text-muted text-sm">Aucune affectation enregistrée.</p>';

  const actesNaissanceAgent = documents.filter(d => d.type_document === 'Acte de naissance');
  const autresDocuments = documents.filter(d => d.type_document !== 'Acte de naissance');

  const documentsHtml = autresDocuments.length ? autresDocuments.map(d => `
    <div class="ligne-info">
      <span class="lib">📄 ${esc(d.nom_document)} <span class="text-muted">(${esc(d.type_document)})</span></span>
      <span class="val">
        <a href="${esc(d.chemin_fichier)}" target="_blank" rel="noopener">Voir</a>
        ${peutGerer ? ` · <a href="#" data-suppr-doc="${d.id}" style="color:var(--rouge)">Supprimer</a>` : ''}
      </span>
    </div>`).join('') : '<p class="text-muted text-sm">Aucun document.</p>';

  const acteNaissanceAgentHtml = actesNaissanceAgent.length ? actesNaissanceAgent.map(d => `
    <div class="ligne-info">
      <span class="lib">📄 ${esc(d.nom_document)}</span>
      <span class="val">
        <a href="${esc(d.chemin_fichier)}" target="_blank" rel="noopener">Voir</a>
        ${peutGerer ? ` · <a href="#" data-suppr-doc="${d.id}" style="color:var(--rouge)">Supprimer</a>` : ''}
      </span>
    </div>`).join('') : '<p class="text-muted text-sm">Aucun acte de naissance déposé.</p>';

  const enfantsHtml = enfants.length ? enfants.map(e => `
    <div class="ligne-info">
      <span class="lib">${esc(e.nom)} ${esc(e.prenom)}${e.date_naissance ? ' — né(e) le ' + formatDate(e.date_naissance) : ''}${e.remarques ? ' · ' + esc(e.remarques) : ''}</span>
      <span class="val">
        ${e.acte_naissance_path ? `<a href="${esc(e.acte_naissance_path)}" target="_blank" rel="noopener">Voir l'acte</a>` : '<span class="text-muted">Aucun acte</span>'}
        ${peutGerer ? ` · <a href="#" data-suppr-enfant="${e.id}" style="color:var(--rouge)">Supprimer</a>` : ''}
      </span>
    </div>`).join('') : '<p class="text-muted text-sm">Aucun enfant enregistré.</p>';

  const carriereHtml = carriere.length ? carriere.map(c => `
    <div class="ligne-info">
      <span class="lib">${esc(c.type_evenement)}${c.grade ? ' — ' + esc(c.grade) : ''}${c.echelon ? ' (éch. ' + esc(c.echelon) + ')' : ''}${c.reference_decision ? ' · réf. ' + esc(c.reference_decision) : ''}</span>
      <span class="val">${formatDate(c.date_effet)}${peutGerer ? ` · <a href="#" data-suppr-carriere="${c.id}" style="color:var(--rouge)">Supprimer</a>` : ''}</span>
    </div>`).join('') : '<p class="text-muted text-sm">Aucun événement de carrière enregistré.</p>';

  const congesHtml = conges.length ? conges.map(c => `
    <div class="ligne-info">
      <span class="lib">${esc(c.type_conge)}${c.motif ? ' — ' + esc(c.motif) : ''} ${badgeCongeStatut(c.statut)}</span>
      <span class="val">${formatDate(c.date_debut)} → ${c.date_fin ? formatDate(c.date_fin) : '—'}${c.nombre_jours ? ` (${c.nombre_jours} j)` : ''}${peutGerer ? ` · <a href="#" data-suppr-conge="${c.id}" style="color:var(--rouge)">Supprimer</a>` : ''}</span>
    </div>`).join('') : '<p class="text-muted text-sm">Aucun congé/permission enregistré.</p>';

  const diplomesHtml = diplomes.length ? diplomes.map(d => `
    <div class="ligne-info">
      <span class="lib">🎓 ${esc(d.intitule)} <span class="text-muted">(${esc(d.type_diplome || 'Diplôme')})</span>${d.etablissement ? ' — ' + esc(d.etablissement) : ''}${d.annee_obtention ? ' · ' + esc(d.annee_obtention) : ''}</span>
      <span class="val">
        ${d.fichier_path ? `<a href="${esc(d.fichier_path)}" target="_blank" rel="noopener">Voir</a>` : '<span class="text-muted">Aucun fichier</span>'}
        ${peutGerer ? ` · <a href="#" data-suppr-diplome="${d.id}" style="color:var(--rouge)">Supprimer</a>` : ''}
      </span>
    </div>`).join('') : '<p class="text-muted text-sm">Aucun diplôme/attestation enregistré.</p>';

  return `
    <div class="fiche-entete">
      <div class="fiche-photo">${a.photo_path ? `<img src="${esc(a.photo_path)}" alt="">` : initiales(a.nom, a.prenom)}</div>
      <div class="fiche-identite">
        <h3>${esc(a.nom)} ${esc(a.prenom)}</h3>
        <div class="matricule">Matricule : ${esc(a.matricule)}</div>
        <div class="fonction">${esc(a.fonction || 'Fonction non renseignée')} — ${esc(a.direction || 'Direction non renseignée')}${a.service ? ' / ' + esc(a.service) : ''}</div>
        <div class="mt-16">${badgeStatut(a.statut)}</div>
      </div>
      <div class="droite">
        <button id="btn-imprimer-fiche" class="btn btn-fantome">🖶 Imprimer</button>
        ${peutGerer ? `
          <button id="btn-modifier-agent" class="btn btn-secondary">✎ Modifier</button>
          <button id="btn-supprimer-agent" class="btn btn-danger">🗑 Supprimer</button>` : ''}
      </div>
    </div>
    <div class="grille-fiche">
      <div class="bloc-info"><h4>Identité</h4>
        ${ligne('Sexe', a.sexe === 'F' ? 'Féminin' : a.sexe === 'M' ? 'Masculin' : null)}
        ${ligne('Date de naissance', a.date_naissance ? formatDate(a.date_naissance) : null)}
        ${ligne('Lieu de naissance', a.lieu_naissance)}
        ${ligne('Situation matrimoniale', a.situation_matrimoniale)}
        ${ligne('Nombre d\'enfants', a.nombre_enfants ?? 0)}
      </div>
      <div class="bloc-info"><h4>Contact</h4>
        ${ligne('Téléphone', a.telephone)}
        ${ligne('E-mail', a.email)}
        ${ligne('Adresse', a.adresse)}
      </div>
      <div class="bloc-info"><h4>Situation professionnelle</h4>
        ${ligne('Fonction', a.fonction)}
        ${ligne('Direction', a.direction)}
        ${ligne('Service', a.service)}
        ${ligne('Catégorie', a.categorie)}
        ${ligne('Type de contrat', a.type_contrat)}
        ${ligne('Date d\'embauche', a.date_embauche ? formatDate(a.date_embauche) : null)}
      </div>
      <div class="bloc-info"><h4>Historique des affectations</h4>${affectationsHtml}</div>

      <div class="bloc-info pleine-largeur"><h4>État civil</h4>
        <p class="text-muted text-sm mb-8">Acte de naissance de l'agent</p>
        ${acteNaissanceAgentHtml}
        ${peutGerer ? `
        <form id="form-ajout-acte-agent" class="flex gap-8 mt-8" style="flex-wrap:wrap">
          <input type="file" name="fichier" required>
          <button class="btn btn-sm btn-primary" type="submit">Ajouter l'acte de naissance</button>
        </form>` : ''}
        <p class="text-muted text-sm mb-8 mt-16">Enfants</p>
        ${enfantsHtml}
        ${peutGerer ? `
        <form id="form-ajout-enfant" class="flex gap-8 mt-8" style="flex-wrap:wrap">
          <input type="text" name="nom" placeholder="Nom de l'enfant" required style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="text" name="prenom" placeholder="Prénom de l'enfant" required style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="date" name="date_naissance" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="text" name="remarques" placeholder="Autre information essentielle (optionnel)" style="flex:1;min-width:160px;padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="file" name="acte_naissance" title="Acte de naissance de l'enfant">
          <button class="btn btn-sm btn-primary" type="submit">Ajouter l'enfant</button>
        </form>` : ''}
      </div>

      <div class="bloc-info"><h4>Carrière/emploi</h4>${carriereHtml}
        ${peutGerer ? `
        <form id="form-ajout-carriere" class="flex gap-8 mt-16" style="flex-wrap:wrap">
          <select name="type_evenement" required style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
            <option value="">Type d'événement</option>
            ${['Recrutement','Titularisation','Avancement d\'échelon','Promotion de grade','Nomination','Autre'].map(o => `<option>${o}</option>`).join('')}
          </select>
          <input type="text" name="grade" placeholder="Grade" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="text" name="echelon" placeholder="Échelon" style="width:90px;padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="date" name="date_effet" required style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="text" name="reference_decision" placeholder="Réf. décision/arrêté" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="text" name="observations" placeholder="Observations" style="flex:1;min-width:140px;padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <button class="btn btn-sm btn-primary" type="submit">Ajouter</button>
        </form>` : ''}
      </div>

      <div class="bloc-info"><h4>Congé/Permission</h4>${congesHtml}
        ${peutGerer ? `
        <form id="form-ajout-conge" class="flex gap-8 mt-16" style="flex-wrap:wrap">
          <select name="type_conge" required style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
            <option value="">Type</option>
            ${['Congé annuel','Congé maladie','Congé maternité','Permission','Autre'].map(o => `<option>${o}</option>`).join('')}
          </select>
          <input type="date" name="date_debut" required style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="date" name="date_fin" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="number" min="0" name="nombre_jours" placeholder="Nb jours" style="width:90px;padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="text" name="motif" placeholder="Motif" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <select name="statut" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
            <option>En attente</option><option>Approuvé</option><option>Refusé</option>
          </select>
          <button class="btn btn-sm btn-primary" type="submit">Ajouter</button>
        </form>` : ''}
      </div>

      <div class="bloc-info pleine-largeur"><h4>Diplôme/Attestations</h4>${diplomesHtml}
        ${peutGerer ? `
        <form id="form-ajout-diplome" class="flex gap-8 mt-16" style="flex-wrap:wrap">
          <input type="text" name="intitule" placeholder="Intitulé" required style="flex:1;min-width:140px;padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <select name="type_diplome" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
            <option>Diplôme</option><option>Attestation</option><option>Certificat</option>
          </select>
          <input type="text" name="etablissement" placeholder="Établissement" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="text" name="annee_obtention" placeholder="Année" style="width:80px;padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <input type="file" name="fichier">
          <button class="btn btn-sm btn-primary" type="submit">Ajouter</button>
        </form>` : ''}
      </div>

      <div class="bloc-info pleine-largeur"><h4>Documents administratifs</h4>${documentsHtml}
        ${peutGerer ? `
        <form id="form-ajout-doc" class="flex gap-8 mt-16" style="flex-wrap:wrap">
          <input type="text" name="nom_document" placeholder="Nom du document" required style="flex:1;min-width:140px;padding:8px;border:1.5px solid var(--border);border-radius:6px">
          <select name="type_document" style="padding:8px;border:1.5px solid var(--border);border-radius:6px">
            <option>Contrat</option><option>Pièce d'identité</option><option>Certificat médical</option><option>Acte de naissance</option><option>Autre</option>
          </select>
          <input type="file" name="fichier" required>
          <button class="btn btn-sm btn-primary" type="submit">Ajouter</button>
        </form>` : ''}
      </div>
    </div>
  `;
};

// ---------------- Formulaire agent (création / modification) ----------------
VUES.formulaireAgent = function (a = {}) {
  const sel = (val, opt) => val === opt ? 'selected' : '';
  return `
    <form id="form-agent" class="panneau">
      <div class="section-form">
        <h4>Identité</h4>
        <div class="form-grille">
          <div class="champ"><label>Nom *</label><input name="nom" required value="${esc(a.nom)}"></div>
          <div class="champ"><label>Prénom *</label><input name="prenom" required value="${esc(a.prenom)}"></div>
          <div class="champ"><label>Matricule</label><input name="matricule" value="${esc(a.matricule)}" placeholder="Généré automatiquement si vide" ${a.id ? 'readonly' : ''}></div>
          <div class="champ"><label>Sexe</label>
            <select name="sexe"><option value="">—</option><option value="M" ${sel(a.sexe,'M')}>Masculin</option><option value="F" ${sel(a.sexe,'F')}>Féminin</option></select>
          </div>
          <div class="champ"><label>Date de naissance</label><input type="date" name="date_naissance" value="${esc(a.date_naissance)}"></div>
          <div class="champ"><label>Lieu de naissance</label><input name="lieu_naissance" value="${esc(a.lieu_naissance)}"></div>
          <div class="champ"><label>Situation matrimoniale</label>
            <select name="situation_matrimoniale">
              <option value="">—</option>
              ${['Célibataire','Marié(e)','Divorcé(e)','Veuf(ve)'].map(o => `<option ${sel(a.situation_matrimoniale,o)}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="champ"><label>Nombre d'enfants</label><input type="number" min="0" name="nombre_enfants" value="${a.nombre_enfants ?? 0}"></div>
          <div class="champ"><label>Photo</label><input type="file" name="photo" accept="image/*"></div>
        </div>
      </div>
      <div class="section-form">
        <h4>Contact</h4>
        <div class="form-grille">
          <div class="champ"><label>Téléphone</label><input name="telephone" value="${esc(a.telephone)}"></div>
          <div class="champ"><label>E-mail</label><input type="email" name="email" value="${esc(a.email)}"></div>
          <div class="champ pleine-largeur"><label>Adresse</label><input name="adresse" value="${esc(a.adresse)}"></div>
        </div>
      </div>
      <div class="section-form">
        <h4>Situation professionnelle</h4>
        <div class="form-grille">
          <div class="champ"><label>Fonction</label><input name="fonction" value="${esc(a.fonction)}"></div>
          <div class="champ"><label>Direction</label>
            <select name="direction" id="select-direction">
              <option value="">—</option>
              ${Object.keys(ORGANISATION).map(d => `<option ${sel(a.direction,d)}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="champ"><label>Service</label>
            <select name="service" id="select-service">
              <option value="">—</option>
            </select>
          </div>
          <div class="champ"><label>Catégorie professionnelle / Type de personnel</label>
            <select name="categorie">
              <option value="">—</option>
              ${TYPES_PERSONNEL.map(o => `<option ${sel(a.categorie,o)}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="champ"><label>Type de contrat</label>
            <select name="type_contrat">
              <option value="">—</option>
              ${['Fonctionnaire','Contractuel','Conventionnel','Stagiaire','Consultant','Journalier'].map(o => `<option ${sel(a.type_contrat,o)}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="champ"><label>Date d'embauche</label><input type="date" name="date_embauche" value="${esc(a.date_embauche)}"></div>
          <div class="champ"><label>Statut</label>
            <select name="statut">
              ${['Actif','En congé','Suspendu','Retraité'].map(o => `<option ${sel(a.statut || 'Actif',o)}>${o}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="actions-form">
        <button type="button" class="btn btn-fantome" id="btn-annuler-form">Annuler</button>
        <button type="submit" class="btn btn-primary">${a.id ? 'Enregistrer les modifications' : "Créer l'agent"}</button>
      </div>
    </form>
  `;
};

// ---------------- Utilisateurs ----------------
VUES.listeUtilisateurs = function (utilisateurs) {
  const lignes = utilisateurs.map(u => `
    <tr>
      <td><strong>${esc(u.username)}</strong></td>
      <td>${esc(u.nom_complet)}</td>
      <td><span class="badge badge-role">${esc(libelleRole(u.role))}</span></td>
      <td>${u.role === 'agent' && u.agent_nom ? `${esc(u.agent_nom)} ${esc(u.agent_prenom)} <span class="text-muted text-sm">(${esc(u.agent_matricule)})</span>` : '—'}</td>
      <td>${u.actif ? '<span class="badge badge-actif">Actif</span>' : '<span class="badge badge-suspendu">Désactivé</span>'}</td>
      <td>${formatDate(u.date_creation)}</td>
      <td>
        <button class="btn btn-sm btn-fantome" data-modifier-user="${u.id}">Modifier</button>
        ${u.username !== 'admin' ? `<button class="btn btn-sm btn-danger" data-suppr-user="${u.id}">Supprimer</button>` : ''}
      </td>
    </tr>
  `).join('');
  return `
    <div class="barre-outils">
      <div style="flex:1"></div>
      <button id="btn-nouvel-utilisateur" class="btn btn-primary">+ Nouvel utilisateur</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Identifiant</th><th>Nom complet</th><th>Rôle</th><th>Fiche liée</th><th>État</th><th>Créé le</th><th>Actions</th></tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
  `;
};

VUES.formulaireUtilisateur = function (u = {}, agentsDisponibles = []) {
  const sel = (val, opt) => val === opt ? 'selected' : '';
  const optionsAgents = agentsDisponibles.map(a => `
    <option value="${a.id}" ${Number(u.agent_id) === a.id ? 'selected' : ''}>${esc(a.nom)} ${esc(a.prenom)} — ${esc(a.matricule)}</option>
  `).join('');
  return `
    <form id="form-utilisateur">
      <div class="modale-entete"><h3>${u.id ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</h3><button type="button" class="modale-fermer" data-fermer>✕</button></div>
      <div class="modale-corps">
        <div class="form-grille">
          <div class="champ pleine-largeur"><label>Nom complet *</label><input name="nom_complet" required value="${esc(u.nom_complet)}"></div>
          <div class="champ"><label>Identifiant *</label><input name="username" required value="${esc(u.username)}" ${u.id ? 'readonly' : ''}></div>
          <div class="champ"><label>Rôle *</label>
            <select name="role" id="select-role-utilisateur" ${u.username === 'admin' ? 'disabled' : ''} required>
              <option value="admin" ${sel(u.role,'admin')}>Administrateur</option>
              <option value="daf" ${sel(u.role,'daf')}>DAF</option>
              <option value="grh" ${sel(u.role,'grh')}>GRH</option>
              <option value="agent" ${sel(u.role,'agent')}>Agent (accès à sa fiche uniquement)</option>
            </select>
          </div>
          <div class="champ"><label>${u.id ? 'Nouveau mot de passe' : 'Mot de passe *'}</label>
            <input type="password" name="password" ${u.id ? 'placeholder="Laisser vide pour ne pas changer"' : 'required'}>
          </div>
          <div class="champ pleine-largeur ${u.role === 'agent' ? '' : 'cache'}" id="champ-agent-lie">
            <label>Fiche agent liée *</label>
            <select name="agent_id">
              <option value="">— Sélectionner —</option>
              ${optionsAgents}
            </select>
          </div>
          ${u.id ? `<div class="champ"><label>État du compte</label>
            <select name="actif"><option value="1" ${u.actif ? 'selected' : ''}>Actif</option><option value="0" ${!u.actif ? 'selected' : ''}>Désactivé</option></select>
          </div>` : ''}
        </div>
      </div>
      <div class="modale-pied">
        <button type="button" class="btn btn-fantome" data-annuler>Annuler</button>
        <button type="submit" class="btn btn-primary">${u.id ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </form>
  `;
};

// ---------------- Rapports ----------------
VUES.rapports = function (stats) {
  const rep = (liste, cle) => liste.map(l => `<tr><td>${esc(l[cle])}</td><td>${l.total}</td></tr>`).join('');
  return `
    <div class="barre-outils"><div style="flex:1"></div><button id="btn-imprimer-rapport" class="btn btn-primary">🖶 Imprimer le rapport</button></div>
    <div class="grille-2">
      <div class="panneau"><h3>Effectif par direction / service</h3>
        <table><thead><tr><th>Direction / service</th><th>Effectif</th></tr></thead><tbody>${rep(stats.parDirection, 'direction')}</tbody></table>
      </div>
      <div class="panneau"><h3>Effectif par type de contrat</h3>
        <table><thead><tr><th>Type de contrat</th><th>Effectif</th></tr></thead><tbody>${rep(stats.parContrat, 'type_contrat')}</tbody></table>
      </div>
      <div class="panneau"><h3>Effectif par statut</h3>
        <table><thead><tr><th>Statut</th><th>Effectif</th></tr></thead><tbody>${rep(stats.parStatut, 'statut')}</tbody></table>
      </div>
      <div class="panneau"><h3>Effectif par type de personnel</h3>
        <table><thead><tr><th>Type de personnel</th><th>Effectif</th></tr></thead><tbody>${rep(stats.parCategorie, 'categorie')}</tbody></table>
      </div>
    </div>
  `;
};

// ---------------- Paramètres (admin) ----------------
VUES.parametres = function (journal) {
  const lignes = journal.map(j => `
    <div class="journal-item">
      <span class="date">${formatDateHeure(j.date_action)}</span>
      <span><span class="action">${esc(j.action)}</span> — ${esc(j.details || '')} <span class="text-muted">(${esc(j.username || 'système')})</span></span>
    </div>
  `).join('') || '<p class="text-muted text-sm">Aucune activité enregistrée.</p>';

  return `
    <div class="grille-2">
      <div class="panneau">
        <h3>Sauvegarde de la base de données</h3>
        <p class="text-muted text-sm mb-16">Télécharge une archive .zip complète : données (utilisateurs, personnel, documents) et fichiers (photos, pièces jointes).</p>
        <button id="btn-export-backup" class="btn btn-primary">⬇ Télécharger une sauvegarde</button>
      </div>
      <div class="panneau">
        <h3>Restauration de la base de données</h3>
        <p class="text-muted text-sm mb-16">Restaurer une sauvegarde précédente. <strong>Cette action remplace toutes les données actuelles.</strong></p>
        <form id="form-restore" class="flex gap-8">
          <input type="file" name="fichier" accept=".zip" required>
          <button class="btn btn-danger" type="submit">Restaurer</button>
        </form>
      </div>
    </div>
    <div class="panneau mt-16">
      <h3>Journal d'activité récent</h3>
      <div>${lignes}</div>
    </div>
  `;
};
