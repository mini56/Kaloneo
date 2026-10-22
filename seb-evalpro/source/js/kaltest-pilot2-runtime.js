(function () {
  'use strict';

  const STATIC_DATA = window.sebKaltestPilot2Data;
  let selectedRuntime = null;
  try {
    const result = window.sebEvalPro?.kaloneoSelectedParcoursRuntimeSync?.();
    if (result && result.ok === true && result.runtime && Array.isArray(result.runtime.tests)) {
      selectedRuntime = result.runtime;
    }
  } catch (_) {}

  const CUSTOM_PARCOURS_MODE = Boolean(selectedRuntime);
  const SHOW_CORRECTIONS_DURING_PARCOURS =
    selectedRuntime?.launchOptions?.showCorrectionsDuringParcours === true;
  const DATA = CUSTOM_PARCOURS_MODE
    ? {
        ...(STATIC_DATA || {}),
        parcours:{
          id:String(selectedRuntime.id || 'parcours-de-base'),
          title:String(selectedRuntime.title || 'Parcours de base'),
          creator:String(selectedRuntime.creator || '')
        },
        introduction:selectedRuntime.introduction || null,
        tests:[
          ...(Array.isArray(selectedRuntime.tests) ? selectedRuntime.tests : []),
          ...(selectedRuntime.fin ? [selectedRuntime.fin] : [])
        ]
      }
    : STATIC_DATA;

  const PARAMS = new URLSearchParams(window.location.search);
  const BUILDER_PREVIEW_MODE = selectedRuntime?.builderPreview===true && PARAMS.get('kaloneoPreview')==='1';
  const BUILDER_MINI_PREVIEW_MODE = BUILDER_PREVIEW_MODE && selectedRuntime?.builderMiniPreview===true;
  const FULL_PARCOURS_MODE = !CUSTOM_PARCOURS_MODE && PARAMS.get('fullParcours') === '1';
  const REQUESTED_SEGMENT = CUSTOM_PARCOURS_MODE ? '' : String(PARAMS.get('segment') || '').trim();

  if (!DATA || !Array.isArray(DATA.tests) || !DATA.tests.length) {
    throw new Error('Données KALTEST du parcours sélectionné absentes.');
  }

  const testById = new Map(DATA.tests.map(test => [test.id, test]));
  const SEGMENTS = Object.freeze({
    initial:Object.freeze({
      stepId:'kaltest-initial',
      startPhase:'identification',
      ids:Object.freeze([
        'calculs_commandes_atelier',
        'calculs_poids_volumes',
        'horaires_reception_controle',
        'texte_a_trous_stage_logistique'
      ])
    }),
    fractions:Object.freeze({
      stepId:'qcm-4',
      startPhase:'exercise',
      ids:Object.freeze(['fractions_preparation_lots'])
    }),
    organisation:Object.freeze({
      stepId:'qcm-5',
      startPhase:'exercise',
      ids:Object.freeze(['organisation_demenagement'])
    }),
    postures:Object.freeze({
      stepId:'qcm-5_1',
      startPhase:'exercise',
      ids:Object.freeze(['gestes_postures'])
    }),
    conversions:Object.freeze({
      stepId:'qcm-6',
      startPhase:'exercise',
      ids:Object.freeze(['conversions_atelier_expedition'])
    }),
    autoeval1:Object.freeze({
      stepId:'autoeval1',
      startPhase:'exercise',
      ids:Object.freeze(['autoevaluation_savoirs'])
    }),
    'transition-video-f1':Object.freeze({
      stepId:'transition-video-f1',
      startPhase:'exercise',
      ids:Object.freeze(['transition_video_f1'])
    }),
    brique:Object.freeze({
      stepId:'brique',
      startPhase:'exercise',
      ids:Object.freeze(['construction_briques'])
    }),
    stock:Object.freeze({
      stepId:'stock',
      startPhase:'exercise',
      ids:Object.freeze(['ranger_stock'])
    }),
    planning:Object.freeze({
      stepId:'planning',
      startPhase:'exercise',
      ids:Object.freeze(['planning_cantine'])
    }),
    'genre-nombre':Object.freeze({
      stepId:'genrenombres',
      startPhase:'exercise',
      ids:Object.freeze(['genre_nombre'])
    }),
    dictee:Object.freeze({
      stepId:'dictee',
      startPhase:'exercise',
      ids:Object.freeze(['dictee_professionnelle'])
    }),
    tri:Object.freeze({
      stepId:'tri-de-cheville',
      startPhase:'exercise',
      ids:Object.freeze(['tri_chevilles'])
    }),
    nwtexte:Object.freeze({
      stepId:'nwtexte',
      startPhase:'exercise',
      ids:Object.freeze(['traitement_texte_bureautique'])
    }),
    mail:Object.freeze({
      stepId:'nvmail',
      startPhase:'exercise',
      ids:Object.freeze(['redaction_email'])
    }),
    autoeval2:Object.freeze({
      stepId:'autoeval2',
      startPhase:'exercise',
      ids:Object.freeze(['autoevaluation_tic'])
    }),
    paronymes:Object.freeze({
      stepId:'paronymes',
      startPhase:'exercise',
      ids:Object.freeze(['paronymes_rapport'])
    }),
    carre:Object.freeze({
      stepId:'carre',
      startPhase:'exercise',
      ids:Object.freeze(['gratte_ciel'])
    }),
    fin:Object.freeze({
      stepId:'qcm-11',
      startPhase:'exercise',
      ids:Object.freeze(['fin_parcours'])
    })
  });

  const SEGMENT_KEY = CUSTOM_PARCOURS_MODE ? 'all' : (REQUESTED_SEGMENT || (FULL_PARCOURS_MODE ? 'initial' : 'all'));
  if (SEGMENT_KEY !== 'all' && !SEGMENTS[SEGMENT_KEY]) {
    throw new Error('Segment KALTEST PILOTE 11 inconnu : ' + SEGMENT_KEY);
  }

  const SEGMENT = SEGMENT_KEY === 'all' ? null : SEGMENTS[SEGMENT_KEY];
  const ACTIVE_TESTS = SEGMENT
    ? SEGMENT.ids.map(id => {
        const test = testById.get(id);
        if (!test) throw new Error('Test KALTEST absent du segment ' + SEGMENT_KEY + ' : ' + id);
        return test;
      })
    : DATA.tests.slice();
  const PILOT11_MODE = Boolean(SEGMENT);
  const DEFAULT_PHASE = BUILDER_PREVIEW_MODE ? 'exercise' : (SEGMENT?.startPhase || 'identification');
  const STATE_KEY = 'seb_kaltest_pilot2_state_v1' +
    ((SEGMENT_KEY === 'all' || SEGMENT_KEY === 'initial') ? '' : ':' + SEGMENT_KEY);

  // Le parcours sélectionné fait foi : figer ses seuls tests au démarrage de
  // l'évaluation réelle, avant la première sauvegarde candidat. Ne jamais
  // remplacer ce manifeste lors d'un aperçu Builder.
  if(CUSTOM_PARCOURS_MODE&&!BUILDER_PREVIEW_MODE){
    try{
      sessionStorage.setItem('seb_kaloneo_results_manifest',JSON.stringify({
        schemaVersion:2,
        source:'candidate-selected-runtime',
        parcoursId:String(DATA.parcours?.id||''),
        parcoursTitle:String(DATA.parcours?.title||''),
        tests:ACTIVE_TESTS.filter(test=>test&&test.id&&
          !test.presentation?.transitionVideo &&
          !['introduction','transition','fin'].includes(String(test.category||'').toLowerCase()))
          .map(test=>({
            id:String(test.id),
            version:String(test.version||''),
            title:String(test.title||test.id),
            category:String(test.category||'Autres'),
            scored:test.scored!==false
          })),
        capturedAt:new Date().toISOString()
      }));
    }catch(_){}
  }

  if (PILOT11_MODE) {
    try { sessionStorage.setItem('seb_kaltest_full_parcours', '1'); } catch (_) {}
  }

  function emptyTestState() {
    return {
      answers: {},
      units: {},
      supplemental: {},
      result: null,
      status: 'PENDING',
      abandon: null
    };
  }

  function emptyState() {
    const tests = {};
    for (const test of ACTIVE_TESTS) tests[test.id] = emptyTestState();
    return {
      phase: DEFAULT_PHASE,
      testIndex: 0,
      personId: null,
      evaluationId: null,
      identity: {},
      tests,
      replay: []
    };
  }

  function readState() {
    if (BUILDER_PREVIEW_MODE) return emptyState();
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return emptyState();
      const merged = Object.assign(emptyState(), parsed);
      merged.tests = Object.assign({}, emptyState().tests, parsed.tests || {});
      for (const test of ACTIVE_TESTS) {
        merged.tests[test.id] = Object.assign(emptyTestState(), merged.tests[test.id] || {});
      }
      merged.testIndex = Math.max(0, Math.min(Number(merged.testIndex) || 0, ACTIVE_TESTS.length - 1));
      if (DEFAULT_PHASE === 'exercise' && !['exercise','handoff'].includes(merged.phase)) {
        merged.phase = 'exercise';
      }
      return merged;
    } catch (_) {
      return emptyState();
    }
  }

  let state = readState();
  let activeTriChrono = null;
  let activeBriqueChrono = null;
  let transitionAdvanceTimer = null;
  let activeInteractiveFrame = null;
  let interactivePageActions = [];
  const VIDEO_HANDOFF_FADE_KEY = 'seb_kaltest_video_fade_to_brique_v1';
  const VIDEO_LAST_FRAME_HOLD_MS = 3000;

  function refreshCandidateBar() {
    try { window.KaloneoNavigation?.refresh?.(); } catch (_) {}
  }

  function clearInteractivePageActions(clearFrame = true) {
    interactivePageActions = [];
    if (clearFrame) activeInteractiveFrame = null;
    refreshCandidateBar();
  }

  function setInteractivePageActions(frame, actions) {
    if (frame !== activeInteractiveFrame) return;
    const source = Array.isArray(actions) ? actions : [];
    interactivePageActions = source
      .map((action, index) => ({
        id:String(action?.id || ('action-' + index)),
        label:String(action?.label || '').trim(),
        disabled:action?.disabled === true,
        title:String(action?.title || '').trim()
      }))
      .filter(action => action.label)
      .filter(action => {
        if (SHOW_CORRECTIONS_DURING_PARCOURS) return true;
        return !['verify','check','validate','correction'].includes(action.id.toLowerCase());
      })
      .slice(0,3);
    refreshCandidateBar();
  }

  function candidateBarActions() {
    return interactivePageActions.map(action => ({ ...action }));
  }

  function invokeCandidateBarAction(actionId) {
    const action = interactivePageActions.find(item => item.id === String(actionId || ''));
    const frame = activeInteractiveFrame;
    if (!action || action.disabled || !frame?.contentWindow) return false;
    try {
      frame.contentWindow.postMessage({
        source:'seb-kaltest-host',
        type:'command',
        testId:currentTest()?.id || '',
        action:action.id
      }, '*');
      return true;
    } catch (_) {
      return false;
    }
  }

  function persist() {
    if (BUILDER_PREVIEW_MODE) return; // aucun état candidat sauvegardé depuis un aperçu
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    try { window.sebEvalPro?.save?.(); } catch (_) {}
  }

  function replay(type, detail) {
    if (BUILDER_PREVIEW_MODE) return;
    const active = currentTest();
    if (active?.presentation?.transitionVideo) return;
    state.replay.push({
      type,
      phase: state.phase,
      testIndex: state.testIndex,
      testId: active?.id || null,
      detail: detail || null,
      at: Date.now()
    });
    persist();
  }

  function currentTest() {
    return ACTIVE_TESTS[state.testIndex] || null;
  }

  function currentTestState() {
    const test = currentTest();
    return test ? state.tests[test.id] : null;
  }

  function showPhase(phase, record = true) {
    state.phase = phase;
    document.querySelectorAll('.pilot2-page').forEach(page => {
      page.classList.toggle('visible', page.id === 'page-' + phase);
    });

    if (phase === 'exercise') {
      const test = currentTest();
      if (test) {
        document.body.dataset.sebKaltestExercise = '1';
        document.body.dataset.sebKaltestId = test.id;
        document.body.dataset.sebKaltestLabel = test.title;
      }
    } else {
      delete document.body.dataset.sebKaltestExercise;
      delete document.body.dataset.sebKaltestId;
      delete document.body.dataset.sebKaltestLabel;
      const calc = document.getElementById('calc-container');
      if (calc) calc.style.display = 'none';
    }

    persist();
    if (record) replay('PAGE_VIEW', { phase });
  }

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .replace(/\u00A0/g, ' ')
      .replace(/[’‘]/g, "'")
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('fr-FR');
  }

  function normalizeNumber(value) {
    const raw = String(value == null ? '' : value)
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, '')
      .replace(',', '.');
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeDurationText(value) {
    let text = normalizeText(value);
    if (!text) return '';
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    return text
      .replace(/heures?/g, 'h')
      .replace(/heurs?/g, 'h')
      .replace(/hrs?/g, 'h')
      .replace(/minutes?/g, 'm')
      .replace(/mins?/g, 'm')
      .replace(/mn/g, 'm')
      .replace(/\bet\b/g, ' ')
      .replace(/[.;]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseDurationFr(value) {
    const text = normalizeDurationText(value);
    if (!text) return null;

    let match = text.match(/^(\d+)\s*m$/);
    if (match) return Number(match[1]);

    match = text.match(/^(\d+)\s*h$/);
    if (match) return Number(match[1]) * 60;

    match = text.match(/^(\d+)\s*(?:h|:)\s*(\d{1,2})\s*m?$/);
    if (!match) match = text.match(/^(\d+)\s+(\d{1,2})$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isSafeInteger(hours) || hours < 0) return null;
    if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function evaluateQuestion(question, value) {
    const type = question?.response?.type || 'text';

    if (type === 'free-text' || question?.manualEvaluation === true) return null;

    if (type === 'duration') {
      const actual = parseDurationFr(value);
      return actual !== null && actual === Number(question.acceptedMinutes);
    }

    if (type === 'number' || type === 'number-unit') {
      const actual = normalizeNumber(value);
      return actual !== null && (question.acceptedAnswers || []).some(answer => {
        const expected = normalizeNumber(answer);
        return expected !== null && Math.abs(actual - expected) < 1e-9;
      });
    }

    if (type === 'multiple-choice') {
      const actual = Array.isArray(value) ? value.map(normalizeText).sort() : [];
      if (Number.isInteger(Number(question.acceptedCount))) {
        return actual.length === Number(question.acceptedCount);
      }
      return (question.acceptedAnswers || []).some(answer => {
        const expected = Array.isArray(answer) ? answer.map(normalizeText).sort() : [];
        return JSON.stringify(actual) === JSON.stringify(expected);
      });
    }

    const actual = normalizeText(value);
    return (question.acceptedAnswers || []).some(answer => actual === normalizeText(answer));
  }

  function showCorrectionDuringParcours() {
    return SHOW_CORRECTIONS_DURING_PARCOURS;
  }

  function hasAutomaticCorrection(test) {
    if (!test || test.scored === false) return false;
    if (test.evaluation?.dictationEngine) return true;
    return (test.questions || []).some(question => {
      if (question?.example === true || question?.manualEvaluation === true || question?.response?.type === 'free-text') return false;
      if (question?.response?.type === 'duration') return Number.isFinite(Number(question.acceptedMinutes));
      if (question?.response?.type === 'multiple-choice' && Number.isInteger(Number(question.acceptedCount))) return true;
      return Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0;
    });
  }

  function shouldPauseForValidation(test) {
    if (test?.presentation?.legacyFullPage === true) {
      return showCorrectionDuringParcours() && hasAutomaticCorrection(test);
    }
    return test?.behavior?.validateBeforeAdvance === true ||
      (showCorrectionDuringParcours() && hasAutomaticCorrection(test));
  }

  function applyVisibleCorrection(test, host) {
    if (!showCorrectionDuringParcours() || !host) return;
    const testState = testStateFor(test);
    if (testState.status !== 'COMPLETED' || !testState.result?.details) return;

    host.querySelectorAll('[data-question-id]').forEach(node => {
      if (node.classList.contains('kaltest-stock-pot') || node.classList.contains('kaltest-choice')) return;
      const questionId = String(node.dataset.questionId || '');
      const detail = testState.result.details?.[questionId];
      if (!detail || detail.manual || detail.correct == null) return;
      const target = node.closest('td,th,label,.kaltest-fraction-row,.kaltest-organisation-row,.kaltest-postures-answer') || node;
      target.classList.remove('kaltest-answer-correct','kaltest-answer-incorrect');
      target.classList.add(detail.correct ? 'kaltest-answer-correct' : 'kaltest-answer-incorrect');
      if ('disabled' in node) node.disabled = true;
      node.querySelectorAll?.('input,select,textarea,button').forEach(control => { control.disabled = true; });
    });
  }

  function evaluateTest(test, testState) {
    let scoreMax = 0;
    const details = {};

    for (const question of test.questions || []) {
      const manual = question?.response?.type === 'free-text' || question?.manualEvaluation === true;
      const points = manual ? 0 : (Number(question.points) || 0);
      const value = testState.answers[question.id];
      const correct = manual ? null : evaluateQuestion(question, value);
      const unitEnabled=!manual && question.example!==true && test.scored!==false &&
        question.unitInput===true && question.unitScored===true;
      const unitValue=String(testState.units?.[question.id]??'');
      const unitCorrect=unitEnabled && unitValue.trim()!=='' &&
        (question.acceptedUnits||[]).some(expected=>
          normalizeText(unitValue)===normalizeText(expected));
      if(!manual && question.example!==true && test.scored!==false)
        scoreMax += points+(unitEnabled?1:0);
      details[question.id]={
        value:value??'',correct,points,manual,
        unitValue,unitScored:unitEnabled,
        unitCorrect:unitEnabled?unitCorrect:null,
        unitPoints:unitEnabled?1:0,
        manualLevel:manual?null:undefined
      };
    }

    for (const group of test.evaluation?.uniqueGroups || []) {
      const allowed = new Set((group.allowedValues || []).map(normalizeText));
      const seen = new Set();
      for (const questionId of group.questionIds || []) {
        const detail = details[questionId];
        if (!detail) continue;
        const value = normalizeText(testState.answers?.[questionId]);
        const correct = allowed.has(value) && !seen.has(value);
        detail.correct = correct;
        if (correct) seen.add(value);
      }
    }

    if (test.evaluation?.mailRules === true) {
      const normalizeIdentity = value => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('fr-FR')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      let candidate = {};
      try { candidate = JSON.parse(sessionStorage.getItem('candidat_data') || '{}') || {}; } catch (_) {}
      const prenom = normalizeIdentity(candidate.prenom || candidate['prénom'] || '');
      const nom = normalizeIdentity(candidate.nom || '');
      const message = String(testState.answers?.mail_signature ?? testState.answers?.mail_phone ?? '');
      const messageNorm = normalizeIdentity(message);
      const subjectNorm = normalizeIdentity(testState.answers?.mail_subject);
      const prenomNom = (prenom + ' ' + nom).trim();
      const nomPrenom = (nom + ' ' + prenom).trim();

      if (details.mail_to) details.mail_to.correct =
        String(testState.answers?.mail_to || '').trim() === 'conseil.perso@sauvegarde56.org';
      if (details.mail_cc) details.mail_cc.correct =
        String(testState.answers?.mail_cc || '').trim() === 'stage-pro@sauvegarde56.org';
      if (details.mail_subject) details.mail_subject.correct =
        Boolean(prenom) && subjectNorm === (prenom + ' mail seb').trim();
      if (details.mail_file) details.mail_file.correct =
        String(testState.answers?.mail_file || '') === 'Rapport_stage.docx';
      if (details.mail_signature) details.mail_signature.correct =
        Boolean(prenom && nom && messageNorm) && (messageNorm.includes(prenomNom) || messageNorm.includes(nomPrenom));
      if (details.mail_phone) details.mail_phone.correct =
        /(^|[^\d])0\d(?:[\s.,\/-]?\d{2}){4}(?!\d)/.test(message);
    }

    if (test.evaluation?.nwtexteRules === true) {
      const config = (test.presentation?.builderContent || []).find(item => item?.type === 'text-editor')?.config || {};
      window.sebNwtexteContext = {
        storagePrefix:'seb_kaltest_editor:' + test.id + ':',
        legacyPage7:config.scoringProfile === 'seb-bureautique-v1'
      };
      const analyse = window.sebNwtexteEditor?.saveEvaluation?.() || null;
      const score = Math.max(0, Number(analyse?.score?.total) || 0);
      testState.answers.text_editor_html = window.sebNwtexteEditor?.editorHtml?.() || '';
      testState.answers.text_editor_text = window.sebNwtexteEditor?.editorText?.() || '';
      return {
        score,
        scoreMax:Number(test.evaluation?.scoreMax) || 8,
        percentage:(Number(test.evaluation?.scoreMax) || 8) > 0 ? (score / (Number(test.evaluation?.scoreMax) || 8)) * 100 : 0,
        details,
        textEditor:{analyse}
      };
    }

    if (test.evaluation?.bricksRules === true) {
      const brique = testState.brique || {};
      const seconds = Math.max(0, Math.floor(Number(brique.chronoSeconds) || 0));
      const errors = Math.max(0, Math.floor(Number(brique.errors) || 0));
      return {
        score:0,
        scoreMax:0,
        percentage:0,
        details,
        bricks:{
          temps:seconds,
          erreurs:errors,
          autoevaluation:{
            selections:Array.isArray(brique.autoSelections) ? brique.autoSelections.slice() : [],
            commentaire:String(brique.commentaire || '')
          }
        }
      };
    }

    if (test.evaluation?.triRules === true) {
      const tri = testState.tri || {};
      const rows = Array.isArray(tri.rows) ? tri.rows.slice(0,5) : [];
      const completed = rows.filter(row => Number.isFinite(Number(row?.seconds)) && row?.errors !== null && row?.errors !== undefined && String(row.errors).trim() !== '');
      const times = completed.map(row => Math.max(0, Math.floor(Number(row.seconds) || 0)));
      const errors = completed.map(row => Math.max(0, Math.floor(Number(row.errors) || 0)));
      const totalSeconds = times.reduce((sum,value)=>sum+value,0);
      const totalErrors = errors.reduce((sum,value)=>sum+value,0);
      const averageSeconds = completed.length ? Math.round(totalSeconds / completed.length) : 0;
      const averageErrors = completed.length ? totalErrors / completed.length : 0;
      return {
        score:0,
        scoreMax:0,
        percentage:0,
        details,
        tri:{
          completedCount:completed.length,
          temps_moyen:averageSeconds,
          temps_essais:times,
          moyenne_erreurs:averageErrors,
          erreurs_total:totalErrors
        }
      };
    }

    if (test.evaluation?.dictationEngine === 'seb-dictee-v3') {
      const engine = window.sebKaltestDicteeEngine;
      if (!engine?.evaluateText) throw new Error('Moteur Dictée KALTEST indisponible.');
      const text = String(testState.answers?.dictee_text ?? '');
      const dictation = engine.evaluateText(text);
      if (details.dictee_text) {
        details.dictee_text.correct = dictation.motsCorrects === dictation.motsTotal;
        details.dictee_text.value = text;
      }
      return {
        score:Number(dictation.scoreSur20) || 0,
        scoreMax:20,
        percentage:Math.max(0, Math.min(100, ((Number(dictation.scoreSur20) || 0) / 20) * 100)),
        details,
        dictation
      };
    }

    const manualItems = (test.questions || [])
      .filter(question => question?.response?.type === 'free-text' || question?.manualEvaluation === true)
      .map(question => ({
        questionId:String(question.id || ''),
        prompt:String(question.prompt || ''),
        response:String(testState.answers?.[question.id] ?? ''),
        level:null,
        comment:'',
        levels:Array.isArray(question.manualLevels) && question.manualLevels.length
          ? question.manualLevels.slice()
          : ['NE','I','II','III']
      }));

    let score = 0;
    if (test.scored !== false) {
      for (const question of test.questions || []) {
        if (question.example === true) continue;
        if (details[question.id]?.correct) score += Number(question.points) || 0;
        if (details[question.id]?.unitCorrect===true) score += 1;
      }
    }

    return {
      score,
      scoreMax,
      percentage: scoreMax > 0 ? (score / scoreMax) * 100 : 0,
      details,
      manualEvaluation:{
        required:manualItems.length > 0,
        testId:String(test.id || ''),
        testTitle:String(test.title || test.id || ''),
        levels:['NE','I','II','III'],
        items:manualItems
      }
    };
  }

  function testStateFor(test) {
    if (!state.tests[test.id]) state.tests[test.id] = emptyTestState();
    return state.tests[test.id];
  }

  function questionById(test, id) {
    return (test.questions || []).find(question => question.id === id) || null;
  }

  function hasActivity(test, testState) {
    if (Object.values(testState.answers || {}).some(value => {
      if (Array.isArray(value)) return value.length > 0;
      return String(value == null ? '' : value).trim() !== '';
    })) return true;

    if (Object.values(testState.units || {}).some(value => String(value || '').trim() !== '')) return true;

    return Object.values(testState.supplemental || {}).some(fields =>
      fields && Object.values(fields).some(value => String(value || '').trim() !== '')
    );
  }

  function saveAnswer(test, questionId, value) {
    const testState = testStateFor(test);
    testState.answers[questionId] = value;
    testState.status = 'ACTIVE';
    replay('ANSWER_CHANGED', { questionId });
  }

  function saveUnit(test, questionId, value) {
    const testState = testStateFor(test);
    testState.units[questionId] = value;
    testState.status = 'ACTIVE';
    replay('UNIT_CHANGED', { questionId });
  }

  function saveSupplemental(test, questionId, fieldId, value) {
    const testState = testStateFor(test);
    if (!testState.supplemental[questionId]) testState.supplemental[questionId] = {};
    testState.supplemental[questionId][fieldId] = value;
    testState.status = 'ACTIVE';
    replay('SUPPLEMENTAL_CHANGED', { questionId, fieldId });
  }

  function makeInput(test, question, options = {}) {
    const testState = testStateFor(test);
    const type = question.response?.type || 'text';

    if (type === 'single-choice' || type === 'select' || type === 'boolean') {
      const select = document.createElement('select');
      select.className = 'step';
      select.dataset.questionId = question.id;
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'Choisir…';
      select.appendChild(empty);
      const values = type === 'boolean' ? ['Vrai','Faux'] : (question.response?.options || []);
      for (const value of values) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
      }
      select.value = String(testState.answers[question.id] ?? '');
      select.addEventListener('change', () => saveAnswer(test, question.id, select.value));
      return select;
    }

    if (type === 'free-text') {
      const input = document.createElement('textarea');
      input.className = 'step kaltest-free-text-answer';
      input.dataset.questionId = question.id;
      input.rows = 6; // Le moteur partagé applique la hauteur personnalisée, si présente.
      input.value = String(testState.answers[question.id] ?? '');
      input.placeholder = 'Votre réponse';
      input.addEventListener('input', () => saveAnswer(test, question.id, input.value));
      return input;
    }

    if (type === 'multiple-choice') {
      const group = document.createElement('div');
      group.className = 'kaltest-multiple-choice';
      group.dataset.questionId = question.id;
      const selected = new Set(Array.isArray(testState.answers[question.id]) ? testState.answers[question.id] : []);
      for (const value of question.response?.options || []) {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = String(value);
        checkbox.checked = selected.has(String(value));
        checkbox.addEventListener('change', () => {
          const values = Array.from(group.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
          saveAnswer(test, question.id, values);
        });
        label.append(checkbox, document.createTextNode(' ' + String(value)));
        group.appendChild(label);
      }
      return group;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'step';
    input.dataset.questionId = question.id;
    input.value = String(testState.answers[question.id] ?? '');
    if (type === 'number' || type === 'number-unit') input.inputMode = 'decimal';
    input.placeholder = '';
    input.addEventListener('input', () => saveAnswer(test, question.id, input.value));
    return input;
  }

  function makeUnitInput(test, question) {
    const testState = testStateFor(test);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'step';
    input.value = String(testState.units[question.id] ?? '');
    input.disabled = question.unitInput === false;
    input.addEventListener('input', () => saveUnit(test, question.id, input.value));
    return input;
  }

  function makeSupplementalInput(test, question, field) {
    const testState = testStateFor(test);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'step';
    input.value = String(testState.supplemental?.[question.id]?.[field.id] ?? '');
    input.addEventListener('input', () => saveSupplemental(test, question.id, field.id, input.value));
    return input;
  }

  function renderQuestionList(test) {
    const list = document.createElement('ol');
    list.className = 'kaltest-question-list';
    for (const question of test.questions || []) {
      const li = document.createElement('li');
      li.textContent = question.prompt;
      list.appendChild(li);
    }
    return list;
  }

  function renderBasicResponseTable(test) {
    const wrapper = document.createElement('div');
    wrapper.className = 'kaltest-table-wrap';

    const table = document.createElement('table');
    table.className = 'kaltest-table';

    const headers = test.presentation?.responseTable?.headers || ['Question N°', 'Réponse', 'Unités'];
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    headers.forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    (test.questions || []).forEach((question, index) => {
      const tr = document.createElement('tr');
      const number = document.createElement('td');
      number.className = 'kaltest-row-label';
      number.textContent = 'Question N°' + (index + 1);
      tr.appendChild(number);

      const answer = document.createElement('td');
      answer.appendChild(makeInput(test, question));
      tr.appendChild(answer);

      const unit = document.createElement('td');
      unit.appendChild(makeUnitInput(test, question));
      tr.appendChild(unit);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }

  function renderVisualPanel(visual = {}) {
    const panel = document.createElement('aside');
    panel.className = 'kaltest-visual-panel';
    panel.setAttribute('aria-label', visual.alt || 'Illustration de l’exercice');

    const frame = document.createElement('div');
    frame.className = 'kaltest-visual-frame';

    if (visual.src) {
      const img = document.createElement('img');
      img.src = visual.src;
      img.alt = visual.alt || '';
      frame.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'kaltest-visual-placeholder';
      const badge = document.createElement('span');
      badge.className = 'kaltest-visual-placeholder-icon';
      badge.textContent = '▧';
      const label = document.createElement('strong');
      label.textContent = visual.placeholder || 'Image verticale';
      placeholder.append(badge, label);
      frame.appendChild(placeholder);
    }

    panel.appendChild(frame);
    return panel;
  }

  function renderQuestionnaireVisual(test) {
    return renderVisualPanel(test.presentation?.kaloneoLayout?.right || {});
  }

  function renderBasic(test, host) {
    const configured = test.presentation?.kaloneoLayout;
    if (configured?.type === 'questions-table-visual' && configured?.ratio === '60/40') {
      const layout = document.createElement('div');
      layout.className = 'kaltest-questionnaire-visual-layout';

      const left = document.createElement('section');
      left.className = 'kaltest-questionnaire-left';
      left.appendChild(renderQuestionList(test));
      left.appendChild(renderBasicResponseTable(test));

      layout.append(left, renderQuestionnaireVisual(test));
      host.appendChild(layout);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'kaltest-simple-layout';
    layout.appendChild(renderQuestionList(test));
    layout.appendChild(renderBasicResponseTable(test));
    host.appendChild(layout);
  }

  function renderSchedule(test, host) {
    const wrap = document.createElement('div');
    wrap.className = 'kaltest-table-wrap';

    const table = document.createElement('table');
    table.className = 'kaltest-table';

    const thead = document.createElement('thead');
    const head = document.createElement('tr');
    (test.presentation?.table?.headers || []).forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      head.appendChild(th);
    });
    thead.appendChild(head);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const row of test.presentation?.table?.rows || []) {
      const tr = document.createElement('tr');
      for (const cell of row.cells || []) {
        const td = document.createElement('td');
        if (typeof cell === 'string') {
          td.textContent = cell;
          if (cell && (cell === 'Lundi' || cell === 'Mardi' || cell === 'Mercredi' || cell === 'Jeudi' || cell === 'Vendredi' || cell === 'Total')) {
            td.className = 'kaltest-row-label';
          }
        } else if (cell && cell.questionId) {
          const question = questionById(test, cell.questionId);
          if (question) td.appendChild(makeInput(test, question, { compact:true }));
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);

    const averages = document.createElement('div');
    averages.className = 'kaltest-averages';
    for (const id of test.presentation?.averages || []) {
      const question = questionById(test, id);
      if (!question) continue;
      const row = document.createElement('div');
      row.className = 'kaltest-average-row';
      const label = document.createElement('span');
      label.textContent = question.prompt;
      row.append(label, makeInput(test, question, { compact:true }));
      averages.appendChild(row);
    }

    const configured = test.presentation?.kaloneoLayout;
    if (configured?.type === 'visual-schedule' && configured?.ratio === '40/60') {
      const layout = document.createElement('div');
      layout.className = 'kaltest-schedule-visual-layout';

      const work = document.createElement('section');
      work.className = 'kaltest-schedule-work';
      work.append(wrap, averages);

      layout.append(renderVisualPanel(configured.left || {}), work);
      host.appendChild(layout);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'kaltest-split-layout kaltest-split-60';
    layout.append(wrap, averages);
    host.appendChild(layout);
  }

  function renderInlineGaps(test, host) {
    const wrapper = document.createElement('div');
    wrapper.className = 'kaltest-inline-work';

    const bank = document.createElement('div');
    bank.className = 'kaltest-word-bank';
    for (const word of test.presentation?.wordBank || []) {
      const span = document.createElement('span');
      span.textContent = word;
      bank.appendChild(span);
    }
    wrapper.appendChild(bank);

    const flow = document.createElement('div');
    flow.className = 'kaltest-inline-flow';
    for (const item of test.presentation?.inlineFlow || []) {
      if (item.type === 'text') {
        flow.appendChild(document.createTextNode(item.text || ''));
        if (item.breakAfterSentence === true) {
          flow.appendChild(document.createElement('br'));
          flow.appendChild(document.createElement('br'));
        }
      } else if (item.type === 'question') {
        const question = questionById(test, item.questionId);
        if (question) flow.appendChild(makeInput(test, question, { compact:true }));
      }
    }
    wrapper.appendChild(flow);

    const configured = test.presentation?.kaloneoLayout;
    if (configured?.type === 'visual-inline-gaps' && configured?.ratio === '40/60') {
      const layout = document.createElement('div');
      layout.className = 'kaltest-inline-visual-layout';
      layout.append(renderVisualPanel(configured.left || {}), wrapper);
      host.appendChild(layout);
      return;
    }

    host.appendChild(wrapper);
  }

  function applyTableColumnPresentation(cell, definition) {
    if (!cell || !definition) return;
    const widthChars = Number(definition.widthChars);
    if (Number.isFinite(widthChars) && widthChars >= 3) {
      cell.style.width = widthChars + 'ch';
      cell.style.minWidth = widthChars + 'ch';
      cell.style.maxWidth = widthChars + 'ch';
    }
    if (definition.align === 'center') cell.style.textAlign = 'center';
    if (definition.align === 'left') cell.style.textAlign = 'left';
  }

  function renderConversions(test, host) {
    const questions = renderQuestionList(test);

    const wrapper = document.createElement('div');
    wrapper.className = 'kaltest-table-wrap';
    const table = document.createElement('table');
    table.className = 'kaltest-table kaltest-conversions-table';

    const thead = document.createElement('thead');
    const head = document.createElement('tr');
    const columnPresentation = test.presentation?.responseTable?.columns || [];
    (test.presentation?.responseTable?.headers || ['N°','Réponses','Unités','Opérations effectuées']).forEach((label, columnIndex) => {
      const th = document.createElement('th');
      th.textContent = label;
      applyTableColumnPresentation(th, columnPresentation[columnIndex]);
      head.appendChild(th);
    });
    thead.appendChild(head);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    (test.questions || []).forEach((question, index) => {
      const tr = document.createElement('tr');

      const number = document.createElement('td');
      number.className = 'kaltest-row-label';
      number.textContent = String(index + 1);
      applyTableColumnPresentation(number, columnPresentation[0]);
      tr.appendChild(number);

      const answer = document.createElement('td');
      answer.appendChild(makeInput(test, question, { compact:true }));
      applyTableColumnPresentation(answer, columnPresentation[1]);
      tr.appendChild(answer);

      const unit = document.createElement('td');
      unit.appendChild(makeUnitInput(test, question));
      applyTableColumnPresentation(unit, columnPresentation[2]);
      tr.appendChild(unit);

      const operation = document.createElement('td');
      const field = question.supplementalFields?.[0];
      if (field) operation.appendChild(makeSupplementalInput(test, question, field));
      applyTableColumnPresentation(operation, columnPresentation[3]);
      tr.appendChild(operation);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    const configured = test.presentation?.kaloneoLayout;
    if (configured?.type === 'work-visual' && configured?.ratio === '60/40') {
      const layout = document.createElement('div');
      layout.className = 'kaltest-conversions-visual-layout';

      const work = document.createElement('section');
      work.className = 'kaltest-conversions-work';
      work.append(questions, wrapper);

      layout.append(work, renderVisualPanel(configured.right || {}));
      host.appendChild(layout);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'kaltest-split-layout kaltest-split-50';
    layout.append(questions, wrapper);
    host.appendChild(layout);
  }

  function extractQuotedSource(prompt) {
    const match = String(prompt || '').match(/«\s*([^»]+?)\s*»/);
    return match ? match[1].trim() : '';
  }

  function renderGenreNombre(test, host) {
    const layout = document.createElement('div');
    layout.className = 'kaltest-two-tables';

    for (const definition of test.presentation?.tables || []) {
      const card = document.createElement('div');
      card.className = 'kaltest-table-card';
      // Même réglage de police que les blocs Builder, sans remplacer le
      // moteur historique qui positionne les deux tableaux Genre/Nombre.
      if(definition.builderStyle)applyBuilderItemStyle(card,{style:definition.builderStyle});

      const title = document.createElement('h3');
      title.textContent = definition.title || '';
      card.appendChild(title);

      const table = document.createElement('table');
      table.className = 'kaltest-table kaltest-grammar-table';

      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      for (const header of definition.headers || []) {
        const th = document.createElement('th');
        th.textContent = header;
        trh.appendChild(th);
      }
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const id of definition.questionIds || []) {
        const question = questionById(test, id);
        if (!question) continue;

        const prompt = normalizeText(question.prompt);
        const source = extractQuotedSource(question.prompt);
        const headers = definition.headers || [];
        const targetLeft = headers.length > 1 && prompt.includes(normalizeText(headers[0]));
        const tr = document.createElement('tr');
        const left = document.createElement('td');
        const right = document.createElement('td');

        if (targetLeft) {
          left.appendChild(makeInput(test, question, { compact:true }));
          right.textContent = source;
          right.className = 'kaltest-grammar-source';
        } else {
          left.textContent = source;
          left.className = 'kaltest-grammar-source';
          right.appendChild(makeInput(test, question, { compact:true }));
        }

        tr.append(left, right);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      card.appendChild(table);
      layout.appendChild(card);
    }

    host.appendChild(layout);
  }

  function renderChoiceTable(test, host) {
    const table = document.createElement('table');
    table.className = 'kaltest-table kaltest-choice-table';

    const thead = document.createElement('thead');
    const head = document.createElement('tr');
    (test.presentation?.choiceTable?.columns || []).forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      head.appendChild(th);
    });
    thead.appendChild(head);
    table.appendChild(thead);

    const testState = testStateFor(test);
    const completed = testState.status === 'COMPLETED';
    const tbody = document.createElement('tbody');

    for (const question of test.questions || []) {
      const tr = document.createElement('tr');
      const word = document.createElement('td');
      word.className = 'kaltest-row-label';
      word.textContent = question.prompt;
      tr.appendChild(word);

      for (const option of question.response?.options || []) {
        const td = document.createElement('td');
        td.className = 'kaltest-choice';
        td.dataset.questionId = question.id;
        td.textContent = option;
        const selected = normalizeText(testState.answers[question.id]) === normalizeText(option);
        const expected = (question.acceptedAnswers || []).some(answer => normalizeText(answer) === normalizeText(option));
        if (selected) td.classList.add('selected');
        if (completed) {
          td.setAttribute('aria-disabled', 'true');
          if (showCorrectionDuringParcours()) {
            if (expected) td.classList.add('kaltest-answer-correct');
            else if (selected) td.classList.add('kaltest-answer-incorrect');
          }
        } else {
          td.addEventListener('click', () => {
            Array.from(tr.querySelectorAll('.kaltest-choice')).forEach(cell => cell.classList.remove('selected'));
            td.classList.add('selected');
            saveAnswer(test, question.id, option);
          });
        }
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);

    const configured = test.presentation?.kaloneoLayout;

    if (configured?.type === 'full-width-choice-table') {
      const outer = document.createElement('section');
      outer.className = 'kaltest-choice-fullwidth-outer';
      const inner = document.createElement('div');
      inner.className = 'kaltest-choice-fullwidth-inner';
      inner.appendChild(table);
      outer.appendChild(inner);
      host.appendChild(outer);
      return;
    }

    if (configured?.type === 'visual-choice-table' && configured?.ratio === '40/60') {
      const layout = document.createElement('div');
      layout.className = 'kaltest-choice-visual-layout';

      const tableWrap = document.createElement('div');
      tableWrap.className = 'kaltest-choice-table-wrap';
      tableWrap.appendChild(table);

      layout.append(renderVisualPanel(configured.left || {}), tableWrap);
      host.appendChild(layout);
      return;
    }

    host.appendChild(table);
  }



  function renderBuilderMedia(item) {
    return window.KaloneoSharedPresentation.renderMedia({
      doc:document,type:item.type,
      resource:item.resource||{},style:item.style||{},
      className:'kaltest-builder-media',
      imageClass:'seb-media-image',videoClass:'seb-media-video'
    });
  }

  function renderBuilderGrid(test, item) {
    const definition=item.table||{};
    const testState=testStateFor(test);
    return window.KaloneoSharedPresentation.renderGridTable({
      doc:document,definition,
      className:'kaltest-table kaltest-builder-grid',
      wrapperClassName:'kaltest-table-wrap kaltest-builder-grid-wrap',
      compactClassName:'kaltest-builder-grid-compact',
      equalClassName:'kaltest-builder-grid-equal-auto',
      renderCell:({cell:td,cellDefinition,rowNode:tr})=>{
        if (cellDefinition.kind === 'fixed-text') {
          td.textContent = String(cellDefinition.value || '');
        } else if (cellDefinition.kind === 'candidate-answer' ||
                   cellDefinition.kind === 'select' ||
                   cellDefinition.kind === 'unit') {
          const question = questionById(test, cellDefinition.questionId);
          if (question) {
            const effectiveQuestion=cellDefinition.kind==='select'
              ?window.KaloneoSharedPresentation.gridSelectQuestion(question,cellDefinition)
              :question;
            const input = cellDefinition.kind==='unit'
              ?makeUnitInput(test,{...question,unitInput:true})
              :makeInput(test,effectiveQuestion,{compact:true});
            if (testState.status === 'COMPLETED') {
              input.disabled = true;
              if (showCorrectionDuringParcours(test)) {
                const detail = testState.result?.details?.[question.id];
                td.classList.add(detail?.correct ? 'kaltest-answer-correct' : 'kaltest-answer-incorrect');
              }
            }
            td.appendChild(input);
          }
        } else if (cellDefinition.kind === 'choice-option') {
          const question = questionById(test, cellDefinition.questionId);
          const option = String(cellDefinition.value || '');
          td.className = 'kaltest-choice';
          td.textContent = option;
          if (question) {
            td.dataset.questionId = question.id;
            const selected = normalizeText(testState.answers[question.id]) === normalizeText(option);
            const expected = (question.acceptedAnswers || []).some(answer => normalizeText(answer) === normalizeText(option));
            if (selected) td.classList.add('selected');
            if (testState.status === 'COMPLETED') {
              td.setAttribute('aria-disabled', 'true');
              if (showCorrectionDuringParcours()) {
                if (expected) td.classList.add('kaltest-answer-correct');
                else if (selected) td.classList.add('kaltest-answer-incorrect');
              }
            } else {
              td.tabIndex = 0;
              td.setAttribute('role', 'button');
              const choose = () => {
                Array.from(tr.querySelectorAll('.kaltest-choice')).forEach(node => node.classList.remove('selected'));
                td.classList.add('selected');
                saveAnswer(test, question.id, option);
              };
              td.addEventListener('click', choose);
              td.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  choose();
                }
              });
            }
          }
        } else if (cellDefinition.kind === 'image') {
          const img = document.createElement('img');
          img.src = String(cellDefinition.value || '');
          img.alt = cellDefinition.alt || '';
          img.className = 'seb-media-image';
          td.appendChild(img);
        } else if (cellDefinition.kind === 'audio') {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = String(cellDefinition.value || '');
          td.appendChild(audio);
        } else if (cellDefinition.kind === 'video') {
          const video = document.createElement('video');
          video.controls = true;
          video.src = String(cellDefinition.value || '');
          video.className = 'seb-media-video';
          td.appendChild(video);
        }
      }
    });
  }

    function renderBuilderInlineFlow(test, item) {
    return window.KaloneoSharedPresentation.renderInlineFlow({
      doc:document,wordBank:item.wordBank||[],flow:item.flow||[],
      className:'kaltest-inline-work',
      bankClass:'kaltest-word-bank',flowClass:'kaltest-inline-flow',
      makeAnswer:(questionId)=>{
        const question=questionById(test,questionId);
        return question?makeInput(test,question,{compact:true}):null;
      }
    });
  }

  function renderBuilderResponseTable(test, item) {
    const definition = item.definition || {};
    return window.KaloneoSharedPresentation.renderResponseTable({
      doc:document,
      headers:definition.headers||['Question N°','Réponse','Unités'],
      columns:definition.columns||[],
      rows:test.questions||[],
      className:'kaltest-table',wrapperClassName:'kaltest-table-wrap',
      renderCell:({cell,row:question,rowIndex,colIndex})=>{
        if(colIndex===0){
          cell.textContent=String(rowIndex+1);
        }else if(colIndex===1){
          cell.appendChild(makeInput(test,question,{compact:true}));
        }else if(colIndex===2){
          cell.appendChild(makeUnitInput(test,question));
        }else{
          const field=question.supplementalFields?.[colIndex-3];
          if(field)cell.appendChild(makeSupplementalInput(test,question,field));
        }
      }
    });
  }

  function renderAutoevaluation(test, host) {
    const definition = test.presentation?.autoevaluationForm;
    if (!definition || !definition.questionId) return false;
    const question = questionById(test, definition.questionId);
    if (!question) return false;

    const layout = document.createElement('div');
    layout.className = 'kaltest-autoeval-layout';
    const form = document.createElement('section');
    form.className = 'kaltest-autoeval-form';
    const statements = new Map((definition.statements || []).map(item => [String(item.value), item]));

    function appendStatement(value) {
      const item = statements.get(String(value));
      if (!item) return;
      const label = document.createElement('label');
      label.className = 'kaltest-autoeval-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = String(value);
      const selected = new Set(Array.isArray(testStateFor(test).answers?.[question.id]) ? testStateFor(test).answers[question.id].map(String) : []);
      input.checked = selected.has(String(value));
      input.addEventListener('change', () => {
        const current = new Set(Array.isArray(testStateFor(test).answers?.[question.id]) ? testStateFor(test).answers[question.id].map(String) : []);
        if (input.checked) current.add(String(value)); else current.delete(String(value));
        saveAnswer(test, question.id, Array.from(current));
      });
      const span = document.createElement('span');
      span.textContent = item.label || String(value);
      label.append(input, span);
      form.appendChild(label);
    }

    if (Array.isArray(definition.groups) && definition.groups.length) {
      for (const group of definition.groups) {
        const title = document.createElement('h3');
        title.textContent = group.title || '';
        form.appendChild(title);
        for (const value of group.values || []) appendStatement(value);
      }
    } else {
      for (const item of definition.statements || []) appendStatement(item.value);
    }

    const comment = document.createElement('label');
    comment.className = 'kaltest-autoeval-comment';
    const caption = document.createElement('span');
    caption.textContent = definition.commentLabel || 'Commentaire :';
    const textarea = document.createElement('textarea');
    textarea.rows = 5;
    const fieldId = definition.commentFieldId || 'commentaire';
    textarea.value = String(testStateFor(test).supplemental?.[question.id]?.[fieldId] ?? '');
    textarea.addEventListener('input', () => saveSupplemental(test, question.id, fieldId, textarea.value));
    comment.append(caption, textarea);
    form.appendChild(comment);

    layout.append(form, renderVisualPanel(definition.visual || {}));
    host.appendChild(layout);
    return true;
  }

  function renderTransitionVideo(test, host) {
    const definition = test.presentation?.transitionVideo;
    if (!definition) return false;

    document.body.classList.add('seb-kaltest-transition-video');
    const next = document.getElementById('kaltest-next');
    if (next) next.hidden = true;

    const wrap = document.createElement('div');
    wrap.className = 'kaltest-transition-video-wrap';
    const video = document.createElement('video');
    video.className = 'kaltest-transition-video';
    video.autoplay = definition.autoplay !== false;
    video.muted = definition.muted !== false;
    video.playsInline = definition.playsInline !== false;
    video.preload = 'auto';
    video.src = definition.src || '';
    const fade = document.createElement('div');
    fade.className = 'kaltest-transition-fade';
    wrap.append(video, fade);
    host.appendChild(wrap);

    const fadeMs = Math.max(0, Number(definition.fadeMs) || 1500);
    let advanced = false;
    const complete = (videoFailed = false) => {
      if (advanced) return;
      advanced = true;
      const testState = testStateFor(test);
      testState.result = {score:0,scoreMax:0,percentage:0,details:{},status:'completed'};
      testState.status = 'COMPLETED';
      testState.answers.transition_complete = '1';
      persist();
      replay('TRANSITION_VIDEO_COMPLETED', {testId:test.id});

      clearTimeout(transitionAdvanceTimer);
      if (videoFailed) {
        // Pas de dernière image fiable si la vidéo n'est pas lisible.
        document.body.classList.remove('seb-kaltest-transition-video');
        advance();
        return;
      }

      // Le lecteur conserve sa toute dernière image, immobile pendant trois secondes.
      video.pause();
      wrap.classList.add('kaltest-transition-holding');
      transitionAdvanceTimer = setTimeout(() => {
        transitionAdvanceTimer = null;
        if (!wrap.isConnected) return;

        if (PILOT11_MODE) {
          // Le parcours historique change de document : fondu au noir,
          // puis révélation progressive de la page Briques après navigation.
          fade.classList.add('visible');
          transitionAdvanceTimer = setTimeout(() => {
            transitionAdvanceTimer = null;
            try { sessionStorage.setItem(VIDEO_HANDOFF_FADE_KEY, String(Date.now())); } catch (_) {}
            document.body.classList.remove('seb-kaltest-transition-video');
            advance();
          }, fadeMs);
          return;
        }

        // KALTEST autonome : conserver l'image arrêtée au-dessus du prochain
        // écran, puis la rendre transparente pour un vrai fondu enchaîné.
        wrap.classList.add('kaltest-transition-last-frame-overlay');
        wrap.style.setProperty('--kaltest-transition-crossfade-ms', fadeMs + 'ms');
        document.body.appendChild(wrap);
        advance(); // Dessine l'image de l'exercice suivant sous la vidéo arrêtée.
        const removeOverlay = () => { if (wrap.isConnected) wrap.remove(); };
        wrap.addEventListener('transitionend', event => {
          if (event.target === wrap && event.propertyName === 'opacity') removeOverlay();
        });
        // Forcer l'état initial dans le moteur CSS, même en fenêtre masquée.
        // Le changement d'opacité déclenche alors le fondu de façon fiable.
        void wrap.offsetWidth;
        wrap.classList.add('kaltest-transition-crossfade-out');
        setTimeout(removeOverlay, fadeMs + 150);
      }, VIDEO_LAST_FRAME_HOLD_MS);
    };

    video.addEventListener('ended', () => complete(), {once:true});
    video.addEventListener('error', () => {
      document.getElementById('exercise-status').textContent = 'La transition vidéo est indisponible. Passage à l’exercice suivant.';
      complete(true);
    }, {once:true});
    const promise = video.play();
    if (promise?.catch) promise.catch(() => {
      video.muted = true;
      video.play().catch(() => complete(true));
    });
    return true;
  }

  function revealBriqueAfterVideoHandoff() {
    // Le parcours historique ouvre la page Briques dans un nouveau document.
    if (SEGMENT_KEY !== 'brique') return;
    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(VIDEO_HANDOFF_FADE_KEY) || 0);
      sessionStorage.removeItem(VIDEO_HANDOFF_FADE_KEY);
    } catch (_) {}
    if (!saved || Date.now() - saved > 30000) return;
    const veil = document.createElement('div');
    veil.className = 'kaltest-transition-entrance-veil';
    document.body.appendChild(veil);
    const clean = () => veil.remove();
    veil.addEventListener('transitionend', event => {
      if (event.target === veil && event.propertyName === 'opacity') clean();
    });
    void veil.offsetWidth;
    veil.classList.add('kaltest-transition-entrance-reveal');
    setTimeout(clean, 1650);
  }

  function renderBrique(test, host) {
    const definition = test.presentation?.bricksStation;
    if (!definition) return false;
    const testState = testStateFor(test);
    if (!testState.brique || typeof testState.brique !== 'object') {
      testState.brique = {
        chronoSeconds:0,
        errors:null,
        adminValidated:false,
        autoSelections:[],
        commentaire:'',
        autoValidated:false
      };

      try {
        const legacy = JSON.parse(sessionStorage.getItem('eval_brique') || 'null');
        if (legacy) {
          const match = String(legacy.temps || '').match(/^(\d+):(\d{2})$/);
          if (match) testState.brique.chronoSeconds = Number(match[1]) * 60 + Number(match[2]);
          if (legacy.niveau !== undefined && legacy.niveau !== null && String(legacy.niveau).trim() !== '') {
            testState.brique.errors = Math.max(0, Math.floor(Number(legacy.niveau) || 0));
            testState.brique.adminValidated = true;
          }
        }
        const legacyAuto = JSON.parse(sessionStorage.getItem('eval_brique_auto') || 'null');
        if (legacyAuto) {
          testState.brique.autoSelections = Array.isArray(legacyAuto.choix) ? legacyAuto.choix.slice() : [];
          testState.brique.commentaire = String(legacyAuto.commentaire || '');
          testState.brique.autoValidated = Boolean(legacyAuto);
          if (testState.brique.adminValidated && testState.brique.autoValidated) testState.answers.brique_ready = '1';
        }
        const checkpoint = JSON.parse(sessionStorage.getItem('seb_evalpro_brique_checkpoint') || 'null');
        if (Number(checkpoint?.chronoSeconds) > Number(testState.brique.chronoSeconds || 0)) {
          testState.brique.chronoSeconds = Math.floor(Number(checkpoint.chronoSeconds));
        }
      } catch (_) {}
    }

    const brique = testState.brique;
    if (activeBriqueChrono?.destroy) {
      try { activeBriqueChrono.destroy(); } catch (_) {}
      activeBriqueChrono = null;
    }

    const shell = document.createElement('div');
    shell.className = 'kaltest-brique-layout';

    const left = document.createElement('section');
    left.className = 'kaltest-brique-left';

    const imageCard = document.createElement('div');
    imageCard.className = 'kaltest-brique-image-card';
    const image = document.createElement('img');
    image.src = definition.image || '';
    image.alt = definition.imageAlt || '';
    imageCard.appendChild(image);

    const autoCard = document.createElement('div');
    autoCard.className = 'kaltest-brique-autoeval';
    autoCard.id = 'autoEvalPart';
    autoCard.hidden = !brique.adminValidated;
    const autoTitle = document.createElement('h3');
    autoTitle.textContent = 'Autoévaluation personnelle';
    const autoIntro = document.createElement('p');
    autoIntro.textContent = 'Évaluez votre ressenti et votre progression pendant cette activité.';
    autoCard.append(autoTitle, autoIntro);

    const selected = new Set(Array.isArray(brique.autoSelections) ? brique.autoSelections.map(String) : []);
    for (const item of definition.autoStatements || []) {
      const label = document.createElement('label');
      label.className = 'kaltest-brique-auto-choice';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(item.value);
      checkbox.checked = selected.has(String(item.value));
      checkbox.disabled = testState.status === 'COMPLETED';
      checkbox.addEventListener('change', () => {
        brique.autoSelections = Array.from(autoCard.querySelectorAll('.kaltest-brique-auto-choice input:checked')).map(input=>input.value);
        brique.autoValidated = false;
        delete testState.answers.brique_ready;
        refreshNext();
        persist();
      });
      label.append(checkbox, document.createTextNode(' ' + item.label));
      autoCard.appendChild(label);
    }

    const commentLabel = document.createElement('label');
    commentLabel.className = 'kaltest-brique-comment';
    commentLabel.textContent = 'Laissez un commentaire pour préciser votre ressenti :';
    const comment = document.createElement('textarea');
    comment.rows = 4;
    comment.value = String(brique.commentaire || '');
    comment.disabled = testState.status === 'COMPLETED';
    comment.addEventListener('input', () => {
      brique.commentaire = comment.value;
      brique.autoValidated = false;
      delete testState.answers.brique_ready;
      refreshNext();
      persist();
    });
    commentLabel.appendChild(comment);
    autoCard.appendChild(commentLabel);

    const autoValidate = document.createElement('button');
    autoValidate.type = 'button';
    autoValidate.id = 'autoEvalBtn';
    autoValidate.className = 'seb-action-btn seb-btn-nav kaltest-brique-auto-validate';
    autoValidate.textContent = brique.autoValidated ? 'Autoévaluation validée ✓' : 'Valider mon autoévaluation';
    autoValidate.disabled = testState.status === 'COMPLETED' || brique.autoValidated;
    autoCard.appendChild(autoValidate);

    left.append(brique.adminValidated ? autoCard : imageCard);

    const right = document.createElement('section');
    right.className = 'kaltest-brique-right';

    const chronoCard = document.createElement('div');
    chronoCard.className = 'kaltest-brique-control-card';
    const chronoTitle = document.createElement('h3');
    chronoTitle.textContent = 'Compteur';
    const display = document.createElement('div');
    display.className = 'seb-chrono-display kaltest-brique-display';
    display.textContent = window.KaloneoChrono?.format?.(Number(brique.chronoSeconds)||0) || '00:00';
    const buttons = document.createElement('div');
    buttons.className = 'kaltest-brique-chrono-buttons';
    const start = document.createElement('button');
    start.type = 'button';
    start.id = 'startBtn';
    start.className = 'seb-action-btn seb-btn-timer-start';
    start.textContent = 'Démarrer le compteur';
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.id = 'stopBtn';
    stop.className = 'seb-action-btn seb-btn-timer-stop';
    stop.textContent = 'Arrêter le compteur';
    stop.disabled = true;
    buttons.append(start, stop);
    chronoCard.append(chronoTitle, display, buttons);
    right.appendChild(chronoCard);

    const fieldsCard = document.createElement('div');
    fieldsCard.className = 'kaltest-brique-control-card kaltest-brique-measures';
    function measure(labelText, value, readOnly) {
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = labelText;
      const input = document.createElement('input');
      input.type = readOnly ? 'text' : 'number';
      input.value = value;
      input.readOnly = Boolean(readOnly);
      if (!readOnly) {
        input.min = String(definition.errorMin ?? 0);
        // Les erreurs sont un entier positif sans plafond artificiel.
        input.step = '1';
      }
      label.append(span, input);
      fieldsCard.appendChild(label);
      return input;
    }
    const minuteInput = measure('Minutes', String(Math.floor((Number(brique.chronoSeconds)||0)/60)), true);
    const secondInput = measure('Secondes', String((Number(brique.chronoSeconds)||0)%60), true);
    const errorInput = measure('Nombre d’erreur(s)', brique.errors===null||brique.errors===undefined?'':String(brique.errors), false);
    errorInput.id = 'nivDiff';
    errorInput.inputMode = 'numeric';
    errorInput.disabled = testState.status === 'COMPLETED';
    right.appendChild(fieldsCard);

    const adminCard = document.createElement('div');
    adminCard.className = 'kaltest-brique-control-card kaltest-brique-admin';
    const adminTitle = document.createElement('h3');
    adminTitle.textContent = 'Déblocage administrateur';
    const adminHelp = document.createElement('p');
    adminHelp.textContent = test.adminIntervention?.instructions || 'L’administrateur valide l’exercice après évaluation du modèle.';
    const codeLabel = document.createElement('label');
    codeLabel.className = 'kaltest-brique-code';
    const codeText = document.createElement('span');
    codeText.textContent = 'Code administrateur :';
    const code = document.createElement('input');
    code.type = 'password';
    code.id = 'secretCode';
    code.maxLength = 10;
    code.autocomplete = 'off';
    code.spellcheck = false;
    code.placeholder = 'Code';
    code.disabled = testState.status === 'COMPLETED' || brique.adminValidated;
    codeLabel.append(codeText, code);
    const adminValidate = document.createElement('button');
    adminValidate.type = 'button';
    adminValidate.id = 'validBtn';
    adminValidate.className = 'seb-action-btn seb-btn-nav';
    adminValidate.textContent = brique.adminValidated ? 'Validation administrateur ✓' : 'Valider';
    adminValidate.disabled = testState.status === 'COMPLETED' || brique.adminValidated;
    const adminStatus = document.createElement('div');
    adminStatus.className = 'kaltest-brique-admin-status';
    adminCard.append(adminTitle, adminHelp, codeLabel, adminValidate, adminStatus);
    right.appendChild(adminCard);

    function formatLegacyTime() {
      const seconds = Math.max(0, Math.floor(Number(brique.chronoSeconds)||0));
      return String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
    }
    function syncCheckpoint() {
      sessionStorage.setItem('seb_evalpro_brique_checkpoint', JSON.stringify({
        chronoSeconds:Math.max(0,Math.floor(Number(brique.chronoSeconds)||0)),
        savedAt:Date.now()
      }));
    }
    function refreshMeasures() {
      const seconds = Math.max(0,Math.floor(Number(brique.chronoSeconds)||0));
      display.textContent = window.KaloneoChrono?.format?.(seconds) || formatLegacyTime();
      minuteInput.value = String(Math.floor(seconds/60));
      secondInput.value = String(seconds%60);
    }
    function refreshNext() {
      const next = document.getElementById('kaltest-next');
      const ready = Boolean(brique.adminValidated && brique.autoValidated);
      if (ready) testState.answers.brique_ready = '1';
      else delete testState.answers.brique_ready;
      if (next) {
        next.disabled = !ready && testState.status !== 'COMPLETED';
        next.classList.toggle('seb-exercise-nav-locked', !ready && testState.status !== 'COMPLETED');
      }
    }
    function saveLegacyMain() {
      sessionStorage.setItem('eval_brique', JSON.stringify({
        temps:formatLegacyTime(),
        niveau:brique.errors===null||brique.errors===undefined?'':String(brique.errors),
        code:brique.adminValidated?'svg56':''
      }));
      syncCheckpoint();
    }

    errorInput.addEventListener('input', () => {
      const raw = String(errorInput.value || '').trim();
      // 125, 999, etc. doivent être conservés, pas rejetés à 99.
      const errors = Number(raw);
      brique.errors = /^\d+$/.test(raw) && Number.isSafeInteger(errors) ? errors : null;
      brique.adminValidated = false;
      brique.autoValidated = false;
      delete testState.answers.brique_ready;
      code.disabled = false;
      adminValidate.disabled = false;
      adminValidate.textContent = 'Valider';
      adminStatus.textContent = '';
      refreshNext();
      persist();
    });

    if (!window.KaloneoChrono?.create) throw new Error('Chronomètre commun KALONÉO indisponible.');
    activeBriqueChrono = window.KaloneoChrono.create({
      startButton:start,
      stopButton:stop,
      initialSeconds:Number(brique.chronoSeconds)||0,
      resetOnStart:false,
      intervalMs:250,
      bindButtons:false,
      onRender(seconds, formatted) {
        brique.chronoSeconds = seconds;
        display.textContent = formatted;
        minuteInput.value = String(Math.floor(seconds/60));
        secondInput.value = String(seconds%60);
      },
      onTick(seconds) {
        brique.chronoSeconds = seconds;
        if (Math.floor(seconds)%1===0) {
          syncCheckpoint();
          persist();
        }
      },
      onStop(seconds) {
        brique.chronoSeconds = seconds;
        refreshMeasures();
        syncCheckpoint();
        persist();
      }
    });
    start.addEventListener('click', () => {
      if (testState.status === 'COMPLETED' || brique.adminValidated) return;
      activeBriqueChrono.setSeconds(Number(brique.chronoSeconds)||0);
      if (activeBriqueChrono.start()) {
        start.disabled = true;
        stop.disabled = false;
      }
    });
    stop.addEventListener('click', () => {
      if (!activeBriqueChrono?.isRunning?.()) return;
      activeBriqueChrono.stop();
      start.disabled = false;
      stop.disabled = true;
      errorInput.focus();
    });

    adminValidate.addEventListener('click', () => {
      const rawCode = String(code.value || '').trim().toLowerCase();
      if (rawCode !== 'svg56') {
        adminStatus.textContent = rawCode.length >= 5 ? 'Code incorrect !' : 'Saisissez le code administrateur.';
        code.focus();
        return;
      }
      if (brique.errors === null || brique.errors === undefined) {
        adminStatus.textContent = 'Code correct — renseignez le nombre d’erreurs.';
        errorInput.focus();
        return;
      }
      brique.adminValidated = true;
      saveLegacyMain();
      adminStatus.textContent = 'Validation administrateur enregistrée.';
      code.disabled = true;
      adminValidate.disabled = true;
      adminValidate.textContent = 'Validation administrateur ✓';
      left.replaceChildren(autoCard);
      autoCard.hidden = false;
      persist();
    });

    autoValidate.addEventListener('click', () => {
      brique.autoSelections = Array.from(autoCard.querySelectorAll('.kaltest-brique-auto-choice input:checked')).map(input=>input.value);
      brique.commentaire = String(comment.value || '').trim();
      brique.autoValidated = true;
      testState.answers.brique_ready = '1';
      sessionStorage.setItem('eval_brique_auto', JSON.stringify({
        choix:brique.autoSelections.slice(),
        commentaire:brique.commentaire
      }));
      saveLegacyMain();
      autoValidate.textContent = 'Autoévaluation validée ✓';
      autoValidate.disabled = true;
      refreshNext();
      persist();
      document.getElementById('kaltest-next')?.focus();
    });

    if (testState.status === 'COMPLETED') {
      start.disabled = true;
      stop.disabled = true;
      errorInput.disabled = true;
      code.disabled = true;
      adminValidate.disabled = true;
      autoValidate.disabled = true;
      left.replaceChildren(autoCard);
      autoCard.hidden = false;
    } else {
      refreshMeasures();
      refreshNext();
      if (brique.adminValidated) {
        left.replaceChildren(autoCard);
        autoCard.hidden = false;
        code.disabled = true;
        adminValidate.disabled = true;
        adminValidate.textContent = 'Validation administrateur ✓';
      }
    }

    shell.append(left,right);
    host.appendChild(shell);
    return true;
  }

  function renderEndPage(test, host) {
    const definition = test.presentation?.endPage;
    if (!definition) return false;
    document.body.classList.add('seb-kaltest-terminal');
    const next = document.getElementById('kaltest-next');
    if (next) next.hidden = true;
    const calculator = document.getElementById('kaltest-calculator');
    if (calculator) calculator.hidden = true;

    const wrap = document.createElement('div');
    wrap.className = 'kaltest-terminal-page';
    const title = document.createElement('div');
    title.className = 'kaltest-terminal-title';
    if (definition.image) {
      const img = document.createElement('img');
      img.src = definition.image;
      img.alt = 'Avatar';
      title.appendChild(img);
    }
    const heading = document.createElement('h2');
    heading.textContent = definition.heading || 'Félicitations pour votre parcours !';
    title.appendChild(heading);
    wrap.appendChild(title);

    for (const paragraph of definition.paragraphs || []) {
      const p = document.createElement('p');
      p.textContent = paragraph;
      wrap.appendChild(p);
    }
    if (definition.endMessage) {
      const end = document.createElement('div');
      end.className = 'kaltest-terminal-message';
      end.textContent = definition.endMessage;
      wrap.appendChild(end);
    }
    host.appendChild(wrap);

    const testState = testStateFor(test);
    testState.status = 'COMPLETED';
    testState.answers.final_seen = '1';
    testState.result = {score:0,scoreMax:0,percentage:0,details:{},status:'completed'};
    sessionStorage.setItem('seb_kaltest_parcours_finished','1');
    persist();
    try { window.sebEvalPro?.save?.(); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('seb-kaltest-final', { detail:{ testId:test.id, terminal:true } })); } catch (_) {}
    return true;
  }

  function renderTri(test, host) {
    const definition = test.presentation?.triStation;
    if (!definition) return false;
    const testState = testStateFor(test);
    const maxTris = Number(definition.maxTris) || 5;
    const minTris = Number(definition.minTris) || 3;
    if (!testState.tri || !Array.isArray(testState.tri.rows)) {
      testState.tri = {
        rows:Array.from({length:maxTris},()=>({seconds:null,errors:null})),
        autoSelections:[],
        commentaire:'',
        resultsShown:false,
        ready:false,
        currentTri:1,
        awaitingError:null,
        liveSeconds:0
      };
    }
    const tri = testState.tri;
    while (tri.rows.length < maxTris) tri.rows.push({seconds:null,errors:null});
    if (activeTriChrono?.destroy) {
      try { activeTriChrono.destroy(); } catch (_) {}
      activeTriChrono = null;
    }

    const shell = document.createElement('div');
    shell.className = 'kaltest-tri-layout';

    const left = document.createElement('section');
    left.className = 'kaltest-tri-left';

    const guide = document.createElement('div');
    guide.className = 'kaltest-tri-guide';
    guide.hidden = Boolean(tri.resultsShown || testState.status === 'COMPLETED');
    guide.innerHTML = '<h3>Comment ça fonctionne ?</h3><ul>' +
      '<li>Démarrez le compteur au moment où vous commencez un tri.</li>' +
      '<li>Arrêtez-le lorsque le tri est terminé : Minutes et Secondes sont remplis automatiquement.</li>' +
      '<li>Saisissez ensuite le nombre d’erreurs, même s’il est égal à <strong>0</strong>.</li>' +
      '<li>Le compteur revient ensuite à <strong>00:00</strong>.</li>' +
      '<li>Effectuez entre <strong>3 et 5 tris</strong>.</li>' +
      '<li>À partir de 3 tris complets, affichez les résultats puis complétez l’autoévaluation.</li>' +
      '</ul>';
    left.appendChild(guide);

    const auto = document.createElement('div');
    auto.className = 'kaltest-tri-autoeval';
    auto.hidden = !tri.resultsShown;
    const autoTitle = document.createElement('h3');
    autoTitle.textContent = 'Autoévaluation personnelle';
    const autoIntro = document.createElement('p');
    autoIntro.textContent = 'Cochez les affirmations qui correspondent le mieux à votre expérience pendant cette activité.';
    auto.append(autoTitle, autoIntro);

    const selected = new Set(Array.isArray(tri.autoSelections) ? tri.autoSelections.map(String) : []);
    for (const item of definition.autoStatements || []) {
      const label = document.createElement('label');
      label.className = 'kaltest-tri-auto-choice';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(item.value);
      checkbox.checked = selected.has(String(item.value));
      checkbox.disabled = testState.status === 'COMPLETED';
      checkbox.addEventListener('change', () => {
        const values = Array.from(auto.querySelectorAll('.kaltest-tri-auto-choice input:checked')).map(input=>input.value);
        tri.autoSelections = values;
        tri.ready = false;
        refreshReady();
        persist();
      });
      label.append(checkbox, document.createTextNode(' ' + item.label));
      auto.appendChild(label);
    }

    const commentLabel = document.createElement('label');
    commentLabel.className = 'kaltest-tri-comment';
    commentLabel.appendChild(document.createTextNode('Commentaire :'));
    const comment = document.createElement('textarea');
    comment.rows = 4;
    comment.value = String(tri.commentaire || '');
    comment.disabled = testState.status === 'COMPLETED';
    comment.addEventListener('input', () => {
      tri.commentaire = comment.value;
      tri.ready = false;
      refreshReady();
      persist();
    });
    commentLabel.appendChild(comment);
    auto.appendChild(commentLabel);

    const autoValidate = document.createElement('button');
    autoValidate.type = 'button';
    autoValidate.className = 'seb-action-btn seb-btn-nav kaltest-tri-auto-validate';
    autoValidate.textContent = tri.ready ? 'Autoévaluation validée ✓' : 'Valider mon autoévaluation';
    autoValidate.disabled = testState.status === 'COMPLETED' || tri.ready;
    auto.appendChild(autoValidate);
    left.appendChild(auto);

    const right = document.createElement('section');
    right.className = 'kaltest-tri-right';

    const chronoCard = document.createElement('div');
    chronoCard.className = 'kaltest-tri-chrono-card';
    const display = document.createElement('div');
    display.className = 'seb-chrono-display kaltest-tri-display';
    display.textContent = window.KaloneoChrono?.format?.(Number(tri.liveSeconds)||0) || '00:00';
    const chronoButtons = document.createElement('div');
    chronoButtons.className = 'kaltest-tri-chrono-buttons';
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'seb-action-btn seb-btn-timer-start';
    start.textContent = 'Démarrer le compteur';
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'seb-action-btn seb-btn-timer-stop';
    stop.textContent = 'Arrêter le compteur';
    chronoButtons.append(start, stop);
    chronoCard.append(display, chronoButtons);
    right.appendChild(chronoCard);

    const table = document.createElement('div');
    table.className = 'kaltest-tri-table';
    const head = document.createElement('div');
    head.className = 'kaltest-tri-row head';
    for (const value of ['Tri n°','Minutes','Secondes','Erreurs']) {
      const span = document.createElement('span');
      span.textContent = value;
      head.appendChild(span);
    }
    table.appendChild(head);

    const errorInputs = [];
    for (let index=0; index<maxTris; index+=1) {
      const row = document.createElement('div');
      row.className = 'kaltest-tri-row';
      const number = document.createElement('span');
      number.textContent = String(index+1);
      const min = document.createElement('input');
      min.type = 'text';
      min.readOnly = true;
      min.value = tri.rows[index].seconds === null ? '' : String(Math.floor((Number(tri.rows[index].seconds)||0)/60));
      const sec = document.createElement('input');
      sec.type = 'text';
      sec.readOnly = true;
      sec.value = tri.rows[index].seconds === null ? '' : String((Number(tri.rows[index].seconds)||0)%60);
      const err = document.createElement('input');
      err.type = 'number';
      err.min = '0';
      err.inputMode = 'numeric';
      err.step = '1';
      err.value = tri.rows[index].errors === null || tri.rows[index].errors === undefined ? '' : String(tri.rows[index].errors);
      err.disabled = testState.status === 'COMPLETED';
      err.dataset.triError = String(index+1);
      // Une frappe n'est pas une validation : ne jamais remettre le chrono
      // a zero ou sortir du champ pendant la saisie de plusieurs chiffres.
      const validateTriErrors = () => {
        const raw = String(err.value || '').trim();
        if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
          tri.rows[index].errors = null;
          tri.ready = false;
          refreshResultsButton();
          refreshReady();
          persist();
          return;
        }
        tri.rows[index].errors = Math.max(0, Math.floor(Number(raw)));
        if (tri.rows[index].seconds !== null && Number(tri.awaitingError) === index+1) {
          tri.awaitingError = null;
          tri.currentTri = Math.min(maxTris+1,index+2);
          tri.liveSeconds = 0;
          activeTriChrono?.setSeconds?.(0);
          display.textContent = '00:00';
          start.disabled = Number(tri.currentTri) > maxTris;
          stop.disabled = true;
        }
        tri.ready = false;
        refreshResultsButton();
        refreshReady();
        persist();
      };
      err.addEventListener('input', () => {
        // En cours de frappe : conserver le focus ET le chrono affiche.
        tri.ready = false;
        refreshResultsButton();
        refreshReady();
      });
      err.addEventListener('change', validateTriErrors);
      err.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const confirmingCurrentTri = Number(tri.awaitingError) === index + 1;
          validateTriErrors();
          // Apres validation, sortir du champ : prochain chrono (ou resultats au 5e tri).
          // Ne jamais deplacer le focus lors de la frappe des chiffres ni au clic hors champ.
          if (confirmingCurrentTri && tri.awaitingError === null) {
            if (!start.disabled) start.focus();
            else if (!resultsButton.disabled) resultsButton.focus();
          }
        }
      });
      errorInputs.push(err);
      row.append(number,min,sec,err);
      table.appendChild(row);
    }
    right.appendChild(table);

    const resultsButton = document.createElement('button');
    resultsButton.type = 'button';
    resultsButton.className = 'kaltest-tri-results-button';
    resultsButton.textContent = 'Voir les résultats';
    right.appendChild(resultsButton);

    const results = document.createElement('div');
    results.className = 'kaltest-tri-results';
    results.hidden = !tri.resultsShown;
    const averageLine = document.createElement('div');
    const errorsLine = document.createElement('div');
    results.append(averageLine,errorsLine);
    right.appendChild(results);

    function completedRows() {
      return tri.rows.slice(0,maxTris).filter(row =>
        row?.seconds !== null && row?.seconds !== undefined &&
        row?.errors !== null && row?.errors !== undefined &&
        String(row.errors).trim() !== ''
      );
    }
    function hasPartial() {
      return tri.rows.slice(0,maxTris).some(row => {
        const hasTime = row?.seconds !== null && row?.seconds !== undefined;
        const hasErrors = row?.errors !== null && row?.errors !== undefined && String(row.errors).trim() !== '';
        return hasTime !== hasErrors;
      });
    }
    function stats() {
      const rows = completedRows();
      const totalSeconds = rows.reduce((sum,row)=>sum+Math.max(0,Number(row.seconds)||0),0);
      const totalErrors = rows.reduce((sum,row)=>sum+Math.max(0,Number(row.errors)||0),0);
      const averageSeconds = rows.length ? Math.round(totalSeconds/rows.length) : 0;
      return {rows,totalSeconds,totalErrors,averageSeconds};
    }
    function format(seconds) {
      const value=Math.max(0,Math.floor(Number(seconds)||0));
      return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
    }
    function refreshResults() {
      const value=stats();
      averageLine.innerHTML='<strong>Moyenne :</strong> '+format(value.averageSeconds);
      errorsLine.innerHTML='<strong>Total d’erreurs :</strong> '+value.totalErrors;
    }
    function canShowResults() {
      return completedRows().length >= minTris && !hasPartial() && !activeTriChrono?.isRunning?.() && tri.awaitingError === null;
    }
    function autoAnswered() {
      return (Array.isArray(tri.autoSelections)&&tri.autoSelections.length>0) || String(tri.commentaire||'').trim()!=='';
    }
    function refreshResultsButton() {
      resultsButton.disabled = testState.status === 'COMPLETED' || !canShowResults();
    }
    function refreshReady() {
      const ready = Boolean(tri.ready && canShowResults() && autoAnswered());
      const next = document.getElementById('kaltest-next');
      if (next) {
        next.disabled = false;
        next.classList.remove('seb-exercise-nav-locked');
      }
      if (!ready) {
        delete testState.answers.tri_ready;
      } else {
        testState.answers.tri_ready = '1';
        testState.status = 'ACTIVE';
      }
    }

    resultsButton.addEventListener('click', () => {
      if (!canShowResults()) return;
      tri.resultsShown = true;
      guide.hidden = true;
      auto.hidden = false;
      results.hidden = false;
      refreshResults();
      persist();
    });
    autoValidate.addEventListener('click', () => {
      if (!canShowResults()) return;
      if (!autoAnswered()) {
        document.getElementById('exercise-status').textContent = 'Complétez l’autoévaluation avant de continuer.';
        return;
      }
      tri.ready = true;
      testState.answers.tri_ready = '1';
      testState.status = 'ACTIVE';
      autoValidate.textContent = 'Autoévaluation validée ✓';
      autoValidate.disabled = true;
      refreshReady();
      persist();
      document.getElementById('kaltest-next')?.focus();
    });

    if (!window.KaloneoChrono?.create) throw new Error('Compteur commun KALONÉO indisponible.');
    activeTriChrono = window.KaloneoChrono.create({
      startButton:start,
      stopButton:stop,
      initialSeconds:Number(tri.liveSeconds)||0,
      resetOnStart:false,
      intervalMs:250,
      bindButtons:false,
      onRender(seconds,formatted) {
        tri.liveSeconds = seconds;
        display.textContent = formatted;
      }
    });

    start.addEventListener('click', () => {
      if (testState.status === 'COMPLETED' || Number(tri.currentTri)>maxTris || tri.awaitingError!==null) {
        const target=errorInputs[Math.max(0,Number(tri.awaitingError||1)-1)];
        target?.focus();
        return;
      }
      activeTriChrono.setSeconds(Number(tri.liveSeconds)||0);
      if (activeTriChrono.start()) {
        start.disabled = true;
        stop.disabled = false;
        refreshResultsButton();
      }
    });
    stop.addEventListener('click', () => {
      if (!activeTriChrono?.isRunning?.()) return;
      activeTriChrono.stop();
      const seconds=activeTriChrono.getSeconds();
      const index=Math.max(1,Math.min(maxTris,Number(tri.currentTri)||1))-1;
      tri.rows[index].seconds=seconds;
      tri.awaitingError=index+1;
      tri.liveSeconds=seconds;
      const row=table.querySelectorAll('.kaltest-tri-row:not(.head)')[index];
      const fields=row?.querySelectorAll('input');
      if(fields?.[0])fields[0].value=String(Math.floor(seconds/60));
      if(fields?.[1])fields[1].value=String(seconds%60);
      start.disabled=true;
      stop.disabled=true;
      tri.ready=false;
      refreshResultsButton();
      refreshReady();
      persist();
      setTimeout(()=>errorInputs[index]?.focus(),0);
    });

    if (testState.status === 'COMPLETED') {
      start.disabled=true;stop.disabled=true;resultsButton.disabled=true;
      guide.hidden=true;auto.hidden=false;results.hidden=false;refreshResults();
      const next=document.getElementById('kaltest-next');if(next){next.disabled=false;next.classList.remove('seb-exercise-nav-locked');}
    } else {
      if (tri.awaitingError!==null) {start.disabled=true;stop.disabled=true;}
      else {start.disabled=Number(tri.currentTri)>maxTris;stop.disabled=true;}
      refreshResultsButton();
      if(tri.resultsShown){results.hidden=false;refreshResults();}
      refreshReady();
    }

    shell.append(left,right);
    host.appendChild(shell);
    return true;
  }

  function renderDictation(test, host) {
    const definition = test.presentation?.dictation;
    if (!definition || !definition.questionId) return false;
    const engine = window.sebKaltestDicteeEngine;
    if (!engine) throw new Error('Moteur Dictée KALTEST indisponible.');

    const testState = testStateFor(test);
    if (!testState.dictation) testState.dictation = { ecoutes:0, audioPosition:0 };
    const runtime = testState.dictation;
    const completed = testState.status === 'COMPLETED';

    const layout = document.createElement('div');
    layout.className = 'kaltest-dictee-layout';

    const player = document.createElement('section');
    player.className = 'kaltest-dictee-player';
    const playerTitle = document.createElement('h3');
    playerTitle.textContent = 'Écouter la dictée';
    const audio = document.createElement('audio');
    audio.src = definition.audio || '';
    audio.preload = 'auto';
    audio.playbackRate = 1;
    audio.defaultPlaybackRate = 1;

    const controls = document.createElement('div');
    controls.className = 'kaltest-dictee-controls';
    function control(label, action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      controls.appendChild(button);
      return button;
    }
    const play = control('▶ Lire / Reprendre', () => {
      audio.playbackRate = 1;
      const fromStart = (Number(audio.currentTime) || 0) < .35;
      const promise = audio.play();
      if (fromStart) {
        runtime.ecoutes = (Number(runtime.ecoutes) || 0) + 1;
        listen.textContent = String(runtime.ecoutes);
        persist();
      }
      if (promise?.catch) promise.catch(() => { audioStatus.textContent = "Impossible de démarrer l'audio."; });
    });
    control('⏸ Pause', () => { audio.pause(); });
    control('⏹ Stop', () => { audio.pause(); try { audio.currentTime = 0; } catch (_) {} });
    control('↺ Recommencer', () => {
      audio.pause();
      try { audio.currentTime = 0; } catch (_) {}
      audio.playbackRate = 1;
      const promise = audio.play();
      runtime.ecoutes = (Number(runtime.ecoutes) || 0) + 1;
      listen.textContent = String(runtime.ecoutes);
      persist();
      if (promise?.catch) promise.catch(() => { audioStatus.textContent = "Impossible de démarrer l'audio."; });
    });

    const progressRow = document.createElement('div');
    progressRow.className = 'kaltest-dictee-progress';
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.min = '0';
    progress.max = '1000';
    progress.value = '0';
    progress.setAttribute('aria-label', "Progression de l'enregistrement");
    const time = document.createElement('span');
    time.textContent = '00:00 / 00:00';
    progressRow.append(progress, time);

    const count = document.createElement('div');
    count.className = 'kaltest-dictee-listen-count';
    count.append('Nombre de lectures depuis le début : ');
    const listen = document.createElement('strong');
    listen.textContent = String(Number(runtime.ecoutes) || 0);
    count.appendChild(listen);
    const audioStatus = document.createElement('div');
    audioStatus.className = 'kaltest-dictee-audio-status';
    audioStatus.textContent = 'Prêt.';

    const formatTime = seconds => {
      const value = Math.max(0, Math.floor(Number(seconds) || 0));
      return String(Math.floor(value / 60)).padStart(2,'0') + ':' + String(value % 60).padStart(2,'0');
    };
    const updateAudio = () => {
      audio.playbackRate = 1;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      progress.value = duration > 0 ? String(Math.round((current / duration) * 1000)) : '0';
      time.textContent = formatTime(current) + ' / ' + formatTime(duration);
      runtime.audioPosition = current;
    };
    audio.addEventListener('loadedmetadata', () => {
      if (Number(runtime.audioPosition) > 0 && Number(runtime.audioPosition) < audio.duration) {
        try { audio.currentTime = Number(runtime.audioPosition); } catch (_) {}
      }
      updateAudio();
    });
    audio.addEventListener('timeupdate', () => {
      updateAudio();
      if (Math.floor(audio.currentTime) % 2 === 0) persist();
    });
    audio.addEventListener('ratechange', () => { if (audio.playbackRate !== 1) audio.playbackRate = 1; });
    audio.addEventListener('play', () => { audioStatus.textContent = 'Lecture en cours…'; });
    audio.addEventListener('pause', () => {
      if (!audio.ended) audioStatus.textContent = audio.currentTime > 0 ? 'Lecture en pause.' : 'Prêt.';
      updateAudio();
      persist();
    });
    audio.addEventListener('ended', () => { audioStatus.textContent = 'Lecture terminée.'; updateAudio(); persist(); });
    progress.addEventListener('input', () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (duration > 0) audio.currentTime = (Number(progress.value) / 1000) * duration;
      updateAudio();
      persist();
    });

    player.append(playerTitle, audio, controls, progressRow, count, audioStatus);

    const writing = document.createElement('section');
    writing.className = 'kaltest-dictee-writing';
    const writingTitle = document.createElement('h3');
    writingTitle.textContent = 'Votre texte';
    const textarea = document.createElement('textarea');
    textarea.className = 'step';
    textarea.spellcheck = false;
    textarea.autocomplete = 'off';
    textarea.placeholder = 'Tapez ici le texte que vous entendez…';
    textarea.value = String(testState.answers?.[definition.questionId] ?? '');
    const counter = document.createElement('div');
    counter.className = 'kaltest-dictee-counter';
    const refreshCount = () => { counter.textContent = engine.tokens(textarea.value).length + ' mot(s) saisi(s)'; };
    textarea.addEventListener('input', () => {
      if (testState.status === 'COMPLETED') {
        testState.answers[definition.questionId] = textarea.value;
        persist();
      } else {
        saveAnswer(test, definition.questionId, textarea.value);
      }
      refreshCount();
    });
    refreshCount();

    if (completed) {
      const info = document.createElement('div');
      info.className = 'kaltest-dictee-validated';
      info.textContent = 'Dictée enregistrée. Vous pouvez encore corriger votre texte avant de cliquer sur « Suivant ».';
      writing.append(writingTitle, textarea, counter, info);
    } else {
      writing.append(writingTitle, textarea, counter);
    }

    layout.append(player, writing);
    host.appendChild(layout);
    requestAnimationFrame(() => { if (!textarea.value) textarea.focus(); });
    return true;
  }

  function renderMail(test, host) {
    const definition = test.presentation?.mailComposer;
    if (!definition || !definition.fields) return false;
    const testState = testStateFor(test);
    const fields = definition.fields;
    const completed = testState.status === 'COMPLETED';

    const layout = document.createElement('div');
    layout.className = 'kaltest-mail-layout';

    const left = document.createElement('section');
    left.className = 'kaltest-mail-instructions';
    const heading = document.createElement('h3');
    heading.textContent = 'Consignes';
    left.appendChild(heading);
    const list = document.createElement('div');
    list.className = 'kaltest-mail-instruction-list';
    for (const line of definition.instructions || []) {
      const p = document.createElement('p');
      p.textContent = line;
      list.appendChild(p);
    }
    left.appendChild(list);

    const form = document.createElement('section');
    form.className = 'kaltest-mail-composer';
    const title = document.createElement('h3');
    title.textContent = 'Nouveau message ✉';
    form.appendChild(title);

    function textField(labelText, questionId) {
      const label = document.createElement('label');
      label.className = 'kaltest-mail-field';
      const span = document.createElement('span');
      span.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'step';
      input.dataset.questionId = questionId;
      input.value = String(testState.answers?.[questionId] ?? '');
      input.disabled = completed;
      input.addEventListener('input', () => saveAnswer(test, questionId, input.value));
      label.append(span, input);
      form.appendChild(label);
      return input;
    }

    textField('À :', fields.to);
    textField('Cc :', fields.cc);
    textField('Objet :', fields.subject);

    const messageLabel = document.createElement('label');
    messageLabel.className = 'kaltest-mail-field kaltest-mail-message';
    const messageTitle = document.createElement('span');
    messageTitle.textContent = 'Message :';
    const textarea = document.createElement('textarea');
    textarea.className = 'step';
    textarea.rows = 7;
    textarea.disabled = completed;
    textarea.value = String(testState.answers?.[fields.signature] ?? testState.answers?.[fields.phone] ?? '');
    textarea.addEventListener('input', () => {
      saveAnswer(test, fields.signature, textarea.value);
      saveAnswer(test, fields.phone, textarea.value);
    });
    messageLabel.append(messageTitle, textarea);
    form.appendChild(messageLabel);

    const attachment = document.createElement('div');
    attachment.className = 'kaltest-mail-attachment';
    const attachmentLabel = document.createElement('strong');
    attachmentLabel.textContent = 'Pièce jointe :';
    const browse = document.createElement('button');
    browse.type = 'button';
    browse.className = 'kaltest-mail-browse';
    browse.textContent = '📂 Parcourir…';
    browse.disabled = completed;
    const selected = document.createElement('span');
    selected.className = 'kaltest-mail-selected';
    selected.textContent = String(testState.answers?.[fields.file] || 'Aucun fichier sélectionné');
    attachment.append(attachmentLabel, browse, selected);
    form.appendChild(attachment);

    const overlay = document.createElement('div');
    overlay.className = 'kaltest-mail-overlay';
    overlay.hidden = true;
    const modal = document.createElement('div');
    modal.className = 'kaltest-mail-modal';
    const modalTitle = document.createElement('h3');
    modalTitle.textContent = 'Sélectionnez un fichier';
    modal.appendChild(modalTitle);
    for (const file of definition.files || []) {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.textContent = '📄 ' + file;
      choice.addEventListener('click', () => {
        saveAnswer(test, fields.file, String(file));
        selected.textContent = String(file);
        overlay.hidden = true;
      });
      modal.appendChild(choice);
    }
    overlay.appendChild(modal);
    browse.addEventListener('click', () => { overlay.hidden = false; });
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.hidden = true; });
    layout.append(left, form, overlay);
    host.appendChild(layout);
    return true;
  }

  function renderStock(test, host, options = {}) {
    if (!options.force && (test.presentation?.builderContent || []).some(item => item?.type === 'html-js' && item?.preset === 'stock-legacy-v1')) return false;
    const definition = test.presentation?.stockBoard;
    if (!definition || !Array.isArray(definition.pots) || !Array.isArray(definition.shelves)) return false;

    const testState = testStateFor(test);
    const completed = testState.status === 'COMPLETED';
    const shell = document.createElement('div');
    shell.className = 'kaltest-stock-layout';

    const left = document.createElement('section');
    left.className = 'kaltest-stock-left';

    const sourceCard = document.createElement('div');
    sourceCard.className = 'kaltest-stock-zone';
    const sourceTitle = document.createElement('h3');
    sourceTitle.textContent = 'Pots à ranger';
    const source = document.createElement('div');
    source.className = 'kaltest-stock-pots';
    source.dataset.stockDrop = 'source';
    sourceCard.append(sourceTitle, source);

    const triCard = document.createElement('div');
    triCard.className = 'kaltest-stock-zone';
    const triTitle = document.createElement('h3');
    triTitle.textContent = 'Zone de tri';
    const tri = document.createElement('div');
    tri.className = 'kaltest-stock-pots kaltest-stock-tri';
    tri.dataset.stockDrop = 'tri';
    triCard.append(triTitle, tri);
    left.append(sourceCard, triCard);

    const shelves = document.createElement('section');
    shelves.className = 'kaltest-stock-shelves';

    const caseByValue = new Map();
    for (const shelf of definition.shelves) {
      const shelfNode = document.createElement('div');
      shelfNode.className = 'kaltest-stock-shelf shelf-' + shelf.id;
      const title = document.createElement('div');
      title.className = 'kaltest-stock-shelf-title';
      title.textContent = shelf.title || ('Casier ' + shelf.id);
      shelfNode.appendChild(title);

      for (const level of shelf.levels || []) {
        const levelNode = document.createElement('div');
        levelNode.className = 'kaltest-stock-level';
        const label = document.createElement('div');
        label.className = 'kaltest-stock-level-label';
        label.textContent = level.label || '';
        const cases = document.createElement('div');
        cases.className = 'kaltest-stock-cases';

        for (let index = 1; index <= Number(level.cases || 0); index += 1) {
          const value = 'case:' + shelf.id + ':' + level.id + ':' + index;
          const cell = document.createElement('div');
          cell.className = 'kaltest-stock-case';
          cell.dataset.stockDrop = value;
          cell.dataset.stockCase = value;
          cases.appendChild(cell);
          caseByValue.set(value, cell);
        }
        levelNode.append(label, cases);
        shelfNode.appendChild(levelNode);
      }
      shelves.appendChild(shelfNode);
    }

    function potNode(pot) {
      const node = document.createElement('div');
      node.className = 'kaltest-stock-pot';
      node.dataset.potId = String(pot.id);
      node.dataset.questionId = pot.questionId || '';
      node.draggable = !completed && !pot.example;
      node.style.backgroundImage = 'url("flacon/flacon_' + String(pot.color || '') + '.png")';

      const code = document.createElement('strong');
      code.textContent = String(pot.code || '');
      const pct = document.createElement('span');
      pct.textContent = String(pot.percentage ?? '') + '%';
      node.append(code, pct);

      if (pot.example) {
        node.classList.add('example');
        node.setAttribute('aria-label', 'Exemple ' + code.textContent + ' ' + pct.textContent);
      } else if (completed && showCorrectionDuringParcours(test)) {
        const detail = testState.result?.details?.[pot.questionId];
        node.classList.add(detail?.correct ? 'correct' : 'incorrect');
      }
      return node;
    }

    const nodes = new Map();
    for (const pot of definition.pots) nodes.set(String(pot.id), potNode(pot));

    const exampleId = String(definition.examplePotId ?? '');
    for (const pot of definition.pots) {
      const id = String(pot.id);
      const node = nodes.get(id);
      if (!node) continue;

      if (id === exampleId) {
        const target = caseByValue.get(String(definition.examplePlacement || ''));
        (target || source).appendChild(node);
        continue;
      }

      const answer = String(testState.answers?.[pot.questionId] ?? '');
      if (answer.startsWith('case:')) {
        const target = caseByValue.get(answer);
        if (target && !target.querySelector('.kaltest-stock-pot')) target.appendChild(node);
        else source.appendChild(node);
      } else if (answer === 'tri') {
        tri.appendChild(node);
      } else {
        source.appendChild(node);
      }
    }

    function move(node, destination) {
      if (!node || completed || node.classList.contains('example')) return false;
      const questionId = node.dataset.questionId;
      if (!questionId) return false;
      if (destination.startsWith('case:')) {
        const cell = caseByValue.get(destination);
        if (!cell || cell.querySelector('.kaltest-stock-pot')) return false;
        cell.appendChild(node);
      } else if (destination === 'tri') {
        tri.appendChild(node);
      } else {
        source.appendChild(node);
        destination = 'source';
      }
      saveAnswer(test, questionId, destination);
      return true;
    }

    if (!completed) {
      shell.addEventListener('dragstart', event => {
        const node = event.target?.closest?.('.kaltest-stock-pot');
        if (!node || node.classList.contains('example')) return;
        event.dataTransfer?.setData('text/plain', node.dataset.potId || '');
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        node.classList.add('dragging');
      });
      shell.addEventListener('dragend', event => {
        event.target?.closest?.('.kaltest-stock-pot')?.classList.remove('dragging');
      });
      shell.addEventListener('dragover', event => {
        const target = event.target?.closest?.('[data-stock-drop]');
        if (!target) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });
      shell.addEventListener('drop', event => {
        const target = event.target?.closest?.('[data-stock-drop]');
        if (!target) return;
        event.preventDefault();
        const id = event.dataTransfer?.getData('text/plain') || '';
        const node = nodes.get(String(id));
        move(node, String(target.dataset.stockDrop || 'source'));
      });
    }

    shell.append(left, shelves);
    host.appendChild(shell);
    return true;
  }

  function renderPlanning(test, host) {
    const definition = test.presentation?.planningGrid;
    if (!definition || !Array.isArray(definition.rows)) return false;

    const layout = document.createElement('div');
    layout.className = 'kaltest-planning-layout';
    if (definition.backgroundImage) layout.style.setProperty('--kaltest-planning-bg', 'url("' + definition.backgroundImage + '")');

    const work = document.createElement('section');
    work.className = 'kaltest-planning-work';

    const table = document.createElement('table');
    table.className = 'kaltest-table kaltest-planning-table';
    const thead = document.createElement('thead');
    const head = document.createElement('tr');
    for (const header of definition.headers || []) {
      const th = document.createElement('th');
      th.textContent = header;
      head.appendChild(th);
    }
    thead.appendChild(head);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const testState = testStateFor(test);
    for (const rowDefinition of definition.rows) {
      const tr = document.createElement('tr');
      const label = document.createElement('th');
      label.textContent = rowDefinition.label || '';
      tr.appendChild(label);
      for (const questionId of rowDefinition.questionIds || []) {
        const td = document.createElement('td');
        const question = questionById(test, questionId);
        if (question) {
          const input = makeInput(test, question, { compact:true });
          if (testState.status === 'COMPLETED') {
            input.disabled = true;
            if (showCorrectionDuringParcours(test)) {
              const detail = testState.result?.details?.[question.id];
              td.classList.add(detail?.correct ? 'kaltest-answer-correct' : 'kaltest-answer-incorrect');
            }
          }
          td.appendChild(input);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    work.appendChild(table);

    const lists = document.createElement('div');
    lists.className = 'kaltest-planning-lists';
    const dish = document.createElement('p');
    dish.innerHTML = '<strong>Liste des plats :</strong> ' + (definition.dishList || []).join(', ');
    const dessert = document.createElement('p');
    dessert.innerHTML = '<strong>Liste des desserts :</strong> ' + (definition.dessertList || []).join(', ');
    lists.append(dish, dessert);
    work.appendChild(lists);

    const guide = document.createElement('aside');
    guide.className = 'kaltest-planning-guide';
    const title = document.createElement('h3');
    title.textContent = 'Indications';
    guide.appendChild(title);
    const ol = document.createElement('ol');
    for (const item of definition.guide || []) {
      const li = document.createElement('li');
      li.textContent = item;
      ol.appendChild(li);
    }
    guide.appendChild(ol);

    layout.append(work, guide);
    host.appendChild(layout);
    return true;
  }

  function installFractionCloud(test,question,items){
    return window.KaloneoSharedPresentation.installFractionCloud(items,{
      getSaved:()=>testStateFor(test).fractionCloudPositions?.[question.id],
      setSaved:positions=>{
        const testState=testStateFor(test);
        if(!testState.fractionCloudPositions||typeof testState.fractionCloudPositions!=='object')
          testState.fractionCloudPositions={};
        testState.fractionCloudPositions[question.id]=positions;
        persist();
      }
    });
  }

  function renderFractions(test, host) {
    const definition = test.presentation?.fractionSelection;
    if (!definition || !Array.isArray(definition.groups)) return false;

    const layout = document.createElement('div');
    layout.className = 'kaltest-fractions-layout';
    layout.appendChild(renderVisualPanel(definition.visual || {}));

    const work = document.createElement('section');
    work.className = 'kaltest-fractions-work';
    const testState = testStateFor(test);
    const cloudLayouts = [];

    for (const group of definition.groups) {
      const question = questionById(test, group.questionId);
      if (!question) continue;
      const row = document.createElement('section');
      row.className = 'kaltest-fraction-row';
      row.dataset.questionId = question.id;

      const title = document.createElement('div');
      title.className = 'kaltest-fraction-title';
      const label = document.createElement('strong');
      label.textContent = group.label || question.prompt || '';
      title.appendChild(label);
      if (group.itemImage) {
        const icon = document.createElement('img');
        icon.src = group.itemImage;
        icon.alt = '';
        title.appendChild(icon);
      }

      const items = document.createElement('div');
      items.className = 'kaltest-fraction-items' + (group.cloud ? ' cloud' : '');
      if (group.cloud) {
        row.classList.add('cloud-row');
        items.dataset.cloud = 'true';
      }
      const selected = new Set(Array.isArray(testState.answers?.[question.id]) ? testState.answers[question.id].map(String) : []);
      const count = Math.max(1, Number(group.totalItems) || 1);
      for (let index = 1; index <= count; index += 1) {
        const value = String(index);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kaltest-fraction-item';
        button.setAttribute('aria-label', (group.label || 'Fraction') + ' — objet ' + index);
        button.setAttribute('aria-pressed', selected.has(value) ? 'true' : 'false');
        if (selected.has(value)) button.classList.add('selected');
        if (group.itemImage) button.style.backgroundImage = 'url("' + group.itemImage + '")';
        button.addEventListener('click', () => {
          const stateNow = testStateFor(test);
          const current = new Set(Array.isArray(stateNow.answers?.[question.id]) ? stateNow.answers[question.id].map(String) : []);
          if (current.has(value)) current.delete(value); else current.add(value);
          const active = current.has(value);
          button.classList.toggle('selected', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
          saveAnswer(test, question.id, Array.from(current));
        });
        items.appendChild(button);
      }
      row.append(title, items);
      work.appendChild(row);
      if (group.cloud) cloudLayouts.push({ question, items });
    }

    layout.appendChild(work);
    host.appendChild(layout);
    cloudLayouts.forEach(entry => installFractionCloud(test, entry.question, entry.items));
    return true;
  }

  function renderOrganisation(test, host) {
    const definition = test.presentation?.organisationList;
    if (!definition || !Array.isArray(definition.rows)) return false;

    const layout = document.createElement('div');
    layout.className = 'kaltest-organisation-layout';
    layout.appendChild(renderVisualPanel(definition.visual || {}));

    const work = document.createElement('section');
    work.className = 'kaltest-organisation-work';
    for (const rowDefinition of definition.rows) {
      const question = questionById(test, rowDefinition.questionId);
      if (!question) continue;
      const row = document.createElement('label');
      row.className = 'kaltest-organisation-row';
      const input = makeInput(test, question, { compact:true });
      input.maxLength = 1;
      input.inputMode = 'numeric';
      const text = document.createElement('span');
      text.textContent = rowDefinition.text || question.prompt || '';
      row.append(input, text);
      work.appendChild(row);
    }
    layout.appendChild(work);
    host.appendChild(layout);
    return true;
  }

  function renderPostures(test, host) {
    const definition = test.presentation?.postureSelection;
    if (!definition || !Array.isArray(definition.questionIds)) return false;

    const wrap = document.createElement('div');
    wrap.className = 'kaltest-postures-layout';

    if (definition.imageSrc) {
      const frame = document.createElement('div');
      frame.className = 'kaltest-postures-image';
      const img = document.createElement('img');
      img.src = definition.imageSrc;
      img.alt = definition.imageAlt || '';
      frame.appendChild(img);
      wrap.appendChild(frame);
    }

    const answers = document.createElement('div');
    answers.className = 'kaltest-postures-answers';
    definition.questionIds.forEach((questionId, index) => {
      const question = questionById(test, questionId);
      if (!question) return;
      const label = document.createElement('label');
      label.className = 'kaltest-postures-answer';
      const span = document.createElement('span');
      span.textContent = (definition.labels || [])[index] || question.prompt || '';
      const input = makeInput(test, question, { compact:true });
      input.maxLength = 1;
      input.inputMode = 'numeric';
      label.append(span, input);
      answers.appendChild(label);
    });
    wrap.appendChild(answers);
    host.appendChild(wrap);
    return true;
  }

  function renderTextEditorTool(test, item) {
    const config = Object.assign({fileSimulation:true,imageSimulation:true,scoringProfile:'none'}, item.config || {});
    const wrap = document.createElement('div');
    wrap.className = 'kaltest-text-editor-tool';
    wrap.dataset.scoringProfile = config.scoringProfile;

    // Groupes visuels uniquement : les IDs et le moteur Quill restent inchangés.
    wrap.innerHTML = `
      <div class="kaltest-word-ribbon">
        <div id="toolbar" class="kaltest-word-topbar kaltest-text-editor-toolbar">
          <div class="menu-container kaltest-word-file">
            <button id="nw-file-menu-button" type="button">📂 Fichier ▼</button>
            <div id="menu-fichier">
              <div id="nw-file-open">📂 Ouvrir</div>
              <div id="nw-file-save">💾 Enregistrer (.html)</div>
              <div id="nw-file-save-as">💾 Enregistrer sous...</div>
              <div id="nw-file-close">❌ Fermer</div>
            </div>
          </div>
          <div class="kaltest-word-clipboard">
            <button id="btn-cut" type="button" title="Couper">✂ Couper</button>
            <button id="btn-copy" type="button" title="Copier">▣ Copier</button>
            <button id="btn-paste" type="button" title="Coller">▤ Coller</button>
          </div>
          <div class="kaltest-word-group kaltest-word-font"><span class="kaltest-word-group-label">Police</span>
            <select id="nw-font" title="Changer la police"><option value="Arial">Arial</option><option value="Calibri" selected>Calibri</option><option value="Times New Roman">Times New Roman</option><option value="Courier New">Courier New</option><option value="Georgia">Georgia</option></select>
            <select id="nw-size" title="Taille du texte"><option value="10pt">10</option><option value="12pt">12</option><option value="14pt" selected>14</option><option value="16pt">16</option><option value="18pt">18</option><option value="24pt">24</option><option value="32pt">32</option><option value="48pt">48</option></select>
          </div>
          <div class="kaltest-word-end-fill" aria-hidden="true"></div>
        </div>
        <div class="toolbar-row2 kaltest-word-formatbar kaltest-text-editor-toolbar">
          <div class="kaltest-word-group kaltest-word-style"><span class="kaltest-word-group-label">Style</span>
            <button id="btn-bold" type="button" title="Gras"><b>G</b></button><button id="btn-italic" type="button" title="Italique"><i>I</i></button><button id="btn-underline" type="button" title="Souligné"><u>U</u></button>
            <div class="color-picker-container"><button id="nw-text-color-button" class="color-picker-btn" type="button" title="Couleur du texte"><span class="color-indicator" id="text-color-indicator"></span><strong>A</strong></button><div class="color-picker-menu" id="text-color-menu"><button type="button" class="color-swatch" data-seb-color-type="text" data-seb-color="#000000" title="Noir"></button><button type="button" class="color-swatch" data-seb-color-type="text" data-seb-color="#0000FF" title="Bleu"></button><button type="button" class="color-swatch" data-seb-color-type="text" data-seb-color="#FF0000" title="Rouge"></button><input type="color" id="custom-text-color" value="#000000" title="Couleur personnalisée"></div></div>
            <div class="color-picker-container"><button id="nw-highlight-color-button" class="color-picker-btn" type="button" title="Surlignage"><span class="color-indicator" id="highlight-color-indicator"></span>🖍</button><div class="color-picker-menu" id="highlight-color-menu"><button type="button" class="color-swatch" data-seb-color-type="highlight" data-seb-color="#FFFF00" title="Jaune"></button><button type="button" class="color-swatch" data-seb-color-type="highlight" data-seb-color="#90EE90" title="Vert"></button><input type="color" id="custom-highlight-color" value="#FFFF00" title="Surlignage personnalisé"></div></div>
          </div>
          <div class="kaltest-word-group kaltest-word-paragraph"><span class="kaltest-word-group-label">Paragraphe</span>
            <button id="btn-left" type="button" title="Aligner à gauche">☰</button><button id="btn-center" type="button" title="Centrer">≡</button><button id="btn-right" type="button" title="Aligner à droite">☷</button>
          </div>
          <div class="kaltest-word-group kaltest-word-lists"><span class="kaltest-word-group-label">Listes</span>
            <button id="btn-ul" type="button" title="Liste à puces">•</button><button id="btn-ol" type="button" title="Liste numérotée">1.</button>
          </div>
          <div class="kaltest-word-group kaltest-word-spacing"><span class="kaltest-word-group-label">Interligne</span>
            <select id="nw-line-height" title="Interligne"><option value="1">Simple</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">Double</option></select>
          </div>
          <div class="kaltest-word-group kaltest-word-insert"><span class="kaltest-word-group-label">Insérer</span><button id="nw-image-button" type="button" title="Insérer une image">🖼️</button></div>
          <div class="kaltest-word-end-fill" aria-hidden="true"></div>
        </div>
      </div>
      <div class="kaltest-word-paper-surface"><div id="editor" class="kaltest-text-editor-paper" spellcheck="false"></div></div>
    `;

    if (!config.fileSimulation) {
      wrap.querySelector('#nw-file-menu-button')?.remove();
      wrap.querySelector('#menu-fichier')?.remove();
    }
    if (!config.imageSimulation) wrap.querySelector('#nw-image-button')?.remove();

    setTimeout(() => {
      if (!wrap.isConnected) return;
      window.sebNwtexteContext = {
        storagePrefix:'seb_kaltest_editor:' + test.id + ':',
        legacyPage7:config.scoringProfile === 'seb-bureautique-v1'
      };
      if (!window.sebNwtexteEditor?.initialize?.()) {
        document.getElementById('exercise-status').textContent = 'Éditeur de texte indisponible.';
        return;
      }
      window.sebNwtextePage?.install?.();
      const testState = testStateFor(test);
      const root = wrap.querySelector('#editor .ql-editor');
      const sync = () => {
        testState.answers.text_editor_html = window.sebNwtexteEditor?.editorHtml?.() || '';
        testState.answers.text_editor_text = window.sebNwtexteEditor?.editorText?.() || '';
        if (testState.answers.text_editor_text.trim()) testState.status = 'ACTIVE';
        persist();
      };
      root?.addEventListener('input', sync);
      sync();
    });

    return wrap;
  }

  function stockPositionsFromKaltest(test, testState) {
    if (Array.isArray(testState?.legacyPositions) && testState.legacyPositions.length) {
      return testState.legacyPositions.map(item => ({ ...item }));
    }
    const definition = test.presentation?.stockBoard || {};
    const positions = [];
    for (const pot of definition.pots || []) {
      const id = String(pot.id);
      if (pot.example) {
        const parts = String(definition.examplePlacement || '').split(':');
        positions.push(parts[0] === 'case'
          ? { id, type:'case', etagere:parts[1] || '', niveau:parts[2] || '', caseNum:parts[3] || '' }
          : { id, type:'source', index:positions.length });
        continue;
      }
      const answer = String(testState?.answers?.[pot.questionId] ?? 'source');
      if (answer.startsWith('case:')) {
        const parts = answer.split(':');
        positions.push({ id, type:'case', etagere:parts[1] || '', niveau:parts[2] || '', caseNum:parts[3] || '' });
      } else if (answer === 'tri') {
        positions.push({ id, type:'tri', index:positions.length });
      } else {
        positions.push({ id, type:'source', index:positions.length });
      }
    }
    return positions;
  }

  function syncStockPositionsFromLegacy(test, positions) {
    if (!Array.isArray(positions)) return;
    const testState = testStateFor(test);
    testState.legacyPositions = positions.map(item => ({ ...item }));
    const definition = test.presentation?.stockBoard || {};
    const byId = new Map((definition.pots || []).map(pot => [String(pot.id), pot]));
    for (const item of positions) {
      const pot = byId.get(String(item?.id || ''));
      if (!pot || pot.example || !pot.questionId) continue;
      let value = 'source';
      if (item.type === 'case') {
        value = 'case:' + String(item.etagere || '') + ':' + String(item.niveau || '') + ':' + String(item.caseNum || '');
      } else if (item.type === 'tri') {
        value = 'tri';
      }
      testState.answers[pot.questionId] = value;
    }
    persist();
  }

  function legacyPageFrame(test, pageName) {
    const wrap = document.createElement('div');
    wrap.className = 'kaltest-legacy-page-frame';
    const frame = document.createElement('iframe');
    frame.className = 'kaltest-legacy-page-iframe';
    activeInteractiveFrame = frame;
    clearInteractivePageActions(false);
    frame.title = test.title || 'Exercice';
    const params = new URLSearchParams({
      kaltestEmbed:'1',
      showCorrections:showCorrectionDuringParcours() ? '1' : '0'
    });
    frame.src = pageName + '?' + params.toString();

    const sendState = () => {
      const testState = testStateFor(test);
      const payload = {
        source:'seb-kaltest-host',
        type:'restore',
        testId:test.id,
        status:testState.status,
        showCorrections:showCorrectionDuringParcours()
      };
      if (test.id === 'ranger_stock') {
        payload.positions = stockPositionsFromKaltest(test, testState);
      } else if (test.id === 'gratte_ciel') {
        payload.answers = Object.assign({}, testState.answers || {});
      }
      try { frame.contentWindow?.postMessage(payload, '*'); } catch (_) {}
    };

    const onMessage = event => {
      if (event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || message.source !== 'seb-kaltest-legacy' || message.testId !== test.id) return;

      if (message.type === 'ready') {
        sendState();
        return;
      }

      if (message.type === 'actions') {
        setInteractivePageActions(frame, message.actions);
        return;
      }

      if (test.id === 'ranger_stock' && message.type === 'stock-state') {
        syncStockPositionsFromLegacy(test, message.positions);
        return;
      }

      if (test.id === 'gratte_ciel' && message.type === 'puzzle-answer') {
        const questionId = String(message.questionId || '');
        if (questionById(test, questionId)) saveAnswer(test, questionId, String(message.value || ''));
        return;
      }

      if (test.id === 'gratte_ciel' && message.type === 'puzzle-reset') {
        const testState = testStateFor(test);
        for (const question of test.questions || []) delete testState.answers[question.id];
        testState.result = null;
        testState.status = 'PENDING';
        persist();
        sendState();
        return;
      }

      if (message.type === 'action') {
        if (test.id === 'ranger_stock' && Array.isArray(message.positions)) {
          syncStockPositionsFromLegacy(test, message.positions);
        }
        if (test.id === 'gratte_ciel' && message.answers && typeof message.answers === 'object') {
          const testState = testStateFor(test);
          for (const question of test.questions || []) {
            if (Object.prototype.hasOwnProperty.call(message.answers, question.id)) {
              testState.answers[question.id] = String(message.answers[question.id] || '');
            }
          }
          persist();
        }
        finishCurrentTest();
      }
    };

    window.addEventListener('message', onMessage);
    frame.addEventListener('load', sendState);
    wrap.appendChild(frame);
    return wrap;
  }

  function renderLegacyStockBlock(test) {
    return legacyPageFrame(test, 'stock.html');
  }

  function renderLegacyGratteCielBlock(test) {
    return legacyPageFrame(test, 'carre.html');
  }

  function renderLegacyPreset(test, item) {
    if (item?.preset === 'stock-legacy-v1') return renderLegacyStockBlock(test);
    if (item?.preset === 'gratte-ciel-legacy-v1') return renderLegacyGratteCielBlock(test);
    return null;
  }

  const renderRichContext=window.KaloneoSharedPresentation.renderRichContext;

  function applyBuilderItemStyle(node, item) {
    if (!node) return node;
    node.classList.add('kaltest-builder-stylable-block');
    const style = item?.style || {};
    const fontSize = Number(style.fontSize);
    if (Number.isFinite(fontSize) && fontSize >= 10 && fontSize <= 40) {
      node.style.fontSize = fontSize + 'px';
      node.dataset.kaloneoFontSize = String(fontSize);
    }
    if(item?.type==='text'){
      if(['left','center','right'].includes(style.textAlign))node.style.textAlign=style.textAlign;
      if(['1','1.2','1.5','1.8'].includes(String(style.lineHeight||'')))node.style.lineHeight=String(style.lineHeight);
    }
    const backgroundColor = String(style.backgroundColor || '').trim();
    if (backgroundColor) {
      node.style.backgroundColor = backgroundColor;
      node.style.padding = node.style.padding || '8px 10px';
      node.style.borderRadius = node.style.borderRadius || '9px';
    }
    if(style.backgroundImage){
      const opacity=Math.max(0,Math.min(100,Number(style.backgroundOpacity??100)||0))/100;
      node.style.backgroundImage='linear-gradient(rgba(255,255,255,'+(1-opacity)+'),rgba(255,255,255,'+(1-opacity)+')),url('+JSON.stringify(String(style.backgroundImage))+')';
      node.style.backgroundRepeat='no-repeat';
      node.style.backgroundPosition=String(style.backgroundPosition||'right bottom');
      const bgScale=Number(style.backgroundScale);node.style.backgroundSize=bgScale>=10&&bgScale<100?bgScale+'% auto':style.backgroundFit==='cover'?'cover':style.backgroundFit==='contain'?'contain':'auto 78%';
    }
    return node;
  }

  function applyTestPageStyle(test) {
    const page = document.getElementById('page-exercise');
    if (!page) return;
    for (const property of ['background','backgroundColor','backgroundImage','backgroundSize','backgroundPosition','backgroundRepeat']) {
      page.style[property] = '';
    }
    page.classList.remove('kaltest-custom-page-background');
    const style = test?.presentation?.pageStyle || {};
    if (style.backgroundImage) {
      page.style.backgroundImage = 'url("' + String(style.backgroundImage).replace(/"/g, '%22') + '")';
      page.style.backgroundSize = style.backgroundFit === 'contain' ? 'contain' : 'cover';
      page.style.backgroundPosition = 'center';
      page.style.backgroundRepeat = 'no-repeat';
      page.classList.add('kaltest-custom-page-background');
    } else if (style.backgroundColor) {
      page.style.backgroundColor = String(style.backgroundColor);
      page.classList.add('kaltest-custom-page-background');
    }
  }

  function renderBuilderContentItem(test, item) {
    const legacy = renderLegacyPreset(test, item);
    if (legacy) return legacy;
    const wrap = document.createElement('div');
    wrap.className = 'kaltest-builder-content-item';
    applyBuilderItemStyle(wrap, item);

    if (item.type === 'image-selection') {
      const testState=testStateFor(test);
      wrap.appendChild(window.KaloneoSharedPresentation.renderImageSelection({
        doc:document,block:item,
        selected:Array.isArray(testState.answers?.[item.questionId])?testState.answers[item.questionId]:[],
        onChange:values=>saveAnswer(test,item.questionId,values),
        disabled:testState.status==='COMPLETED',
        cloudState:{
          getSaved:()=>testStateFor(test).fractionCloudPositions?.[item.questionId],
          setSaved:positions=>{
            const current=testStateFor(test);
            if(!current.fractionCloudPositions||typeof current.fractionCloudPositions!=='object')
              current.fractionCloudPositions={};
            current.fractionCloudPositions[item.questionId]=positions;
            persist();
          }
        }
      }));
      return wrap;
    }
    if (item.type === 'text') {
      renderRichContext(wrap, item.text || '');
      // R48.5: garder les dernières lignes du texte hors de l'illustration
      // décorative. Indépendant de la règle R48.10 de largeur des tableaux.
      if (item?.style?.backgroundImage && item.style.backgroundFit === 'decorative' &&
          String(item.style.backgroundPosition || 'right bottom') === 'right bottom') {
        const guard = document.createElement('span');
        guard.className = 'kaltest-builder-background-text-guard';
        guard.setAttribute('aria-hidden', 'true');
        wrap.insertBefore(guard, wrap.firstChild);
      }
      return wrap;
    }
    if (item.type === 'html' || item.type === 'html-js') {
      const frame=window.KaloneoSharedPresentation.renderHtmlFrame({
        doc:document,block:item,className:'kaltest-builder-html',
        // Un bloc HTML simple ne peut pas exécuter de scripts côté candidat.
        sandbox:item.type==='html-js'?'allow-scripts':'',
        // Préserver la présentation historique du candidat, sans style ajouté.
        bodyStyle:'',emptyText:''
      });
      wrap.appendChild(frame);
      return wrap;
    }
    if (['image','audio','video'].includes(item.type)) return applyBuilderItemStyle(renderBuilderMedia(item), item);
    if (item.type === 'text-editor') return applyBuilderItemStyle(renderTextEditorTool(test, item), item);
    if (item.type === 'question') {
      const question = questionById(test, item.questionId);
      if (question) {
        wrap.appendChild(window.KaloneoSharedPresentation.renderQuestion({
          doc:document,question,
          className:'kaltest-builder-question',
          makeAnswer:()=>makeInput(test,question)
        }));
      }
      return wrap;
    }
    if (item.type === 'response-table') return applyBuilderItemStyle(renderBuilderResponseTable(test, item), item);
    if (item.type === 'inline-flow') return applyBuilderItemStyle(renderBuilderInlineFlow(test, item), item);
    if (item.type === 'table-grid') return applyBuilderItemStyle(renderBuilderGrid(test, item), item);
    if (item.type === 'table-definition') {
      const definition = item.definition || {};
      if(test.builderVersion==='2.0.0'&&test.presentation?.legacyFullPage!==true){
        return applyBuilderItemStyle(window.KaloneoSharedPresentation.renderQuestionTable({
          doc:document,definition,
          wrapperClassName:'kaltest-table-wrap',tableClassName:'kaltest-table',
          questionById:id=>questionById(test,id),
          renderCells:({doc,question,headers})=>{
            if(!question)return [];
            const prompt=doc.createElement('td');prompt.textContent=question.prompt||question.id;
            const answer=doc.createElement('td');
            answer.append(makeInput(test,question,{compact:true}));
            const extras=(headers||[]).slice(2).map((header,index)=>{
              const cell=doc.createElement('td');
              const field=question.supplementalFields?.[index];
              if(field)cell.append(makeSupplementalInput(test,question,field));
              return cell;
            });
            return [prompt,answer,...extras];
          }
        }),item);
      }
      const title = document.createElement('h3');
      title.textContent = definition.title || '';
      wrap.appendChild(title);
      for (const id of definition.questionIds || []) {
        const question = questionById(test, id);
        if (!question) continue;
        const row = document.createElement('div');
        row.className = 'kaltest-builder-question';
        const label = document.createElement('span');
        label.textContent = question.prompt || id;
        row.append(label, makeInput(test, question, { compact:true }));
        wrap.appendChild(row);
      }
      return wrap;
    }

    return wrap;
  }


  // Une fenêtre documentaire est un <dialog> de la page Electron actuelle :
  // jamais de nouvelle BrowserWindow, pas d'accès web ni de score candidat.
  let supplementaryReturnFocus=null;
  function supplementaryWindowsFor(test){
    const values=test?.presentation?.supplementaryWindows;
    return Array.isArray(values)?values.filter(w=>w&&typeof w.id==='string'):[];
  }
  function openSupplementaryWindow(test,windowId){
    const windows=supplementaryWindowsFor(test);
    let index=windows.findIndex(w=>w.id===windowId);
    const dialog=document.getElementById('kaltest-supplementary-dialog');
    if(index<0||!dialog)return;
    supplementaryReturnFocus=document.activeElement;
    const title=document.getElementById('kaltest-supplementary-title');
    const content=document.getElementById('kaltest-supplementary-content');
    const counter=document.getElementById('kaltest-supplementary-count');
    const back=document.getElementById('kaltest-supplementary-previous');
    const next=document.getElementById('kaltest-supplementary-next');
    const draw=()=>{
      const entry=windows[index];
      title.textContent=String(entry.title||'Document complémentaire');
      content.replaceChildren();
      const type=String(entry.type||'text');
      if(type==='image'&&/^(?:data:image\/|(?:\.\/)?(?:imageqcm|assets)\/)/i.test(String(entry.imageData||''))){
        const image=document.createElement('img');
        image.src=String(entry.imageData);
        image.alt=String(entry.imageAlt||entry.title||'Document');
        image.className='kaltest-supplementary-picture';
        content.appendChild(image);
      }else if(type==='table'){
        const table=document.createElement('table');
        table.className='kaltest-supplementary-table';
        for(const line of String(entry.text||'').split(/\r?\n/).filter(x=>x.trim())){
          const tr=document.createElement('tr');
          for(const cell of line.split(/[|;]/)){
            const td=document.createElement('td');td.textContent=cell.trim();tr.appendChild(td);
          }
          table.appendChild(tr);
        }
        content.appendChild(table);
      }else if(type==='list'){
        const list=document.createElement('ul');
        for(const line of String(entry.text||'').split(/\r?\n/).filter(x=>x.trim())){
          const li=document.createElement('li');li.textContent=line.trim();list.appendChild(li);
        }
        content.appendChild(list);
      }else {
        const text=document.createElement('div');
        text.className='kaltest-supplementary-text';
        text.textContent=String(entry.text||'');
        content.appendChild(text);
      }
      counter.textContent=(index+1)+' / '+windows.length;
      back.disabled=index===0;
      next.disabled=index===windows.length-1;
    };
    back.onclick=()=>{if(index>0){index--;draw();}};
    next.onclick=()=>{if(index<windows.length-1){index++;draw();}};
    const close=document.getElementById('kaltest-supplementary-close');
    close.onclick=()=>dialog.close();
    dialog.onclose=()=>{
      if(supplementaryReturnFocus?.isConnected)supplementaryReturnFocus.focus();
      supplementaryReturnFocus=null;
    };
    draw();
    if(!dialog.open)dialog.showModal();
  }

  function makeSupplementaryTrigger(test,button){
    const control=document.createElement('button');
    control.type='button';
    control.className='seb-action-btn kaltest-supplementary-trigger kaltest-supplementary-inline-trigger';
    control.textContent=String(button.label||'Consulter le document');
    control.addEventListener('click',()=>openSupplementaryWindow(test,button.windowId));
    return control;
  }

  function renderBuilderContentWithDocuments(test,item){
    const node=renderBuilderContentItem(test,item);
    const entries=supplementaryWindowsFor(test);
    const buttons=Array.isArray(item?.supplementaryButtons)?item.supplementaryButtons
      .filter(b=>entries.some(w=>w.id===b?.windowId)):[];
    if(!buttons.length)return node; // V1 : DOM inchangé.
    if(item.type==='text'){
      // Avant/Après restent dans le même noeud que « Question : »,
      // et le placement au curseur garde les styles [b]/[u] du texte.
      window.KaloneoSharedPresentation.placeDocumentButtons(node,buttons,
        button=>makeSupplementaryTrigger(test,button));
      const before=buttons.filter(b=>b.position==='before');
      const after=buttons.filter(b=>b.position==='after'||!b.position);
      for(let i=before.length-1;i>=0;i--){
        node.prepend(makeSupplementaryTrigger(test,before[i]),document.createTextNode(' '));
      }
      for(const button of after){
        node.append(document.createTextNode(' '),makeSupplementaryTrigger(test,button));
      }
      return node;
    }
    const shell=document.createElement('section');
    shell.className='kaltest-supplementary-block';
    const addButtons=position=>{
      const subset=buttons.filter(b=>(b.position==='before'?'before':'after')===position);
      if(!subset.length)return;
      const bar=document.createElement('div');
      bar.className='kaltest-supplementary-buttons';
      for(const button of subset){
        const control=document.createElement('button');
        control.type='button';
        control.className='seb-action-btn kaltest-supplementary-trigger';
        control.textContent=String(button.label||'Consulter le document');
        control.addEventListener('click',()=>openSupplementaryWindow(test,button.windowId));
        bar.appendChild(control);
      }
      shell.appendChild(bar);
    };
    addButtons('before');
    shell.appendChild(node);
    addButtons('after');
    return shell;
  }

  function renderBuilderContent(test, host) {
    const content = test.presentation?.builderContent;
    if (!Array.isArray(content)) return false;

    if (test.presentation?.legacyFullPage === true && content.length === 1) {
      const node=renderBuilderContentWithDocuments(test,content[0]);
      if (BUILDER_MINI_PREVIEW_MODE && node)
        node.dataset.kaloneoMiniBlockIndex=String(content[0].__kaloneoMiniSourceIndex??0);
      host.appendChild(node);
      return true;
    }

    const layout = String(test.presentation?.layout || 'single');
    const shell = document.createElement('div');
    shell.className = 'kaltest-builder-runtime-layout';
    window.KaloneoSharedPresentation.renderZones({
      host:shell,items:content,layout,
      blockSizing:test.presentation?.blockSizing,
      zoneClass:'kaltest-builder-runtime-zone',
      renderItem:item=>{
        const node=renderBuilderContentWithDocuments(test,item);
        // Invisible pour le candidat et le vrai Aperçu Electron. Seulement
        // le worker de capture miniature expose les positions au Builder.
        if(BUILDER_MINI_PREVIEW_MODE && node) {
          node.dataset.kaloneoMiniBlockIndex=String(
            item.__kaloneoMiniSourceIndex??content.indexOf(item));
        }
        return node;
      }
    });
    host.appendChild(shell);
    return true;
  }

  function parseStorageObject(key) {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) {
      return {};
    }
  }

  function syncLegacyCompatibility(test, testState) {
    if (!test || !testState || !testState.result) return;

    const responses = parseStorageObject('reponses_data');
    const scores = parseStorageObject('scores_data');
    const result = testState.result;
    const questions = test.questions || [];

    const copyRange = (responsePrefix, scorePrefix, startIndex, includeUnits, includeSupplemental) => {
      questions.forEach((question, offset) => {
        const index = startIndex + offset;
        const detail = result.details?.[question.id] || {};
        responses[responsePrefix + index] = String(testState.answers?.[question.id] ?? '');
        scores[scorePrefix + index] = detail.correct ? 1 : 0;
        if (includeUnits) {
          responses[responsePrefix.replace(/_q$/, '_unite') + index] = String(testState.units?.[question.id] ?? '');
          scores[scorePrefix.replace(/_q$/, '_unite') + index] =
            question.unitScored===true && result.details?.[question.id]?.unitCorrect===true ? 1 : 0;
        }
        if (includeSupplemental) {
          const supplemental = testState.supplemental?.[question.id] || {};
          const first = Object.values(supplemental)[0];
          if (first !== undefined) {
            responses[responsePrefix + index + '_operation'] = String(first ?? '');
            scores[scorePrefix + index + '_operation'] = 0;
          }
        }
      });
    };

    if (test.id === 'calculs_commandes_atelier') {
      copyRange('page2_q', 'page2_q', 1, true, false);
    } else if (test.id === 'calculs_poids_volumes') {
      copyRange('page2_1_q', 'page2_1_q', 6, true, false);
    } else if (test.id === 'horaires_reception_controle') {
      questions.forEach((question, offset) => {
        const index = offset + 1;
        const key = 'page3_q' + index;
        const detail = result.details?.[question.id] || {};
        responses[key] = String(testState.answers?.[question.id] ?? '');
        scores[key] = detail.correct ? 1 : 0;
      });
      const dedicatedResponses = {};
      const dedicatedScores = {};
      for (let index = 1; index <= questions.length; index += 1) {
        dedicatedResponses['page3_q' + index] = responses['page3_q' + index] || '';
        dedicatedScores['page3_q' + index] = scores['page3_q' + index] || 0;
      }
      sessionStorage.setItem('page3_resultats', JSON.stringify({
        reponses: dedicatedResponses,
        scores: dedicatedScores,
        savedAt: Date.now()
      }));
    } else if (test.id === 'texte_a_trous_stage_logistique') {
      responses.pageTexteTrous = questions.map(question => ({
        user: String(testState.answers?.[question.id] ?? ''),
        correct: String(Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length ? question.acceptedAnswers[0] : '')
      }));
      scores.pageTexteTrous = Number(result.score) || 0;
    } else if (test.id === 'fractions_preparation_lots') {
      responses.page4 = String(Number(result.score) || 0) + '/' + String(Number(result.scoreMax) || questions.length || 3);
      scores.page4 = Number(result.score) || 0;
    } else if (test.id === 'organisation_demenagement') {
      const snapshot = {};
      const values = {};
      questions.forEach((question, offset) => {
        const index = offset + 1;
        const key = 'page5_q' + index;
        const value = String(testState.answers?.[question.id] ?? '');
        const detail = result.details?.[question.id] || {};
        responses[key] = value;
        scores[key] = detail.correct ? 1 : 0;
        values[index] = value;
        snapshot[index] = { reponse:value, score:scores[key] };
      });
      sessionStorage.setItem('page5_organisation_data', JSON.stringify(snapshot));
      sessionStorage.setItem('seb_evalpro_qcm_page5_state', JSON.stringify({ values, savedAt:Date.now(), source:'kaltest' }));
    } else if (test.id === 'gestes_postures') {
      const values = {};
      questions.forEach((question, offset) => {
        const index = offset + 1;
        const key = 'page5_1_q' + index;
        const value = String(testState.answers?.[question.id] ?? '');
        const detail = result.details?.[question.id] || {};
        responses[key] = value;
        scores[key] = detail.correct ? 1 : 0;
        values[index] = value;
      });
      sessionStorage.setItem('seb_evalpro_qcm_page5_1_state', JSON.stringify({ values, savedAt:Date.now(), source:'kaltest' }));
    } else if (test.id === 'conversions_atelier_expedition') {
      copyRange('page6_q', 'page6_q', 1, true, true);
    } else if (test.id === 'autoevaluation_savoirs') {
      const question = questions[0];
      sessionStorage.setItem('autoEval1_resultats', JSON.stringify({
        selections:Array.isArray(testState.answers?.[question?.id]) ? testState.answers[question.id] : [],
        commentaire:String(testState.supplemental?.[question?.id]?.commentaire ?? '')
      }));
    } else if (test.id === 'construction_briques') {
      const bricks = result.bricks || {};
      const seconds = Math.max(0,Math.floor(Number(bricks.temps)||0));
      const time = String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
      const errors = Math.max(0,Math.floor(Number(bricks.erreurs)||0));
      sessionStorage.setItem('eval_brique', JSON.stringify({
        temps:time,
        niveau:String(errors),
        code:testState.brique?.adminValidated ? 'svg56' : ''
      }));
      sessionStorage.setItem('eval_brique_auto', JSON.stringify({
        choix:Array.isArray(testState.brique?.autoSelections)?testState.brique.autoSelections:[],
        commentaire:String(testState.brique?.commentaire||'')
      }));
      sessionStorage.setItem('seb_evalpro_brique_checkpoint', JSON.stringify({
        chronoSeconds:seconds,
        savedAt:Date.now()
      }));
      sessionStorage.setItem('seb_exercise_activity:brique.html','1');
    } else if (test.id === 'ranger_stock') {
      const correct = Number(result.score) || 0;
      const total = Number(result.scoreMax) || 33;
      const errors = Math.max(0, total - correct);
      sessionStorage.setItem('stockCorrect', String(correct));
      sessionStorage.setItem('stockErrors', String(errors));
      sessionStorage.setItem('stockTotal', String(total));
      sessionStorage.setItem('seb_evalpro_stock_state', JSON.stringify({
        answers:Object.assign({}, testState.answers || {}),
        validated:true,
        savedAt:Date.now(),
        source:'kaltest'
      }));
      sessionStorage.setItem('seb_exercise_activity:stock.html', '1');
    } else if (test.id === 'planning_cantine') {
      const correction = {};
      const answers = {};
      questions.forEach((question, offset) => {
        const index = offset + 1;
        const key = 'q' + index;
        const value = String(testState.answers?.[question.id] ?? '');
        const detail = result.details?.[question.id] || {};
        const expected = String(Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length ? question.acceptedAnswers[0] : '');
        answers[key] = value || '_';
        correction[key] = { reponse:value || '_', attendu:expected, correct:Boolean(detail.correct) };
      });
      sessionStorage.setItem('planningScore', String(Number(result.score) || 0));
      sessionStorage.setItem('planningCorrection', JSON.stringify(correction));
      sessionStorage.setItem('seb_planning_validated', '1');
      sessionStorage.setItem('seb_evalpro_planning_state', JSON.stringify({
        answers,
        validated:true,
        savedAt:Date.now(),
        source:'kaltest'
      }));
    } else if (test.id === 'tri_chevilles') {
      const triResult = result.tri || {};
      const rows = Array.isArray(testState.tri?.rows) ? testState.tri.rows.slice(0,5) : [];
      const labels = new Map((test.presentation?.triStation?.autoStatements || []).map(item=>[String(item.value),String(item.label)]));
      sessionStorage.setItem('tri_cheville_data', JSON.stringify({
        tris:Array.from({length:5},(_,index)=>{
          const row=rows[index]||{};
          if(row.seconds===null||row.seconds===undefined)return {minutes:'',secondes:'',erreurs:''};
          const seconds=Math.max(0,Math.floor(Number(row.seconds)||0));
          return {
            minutes:String(Math.floor(seconds/60)),
            secondes:String(seconds%60),
            erreurs:row.errors===null||row.errors===undefined?'':String(row.errors)
          };
        }),
        moyenne:window.KaloneoChrono?.format?.(triResult.temps_moyen||0) || '00:00',
        totalErreurs:String(triResult.erreurs_total||0),
        auto:(testState.tri?.autoSelections||[]).map(value=>labels.get(String(value))||String(value)),
        commentaire:String(testState.tri?.commentaire||''),
        currentTri:Number(testState.tri?.currentTri)||1,
        awaitingError:testState.tri?.awaitingError ?? null
      }));
      sessionStorage.setItem('autoEvaltri_resultats', JSON.stringify({
        selections:Array.isArray(testState.tri?.autoSelections)?testState.tri.autoSelections:[],
        commentaire:String(testState.tri?.commentaire||'')
      }));
      if (testState.tri?.ready) sessionStorage.setItem('seb_tri_navigation_ready','1');
      sessionStorage.setItem('seb_evalpro_tri_live_chrono', String(Number(testState.tri?.liveSeconds)||0));
      sessionStorage.setItem('seb_exercise_activity:tri_de_cheville.html','1');
    } else if (test.id === 'dictee_professionnelle') {
      const dictation = result.dictation || {};
      const status = String(testState.status || '').startsWith('ABANDONED') ? 'abandoned' : 'verified';
      sessionStorage.setItem('dictee_data', JSON.stringify({
        status,
        texte:String(testState.answers?.dictee_text ?? ''),
        scoreSur20:Number(dictation.scoreSur20) || 0,
        motsCorrects:Number(dictation.motsCorrects) || 0,
        motsTotal:Number(dictation.motsTotal) || 80,
        substitutions:Number(dictation.substitutions) || 0,
        omissions:Number(dictation.omissions) || 0,
        ajouts:Number(dictation.ajouts) || 0,
        deplacements:Number(dictation.deplacements) || 0,
        erreursNotees:Number(dictation.erreursNotees) || 0,
        erreursPonctuation:Number(dictation.erreursPonctuation) || 0,
        erreursMajuscules:Number(dictation.erreursMajuscules) || 0,
        ecoutes:Number(testState.dictation?.ecoutes) || 0,
        audioPosition:Number(testState.dictation?.audioPosition) || 0,
        alignment:Array.isArray(dictation.alignment) ? dictation.alignment : [],
        alignmentOriginal:Array.isArray(dictation.alignmentOriginal) ? dictation.alignmentOriginal : [],
        classificationVersion:dictation.classificationVersion || 3,
        updatedAt:new Date().toISOString()
      }));
      sessionStorage.setItem('seb_exercise_activity:dictee.html', '1');
    } else if (test.id === 'traitement_texte_bureautique') {
      const analyse = result.textEditor?.analyse || null;
      if (analyse) {
        responses.page7_contenu_html = analyse.html || '';
        responses.page7_contenu_texte = window.sebNwtexteEditor?.editorText?.() || testState.answers?.text_editor_text || '';
        responses.page7_delta = window.sebNwtexteEditor?.getContents?.() || null;
        responses.page7_analyse = analyse;
        scores.page7 = Number(result.score) || 0;
        scores.page7_detail = analyse.score || {};
      }
      sessionStorage.setItem('seb_exercise_activity:nwtexte.html','1');
    } else if (test.id === 'redaction_email') {
      const value = id => String(testState.answers?.[id] ?? '');
      const detail = id => testState.result?.details?.[id]?.correct ? 1 : 0;
      const data = {
        page8_to:value('mail_to'),
        page8_cc:value('mail_cc'),
        page8_subject:value('mail_subject'),
        page8_message:value('mail_signature') || value('mail_phone'),
        page8_file:value('mail_file'),
        score_to:detail('mail_to'),
        score_cc:detail('mail_cc'),
        score_subject:detail('mail_subject'),
        score_file:detail('mail_file'),
        score_signature:detail('mail_signature'),
        score_telephone:detail('mail_phone'),
        score_total:Number(result.score) || 0
      };
      sessionStorage.setItem('page8_data', JSON.stringify(data));
      sessionStorage.setItem('seb_exercise_activity:nvmail.html', '1');
    } else if (test.id === 'autoevaluation_tic') {
      const question = questions[0];
      sessionStorage.setItem('autoEval2_resultats', JSON.stringify({
        selections:Array.isArray(testState.answers?.[question?.id]) ? testState.answers[question.id] : [],
        commentaire:String(testState.supplemental?.[question?.id]?.commentaire ?? '')
      }));
    } else if (test.id === 'genre_nombre') {
      const answers = questions.map(question => String(testState.answers?.[question.id] ?? ''));
      const errors = Math.max(0, questions.length - (Number(result.score) || 0));
      sessionStorage.setItem('user_genrenombres', JSON.stringify(answers));
      sessionStorage.setItem('erreurs_exercice', String(errors));
      sessionStorage.setItem('seb_genrenombres_validated', '1');
      sessionStorage.setItem('seb_evalpro_genrenombres_state', JSON.stringify({
        answers,
        validated:true,
        savedAt:Date.now()
      }));
    } else if (test.id === 'paronymes_rapport') {
      const detailRows = questions.map(question => {
        const answer = String(testState.answers?.[question.id] ?? '');
        const detail = result.details?.[question.id] || {};
        return {
          paronyme: question.prompt,
          mot: question.prompt,
          reponseUtilisateur: answer || '(non repondu)',
          bonnesReponses: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [],
          correct: Boolean(detail.correct)
        };
      });
      sessionStorage.setItem('paronymes_score', String(Number(result.score) || 0));
      sessionStorage.setItem('paronymes_total', String(Number(result.scoreMax) || questions.length));
      sessionStorage.setItem('paronymes_reponses', JSON.stringify(detailRows));
      sessionStorage.setItem('paronymes_erreurs_detail', JSON.stringify(detailRows.filter(row => !row.correct)));
      sessionStorage.setItem('seb_paronymes_validated', '1');
      sessionStorage.setItem('seb_exercise_activity:paronymes.html', '1');
    } else if (test.id === 'gratte_ciel') {
      const score = Number(result.score) || 0;
      const scoreMax = Number(result.scoreMax) || 16;
      const errors = Math.max(0, scoreMax - score);
      sessionStorage.setItem('puzzleErrors', String(errors));
      sessionStorage.setItem('carre_magique_score', String(score));
      sessionStorage.setItem('carre_magique_erreurs', String(errors));
      sessionStorage.setItem('seb_exercise_activity:carre.html', '1');
    }

    sessionStorage.setItem('reponses_data', JSON.stringify(responses));
    sessionStorage.setItem('scores_data', JSON.stringify(scores));
  }

  function renderCurrentTest() {
    try { window.closeCalculator?.(); } catch (_) {}
    const test = currentTest();
    if (!test) {
      showPhase('final');
      return;
    }

    document.body.dataset.sebKaltestExercise = '1';
    document.body.dataset.sebKaltestId = test.id;
    document.body.classList.remove('seb-kaltest-transition-video','seb-kaltest-terminal');
    document.body.classList.toggle('seb-kaltest-legacy-full', test.presentation?.legacyFullPage === true);
    document.body.dataset.sebKaltestLabel = test.title;
    window.sebNwtexteContext = null;

    applyTestPageStyle(test);
    // R57 : l'icône choisie et embarquée dans le JSON par le Test Builder
    // doit aussi apparaître dans la véritable page candidat / aperçu fidèle.
    const testTitle = document.getElementById('kaltest-test-title-text');
    testTitle.textContent = test.title || 'Exercice';
    const testIcon = document.getElementById('kaltest-test-icon');
    const iconData = typeof test.icon?.data === 'string' ? test.icon.data : '';
    testIcon.hidden = true;
    testIcon.removeAttribute('src');
    if (/^data:image\//i.test(iconData)) {
      testIcon.alt = '';
      testIcon.onerror = () => { testIcon.hidden = true; testIcon.removeAttribute('src'); };
      testIcon.src = iconData;
      testIcon.hidden = false;
    }
    document.getElementById('kaltest-progress').textContent =
      'Exercice ' + (state.testIndex + 1) + ' / ' + ACTIVE_TESTS.length;
    renderRichContext(document.getElementById('kaltest-scenario'), test.scenario || '');
    renderRichContext(document.getElementById('kaltest-instruction'), test.instruction || '');

    const calculator = document.getElementById('kaltest-calculator');
    const calculatorEnabled = test.calculator?.compatible === true && test.calculator?.defaultEnabled !== false;
    try { window.setCalculatorBrand?.(test.calculator?.brandLabel ?? 'KALONÉO'); } catch (_) {}
    calculator.hidden = !calculatorEnabled;
    if (calculatorEnabled) {
      calculator.style.removeProperty('display');
    } else {
      calculator.style.setProperty('display', 'none', 'important');
      try { window.closeCalculator?.(); } catch (_) {}
      requestAnimationFrame(() => {
        try { window.closeCalculator?.(); } catch (_) {}
      });
    }

    const next = document.getElementById('kaltest-next');
    const isLastActiveTest = state.testIndex === ACTIVE_TESTS.length - 1;
    const testState = currentTestState();
    if (shouldPauseForValidation(test) && testState?.status !== 'COMPLETED') {
      next.textContent = test.behavior?.validationLabel || 'Valider';
    } else {
      next.textContent = isLastActiveTest && !PILOT11_MODE ? 'Terminer le parcours' : 'Suivant';
    }

    const status = document.getElementById('exercise-status');
    status.textContent = '';

    const host = document.getElementById('kaltest-content');
    if (activeTriChrono?.destroy) {
      try { activeTriChrono.destroy(); } catch (_) {}
      activeTriChrono = null;
    }
    if (activeBriqueChrono?.destroy) {
      try { activeBriqueChrono.destroy(); } catch (_) {}
      activeBriqueChrono = null;
    }
    clearTimeout(transitionAdvanceTimer);
    transitionAdvanceTimer = null;
    clearInteractivePageActions();
    if (next) next.hidden = test.presentation?.legacyFullPage === true;
    host.innerHTML = '';

    if (renderTransitionVideo(test, host)) {
      // Transition vidéo F1 gérée directement par KALTEST.
    } else if (renderEndPage(test, host)) {
      // Page terminale du parcours gérée par KALTEST.
    } else if (renderBrique(test, host)) {
      // Construction à base de briques gérée par KALTEST.
    } else if (renderAutoevaluation(test, host)) {
      // Autoévaluations migrées dans le moteur KALTEST commun.
    } else if (renderTri(test, host)) {
      // Tri de chevilles migré dans le moteur KALTEST commun.
    } else if (renderDictation(test, host)) {
      // Dictée professionnelle migrée dans le moteur KALTEST commun.
    } else if (renderMail(test, host)) {
      // Rédaction e-mail migrée dans le moteur KALTEST commun.
    } else if (renderStock(test, host)) {
      // Ranger le stock migré dans le moteur KALTEST commun.
    } else if (!Array.isArray(test.presentation?.builderContent) && renderPlanning(test, host)) {
      // Planning cantine migré dans le moteur KALTEST commun.
    } else if (Array.isArray(test.presentation?.builderContent) && renderBuilderContent(test, host)) {
      // Une version explicitement enregistrée par le Builder est prioritaire
      // sur les anciens renderers historiques (fractions/organisation/postures).
    } else if (renderFractions(test, host)) {
      // Migration KALTEST de l'ancienne page 4.
    } else if (renderOrganisation(test, host)) {
      // Migration KALTEST de l'ancienne page 5.
    } else if (renderPostures(test, host)) {
      // Migration KALTEST de l'ancienne page 5_1.
    } else if (renderBuilderContent(test, host)) {
      // Les tests générés par KALONÉO passent par le rendu générique commun.
    } else if (Array.isArray(test.presentation?.inlineFlow)) {
      renderInlineGaps(test, host);
    } else if (test.presentation?.choiceTable) {
      renderChoiceTable(test, host);
    } else if (test.presentation?.table?.rows) {
      renderSchedule(test, host);
    } else if ((test.questions || []).some(question => Array.isArray(question.supplementalFields))) {
      renderConversions(test, host);
    } else if (Array.isArray(test.presentation?.tables)) {
      renderGenreNombre(test, host);
    } else {
      renderBasic(test, host);
    }

    applyVisibleCorrection(test, host);
  }

  function validateIdentity() {
    const values = {
      nom: document.getElementById('nom').value.trim(),
      prenom: document.getElementById('prenom').value.trim(),
      civilite: document.querySelector('input[name="civilite"]:checked')?.value || '',
      personIdentifier: document.getElementById('personIdentifier').value.trim().toUpperCase(),
      lieu: document.getElementById('lieu').value.trim(),
      groupe: document.getElementById('groupe').value.trim(),
      dateEvaluation: document.getElementById('dateEvaluation').value,
      parcours: DATA.parcours?.title || 'Parcours KALTEST'
    };

    const required = ['civilite','nom','prenom','personIdentifier','lieu','groupe','dateEvaluation'];
    if (required.some(key => !values[key])) {
      return { ok:false, message:'Veuillez remplir tous les champs avant de commencer.' };
    }
    if (!/^[A-Z0-9]{7}$/.test(values.personIdentifier)) {
      return { ok:false, message:'Le N° identifiant doit contenir exactement 7 caractères : lettres ou chiffres.' };
    }
    return { ok:true, values };
  }

  function renderIdentity() {
    document.getElementById('parcours').value = DATA.parcours?.title || 'Parcours KALTEST';
    for (const [key, value] of Object.entries(state.identity || {})) {
      if (key === 'civilite') {
        const option = [...document.querySelectorAll('input[name="civilite"]')].find(item => item.value === value);
        if (option) option.checked = true;
        continue;
      }
      const input = document.getElementById(key);
      if (input && key !== 'parcours') input.value = value || '';
    }
    if (!document.getElementById('dateEvaluation').value) {
      document.getElementById('dateEvaluation').value = new Date().toISOString().slice(0,10);
    }
  }

  async function captureReplayPage() {
    if (BUILDER_PREVIEW_MODE) return;
    try {
      if (window.sebEvalPro?.captureReplay) {
        await window.sebEvalPro.captureReplay();
      }
    } catch (_) {}
  }

  async function finishCurrentTest() {
    if (BUILDER_PREVIEW_MODE) return; // aucun score ou changement d'étape en aperçu
    const test = currentTest();
    const testState = currentTestState();
    const status = document.getElementById('exercise-status');
    if (!test || !testState) return;

    if (shouldPauseForValidation(test) && testState.status === 'COMPLETED') {
      if (test.behavior?.revalidateOnAdvance === true) {
        testState.result = evaluateTest(test, testState);
        syncLegacyCompatibility(test, testState);
        replay('EXERCISE_REVALIDATED', {
          testId:test.id,
          version:test.version,
          score:testState.result.score,
          scoreMax:testState.result.scoreMax
        });
      }
      await captureReplayPage();
      advance();
      return;
    }

    if (test.evaluation?.triRules === true) {
      const tri = testState.tri || {};
      const rows = Array.isArray(tri.rows) ? tri.rows.slice(0, Number(test.presentation?.triStation?.maxTris) || 5) : [];
      const complete = rows.filter(row =>
        row?.seconds !== null && row?.seconds !== undefined &&
        row?.errors !== null && row?.errors !== undefined &&
        String(row.errors).trim() !== ''
      );
      const partial = rows.some(row => {
        const hasTime = row?.seconds !== null && row?.seconds !== undefined;
        const hasErrors = row?.errors !== null && row?.errors !== undefined && String(row.errors).trim() !== '';
        return hasTime !== hasErrors;
      });
      const autoAnswered = (Array.isArray(tri.autoSelections) && tri.autoSelections.length > 0) ||
        String(tri.commentaire || '').trim() !== '';
      const minimum = Number(test.presentation?.triStation?.minTris) || 3;
      if (complete.length < minimum || partial || !autoAnswered) {
        status.textContent = 'Effectuez au moins ' + minimum + ' tris complets, renseignez les erreurs puis complétez l’autoévaluation.';
        return;
      }
      tri.ready = true;
      testState.answers.tri_ready = '1';
      testState.status = 'ACTIVE';
    }

    if (!hasActivity(test, testState) && test.allowEmptyCompletion !== true) {
      status.textContent = 'Vous devez réaliser l’exercice avant de continuer. Si vous souhaitez l’arrêter, utilisez « Abandonner l’exercice ».';
      return;
    }

    testState.result = evaluateTest(test, testState);
    testState.status = 'COMPLETED';
    testState.abandon = null;
    syncLegacyCompatibility(test, testState);

    if (shouldPauseForValidation(test)) {
      replay('EXERCISE_VALIDATED', {
        testId:test.id,
        version:test.version,
        score:testState.result.score,
        scoreMax:testState.result.scoreMax
      });

      // Une page interactive pleine page gère déjà localement son état visuel
      // (couleurs de correction, verrouillage, passage de Vérifier/Valider à Suivant).
      // Ne pas reconstruire l'iframe ici : cela provoquait un saut visible de la page
      // et donnait l'impression d'un rechargement complet au moment de la correction.
      if (test.presentation?.legacyFullPage === true && activeInteractiveFrame) {
        persist();
        status.textContent = test.behavior?.validationSuccessMessage ||
          (showCorrectionDuringParcours(test)
            ? ('Exercice validé : ' + testState.result.score + '/' + testState.result.scoreMax + '. Cliquez sur « Suivant » pour continuer.')
            : 'Exercice validé. Cliquez sur « Suivant » pour continuer.');
        refreshCandidateBar();
        return;
      }

      renderCurrentTest();
      status.textContent = test.behavior?.validationSuccessMessage ||
        (showCorrectionDuringParcours(test)
          ? ('Exercice validé : ' + testState.result.score + '/' + testState.result.scoreMax + '. Cliquez sur « Suivant » pour continuer.')
          : 'Exercice validé. Cliquez sur « Suivant » pour continuer.');
      return;
    }

    replay('EXERCISE_COMPLETED', {
      testId:test.id,
      version:test.version,
      score:testState.result.score,
      scoreMax:testState.result.scoreMax
    });

    await captureReplayPage();
    advance();
  }

  function handoffPilot11() {
    if (!PILOT11_MODE || !SEGMENT?.stepId) {
      throw new Error('Handoff PILOTE 11 demandé sans segment actif.');
    }
    if (!window.sebParcours?.goNext) {
      throw new Error('Registre central du parcours indisponible pour le handoff PILOTE 11.');
    }
    try { window.dispatchEvent(new CustomEvent('seb-kaltest-handoff', { detail:{ segment:SEGMENT_KEY } })); } catch (_) {}
    window.sebParcours.goNext(SEGMENT.stepId);
  }

  function advance() {
    try { window.closeCalculator?.(); } catch (_) {}
    if (state.testIndex + 1 >= ACTIVE_TESTS.length) {
      if (PILOT11_MODE) {
        state.phase = 'handoff';
        persist();
        handoffPilot11();
        return;
      }

      state.phase = 'final';
      persist();
      showPhase('final');
      try { window.dispatchEvent(new CustomEvent('seb-kaltest-final')); } catch (_) {}
      return;
    }

    state.testIndex += 1;
    state.phase = 'exercise';
    persist();
    renderCurrentTest();
    showPhase('exercise');
  }

  async function onAbandon(record) {
    if (BUILDER_PREVIEW_MODE) return;
    const test = currentTest();
    const testState = currentTestState();
    if (!test || !testState) return;

    testState.result = evaluateTest(test, testState);
    testState.status = record?.nonEvaluated ? 'ABANDONED_NE' : 'ABANDONED_EVALUATED';
    testState.abandon = record || null;
    syncLegacyCompatibility(test, testState);

    replay('EXERCISE_ABANDONED', {
      testId:test.id,
      nonEvaluated:Boolean(record?.nonEvaluated),
      score:testState.result.score,
      scoreMax:testState.result.scoreMax
    });

    await captureReplayPage();
    advance();
  }

  function installKeyboardNavigation() {
    document.addEventListener('keydown', event => {
      const target = event.target;
      if (!target || !target.classList?.contains('step')) return;
      const fields = Array.from(document.querySelectorAll('.pilot2-page.visible .step:not(:disabled)'));
      const index = fields.indexOf(target);
      if (index < 0) return;

      let nextIndex = null;
      if (event.key === 'Enter' || event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index + 1;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index - 1;
      if (nextIndex === null) return;

      const next = fields[nextIndex];
      if (!next) return;
      event.preventDefault();
      next.focus();
    });
  }

  function install() {
    renderIdentity();

    document.getElementById('personIdentifier').addEventListener('input', event => {
      event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,7);
    });

    document.getElementById('identity-next').addEventListener('click', () => {
      const validation = validateIdentity();
      const status = document.getElementById('identity-status');
      if (!validation.ok) {
        status.textContent = validation.message;
        return;
      }

      status.textContent = '';
      const candidateData = {
        ...validation.values,
        'prénom': validation.values.prenom,
        date: validation.values.dateEvaluation,
        dateTest: validation.values.dateEvaluation
      };
      state.identity = candidateData;
      // personId et evaluationId sont attribués par le stockage principal Electron.
      // Le navigateur ne doit pas créer d'identité technique concurrente.
      sessionStorage.setItem('candidat_data', JSON.stringify(candidateData));
      replay('IDENTITY_VALIDATED', {
        fields:['civilite','nom','prenom','personIdentifier','lieu','groupe','dateEvaluation','parcours']
      });
      showPhase('intro');
    });

    document.getElementById('intro-next').addEventListener('click', () => {
      state.testIndex = Math.max(0, Math.min(state.testIndex, ACTIVE_TESTS.length - 1));
      state.phase = 'exercise';
      renderCurrentTest();
      showPhase('exercise');
    });

    if (BUILDER_PREVIEW_MODE) {
      document.body.classList.add('kaloneo-real-candidate-preview');
      document.title='KALONÉO — Aperçu réel candidat (Electron)';
      const close=document.getElementById('kaltest-next');
      // Miniature : conserver le vrai libellé candidat (« Valider », « Suivant »).
      // Le bouton est photographié mais jamais actionnable dans une image.
      if(!BUILDER_MINI_PREVIEW_MODE) {
        // R48.7 : ne jamais dépendre de la barre d'exercice, qui occupe 0 px
        // en mode candidat (barre de navigation Electron distincte).
        let closingPreview=false;
        const exitPreview=async()=>{
          if(closingPreview)return;
          closingPreview=true;
          const exit=document.getElementById('kaloneo-builder-preview-exit');
          if(exit)exit.disabled=true;
          try {
            const ok=await window.sebEvalPro?.kaloneoClosePreview?.();
            if(ok!==true)throw new Error('Retour au Builder refusé.');
          }catch(error){
            closingPreview=false;
            if(exit)exit.disabled=false;
            window.alert('Impossible de fermer l’aperçu : '+String(error?.message||error));
          }
        };
        // Conserver l'ancien bouton comme secours, mais ajouter un vrai bouton
        // indépendant du footer compressé.
        close.addEventListener('click',exitPreview);
        const exit=document.createElement('button');
        exit.id='kaloneo-builder-preview-exit';
        exit.type='button';
        exit.textContent='✕ Fermer l’aperçu';
        exit.title='Revenir au Test Builder (Échap), sans sauvegarder de réponse';
        exit.setAttribute('aria-label','Fermer l’aperçu et revenir au Test Builder');
        exit.addEventListener('click',exitPreview);
        document.body.appendChild(exit);
        document.addEventListener('keydown',(event)=>{
          if(event.key==='Escape'){
            event.preventDefault();
            event.stopImmediatePropagation();
            void exitPreview();
          }
        },true);
      }
    } else {
      document.getElementById('kaltest-next').addEventListener('click', finishCurrentTest);
    }

    installKeyboardNavigation();

    if (PILOT11_MODE && state.phase === 'handoff') {
      handoffPilot11();
      return;
    }

    if (state.phase === 'exercise') renderCurrentTest();
    showPhase(state.phase || DEFAULT_PHASE, false);
    revealBriqueAfterVideoHandoff();
    if (BUILDER_PREVIEW_MODE && !BUILDER_MINI_PREVIEW_MODE) {
      const close=document.getElementById('kaltest-next');
      if(close){
        close.textContent='Fermer l’aperçu';
        close.title='Retourner dans le Test Builder, sans enregistrer de réponse';
        close.classList.add('kaloneo-preview-close');
      }
      document.getElementById('kaltest-progress').textContent='APERÇU CANDIDAT RÉEL — aucune réponse enregistrée';
    }

    replay('PILOT2_READY', {
      tests:DATA.tests.map(test => test.id),
      activeTests:ACTIVE_TESTS.map(test => test.id),
      segment:SEGMENT_KEY,
      parcours:DATA.parcours?.id || '',
      parcoursTitle:DATA.parcours?.title || '',
      customParcours:CUSTOM_PARCOURS_MODE
    });
  }

  window.sebKaltestHost = Object.freeze({
    onAbandon
  });

  window.sebKaltestPilot2 = Object.freeze({
    get state() { return JSON.parse(JSON.stringify(state)); },
    get data() { return JSON.parse(JSON.stringify(DATA)); },
    get activeTests() { return ACTIVE_TESTS.map(test => test.id); },
    get segment() { return SEGMENT_KEY; },
    get showCorrectionsDuringParcours() { return SHOW_CORRECTIONS_DURING_PARCOURS; },
    candidateBarActions,
    invokeCandidateBarAction,
    currentTest,
    evaluateTest,
    parseDurationFr,
    renderCurrentTest,
    finishCurrentTest,
    onAbandon,
    reset() {
      sessionStorage.removeItem(STATE_KEY);
      state = emptyState();
      renderIdentity();
      if (state.phase === 'exercise') renderCurrentTest();
      showPhase(state.phase || DEFAULT_PHASE, false);
      persist();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
})();
