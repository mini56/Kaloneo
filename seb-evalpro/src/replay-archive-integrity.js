'use strict';
// Shared sealed Replay manifest integrity, exactly matching the historical
// field order. Importing on another Windows PC changes ciphertext digests,
// so an imported archive must be re-signed after local re-encryption.
const crypto = require('crypto');
function archiveIntegrityPayload(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    type: manifest.type,
    readOnly: manifest.readOnly,
    archiveMode: manifest.archiveMode,
    futureVersionIndependent: manifest.futureVersionIndependent,
    build: manifest.build,
    archivedAt: manifest.archivedAt,
    candidate: manifest.candidate,
    snapshot: manifest.snapshot,
    slides: (manifest.slides || []).map((slide) => ({
      order: slide.order,
      pageKey: slide.pageKey,
      title: slide.title,
      file: slide.file,
      capturedAt: slide.capturedAt,
      width: slide.width,
      height: slide.height,
      sha256: slide.sha256
    }))
  };
}
function computeArchiveIntegrity(manifest) {
  return crypto.createHash('sha256').update(JSON.stringify(archiveIntegrityPayload(manifest)), 'utf8').digest('hex');
}
module.exports = { archiveIntegrityPayload, computeArchiveIntegrity };
