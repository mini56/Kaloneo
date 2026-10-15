'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { exportImageRecords } = require('./kaloneo-image-export');

const BASE_TEST_ORDER = Object.freeze([
  'calculs_commandes_atelier',
  'calculs_poids_volumes',
  'horaires_reception_controle',
  'texte_a_trous_stage_logistique',
  'fractions_preparation_lots',
  'organisation_demenagement',
  'gestes_postures',
  'conversions_atelier_expedition',
  'autoevaluation_savoirs',
  'transition_video_f1',
  'construction_briques',
  'ranger_stock',
  'planning_cantine',
  'genre_nombre',
  'dictee_professionnelle',
  'tri_chevilles',
  'traitement_texte_bureautique',
  'redaction_email',
  'autoevaluation_tic',
  'paronymes_rapport',
  'gratte_ciel'
]);

const DEFAULT_MASK_ID = 'kaloneo-default';
const DEFAULT_MASK_VERSION = '1.0.0';

function createKaloneoLibrary(options = {}) {
  const dataRoot = String(options.dataRoot || '').trim();
  const seedTestsRoot = String(options.seedTestsRoot || '').trim();
  const seedImageRoots = Array.isArray(options.seedImageRoots)
    ? options.seedImageRoots
      .map(item => typeof item === 'string'
        ? { root:String(item || '').trim(), category:'Images système KALONÉO' }
        : {
            root:String(item?.root || '').trim(),
            category:String(item?.category || 'Images système KALONÉO').trim() || 'Images système KALONÉO'
          })
      .filter(item => item.root)
    : [];
  const now = typeof options.now === 'function' ? options.now : () => new Date();
  let imageSeedsEnsured = false;
  // Méta-images immuables jusqu'à un ajout via storeImageBuffer.
  // Évite de relire l'intégralité du disque pour chaque vignette.
  let cachedImageRecords = null;

  if (!dataRoot) throw new Error('dataRoot KALONÉO requis.');

  const root = path.join(dataRoot, 'KALONEO');
  const testsRoot = path.join(root, 'Bibliotheque-tests');
  const imagesRoot = path.join(root, 'Bibliotheque-images');
  const parcoursRoot = path.join(root, 'Parcours');
  const maskScreensRoot = path.join(root, 'Ecrans-masquage');
  const selectedParcoursFile = path.join(root, 'selected-parcours.json');
  // Sauvegardes privées et temporaires avant publication officielle GitHub.
  const developerV1DraftsFile = path.join(root, 'developer-v1-drafts.json');
  const developerV1BackupsDir = path.join(root, 'Backups-V1');
  const sha256=(text)=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
  const v1DraftKey=(definition)=>String(definition?.id||'')+'@'+String(definition?.version||'');

  function ensureDirectory(directory) {
    fs.mkdirSync(directory, { recursive:true });
    return directory;
  }

  function readJson(file) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (_) {
      return null;
    }
  }

  function atomicWriteJson(file, value) {
    ensureDirectory(path.dirname(file));
    const temp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', 'utf8');
    fs.renameSync(temp, file);
  }

  const IMAGE_EXTENSIONS = new Set(['.png','.jpg','.jpeg','.webp','.gif','.svg']);

  function imageMimeFromName(filename) {
    const ext = path.extname(String(filename || '')).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.svg') return 'image/svg+xml';
    return '';
  }

  function imageExtensionFromMime(mime, fallbackName = '') {
    const normalized = String(mime || '').toLowerCase();
    if (normalized === 'image/png') return '.png';
    if (normalized === 'image/jpeg') return '.jpg';
    if (normalized === 'image/webp') return '.webp';
    if (normalized === 'image/gif') return '.gif';
    if (normalized === 'image/svg+xml') return '.svg';
    const ext = path.extname(String(fallbackName || '')).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext) ? ext : '.img';
  }

  function imageIdForBuffer(buffer) {
    return 'img-' + crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
  }

  function walkImageFiles(directory, out = []) {
    if (!directory || !fs.existsSync(directory)) return out;
    for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walkImageFiles(full, out);
      else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) out.push(full);
    }
    return out;
  }

  function imageRecordPath(id) {
    return path.join(imagesRoot, safeSegment(id, 'image'), 'image.json');
  }

  function scanImageRecords() {
    if(cachedImageRecords)return cachedImageRecords;
    const out = [];
    for (const file of walkNamedFiles(imagesRoot, 'image.json')) {
      const value = readJson(file);
      if (!value || value.format !== 'kaloneo-image' || !value.id || !value.file) continue;
      const binary = path.join(path.dirname(file), String(value.file));
      if (!fs.existsSync(binary)) continue;
      out.push({ value, file, binary });
    }
    cachedImageRecords=out;
    return out;
  }

  function toImageMetadata(record) {
    const value = record.value;
    return {
      id:String(value.id),
      name:String(value.name || value.id),
      mime:String(value.mime || ''),
      size:Number(value.size || 0),
      category:String(value.category || (value.systemProvided ? 'Images système KALONÉO' : 'Mes images KALONÉO')),
      systemProvided:value.systemProvided === true,
      createdAt:String(value.createdAt || ''),
      sourceName:String(value.sourceName || ''),
      theme:String(value.theme || ''),
      orientation:String(value.orientation || '')
    };
  }

  function findImageRecord(id) {
    const wanted = String(id || '');
    return scanImageRecords().find(record => String(record.value.id) === wanted) || null;
  }

  function storeImageBuffer(buffer, payload = {}) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) return { ok:false, error:'Image vide.' };
    const name = path.basename(String(payload.name || 'image'));
    const mime = String(payload.mime || imageMimeFromName(name));
    if (!/^image\//i.test(mime)) return { ok:false, error:'Le fichier sélectionné n’est pas une image.' };

    ensureDirectory(imagesRoot);
    const id = imageIdForBuffer(buffer);
    const existing = findImageRecord(id);
    if (existing) return { ok:true, duplicate:true, image:toImageMetadata(existing) };

    const ext = imageExtensionFromMime(mime, name);
    const dir = ensureDirectory(path.join(imagesRoot, safeSegment(id, 'image')));
    const binaryName = 'image' + ext;
    const binaryFile = path.join(dir, binaryName);
    fs.writeFileSync(binaryFile, buffer);

    const stamp = now().toISOString();
    const value = {
      format:'kaloneo-image',
      schemaVersion:1,
      id,
      name:name || ('image' + ext),
      mime,
      size:buffer.length,
      category:String(payload.category || (payload.systemProvided ? 'Images système KALONÉO' : 'Mes images KALONÉO')),
      systemProvided:payload.systemProvided === true,
      sourceName:String(payload.sourceName || ''),
      theme:String(payload.theme || ''),
      orientation:String(payload.orientation || ''),
      createdAt:stamp,
      file:binaryName
    };
    const record={value,file:path.join(dir,'image.json'),binary:binaryFile};
    atomicWriteJson(record.file, value);
    if(cachedImageRecords)cachedImageRecords.push(record);
    return { ok:true, duplicate:false, image:toImageMetadata(record) };
  }

  function humanizeTheme(value) {
    return String(value || '')
      .replace(/^\d+[_ -]*/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readZipEntries(zipFile) {
    const stat = fs.statSync(zipFile);
    if (!stat.isFile()) throw new Error('Archive ZIP introuvable.');
    if (stat.size > 500 * 1024 * 1024) throw new Error('Archive ZIP trop volumineuse (500 Mo maximum).');
    const data = fs.readFileSync(zipFile);
    const minOffset = Math.max(0, data.length - 65557);
    let eocd = -1;
    for (let i = data.length - 22; i >= minOffset; i -= 1) {
      if (data.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Archive ZIP invalide : répertoire central introuvable.');

    const totalEntries = data.readUInt16LE(eocd + 10);
    const centralOffset = data.readUInt32LE(eocd + 16);
    let cursor = centralOffset;
    const entries = [];

    for (let index = 0; index < totalEntries; index += 1) {
      if (cursor + 46 > data.length || data.readUInt32LE(cursor) !== 0x02014b50) {
        throw new Error('Archive ZIP invalide : entrée centrale incorrecte.');
      }
      const flags = data.readUInt16LE(cursor + 8);
      const method = data.readUInt16LE(cursor + 10);
      const compressedSize = data.readUInt32LE(cursor + 20);
      const uncompressedSize = data.readUInt32LE(cursor + 24);
      const nameLength = data.readUInt16LE(cursor + 28);
      const extraLength = data.readUInt16LE(cursor + 30);
      const commentLength = data.readUInt16LE(cursor + 32);
      const localOffset = data.readUInt32LE(cursor + 42);
      const nameBuffer = data.subarray(cursor + 46, cursor + 46 + nameLength);
      const name = nameBuffer.toString((flags & 0x0800) ? 'utf8' : 'utf8').replace(/\\/g, '/');
      cursor += 46 + nameLength + extraLength + commentLength;

      if (!name || name.endsWith('/')) continue;
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) continue;
      if (uncompressedSize > 30 * 1024 * 1024) continue;
      if (localOffset + 30 > data.length || data.readUInt32LE(localOffset) !== 0x04034b50) continue;

      const localNameLength = data.readUInt16LE(localOffset + 26);
      const localExtraLength = data.readUInt16LE(localOffset + 28);
      const payloadOffset = localOffset + 30 + localNameLength + localExtraLength;
      if (payloadOffset + compressedSize > data.length) continue;

      const compressed = data.subarray(payloadOffset, payloadOffset + compressedSize);
      let buffer;
      if (method === 0) buffer = Buffer.from(compressed);
      else if (method === 8) buffer = zlib.inflateRawSync(compressed);
      else continue;
      if (!buffer.length || buffer.length > 30 * 1024 * 1024) continue;

      entries.push({ name, buffer, mime:imageMimeFromName(name) });
      if (entries.length >= 1000) break;
    }
    return entries;
  }

  function exportImageZip(zipFile) {
    ensureSeed();
    // Les images d'origine du programme sont livrées sur chaque PC.
    // N'exporter que les ajouts de l'utilisateur, sans toucher à la bibliothèque.
    const originals=scanImageRecords()
      .filter(record=>record.value.systemProvided!==true);
    return exportImageRecords(originals,zipFile);
  }

  function importImageZip(zipFile) {
    ensureSeed();
    const file = String(zipFile || '').trim();
    if (!file || path.extname(file).toLowerCase() !== '.zip') {
      return { ok:false, error:'Sélectionnez une archive .zip.' };
    }
    let entries;
    try { entries = readZipEntries(file); }
    catch (error) { return { ok:false, error:error?.message || String(error) }; }
    if (!entries.length) return { ok:false, error:'Aucune image PNG/JPG/WEBP/GIF/SVG trouvée dans le ZIP.' };

    let added = 0;
    let duplicates = 0;
    let failed = 0;
    const themes = new Set();

    for (const entry of entries) {
      try {
        const parts = entry.name.split('/').filter(Boolean);
        const filename = parts.at(-1) || 'image';
        const parent = parts.at(-2) || '';
        const grandParent = parts.at(-3) || '';
        const orientation = /^(paysage|portrait)$/i.test(parent) ? parent : '';
        const themeRaw = orientation ? grandParent : (parent || path.basename(file, '.zip'));
        const theme = humanizeTheme(themeRaw) || 'Images ZIP';
        const result = storeImageBuffer(entry.buffer, {
          name:filename,
          mime:entry.mime,
          category:theme,
          theme,
          orientation:orientation ? (orientation.charAt(0).toUpperCase() + orientation.slice(1).toLowerCase()) : '',
          systemProvided:false,
          sourceName:entry.name
        });
        if (result?.ok) {
          if (result.duplicate) duplicates += 1;
          else added += 1;
          themes.add(theme);
        } else failed += 1;
      } catch (_) {
        failed += 1;
      }
    }

    return {
      ok:true,
      archive:path.basename(file),
      added,
      duplicates,
      failed,
      total:entries.length,
      themes:[...themes].sort((a,b)=>a.localeCompare(b,'fr'))
    };
  }

  function seedImageLibrary() {
    ensureDirectory(imagesRoot);
    for (const seed of seedImageRoots) {
      if (!seed.root || !fs.existsSync(seed.root)) continue;
      for (const file of walkImageFiles(seed.root)) {
        try {
          const buffer = fs.readFileSync(file);
          storeImageBuffer(buffer, {
            name:path.basename(file),
            mime:imageMimeFromName(file),
            category:seed.category,
            systemProvided:true,
            sourceName:path.relative(seed.root, file).replace(/\\/g, '/')
          });
        } catch (_) {}
      }
    }
  }

  function seedImagesFromTests() {
    if (!seedTestsRoot || !fs.existsSync(seedTestsRoot)) return;
    const seen = new Set();
    const visit = (value, hint = 'image-test') => {
      if (typeof value === 'string') {
        if (!/^data:image\//i.test(value) || seen.has(value)) return;
        seen.add(value);
        const match = value.match(/^data:(image\/[^;,]+)(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/i);
        if (!match) return;
        try {
          const buffer = Buffer.from(match[2].replace(/\s+/g,''), 'base64');
          storeImageBuffer(buffer, {
            name:hint,
            mime:match[1],
            category:'Images embarquées dans les tests',
            systemProvided:true,
            sourceName:'test.json'
          });
        } catch (_) {}
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item,index) => visit(item, hint + '-' + (index + 1)));
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key,item] of Object.entries(value)) {
          const nextHint = /name|filename/i.test(key) && typeof item === 'string' ? item : hint;
          visit(item, nextHint);
        }
      }
    };
    for (const file of walkTestFiles(seedTestsRoot)) {
      const definition = readJson(file);
      if (definition) visit(definition, safeSegment(definition.id || path.basename(path.dirname(file)), 'image-test'));
    }
  }

  function listImages() {
    // La bibliothèque est initialisée dès createKaloneoLibrary().
    // Ne pas réexécuter la synchronisation de toutes les V1 à chaque liste.
    return scanImageRecords()
      .map(toImageMetadata)
      .sort((a,b) => {
        if (a.systemProvided !== b.systemProvided) return a.systemProvided ? -1 : 1;
        const category = a.category.localeCompare(b.category, 'fr');
        if (category) return category;
        return a.name.localeCompare(b.name, 'fr');
      });
  }

  function getImage(id) {
    // Chaque miniature doit être une lecture ciblée, pas une resynchronisation
    // du catalogue V1 + un parcours complet des dossiers d'images.
    const record = findImageRecord(id);
    if (!record) return { ok:false, error:'Image KALONÉO introuvable.' };
    const buffer = fs.readFileSync(record.binary);
    const meta = toImageMetadata(record);
    return {
      ok:true,
      image:{
        ...meta,
        data:'data:' + meta.mime + ';base64,' + buffer.toString('base64')
      }
    };
  }

  function saveImage(payload = {}) {
    ensureSeed();
    const name = String(payload.name || '').trim();
    const data = String(payload.data || '');
    const match = data.match(/^data:(image\/[^;,]+)(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) return { ok:false, error:'Image KALONÉO invalide ou non embarquée.' };
    let buffer;
    try { buffer = Buffer.from(match[2].replace(/\s+/g,''), 'base64'); }
    catch (_) { return { ok:false, error:'Impossible de lire l’image.' }; }
    return storeImageBuffer(buffer, {
      name:name || 'image',
      mime:String(payload.mime || match[1]),
      category:String(payload.category || 'Mes images KALONÉO'),
      systemProvided:false,
      sourceName:''
    });
  }

  function copyMissingTree(source, destination) {
    if (!source || !fs.existsSync(source)) return;
    ensureDirectory(destination);
    for (const entry of fs.readdirSync(source, { withFileTypes:true })) {
      const from = path.join(source, entry.name);
      const to = path.join(destination, entry.name);
      if (entry.isDirectory()) {
        copyMissingTree(from, to);
      } else if (!fs.existsSync(to)) {
        fs.copyFileSync(from, to);
      }
    }
  }

  function isBundledMigratedTest(definition) {
    const id = String(definition?.id || '');
    return BASE_TEST_ORDER.includes(id) &&
      definition?.sourceMigration &&
      typeof definition.sourceMigration === 'object' &&
      definition?.kaloneoLibrary?.adminModified !== true;
  }

  function syncBundledSeedTests(source, destination) {
    if (!source || !fs.existsSync(source)) return;
    copyMissingTree(source, destination);

    // Official TESTS_V1 takes precedence when a new Setup is installed.
    // A protected V1 that is absent from this manifest still uses the
    // historical seed synchronization, unchanged.
    const manifest=readJson(path.join(path.dirname(source),'TESTS_V1-manifest.json'));
    const official=new Set(
      manifest?.format==='kaloneo-official-v1-overrides' && Array.isArray(manifest.tests)
        ? manifest.tests.filter(x=>x?.version==='1.0.0').map(x=>String(x.id))
        : []
    );
    const developerDrafts=readJson(developerV1DraftsFile)||{};
    let draftsChanged=false;

    for (const seedFile of walkTestFiles(source)) {
      const seedDefinition = readJson(seedFile);
      if(!official.has(String(seedDefinition?.id||'')) &&
        !isBundledMigratedTest(seedDefinition)) continue;

      const relative = path.relative(source, seedFile);
      const targetFile = path.join(destination, relative);
      const currentDefinition = readJson(targetFile);

      // Une version fournie avec KALONÉO est la référence système immuable.
      // Si une ancienne version de l'application a permis de modifier cette
      // V1 localement, on la restaure depuis le seed embarqué. Les V2/V3 admin
      // utilisent d'autres numéros de version et ne sont donc jamais touchées.
      const currentJson = currentDefinition ? JSON.stringify(currentDefinition) : '';
      const seedJson = JSON.stringify(seedDefinition);
      const key=v1DraftKey(seedDefinition);
      const draft=developerDrafts[key];
      // Pendant les corrections V1, un enregistrement Admin accompagné de
      // sa sauvegarde ne doit pas être effacé silencieusement par un Setup.
      // Le verrouillage final des V1 sera une décision explicite.
      if(draft && currentDefinition?.kaloneoLibrary?.adminModified===true &&
          currentJson!==seedJson)continue;
      if(draft){
        delete developerDrafts[key];
        draftsChanged=true;
      }
      if (currentJson !== seedJson) atomicWriteJson(targetFile, seedDefinition);
    }
    if(draftsChanged)atomicWriteJson(developerV1DraftsFile,developerDrafts);
  }

  function walkNamedFiles(directory, filename, out = []) {
    if (!fs.existsSync(directory)) return out;
    for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walkNamedFiles(full, filename, out);
      else if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) out.push(full);
    }
    return out;
  }

  function walkTestFiles(directory, out = []) {
    return walkNamedFiles(directory, 'test.json', out);
  }

  function compareVersion(a, b) {
    const parse = value => String(value || '0.0.0').split('-')[0].split('.').map(part => Number(part) || 0);
    const av = parse(a);
    const bv = parse(b);
    for (let i = 0; i < Math.max(av.length, bv.length, 3); i += 1) {
      const delta = (av[i] || 0) - (bv[i] || 0);
      if (delta) return delta;
    }
    return String(a || '').localeCompare(String(b || ''));
  }

  function safeSegment(value, fallback = 'item') {
    const clean = String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return clean || fallback;
  }

  function roleOf(definition) {
    const explicit = String(definition && definition.pageRole || '').toLowerCase();
    if (explicit === 'introduction' || explicit === 'fin' || explicit === 'test') return explicit;
    if (definition && definition.behavior && definition.behavior.terminal === true) return 'fin';
    return 'test';
  }

  function scanAllDefinitions() {
    const out = [];
    for (const file of walkTestFiles(testsRoot)) {
      const definition = readJson(file);
      if (!definition || !definition.id || !definition.version) continue;
      out.push({ definition, file });
    }
    return out;
  }

  function scanLatestDefinitions() {
    const byId = new Map();
    for (const record of scanAllDefinitions()) {
      const definition = record.definition;
      const current = byId.get(definition.id);
      if (!current || compareVersion(definition.version, current.definition.version) > 0) {
        byId.set(definition.id, record);
      }
    }
    return byId;
  }

  function toTestMetadata(record) {
    const definition = record.definition;
    const role = roleOf(definition);
    const questions = Array.isArray(definition.questions) ? definition.questions.length : 0;
    const tools = [];
    if (definition.pageTools && Array.isArray(definition.pageTools.enabled)) tools.push(...definition.pageTools.enabled);
    if (definition.calculator && definition.calculator.compatible) tools.push('calculator');
    if (definition.chrono && definition.chrono.enabled) tools.push('chrono');

    const rawCategory = String(definition.category || (role === 'introduction' ? 'introduction' : role === 'fin' ? 'fin' : 'autres'));
    const category = String(definition.id) === 'planning_cantine' ? 'planification' : rawCategory;

    return {
      id:String(definition.id),
      version:String(definition.version),
      title:String(definition.title || definition.id),
      category,
      role,
      kind:String(definition.kind || 'complex'),
      activityType:String(definition.activityType || ''),
      scored:definition.scored !== false,
      description:String(definition.description || ''),
      questionCount:questions,
      icon:definition.icon || null,
      tools:[...new Set(tools)],
      protectedVersion:seedContainsTest(definition.id, definition.version),
      adminModified:definition?.kaloneoLibrary?.adminModified === true
    };
  }

  function validateTestDefinition(definition) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return 'Définition KALTEST absente.';
    if (Number(definition.kaltestFormat) !== 1) return 'Format KALTEST non supporté.';
    if (!String(definition.id || '').trim()) return 'ID du test obligatoire.';
    if (!String(definition.version || '').trim()) return 'Version du test obligatoire.';
    if (!String(definition.title || '').trim()) return 'Titre du test obligatoire.';
    if (!['test','introduction','fin'].includes(roleOf(definition))) return 'Type de page KALTEST invalide.';
    return '';
  }

  function exactTestFile(id, version) {
    const wantedId = String(id || '');
    const wantedVersion = String(version || '');
    for (const file of walkTestFiles(testsRoot)) {
      const definition = readJson(file);
      if (definition && String(definition.id) === wantedId && String(definition.version) === wantedVersion) return file;
    }
    return '';
  }

  function seedContainsTest(id, version) {
    if (!seedTestsRoot || !fs.existsSync(seedTestsRoot)) return false;
    const wantedId = String(id || '');
    const wantedVersion = String(version || '');
    return walkTestFiles(seedTestsRoot).some(file => {
      const definition = readJson(file);
      return definition &&
        String(definition.id || '') === wantedId &&
        String(definition.version || '') === wantedVersion;
    });
  }

  function parcoursUsingTest(id, version) {
    const wantedId = String(id || '');
    const wantedVersion = String(version || '');
    return readAllParcours()
      .filter(item => {
        const refs = [
          item.introduction,
          ...(Array.isArray(item.tests) ? item.tests : []),
          item.fin
        ].filter(Boolean);
        return refs.some(ref =>
          String(ref.id || '') === wantedId &&
          String(ref.version || '') === wantedVersion
        );
      })
      .map(item => ({ id:String(item.id || ''), name:String(item.name || item.id || '') }));
  }

  function getTest(id, version) {
    ensureSeed();
    const file = exactTestFile(id, version);
    if (!file) return { ok:false, error:'Test KALTEST introuvable.' };
    const definition = readJson(file);
    if (!definition) return { ok:false, error:'Test KALTEST illisible.' };
    return { ok:true, definition };
  }

  function saveTest(definition, options = {}) {
    ensureSeed();
    const error = validateTestDefinition(definition);
    if (error) return { ok:false, error };

    const value = JSON.parse(JSON.stringify(definition));
    value.id = String(value.id).trim();
    value.version = String(value.version).trim();
    value.title = String(value.title).trim();
    value.kaloneoLibrary = Object.assign({}, value.kaloneoLibrary || {}, {
      adminModified:true,
      modifiedAt:now().toISOString()
    });

    // Les versions fournies par KALONÉO (V1 système) sont en lecture seule.
    // Une personnalisation doit être enregistrée sous une nouvelle version
    // (V2, V3, ...), jamais écraser le seed système.
    const isProtected=seedContainsTest(value.id,value.version);
    if(isProtected && options.allowSeedOverwrite!==true) {
      return {
        ok:false,
        code:'PROTECTED_VERSION',
        error:'Cette version est fournie avec KALONÉO et ne peut pas être modifiée. Enregistrez vos changements sous une nouvelle version (V2 ou supérieure).'
      };
    }

    const existing = exactTestFile(value.id, value.version);
    if (existing && options.overwrite !== true) {
      return { ok:false, code:'EXISTS', error:'Cette version du test existe déjà dans la bibliothèque.' };
    }

    const target = existing || path.join(
      testsRoot,
      safeSegment(value.id, 'test'),
      safeSegment(value.version, '1.0.0'),
      'test.json'
    );
    if(isProtected){
      if(!existing)return {ok:false,error:'V1 protégée introuvable.'};
      const seedFile=walkTestFiles(seedTestsRoot).find(file=>{
        const test=readJson(file);
        return test?.id===value.id && test?.version===value.version;
      });
      const seed=seedFile&&readJson(seedFile);
      if(!seed)return {ok:false,error:'Source V1 protégée introuvable.'};
      // Avant chaque remplacement : copie de sécurité dans le stockage interne.
      const stamp=now().toISOString().replace(/[^0-9TZ]/g,'');
      const backup=path.join(developerV1BackupsDir,safeSegment(value.id),stamp+'-'+process.pid+'.json');
      ensureDirectory(path.dirname(backup));
      fs.copyFileSync(existing,backup);
      const draft=readJson(developerV1DraftsFile)||{};
      draft[v1DraftKey(value)]={seedHash:sha256(JSON.stringify(seed)),savedAt:now().toISOString()};
      atomicWriteJson(developerV1DraftsFile,draft);
    }
    atomicWriteJson(target, value);
    const record = { definition:value, file:target };
    return { ok:true, replaced:Boolean(existing), test:toTestMetadata(record) };
  }

  function deleteTest(id, version) {
    ensureSeed();
    const wantedId = String(id || '').trim();
    const wantedVersion = String(version || '').trim();
    if (!wantedId || !wantedVersion) return { ok:false, error:'Test à supprimer invalide.' };

    const file = exactTestFile(wantedId, wantedVersion);
    if (!file) return { ok:false, error:'Cette version du test n’existe plus dans la bibliothèque.' };

    const definition = readJson(file);
    if (!definition) return { ok:false, error:'Test KALTEST illisible.' };
    if (roleOf(definition) !== 'test') {
      return { ok:false, code:'PROTECTED', error:'Les pages d’introduction et de fin ne se suppriment pas depuis la bibliothèque de tests.' };
    }
    if (seedContainsTest(wantedId, wantedVersion)) {
      return {
        ok:false,
        code:'PROTECTED',
        error:'Cette version est fournie avec KALONÉO et reste protégée. Créez une nouvelle version si vous souhaitez la personnaliser.'
      };
    }

    const usages = parcoursUsingTest(wantedId, wantedVersion);
    if (usages.length) {
      return {
        ok:false,
        code:'IN_USE',
        usages,
        error:'Ce test est utilisé dans ' + usages.length + ' parcours enregistré' + (usages.length > 1 ? 's' : '') + '.'
      };
    }

    try {
      fs.unlinkSync(file);
      let directory = path.dirname(file);
      const stop = path.resolve(testsRoot);
      while (path.resolve(directory).startsWith(stop) && path.resolve(directory) !== stop) {
        if (fs.readdirSync(directory).length) break;
        fs.rmdirSync(directory);
        directory = path.dirname(directory);
      }
      return { ok:true, deleted:{ id:wantedId, version:wantedVersion, title:String(definition.title || wantedId) } };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  }

  function defaultMaskScreen() {
    return {
      format:'kaloneo-mask-screen',
      schemaVersion:1,
      id:DEFAULT_MASK_ID,
      version:DEFAULT_MASK_VERSION,
      name:'KALONÉO',
      systemProvided:true,
      createdAt:'2026-10-05T00:00:00.000Z',
      updatedAt:'2026-10-05T00:00:00.000Z',
      content:{
        text:'KALONÉO\nAu cœur d’un nouvel élan',
        image:''
      }
    };
  }

  function maskFile(id, version) {
    return path.join(maskScreensRoot, safeSegment(id, 'masque'), safeSegment(version, '1.0.0'), 'mask.json');
  }

  function ensureDefaultMaskScreen() {
    const target = maskFile(DEFAULT_MASK_ID, DEFAULT_MASK_VERSION);
    if (!fs.existsSync(target)) atomicWriteJson(target, defaultMaskScreen());
  }

  function scanMaskScreens() {
    const out = [];
    for (const file of walkNamedFiles(maskScreensRoot, 'mask.json')) {
      const value = readJson(file);
      if (!value || value.format !== 'kaloneo-mask-screen' || !value.id || !value.version) continue;
      out.push({ value, file });
    }
    return out;
  }

  function toMaskMetadata(record) {
    const value = record.value;
    return {
      id:String(value.id),
      version:String(value.version),
      name:String(value.name || value.id),
      systemProvided:value.systemProvided === true,
      hasText:Boolean(String(value.content?.text || '').trim()),
      hasImage:Boolean(String(value.content?.image || '').trim())
    };
  }

  function listMaskScreens() {
    ensureSeed();
    return scanMaskScreens()
      .map(toMaskMetadata)
      .sort((a,b) => {
        if (a.systemProvided !== b.systemProvided) return a.systemProvided ? -1 : 1;
        return a.name.localeCompare(b.name, 'fr');
      });
  }

  function findMaskScreen(id, version) {
    const wantedId = String(id || DEFAULT_MASK_ID);
    const wantedVersion = String(version || DEFAULT_MASK_VERSION);
    return scanMaskScreens().find(record =>
      String(record.value.id) === wantedId && String(record.value.version) === wantedVersion
    ) || null;
  }

  function getMaskScreen(ref = null) {
    ensureSeed();
    const id = String(ref && ref.id || DEFAULT_MASK_ID);
    const version = String(ref && ref.version || DEFAULT_MASK_VERSION);
    let record = findMaskScreen(id, version);
    if (!record && (id !== DEFAULT_MASK_ID || version !== DEFAULT_MASK_VERSION)) {
      record = findMaskScreen(DEFAULT_MASK_ID, DEFAULT_MASK_VERSION);
    }
    if (!record) return { ok:false, error:'Écran de masquage KALONÉO introuvable.' };
    return { ok:true, maskScreen:JSON.parse(JSON.stringify(record.value)) };
  }

  function saveMaskScreen(payload = {}, options = {}) {
    ensureSeed();
    const id = String(payload.id || '').trim();
    const version = String(payload.version || '1.0.0').trim();
    const name = String(payload.name || '').trim();
    const text = String(payload.content?.text || '');
    const image = String(payload.content?.image || '');

    if (!id) return { ok:false, error:'ID de l’écran de masquage obligatoire.' };
    if (!version) return { ok:false, error:'Version de l’écran de masquage obligatoire.' };
    if (!name) return { ok:false, error:'Nom de l’écran de masquage obligatoire.' };
    if (!text.trim() && !image.trim()) return { ok:false, error:'Ajoutez un texte, une image, ou les deux.' };
    if (id === DEFAULT_MASK_ID) return { ok:false, error:'L’écran KALONÉO par défaut est protégé.' };
    if (image && !/^data:image\//i.test(image)) return { ok:false, error:'L’image de masquage doit être embarquée dans KALONÉO.' };

    const target = maskFile(id, version);
    const exists = fs.existsSync(target);
    if (exists && options.overwrite !== true) {
      return { ok:false, code:'EXISTS', error:'Cette version de l’écran de masquage existe déjà.' };
    }

    const previous = exists ? readJson(target) : null;
    const stamp = now().toISOString();
    const value = {
      format:'kaloneo-mask-screen',
      schemaVersion:1,
      id,
      version,
      name,
      systemProvided:false,
      createdAt:String(previous?.createdAt || stamp),
      updatedAt:stamp,
      content:{ text, image }
    };
    atomicWriteJson(target, value);
    return { ok:true, replaced:exists, maskScreen:toMaskMetadata({ value, file:target }) };
  }

  function safeNameKey(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr-FR')
      .replace(/\s+/g, ' ');
  }

  function slugify(value) {
    const slug = safeNameKey(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'parcours';
  }

  function parcoursFiles() {
    ensureDirectory(parcoursRoot);
    return fs.readdirSync(parcoursRoot, { withFileTypes:true })
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map(entry => path.join(parcoursRoot, entry.name));
  }

  function readAllParcours() {
    const out = [];
    for (const file of parcoursFiles()) {
      const value = readJson(file);
      if (!value || value.format !== 'kaloneo-parcours') continue;
      out.push(value);
    }
    return out;
  }

  function refFor(definition) {
    return { id:String(definition.id), version:String(definition.version) };
  }

  function maskRefFor(value) {
    return { id:String(value.id), version:String(value.version) };
  }

  function defaultMaskRef() {
    return { id:DEFAULT_MASK_ID, version:DEFAULT_MASK_VERSION };
  }

  function ensureBaseParcours() {
    const existing = readAllParcours().find(item => item && item.id === 'parcours-de-base');
    if (existing) {
      if (!existing.maskScreen) {
        existing.maskScreen = defaultMaskRef();
        existing.schemaVersion = Math.max(2, Number(existing.schemaVersion) || 1);
        atomicWriteJson(path.join(parcoursRoot, existing.id + '.json'), existing);
      }
      return;
    }

    const definitions = scanLatestDefinitions();
    const introRecord = [...definitions.values()].find(record => roleOf(record.definition) === 'introduction');
    const finRecord = [...definitions.values()].find(record => roleOf(record.definition) === 'fin');
    if (!introRecord || !finRecord) return;

    const tests = BASE_TEST_ORDER
      .map(id => definitions.get(id))
      .filter(record => record && roleOf(record.definition) === 'test')
      .map(record => refFor(record.definition));

    const stamp = now().toISOString();
    const base = {
      format:'kaloneo-parcours',
      schemaVersion:2,
      id:'parcours-de-base',
      name:'Parcours de base',
      creator:'SEB EvalPro / KALONÉO',
      systemProvided:true,
      createdAt:stamp,
      updatedAt:stamp,
      maskScreen:defaultMaskRef(),
      introduction:refFor(introRecord.definition),
      tests,
      fin:refFor(finRecord.definition)
    };
    atomicWriteJson(path.join(parcoursRoot, base.id + '.json'), base);
  }

  function ensureSeed() {
    ensureDirectory(root);
    ensureDirectory(testsRoot);
    ensureDirectory(imagesRoot);
    ensureDirectory(parcoursRoot);
    ensureDirectory(maskScreensRoot);
    if (seedTestsRoot && fs.existsSync(seedTestsRoot)) syncBundledSeedTests(seedTestsRoot, testsRoot);
    if (!imageSeedsEnsured) {
      seedImageLibrary();
      seedImagesFromTests();
      imageSeedsEnsured = true;
    }
    ensureDefaultMaskScreen();
    ensureBaseParcours();
    return true;
  }

  function listTests() {
    ensureSeed();
    return scanAllDefinitions()
      .map(toTestMetadata)
      .sort((a, b) => {
        const roleOrder = { introduction:0, test:1, fin:2 };
        const roleDelta = (roleOrder[a.role] ?? 1) - (roleOrder[b.role] ?? 1);
        if (roleDelta) return roleDelta;
        const categoryDelta = a.category.localeCompare(b.category, 'fr');
        if (categoryDelta) return categoryDelta;
        const titleDelta = a.title.localeCompare(b.title, 'fr');
        if (titleDelta) return titleDelta;
        // Pour un même test, présenter d'abord la version la plus récente
        // sans masquer les versions antérieures.
        return compareVersion(b.version, a.version);
      });
  }

  function findParcours(id) {
    const wanted = String(id || '').trim();
    if (!wanted) return null;
    return readAllParcours().find(item => String(item.id || '') === wanted) || null;
  }

  function getParcours(id) {
    ensureSeed();
    const value = findParcours(id);
    if (!value) return { ok:false, error:'Parcours introuvable.' };
    return { ok:true, parcours:JSON.parse(JSON.stringify(value)) };
  }

  function describeRef(ref, expectedRole) {
    if (!ref) return null;
    const definitions = scanLatestDefinitions();
    try {
      const definition = resolveDefinition(definitions, ref, expectedRole);
      return toTestMetadata({ definition, file:'' });
    } catch (_) {
      return null;
    }
  }

  function describeMask(ref) {
    const record = findMaskScreen(ref?.id, ref?.version);
    return record ? toMaskMetadata(record) : null;
  }

  function parcoursDetails(item) {
    const value = item && item.format === 'kaloneo-parcours' ? item : null;
    if (!value) return null;
    return {
      id:String(value.id || ''),
      name:String(value.name || ''),
      creator:String(value.creator || ''),
      createdAt:String(value.createdAt || ''),
      updatedAt:String(value.updatedAt || ''),
      systemProvided:value.systemProvided === true,
      testCount:Array.isArray(value.tests) ? value.tests.length : 0,
      maskScreen:value.maskScreen || defaultMaskRef(),
      maskScreenMeta:describeMask(value.maskScreen || defaultMaskRef()),
      introduction:value.introduction || null,
      introductionMeta:describeRef(value.introduction, 'introduction'),
      tests:(Array.isArray(value.tests) ? value.tests : []).map(ref => ({
        ref:JSON.parse(JSON.stringify(ref)),
        meta:describeRef(ref, 'test')
      })),
      fin:value.fin || null,
      finMeta:describeRef(value.fin, 'fin')
    };
  }

  function getParcoursDetails(id) {
    ensureSeed();
    const value = findParcours(id);
    if (!value) return { ok:false, error:'Parcours introuvable.' };
    return { ok:true, details:parcoursDetails(value) };
  }

  function readSelectedParcoursSelection() {
    const saved = readJson(selectedParcoursFile) || {};
    const id = String(saved.id || '').trim();
    const selectedId = id && findParcours(id) ? id : 'parcours-de-base';
    return {
      id:selectedId,
      launchOptions:{
        // Règle KALONÉO : aucune correction pendant le parcours sauf choix explicite Admin.
        showCorrectionsDuringParcours:saved.launchOptions?.showCorrectionsDuringParcours === true
      }
    };
  }

  function readSelectedParcoursId() {
    return readSelectedParcoursSelection().id;
  }

  function getSelectedParcours() {
    ensureSeed();
    const selection = readSelectedParcoursSelection();
    const value = findParcours(selection.id) || findParcours('parcours-de-base');
    if (!value) return { ok:false, error:'Aucun parcours disponible.' };
    return {
      ok:true,
      selected:{
        ...parcoursDetails(value),
        launchOptions:JSON.parse(JSON.stringify(selection.launchOptions))
      }
    };
  }

  function selectParcours(id, options = {}) {
    ensureSeed();
    const value = findParcours(id);
    if (!value) return { ok:false, error:'Parcours introuvable.' };
    const launchOptions = {
      showCorrectionsDuringParcours:options.showCorrectionsDuringParcours === true
    };
    atomicWriteJson(selectedParcoursFile, {
      format:'kaloneo-selected-parcours',
      schemaVersion:2,
      id:String(value.id),
      launchOptions,
      selectedAt:now().toISOString()
    });
    return {
      ok:true,
      selected:{
        ...parcoursDetails(value),
        launchOptions:JSON.parse(JSON.stringify(launchOptions))
      }
    };
  }

  function resolveParcoursRuntime(id = '') {
    ensureSeed();
    const persistedSelection = readSelectedParcoursSelection();
    const selectedId = String(id || persistedSelection.id || 'parcours-de-base');
    const launchOptions = id
      ? {showCorrectionsDuringParcours:false}
      : persistedSelection.launchOptions;
    const value = findParcours(selectedId) || findParcours('parcours-de-base');
    if (!value) return { ok:false, error:'Parcours KALONÉO introuvable.' };

    const definitions = scanLatestDefinitions();
    try {
      const introduction = resolveDefinition(definitions, value.introduction, 'introduction');
      const tests = (Array.isArray(value.tests) ? value.tests : []).map(ref => {
        const definition = JSON.parse(JSON.stringify(resolveDefinition(definitions, ref, 'test')));
        if (String(definition.id) === 'planning_cantine') definition.category = 'planification';
        return definition;
      });
      const fin = resolveDefinition(definitions, value.fin, 'fin');
      const mask = getMaskScreen(value.maskScreen || defaultMaskRef());
      if (!mask.ok) throw new Error(mask.error || 'Écran de masquage introuvable.');
      return {
        ok:true,
        runtime:{
          id:String(value.id),
          title:String(value.name || value.id),
          creator:String(value.creator || ''),
          launchOptions:{
            showCorrectionsDuringParcours:launchOptions.showCorrectionsDuringParcours === true
          },
          maskScreen:value.maskScreen || defaultMaskRef(),
          maskScreenDefinition:mask.maskScreen,
          introduction:JSON.parse(JSON.stringify(introduction)),
          tests:JSON.parse(JSON.stringify(tests)),
          fin:JSON.parse(JSON.stringify(fin))
        }
      };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  }

  function buildParcoursPackage(id) {
    ensureSeed();
    const value = findParcours(id);
    if (!value) return { ok:false, error:'Parcours introuvable.' };

    const definitions = scanLatestDefinitions();
    try {
      const introduction = resolveDefinition(definitions, value.introduction, 'introduction');
      const tests = (Array.isArray(value.tests) ? value.tests : []).map(ref => resolveDefinition(definitions, ref, 'test'));
      const fin = resolveDefinition(definitions, value.fin, 'fin');
      const maskResult = getMaskScreen(value.maskScreen || defaultMaskRef());
      if (!maskResult.ok) throw new Error(maskResult.error || 'Écran de masquage introuvable.');

      return {
        ok:true,
        package:{
          format:'kaloneo-parcours-package',
          schemaVersion:1,
          exportedAt:now().toISOString(),
          parcours:{
            name:String(value.name || ''),
            creator:String(value.creator || ''),
            maskScreen:value.maskScreen || defaultMaskRef(),
            introduction:value.introduction,
            tests:Array.isArray(value.tests) ? JSON.parse(JSON.stringify(value.tests)) : [],
            fin:value.fin
          },
          definitions:[
            JSON.parse(JSON.stringify(introduction)),
            ...tests.map(definition => JSON.parse(JSON.stringify(definition))),
            JSON.parse(JSON.stringify(fin))
          ],
          maskScreen:JSON.parse(JSON.stringify(maskResult.maskScreen))
        }
      };
    } catch (error) {
      return { ok:false, error:error && error.message ? error.message : String(error) };
    }
  }

  function importParcoursPackage(payload = {}) {
    ensureSeed();
    if (!payload || payload.format !== 'kaloneo-parcours-package' || Number(payload.schemaVersion) !== 1) {
      return { ok:false, error:'Paquet de parcours KALONÉO invalide.' };
    }
    const parcours = payload.parcours || {};
    const name = String(parcours.name || '').trim();
    const creator = String(parcours.creator || '').trim();
    if (!name || !creator) return { ok:false, error:'Le paquet de parcours ne contient pas son nom ou son créateur.' };

    const existingName = readAllParcours().find(item => safeNameKey(item.name) === safeNameKey(name));
    if (existingName) {
      return { ok:false, code:'EXISTS_NAME', error:'Un parcours portant déjà le nom « ' + name + ' » existe.' };
    }

    const packageDefinitions = Array.isArray(payload.definitions) ? payload.definitions : [];
    const byKey = new Map();
    for (const definition of packageDefinitions) {
      const validation = validateTestDefinition(definition);
      if (validation) return { ok:false, error:'Définition incluse invalide : ' + validation };
      byKey.set(String(definition.id) + '@' + String(definition.version), definition);
    }

    const refs = [
      parcours.introduction,
      ...(Array.isArray(parcours.tests) ? parcours.tests : []),
      parcours.fin
    ].filter(Boolean);

    for (const ref of refs) {
      const key = String(ref.id || '') + '@' + String(ref.version || '');
      const existingFile = exactTestFile(ref.id, ref.version);
      if (existingFile) {
        const existingDefinition = readJson(existingFile);
        const incomingDefinition = byKey.get(key);
        if (incomingDefinition && existingDefinition) {
          const clean = value => {
            const copy = JSON.parse(JSON.stringify(value));
            if (copy.kaloneoLibrary) delete copy.kaloneoLibrary;
            return copy;
          };
          if (JSON.stringify(clean(existingDefinition)) !== JSON.stringify(clean(incomingDefinition))) {
            return { ok:false, code:'TEST_CONFLICT', error:'Conflit sur le test ' + key + ' : une version différente existe déjà.' };
          }
        }
      } else if (!byKey.has(key)) {
        return { ok:false, error:'Le paquet ne contient pas le test requis ' + key + '.' };
      }
    }

    const maskDefinition = payload.maskScreen;
    const maskRef = parcours.maskScreen || defaultMaskRef();
    const existingMask = findMaskScreen(maskRef.id, maskRef.version);
    if (!existingMask && maskDefinition) {
      const savedMask = saveMaskScreen(maskDefinition, { overwrite:false });
      if (!savedMask.ok) return savedMask;
    } else if (!existingMask && !maskDefinition) {
      return { ok:false, error:'Écran de masquage requis absent du paquet.' };
    }

    for (const definition of packageDefinitions) {
      if (exactTestFile(definition.id, definition.version)) continue;
      const saved = saveTest(definition, { overwrite:false });
      if (!saved.ok) return saved;
    }

    return saveParcours({
      name,
      creator,
      maskScreen:maskRef,
      introduction:parcours.introduction,
      tests:Array.isArray(parcours.tests) ? parcours.tests : [],
      fin:parcours.fin
    });
  }

  function listParcours() {
    ensureSeed();
    return readAllParcours()
      .map(item => ({
        id:String(item.id || ''),
        name:String(item.name || ''),
        creator:String(item.creator || ''),
        createdAt:String(item.createdAt || ''),
        updatedAt:String(item.updatedAt || ''),
        systemProvided:item.systemProvided === true,
        selected:String(item.id || '') === readSelectedParcoursId(),
        testCount:Array.isArray(item.tests) ? item.tests.length : 0,
        maskScreen:item.maskScreen || defaultMaskRef(),
        maskScreenMeta:describeMask(item.maskScreen || defaultMaskRef()),
        introduction:item.introduction || null,
        fin:item.fin || null
      }))
      .sort((a, b) => {
        if (a.systemProvided !== b.systemProvided) return a.systemProvided ? -1 : 1;
        return a.name.localeCompare(b.name, 'fr');
      });
  }

  function resolveDefinition(definitions, ref, expectedRole) {
    if (!ref || typeof ref !== 'object') throw new Error('Référence de page invalide.');
    const id = String(ref.id || '');
    const version = String(ref.version || '');
    // Un parcours mémorise volontairement id + version. La présence d'une
    // V2/V3 ne doit jamais rendre sa V1 introuvable : on résout d'abord la
    // version exacte enregistrée dans le parcours, et non la dernière version.
    const file = exactTestFile(id, version);
    if (!file) {
      const latest = definitions && typeof definitions.get === 'function' ? definitions.get(id) : null;
      if (!latest) throw new Error('Page KALTEST introuvable : ' + id);
      throw new Error('Version KALTEST introuvable : ' + id + ' ' + version);
    }
    const definition = readJson(file);
    if (!definition) throw new Error('Version KALTEST illisible : ' + id + ' ' + version);
    const role = roleOf(definition);
    if (role !== expectedRole) {
      throw new Error('Type de page invalide pour ' + id + ' : ' + role + ' au lieu de ' + expectedRole + '.');
    }
    return definition;
  }

  function resolveMaskRef(ref) {
    const requested = ref && typeof ref === 'object' ? ref : defaultMaskRef();
    const record = findMaskScreen(requested.id, requested.version);
    if (!record) throw new Error('Écran de masquage introuvable : ' + String(requested.id || '') + '.');
    return maskRefFor(record.value);
  }

  function saveParcours(payload = {}) {
    ensureSeed();

    const name = String(payload.name || '').trim();
    const creator = String(payload.creator || '').trim();
    if (!name) return { ok:false, error:'Le nom du parcours est obligatoire.' };
    if (!creator) return { ok:false, error:'Le nom du créateur est obligatoire.' };

    const existing = readAllParcours();
    const editingId = String(payload.id || '').trim();
    const editing = editingId ? existing.find(item => String(item.id || '') === editingId) : null;
    if (editingId && !editing) return { ok:false, error:'Le parcours à modifier est introuvable.' };
    if (editing && editing.systemProvided === true) {
      return { ok:false, error:'Le parcours fourni « Parcours de base » est protégé. Créez un nouveau parcours pour le modifier.' };
    }

    const key = safeNameKey(name);
    if (existing.some(item => String(item.id || '') !== editingId && safeNameKey(item.name) === key)) {
      return { ok:false, error:'Un parcours portant ce nom existe déjà.' };
    }

    const definitions = scanLatestDefinitions();

    let introduction;
    let fin;
    let maskScreen;
    try {
      introduction = resolveDefinition(definitions, payload.introduction, 'introduction');
      fin = resolveDefinition(definitions, payload.fin, 'fin');
      maskScreen = resolveMaskRef(payload.maskScreen);
    } catch (error) {
      return { ok:false, error:error.message };
    }

    const refs = Array.isArray(payload.tests) ? payload.tests : [];
    const seen = new Set();
    const tests = [];
    for (const ref of refs) {
      const id = String(ref && ref.id || '');
      if (!id) return { ok:false, error:'Un test du parcours est invalide.' };
      if (seen.has(id)) return { ok:false, error:'Un même test ne peut apparaître qu’une seule fois dans un parcours.' };
      seen.add(id);
      try {
        const definition = resolveDefinition(definitions, ref, 'test');
        tests.push(refFor(definition));
      } catch (error) {
        return { ok:false, error:error.message };
      }
    }

    const stamp = now().toISOString();
    let id = editing ? String(editing.id) : 'parcours-' + slugify(name);
    let file = path.join(parcoursRoot, id + '.json');

    if (!editing) {
      let index = 2;
      while (fs.existsSync(file)) {
        id = 'parcours-' + slugify(name) + '-' + index;
        file = path.join(parcoursRoot, id + '.json');
        index += 1;
      }
    }

    const value = {
      format:'kaloneo-parcours',
      schemaVersion:2,
      id,
      name,
      creator,
      systemProvided:false,
      createdAt:String(editing?.createdAt || stamp),
      updatedAt:stamp,
      maskScreen,
      introduction:refFor(introduction),
      tests,
      fin:refFor(fin)
    };

    atomicWriteJson(file, value);
    return { ok:true, updated:Boolean(editing), parcours:value };
  }

  ensureSeed();

  return Object.freeze({
    paths:Object.freeze({ root, testsRoot, imagesRoot, parcoursRoot, maskScreensRoot }),
    ensureSeed,
    listTests,
    listImages,
    getImage,
    saveImage,
    importImageZip,
    exportImageZip,
    getTest,
    saveTest,
    deleteTest,
    listMaskScreens,
    getMaskScreen,
    saveMaskScreen,
    listParcours,
    getParcours,
    getParcoursDetails,
    saveParcours,
    buildParcoursPackage,
    importParcoursPackage,
    getSelectedParcours,
    selectParcours,
    resolveParcoursRuntime,
    defaultMaskRef
  });
}

module.exports = { createKaloneoLibrary };
