(function () {
  'use strict';

  const EDITOR_ID = 'editor';
  const FONT_VALUES = ['Arial', 'Calibri', 'Times New Roman', 'Courier New', 'Georgia'];
  // Le sélecteur actuel travaille exclusivement en points typographiques.
  // Les anciens fichiers en px conservent leurs valeurs d'origine : jamais
  // transformer un nombre de pixels en un nombre de points identique.
  const SIZE_VALUES = ['10pt', '12pt', '14pt', '16pt', '18pt', '24pt', '32pt', '48pt'];
  const LEGACY_SIZE_VALUES = ['10px', '12px', '14px', '16px', '18px', '24px', '32px', '48px'];
  const TITLE_QUESTIONS = [
    'Quelle est mon activité préférée et pourquoi ?',
    'Quelle est mon expérience professionnelle préférée et pourquoi ?',
    'Quel est mon métier préféré et pourquoi ?'
  ];

  let quill = null;
  let savedRange = null;
  let autosaveTimer = null;

  function editorContext() {
    const value = window.sebNwtexteContext;
    return value && typeof value === 'object' ? value : {};
  }
  function scopedKey(base) {
    const prefix = String(editorContext().storagePrefix || '');
    return prefix ? prefix + base : base;
  }
  function usesLegacyPage7() {
    const context = editorContext();
    return context.legacyPage7 !== false;
  }

  // SEB_NWTEXTE_STABLE_TYPING_FORMAT_124
  // La police et la taille d'écriture ne changent que sur une action explicite
  // de l'utilisateur. Un déplacement de curseur ne réinitialise jamais l'état
  // actif vers les valeurs visuelles par défaut.
  let activeTypingFont = 'Calibri';
  let activeTypingSize = '14pt';

  function normalizeQuestion(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .replace(/[^a-zA-Z0-9À-ÿ]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  const NORMALIZED_QUESTIONS = TITLE_QUESTIONS.map(normalizeQuestion);

  function registerFormats() {
    const FontStyle = Quill.import('attributors/style/font');
    FontStyle.whitelist = FONT_VALUES.slice();
    Quill.register(FontStyle, true);

    const SizeStyle = Quill.import('attributors/style/size');
    // Whitelist pour lecture fidèle des archives : "16px" reste "16px".
    // Seules les options de l'éditeur permettent d'écrire "16pt".
    SizeStyle.whitelist = SIZE_VALUES.concat(LEGACY_SIZE_VALUES);
    Quill.register(SizeStyle, true);

    const AlignStyle = Quill.import('attributors/style/align');
    Quill.register(AlignStyle, true);

    const Parchment = Quill.import('parchment');
    const LineHeightStyle = new Parchment.StyleAttributor('lineHeight', 'line-height', {
      scope: Parchment.Scope.BLOCK,
      whitelist: ['1', '1.15', '1.5', '2']
    });
    Quill.register(LineHeightStyle, true);
  }

  function getRangeOrEnd() {
    const current = quill ? quill.getSelection() : null;
    if (current) return current;
    if (savedRange) return { index: savedRange.index, length: savedRange.length };
    const index = Math.max(0, (quill ? quill.getLength() : 1) - 1);
    return { index, length: 0 };
  }

  function restoreSelection() {
    if (!quill) return null;
    const range = getRangeOrEnd();
    quill.focus();
    quill.setSelection(range.index, range.length, 'silent');
    savedRange = { index: range.index, length: range.length };
    return range;
  }

  function saveSelection() {
    if (!quill) return;
    const range = quill.getSelection();
    if (range) savedRange = { index: range.index, length: range.length };
  }

  function commonFormat() {
    if (!quill) return {};
    const range = quill.getSelection() || savedRange || { index: 0, length: 0 };
    return quill.getFormat(range.index, range.length);
  }

  function setActive(id, active) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', !!active);
  }

  function setSelectValue(selector, value) {
    const el = document.querySelector(selector);
    if (!el || !value) return;
    if (Array.from(el.options).some((option) => option.value === value)) {
      el.value = value;
    }
  }

  function rememberTypingFormat(name, value) {
    if (name === 'font' && FONT_VALUES.includes(value)) activeTypingFont = value;
    if (name === 'size' && SIZE_VALUES.includes(value)) activeTypingSize = value;
  }

  function restoreTypingFormatFromDocument(range) {
    if (!quill || !range || quill.getLength() <= 1) return;
    const probeIndex = Math.max(0, Math.min(range.index > 0 ? range.index - 1 : 0, quill.getLength() - 2));
    const format = quill.getFormat(probeIndex, 1);
    if (typeof format.font === 'string' && FONT_VALUES.includes(format.font)) activeTypingFont = format.font;
    if (typeof format.size === 'string' && SIZE_VALUES.includes(format.size)) activeTypingSize = format.size;
  }

  function applyTypingFormat(range) {
    if (!quill || !range || range.length) return;
    quill.format('font', activeTypingFont, 'silent');
    quill.format('size', activeTypingSize, 'silent');
  }

  function updateToolbarFromSelection() {
    if (!quill) return;
    const format = commonFormat();
    setActive('btn-bold', format.bold === true);
    setActive('btn-italic', format.italic === true);
    setActive('btn-underline', format.underline === true);
    const align = format.align || 'left';
    setActive('btn-left', align === 'left');
    setActive('btn-center', align === 'center');
    setActive('btn-right', align === 'right');
    setActive('btn-ul', format.list === 'bullet');
    setActive('btn-ol', format.list === 'ordered');

    const displayedFont = typeof format.font === 'string' ? format.font : activeTypingFont;
    const displayedSize = typeof format.size === 'string' ? format.size : activeTypingSize;
    setSelectValue('select[title="Changer la police"]', displayedFont);
    setSelectValue('select[title="Taille du texte"]', displayedSize);
    setSelectValue('select[title="Interligne"]', typeof format.lineHeight === 'string' ? format.lineHeight : '1');

    const textIndicator = document.getElementById('text-color-indicator');
    const highlightIndicator = document.getElementById('highlight-color-indicator');
    if (textIndicator) textIndicator.style.background = typeof format.color === 'string' ? format.color : '#000000';
    if (highlightIndicator) highlightIndicator.style.background = typeof format.background === 'string' ? format.background : '#FFFFFF';
  }

  function toggleInline(name) {
    const range = restoreSelection();
    if (!range) return;
    const format = quill.getFormat(range.index, range.length);
    quill.format(name, format[name] === true ? false : true, 'user');
    saveSelection();
    updateToolbarFromSelection();
  }

  function toggleList(value) {
    const range = restoreSelection();
    if (!range) return;
    const format = quill.getFormat(range.index, range.length);
    quill.format('list', format.list === value ? false : value, 'user');
    saveSelection();
    updateToolbarFromSelection();
  }

  function setBlockFormat(name, value) {
    const range = restoreSelection();
    if (!range) return;
    quill.format(name, value, 'user');
    saveSelection();
    updateToolbarFromSelection();
  }

  function setInlineFormat(name, value) {
    const range = restoreSelection();
    if (!range) return;
    rememberTypingFormat(name, value);
    quill.format(name, value, 'user');
    saveSelection();
    updateToolbarFromSelection();
  }

  function toggleColorPicker(type) {
    const menuId = type === 'text' ? 'text-color-menu' : 'highlight-color-menu';
    const otherMenuId = type === 'text' ? 'highlight-color-menu' : 'text-color-menu';
    const menu = document.getElementById(menuId);
    const other = document.getElementById(otherMenuId);
    if (other) other.classList.remove('show');
    if (menu) menu.classList.toggle('show');
  }

  function closeColorPickers() {
    document.getElementById('text-color-menu')?.classList.remove('show');
    document.getElementById('highlight-color-menu')?.classList.remove('show');
  }

  function selectColor(type, color) {
    restoreSelection();
    if (type === 'text') {
      setInlineFormat('color', color);
      const indicator = document.getElementById('text-color-indicator');
      if (indicator) indicator.style.background = color;
    } else {
      setInlineFormat('background', color === '#FFFFFF' ? false : color);
      const indicator = document.getElementById('highlight-color-indicator');
      if (indicator) indicator.style.background = color;
    }
    closeColorPickers();
  }

  function selectedText(range) {
    return quill.getText(range.index, range.length).replace(/\n$/, '');
  }

  async function copySelection() {
    if (!quill) return;
    const range = getRangeOrEnd();
    if (!range.length) return;
    const text = selectedText(range);
    const html = typeof quill.getSemanticHTML === 'function'
      ? quill.getSemanticHTML(range.index, range.length)
      : text;
    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        });
        await navigator.clipboard.write([item]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard indisponible');
      }
    } catch (error) {
      console.warn('Copie via bouton indisponible, Ctrl+C reste utilisable.', error);
    }
  }

  async function cutSelection() {
    const range = getRangeOrEnd();
    if (!range.length) return;
    await copySelection();
    quill.deleteText(range.index, range.length, 'user');
    quill.setSelection(range.index, 0, 'silent');
    savedRange = { index: range.index, length: 0 };
  }

  async function pasteFromClipboard() {
    if (!quill) return;
    const range = restoreSelection() || { index: quill.getLength() - 1, length: 0 };
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            const html = await blob.text();
            if (range.length) quill.deleteText(range.index, range.length, 'user');
            const before = quill.getLength();
            quill.clipboard.dangerouslyPasteHTML(range.index, html, 'user');
            const inserted = Math.max(0, quill.getLength() - before);
            quill.setSelection(range.index + inserted, 0, 'silent');
            savedRange = { index: range.index + inserted, length: 0 };
            return;
          }
          if (item.types.includes('text/plain')) {
            const blob = await item.getType('text/plain');
            const text = await blob.text();
            if (range.length) quill.deleteText(range.index, range.length, 'user');
            quill.insertText(range.index, text, 'user');
            quill.setSelection(range.index + text.length, 0, 'silent');
            savedRange = { index: range.index + text.length, length: 0 };
            return;
          }
        }
      }
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (range.length) quill.deleteText(range.index, range.length, 'user');
        quill.insertText(range.index, text, 'user');
        quill.setSelection(range.index + text.length, 0, 'silent');
        savedRange = { index: range.index + text.length, length: 0 };
      }
    } catch (error) {
      console.warn('Collage via bouton indisponible, Ctrl+V reste utilisable.', error);
    }
  }

  function editorHtml() {
    return quill ? quill.root.innerHTML : '';
  }

  function editorText() {
    if (!quill) return '';
    return quill.getText().replace(/\n$/, '');
  }

  function cleanLegacyHtml(html) {
    // Ne modifier ni la valeur ni l'unité d'une archive existante.
    return String(html || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
  }

  function restoreSavedContent() {
    if (!quill) return;
    let restored = false;
    try {
      const deltaRaw = sessionStorage.getItem(scopedKey('autosave_editor_delta'));
      if (deltaRaw) {
        quill.setContents(JSON.parse(deltaRaw), 'silent');
        restored = true;
      }
    } catch (_) {}

    if (!restored && usesLegacyPage7()) {
      try {
        const responses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}');
        if (responses.page7_delta) {
          quill.setContents(responses.page7_delta, 'silent');
          restored = true;
        } else if (responses.page7_contenu_html) {
          quill.clipboard.dangerouslyPasteHTML(cleanLegacyHtml(responses.page7_contenu_html), 'silent');
          restored = true;
        }
      } catch (_) {}
    }

    if (!restored) {
      const legacy = sessionStorage.getItem(scopedKey('autosave_editor'));
      if (legacy) {
        quill.clipboard.dangerouslyPasteHTML(cleanLegacyHtml(legacy), 'silent');
      }
    }

    const index = Math.max(0, quill.getLength() - 1);
    quill.setSelection(index, 0, 'silent');
    savedRange = { index, length: 0 };
    restoreTypingFormatFromDocument(savedRange);
    applyTypingFormat(savedRange);
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(function () {
      if (!quill) return;
      try {
        sessionStorage.setItem(scopedKey('autosave_editor_delta'), JSON.stringify(quill.getContents()));
        sessionStorage.setItem(scopedKey('autosave_editor'), editorHtml());
        if (window.sebEvalPro?.save) window.sebEvalPro.save();
      } catch (error) {
        console.warn('Autosauvegarde nwtexte impossible.', error);
      }
    }, 120);
  }

  function lineMap() {
    const text = quill.getText();
    const rawLines = text.split('\n');
    const lines = [];
    let index = 0;
    for (const raw of rawLines) {
      const clean = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').trim();
      lines.push({ raw, clean, index, length: raw.length });
      index += raw.length + 1;
    }
    return lines;
  }

  function titleCharacterFormats(line) {
    // Quill.getFormat(index,length) ne rend que les attributs communs.
    // Une espace sans attribut fait donc parfois disparaître 'bold', 'font'
    // et 'size' pour tout le titre. Examiner les véritables caractères
    // visibles du texte plutôt que le format commun de toute la ligne.
    const tally = { characters:0, bold:0, arial:0, size16pt:0 };
    if (!quill || !line || !line.length) return tally;
    const delta = quill.getContents(line.index, line.length);
    for (const op of delta?.ops || []) {
      if (typeof op?.insert !== 'string') continue;
      const visible = op.insert.replace(/[\u200B-\u200D\uFEFF\s]/g, '');
      const count = [...visible].length;
      if (!count) continue;
      tally.characters += count;
      if (op.attributes?.bold === true) tally.bold += count;
      if (isExactFont(op.attributes?.font, 'Arial')) tally.arial += count;
      if (isExactSize(op.attributes?.size, '16pt')) tally.size16pt += count;
    }
    return tally;
  }

  function isExactFont(value, expected) {
    return typeof value === 'string' && value.trim().toLowerCase() === expected.toLowerCase();
  }

  function isExactSize(value, expected) {
    return typeof value === 'string' && value.trim().toLowerCase() === expected.toLowerCase();
  }

  function dominantBodyFormatting(startIndex, length) {
    const result = { chars: 0, arial: 0, size12: 0 };
    if (!quill || length <= 0) return result;
    const delta = quill.getContents(startIndex, length);
    (delta?.ops || []).forEach((op) => {
      if (typeof op.insert !== 'string') return;
      const chars = op.insert.replace(/\n/g, '').replace(/\s/g, '').length;
      if (!chars) return;
      result.chars += chars;
      if (isExactFont(op.attributes?.font, 'Arial')) result.arial += chars;
      if (isExactSize(op.attributes?.size, '12pt')) result.size12 += chars;
    });
    return result;
  }

  function visualBodyLineCount(bodyLines) {
    if (!quill || !bodyLines.length) return 0;
    let total = 0;
    bodyLines.forEach((line) => {
      try {
        const info = quill.getLine(line.index);
        const blot = info && info[0];
        const node = blot?.domNode;
        if (!node) { total += 1; return; }
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
        const tops = [];
        rects.forEach((rect) => {
          if (!tops.some((top) => Math.abs(top - rect.top) < 2)) tops.push(rect.top);
        });
        total += Math.max(1, tops.length);
      } catch (_) {
        total += 1;
      }
    });
    return total;
  }

  function saveCriterionOk() {
    try {
      const state = JSON.parse(localStorage.getItem(scopedKey('nwtexte_save_simulation')) || 'null');
      const candidate = JSON.parse(sessionStorage.getItem('candidat_data') || '{}');
      const nom = String(candidate.nom || candidate.Nom || '').trim();
      if (!state || !nom) return false;
      const expected = nom + '_Evaluation_Kalonéo';
      return state.enregistre === true &&
        state.dossier === 'Bureau\\Kalonéo' &&
        state.nomConforme === true &&
        String(state.nom || '').toLocaleLowerCase('fr') === expected.toLocaleLowerCase('fr');
    } catch (_) {
      return false;
    }
  }

  function analyseDocument() {
    const allLines = lineMap();
    const nonEmpty = allLines.filter((line) => line.clean.length > 0);
    const titleLine = nonEmpty[0] || null;
    const bodyLines = nonEmpty.slice(1);
    const titleStyles = titleCharacterFormats(titleLine);
    const hasTitle = titleStyles.characters > 0;
    const titleBold = hasTitle && titleStyles.bold === titleStyles.characters;
    const titleArial = hasTitle && titleStyles.arial === titleStyles.characters;
    const titleSize16 = hasTitle && titleStyles.size16pt === titleStyles.characters;
    const titleValid = !!titleLine && NORMALIZED_QUESTIONS.includes(normalizeQuestion(titleLine.clean));
    const bodyStart = titleLine ? titleLine.index + titleLine.length + 1 : 0;
    const bodyLength = Math.max(0, quill.getLength() - 1 - bodyStart);
    const dominant = dominantBodyFormatting(bodyStart, bodyLength);
    const bodyArial = dominant.chars > 0 && dominant.arial > dominant.chars / 2;
    const bodySize12 = dominant.chars > 0 && dominant.size12 > dominant.chars / 2;
    const visualLines = visualBodyLineCount(bodyLines);
    const savedCorrectly = saveCriterionOk();

    const score = {
      titre_present: titleValid ? 1 : 0,
      titre_gras: titleValid && titleBold ? 1 : 0,
      titre_police: titleValid && titleArial ? 1 : 0,
      titre_taille: titleValid && titleSize16 ? 1 : 0,
      texte_lignes: visualLines >= 10 ? 1 : 0,
      texte_police: bodyArial ? 1 : 0,
      texte_taille: bodySize12 ? 1 : 0,
      enregistrement: savedCorrectly ? 1 : 0,
      total: 0
    };
    score.total = score.titre_present + score.titre_gras + score.titre_police + score.titre_taille +
      score.texte_lignes + score.texte_police + score.texte_taille + score.enregistrement;

    return {
      html: editorHtml(),
      texte: editorText(),
      lignes: visualLines,
      titre: {
        present: titleValid,
        texte: titleLine ? titleLine.clean : '',
        gras: titleBold,
        police: titleArial ? 'Arial' : '',
        taille: titleSize16 ? '16pt' : '',
        // Traçabilité des véritables caractères mis en forme, sans modifier
        // le barème ni les autres résultats des anciens candidats.
        caracteres: titleStyles.characters,
        caracteresGras: titleStyles.bold,
        caracteresArial: titleStyles.arial,
        caracteresTaille16pt: titleStyles.size16pt,
        conforme: score.titre_present === 1 && score.titre_gras === 1 && score.titre_police === 1 && score.titre_taille === 1
      },
      texte: {
        lignes: visualLines,
        lignesMin: visualLines >= 10,
        police: bodyArial ? 'Arial' : '',
        taille: bodySize12 ? '12' : '',
        conforme: score.texte_lignes === 1 && score.texte_police === 1 && score.texte_taille === 1,
        caracteres: dominant.chars,
        caracteresArial: dominant.arial,
        caracteresTaille12: dominant.size12
      },
      enregistrement: {
        conforme: savedCorrectly
      },
      score
    };
  }

  function saveEvaluation() {
    if (!quill) return null;
    const analyse = analyseDocument();
    if (usesLegacyPage7()) {
      let responses = {};
      let scores = {};
      try { responses = JSON.parse(sessionStorage.getItem('reponses_data') || '{}'); } catch (_) {}
      try { scores = JSON.parse(sessionStorage.getItem('scores_data') || '{}'); } catch (_) {}

      responses.page7_contenu_html = analyse.html;
      responses.page7_contenu_texte = analyse.texte;
      responses.page7_delta = quill.getContents();
      responses.page7_analyse = analyse;
      scores.page7 = analyse.score.total;
      scores.page7_detail = analyse.score;

      sessionStorage.setItem('reponses_data', JSON.stringify(responses));
      sessionStorage.setItem('scores_data', JSON.stringify(scores));
    }
    sessionStorage.setItem(scopedKey('autosave_editor_delta'), JSON.stringify(quill.getContents()));
    sessionStorage.setItem(scopedKey('autosave_editor'), analyse.html);
    if (window.sebEvalPro?.save) window.sebEvalPro.save();
    console.log('SEB EvalPro nwtexte : analyse sauvegardée', analyse);
    return analyse;
  }

  function fileBodyHtml() {
    return editorHtml();
  }

  function initialize() {
    const container = document.getElementById(EDITOR_ID);
    if (!container || !window.Quill) {
      return false;
    }
    if (quill && quill.root && quill.root.isConnected && container.contains(quill.root)) {
      return true;
    }
    if (quill && (!quill.root || !quill.root.isConnected || !container.contains(quill.root))) {
      quill = null;
      savedRange = null;
    }

    registerFormats();
    container.removeAttribute('contenteditable');

    quill = new Quill(container, {
      theme: null,
      modules: {
        toolbar: false,
        history: { delay: 500, maxStack: 200, userOnly: true },
        keyboard: {
          bindings: {
            sebTab: {
              key: 9,
              handler: function (range, context) {
                if (context.format && context.format.list) return true;
                this.quill.insertText(range.index, '\t', 'user');
                this.quill.setSelection(range.index + 1, 0, 'silent');
                return false;
              }
            }
          }
        }
      },
      formats: ['bold', 'italic', 'underline', 'list', 'align', 'font', 'size', 'color', 'background', 'image', 'lineHeight']
    });

    quill.root.setAttribute('spellcheck', 'false');
    quill.root.setAttribute('aria-label', 'Traitement de texte');
    restoreSavedContent();

    quill.on('selection-change', function (range) {
      if (range) {
        savedRange = { index: range.index, length: range.length };
        applyTypingFormat(range);
      }
      updateToolbarFromSelection();
    });
    quill.on('text-change', function (_delta, _oldDelta, source) {
      if (source !== 'silent') {
        scheduleAutosave();
        setTimeout(function () {
          const range = quill.getSelection();
          if (!range) return;
          savedRange = { index: range.index, length: range.length };
          applyTypingFormat(range);
          updateToolbarFromSelection();
        }, 0);
      } else {
        updateToolbarFromSelection();
      }
    });

    document.addEventListener('click', function (event) {
      const textMenu = document.getElementById('text-color-menu');
      const highlightMenu = document.getElementById('highlight-color-menu');
      const textButton = document.getElementById('nw-text-color-button');
      const highlightButton = document.getElementById('nw-highlight-color-button');
      if (textMenu && !textMenu.contains(event.target) && textButton && !textButton.contains(event.target)) textMenu.classList.remove('show');
      if (highlightMenu && !highlightMenu.contains(event.target) && highlightButton && !highlightButton.contains(event.target)) highlightMenu.classList.remove('show');
      const fileMenu = document.getElementById('menu-fichier');
      const fileButton = document.getElementById('nw-file-menu-button');
      if (fileMenu && fileButton && !fileMenu.contains(event.target) && !fileButton.contains(event.target)) fileMenu.style.display = 'none';
    });

    updateToolbarFromSelection();
    console.log('SEB EvalPro nwtexte : moteur Quill 2 unique actif.');
    return true;
  }

  const editorApi = Object.freeze({
    initialize,
    saveSelection,
    restoreSelection,
    format(command, value) {
      if (!quill) return;
      if (command === 'bold') return toggleInline('bold');
      if (command === 'italic') return toggleInline('italic');
      if (command === 'underline') return toggleInline('underline');
      if (command === 'insertUnorderedList') return toggleList('bullet');
      if (command === 'insertOrderedList') return toggleList('ordered');
      if (command === 'justifyLeft') return setBlockFormat('align', false);
      if (command === 'justifyCenter') return setBlockFormat('align', 'center');
      if (command === 'justifyRight') return setBlockFormat('align', 'right');
      if (command === 'fontName') return setInlineFormat('font', value);
      if (command === 'fontSize') return setInlineFormat('size', value);
      if (command === 'foreColor') return setInlineFormat('color', value);
      if (command === 'hiliteColor') return setInlineFormat('background', value);
    },
    setFontSize(value) { return setInlineFormat('size', value); },
    setLineHeight(value) { return setBlockFormat('lineHeight', value); },
    toggleColorPicker,
    selectColor,
    copySelection,
    cutSelection,
    pasteFromClipboard,
    analyseDocument,
    saveEvaluation,
    editorHtml,
    editorText,
    getContents() { return quill ? quill.getContents() : null; }
  });
  window.sebNwtexteEditor = editorApi;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
