'use strict';

/**
 * TESTS_V1: only validated <id>.json files from repository root override
 * bundled tests at build time. Historical source/kaltest/tests stay intact.
 */
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const crypto=require('crypto');

const VALID_ID=/^[a-z0-9][a-z0-9_-]{0,99}$/i;
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function sha256(s){return crypto.createHash('sha256').update(s,'utf8').digest('hex');}
function fail(msg){throw new Error('TESTS_V1: '+msg);}

function syncFromMainInCi(repoRoot){
  if(process.env.GITHUB_ACTIONS!=='true')return {synced:false};
  const run=(args)=>cp.execFileSync('git',args,{cwd:repoRoot,encoding:'utf8',maxBuffer:20*1024*1024});
  run(['fetch','--no-tags','--depth=1','origin','main']);
  const revision=run(['rev-parse','FETCH_HEAD']).trim();
  const entries=run(['ls-tree','-r','--name-only','FETCH_HEAD','TESTS_V1'])
    .split(/\r?\n/).filter(Boolean);
  if(!entries.includes('TESTS_V1/README.md'))fail('dossier officiel absent de main');
  const directory=path.join(repoRoot,'TESTS_V1');
  fs.mkdirSync(directory,{recursive:true});
  for(const existing of fs.readdirSync(directory)){
    if(existing.endsWith('.json'))fs.rmSync(path.join(directory,existing),{force:true});
  }
  for(const file of entries){
    if(!/^TESTS_V1\/[A-Za-z0-9_.-]+\.json$/.test(file))continue;
    const src=run(['show','FETCH_HEAD:'+file]);
    fs.writeFileSync(path.join(repoRoot,file),src,'utf8');
  }
  console.log('TESTS_V1: références de main synchronisées, révision '+revision.substring(0,12));
  return {synced:true,revision};
}

function collectSeedPaths(sourceTestsDir){
  const map=new Map();
  if(!fs.existsSync(sourceTestsDir))return map;
  for(const entry of fs.readdirSync(sourceTestsDir,{withFileTypes:true})){
    if(!entry.isDirectory())continue;
    const dir=path.join(sourceTestsDir,entry.name);
    for(const sub of fs.readdirSync(dir,{withFileTypes:true})){
      if(!sub.isDirectory())continue;
      const candidate=path.join(dir,sub.name,'test.json');
      if(!fs.existsSync(candidate))continue;
      const seed=readJson(candidate);
      if(seed?.id && String(seed.version)==='1.0.0') {
        if(map.has(seed.id))fail('ID V1 présent plusieurs fois dans les seeds: '+seed.id);
        map.set(seed.id,{file:candidate,relative:path.relative(sourceTestsDir,candidate)});
      }
    }
  }
  return map;
}

function loadOfficialOverrides(repoRoot, sourceTestsDir){
  const directory=path.join(repoRoot,'TESTS_V1');
  const baseline=collectSeedPaths(sourceTestsDir);
  const overrides=new Map();
  if(!fs.existsSync(directory))return {overrides,baseline};
  for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(entry.isDirectory())fail('sous-dossiers interdits: '+entry.name);
    if(!entry.name.endsWith('.json'))continue;
    if(!entry.isFile())fail('fichier non standard: '+entry.name);
    const source=fs.readFileSync(path.join(directory,entry.name),'utf8');
    let definition;
    try{definition=JSON.parse(source);}catch(error){fail(entry.name+' JSON invalide: '+error.message);}
    const id=String(definition?.id||'');
    if(!VALID_ID.test(id))fail(entry.name+' : identifiant KALTEST invalide');
    // Le Builder exporte le nom <id>-1.0.0-test.json ; accepter aussi
    // l'ancien nom <id>.json recommandé dans la documentation.
    if(entry.name!==id+'.json'&&entry.name!==id+'-1.0.0-test.json')
      fail(entry.name+' : nom attendu '+id+'-1.0.0-test.json ou '+id+'.json');
    if(Number(definition?.kaltestFormat)!==1)fail(entry.name+' : kaltestFormat doit être 1');
    if(String(definition?.version||'')!=='1.0.0')fail(entry.name+' : version doit être 1.0.0');
    if(!String(definition?.title||'').trim())fail(entry.name+' : titre manquant');
    if(overrides.has(id))fail('même identifiant fourni deux fois : '+id);
    const previous=baseline.get(id);
    if(previous){
      const seed=readJson(previous.file);
      if(String(seed.id)!==id||String(seed.version)!=='1.0.0')
        fail(entry.name+' : V1 historique incohérente');
    }
    // Copie fidèle du test (questions, images, texte et barèmes intacts).
    // Une liaison au bilan ne peut JAMAIS employer le pourcentage comme
    // dénominateur : tous les tests notés reçoivent score/score_max réels.
    const imported=JSON.parse(JSON.stringify(definition));
    if(imported.scored!==false){
      imported.outputs=Array.isArray(imported.outputs)?imported.outputs:[];
      for(const name of ['score','score_max']){
        if(!imported.outputs.some(output=>output.id===name))
          imported.outputs.push({id:name,type:'number'});
      }
      for(const link of (Array.isArray(imported.bilanContributions)?imported.bilanContributions:[])){
        if(link?.bindings?.score_max==='pourcentage')
          link.bindings.score_max='score_max';
        if(link?.bindings?.score==='pourcentage')
          link.bindings.score='score';
      }
    }
    overrides.set(id,{
      definition:imported,file:path.join(directory,entry.name),
      // Deux V1 modifiées et trois nouveaux tests sont publiés par le même
      // mécanisme : source historique laissée intouchable.
      relative:previous?.relative||path.join(id.replace(/_/g,'-'),'1.0.0','test.json'),
      sha256:sha256(source),
      isNew:!previous
    });
  }
  return {overrides,baseline};
}

function writeOfficialSeedOverrides({repoRoot,sourceTestsDir,outputTestsDir}){
  const {overrides}=loadOfficialOverrides(repoRoot,sourceTestsDir);
  const manifest=[];
  for(const [id,record] of overrides){
    const target=path.join(outputTestsDir,record.relative);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,JSON.stringify(record.definition,null,2)+'\n','utf8');
    manifest.push({id,version:'1.0.0',relative:record.relative.replace(/\\/g,'/'),sha256:record.sha256,isNew:record.isNew});
  }
  const manifestFile=path.join(path.dirname(outputTestsDir),'TESTS_V1-manifest.json');
  fs.mkdirSync(path.dirname(manifestFile),{recursive:true});
  fs.writeFileSync(manifestFile,JSON.stringify({format:'kaloneo-official-v1-overrides',version:1,tests:manifest},null,2)+'\n');
  console.log('TESTS_V1: '+manifest.length+' V1 officielle(s) intégrée(s) dans app/web');
  return manifest;
}
module.exports={syncFromMainInCi,loadOfficialOverrides,writeOfficialSeedOverrides,collectSeedPaths};
