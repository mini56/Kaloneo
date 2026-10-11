'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { embedTestImages, validatePortableTest } = require('../src/kaloneo-test-portability');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kaloneo-portable-test-'));
try {
  fs.mkdirSync(path.join(root,'imageqcm'),{recursive:true});
  const image=Buffer.from([137,80,78,71,13,10,26,10]);
  fs.writeFileSync(path.join(root,'imageqcm','photo.png'),image);
  const source={
    kaltestFormat:1,id:'test_portable',version:'1.0.0',title:'Test',
    scored:true,questions:[{id:'q1',correctAnswer:'OUI',points:3}],
    presentation:{layout:'50-50',image:'imageqcm/photo.png'},
    outputs:[{id:'score',type:'number'}],
    bilanContributions:[{lineId:'bilan.test',bindings:{score:'score'}}]
  };
  const before=JSON.stringify(source);
  const exported=embedTestImages(source,root);
  assert.strictEqual(exported.embeddedCount,1);
  assert(exported.definition.presentation.image.startsWith('data:image/png;base64,'));
  assert.strictEqual(JSON.stringify(source),before,'La V1 source ne doit pas changer');
  assert.deepStrictEqual(exported.definition.questions,source.questions);
  assert.deepStrictEqual(exported.definition.outputs,source.outputs);
  assert.deepStrictEqual(exported.definition.bilanContributions,source.bilanContributions);
  const reimported=JSON.parse(JSON.stringify(exported.definition));
  validatePortableTest(reimported);
  assert.deepStrictEqual(reimported,exported.definition);
  assert.throws(()=>embedTestImages({...source,presentation:{image:'imageqcm/absente.png'}},root),/Images manquantes/);
  assert.throws(()=>embedTestImages({...source,bilanContributions:undefined},root),/Résultats\/Bilan/);
  console.log('KALONEO_TEST_PORTABILITY: OK (image, score, résultats, bilan, transfert JSON, absence image)');
} finally {
  fs.rmSync(root,{recursive:true,force:true});
}
