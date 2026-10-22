'use strict';

const crypto = require('crypto');

function normalizeHuman(value) {
  let text = String(value == null ? '' : value).trim();
  try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
  return text.toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePersonIdentifier(value) {
  return String(value == null ? '' : value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}

// Identifier, name and given name are the only permitted stable match dimensions.
function candidatePersonMatchKey(candidate) {
  const c = candidate && typeof candidate === 'object' ? candidate : {};
  const identifier = normalizePersonIdentifier(c.personIdentifier || c.identifiant || c.identifier || c.ss7 || '');
  const nom = normalizeHuman(c.nom);
  const prenom = normalizeHuman(c.prenom || c['prénom']);
  return /^[A-Z0-9]{7}$/.test(identifier) && nom && prenom
    ? [identifier, nom, prenom].join('|')
    : '';
}

function candidatePersonIdentity(candidate, fallbackCandidateId = '') {
  const c = candidate && typeof candidate === 'object' ? candidate : {};
  const personIdentifier = normalizePersonIdentifier(
    c.personIdentifier || c.identifiant || c.identifier || c.ss7 || ''
  );
  const nom = String(c.nom || '').trim();
  const prenom = String(c.prenom || c['prénom'] || '').trim();
  const naissance = String(c.naissance || c.dateNaissance || c.birthDate || '').trim();

  const normalizedNom = normalizeHuman(nom);
  const normalizedPrenom = normalizeHuman(prenom);
  const normalizedBirth = normalizeHuman(naissance);
  const completeIdentifier = /^[A-Z0-9]{7}$/.test(personIdentifier);

  let basis = '';
  let legacyFallback = false;
  if (completeIdentifier && normalizedNom && normalizedPrenom) {
    basis = ['kaloneo-person-v1', personIdentifier, normalizedNom, normalizedPrenom, normalizedBirth].join('|');
  } else {
    legacyFallback = true;
    basis = ['kaloneo-person-legacy-v1', String(fallbackCandidateId || '').trim() || JSON.stringify({
      nom:normalizedNom,
      prenom:normalizedPrenom,
      naissance:normalizedBirth
    })].join('|');
  }

  const personId = 'PERS-' + crypto.createHash('sha256').update(basis, 'utf8').digest('hex').slice(0, 24).toUpperCase();
  return {
    personId,
    personIdentifier: completeIdentifier ? personIdentifier : '',
    nom,
    prenom,
    naissance,
    legacyFallback
  };
}

function enrichCandidatePersonIdentity(candidate, fallbackCandidateId = '') {
  const identity = candidatePersonIdentity(candidate, fallbackCandidateId);
  return {
    ...(candidate && typeof candidate === 'object' ? candidate : {}),
    personId:identity.personId,
    personIdentifier:identity.personIdentifier
  };
}

module.exports = {
  normalizeHuman,
  normalizePersonIdentifier,
  candidatePersonMatchKey,
  candidatePersonIdentity,
  enrichCandidatePersonIdentity
};
