// SEB_UNIFIED_SETUP
// KALONÉO decision: SEB EvalPro has one installation and two runtime modes.
// Candidate/Admin are no longer installation editions. Functional access is
// controlled by the locked/unlocked Administrator session.
function readInstalledEdition() {
  return 'unified';
}

function getEditionCapabilities() {
  return {
    edition: 'unified',
    label: 'KALONÉO',
    canBilan: true,
    canAi: true,
    canImport: true,
    canExport: true,
    canCatalog: true,
    canReplay: true,
    canResults: true
  };
}

module.exports = { readInstalledEdition, getEditionCapabilities };
