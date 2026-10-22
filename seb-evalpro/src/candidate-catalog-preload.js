const { ipcRenderer } = require('electron');
const bilanHistory = require('./bilan-history-preload');
const replayPreload = require('./replay-preload');
const editionCapabilities = ipcRenderer.sendSync('app:edition-sync') || { edition:'unified', canBilan:true };

let installed = false;
let beforeAdminNavigate = null;
let importCandidatesAction = null;
let exportCandidatesAction = null;

function isCandidateAdminHost() {
  try { return /\/admin-candidats\.html$/i.test(decodeURIComponent(window.location.pathname)); }
  catch (_) { return false; }
}

function requestedCandidateId() {
  try { return String(new URL(window.location.href).searchParams.get('candidateId') || '').trim(); }
  catch (_) { return ''; }
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function norm(value) {
  let text = String(value == null ? '' : value);
  try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
  return text.toLocaleLowerCase('fr-FR').replace(/\s+/g,' ').trim();
}

function addStyle() {
  if (document.getElementById('seb-candidate-catalog-style')) return;
  const style = document.createElement('style');
  style.id = 'seb-candidate-catalog-style';
  style.textContent = `
    #seb-evalpro-open-candidate{background:#fff!important;color:#0070c0!important;border:2px solid #0070c0!important;font-weight:700}
    #seb-general-bilan{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
    #seb-general-bilan .seb-gb-card{width:min(1120px,95vw);max-height:92vh}
    #seb-general-bilan .seb-cc-detail-actions{gap:9px;display:flex;flex-wrap:wrap;padding:12px;background:#fff}
    .seb-gb-table{width:100%;border-collapse:collapse;background:#fff;font:14px Arial,sans-serif}
    .seb-gb-table th,.seb-gb-table td{border:1px solid #ccd5e0;padding:9px;text-align:left;vertical-align:top}
    .seb-gb-category th{background:#deebfa;font-size:16px;color:#15476b}
    .seb-gb-table{table-layout:fixed}
    .seb-gb-table td:first-child,.seb-gb-table th:first-child{width:52%;overflow-wrap:anywhere}
    .seb-gb-table th:not(:first-child),.seb-gb-table td:not(:first-child){text-align:center}
    .seb-gb-table th:last-child,.seb-gb-table td:last-child{width:14%}
    .seb-gb-table .seb-gb-grade{width:7%;font-size:15px;font-weight:bold}
    .seb-gb-table .seb-gb-pct{white-space:nowrap;font-weight:bold}
    .seb-gb-table .seb-gb-selected{font-weight:900}
    .seb-gb-table .seb-gb-NE{background:#ccffff;color:#111}
    .seb-gb-table .seb-gb-I{background:#92d050;color:#111}
    .seb-gb-table .seb-gb-II{background:#ed7d31;color:#fff}
    .seb-gb-table .seb-gb-III{background:#c00000;color:#fff}
    .seb-gb-level{display:inline-block;min-width:30px;text-align:center;border-radius:4px;padding:4px 8px;font-weight:700;color:#111}
    .seb-gb-NE{background:#ccffff}.seb-gb-I{background:#92d050}.seb-gb-II{background:#ed7d31;color:#fff}.seb-gb-III{background:#c00000;color:#fff}
    .seb-gb-table details{margin-top:5px;color:#475b69;font-size:12px}.seb-gb-table ul{padding-left:19px}
    .seb-gb-warning{padding:9px;color:#a33000;background:#fff3e2;border:1px solid #ffca82}
    .seb-gb-note{padding:9px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}.seb-gb-note p{white-space:pre-wrap;margin:5px 0}
    #seb-gb-summary{width:100%;box-sizing:border-box;padding:10px;font:14px Arial,sans-serif;border:1px solid #a8b8c8;border-radius:5px}
    #seb-gb-status{font-size:13px;color:#335}
    #seb-candidate-catalog,#seb-candidate-person-detail,#seb-candidate-detail,#seb-candidate-trash{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
    .seb-cc-card{width:min(1180px,96vw);max-height:90vh;background:#fff;border-radius:10px;box-shadow:0 16px 50px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
    .seb-cc-head{background:#0070c0;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px}
    .seb-cc-title{font-size:20px;font-weight:700;flex:1}.seb-cc-badge{font-size:12px;font-weight:700;background:#fff;color:#0070c0;border-radius:14px;padding:4px 9px}
    .seb-cc-search-wrap{padding:12px 16px;border-bottom:1px solid #ddd;background:#f7f9fc}
    .seb-cc-search,.seb-list-search{width:100%;box-sizing:border-box;font:16px Arial,sans-serif;padding:10px 12px;border:1px solid #9aa7b8;border-radius:6px;background:#fff}
    .seb-cc-body{padding:12px 16px;overflow-y:auto;min-height:260px;max-height:68vh;background:#f5f7fb}
    .seb-cc-row{display:grid;grid-template-columns:1.35fr 1.2fr .95fr auto;gap:10px;align-items:center;padding:11px 12px;background:#fff;border:1px solid #d8dde8;border-radius:7px;margin-bottom:8px}
    .seb-cc-row strong{font-size:15px;color:#222}.seb-cc-row small{display:block;color:#666;margin-top:3px}
    .seb-cc-bilan-row strong{display:block;overflow-wrap:anywhere}.seb-cc-bilan-row small{display:block;margin-top:5px;line-height:1.45;color:#555;overflow-wrap:anywhere}
    .seb-cc-bilan{font-size:13px;line-height:1.35}.seb-cc-actions{display:flex;gap:7px;justify-content:flex-end}
    .seb-cc-actions button,.seb-cc-foot button,.seb-cc-bilan-row button,.seb-cc-detail-actions button{font:700 14px Arial,sans-serif;padding:8px 14px;border:2px solid #0070c0!important;border-radius:6px;background:#fff!important;color:#0070c0!important;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,.18)}
    .seb-cc-actions .primary,.seb-cc-bilan-row .primary,.seb-cc-detail-actions .primary{background:#fff!important;color:#0070c0!important;border-color:#0070c0!important}
    .seb-cc-actions button:hover,.seb-cc-foot button:hover,.seb-cc-bilan-row button:hover,.seb-cc-detail-actions button:hover{background:#f5f9fd!important}
    .seb-cc-actions .danger{background:#fff!important;color:#c00000!important;border-color:#c00000!important}.seb-cc-actions .danger:hover{background:#fff!important;color:#c00000!important;border-color:#c00000!important}.seb-cc-actions .confirm{background:#c00000!important;color:#fff!important;border-color:#c00000!important}
    .seb-cc-detail-actions .danger{margin-left:auto;background:#fff!important;color:#c00000!important;border-color:#c00000!important}
    .seb-cc-detail-actions .danger:hover{background:#fff!important;color:#c00000!important;border-color:#c00000!important}
    #seb-candidate-delete-confirm{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif}
    .seb-delete-card{width:min(560px,92vw);background:#fff;border-radius:9px;box-shadow:0 18px 55px rgba(0,0,0,.4);overflow:hidden}
    .seb-delete-head{padding:14px 18px;background:#c00000;color:#fff;font-size:19px;font-weight:700}
    .seb-delete-body{padding:20px;font-size:15px;line-height:1.5;color:#222}
    .seb-delete-actions{display:flex;justify-content:flex-end;gap:10px;padding:14px 18px;border-top:1px solid #ddd;background:#f7f9fc}
    .seb-delete-actions button{font:700 14px Arial,sans-serif;padding:8px 14px;border:2px solid #0070c0!important;border-radius:6px;background:#fff!important;color:#0070c0!important;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,.18)}
    .seb-delete-actions button:hover{background:#fff!important;color:#0070c0!important;border-color:#0070c0!important}
    .seb-delete-actions .danger{background:#fff!important;color:#c00000!important;border-color:#c00000!important}
    .seb-delete-actions .danger:hover{background:#fff!important;color:#c00000!important;border-color:#c00000!important}
    #seb-candidate-catalog .seb-cc-shell{width:min(1262px,calc(100vw - 24px));max-height:90vh;display:grid;grid-template-columns:minmax(0,1180px) 72px;gap:10px;align-items:end}
    #seb-candidate-catalog .seb-cc-shell>.seb-cc-card{width:100%;max-height:90vh}
    .seb-cc-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid #ddd;background:#fff}
    .seb-cc-foot-left,.seb-cc-foot-right{display:flex;align-items:center;gap:10px;flex-wrap:nowrap}
    .seb-cc-foot button{height:38px!important;min-height:38px!important;box-sizing:border-box!important;padding:0 14px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;margin:0!important}
    .seb-cc-foot button:disabled,.seb-cc-actions button:disabled{opacity:.48;cursor:default;box-shadow:none}
    #seb-cc-trash{width:72px!important;height:72px!important;min-width:72px!important;padding:5px!important;box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:2px solid #9fb5c8!important;border-radius:10px!important;background:#fff!important;cursor:pointer;box-shadow:0 3px 9px rgba(0,0,0,.20);margin:0 0 0 0!important}
    #seb-cc-trash:hover{background:#f7fbff!important;border-color:#0070c0!important}
    #seb-cc-trash img{width:60px;height:60px;display:block;object-fit:contain;pointer-events:none}
    #seb-cc-trash[data-state="full"]{border-color:#f28c00!important;background:#fff!important}
    @media(max-width:980px){#seb-candidate-catalog .seb-cc-shell{grid-template-columns:minmax(0,1fr) 64px;gap:8px}#seb-cc-trash{width:64px!important;height:64px!important;min-width:64px!important}#seb-cc-trash img{width:52px;height:52px}}
    .seb-trash-deleted-at{font-size:12px;color:#777}
    .seb-cc-row.export-selected{border-color:#16834f;background:#f1fbf6;box-shadow:inset 0 0 0 1px #16834f}
    .seb-cc-actions .selected{border-color:#16834f!important;color:#16834f!important;background:#f1fbf6!important}
    .seb-cc-person-wrap{margin-bottom:10px}
    .seb-cc-person-wrap>.seb-cc-row{margin-bottom:0}
    .seb-cc-person-identifier{font-weight:700;color:#005b9f}
    .seb-cc-identifier-warning{color:#a65c00;font-weight:700}
    .seb-cc-export-evaluations{margin:0 10px;padding:8px 10px 2px;border:1px solid #cbd4e2;border-top:0;border-radius:0 0 7px 7px;background:#fbfcfe}
    .seb-cc-evaluation-row{display:grid;grid-template-columns:1fr 1.3fr .85fr auto;gap:10px;align-items:center;padding:9px 10px;border-bottom:1px solid #e2e6ed}
    .seb-cc-evaluation-row:last-child{border-bottom:0}
    .seb-cc-evaluation-row small{display:block;color:#666;margin-top:3px}
    .seb-cc-evaluation-actions{display:flex;gap:7px;justify-content:flex-end}
    .seb-cc-evaluation-actions button{font:700 14px Arial,sans-serif;padding:8px 14px;border:2px solid #0070c0!important;border-radius:6px;background:#fff!important;color:#0070c0!important;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,.18)}
    .seb-cc-evaluation-actions button:disabled{opacity:.48;cursor:default;box-shadow:none}
    .seb-cc-evaluation-actions .danger{color:#c00000!important;border-color:#c00000!important}
    .seb-cc-evaluation-actions .selected{border-color:#16834f!important;color:#16834f!important;background:#f1fbf6!important}
    .seb-cc-empty{padding:35px;text-align:center;color:#555}
    .seb-cc-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 18px;padding:14px 16px;background:#f7f9fc;border-bottom:1px solid #ddd;font-size:14px}
    .seb-cc-section{padding:14px 16px}.seb-cc-section h3{margin:0 0 10px;color:#005b9f}
    .seb-cc-bilan-row{display:grid;grid-template-columns:1fr .65fr .9fr auto;gap:10px;align-items:center;padding:9px 10px;border:1px solid #ddd;border-radius:6px;margin-bottom:7px}
    .seb-cc-detail-actions{display:flex;gap:10px;flex-wrap:wrap;padding:14px 16px;border-top:1px solid #ddd;background:#f7f9fc}
    .seb-list-search-wrap{margin:0 0 12px}
  `;
  document.head.appendChild(style);
}

function hideLegacyAdminEntryPoints() {
  // Les anciens bilans seront archivés hors du parcours courant :
  // ne plus proposer cet accès dans aucune édition.
  document.getElementById('seb-evalpro-old-bilan')?.remove();
  document.getElementById('seb-bilan-history-chooser')?.remove();
}

function enhanceChooser(dialogId, listId, rowSelector) {
  const dialog = document.getElementById(dialogId);
  if (!dialog || dialog.dataset.sebSearchEnhanced === '1') return;
  const list = dialog.querySelector('#' + listId);
  if (!list || !list.parentElement) return;
  dialog.dataset.sebSearchEnhanced = '1';
  const wrap = document.createElement('div');
  wrap.className = 'seb-list-search-wrap';
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'seb-list-search';
  input.placeholder = 'Rechercher un nom, prénom, ville, groupe, date…';
  input.autocomplete = 'off';
  wrap.appendChild(input);
  list.parentElement.insertBefore(wrap, list);
  const filter = () => {
    const q = norm(input.value);
    dialog.querySelectorAll(rowSelector).forEach((row) => {
      row.style.display = !q || norm(row.textContent).includes(q) ? '' : 'none';
    });
  };
  input.addEventListener('input', filter);
  new MutationObserver(filter).observe(list, { childList:true, subtree:true });
}

function installGenericSearchObserver() {
  const apply = () => {
    hideLegacyAdminEntryPoints();
    enhanceChooser('seb-replay-chooser', 'seb-replay-list', '.seb-replay-row');
    enhanceChooser('seb-bilan-history-chooser', 'seb-bh-list', '.seb-bh-row');
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, { childList:true, subtree:true });
}

function bilanLabel(item) {
  if (!item.bilanCount) return 'Bilan : non enregistré';
  return 'Bilan courant disponible';
}

function personSummaryLabel(person) {
  const evaluations = Number(person.evaluationCount || 0);
  const bilans = Number(person.bilanCount || 0);
  return `${evaluations} évaluation${evaluations > 1 ? 's' : ''}<br><b>${bilans ? bilans + ' bilan' + (bilans > 1 ? 's' : '') : 'Aucun bilan'}</b>`;
}

function evaluationStatusLabel(status) {
  return String(status || '') === 'EN_COURS' ? 'Parcours en cours' : 'Parcours terminé';
}


function confirmCandidateDelete(item) {
  return new Promise((resolve) => {
    document.getElementById('seb-candidate-delete-confirm')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'seb-candidate-delete-confirm';
    overlay.innerHTML = `
      <div class="seb-delete-card" role="dialog" aria-modal="true" aria-label="Supprimer le candidat">
        <div class="seb-delete-head">Supprimer ce candidat ?</div>
        <div class="seb-delete-body">
          <p><strong>${escapeHtml(item.nom)} ${escapeHtml(item.prenom)}</strong></p>
          <p>Le dossier candidat et ses fichiers associés seront supprimés définitivement de ce PC.</p>
          <p>Cette action est réservée à l’administrateur et ne peut pas être annulée.</p>
        </div>
        <div class="seb-delete-actions">
          <button type="button" id="seb-delete-cancel">Annuler</button>
          <button type="button" id="seb-delete-confirm" class="danger">Supprimer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const finish = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector('#seb-delete-cancel').addEventListener('click', () => finish(false));
    overlay.querySelector('#seb-delete-confirm').addEventListener('click', () => finish(true));
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    overlay.querySelector('#seb-delete-cancel').focus();
  });
}

function showProtectedLegacyWord(html) {
  document.getElementById('seb-cc-private-word')?.remove();
  const overlay=document.createElement('div');
  overlay.id='seb-cc-private-word';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.7);display:flex;justify-content:center;align-items:center;padding:16px';
  const panel=document.createElement('section');
  panel.style.cssText='background:#fff;width:min(1200px,98vw);height:min(900px,95vh);display:flex;flex-direction:column;border-radius:10px;overflow:hidden';
  const header=document.createElement('div');
  header.style.cssText='padding:10px 16px;display:flex;justify-content:space-between;align-items:center;color:#123047';
  header.textContent='Bilan historique — consultation protegee dans KALONEO';
  const close=document.createElement('button');
  close.type='button';close.textContent='Fermer';close.addEventListener('click',()=>overlay.remove());
  header.appendChild(close);
  const viewer=document.createElement('iframe');
  // Iframe sans scripts ni meme origine : le contenu Word HTML reste isole.
  viewer.setAttribute('sandbox','');
  viewer.setAttribute('title','Bilan historique en lecture seule');
  viewer.style.cssText='width:100%;flex:1;border:0;background:#fff';
  viewer.srcdoc=String(html||'');
  panel.appendChild(header);panel.appendChild(viewer);overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

async function openCandidateDetail(candidateId, onChanged) {
  const old = document.getElementById('seb-candidate-detail');
  if (old) old.remove();
  const result = await ipcRenderer.invoke('candidate-catalog:detail', candidateId);
  if (!result || !result.ok) {
    alert((result && result.error) || 'Impossible d’ouvrir ce candidat.');
    return;
  }

  const item = result.candidate;
  const overlay = document.createElement('div');
  overlay.id = 'seb-candidate-detail';
  overlay.innerHTML = `
    <div class="seb-cc-card">
      <div class="seb-cc-head"><div class="seb-cc-title">${escapeHtml(item.nom)} ${escapeHtml(item.prenom)}</div><div class="seb-cc-badge">ÉVALUATION</div></div>
      <div class="seb-cc-meta">
        <div><b>N° identifiant :</b> ${escapeHtml(item.personIdentifier || '—')}</div><div><b>Ville :</b> ${escapeHtml(item.lieu)}</div><div><b>Groupe :</b> ${escapeHtml(item.groupe)}</div>
        <div><b>Date :</b> ${escapeHtml(item.date)}</div><div><b>Bilan :</b> ${item.bilanCount ? 'Enregistré' : 'Non enregistré'}</div><div><b>Parcours :</b> ${escapeHtml(item.parcours || '—')}</div>
      </div>
      <div class="seb-cc-body">
        <div class="seb-cc-section"><h3>Dernier bilan enregistré</h3><div id="seb-cc-detail-bilans"></div></div>
        <div class="seb-cc-section"><h3>Replay du parcours</h3><div id="seb-cc-detail-replays"></div></div>
        <div class="seb-cc-section"><h3>Résultats du candidat</h3><div id="seb-cc-detail-results"></div></div>
        <div class="seb-cc-section"><h3>Document Word du bilan</h3><div id="seb-cc-detail-exports"></div></div>
      </div>
      <div class="seb-cc-detail-actions">
        <button type="button" id="seb-cc-detail-bilan" class="primary">Faire le bilan</button>
        <button type="button" id="seb-cc-detail-close">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // SEB_EDITION_CANDIDATE_DETAIL : consultation dossiers/résultats/replay sans production de bilan.
  if (!editionCapabilities.canBilan) {
    const bilanSection = overlay.querySelector('#seb-cc-detail-bilans')?.closest('.seb-cc-section');
    const wordSection = overlay.querySelector('#seb-cc-detail-exports')?.closest('.seb-cc-section');
    const bilanAction = overlay.querySelector('#seb-cc-detail-bilan');
    if (bilanSection) bilanSection.style.display = 'none';
    if (wordSection) wordSection.style.display = 'none';
    if (bilanAction) bilanAction.style.display = 'none';
  }

  const bilans = overlay.querySelector('#seb-cc-detail-bilans');
  if (!result.bilans || !result.bilans.length) {
    bilans.innerHTML = '<div class="seb-cc-empty">Aucun bilan enregistré pour ce candidat.</div>';
  } else {
    result.bilans.forEach((b) => {
      const row = document.createElement('div');
      row.className = 'seb-cc-bilan-row';
      const when = b.createdAt ? new Date(b.createdAt).toLocaleString('fr-FR') : '';
      const integrity = b.integrityOk ? '' : '<small style="color:#c00000;font-weight:700">⚠ intégrité à vérifier</small>';
      row.innerHTML = `<div><strong>Bilan courant</strong>${integrity}</div><div>Build #${escapeHtml(b.originalBuild)}</div><div><small>Enregistré le ${escapeHtml(when)}</small></div><div></div>`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'primary';
      open.textContent = 'Ouvrir';
      open.addEventListener('click', async () => {
        const loaded = await ipcRenderer.invoke('candidate-catalog:load-bilan', candidateId, b.filename);
        if (!loaded || !loaded.ok) {
          alert((loaded && loaded.error) || 'Ouverture impossible.');
          return;
        }
        await ipcRenderer.invoke('candidate:set-admin-export-context', candidateId).catch(() => false);
        if (typeof bilanHistory.openEditor === 'function') bilanHistory.openEditor(loaded.filename, loaded.archive);
        else alert('Éditeur de bilan indisponible.');
      });
      row.lastElementChild.appendChild(open);
      bilans.appendChild(row);
    });
  }

  const replays = overlay.querySelector('#seb-cc-detail-replays');
  if (!Array.isArray(result.replays) || !result.replays.length) {
    replays.innerHTML = '<div class="seb-cc-empty">Aucun replay enregistré pour ce candidat.</div>';
  } else {
    result.replays.forEach((filename, index) => {
      const row = document.createElement('div');
      row.className = 'seb-cc-bilan-row';
      const parcoursLabel = item.parcours
        ? (result.replays.length > 1 ? item.parcours + ' — parcours ' + (index + 1) : item.parcours)
        : ('Parcours ' + (index + 1));
      row.innerHTML = `<div><strong>${escapeHtml(parcoursLabel)}</strong><small>${escapeHtml(filename)}</small></div><div></div><div></div><div></div>`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'primary';
      open.textContent = 'Rejouer';
      open.addEventListener('click', async () => {
        if (typeof replayPreload.openCandidateReplay !== 'function') {
          alert('Lecteur de replay indisponible.');
          return;
        }
        await replayPreload.openCandidateReplay(candidateId, filename);
      });
      row.lastElementChild.appendChild(open);
      replays.appendChild(row);
    });
  }

  const results = overlay.querySelector('#seb-cc-detail-results');
  if (results) {
    const row = document.createElement('div');
    row.className = 'seb-cc-bilan-row';
    row.innerHTML = '<div><strong>Page Résultats</strong><small>Lecture seule des réponses et scores enregistrés pour ce candidat.</small></div><div></div><div></div><div></div>';
    const openResults = document.createElement('button');
    openResults.type = 'button';
    openResults.className = 'primary';
    openResults.textContent = 'Ouvrir les résultats';
    openResults.addEventListener('click', async () => {
      await beginCandidateResults(candidateId, overlay);
    });
    row.lastElementChild.appendChild(openResults);
    results.appendChild(row);
  }

  const exports = overlay.querySelector('#seb-cc-detail-exports');
  if (!Array.isArray(result.exports) || !result.exports.length) {
    exports.innerHTML = '<div class="seb-cc-empty">Aucun Word associé au dernier bilan. Ouvrez le bilan courant et générez le Word.</div>';
  } else {
    result.exports.forEach((filename) => {
      const row = document.createElement('div');
      row.className = 'seb-cc-bilan-row';
      row.innerHTML = `<div><strong>Word du dernier bilan</strong><small>${escapeHtml(filename)}</small><small>Ouverture sécurisée avec le logiciel Windows associé.</small></div><div></div><div></div><div></div>`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'primary';
      open.textContent = 'Ouvrir';
      open.addEventListener('click', async () => {
        const opened = await ipcRenderer.invoke('candidate-catalog:open-export', candidateId, filename);
        if (!opened || !opened.ok) alert((opened && opened.error) || 'Ouverture du fichier impossible.');
        else if(opened.inApp && opened.html)showProtectedLegacyWord(opened.html);
      });
      row.lastElementChild.appendChild(open);
      exports.appendChild(row);
    });
  }

  overlay.querySelector('#seb-cc-detail-bilan').addEventListener('click', async () => {
    await beginCandidateBilan(candidateId, overlay);
  });
  overlay.querySelector('#seb-cc-detail-close').addEventListener('click', () => overlay.remove());

}

async function beginCandidateResults(candidateId, detailOverlay = null) {
  const prepared = await ipcRenderer.invoke('candidate-catalog:begin-results', candidateId);
  if (!prepared || !prepared.ok) {
    alert((prepared && prepared.error) || 'Impossible de préparer les résultats de ce candidat.');
    return false;
  }
  if (detailOverlay) detailOverlay.remove();
  const catalog = document.getElementById('seb-candidate-catalog');
  if (catalog) catalog.remove();
  const opened = await ipcRenderer.invoke('admin:open-candidate-results');
  if (!opened) {
    await ipcRenderer.invoke('candidate-catalog:end-results').catch(() => false);
    alert('Impossible d’ouvrir la page Résultats.');
    return false;
  }
  return true;
}

async function beginCandidateBilan(candidateId, detailOverlay = null) {
  const prepared = await ipcRenderer.invoke('candidate-catalog:begin-bilan', candidateId);
  if (!prepared || !prepared.ok) {
    alert((prepared && prepared.error) || 'Impossible de préparer le bilan de ce candidat.');
    return false;
  }
  const routed = await ipcRenderer.invoke('candidate:set-admin-export-context', candidateId).catch(() => false);
  if (!routed) {
    alert('Impossible de préparer le dossier Word de ce candidat.');
    return false;
  }
  if (detailOverlay) detailOverlay.remove();
  const catalog = document.getElementById('seb-candidate-catalog');
  if (catalog) catalog.remove();
  const opened = await ipcRenderer.invoke('admin:open-bilan');
  if (!opened) {
    alert('Impossible d’ouvrir le bilan administrateur.');
    return false;
  }
  return true;
}

function confirmEvaluationDelete(item) {
  return new Promise((resolve) => {
    document.getElementById('seb-candidate-delete-confirm')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'seb-candidate-delete-confirm';
    overlay.innerHTML = `
      <div class="seb-delete-card" role="dialog" aria-modal="true" aria-label="Supprimer l’évaluation">
        <div class="seb-delete-head">Supprimer cette évaluation ?</div>
        <div class="seb-delete-body">
          <p><strong>${escapeHtml(item.parcours || 'Parcours')}</strong> — ${escapeHtml(item.date || '')}</p>
          <p>Cette évaluation, avec ses résultats, son replay et ses bilans, sera placée dans la Corbeille.</p>
          <p>Vous pourrez la restaurer tant que la Corbeille n’a pas été vidée. Les autres évaluations de <strong>${escapeHtml(item.nom)} ${escapeHtml(item.prenom)}</strong> resteront intactes.</p>
        </div>
        <div class="seb-delete-actions">
          <button type="button" id="seb-delete-cancel">Annuler</button>
          <button type="button" id="seb-delete-confirm" class="danger">Supprimer l’évaluation</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const finish = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector('#seb-delete-cancel').addEventListener('click', () => finish(false));
    overlay.querySelector('#seb-delete-confirm').addEventListener('click', () => finish(true));
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    overlay.querySelector('#seb-delete-cancel').focus();
  });
}

function confirmPersonDelete(person) {
  return new Promise((resolve) => {
    document.getElementById('seb-candidate-delete-confirm')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'seb-candidate-delete-confirm';
    const count = Number(person.evaluationCount || person.evaluations?.length || 0);
    overlay.innerHTML = `
      <div class="seb-delete-card" role="dialog" aria-modal="true" aria-label="Supprimer le candidat">
        <div class="seb-delete-head">Supprimer le candidat et toutes ses évaluations ?</div>
        <div class="seb-delete-body">
          <p><strong>${escapeHtml(person.nom)} ${escapeHtml(person.prenom)}</strong></p>
          <p>N° identifiant : <strong>${escapeHtml(person.personIdentifier || '—')}</strong></p>
          <p><strong>${count} évaluation${count > 1 ? 's seront placées' : ' sera placée'} dans la Corbeille</strong>, avec les résultats, replays et bilans associés.</p>
          <p>Le candidat pourra être restauré tant que la Corbeille n’a pas été vidée.</p>
        </div>
        <div class="seb-delete-actions">
          <button type="button" id="seb-delete-cancel">Annuler</button>
          <button type="button" id="seb-delete-confirm" class="danger">Supprimer le candidat</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const finish = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector('#seb-delete-cancel').addEventListener('click', () => finish(false));
    overlay.querySelector('#seb-delete-confirm').addEventListener('click', () => finish(true));
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    overlay.querySelector('#seb-delete-cancel').focus();
  });
}

function confirmEmptyTrash(count) {
  return new Promise((resolve) => {
    document.getElementById('seb-candidate-delete-confirm')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'seb-candidate-delete-confirm';
    overlay.innerHTML = `
      <div class="seb-delete-card" role="dialog" aria-modal="true" aria-label="Vider la corbeille">
        <div class="seb-delete-head">Vider définitivement la corbeille ?</div>
        <div class="seb-delete-body">
          <p><strong>${Number(count || 0)} évaluation${Number(count || 0) > 1 ? 's' : ''}</strong> ${Number(count || 0) > 1 ? 'seront définitivement supprimées' : 'sera définitivement supprimée'}.</p>
          <p>Les candidats, résultats, replays, bilans et documents associés présents dans la Corbeille ne pourront plus être restaurés.</p>
          <p><strong>Cette opération est irréversible.</strong></p>
        </div>
        <div class="seb-delete-actions">
          <button type="button" id="seb-delete-cancel">Annuler</button>
          <button type="button" id="seb-delete-confirm" class="danger">Vider définitivement la corbeille</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const finish = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector('#seb-delete-cancel').addEventListener('click', () => finish(false));
    overlay.querySelector('#seb-delete-confirm').addEventListener('click', () => finish(true));
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
      if (event.key === 'Enter') finish(true);
    });
    overlay.querySelector('#seb-delete-cancel').focus();
  });
}

async function openCandidateTrash(onChanged, onTrashStateChanged) {
  document.getElementById('seb-candidate-trash')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'seb-candidate-trash';
  overlay.innerHTML = `
    <div class="seb-cc-card" role="dialog" aria-modal="true" aria-label="Corbeille candidats">
      <div class="seb-cc-head"><div class="seb-cc-title">Corbeille</div><div class="seb-cc-badge" id="seb-trash-badge">0 ÉVALUATION</div></div>
      <div class="seb-cc-body"><div id="seb-trash-list">Chargement…</div></div>
      <div class="seb-cc-detail-actions">
        <button type="button" id="seb-trash-empty" class="danger" disabled>Vider la corbeille</button>
        <button type="button" id="seb-trash-close">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const host = overlay.querySelector('#seb-trash-list');
  const badge = overlay.querySelector('#seb-trash-badge');
  const emptyButton = overlay.querySelector('#seb-trash-empty');
  let entries = [];

  const render = () => {
    host.innerHTML = '';
    badge.textContent = entries.length + ' ÉVALUATION' + (entries.length > 1 ? 'S' : '');
    emptyButton.disabled = entries.length === 0;
    if (!entries.length) {
      host.innerHTML = '<div class="seb-cc-empty"><strong>La corbeille est vide.</strong><br>Aucun candidat ou parcours supprimé à restaurer.</div>';
      return;
    }
    entries.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'seb-cc-evaluation-row';
      const deletedAt = item.deletedAt ? new Date(item.deletedAt).toLocaleString('fr-FR') : '—';
      row.innerHTML = `
        <div><strong>${escapeHtml(item.nom)} ${escapeHtml(item.prenom)}</strong><small>N° identifiant : ${escapeHtml(item.personIdentifier || '—')}</small></div>
        <div><strong>${escapeHtml(item.parcours || 'Parcours non renseigné')}</strong><small>${escapeHtml(item.date || 'Date non renseignée')} — ${escapeHtml(item.lieu || '')} — Groupe ${escapeHtml(item.groupe || '—')}</small></div>
        <div><span class="seb-trash-deleted-at">Supprimé le ${escapeHtml(deletedAt)}</span></div>
        <div class="seb-cc-evaluation-actions"></div>`;
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.textContent = 'Restaurer';
      restore.addEventListener('click', async () => {
        restore.disabled = true;
        const result = await ipcRenderer.invoke('candidate-catalog:trash-restore', item.candidateId).catch((error) => ({
          ok:false,error:String(error && error.message ? error.message : error)
        }));
        if (!result || result.ok !== true) {
          restore.disabled = false;
          alert((result && result.error) || 'Restauration impossible.');
          return;
        }
        if (typeof onChanged === 'function') await onChanged();
        await reload();
      });
      row.querySelector('.seb-cc-evaluation-actions').appendChild(restore);
      host.appendChild(row);
    });
  };

  const reload = async () => {
    const result = await ipcRenderer.invoke('candidate-catalog:trash-list').catch(() => ({ ok:false, entries:[] }));
    entries = result && result.ok && Array.isArray(result.entries) ? result.entries : [];
    render();
    if (typeof onTrashStateChanged === 'function') onTrashStateChanged(entries.length);
  };

  emptyButton.addEventListener('click', async () => {
    if (!entries.length || !(await confirmEmptyTrash(entries.length))) return;
    emptyButton.disabled = true;
    const result = await ipcRenderer.invoke('candidate-catalog:trash-empty').catch((error) => ({
      ok:false,error:String(error && error.message ? error.message : error)
    }));
    if (!result || result.ok !== true) {
      emptyButton.disabled = false;
      alert((result && result.error) || 'Vidage de la corbeille impossible.');
      return;
    }
    if (typeof onChanged === 'function') await onChanged();
    await reload();
  });

  overlay.querySelector('#seb-trash-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') overlay.remove(); });
  await reload();
}

async function openGeneralBilan(personId) {
  document.getElementById('seb-general-bilan')?.remove();
  const response=await ipcRenderer.invoke('candidate-catalog:general-bilan',personId);
  if(!response||!response.ok){
    alert(response&&response.error||'Bilan general non disponible.');
    return;
  }
  const {person,general}=response;
  const safe=escapeHtml;
  const fmt=p=>p===null||p===undefined?'Non noté':Number(p).toLocaleString('fr-FR',{maximumFractionDigits:2})+' %';
  const badge=level=>'<span class="seb-gb-level seb-gb-'+safe(level||'NE')+'">'+safe(level||'NE')+'</span>';
  const rows=(general.categories||[]).map(category=>{
    const tests=(category.tests||[]).map(test=>{
      const number=test.percent===null?'Non noté':safe(String(test.points))+' / '+safe(String(test.possible))+' ('+fmt(test.percent)+')';
      const passed=(test.sources||[]).map(src=>
        '<li>'+safe(src.parcours)+' — '+safe(src.date||'')+
        (src.scored?' : '+safe(String(src.score))+' / '+safe(String(src.scoreMax)):
          ' : '+(src.level?'Niveau '+safe(src.level):'sans note numérique')+(src.comment?' — '+safe(src.comment):''))+'</li>').join('');
      return '<tr><td><strong>'+safe(test.title)+'</strong><details><summary>'+
        test.passages+' passage(s)</summary><ul>'+passed+'</ul></details></td>'+
        '<td>'+number+'</td><td>'+badge(test.level)+'</td></tr>';
    }).join('');
    return '<tbody><tr class="seb-gb-category"><th colspan="3">'+safe(category.name)+
      ' — '+(category.percent===null?'Non évalué':fmt(category.percent))+' — '+badge(category.level)+
      '</th></tr>'+tests+'</tbody>';
  }).join('');
  const overlay=document.createElement('div');
  overlay.id='seb-general-bilan';
  overlay.innerHTML=`
    <div class="seb-cc-card seb-gb-card" role="dialog" aria-modal="true" aria-label="Bilan général du candidat">
      <div class="seb-cc-head">
        <div class="seb-cc-title">Bilan général — ${safe(person.nom)} ${safe(person.prenom)}</div>
        <div class="seb-cc-badge">${general.evaluationCount} PARCOURS</div>
      </div>
      <div class="seb-cc-body">
        <p>Regroupement des tests identiques par identifiant. Points obtenus / possibles
        additionnés entre parcours ; puis moyenne des tests distincts dans chaque catégorie.
        Les tests non passés ne sont pas comptés.</p>
        ${response.outdated?'<p class="seb-gb-warning">Les bilans des parcours ont évolué : sauvegarder à nouveau le bilan général et régénérer le Word.</p>':''}
        <div class="seb-cc-section"><h3>Résultats regroupés par catégorie</h3>
          <table class="seb-gb-table"><thead><tr><th>Test / parcours</th><th>Résultat consolidé</th><th>Niveau</th></tr></thead>${rows||'<tbody><tr><td colspan="3">Aucun test noté ou documenté.</td></tr></tbody>'}</table>
        </div>
        <div class="seb-cc-section">
          <h3>Observations des bilans de parcours</h3>
          ${(general.notes||[]).map(note=>'<div class="seb-gb-note"><strong>'+safe(note.parcours)+
            '</strong> — '+safe(note.date||'')+'<p>'+safe(note.summary)+'</p></div>').join('')||
            '<p>Aucune observation déjà enregistrée.</p>'}
        </div>
        <div class="seb-cc-section">
          <h3>Synthèse générale (modifiable)</h3>
          <textarea id="seb-gb-summary" spellcheck="true" rows="7" placeholder="Rédigez la synthèse croisée des parcours."></textarea>
          <p id="seb-gb-status" role="status">Les niveaux affichés sont calculés à partir des points réellement enregistrés. Un niveau manuel non chiffré n'est pas moyenné avec les points.</p>
        </div>
      </div>
      <div class="seb-cc-detail-actions seb-gb-actions">
        <button type="button" id="seb-gb-save" class="primary">Enregistrer le bilan général</button>
        <button type="button" id="seb-gb-word">Générer Word</button>
        <button type="button" id="seb-gb-open">Ouvrir Word</button>
        <button type="button" id="seb-gb-close">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const field=overlay.querySelector('#seb-gb-summary');
  field.value=String(response.summary||'');
  const status=overlay.querySelector('#seb-gb-status');
  const save=overlay.querySelector('#seb-gb-save');
  const word=overlay.querySelector('#seb-gb-word');
  const open=overlay.querySelector('#seb-gb-open');
  let pending=false;
  function busy(state){pending=state;for(const b of [save,word,open])b.disabled=state}
  save.addEventListener('click',async()=>{
    if(pending)return;busy(true);
    try {
      const r=await ipcRenderer.invoke('candidate-catalog:save-general-bilan',personId,field.value,general.sourceDigest);
      status.textContent=r&&r.ok?'Bilan général enregistré. Générer un nouveau Word.':(r&&r.error||'Échec enregistrement');
    }catch(e){status.textContent=String(e.message||e)}finally{busy(false)}
  });
  word.addEventListener('click',async()=>{
    if(pending)return;busy(true);
    try {
      const r=await ipcRenderer.invoke('candidate-catalog:export-general-bilan',personId,field.value,general.sourceDigest);
      status.textContent=r&&r.ok?'Word sécurisé généré. Cliquez sur Ouvrir Word.':(r&&r.error||'Échec génération Word');
    }catch(e){status.textContent=String(e.message||e)}finally{busy(false)}
  });
  open.addEventListener('click',async()=>{
    if(pending)return;busy(true);
    try {
      const r=await ipcRenderer.invoke('candidate-catalog:open-general-word',personId);
      status.textContent=r&&r.ok?'Ouverture du Word sécurisé demandée.':(r&&r.error||'Word indisponible');
    }catch(e){status.textContent=String(e.message||e)}finally{busy(false)}
  });
  overlay.querySelector('#seb-gb-close').addEventListener('click',()=>overlay.remove());
}
async function openPersonDetail(personId, onChanged) {
  document.getElementById('seb-candidate-person-detail')?.remove();
  const result = await ipcRenderer.invoke('candidate-catalog:person-detail', personId);
  if (!result || !result.ok) {
    alert((result && result.error) || 'Impossible d’ouvrir ce candidat.');
    return;
  }
  const person = result.person;
  const overlay = document.createElement('div');
  overlay.id = 'seb-candidate-person-detail';
  overlay.innerHTML = `
    <div class="seb-cc-card" role="dialog" aria-modal="true" aria-label="Évaluations du candidat">
      <div class="seb-cc-head">
        <div class="seb-cc-title">${escapeHtml(person.nom)} ${escapeHtml(person.prenom)}</div>
        <div class="seb-cc-badge">${Number(person.evaluationCount || 0)} ÉVALUATION${Number(person.evaluationCount || 0) > 1 ? 'S' : ''}</div>
      </div>
      <div class="seb-cc-meta">
        <div><b>N° identifiant :</b> ${escapeHtml(person.personIdentifier || '—')}</div>
        <div><b>Dernière ville :</b> ${escapeHtml(person.lieu || '—')}</div>
        <div><b>Dernier groupe :</b> ${escapeHtml(person.groupe || '—')}</div>
        <div><b>Évaluations :</b> ${Number(person.evaluationCount || 0)}</div>
        <div><b>Bilans :</b> ${Number(person.bilanCount || 0)}</div>
        <div><b>Dernière date :</b> ${escapeHtml(person.latestDate || '—')}</div>
      </div>
      <div class="seb-cc-body">
        <div class="seb-cc-section">
          <h3>Évaluations / parcours</h3>
          <div id="seb-cc-person-evaluations"></div>
        </div>
      </div>
      <div class="seb-cc-detail-actions">
        <button type="button" id="seb-cc-person-general" class="primary">Bilan général</button>
        <button type="button" id="seb-cc-person-delete" class="danger">Supprimer le candidat</button>
        <button type="button" id="seb-cc-person-close">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const host = overlay.querySelector('#seb-cc-person-evaluations');
  (person.evaluations || []).forEach((evaluation) => {
    const row = document.createElement('div');
    row.className = 'seb-cc-evaluation-row';
    row.innerHTML = `
      <div><strong>${escapeHtml(evaluation.date || 'Date non renseignée')}</strong><small>${escapeHtml(evaluationStatusLabel(evaluation.status))}</small></div>
      <div><strong>${escapeHtml(evaluation.parcours || 'Parcours non renseigné')}</strong><small>${escapeHtml(evaluation.lieu || '')} — Groupe ${escapeHtml(evaluation.groupe || '—')}</small></div>
      <div>${bilanLabel(evaluation)}</div>
      <div class="seb-cc-evaluation-actions"></div>`;
    const actions = row.querySelector('.seb-cc-evaluation-actions');

    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = 'Ouvrir';
    open.addEventListener('click', async () => {
      await openCandidateDetail(evaluation.candidateId, async () => {
        if (typeof onChanged === 'function') await onChanged();
      });
    });
    actions.append(open);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Supprimer l’évaluation';
    remove.addEventListener('click', async () => {
      if (!(await confirmEvaluationDelete(evaluation))) return;
      open.disabled = true;
      remove.disabled = true;
      const deleted = await ipcRenderer.invoke('candidate-catalog:delete', evaluation.candidateId).catch((error) => ({
        ok:false,
        error:String(error && error.message ? error.message : error)
      }));
      if (!deleted || deleted.ok !== true) {
        open.disabled = false;
        remove.disabled = false;
        alert((deleted && deleted.error) || 'Suppression impossible.');
        return;
      }
      overlay.remove();
      if (typeof onChanged === 'function') await onChanged();
      const refreshed = await ipcRenderer.invoke('candidate-catalog:person-detail', personId).catch(() => null);
      if (refreshed && refreshed.ok) await openPersonDetail(personId, onChanged);
    });
    actions.append(remove);
    host.appendChild(row);
  });

  const generalButton=overlay.querySelector('#seb-cc-person-general');
  generalButton.hidden=!editionCapabilities.canBilan;
  generalButton.disabled=Number(person.evaluationCount||0)<2;
  generalButton.title=generalButton.disabled?'Deux parcours minimum pour un bilan général':'Regrouper les résultats de tous les parcours';
  generalButton.addEventListener('click',()=>openGeneralBilan(personId));
  overlay.querySelector('#seb-cc-person-delete').addEventListener('click', async () => {
    if (!(await confirmPersonDelete(person))) return;
    const deleted = await ipcRenderer.invoke('candidate-catalog:delete-person', person.personId).catch((error) => ({
      ok:false,
      error:String(error && error.message ? error.message : error)
    }));
    if (!deleted || deleted.ok !== true) {
      alert((deleted && deleted.error) || 'Suppression impossible.');
      return;
    }
    overlay.remove();
    if (typeof onChanged === 'function') await onChanged();
  });
  overlay.querySelector('#seb-cc-person-close').addEventListener('click', () => overlay.remove());
}

function openCatalog(initialCandidateId = '') {
  return new Promise(async (resolve) => {
    addStyle();
    const old = document.getElementById('seb-candidate-catalog');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'seb-candidate-catalog';
    overlay.innerHTML = `
      <div class="seb-cc-shell">
        <div class="seb-cc-card" role="dialog" aria-modal="true" aria-label="Liste des candidats">
          <div class="seb-cc-head"><div class="seb-cc-title">Liste des candidats</div><div class="seb-cc-badge">CANDIDATS</div></div>
          <div class="seb-cc-search-wrap"><input id="seb-cc-search" class="seb-cc-search" type="search" autocomplete="off" placeholder="Rechercher un nom, prénom, N° identifiant, ville, groupe, parcours ou date…"></div>
          <div class="seb-cc-body"><div id="seb-cc-list">Chargement…</div></div>
          <div class="seb-cc-foot">
            <div class="seb-cc-foot-left">
              <button type="button" id="seb-cc-import" data-seb-no-normalize="1">↓ Importer candidat</button>
              <button type="button" id="seb-cc-export-mode" data-seb-no-normalize="1">↑ Exporter candidat</button>
              <button type="button" id="seb-cc-export-launch" class="primary" hidden disabled>Lancer l’export (0)</button>
              <button type="button" id="seb-cc-export-cancel" hidden>Annuler la sélection</button>
            </div>
            <div class="seb-cc-foot-right">
              <button type="button" id="seb-cc-close">Fermer</button>
            </div>
          </div>
        </div>
        <button type="button" id="seb-cc-trash" data-state="empty" data-seb-no-normalize="1" title="Corbeille — vide" aria-label="Corbeille vide"><img src="assets/candidate-trash-empty.png" alt=""></button>
      </div>`;
    document.body.appendChild(overlay);
    const list = overlay.querySelector('#seb-cc-list');
    const search = overlay.querySelector('#seb-cc-search');
    const importButton = overlay.querySelector('#seb-cc-import');
    const exportModeButton = overlay.querySelector('#seb-cc-export-mode');
    const trashButton = overlay.querySelector('#seb-cc-trash');
    const exportCancelButton = overlay.querySelector('#seb-cc-export-cancel');
    const exportLaunchButton = overlay.querySelector('#seb-cc-export-launch');
    let persons = [];
    let exportMode = false;
    const selectedExportIds = new Set();

    const updateExportFooter = () => {
      importButton.hidden = exportMode || !editionCapabilities.canImport;
      exportModeButton.hidden = exportMode || !editionCapabilities.canExport;
      trashButton.hidden = false;
      exportLaunchButton.hidden = !exportMode;
      exportCancelButton.hidden = !exportMode;
      exportLaunchButton.disabled = selectedExportIds.size === 0;
      exportLaunchButton.textContent = 'Lancer l’export (' + selectedExportIds.size + ')';
    };

    const searchableText = (person) => [
      person.nom,
      person.prenom,
      person.personIdentifier,
      person.lieu,
      person.groupe,
      person.latestDate,
      ...(person.evaluations || []).flatMap((evaluation) => [
        evaluation.parcours,
        evaluation.date,
        evaluation.lieu,
        evaluation.groupe
      ])
    ].join(' ');

    const render = () => {
      const q = norm(search.value);
      const shown = persons.filter((person) => !q || norm(searchableText(person)).includes(q));
      list.innerHTML = '';
      if (!shown.length) {
        list.innerHTML = '<div class="seb-cc-empty">Aucun candidat correspondant.</div>';
        return;
      }

      shown.forEach((person) => {
        const wrap = document.createElement('div');
        wrap.className = 'seb-cc-person-wrap';

        const row = document.createElement('div');
        row.className = 'seb-cc-row';
        const collision = person.identifierCollision
          ? '<small class="seb-cc-identifier-warning">Identifiant partagé avec un autre nom : candidats conservés séparément.</small>'
          : '';
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(person.nom)} ${escapeHtml(person.prenom)}</strong>
            <small class="seb-cc-person-identifier">N° identifiant : ${escapeHtml(person.personIdentifier || '—')}</small>
            ${collision}
          </div>
          <div><b>${escapeHtml(person.lieu || '—')}</b><small>Groupe : ${escapeHtml(person.groupe || '—')} — Dernière évaluation : ${escapeHtml(person.latestDate || '—')}</small></div>
          <div class="seb-cc-bilan">${personSummaryLabel(person)}</div>
          <div class="seb-cc-actions"></div>`;
        const actions = row.querySelector('.seb-cc-actions');

        if (exportMode) {
          const completed = (person.evaluations || []).filter((evaluation) =>
            ['TERMINE','SESSION_FERMEE'].includes(String(evaluation.status || ''))
          );
          const selectedCount = completed.filter((evaluation) => selectedExportIds.has(String(evaluation.candidateId || ''))).length;
          const toggleAll = document.createElement('button');
          toggleAll.type = 'button';
          toggleAll.disabled = completed.length === 0;
          toggleAll.textContent = completed.length && selectedCount === completed.length ? 'Tout retirer' : 'Tout sélectionner';
          toggleAll.addEventListener('click', () => {
            if (!completed.length) return;
            const removeAll = completed.every((evaluation) => selectedExportIds.has(String(evaluation.candidateId || '')));
            completed.forEach((evaluation) => {
              const id = String(evaluation.candidateId || '');
              if (!id) return;
              if (removeAll) selectedExportIds.delete(id);
              else selectedExportIds.add(id);
            });
            updateExportFooter();
            render();
          });
          actions.append(toggleAll);
        } else {
          const open = document.createElement('button');
          open.type = 'button';
          open.className = 'primary';
          open.textContent = 'Ouvrir';
          open.addEventListener('click', () => openPersonDetail(person.personId, reload));
          actions.append(open);

          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'danger';
          remove.textContent = 'Supprimer';
          remove.addEventListener('click', async () => {
            if (!(await confirmPersonDelete(person))) return;
            open.disabled = true;
            remove.disabled = true;
            const deleted = await ipcRenderer.invoke('candidate-catalog:delete-person', person.personId).catch((error) => ({
              ok:false,
              error:String(error && error.message ? error.message : error)
            }));
            if (!deleted || deleted.ok !== true) {
              open.disabled = false;
              remove.disabled = false;
              alert((deleted && deleted.error) || 'Suppression impossible.');
              return;
            }
            await reload();
          });
          actions.append(open, remove);
        }
        wrap.appendChild(row);

        if (exportMode) {
          const evalHost = document.createElement('div');
          evalHost.className = 'seb-cc-export-evaluations';
          (person.evaluations || []).forEach((evaluation) => {
            const evalRow = document.createElement('div');
            evalRow.className = 'seb-cc-evaluation-row';
            const selectable = ['TERMINE','SESSION_FERMEE'].includes(String(evaluation.status || ''));
            const selected = selectedExportIds.has(String(evaluation.candidateId || ''));
            if (selected) evalRow.classList.add('export-selected');
            evalRow.innerHTML = `
              <div><strong>${escapeHtml(evaluation.date || 'Date non renseignée')}</strong><small>${escapeHtml(evaluationStatusLabel(evaluation.status))}</small></div>
              <div><strong>${escapeHtml(evaluation.parcours || 'Parcours non renseigné')}</strong><small>${escapeHtml(evaluation.lieu || '')} — Groupe ${escapeHtml(evaluation.groupe || '—')}</small></div>
              <div>${bilanLabel(evaluation)}</div>
              <div class="seb-cc-evaluation-actions"></div>`;
            const evalActions = evalRow.querySelector('.seb-cc-evaluation-actions');
            const choose = document.createElement('button');
            choose.type = 'button';
            choose.disabled = !selectable;
            choose.className = selected ? 'selected seb-cc-export-choice' : 'seb-cc-export-choice';
            choose.dataset.sebNoNormalize = '1';
            choose.textContent = selectable ? (selected ? '✓ Sélectionné' : '↑ Exporter') : 'Parcours en cours';
            choose.addEventListener('click', () => {
              const id = String(evaluation.candidateId || '');
              if (!id || !selectable) return;
              if (selectedExportIds.has(id)) selectedExportIds.delete(id);
              else selectedExportIds.add(id);
              updateExportFooter();
              render();
            });
            evalActions.appendChild(choose);
            evalHost.appendChild(evalRow);
          });
          wrap.appendChild(evalHost);
        }

        list.appendChild(wrap);
      });
    };

    const updateTrashState = (count) => {
      const total = Number(count || 0);
      const full = total > 0;
      trashButton.dataset.state = full ? 'full' : 'empty';
      trashButton.innerHTML = '<img src="' + (full ? 'assets/candidate-trash-full.png' : 'assets/candidate-trash-empty.png') + '" alt="">';
      trashButton.title = full ? ('Corbeille — ' + total + ' élément' + (total > 1 ? 's' : '')) : 'Corbeille — vide';
      trashButton.setAttribute('aria-label', full ? ('Corbeille pleine, ' + total + ' élément' + (total > 1 ? 's' : '')) : 'Corbeille vide');
    };
    const refreshTrashState = async () => {
      const result = await ipcRenderer.invoke('candidate-catalog:trash-list').catch(() => ({ ok:false, entries:[] }));
      updateTrashState(result && result.ok && Array.isArray(result.entries) ? result.entries.length : 0);
    };
    const reload = async () => {
      try { persons = await ipcRenderer.invoke('candidate-catalog:list-persons'); } catch (_) { persons = []; }
      render();
      await refreshTrashState();
    };
    await reload();
    updateExportFooter();
    search.addEventListener('input', render);

    trashButton.addEventListener('click', async () => {
      await openCandidateTrash(reload, updateTrashState);
    });

    importButton.addEventListener('click', async () => {
      if (typeof importCandidatesAction !== 'function') return;
      importButton.disabled = true;
      exportModeButton.disabled = true;
      try {
        const completed = await importCandidatesAction();
        if (completed) await reload();
      } finally {
        importButton.disabled = false;
        exportModeButton.disabled = false;
      }
    });

    exportModeButton.addEventListener('click', () => {
      exportMode = true;
      selectedExportIds.clear();
      updateExportFooter();
      render();
    });

    exportCancelButton.addEventListener('click', () => {
      exportMode = false;
      selectedExportIds.clear();
      updateExportFooter();
      render();
    });

    exportLaunchButton.addEventListener('click', async () => {
      if (!selectedExportIds.size || typeof exportCandidatesAction !== 'function') return;
      const ids = [...selectedExportIds];
      exportLaunchButton.disabled = true;
      exportCancelButton.disabled = true;
      try {
        const completed = await exportCandidatesAction(ids);
        if (completed) {
          exportMode = false;
          selectedExportIds.clear();
          updateExportFooter();
          await reload();
        }
      } finally {
        exportCancelButton.disabled = false;
        updateExportFooter();
      }
    });

    const closeButton = overlay.querySelector('#seb-cc-close');
    const close = () => {
      document.getElementById('seb-candidate-person-detail')?.remove();
      document.getElementById('seb-candidate-detail')?.remove();
      document.getElementById('seb-candidate-trash')?.remove();
      overlay.remove();
      resolve();
    };
    closeButton.hidden = false;
    closeButton.addEventListener('click', close);
    overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });

    const selectedId = String(initialCandidateId || '').trim();
    if (selectedId) {
      const person = persons.find((entry) =>
        (entry.evaluations || []).some((evaluation) => String(evaluation.candidateId || '') === selectedId)
      );
      if (person) await openPersonDetail(person.personId, reload);
      else search.focus();
    } else {
      search.focus();
    }
  });
}

function ensureButton() {
  const bar = document.getElementById('seb-evalpro-topbar');
  if (!bar) return false;
  let button = document.getElementById('seb-evalpro-open-candidate');
  if (!button) {
    button = document.createElement('button');
    button.id = 'seb-evalpro-open-candidate';
    button.type = 'button';
    button.textContent = 'Lister les candidats';
    button.hidden = true;
    button.addEventListener('click', async () => {
      if (isCandidateAdminHost()) {
        await openCatalog();
        return;
      }
      if (typeof beforeAdminNavigate === 'function') {
        const saved = beforeAdminNavigate();
        if (saved && saved.ok === false) {
          alert(saved.error || 'La sauvegarde du parcours n’a pas pu être confirmée.');
          return;
        }
      }
      await ipcRenderer.invoke('admin:open-candidate-browser').catch(() => false);
    });
  }
  const left = bar.querySelector('.seb-admin-left-actions');
  const replay = document.getElementById('seb-evalpro-replay');
  const bilan = document.getElementById('seb-evalpro-bilan');
  if (left && button.parentElement !== left) {
    if (replay && replay.parentElement === left) replay.insertAdjacentElement('afterend', button);
    else if (bilan && bilan.parentElement === left) left.insertBefore(button, bilan);
    else left.appendChild(button);
  } else if (!left && !button.isConnected) {
    const admin = document.getElementById('seb-evalpro-admin');
    if (admin) bar.insertBefore(button, admin);
  }
  return true;
}

async function refreshButton() {
  const button = document.getElementById('seb-evalpro-open-candidate');
  if (!button) return;
  try {
    const unlocked = await ipcRenderer.invoke('admin:status');
    const onBilan = /\/(?:admin-bilan|bilan)\.html$/i.test(decodeURIComponent(window.location.pathname));
    const results = ipcRenderer.sendSync('candidate-catalog:results-workspace-load-sync');
    button.hidden = !unlocked || onBilan || !!(results && results.ok);
  } catch (_) { button.hidden = true; }
}

function install(options = {}) {
  if (installed) return;
  installed = true;
  beforeAdminNavigate = typeof options.beforeNavigate === 'function' ? options.beforeNavigate : null;
  importCandidatesAction = typeof options.onImportCandidates === 'function' ? options.onImportCandidates : null;
  exportCandidatesAction = typeof options.onExportCandidates === 'function' ? options.onExportCandidates : null;
  addStyle();
  installGenericSearchObserver();
  if (!ensureButton()) setTimeout(ensureButton, 150);
  const observer = new MutationObserver(() => { ensureButton(); refreshButton(); hideLegacyAdminEntryPoints(); });
  observer.observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('click', (event) => {
    const admin = event.target && event.target.closest ? event.target.closest('#seb-evalpro-admin') : null;
    if (admin) setTimeout(refreshButton, 60);
  }, true);
  refreshButton();
  if (isCandidateAdminHost()) {
    const selectedId = requestedCandidateId();
    if (selectedId) {
      setTimeout(() => {
        if (!document.getElementById('seb-candidate-catalog')) openCatalog(selectedId);
      }, 0);
    }
  }
}

module.exports = { install, openCatalog, openCandidateDetail };
