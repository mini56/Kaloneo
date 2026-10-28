'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('sebEvalPro',{
  kaloneoIsAdminSession:()=>ipcRenderer.invoke('admin:status'),
  kaloneoStartCandidateParcours:()=>ipcRenderer.invoke('kaloneo:candidate-start-parcours')
});
