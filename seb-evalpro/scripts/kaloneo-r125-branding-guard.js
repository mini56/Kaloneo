'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const rd=p=>fs.readFileSync(path.join(root,p),'utf8');
const pkg=JSON.parse(rd('package.json'));
assert.equal(pkg.sebBuildNumber,157);
assert.equal(pkg.sebReleaseVersion,'0.0.181');
const build=rd('build/kaloneo-r154-institutional-grid.yml');
assert.match(build,/productName: "KALONÉO"/);
assert.match(build,/executableName: KALONEO/);
assert.match(build,/shortcutName: "KALONÉO"/);
assert.match(build,/include: build\/installer\.nsh/);
assert.match(build,/installerIcon: build\/pilot-resources\/kaloneo\.ico/);
assert.match(build,/uninstallerIcon: build\/pilot-resources\/kaloneo\.ico/);
assert.match(build,/appId: fr\.sauvegarde56\.sebevalpro\.kaloneo\.pilot22/);
const pilot=rd('src/kaltest-pilot21-main.js');
assert.match(pilot,/APP_NAME = 'KALONÉO'/);
assert.match(pilot,/SEB EvalPro Kaloneo PILOTE 21/,'Preserve historic userData location');
const nsh=rd('build/installer.nsh');
assert.match(nsh,/SEB_BUILD_NUMBER "157"/);
assert.match(nsh,/KALONÉO — \$\{SEB_BUILD_LABEL\}/);
assert.match(nsh,/kaloneo-branding\.bmp/);
assert.match(rd('src/splash.html'),/src="\.\.\/app\/web\/assets\/kaloneo-logo-app\.png"/);
assert.match(rd('source/js/seb-visual-branding.js'),/const APP_NAME = 'KALONÉO'/);
assert.match(rd('source/js/seb-in-app-alert.js'),/alert-title">KALONÉO/);
const generated=path.join(root,'app/web');
const scan=(dir,out=[])=>{for(const x of fs.readdirSync(dir,{withFileTypes:true})){
 const p=path.join(dir,x.name);
 if(x.isDirectory())scan(p,out);
 else if(/\.html?$/i.test(x.name))out.push(p);
}return out};
let scanned=0;
for(const file of scan(generated)){
 const html=fs.readFileSync(file,'utf8'),label=path.relative(generated,file);
 assert(!/sauvegarde56-logo\.svg|seb-evalpro-privacy-screen\.jpg|id="Calque_1"/i.test(html),'Legacy visible logo in '+label);
 const cleaned=html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<!--[\s\S]*?-->/g,'')
  .replace(/<[^>]+>/g,'');
 assert(!/(?:SEB\s*[- ]?\s*[eé]val\s*[- ]?\s*PRO|Sauvegarde\s+56)/i.test(cleaned),
   'Old visible name in '+label);
 scanned++;
}
assert(scanned>=15,'Missing generated candidate/admin screens');
assert(fs.existsSync(path.join(generated,'assets/kaloneo-logo-app.png')));
console.log('KALONEO_R127_BRANDING=OK — '+scanned+' pages HTML, logos, UI titles, update ID and candidate userData intact');
