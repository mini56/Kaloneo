'use strict';

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  ShadingType,
  BorderStyle
} = require('docx');
const {normalizeErrorCounts}=require('./bilan-error-count');

const COLORS = Object.freeze({
  blue:'0070C0',
  ne:'CCFFFF',
  i:'92D050',
  ii:'ED7D31',
  iii:'C00000',
  section:'B8CCE4',
  sectionStrong:'9CC2E5',
  alt:'F2F2F2',
  white:'FFFFFF',
  black:'000000'
});

const LEVEL_COLOR = Object.freeze({NE:COLORS.ne,I:COLORS.i,II:COLORS.ii,III:COLORS.iii});

function clean(value) {
  return normalizeErrorCounts(String(value == null ? '' : value).replace(/\r\n?/g, '\n')).trim();
}

function safeLines(value) {
  const lines=clean(value).split('\n').map(line=>line.trim()).filter(Boolean);
  return lines.length ? lines : [''];
}

function textRuns(value, options = {}) {
  const lines=safeLines(value);
  const runs=[];
  lines.forEach((line,index)=>{
    runs.push(new TextRun({
      text:line,
      bold:options.bold === true,
      italics:options.italics === true,
      color:options.color || COLORS.black,
      size:options.size || 18,
      break:index ? 1 : 0
    }));
  });
  return runs;
}

function paragraph(value, options = {}) {
  return new Paragraph({
    children:textRuns(value,options),
    alignment:options.alignment || AlignmentType.LEFT,
    spacing:{after:options.after == null ? 0 : options.after}
  });
}

function borders() {
  const edge={style:BorderStyle.SINGLE,size:4,color:'000000'};
  return {top:edge,bottom:edge,left:edge,right:edge,insideHorizontal:edge,insideVertical:edge};
}

function cell(children, options = {}) {
  return new TableCell({
    children:Array.isArray(children) ? children : [children],
    width:{size:options.width || 10,type:WidthType.PERCENTAGE},
    verticalAlign:VerticalAlign.CENTER,
    columnSpan:options.columnSpan,
    shading:options.fill ? {type:ShadingType.CLEAR,color:'auto',fill:options.fill} : undefined,
    margins:{top:80,bottom:80,left:80,right:80},
    borders:borders()
  });
}

function headerRow() {
  const defs=[
    ['Modules',32,COLORS.blue,COLORS.white],
    ['NE',6,COLORS.ne,COLORS.black],
    ['I',6,COLORS.i,COLORS.black],
    ['II',6,COLORS.ii,COLORS.white],
    ['III',6,COLORS.iii,COLORS.white],
    ['Commentaires',44,COLORS.blue,COLORS.white]
  ];
  return new TableRow({
    tableHeader:true,
    children:defs.map(([label,width,fill,color])=>cell(
      paragraph(label,{bold:true,color,alignment:AlignmentType.CENTER}),
      {width,fill}
    ))
  });
}

function sectionRow(row) {
  return new TableRow({
    children:[cell(
      paragraph(clean(row.text),{bold:true}),
      {width:100,fill:row.strong ? COLORS.sectionStrong : COLORS.section,columnSpan:6}
    )]
  });
}

function commentParagraphs(row) {
  const out=[];
  const comment=clean(row.comment);
  const detail=clean(row.detail);
  const extra=clean(row.extra);

  if (comment) out.push(paragraph(comment,{after:80}));
  if (detail) out.push(paragraph(detail,{bold:true,after:40}));
  if (extra) out.push(paragraph(extra,{after:0}));
  if (!out.length) out.push(paragraph(''));
  return out;
}

function dataRow(row,index) {
  const level=clean(row.level).toUpperCase();
  const alt=row.alternate === true || (row.alternate == null && index % 2 === 1);
  const baseFill=alt ? COLORS.alt : COLORS.white;
  const levelTexts=row.levelTexts && typeof row.levelTexts==='object' ? row.levelTexts : {};
  const levelCells=['NE','I','II','III'].map(levelName=>{
    const selected=level===levelName;
    const fill=selected ? LEVEL_COLOR[levelName] : baseFill;
    const color=selected && (levelName==='II'||levelName==='III') ? COLORS.white : COLORS.black;
    return cell(
      paragraph(clean(levelTexts[levelName]||''),{
        color,
        alignment:AlignmentType.CENTER,
        size:16
      }),
      {width:6,fill}
    );
  });

  return new TableRow({
    cantSplit:true,
    children:[
      cell(paragraph(clean(row.module),{size:18}),{width:32,fill:baseFill}),
      ...levelCells,
      cell(commentParagraphs(row),{width:44,fill:baseFill})
    ]
  });
}

function buildRows(payload) {
  const rows=[headerRow()];
  let dataIndex=0;
  for(const item of Array.isArray(payload?.rows) ? payload.rows : []){
    if(!item||item.hidden===true)continue;
    if(item.type==='section'){
      rows.push(sectionRow(item));
      continue;
    }
    if(item.type==='row'){
      rows.push(dataRow(item,dataIndex++));
    }
  }
  return rows;
}

function metaParagraph(candidate) {
  const c=candidate||{};
  return new Paragraph({
    children:[
      new TextRun({text:'Nom : ',bold:true,size:20}),
      new TextRun({text:clean(c.nom),size:20}),
      new TextRun({text:'    Prénom : ',bold:true,size:20}),
      new TextRun({text:clean(c.prenom),size:20}),
      new TextRun({text:'    Date : ',bold:true,size:20}),
      new TextRun({text:clean(c.date),size:20})
    ],
    spacing:{after:160}
  });
}

function heading(text) {
  return new Paragraph({
    children:[new TextRun({text:clean(text),bold:true,size:28,color:'1F4E78'})],
    spacing:{before:260,after:120}
  });
}

function bodyParagraph(value) {
  return new Paragraph({
    children:textRuns(value,{size:20}),
    spacing:{after:120,line:300}
  });
}

function buildBilanDocx(payload) {
  const table=new Table({
    rows:buildRows(payload),
    width:{size:100,type:WidthType.PERCENTAGE},
    borders:borders()
  });

  const children=[metaParagraph(payload?.candidate),table];

  const summary=clean(payload?.summary);
  if(summary){
    children.push(heading('Synthèse de l’évaluation'));
    children.push(bodyParagraph(summary));
  }

  const feeling=clean(payload?.feeling);
  if(feeling){
    children.push(heading(clean(payload?.feelingTitle)||'Ressenti de la personne sur son plateau technique'));
    children.push(bodyParagraph(feeling));
  }

  return new Document({
    creator:'KALONÉO',
    title:'Bilan d’évaluation',
    description:'Bilan institutionnel KALONÉO',
    sections:[{
      properties:{
        page:{
          margin:{top:560,right:560,bottom:560,left:560}
        }
      },
      children
    }]
  });
}

async function officeCrypto() {
  return import('ooxml-core/crypto');
}

async function buildBilanDocxBuffer(payload, password = '') {
  const plain=await Packer.toBuffer(buildBilanDocx(payload));
  const secret=String(password||'');
  if(!secret)return plain;
  const { encryptOoxmlPackage }=await officeCrypto();
  const encrypted=await encryptOoxmlPackage(new Uint8Array(plain),secret);
  return Buffer.from(encrypted);
}

async function protectPlainBilanDocxBuffer(buffer,password) {
  const secret=String(password||'');
  if(!secret)throw new Error('Mot de passe administrateur indispensable.');
  const { encryptOoxmlPackage }=await officeCrypto();
  return Buffer.from(await encryptOoxmlPackage(new Uint8Array(buffer),secret));
}

async function decryptBilanDocxBuffer(buffer, password) {
  const { decryptOoxmlPackage }=await officeCrypto();
  const plain=await decryptOoxmlPackage(new Uint8Array(buffer),String(password||''));
  return Buffer.from(plain);
}

async function isEncryptedBilanDocxBuffer(buffer) {
  const { isEncryptedOoxmlPackage }=await officeCrypto();
  return !!isEncryptedOoxmlPackage(new Uint8Array(buffer));
}

async function verifyBilanDocxPassword(buffer, password) {
  const { verifyOoxmlPackagePassword }=await officeCrypto();
  return !!(await verifyOoxmlPackagePassword(new Uint8Array(buffer),String(password||'')));
}

module.exports={
  buildBilanDocx,
  buildBilanDocxBuffer,
  protectPlainBilanDocxBuffer,
  decryptBilanDocxBuffer,
  isEncryptedBilanDocxBuffer,
  verifyBilanDocxPassword
};
