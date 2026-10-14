(function () {
  'use strict';

  if (new URLSearchParams(window.location.search || '').get('kaltestEmbed') === '1') return;

  const ABANDON_KEY = 'seb_evalpro_abandons';
  const EXERCISE_FILES = new Set([
    'brique.html',
    'stock.html',
    'planning.html',
    'genrenombres.html',
    'dictee.html',
    'tri_de_cheville.html',
    'nwtexte.html',
    'nvmail.html',
    'paronymes.html',
    'carre.html'
  ]);

  const NEXT_BY_FILE = {
    'brique.html': 'stock.html',
    'stock.html': 'planning.html',
    'planning.html': 'genrenombres.html',
    'genrenombres.html': 'dictee.html',
    'dictee.html': 'tri_de_cheville.html',
    'tri_de_cheville.html': 'nwtexte.html',
    'nwtexte.html': 'nvmail.html',
    'nvmail.html': 'autoeval2.html',
    'paronymes.html': 'carre.html',
    'carre.html': 'qcmv1.0.html?page=11#page11'
  };

  const EXERCISE_LABELS = {
    'brique.html': 'Construction à base de briques',
    'stock.html': 'Gestion logistique — Ranger le stock produit',
    'planning.html': 'Planification — Le restaurant',
    'genrenombres.html': 'Genre et nombre',
    'dictee.html': 'Dictée',
    'tri_de_cheville.html': 'Tri de chevilles',
    'nwtexte.html': 'Traitement de texte',
    'nvmail.html': 'Messagerie électronique',
    'paronymes.html': 'Paronymes',
    'carre.html': 'Carré magique / Puzzle Gratte-ciel'
  };

  const QCM_LABELS = {
    page1: 'Exercice QCM',
    page2: 'Calculs',
    page2_1: 'Calculs — suite',
    page3: 'Réception / contrôle',
    page4: 'Fractions',
    page5: 'Ordonnancement',
    page5_1: 'Postures',
    page6: 'Conversions',
    pageTexteTrous: 'Texte à trous',
    page8: 'Messagerie',
    page9: 'Exercice QCM',
    page10: 'Exercice QCM',
    page11: 'Exercice QCM'
  };

  const QCM_EXCLUDED = new Set(['page0', 'pageFinale', 'bilanPage']);
  const QCM_EXERCISE_IDS = new Set(['page2','page2_1','page3','page4','page5','page5_1','page6','pageTexteTrous','page8']);
  let mutationScheduled = false;

  function pageName() {
    try {
      return decodeURIComponent((window.location.pathname.split('/').pop() || '').toLowerCase());
    } catch (_) {
      return '';
    }
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s\u00a0]+|[\s\u00a0]+$/g, '');
  }

  function stripActionIcon(value) {
    return cleanText(value)
      .replace(/^(?:➡️|➡|➜|→|←|✓|✔|🔍|📊|🧮|💾|✉️|✉|📧|▶️|▶|⏹️|⏹|■|✕|❌|📂|⬇️|⬇)\s*/u, '')
      .replace(/\s*(?:->|→|➜)\s*$/u, '')
      .trim();
  }

  function ensureStyles() {
    if (document.getElementById('seb-evalpro-unified-buttons-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-evalpro-unified-buttons-style';
    style.textContent = `
      .seb-action-btn{
        --seb-button-color:#004E70;
        min-height:42px!important;
        padding:10px 20px!important;
        border:1.5px solid var(--seb-button-color)!important;
        border-radius:10px!important;
        color:var(--seb-button-color)!important;
        background:linear-gradient(180deg,rgba(255,255,255,.96) 0%,rgba(245,248,252,.84) 100%)!important;
        font-family:Calibri,"Segoe UI",Arial,sans-serif!important;
        font-size:16px!important;
        font-weight:700!important;
        line-height:1.15!important;
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:7px!important;
        box-sizing:border-box!important;
        cursor:pointer!important;
        text-decoration:none!important;
        box-shadow:0 4px 10px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.98)!important;
        transition:transform .15s ease,box-shadow .15s ease,background .15s ease!important;
        vertical-align:middle!important;
      }
      .seb-action-btn:hover:not(:disabled){
        transform:translateY(-1px)!important;
        background:linear-gradient(180deg,#fff 0%,rgba(240,244,249,.92) 100%)!important;
        box-shadow:0 7px 16px rgba(0,0,0,.16),inset 0 1px 0 #fff!important;
      }
      .seb-action-btn:active:not(:disabled){
        transform:translateY(1px)!important;
        box-shadow:0 2px 5px rgba(0,0,0,.14),inset 0 1px 2px rgba(0,0,0,.06)!important;
      }
      .seb-action-btn:disabled{opacity:.45!important;cursor:default!important;transform:none!important}
      .seb-btn-nav{--seb-button-color:#198754}
      .seb-btn-confirm,.seb-btn-tool,.seb-btn-functional{--seb-button-color:#004E70}
      .seb-btn-calculator{--seb-button-color:#F9B233}
      .seb-btn-danger{--seb-button-color:#C62828}
      .seb-btn-timer-start{--seb-button-color:#198754}
      .seb-btn-timer-stop{--seb-button-color:#C62828}
      .seb-action-btn.seb-btn-solid{
        color:#fff!important;
        border-color:var(--seb-button-color)!important;
        box-shadow:0 4px 10px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.30)!important;
      }
      .seb-action-btn.seb-btn-solid.seb-btn-timer-start{
        background:linear-gradient(180deg,#28a866 0%,#198754 100%)!important;
      }
      .seb-action-btn.seb-btn-solid.seb-btn-timer-stop{
        background:linear-gradient(180deg,#df4444 0%,#C62828 100%)!important;
      }
      .seb-action-btn.seb-btn-solid.seb-btn-timer-start:hover:not(:disabled){
        background:linear-gradient(180deg,#34b572 0%,#16794c 100%)!important;
      }
      .seb-action-btn.seb-btn-solid.seb-btn-timer-stop:hover:not(:disabled){
        background:linear-gradient(180deg,#e65656 0%,#ad2020 100%)!important;
      }
      .seb-action-btn.seb-btn-solid:disabled{opacity:.55!important}
      #seb-evalpro-abandon-fixed{
        position:fixed!important;
        left:16px!important;
        bottom:16px!important;
        z-index:2147483000!important;
        min-width:220px!important;
      }
      #seb-evalpro-abandon-layer{
        position:fixed;
        inset:0;
        z-index:2147483647;
        background:rgba(0,0,0,.46);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        box-sizing:border-box;
        font-family:Calibri,"Segoe UI",Arial,sans-serif;
      }
      #seb-evalpro-abandon-box{
        width:min(560px,94vw);
        background:#fff;
        border:1px solid #aaa;
        border-radius:12px;
        padding:22px;
        box-shadow:0 16px 48px rgba(0,0,0,.32);
        color:#202020;
      }
      #seb-evalpro-abandon-box h2{margin:0 0 8px;color:#c62828;font-size:22px}
      #seb-evalpro-abandon-box .seb-abandon-exercise{font-weight:700;margin-bottom:14px;color:#1a3a5f}
      #seb-evalpro-abandon-box .seb-abandon-help{margin:0 0 12px;font-size:14px;line-height:1.4}
      #seb-evalpro-abandon-box .seb-abandon-choice{display:flex;align-items:flex-start;gap:10px;padding:8px 4px;font-size:15px}
      #seb-evalpro-abandon-box .seb-abandon-choice input{margin-top:2px;transform:scale(1.15)}
      #seb-evalpro-abandon-comment{width:100%;min-height:78px;margin-top:10px;padding:8px;border:1px solid #aaa;border-radius:7px;box-sizing:border-box;font:14px Calibri,"Segoe UI",Arial,sans-serif;resize:vertical}
      .seb-abandon-admin{margin-top:14px;padding:11px;border:1px solid #d7dce5;border-radius:7px;background:#f7f9fc}.seb-abandon-admin label{display:block;font-weight:700;color:#1a3a5f;margin-bottom:6px}.seb-abandon-admin small{display:block;color:#666;margin-top:5px}.seb-abandon-admin input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #999;border-radius:5px;font:16px Calibri,"Segoe UI",Arial,sans-serif}
      #seb-evalpro-abandon-error{min-height:19px;margin-top:6px;color:#c62828;font-size:13px;font-weight:700}
      #seb-evalpro-abandon-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
      .seb-admin-abandon-section td{background:#f7c8c8!important;color:#7c1111!important;font-weight:700!important}
      .seb-admin-abandon-row .seb-admin-abandon-state{background:#c62828!important;color:#fff!important;text-align:center!important;font-weight:700!important;vertical-align:middle!important}
      .seb-admin-abandon-row .seb-admin-abandon-comment{white-space:pre-line!important}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function skipButton(button) {
    if (button && button.closest && button.closest('[data-seb-no-normalize="1"]')) return true;
    return !!button.closest(
      '#toolbar,.toolbar-row2,.ql-toolbar,#calc-container,#page-identification,' +
      '#page4 .fraction-title,#page4 .items-wrapper'
    );
  }

  function buttonKind(label) {
    const value = label.toLowerCase();
    if (/abandon|supprim|effacer|réinitial|reinitial|remise à zéro|remise a zero|annuler|fermer|quitter/.test(value)) return 'danger';
    if (/calculatrice/.test(value)) return 'calculator';
    if (/^suivant|^précédent|^precedent|^retour|^page suivante|^étape suivante|^etape suivante|^continuer|^commencer|^terminez?|^terminer/.test(value)) return 'nav';
    return 'functional';
  }

  function iconizedLabel(label) {
    const clean = stripActionIcon(label);
    const value = clean.toLowerCase();
    if (/^abandon/.test(value)) return '⏹ Abandonner l’exercice';
    if (/^démarrer|^demarrer/.test(value)) return '▶ ' + clean;
    if (/^valider|^vérifier|^verifier|^compléter automatiquement|^completer automatiquement/.test(value)) return '✓ ' + clean;
    if (/^envoyer/.test(value)) return '✉ ' + clean;
    if (/calculatrice/.test(value)) return '🧮 Ouvrir la calculatrice';
    if (/^enregistrer/.test(value)) return '💾 ' + clean;
    if (/^exporter/.test(value)) return '⬇ ' + clean;
    if (/^imprimer/.test(value)) return '⬇ ' + clean;
    if (/^voir les résultats|^voir les resultats/.test(value)) return '📊 Voir les résultats';
    if (/^retour/.test(value)) return '← ' + clean;
    if (/^suivant|^page suivante|^étape suivante|^etape suivante|^continuer/.test(value)) return '➜ ' + clean;
    if (/^stop|^arrêter|^arreter/.test(value)) return '■ ' + clean;
    if (/^fermer/.test(value)) return '✕ ' + clean;
    if (/^annuler/.test(value)) return '✕ ' + clean;
    return clean;
  }

  function normalizeButton(button) {
    if (!button || button.nodeType !== 1 || skipButton(button)) return;
    if (button.id === 'seb-evalpro-abandon-fixed') return;
    const raw = cleanText(button.textContent);
    if (!raw) return;
    const label = stripActionIcon(raw);
    const explicitTimerKind = button.classList.contains('seb-btn-timer-start')
      ? 'seb-btn-timer-start'
      : (button.classList.contains('seb-btn-timer-stop') ? 'seb-btn-timer-stop' : '');
    const kind = buttonKind(label);
    const desiredKind = explicitTimerKind || ('seb-btn-' + kind);
    for (const cls of ['seb-btn-nav', 'seb-btn-confirm', 'seb-btn-tool', 'seb-btn-functional', 'seb-btn-calculator', 'seb-btn-danger', 'seb-btn-timer-start', 'seb-btn-timer-stop']) {
      if (cls !== desiredKind && button.classList.contains(cls)) button.classList.remove(cls);
    }
    if (!button.classList.contains('seb-action-btn')) button.classList.add('seb-action-btn');
    if (!button.classList.contains(desiredKind)) button.classList.add(desiredKind);
    const nextLabel = explicitTimerKind ? label : iconizedLabel(label);
    if (nextLabel && cleanText(button.textContent) !== nextLabel) button.textContent = nextLabel;
  }

  function normalizeButtons(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('button').forEach(normalizeButton);
  }

  function isPassButton(button) {
    const label = stripActionIcon(button.textContent).toLowerCase();
    return /^(passer|passez)\b/.test(label) || /^abandonner\b/.test(label) || /abandonner l['’]exercice/.test(label);
  }

  function headingLabel(scope, fallback) {
    if (!scope || !scope.querySelector) return fallback;
    const node = scope.querySelector('h1,h2');
    const value = cleanText(node && node.textContent);
    if (!value) return fallback;
    return value.length > 100 ? value.slice(0, 97) + '…' : value;
  }

  function visibleQcmPage() {
    const pages = Array.from(document.querySelectorAll('.page'));
    return pages.find((page) => page.classList.contains('visible')) || null;
  }

  function currentExerciseContext() {
    const file = pageName();

    if (document.body?.dataset?.sebKaltestExercise === '1') {
      const label = cleanText(document.body.dataset.sebKaltestLabel) || headingLabel(document.body, 'Exercice KALTEST');
      const testId = cleanText(document.body.dataset.sebKaltestId) || 'kaltest';
      return {
        file,
        qcmPage: '',
        scope: document.body,
        label,
        key: file + '#kaltest:' + testId,
        dynamicKaltest: true
      };
    }

    if (file === 'qcmv1.0.html') {
      const scope = visibleQcmPage();
      if (!scope || !scope.id || !QCM_EXERCISE_IDS.has(scope.id)) return null;
      const label = QCM_LABELS[scope.id] || headingLabel(scope, 'QCM — ' + scope.id);
      return { file, qcmPage: scope.id, scope, label, key: file + '#' + scope.id };
    }
    if (!EXERCISE_FILES.has(file)) return null;
    if (file === 'brique.html' || file === 'tri_de_cheville.html') {
      const auto = document.getElementById('autoEvalPart');
      if (auto) {
        let visible = auto.classList.contains('visible');
        try { visible = visible || window.getComputedStyle(auto).display !== 'none'; } catch (_) {}
        if (visible) return null;
      }
    }
    return {
      file,
      qcmPage: '',
      scope: document.body,
      label: EXERCISE_LABELS[file] || headingLabel(document.body, file),
      key: file
    };
  }

  function hideLegacyPassButtons() {
    const file = pageName();
    if (file === 'qcmv1.0.html') {
      document.querySelectorAll('.page').forEach((scope) => {
        if (!scope.id || !QCM_EXERCISE_IDS.has(scope.id)) return;
        scope.querySelectorAll('button').forEach((button) => {
          if (button.closest('#kaloneo-common-navigation') || button.dataset.kaloneoProxyFor) return;
          if (!isPassButton(button)) return;
          button.dataset.sebLegacyPasser = '1';
          button.hidden = true;
          button.style.setProperty('display', 'none', 'important');
        });
      });
      return;
    }
    if (!EXERCISE_FILES.has(file)) return;
    document.querySelectorAll('button').forEach((button) => {
      if (button.closest('#kaloneo-common-navigation') || button.dataset.kaloneoProxyFor) return;
      if (!isPassButton(button) || button.id === 'seb-evalpro-abandon-fixed') return;
      button.dataset.sebLegacyPasser = '1';
      button.hidden = true;
      button.style.setProperty('display', 'none', 'important');
    });
  }


  function autoEvalHasResponse(form) {
    if (!form) return false;
    const checked = form.querySelector('input[type="checkbox"]:checked');
    const text = Array.from(form.querySelectorAll('textarea,input[type="text"]')).some((el) => String(el.value || '').trim() !== '');
    return !!checked || text;
  }

  function protectAutoEvaluations() {
    const form = document.getElementById('autoEvalForm');
    if (!form) return;
    const file = pageName();
    const standalone = file === 'autoeval1.html' || file === 'autoeval2.html';
    document.querySelectorAll('button').forEach((button) => {
      if (skipButton(button)) return;
      const inAuto = standalone || !!button.closest('#autoEvalPart');
      if (!inAuto) return;
      const label = stripActionIcon(button.textContent).toLowerCase();
      if (/^(passer|passez|étape suivante|etape suivante|page suivante|suivant)\b/.test(label)) {
        button.hidden = true;
        button.style.setProperty('display', 'none', 'important');
      }
    });

    if (document.documentElement.dataset.sebAutoEvalGuard === '1') return;
    document.documentElement.dataset.sebAutoEvalGuard = '1';
    document.addEventListener('click', function (event) {
      const button = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!button) return;
      const currentForm = document.getElementById('autoEvalForm');
      if (!currentForm) return;
      const currentFile = pageName();
      const inStandalone = currentFile === 'autoeval1.html' || currentFile === 'autoeval2.html';
      const inIntegrated = !!button.closest('#autoEvalPart');
      if (!inStandalone && !inIntegrated) return;
      const label = stripActionIcon(button.textContent).toLowerCase();
      const validatesAuto = button.id === 'autoEvalBtn' || (/valider/.test(label) && /autoévaluation|autoevaluation/.test(label));
      if (!validatesAuto) return;
      if (autoEvalHasResponse(currentForm)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      window.alert('Merci de compléter cette autoévaluation avant de continuer : cochez au moins une proposition ou saisissez un commentaire.');
    }, true);
  }

  function readAbandons() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(ABANDON_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveAbandon(context, reasons, comment, nonEvaluated = false) {
    const now = new Date();
    const record = {
      key: context.key,
      page: context.file,
      qcmPage: context.qcmPage || '',
      exercice: context.label,
      raisons: reasons.slice(),
      commentaire: String(comment || '').trim(),
      nonEvaluated: Boolean(nonEvaluated),
      horodatage: now.toLocaleString('fr-FR'),
      iso: now.toISOString()
    };
    const list = readAbandons();
    const index = list.findIndex((item) => item && item.key === record.key);
    if (index >= 0) list[index] = record;
    else list.push(record);
    sessionStorage.setItem(ABANDON_KEY, JSON.stringify(list));
    if (window.sebEvalPro && typeof window.sebEvalPro.save === 'function') window.sebEvalPro.save();
    return record;
  }

  function withConfirmedNavigation(action) {
    const originalConfirm = window.confirm;
    try {
      window.confirm = function () { return true; };
      action();
    } finally {
      window.confirm = originalConfirm;
    }
  }

  function invokeQcmNext(context) {
    const legacy = context.scope.querySelector('button[data-seb-legacy-passer="1"]');
    if (legacy) {
      withConfirmedNavigation(function () { legacy.click(); });
      return true;
    }

    const candidates = Array.from(context.scope.querySelectorAll('button')).filter((button) => {
      if (button.id === 'seb-evalpro-abandon-fixed') return false;
      const value = stripActionIcon(button.textContent).toLowerCase();
      return /suivant|étape suivante|etape suivante|page suivante|continuer/.test(value);
    });

    for (const button of candidates) {
      const source = button.getAttribute('onclick') || '';
      const match = source.match(/nextPage\(\s*(['"]?)([^'"\)]+)\1\s*\)/);
      if (match && typeof window.nextPage === 'function') {
        const raw = String(match[2]).trim();
        const target = /^\d+$/.test(raw) ? Number(raw) : raw;
        window.nextPage(target);
        return true;
      }
      const go = source.match(/goToPage\(\s*['"]([^'"]+)['"]\s*\)/);
      if (go) {
        window.location.href = go[1];
        return true;
      }
    }

    if (candidates[0]) {
      withConfirmedNavigation(function () { candidates[0].click(); });
      return true;
    }
    return false;
  }

  function advanceAfterAbandon(context, record) {
    if (context.dynamicKaltest && window.sebKaltestHost && typeof window.sebKaltestHost.onAbandon === 'function') {
      window.sebKaltestHost.onAbandon(record || null);
      return;
    }

    if (context.file === 'qcmv1.0.html') {
      if (!invokeQcmNext(context)) {
        window.alert('L’abandon a bien été enregistré. Utilisez le bouton Suivant pour poursuivre.');
      }
      return;
    }
    const target = NEXT_BY_FILE[context.file];
    if (target) {
      window.location.href = target;
      return;
    }
    window.alert('L’abandon a bien été enregistré. Utilisez le bouton Suivant pour poursuivre.');
  }

  function openAbandonDialog(context) {
    if (!context || document.getElementById('seb-evalpro-abandon-layer')) return;
    const layer = document.createElement('div');
    layer.id = 'seb-evalpro-abandon-layer';
    layer.innerHTML = `
      <div id="seb-evalpro-abandon-box" role="dialog" aria-modal="true" aria-label="Abandonner l’exercice">
        <h2>Abandonner l’exercice</h2>
        <div class="seb-abandon-exercise"></div>
        <p class="seb-abandon-help">Indiquez la ou les raisons de votre abandon. Au moins une proposition doit être cochée. L’abandon doit ensuite être validé par un administrateur.</p>
        <label class="seb-abandon-choice"><input type="checkbox" data-abandon-reason="1" value="Je ne comprends pas la consigne"><span>Je ne comprends pas la consigne.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" data-abandon-reason="1" value="L’exercice est trop difficile"><span>L’exercice est trop difficile.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" data-abandon-reason="1" value="Fatigue, gêne ou douleur"><span>Je ressens de la fatigue, une gêne ou une douleur.</span></label>
        <label class="seb-abandon-choice"><input type="checkbox" data-abandon-reason="1" value="Autre raison" data-other="1"><span>Autre raison.</span></label>
        <textarea id="seb-evalpro-abandon-comment" placeholder="Précisez si nécessaire. Si vous cochez « Autre raison », indiquez ici la raison."></textarea>
        <label class="seb-abandon-choice seb-abandon-ne-choice"><input type="checkbox" id="seb-evalpro-abandon-ne" data-abandon-ne="1"><span><strong>Exercice non évalué dans le bilan</strong><br><small>Les points obtenus et le barème de cet exercice seront exclus des calculs du bilan.</small></span></label>
        <div class="seb-abandon-admin"><label for="seb-evalpro-abandon-admin-password">Validation administrateur</label><input id="seb-evalpro-abandon-admin-password" type="password" autocomplete="off" placeholder="Mot de passe administrateur"><small>L’administrateur doit valider l’abandon avant de poursuivre.</small></div>
        <div id="seb-evalpro-abandon-error" aria-live="polite"></div>
        <div id="seb-evalpro-abandon-actions">
          <button type="button" id="seb-evalpro-abandon-cancel" class="seb-action-btn seb-btn-danger">✕ Annuler</button>
          <button type="button" id="seb-evalpro-abandon-confirm" class="seb-action-btn seb-btn-danger">⏹ Confirmer l’abandon</button>
        </div>
      </div>`;
    layer.querySelector('.seb-abandon-exercise').textContent = context.label;
    document.body.appendChild(layer);

    const error = layer.querySelector('#seb-evalpro-abandon-error');
    const comment = layer.querySelector('#seb-evalpro-abandon-comment');
    const adminPassword = layer.querySelector('#seb-evalpro-abandon-admin-password');
    const close = function () { layer.remove(); };

    layer.querySelector('#seb-evalpro-abandon-cancel').addEventListener('click', close);
    layer.querySelector('#seb-evalpro-abandon-confirm').addEventListener('click', async function () {
      const checked = Array.from(layer.querySelectorAll('input[data-abandon-reason="1"]:checked'));
      const nonEvaluated = !!layer.querySelector('#seb-evalpro-abandon-ne')?.checked;
      if (checked.length === 0) {
        error.textContent = 'Cochez au moins une raison avant de confirmer.';
        return;
      }
      const otherChecked = checked.some((input) => input.dataset.other === '1');
      if (otherChecked && !comment.value.trim()) {
        error.textContent = 'Précisez la raison dans la zone de commentaire.';
        comment.focus();
        return;
      }
      const password = String(adminPassword?.value || '').trim();
      if (!password) {
        error.textContent = 'Le mot de passe administrateur est obligatoire pour valider l’abandon.';
        adminPassword?.focus();
        return;
      }
      let adminOk = false;
      try {
        adminOk = !!(window.sebEvalPro?.verifyAdminPassword && await window.sebEvalPro.verifyAdminPassword(password));
      } catch (_) {}
      if (!adminOk) {
        error.textContent = 'Mot de passe administrateur incorrect. L’exercice reste actif.';
        if (adminPassword) { adminPassword.value = ''; adminPassword.focus(); }
        return;
      }
      const reasons = checked.map((input) => input.value);
      if (context.file === 'tri_de_cheville.html') {
        try { if (typeof window.calcMoyenne === 'function') window.calcMoyenne(); } catch (_) {}
        try { if (typeof window.saveTriResultsToQCM === 'function') window.saveTriResultsToQCM(); } catch (_) {}
      }
      if (context.file === 'dictee.html') {
        try {
          let state = {};
          try { state = JSON.parse(sessionStorage.getItem('dictee_data') || '{}') || {}; } catch (_) {}
          state.status = 'abandoned';
          state.scoreSur20 = 0;
          state.abandonne = true;
          sessionStorage.setItem('dictee_data', JSON.stringify(state));
          if (window.sebEvalPro && typeof window.sebEvalPro.save === 'function') window.sebEvalPro.save();
        } catch (_) {}
      }
      const record = saveAbandon(context, reasons, comment.value, nonEvaluated);
      close();
      setTimeout(function () { advanceAfterAbandon(context, record); }, 40);
    });

    layer.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
  }

  function ensureAbandonButton() {
    let button = document.getElementById('seb-evalpro-abandon-fixed');
    if (!button) {
      button = document.createElement('button');
      button.id = 'seb-evalpro-abandon-fixed';
      button.type = 'button';
      button.className = 'seb-action-btn seb-btn-danger';
      button.textContent = '⏹ Abandonner l’exercice';
      button.addEventListener('click', function () {
        const context = currentExerciseContext();
        if (context) openAbandonDialog(context);
      });
      document.body.appendChild(button);
    }
    return button;
  }

  function refreshAbandonButton() {
    const button = ensureAbandonButton();
    const context = currentExerciseContext();
    if (context) {
      button.style.setProperty('display', 'inline-flex', 'important');
      button.title = 'Abandonner : ' + context.label;
    } else {
      button.style.setProperty('display', 'none', 'important');
      button.title = '';
    }
  }

  function renderAdminAbandons() {
    if (pageName() !== 'admin-bilan.html') return;
    const tbody = document.querySelector('#bilan tbody');
    if (!tbody) return;
    tbody.querySelectorAll('.seb-admin-abandon-section,.seb-admin-abandon-row').forEach((node) => node.remove());
    const list = readAbandons();
    if (!list.length) return;

    const section = document.createElement('tr');
    section.className = 'section2 seb-admin-abandon-section';
    const sectionCell = document.createElement('td');
    sectionCell.colSpan = 6;
    sectionCell.textContent = 'Exercices abandonnés par le stagiaire';
    section.appendChild(sectionCell);
    tbody.appendChild(section);

    list.forEach((record) => {
      const row = document.createElement('tr');
      row.className = 'seb-admin-abandon-row';

      const exerciseCell = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = record.exercice || record.page || 'Exercice';
      exerciseCell.appendChild(strong);

      const stateCell = document.createElement('td');
      stateCell.colSpan = 4;
      stateCell.className = 'seb-admin-abandon-state';
      stateCell.textContent = 'EXERCICE ABANDONNÉ';

      const commentCell = document.createElement('td');
      commentCell.className = 'seb-admin-abandon-comment';
      const reasons = Array.isArray(record.raisons) ? record.raisons.join(' ; ') : '';
      let details = 'Motif(s) : ' + (reasons || 'Non renseigné');
      if (record.commentaire) details += '\nCommentaire : ' + record.commentaire;
      if (record.horodatage) details += '\nEnregistré le : ' + record.horodatage;
      details += '\nLes données déjà saisies avant l’abandon ont été conservées.';
      commentCell.textContent = details;

      row.appendChild(exerciseCell);
      row.appendChild(stateCell);
      row.appendChild(commentCell);
      tbody.appendChild(row);
    });
  }

  function refreshAll() {
    ensureStyles();
    normalizeButtons(document);
    hideLegacyPassButtons();
    protectAutoEvaluations();
    refreshAbandonButton();
    renderAdminAbandons();
  }

  function scheduleRefresh() {
    if (mutationScheduled) return;
    mutationScheduled = true;
    setTimeout(function () {
      mutationScheduled = false;
      refreshAll();
    }, 0);
  }

  function init() {
    refreshAll();
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();


// SEB_EXERCISE_NAVIGATION_GUARD98
(function(){
  'use strict';

  const TRUE_FILES = new Set([
    'brique.html','stock.html','planning.html','genrenombres.html',
    'tri_de_cheville.html','nwtexte.html','nvmail.html','paronymes.html','carre.html'
  ]);
  const QCM_IDS = new Set(['page2','page2_1','page3','page4','page5','page5_1','page6','pageTexteTrous','page8']);
  let scheduled = false;

  function fileName(){
    try { return decodeURIComponent((window.location.pathname.split('/').pop() || '').toLowerCase()); }
    catch (_) { return ''; }
  }

  function clean(value){
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^(?:➡️|➡|➜|→|←|✓|✔|▶️|▶|⏹️|⏹|■|📊|🧮|💾|✉️|✉)\s*/u, '')
      .replace(/\s*(?:->|→|➜)\s*$/u, '')
      .trim();
  }

  function visibleQcmExercise(){
    const page = Array.from(document.querySelectorAll('.page')).find(function(node){ return node.classList.contains('visible'); });
    return page && QCM_IDS.has(page.id) ? page : null;
  }

  function context(){
    const file = fileName();
    if (file === 'qcmv1.0.html') {
      const scope = visibleQcmExercise();
      return scope ? { file:file, scope:scope, key:file + '#' + scope.id } : null;
    }
    if (!TRUE_FILES.has(file)) return null;
    return { file:file, scope:document.body, key:file };
  }

  function activityKey(ctx){ return 'seb_exercise_activity:' + ctx.key; }
  function hasActivityFlag(ctx){ return sessionStorage.getItem(activityKey(ctx)) === '1'; }
  function setActivity(ctx){
    if (!ctx) return;
    sessionStorage.setItem(activityKey(ctx), '1');
  }

  function hasMeaningfulValues(scope){
    if (!scope || !scope.querySelectorAll) return false;
    if (scope.querySelector('input[type="checkbox"]:checked,input[type="radio"]:checked,.item.selected,[aria-pressed="true"]')) return true;

    const fields = Array.from(scope.querySelectorAll('input,textarea,select'));
    for (const field of fields) {
      const type = String(field.type || '').toLowerCase();
      if (['hidden','button','submit','reset','file','checkbox','radio'].includes(type)) continue;
      if (field.tagName === 'SELECT') {
        const value = String(field.value == null ? '' : field.value).trim();
        if (field.selectedIndex > 0 && value !== '' && value !== '_') return true;
        continue;
      }
      if (String(field.value == null ? '' : field.value).trim() !== '') return true;
    }

    const editable = Array.from(scope.querySelectorAll('[contenteditable="true"],.ql-editor'));
    if (editable.some(function(node){
      const text = String(node.innerText || node.textContent || '').replace(/\u200B/g, '').trim();
      return text !== '' || !!node.querySelector('img');
    })) return true;

    const file = fileName();
    if (file === 'stock.html' && scope.querySelector('.case .pot,#zone-tri .pot,.etagere .pot')) return true;
    return false;
  }

  function storageExists(key){ return sessionStorage.getItem(key) !== null; }

  function ready(ctx){
    if (!ctx) return true;

    if (!hasActivityFlag(ctx) && hasMeaningfulValues(ctx.scope)) setActivity(ctx);
    const activity = hasActivityFlag(ctx);

    if (ctx.file === 'tri_de_cheville.html') {
      if (typeof window.sebEvalProTriNavigationReady === 'function') return !!window.sebEvalProTriNavigationReady();
      return sessionStorage.getItem('seb_tri_navigation_ready') === '1';
    }
    if (ctx.file === 'brique.html') return activity && storageExists('eval_brique') && storageExists('eval_brique_auto');
    if (ctx.file === 'stock.html') return activity && storageExists('stockTotal');
    if (ctx.file === 'planning.html') return activity && storageExists('planningScore');
    if (ctx.file === 'genrenombres.html') return activity && storageExists('erreurs_exercice');
    if (ctx.file === 'nvmail.html') return activity && storageExists('page8_data');
    if (ctx.file === 'paronymes.html') return activity && storageExists('paronymes_score');
    if (ctx.file === 'carre.html') return activity && storageExists('carre_magique_score');
    if (ctx.file === 'nwtexte.html') return activity;

    // Pages d'exercices QCM : le bouton Suivant n'est pas disponible tant
    // qu'aucune réponse / sélection n'a été effectuée sur la page visible.
    if (ctx.file === 'qcmv1.0.html') return activity;
    return activity;
  }

  function isNavigationButton(button){
    if (!button || button.id === 'seb-evalpro-abandon-fixed') return false;
    if (button.closest('#seb-evalpro-topbar,#seb-evalpro-admin-dialog,#seb-evalpro-session-close-dialog,#seb-evalpro-abandon-layer')) return false;
    const label = clean(button.textContent).toLowerCase();
    return /^(suivant|page suivante|étape suivante|etape suivante|continuer)\b/.test(label);
  }

  function belongsToContext(button, ctx){
    if (!ctx) return false;
    if (ctx.file === 'qcmv1.0.html') return ctx.scope.contains(button);
    return document.body.contains(button);
  }

  function ensureStyle(){
    if (document.getElementById('seb-exercise-navigation-guard-style')) return;
    const style = document.createElement('style');
    style.id = 'seb-exercise-navigation-guard-style';
    style.textContent = 'button.seb-exercise-nav-locked{display:none!important}';
    (document.head || document.documentElement).appendChild(style);
  }

  function enforce(){
    scheduled = false;
    ensureStyle();
    const ctx = context();
    if (!ctx) {
      document.querySelectorAll('.seb-exercise-nav-locked').forEach(function(button){ button.classList.remove('seb-exercise-nav-locked'); });
      return;
    }
    const unlocked = ready(ctx);
    document.querySelectorAll('button').forEach(function(button){
      if (!isNavigationButton(button) || !belongsToContext(button, ctx)) return;
      button.classList.toggle('seb-exercise-nav-locked', !unlocked);
      button.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
      if (!unlocked) button.tabIndex = -1;
      else if (button.tabIndex < 0) button.removeAttribute('tabindex');
    });
    try { window.KaloneoNavigation?.refresh?.(); } catch (_) {}
  }

  function schedule(){
    if (scheduled) return;
    scheduled = true;
    setTimeout(enforce, 0);
  }

  function markFromEvent(event){
    const ctx = context();
    if (!ctx) return;
    const target = event.target;
    if (!target || (ctx.file === 'qcmv1.0.html' && !ctx.scope.contains(target))) return;

    if (event.type === 'input' || event.type === 'change' || event.type === 'drop' || event.type === 'dragstart') {
      setActivity(ctx);
      schedule();
      return;
    }

    if (event.type === 'click') {
      const interactive = target.closest && target.closest('.item,[aria-pressed],td:not(.paronyme),.pot,.case,[contenteditable="true"],.fake-file-input');
      if (interactive) {
        setActivity(ctx);
        schedule();
        return;
      }
      const button = target.closest && target.closest('button');
      if (button) {
        const label = clean(button.textContent).toLowerCase();
        if (/^(démarrer|demarrer)\b/.test(label)) {
          setActivity(ctx);
          schedule();
        }
      }
    }
  }

  document.addEventListener('click', function(event){
    const button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button || !isNavigationButton(button)) return;
    const ctx = context();
    if (!ctx || !belongsToContext(button, ctx) || ready(ctx)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    window.alert(ctx.file === 'tri_de_cheville.html'
      ? 'Terminez au moins 3 tris puis validez l’autoévaluation avant de passer à l’étape suivante.'
      : 'Vous devez réaliser l’exercice avant de passer à l’étape suivante. Si vous souhaitez arrêter cet exercice, utilisez « Abandonner l’exercice ».');
  }, true);

  ['input','change','click','drop','dragstart'].forEach(function(type){
    document.addEventListener(type, markFromEvent, true);
  });

  function init(){
    ensureStyle();
    enforce();
    new MutationObserver(schedule).observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','style','hidden','aria-pressed']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();


// KALONEO_STABLE_BOTTOM_BAR_V16
(function(){
  'use strict';

  const BAR_HEIGHT=52;
  /* Icône officielle fournie pour KALONÉO, rasterisée à 40 px pour éviter toute dépendance de chemin dans le Setup. */
  const KALONEO_BAR_ICON_DATA='data:image/png;base64,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';
  const ELIGIBLE_FILES=new Set([
    'kaltest-pilot2.html','qcmv1.0.html','brique.html','stock.html','planning.html','genrenombres.html',
    'dictee.html','tri_de_cheville.html','nwtexte.html','nvmail.html','autoeval1.html','autoeval2.html',
    'paronymes.html','carre.html'
  ]);
  const QCM_EXERCISE_IDS=new Set(['page2','page2_1','page3','pageTexteTrous','page4','page5','page5_1','page6','page11']);
  const QCM_NEXT_BY_PAGE=Object.freeze({
    page2:'#page2Next',
    page2_1:'#page2_1Next',
    page3:'#page3Next',
    pageTexteTrous:'#texteTrousNext',
    page4:'#page4Next',
    page5:'#page5Next',
    page5_1:'#page5_1Next',
    page6:'#page6Next',
    page11:'.suivant'
  });
  const OWNED_SOURCE_SELECTORS=[
    '#identity-next','#intro-next','#kaltest-next','#kaltest-calculator',
    '#page2Next','#page2_1Next','#page3Next','#texteTrousNext','#page4Next','#page5Next','#page5_1Next','#page6Next','#page11 .suivant',
    '#autoEvalBtn','#validBtn','#stockActionBtn','#btnValider','#btnSuivant','#btnCheck','#btnNextGenreNombre',
    '#seb-dictee-action','#calc','#seb-tri-auto-validate','#seb-tri-next','#btn-score','#nvmail-next',
    '#autoeval1-validate','#autoeval1-next','#autoeval2-validate','#btnNextParonymes',
    '#carre-reset','#btnValidate','#btnNext',
    'button[data-seb-action="open-calculator"]:not(#pilot2-calculator-test-open)'
  ];

  let currentActions=[];
  let refreshScheduled=false;
  let clockTimer=null;

  function fileName(){
    try{return decodeURIComponent((window.location.pathname.split('/').pop()||'').toLowerCase())}
    catch(_){return ''}
  }
  function clean(value){return String(value||'').replace(/\s+/g,' ').trim()}
  function isEligible(){return ELIGIBLE_FILES.has(fileName())}
  function source(selector,scope){
    try{return (scope||document).querySelector(selector)}
    catch(_){return null}
  }
  function visiblePage(){
    return Array.from(document.querySelectorAll('.page')).find(node=>node.classList.contains('visible'))||null;
  }
  function visibleSource(node){
    if(!node||!node.isConnected||node.hidden) return false;
    if(node.getAttribute('aria-hidden')==='true'&&node.classList.contains('seb-exercise-nav-locked')) return false;
    let cursor=node;
    try{
      while(cursor&&cursor.nodeType===1){
        const style=getComputedStyle(cursor);
        if(style.display==='none'||style.visibility==='hidden') return false;
        if(cursor===document.body) break;
        cursor=cursor.parentElement;
      }
    }catch(_){return false}
    return true;
  }
  function currentViewAllowsAbandon(){
    const file=fileName();
    if(file==='kaltest-pilot2.html'){
      if(document.getElementById('page-final')?.classList.contains('visible')) return false;
      if(document.getElementById('page-identification')?.classList.contains('visible')) return false;
      if(document.getElementById('page-intro')?.classList.contains('visible')) return false;
      return !!document.getElementById('page-exercise')?.classList.contains('visible');
    }
    if(file==='qcmv1.0.html'){
      const page=visiblePage();
      return !!page&&QCM_EXERCISE_IDS.has(page.id);
    }
    return file!=='';
  }

  function ensureStyle(){
    if(document.getElementById('kaloneo-stable-bottom-bar-style')) return;
    const style=document.createElement('style');
    style.id='kaloneo-stable-bottom-bar-style';
    style.textContent=`
      :root{
        --kaloneo-bottom-bar-height:${BAR_HEIGHT}px;
        --kaloneo-work-height:calc(100dvh - var(--kaloneo-bottom-bar-height));
      }
      #kaloneo-common-navigation{
        position:fixed!important;
        left:0!important;
        right:0!important;
        bottom:0!important;
        height:var(--kaloneo-bottom-bar-height)!important;
        z-index:2147482500!important;
        display:grid!important;
        grid-template-columns:minmax(285px,320px) minmax(0,1fr) minmax(295px,340px)!important;
        align-items:center!important;
        gap:12px!important;
        padding:5px 14px!important;
        box-sizing:border-box!important;
        border-top:1px solid rgba(255,255,255,.36)!important;
        background:linear-gradient(90deg,#003B57 0%,#004E70 48%,#356787 100%)!important;
        box-shadow:0 -3px 12px rgba(0,39,57,.18)!important;
      }
      #kaloneo-common-navigation[hidden],
      #kaloneo-common-navigation button[hidden]{display:none!important}
      #kaloneo-nav-left{
        min-width:0;
        height:100%;
        display:flex!important;
        align-items:center!important;
        justify-content:flex-start!important;
        gap:10px!important;
      }
      #kaloneo-nav-brand{
        width:42px;
        flex:0 0 42px;
        height:100%;
        display:flex;
        align-items:center;
        justify-content:flex-start;
      }
      #kaloneo-nav-logo-img{
        display:block;
        width:40px;
        height:40px;
        max-width:40px;
        object-fit:contain;
        border-radius:7px;
        background:transparent;
        box-shadow:none;
      }
      #kaloneo-nav-center{
        min-width:0;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:9px!important;
      }
      #kaloneo-nav-right{
        min-width:0;
        display:flex!important;
        align-items:center!important;
        justify-content:flex-end!important;
        gap:10px!important;
      }
      #kaloneo-common-navigation button{
        min-height:36px!important;
        height:36px!important;
        max-height:36px!important;
        margin:0!important;
        position:static!important;
        transform:none!important;
        box-sizing:border-box!important;
        box-shadow:0 2px 5px rgba(0,0,0,.18)!important;
      }
      #kaloneo-common-navigation button:hover:not(:disabled){transform:translateY(-1px)!important}
      #kaloneo-common-navigation button:active:not(:disabled){transform:translateY(0)!important}
      #kaloneo-nav-home{
        --seb-button-color:#003B57!important;
        color:#003B57!important;
        font-weight:800!important;
        white-space:nowrap!important;
        background:linear-gradient(180deg,#FFFFFF 0%,#EAF5FB 100%)!important;
      }
      #kaloneo-nav-clock{
        width:76px;
        flex:0 0 76px;
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        justify-content:center;
        color:#fff;
        font-family:Calibri,"Segoe UI",Arial,sans-serif;
        line-height:1.05;
        user-select:none;
        text-shadow:0 1px 2px rgba(0,0,0,.22);
      }
      #kaloneo-nav-time{font-size:13px;font-weight:700}
      #kaloneo-nav-date{font-size:11px;margin-top:3px}
      html body #seb-evalpro-abandon-fixed.seb-kaloneo-global-source,
      html body #seb-evalpro-privacy-toggle.seb-kaloneo-global-source,
      html body button.seb-kaloneo-owned-nav-source{
        position:fixed!important;
        left:0!important;
        top:0!important;
        right:auto!important;
        bottom:auto!important;
        width:1px!important;
        min-width:0!important;
        max-width:1px!important;
        height:1px!important;
        min-height:0!important;
        max-height:1px!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        opacity:0!important;
        overflow:hidden!important;
        pointer-events:none!important;
        box-shadow:none!important;
        transform:none!important;
        clip-path:inset(50%)!important;
      }

      /* La barre prend sa propre place : aucune page ne doit être plus haute que la zone utile. */
      html:has(body.seb-kaloneo-nav-active){height:100dvh!important;overflow:hidden!important}
      body.seb-kaloneo-nav-active{
        width:100%!important;
        height:var(--kaloneo-work-height)!important;
        margin:0!important;
        min-height:0!important;
        max-height:var(--kaloneo-work-height)!important;
        padding-bottom:0!important;
        margin-bottom:0!important;
        overflow:hidden!important;
        box-sizing:border-box!important;
        scroll-padding-bottom:0!important;
      }
      body.seb-kaloneo-nav-active #pilot2-shell,
      body.seb-kaloneo-nav-active .kaloneo-practical-page,
      body.seb-kaloneo-nav-active .k-stock-page,
      body.seb-kaloneo-nav-active[data-kaloneo-page="planning"] .container,
      body.seb-kaloneo-nav-active[data-kaloneo-page="dictee"] .page,
      body.seb-kaloneo-nav-active[data-kaloneo-page="tri"] .wrapper,
      body.seb-kaloneo-nav-active[data-kaloneo-page="nwtexte"] #page7,
      body.seb-kaloneo-nav-active[data-kaloneo-page="nvmail"] #page8,
      body.seb-kaloneo-nav-active[data-kaloneo-page="autoeval1"] #pageAutoEval1,
      body.seb-kaloneo-nav-active[data-kaloneo-page="autoeval2"] #pageAutoEval2,
      body.seb-kaloneo-nav-active[data-kaloneo-page="carre"] .container{
        height:100%!important;
        min-height:0!important;
        max-height:100%!important;
        padding-bottom:8px!important;
        overflow:hidden!important;
        box-sizing:border-box!important;
      }
      body.seb-kaloneo-nav-active #page2,
      body.seb-kaloneo-nav-active #page2_1,
      body.seb-kaloneo-nav-active #page3,
      body.seb-kaloneo-nav-active #pageTexteTrous,
      body.seb-kaloneo-nav-active #page4,
      body.seb-kaloneo-nav-active #page5,
      body.seb-kaloneo-nav-active #page5_1,
      body.seb-kaloneo-nav-active #page6,
      body.seb-kaloneo-nav-active #page11,
      body.seb-kaloneo-nav-active #pageFinale{
        height:100%!important;
        min-height:0!important;
        max-height:100%!important;
        padding-bottom:8px!important;
        overflow:hidden!important;
        box-sizing:border-box!important;
      }

      /* Les anciens pieds de page ne réservent plus de place aux boutons déplacés dans la barre. */
      body.seb-kaloneo-nav-active .kaltest-footer .pilot2-actions,
      body.seb-kaloneo-nav-active .k-stock-actions,
      body.seb-kaloneo-nav-active[data-kaloneo-page="planning"] #left>div:has(#btnValider,#btnSuivant),
      body.seb-kaloneo-nav-active[data-kaloneo-page="autoeval1"] .footer,
      body.seb-kaloneo-nav-active[data-kaloneo-page="autoeval2"] .footer,
      body.seb-kaloneo-nav-active[data-kaloneo-page="tri"] .footer:has(#seb-tri-next),
      body.seb-kaloneo-nav-active[data-kaloneo-page="tri"] .footer:has(#seb-tri-auto-validate),
      body.seb-kaloneo-nav-active[data-kaloneo-page="dictee"] footer.card.footer{
        display:flex!important;
        height:0!important;
        min-height:0!important;
        max-height:0!important;
        margin:0!important;
        padding:0!important;
        border:0!important;
        background:transparent!important;
        box-shadow:none!important;
        overflow:visible!important;
      }
      body.seb-kaloneo-nav-active .kaltest-footer{
        min-height:0!important;
        height:auto!important;
        margin:0!important;
      }
      body.seb-kaloneo-nav-active .kaltest-footer .pilot2-status:empty{display:none!important}

      /* Une seule puce ordinaire KALONÉO : le gros point. */
      body.seb-kaloneo-bullet-scope ul:not(.seb-kaloneo-no-bullets){
        list-style-type:disc!important;
        list-style-position:outside!important;
        padding-left:1.45em!important;
      }
      body.seb-kaloneo-bullet-scope ul:not(.seb-kaloneo-no-bullets)>li{padding-left:.15em!important}
      body.seb-kaloneo-bullet-scope ul:not(.seb-kaloneo-no-bullets)>li::marker{
        content:"•  ";
        font-size:1.32em;
        font-weight:900;
      }
      body.seb-kaloneo-bullet-scope #modalFichier ul,
      body.seb-kaloneo-bullet-scope #modalFichier li,
      body.seb-kaloneo-bullet-scope #modalFichier ul>li::marker{
        list-style:none!important;
        content:""!important;
        padding-left:0!important;
      }

      @media(max-width:1240px){
        #kaloneo-common-navigation{
          grid-template-columns:minmax(255px,285px) minmax(0,1fr) minmax(285px,315px)!important;
          gap:8px!important;
          padding-left:9px!important;
          padding-right:9px!important;
        }
        #kaloneo-nav-brand{width:38px;flex-basis:38px}
        #kaloneo-nav-logo-img{width:36px;height:36px;max-width:36px}
        #kaloneo-common-navigation button{padding-left:12px!important;padding-right:12px!important;font-size:14px!important}
      }
    `;
    (document.head||document.documentElement).appendChild(style);
  }

  function ensureBar(){
    let bar=document.getElementById('kaloneo-common-navigation');
    if(bar) return bar;
    bar=document.createElement('nav');
    bar.id='kaloneo-common-navigation';
    bar.setAttribute('aria-label','Barre de navigation KALONÉO');
    bar.innerHTML=`
      <div id="kaloneo-nav-left">
        <div id="kaloneo-nav-brand" aria-label="KALONÉO">
          <img id="kaloneo-nav-logo-img" alt="KALONÉO">
        </div>
        <button id="kaloneo-nav-abandon" type="button" class="seb-action-btn seb-btn-danger" hidden>⏹ Abandonner l’exercice</button>
      </div>
      <div id="kaloneo-nav-center"></div>
      <div id="kaloneo-nav-right">
        <button id="kaloneo-nav-home" type="button" class="seb-action-btn seb-btn-tool" hidden>⌂ Afficher l’écran d’accueil</button>
        <span id="kaloneo-nav-clock" aria-label="Date et heure">
          <span id="kaloneo-nav-time"></span>
          <span id="kaloneo-nav-date"></span>
        </span>
      </div>
    `;
    const logo=bar.querySelector('#kaloneo-nav-logo-img');
    if(logo) logo.src=KALONEO_BAR_ICON_DATA;
    document.body.appendChild(bar);

    bar.querySelector('#kaloneo-nav-abandon')?.addEventListener('click',function(event){
      event.preventDefault();
      const original=document.getElementById('seb-evalpro-abandon-fixed');
      if(original&&!original.disabled) original.click();
    });
    bar.querySelector('#kaloneo-nav-home')?.addEventListener('click',function(event){
      event.preventDefault();
      const original=document.getElementById('seb-evalpro-privacy-toggle');
      if(original&&!original.disabled) original.click();
    });

    const center=bar.querySelector('#kaloneo-nav-center');
    for(let i=0;i<3;i++){
      const button=document.createElement('button');
      button.type='button';
      button.className='seb-action-btn kaloneo-nav-action';
      button.dataset.kaloneoActionIndex=String(i);
      button.hidden=true;
      button.addEventListener('click',function(event){
        event.preventDefault();
        const action=currentActions[i];
        if(!action||action.disabled) return;
        if(typeof action.invoke==='function'){
          try{action.invoke()}catch(_){}
          scheduleRefresh();
          setTimeout(scheduleRefresh,40);
          return;
        }
        const target=action.source;
        if(!target||target.disabled||target.getAttribute('aria-disabled')==='true') return;
        try{target.click()}catch(_){}
        scheduleRefresh();
        setTimeout(scheduleRefresh,40);
      });
      center.appendChild(button);
    }
    return bar;
  }

  function syncGlobalButtons(){
    const bar=ensureBar();
    const abandonSource=document.getElementById('seb-evalpro-abandon-fixed');
    const abandonButton=bar.querySelector('#kaloneo-nav-abandon');
    if(abandonSource) abandonSource.classList.add('seb-kaloneo-global-source');
    if(abandonButton){
      const allowed=currentViewAllowsAbandon();
      const visible=allowed&&!!abandonSource&&visibleSource(abandonSource);
      abandonButton.hidden=!visible;
      abandonButton.disabled=!abandonSource||!!abandonSource.disabled;
      abandonButton.title=abandonSource?.title||'';
    }

    const homeSource=document.getElementById('seb-evalpro-privacy-toggle');
    const homeButton=bar.querySelector('#kaloneo-nav-home');
    if(homeSource) homeSource.classList.add('seb-kaloneo-global-source');
    if(homeButton){
      homeButton.hidden=!homeSource;
      homeButton.disabled=!homeSource||!!homeSource.disabled;
      homeButton.title=homeSource?.title||'';
    }
  }

  function sourceAction(selector,scope){
    const node=source(selector,scope);
    if(!node||!visibleSource(node)) return null;
    node.classList.add('seb-kaloneo-owned-nav-source');
    return {source:node,label:clean(node.textContent)};
  }
  function chooseNextOrPrimary(nextSelector,primarySelector){
    const next=sourceAction(nextSelector);
    if(next) return [next];
    const primary=sourceAction(primarySelector);
    return primary?[primary]:[];
  }
  function calculatorFrom(scope){
    const node=source('button[data-seb-action="open-calculator"]',scope);
    if(!node||!visibleSource(node)) return null;
    node.classList.add('seb-kaloneo-owned-nav-source');
    return {source:node,label:clean(node.textContent)||'Ouvrir la calculatrice'};
  }
  function withCalculator(actions,scope){
    const calc=calculatorFrom(scope);
    return calc?[calc,...actions]:actions;
  }

  function resolveActions(){
    const file=fileName();

    if(file==='kaltest-pilot2.html'){
      if(!document.getElementById('page-exercise')?.classList.contains('visible')){
        return ['#identity-next','#intro-next'].map(sel=>sourceAction(sel)).filter(Boolean);
      }
      const interactive=window.sebKaltestPilot2?.candidateBarActions?.();
      if(Array.isArray(interactive)&&interactive.length){
        return interactive.slice(0,3).map(action=>({
          source:null,
          label:clean(action?.label),
          disabled:action?.disabled===true,
          title:clean(action?.title),
          invoke:()=>window.sebKaltestPilot2?.invokeCandidateBarAction?.(action?.id)
        })).filter(action=>action.label);
      }
      const primary=sourceAction('#kaltest-next');
      const calc=sourceAction('#kaltest-calculator');
      return [calc,primary].filter(Boolean);
    }

    if(file==='qcmv1.0.html'){
      const page=visiblePage();
      if(!page) return [];
      const selector=QCM_NEXT_BY_PAGE[page.id];
      const primary=selector?sourceAction(selector,page):null;
      return withCalculator(primary?[primary]:[],page);
    }

    if(file==='brique.html'){
      const auto=sourceAction('#autoEvalBtn');
      if(auto) return [auto];
      const validate=sourceAction('#validBtn');
      return validate?[validate]:[];
    }
    if(file==='stock.html'){
      const action=sourceAction('#stockActionBtn');
      return action?[action]:[];
    }
    if(file==='planning.html') return chooseNextOrPrimary('#btnSuivant','#btnValider');
    if(file==='genrenombres.html') return chooseNextOrPrimary('#btnNextGenreNombre','#btnCheck');
    if(file==='dictee.html'){
      const action=sourceAction('#seb-dictee-action');
      return action?[action]:[];
    }
    if(file==='tri_de_cheville.html'){
      const next=sourceAction('#seb-tri-next');
      if(next) return [next];
      const auto=sourceAction('#seb-tri-auto-validate');
      if(auto) return [auto];
      const results=sourceAction('#calc');
      return results?[results]:[];
    }
    if(file==='nwtexte.html'){
      const action=sourceAction('#btn-score');
      return action?[action]:[];
    }
    if(file==='nvmail.html'){
      const action=sourceAction('#nvmail-next');
      return action?[action]:[];
    }
    if(file==='autoeval1.html'){
      const action=sourceAction('#autoeval1-validate');
      return action?[action]:[];
    }
    if(file==='autoeval2.html'){
      const action=sourceAction('#autoeval2-validate');
      return action?[action]:[];
    }
    if(file==='paronymes.html') return chooseNextOrPrimary('#btnNextParonymes','#btnCheck');
    if(file==='carre.html'){
      return ['#carre-reset','#btnValidate','#btnNext'].map(sel=>sourceAction(sel)).filter(Boolean);
    }
    return [];
  }

  function styleActionButton(button,action){
    const label=clean(action?.label);
    const lower=label.toLowerCase();
    let cls='seb-action-btn kaloneo-nav-action ';
    if(/calculatrice/.test(lower)) cls+='seb-btn-calculator';
    else if(/suivant|page suivante|étape suivante|etape suivante|commencez l'évaluation|commencer l'évaluation|continuer/.test(lower)) cls+='seb-btn-nav';
    else if(/recommencer/.test(lower)) cls+='seb-btn-tool';
    else cls+='seb-btn-functional';
    if(button.className!==cls) button.className=cls;
  }

  function renderActions(){
    const bar=ensureBar();
    currentActions=resolveActions().filter(Boolean).slice(0,3);
    const buttons=Array.from(bar.querySelectorAll('.kaloneo-nav-action'));
    buttons.forEach((button,index)=>{
      const action=currentActions[index];
      if(!action){
        button.hidden=true;
        button.textContent='';
        button.disabled=false;
        button.removeAttribute('title');
        return;
      }
      const src=action.source;
      button.hidden=false;
      button.textContent=action.label;
      button.disabled=action.disabled===true||!!src?.disabled||src?.getAttribute?.('aria-disabled')==='true';
      button.title=action.title||src?.title||'';
      styleActionButton(button,action);
    });
  }

  function normalizeBulletText(){
    if(!document.body.classList.contains('seb-kaloneo-bullet-scope')) return;
    document.querySelectorAll('ul:not(.seb-kaloneo-no-bullets)>li').forEach(li=>{
      if(li.closest('#modalFichier')) return;
      for(const node of Array.from(li.childNodes)){
        if(node.nodeType!==Node.TEXT_NODE||!node.nodeValue||!node.nodeValue.trim()) continue;
        const next=node.nodeValue.replace(/^\s*(?:[•●▪◦‣‧·]\s*)+/u,'');
        if(next!==node.nodeValue) node.nodeValue=next;
        break;
      }
    });
  }

  function updateClock(){
    const bar=ensureBar();
    const now=new Date();
    const time=now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    const date=now.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const timeNode=bar.querySelector('#kaloneo-nav-time');
    const dateNode=bar.querySelector('#kaloneo-nav-date');
    if(timeNode&&timeNode.textContent!==time) timeNode.textContent=time;
    if(dateNode&&dateNode.textContent!==date) dateNode.textContent=date;
  }

  function refresh(){
    refreshScheduled=false;
    ensureStyle();
    const bar=ensureBar();
    // Ne jamais injecter de navigation candidat dans une fiche Résultats ouverte par l'Admin.
    const eligible=isEligible()&&!document.documentElement.classList.contains('seb-admin-results-workspace');
    document.body.classList.toggle('seb-kaloneo-nav-active',eligible);
    document.body.classList.toggle('seb-kaloneo-bullet-scope',eligible);
    bar.hidden=!eligible;
    if(!eligible) return;
    syncGlobalButtons();
    renderActions();
    normalizeBulletText();
    updateClock();
  }
  function scheduleRefresh(){
    if(refreshScheduled) return;
    refreshScheduled=true;
    setTimeout(refresh,0);
  }
  function init(){
    ensureStyle();
    ensureBar();
    OWNED_SOURCE_SELECTORS.forEach(sel=>{
      try{document.querySelectorAll(sel).forEach(node=>node.classList.add('seb-kaloneo-owned-nav-source'))}catch(_){}
    });
    refresh();
    [40,160,500,1000].forEach(ms=>setTimeout(refresh,ms));
    ['click','input','change','drop'].forEach(type=>{
      document.addEventListener(type,function(){setTimeout(scheduleRefresh,0)},true);
    });
    document.addEventListener('seb:kaloneo-navigation-refresh',scheduleRefresh);
    clearInterval(clockTimer);
    clockTimer=setInterval(updateClock,60000);
  }

  window.KaloneoNavigation=Object.freeze({
    refresh:scheduleRefresh,
    bar:ensureBar
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
