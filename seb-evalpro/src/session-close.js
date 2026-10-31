module.exports = function registerSessionClose({
  app,
  ipcMain,
  getMainWindow,
  getAdminUnlocked,
  isTrustedAdminIpcSender = () => true,
  setAdminUnlocked
}) {
  ipcMain.handle('admin:quit-application', async (event) => {
    if(!isTrustedAdminIpcSender(event)) return {ok:false,error:'Page Administrateur requise.'};
    if (!getAdminUnlocked()) return false;

    // Quitter ferme uniquement SEB EvalPro. Le parcours actif, son pointeur
    // et sa dernière page restent intacts afin de reprendre au prochain démarrage.
    setTimeout(() => app.quit(), 80);
    return true;
  });

  ipcMain.handle('admin:close-session', async (event) => {
    if(!isTrustedAdminIpcSender(event)) return {ok:false,error:'Page Administrateur requise.'};
    if (!getAdminUnlocked()) return false;

    // Le parcours candidat actif est clôturé par le preload avant cet appel.
    // Fermer la session active ne ferme jamais SEB EvalPro : l'Administrateur
    // reste connecté et le preload revient ensuite à l'espace dossiers candidats.
    const mainWindow = getMainWindow();
    return !!(mainWindow && !mainWindow.isDestroyed());
  });
};
