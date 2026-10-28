(() => {
  'use strict';

  const MIME = 'application/x-kaloneo-parcours-card';
  const state = {
    library: [],
    maskScreens: [],
    saved: [],
    editingId: null,
    editingSystemProvided: false,
    maskScreen: null,
    introduction: null,
    fin: null,
    tests: [],
    draggingIndex: null,
    pointerDrag: null
  };
  let cleanSnapshot = '';

  const $ = id => document.getElementById(id);

  function api() {
    return window.sebEvalPro || {};
  }

  function refOf(item) {
    return item ? { id:String(item.id), version:String(item.version) } : null;
  }

  function keyOf(item) {
    return item ? String(item.id) + '@' + String(item.version) : '';
  }

  function currentParcoursSnapshot() {
    return JSON.stringify({
      editingId:String(state.editingId || ''),
      name:String($('parcours-name')?.value || ''),
      creator:String($('parcours-creator')?.value || ''),
      maskScreen:refOf(state.maskScreen),
      introduction:refOf(state.introduction),
      tests:state.tests.map(refOf),
      fin:refOf(state.fin)
    });
  }

  function markParcoursClean() {
    cleanSnapshot = currentParcoursSnapshot();
  }

  function hasUnsavedChanges() {
    return Boolean(cleanSnapshot) && currentParcoursSnapshot() !== cleanSnapshot;
  }

  function closeBuilder() {
    if (hasUnsavedChanges() && !confirm(
      'Le parcours contient des modifications non enregistrées.\n\nFermer entraînera la perte de ces modifications. Continuer ?'
    )) return;
    window.location.href = 'admin-tests-parcours.html';
  }

  function setStatus(message, type = '') {
    const target = $('builder-status');
    if (!target) return;
    target.textContent = String(message || '');
    target.classList.toggle('ok', type === 'ok');
    target.classList.toggle('error', type === 'error');
  }

  function bilanStatus(item) {
    if(!item||item.role!=='test')return '';
    if(item.category==='autoevaluation')return 'Autoévaluation : hors notation';
    const rows=Array.isArray(item.bilanRows)?item.bilanRows:[];
    if(!rows.length)return 'ATTENTION : aucune ligne institutionnelle reliée';
    if(rows.length>1)return 'Bilan : '+rows.length+' lignes institutionnelles';
    return 'Bilan : '+String(rows[0].label||rows[0].key||'Ligne officielle');
  }

  function categoryLabel(value) {
    const labels = {
      introduction:'Introduction de parcours',
      fin:'Pages de fin',
      mathematiques:'Mathématiques',
      francais:'Français',
      organisation:'Organisation',
      numerique:'Numérique',
      technique:'Technique',
      planification:'Planification',
      activite_pratique:'Activités pratiques',
      transition:'Transition',
      systeme:'Système'
    };
    const raw = String(value || 'Autres');
    return labels[raw] || raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // R48.3 — libellés exclusivement administrateur : ne modifie jamais le titre
  // KALTEST transmis au candidat, ni l'identifiant/version sauvegardés.
  function testTitleDuplicate(item) {
    return item && item.role==='test' && state.library.some(other =>
      other!==item && other.role==='test' &&
      String(other.title||'')===String(item.title||'') &&
      keyOf(other)!==keyOf(item));
  }

  function testOriginLabel(item) {
    if (item.protectedVersion === true) return 'Original KALONÉO';
    if (String(item.id)==='planning_cantine_r48_demo') return 'Essai Builder R48';
    return item.adminModified === true ? 'Personnalisé' : 'Autre version';
  }

  function testAdminTitle(item) {
    if (!testTitleDuplicate(item)) return String(item.title||'');
    const title=String(item.title||'');
    const shortTitle=title==='Planification — Le restaurant'?'Le restaurant':title;
    return shortTitle+' — '+testOriginLabel(item);
  }

  function testAdminIdentity(item) {
    if (!testTitleDuplicate(item)) return '';
    return testOriginLabel(item)+' • ID : '+String(item.id||'');
  }

  function libraryItem(id, version) {
    return [...state.library, ...state.maskScreens].find(item => String(item.id) === String(id) && String(item.version) === String(version)) || null;
  }

  function usedTestIds() {
    return new Set(state.tests.map(item => String(item.id)));
  }

  function addLibraryItem(item) {
    if (!item) return;
    if (item.role === 'mask-screen') {
      state.maskScreen = item;
    } else if (item.role === 'introduction') {
      state.introduction = item;
    } else if (item.role === 'fin') {
      state.fin = item;
    } else {
      if (state.tests.some(test => test.id === item.id)) return;
      state.tests.push(item);
    }
    render();
  }

  function removeTest(index) {
    if (index < 0 || index >= state.tests.length) return;
    state.tests.splice(index, 1);
    render();
  }

  function moveTest(from, to) {
    if (from < 0 || from >= state.tests.length) return;
    const bounded = Math.max(0, Math.min(to, state.tests.length - 1));
    if (from === bounded) return;
    const [item] = state.tests.splice(from, 1);
    state.tests.splice(bounded, 0, item);
    render();
  }

  function dragPayload(event, payload) {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = payload.source === 'sequence' ? 'move' : 'copy';
    event.dataTransfer.setData(MIME, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', payload.id || '');
  }

  function readDragPayload(event) {
    try {
      const raw = event.dataTransfer && event.dataTransfer.getData(MIME);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clearPointerDropTargets() {
    document.querySelectorAll('.pointer-drop-target').forEach(node => node.classList.remove('pointer-drop-target'));
  }

  function pointInside(element, x, y) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function pointerDropTargetAt(x, y, payload) {
    if (!payload) return null;

    if (payload.source === 'library' && payload.role === 'mask-screen') {
      const mask = $('mask-slot');
      return pointInside(mask, x, y) ? mask : null;
    }

    if (payload.source === 'library' && payload.role === 'introduction') {
      const intro = $('intro-slot');
      return pointInside(intro, x, y) ? intro : null;
    }

    if (payload.source === 'library' && payload.role === 'fin') {
      const fin = $('fin-slot');
      return pointInside(fin, x, y) ? fin : null;
    }

    if (payload.role === 'test') {
      for (const card of document.querySelectorAll('#tests-dropzone .sequence-card')) {
        if (pointInside(card, x, y)) return card;
      }
      const dropzone = $('tests-dropzone');
      if (pointInside(dropzone, x, y)) return dropzone;
      const libraryPanel = document.querySelector('.library-panel');
      if (payload.source === 'sequence' && pointInside(libraryPanel, x, y)) return libraryPanel;
    }

    return null;
  }

  function applyPointerDrop(payload, target) {
    if (!payload || !target) return false;

    if (payload.source === 'library') {
      const item = libraryItem(payload.id, payload.version);
      if (!item) return false;
      if (payload.role === 'mask-screen' && target.id === 'mask-slot') {
        state.maskScreen = item;
        return true;
      }
      if (payload.role === 'introduction' && target.id === 'intro-slot') {
        state.introduction = item;
        return true;
      }
      if (payload.role === 'fin' && target.id === 'fin-slot') {
        state.fin = item;
        return true;
      }
      if (payload.role === 'test') {
        if (state.tests.some(test => test.id === item.id)) return false;
        const targetCard = target.closest?.('.sequence-card');
        if (targetCard) {
          const index = Math.max(0, Math.min(Number(targetCard.dataset.index) || 0, state.tests.length));
          state.tests.splice(index, 0, item);
        } else if (target.id === 'tests-dropzone' || target.closest?.('#tests-dropzone')) {
          state.tests.push(item);
        } else {
          return false;
        }
        return true;
      }
      return false;
    }

    if (payload.source === 'sequence' && payload.role === 'test') {
      const from = state.tests.findIndex(test => String(test.id) === String(payload.id));
      if (from < 0) return false;

      if (target.classList?.contains('library-panel') || target.closest?.('.library-panel')) {
        state.tests.splice(from, 1);
        return true;
      }

      const targetCard = target.closest?.('.sequence-card');
      if (targetCard) {
        const targetId = String(targetCard.dataset.testId || '');
        const to = state.tests.findIndex(test => String(test.id) === targetId);
        if (to < 0 || to === from) return false;
        const [moved] = state.tests.splice(from, 1);
        const adjusted = from < to ? to - 1 : to;
        state.tests.splice(Math.max(0, adjusted), 0, moved);
        return true;
      }

      if (target.id === 'tests-dropzone' || target.closest?.('#tests-dropzone')) {
        const [moved] = state.tests.splice(from, 1);
        state.tests.push(moved);
        return true;
      }
    }
    return false;
  }

  function armMouseDrag(event, payload, source, label) {
    if (!event || event.button !== 0) return;
    if (event.target?.closest?.('button,input,select,textarea,a')) return;

    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let ghost = null;

    const pointTarget = (x, y) => pointerDropTargetAt(x, y, payload);

    const activate = () => {
      if (active) return;
      active = true;
      state.pointerDrag = { payload, source };
      source.classList.add('pointer-dragging');
      ghost = document.createElement('div');
      ghost.className = 'pointer-drag-ghost';
      ghost.textContent = label || payload.id || 'Élément';
      document.body.appendChild(ghost);
    };

    const paint = (x, y) => {
      if (!ghost) return;
      ghost.style.left = Math.min(window.innerWidth - 250, Math.max(8, x + 14)) + 'px';
      ghost.style.top = Math.min(window.innerHeight - 48, Math.max(8, y + 14)) + 'px';
      clearPointerDropTargets();
      const target = pointTarget(x, y);
      if (target) target.classList.add('pointer-drop-target');

      const panel = target?.closest?.('.library-sections,.sequence-scroll,.saved-parcours');
      if (panel) {
        const rect = panel.getBoundingClientRect();
        const edge = 34;
        if (y < rect.top + edge) panel.scrollTop -= 18;
        else if (y > rect.bottom - edge) panel.scrollTop += 18;
      }
    };

    const cleanup = () => {
      clearPointerDropTargets();
      source.classList.remove('pointer-dragging');
      if (ghost) ghost.remove();
      ghost = null;
      state.pointerDrag = null;
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', finish, true);
      window.removeEventListener('blur', cancel, true);
    };

    const move = moveEvent => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!active && Math.hypot(dx, dy) < 5) return;
      activate();
      moveEvent.preventDefault();
      paint(moveEvent.clientX, moveEvent.clientY);
    };

    const finish = endEvent => {
      if (!active) {
        cleanup();
        return;
      }
      endEvent.preventDefault();
      const target = pointTarget(endEvent.clientX, endEvent.clientY);
      const changed = applyPointerDrop(payload, target);
      cleanup();
      if (changed) render();
    };

    const cancel = () => cleanup();

    document.addEventListener('mousemove', move, { capture:true, passive:false });
    document.addEventListener('mouseup', finish, { capture:true, passive:false });
    window.addEventListener('blur', cancel, { capture:true, once:true });
  }

  function renderLibraryCard(item) {
    const template = $('library-card-template');
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = item.id;
    card.dataset.version = item.version;
    card.dataset.role = item.role;

    card.querySelector('.card-title').textContent = testAdminTitle(item);
    card.querySelector('.card-category').textContent = categoryLabel(item.category);

    const details = ['v' + item.version];
    if (item.role === 'mask-screen') {
      details.push(item.systemProvided ? 'écran par défaut' : 'écran de masquage');
      const contents=[];
      if(item.hasText) contents.push('texte');
      if(item.hasImage) contents.push('image');
      if(contents.length) details.push(contents.join(' + '));
    } else if (item.role === 'test') {
      if (item.category === 'activite_pratique' || item.activityType === 'practical') details.push('activité pratique');
      else details.push(item.scored ? 'noté' : 'non noté');
      if (item.questionCount) details.push(item.questionCount + ' question' + (item.questionCount > 1 ? 's' : ''));
    } else if (item.role === 'introduction') {
      details.push('page d’introduction');
    } else {
      details.push('page de fin');
    }
    const identity=testAdminIdentity(item);
    if(identity) details.push(identity);
    const status=bilanStatus(item);
    if(status)details.push(status);
    card.querySelector('.card-meta').textContent = details.join(' • ');
    if(identity)card.title=String(item.title)+' — '+identity;

    card.addEventListener('mousedown', event => {
      armMouseDrag(event, { source:'library', id:item.id, version:item.version, role:item.role }, card, testAdminTitle(item));
    });
    card.addEventListener('dragstart', event => {
      card.classList.add('dragging');
      dragPayload(event, { source:'library', id:item.id, version:item.version, role:item.role });
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    const addButton=card.querySelector('.card-add');
    if(item.role==='mask-screen') {
      addButton.textContent=keyOf(item)===keyOf(state.maskScreen)?'Utilisé':'Utiliser';
      addButton.disabled=keyOf(item)===keyOf(state.maskScreen);
    }
    addButton.addEventListener('click', () => addLibraryItem(item));
    return card;
  }

  function renderLibrary() {
    const root = $('library-sections');
    root.replaceChildren();

    const search = String($('library-search').value || '').trim().toLocaleLowerCase('fr-FR');
    const used = usedTestIds();
    const groups = [];

    const masks=state.maskScreens.filter(item=>{
      const haystack=(item.name+' écran de masquage').toLocaleLowerCase('fr-FR');
      return !search || haystack.includes(search);
    });
    if(masks.length) groups.push(['Écrans de masquage', masks.map(item=>Object.assign({role:'mask-screen',title:item.name,category:'masquage',description:''},item))]);

    const introductions = state.library.filter(item =>
      item.role === 'introduction' &&
      (!state.introduction || keyOf(item) !== keyOf(state.introduction))
    );
    if (introductions.length) groups.push(['Introduction de parcours', introductions]);

    const testGroups = new Map();
    for (const item of state.library) {
      if (item.role !== 'test' || used.has(item.id)) continue;
      const haystack = (item.title + ' ' + item.category + ' ' + item.description + ' ' + item.id + ' ' + testAdminTitle(item)).toLocaleLowerCase('fr-FR');
      if (search && !haystack.includes(search)) continue;
      const label = categoryLabel(item.category);
      if (!testGroups.has(label)) testGroups.set(label, []);
      testGroups.get(label).push(item);
    }
    for (const [label, items] of [...testGroups.entries()].sort((a,b) => a[0].localeCompare(b[0], 'fr'))) {
      groups.push([label, items]);
    }

    const fins = state.library.filter(item =>
      item.role === 'fin' &&
      (!state.fin || keyOf(item) !== keyOf(state.fin))
    );
    if (fins.length) groups.push(['Pages de fin', fins]);

    if (search) {
      for (const group of groups) {
        group[1] = group[1].filter(item => {
          const haystack = (item.title + ' ' + item.category + ' ' + item.description + ' ' + item.id + ' ' + testAdminTitle(item)).toLocaleLowerCase('fr-FR');
          return haystack.includes(search);
        });
      }
    }

    let count = 0;
    for (const [label, items] of groups) {
      if (!items.length) continue;
      count += items.length;
      const section = document.createElement('section');
      section.className = 'library-group';
      const title = document.createElement('h3');
      title.textContent = label;
      const grid = document.createElement('div');
      grid.className = 'library-grid';
      items.forEach(item => grid.appendChild(renderLibraryCard(item)));
      section.append(title, grid);
      root.appendChild(section);
    }

    if (!count) {
      const empty = document.createElement('div');
      empty.className = 'no-results';
      empty.textContent = search ? 'Aucun test disponible pour cette recherche.' : 'Tous les tests disponibles sont déjà dans le parcours.';
      root.appendChild(empty);
    }
  }

  function renderSpecialSlot(id, item, role) {
    const slot = $(id);
    slot.replaceChildren();
    if (!item) {
      const empty = document.createElement('div');
      empty.className = 'no-results';
      empty.textContent = role === 'mask-screen'
        ? 'KALONÉO par défaut sera utilisé.'
        : role === 'introduction'
          ? 'Glissez ici une page d’introduction.'
          : 'Glissez ici une page de fin.';
      slot.appendChild(empty);
      return;
    }

    const card = document.createElement('article');
    card.className = 'special-card';
    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const meta = document.createElement('span');
    meta.textContent = categoryLabel(item.category) + ' • v' + item.version;
    text.append(title, meta);
    const badge = document.createElement('div');
    badge.className = 'role-badge';
    badge.textContent = role === 'mask-screen' ? 'MASQUAGE' : role === 'introduction' ? 'INTRODUCTION' : 'FIN';
    card.append(text, badge);
    slot.appendChild(card);
  }

  function renderSequence() {
    const dropzone = $('tests-dropzone');
    dropzone.replaceChildren();
    dropzone.classList.toggle('is-empty', state.tests.length === 0);

    state.tests.forEach((item, index) => {
      const template = $('sequence-card-template');
      const card = template.content.firstElementChild.cloneNode(true);
      card.dataset.index = String(index);
      card.dataset.testId = String(item.id);
      card.querySelector('.sequence-index').textContent = String(index + 2);
      card.querySelector('.sequence-title').textContent = testAdminTitle(item);
      card.querySelector('.sequence-meta').textContent =
        categoryLabel(item.category) + ' • v' + item.version + ' • ' +
        (item.scored ? 'noté' : 'non noté') +
        (testAdminIdentity(item) ? ' • '+testAdminIdentity(item) : '') +
        (bilanStatus(item) ? ' • '+bilanStatus(item) : '');

      const up = card.querySelector('.move-up');
      const down = card.querySelector('.move-down');
      up.disabled = index === 0;
      down.disabled = index === state.tests.length - 1;
      up.addEventListener('click', () => moveTest(index, index - 1));
      down.addEventListener('click', () => moveTest(index, index + 1));
      card.querySelector('.remove-test').addEventListener('click', () => removeTest(index));

      card.addEventListener('mousedown', event => {
        armMouseDrag(event, { source:'sequence', role:'test', id:item.id, version:item.version }, card, testAdminTitle(item));
      });
      card.addEventListener('dragstart', event => {
        state.draggingIndex = index;
        card.classList.add('dragging');
        dragPayload(event, { source:'sequence', role:'test', index, id:item.id, version:item.version });
      });
      card.addEventListener('dragend', () => {
        state.draggingIndex = null;
        card.classList.remove('dragging');
      });
      card.addEventListener('dragover', event => {
        const payload = readDragPayload(event);
        if (!payload || payload.role !== 'test') return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = payload.source === 'sequence' ? 'move' : 'copy';
      });
      card.addEventListener('drop', event => {
        const payload = readDragPayload(event);
        if (!payload || payload.role !== 'test') return;
        event.preventDefault();
        if (payload.source === 'sequence') {
          const from = Number(payload.index);
          const [moved] = state.tests.splice(from, 1);
          const to = Math.max(0, Math.min(index, state.tests.length));
          state.tests.splice(to, 0, moved);
        } else {
          const itemToAdd = libraryItem(payload.id, payload.version);
          if (itemToAdd && !state.tests.some(test => test.id === itemToAdd.id)) state.tests.splice(index, 0, itemToAdd);
        }
        render();
      });

      dropzone.appendChild(card);
    });

    renderSpecialSlot('mask-slot', state.maskScreen, 'mask-screen');
    renderSpecialSlot('intro-slot', state.introduction, 'introduction');
    renderSpecialSlot('fin-slot', state.fin, 'fin');
  }

  function renderSaved() {
    const root = $('saved-parcours');
    root.replaceChildren();
    if (!state.saved.length) {
      const empty = document.createElement('div');
      empty.className = 'no-results';
      empty.textContent = 'Aucun parcours enregistré.';
      root.appendChild(empty);
      return;
    }
    for (const item of state.saved) {
      const card = document.createElement('article');
      card.className = 'saved-card' + (item.systemProvided ? ' system' : '');
      const title = document.createElement('strong');
      title.textContent = item.name;
      const creator = document.createElement('span');
      creator.textContent = 'Créateur : ' + (item.creator || '—');
      const meta = document.createElement('span');
      const maskName=item.maskScreenMeta?.name||'KALONÉO';
      meta.textContent = item.testCount + ' test' + (item.testCount > 1 ? 's' : '') + ' • masque : ' + maskName + (item.systemProvided ? ' • modèle fourni' : '') + (item.selected ? ' • sélectionné' : '');
      const actions=document.createElement('div');
      actions.className='saved-actions';
      const open=document.createElement('button');
      open.type='button';
      open.className='saved-open';
      open.textContent=item.systemProvided?'Ouvrir':'Ouvrir / modifier';
      open.addEventListener('click',()=>loadParcours(item.id));
      actions.appendChild(open);
      card.append(title, creator, meta, actions);
      root.appendChild(card);
    }
  }

  function render() {
    renderLibrary();
    renderSequence();
    renderSaved();
  }

  function installSpecialDrop(slotId, role) {
    const slot = $(slotId);
    slot.addEventListener('dragover', event => {
      const payload = readDragPayload(event);
      if (!payload || payload.source !== 'library' || payload.role !== role) return;
      event.preventDefault();
      slot.classList.add('dragover');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));
    slot.addEventListener('drop', event => {
      slot.classList.remove('dragover');
      const payload = readDragPayload(event);
      if (!payload || payload.source !== 'library' || payload.role !== role) return;
      event.preventDefault();
      const item = libraryItem(payload.id, payload.version);
      if (item) addLibraryItem(item);
    });
  }

  function installTestsDropzone() {
    const dropzone = $('tests-dropzone');
    dropzone.addEventListener('dragover', event => {
      const payload = readDragPayload(event);
      if (!payload || payload.role !== 'test') return;
      event.preventDefault();
      dropzone.classList.add('dragover');
      if (event.dataTransfer) event.dataTransfer.dropEffect = payload.source === 'sequence' ? 'move' : 'copy';
    });
    dropzone.addEventListener('dragleave', event => {
      if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', event => {
      dropzone.classList.remove('dragover');
      const payload = readDragPayload(event);
      if (!payload || payload.role !== 'test') return;
      event.preventDefault();

      if (payload.source === 'sequence') {
        const from = Number(payload.index);
        if (Number.isInteger(from) && from >= 0 && from < state.tests.length) {
          const [moved] = state.tests.splice(from, 1);
          state.tests.push(moved);
        }
      } else {
        const item = libraryItem(payload.id, payload.version);
        if (item && !state.tests.some(test => test.id === item.id)) state.tests.push(item);
      }
      render();
    });
  }

  function resetParcours() {
    state.editingId=null;
    state.editingSystemProvided=false;
    // Le nouveau parcours propose « KALONÉO — image fixe » en premier,
    // sans remplacer les choix de masquage des parcours déjà enregistrés.
    state.maskScreen=state.maskScreens.find(item=>item.id==='kaloneo-video-image'&&item.version==='1.0.0')
      ||state.maskScreens.find(item=>item.systemProvided)||state.maskScreens[0]||null;
    state.introduction=state.library.find(item=>item.role==='introduction')||null;
    state.fin=state.library.find(item=>item.role==='fin')||null;
    state.tests=[];
    $('parcours-name').value='';
    $('parcours-creator').value='';
    $('save-parcours').disabled=false;
    $('save-parcours').textContent='Enregistrer le parcours';
    document.querySelector('.page-topbar h1').textContent='Création de parcours';
    setStatus('Nouveau parcours.');
    render();
    markParcoursClean();
    requestAnimationFrame(()=>$('parcours-name').focus());
  }

  async function loadParcours(id) {
    try {
      const result=await api().kaloneoGetParcours?.(id);
      if(!result||result.ok===false) throw new Error(result?.error||'Parcours introuvable.');
      const value=result.parcours;
      state.editingId=String(value.id||'');
      state.editingSystemProvided=value.systemProvided===true;
      state.maskScreen=libraryItem(value.maskScreen?.id,value.maskScreen?.version) || state.maskScreens.find(item=>item.systemProvided) || null;
      state.introduction=libraryItem(value.introduction?.id,value.introduction?.version);
      state.fin=libraryItem(value.fin?.id,value.fin?.version);
      state.tests=(Array.isArray(value.tests)?value.tests:[])
        .map(ref=>libraryItem(ref?.id,ref?.version))
        .filter(Boolean);
      $('parcours-name').value=String(value.name||'');
      $('parcours-creator').value=String(value.creator||'');
      $('save-parcours').disabled=state.editingSystemProvided;
      $('save-parcours').textContent=state.editingSystemProvided?'Modèle fourni protégé':'Enregistrer les modifications';
      document.querySelector('.page-topbar h1').textContent=state.editingSystemProvided?'Consultation du parcours':'Modification de parcours';
      render();
      setStatus(
        state.editingSystemProvided
          ? 'Parcours de base ouvert en consultation. Il est protégé ; utilisez « Nouveau parcours » pour créer une variante.'
          : 'Parcours « '+value.name+' » ouvert.',
        state.editingSystemProvided?'':'ok'
      );
      markParcoursClean();
    } catch(error) {
      setStatus(error?.message||String(error),'error');
    }
  }

  async function refreshSaved() {
    const result = await api().kaloneoListParcours?.();
    if (!result || result.ok === false) {
      throw new Error(result && result.error ? result.error : 'Lecture des parcours impossible.');
    }
    state.saved = Array.isArray(result.parcours) ? result.parcours : [];
  }

  async function initialize() {
    try {
      const result = await api().kaloneoListTests?.();
      if (!result || result.ok === false) {
        throw new Error(result && result.error ? result.error : 'Lecture de la bibliothèque impossible.');
      }
      state.library = Array.isArray(result.tests) ? result.tests : [];
      const masksResult = await api().kaloneoListMaskScreens?.();
      if (!masksResult || masksResult.ok === false) {
        throw new Error(masksResult && masksResult.error ? masksResult.error : 'Lecture des écrans de masquage impossible.');
      }
      state.maskScreens = (Array.isArray(masksResult.maskScreens) ? masksResult.maskScreens : []).map(item=>Object.assign({role:'mask-screen',title:item.name,category:'masquage',description:''},item));
      state.maskScreen = state.maskScreens.find(item => item.systemProvided) || state.maskScreens[0] || null;
      state.introduction = state.library.find(item => item.role === 'introduction') || null;
      state.fin = state.library.find(item => item.role === 'fin') || null;
      await refreshSaved();
      render();
      const editId=new URLSearchParams(location.search).get('edit');
      if(editId) {
        await loadParcours(editId);
      } else {
        setStatus('Bibliothèque chargée : ' + state.library.filter(item => item.role === 'test').length + ' tests et ' + state.maskScreens.length + ' écran(s) de masquage.');
        markParcoursClean();
      }
    } catch (error) {
      setStatus(error && error.message ? error.message : String(error), 'error');
    }
  }

  async function saveParcours() {
    const button = $('save-parcours');
    if (button.disabled) return;

    const name = String($('parcours-name').value || '').trim();
    const creator = String($('parcours-creator').value || '').trim();
    if (!name) return setStatus('Le nom du parcours est obligatoire.', 'error');
    if (!creator) return setStatus('Le nom du créateur est obligatoire.', 'error');
    if (!state.introduction) return setStatus('Une page d’introduction est obligatoire.', 'error');
    if (!state.fin) return setStatus('Une page de fin est obligatoire.', 'error');

    button.disabled = true;
    setStatus('Enregistrement du parcours…');
    try {
      const result = await api().kaloneoSaveParcours?.({
        id:state.editingId || undefined,
        name,
        creator,
        maskScreen:refOf(state.maskScreen),
        introduction:refOf(state.introduction),
        tests:state.tests.map(refOf),
        fin:refOf(state.fin)
      });
      if (!result || result.ok === false) {
        throw new Error(result && result.error ? result.error : 'Enregistrement impossible.');
      }
      state.editingId=String(result.parcours?.id||state.editingId||'');
      state.editingSystemProvided=false;
      $('save-parcours').textContent='Enregistrer les modifications';
      document.querySelector('.page-topbar h1').textContent='Modification de parcours';
      await refreshSaved();
      renderSaved();
      setStatus(result.updated ? 'Parcours « ' + name + ' » mis à jour.' : 'Parcours « ' + name + ' » enregistré.', 'ok');
      markParcoursClean();
    } catch (error) {
      setStatus(error && error.message ? error.message : String(error), 'error');
    } finally {
      button.disabled = false;
    }
  }

  function ready() {
    $('back-tests-parcours').addEventListener('click', closeBuilder);
    $('new-parcours').addEventListener('click', resetParcours);
    $('cancel-parcours').addEventListener('click', () => { window.location.href = 'admin-tests-parcours.html'; });
    $('save-parcours').addEventListener('click', saveParcours);
    $('library-search').addEventListener('input', renderLibrary);
    installSpecialDrop('mask-slot', 'mask-screen');
    installSpecialDrop('intro-slot', 'introduction');
    installSpecialDrop('fin-slot', 'fin');
    installTestsDropzone();
    const libraryPanel=document.querySelector('.library-panel');
    libraryPanel?.addEventListener('dragover', event => {
      const payload=readDragPayload(event);
      if(payload?.source==='sequence'&&payload.role==='test') event.preventDefault();
    });
    libraryPanel?.addEventListener('drop', event => {
      const payload=readDragPayload(event);
      if(payload?.source!=='sequence'||payload.role!=='test') return;
      event.preventDefault();
      const index=state.tests.findIndex(test=>String(test.id)===String(payload.id));
      if(index>=0){state.tests.splice(index,1);render();}
    });
    initialize();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once:true });
  else ready();
})();
