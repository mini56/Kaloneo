#!/usr/bin/env bash
set -euo pipefail
# La publication MAJ est asynchrone et peut répondre 404 avec du JSON.
# Ne jamais tenter .assets[] sur une erreur GitHub.
: "${GH_TOKEN:?GitHub token requis}"
attempts="${KALONEO_MAJ_MAX_ATTEMPTS:-24}"
delay="${KALONEO_MAJ_DELAY_SECONDS:-35}"
tag=""
for i in $(seq 1 12); do
  listing="$(gh api 'repos/mini56/Kaloneo/releases?per_page=20' 2>/dev/null || true)"
  if jq -e 'type=="array"' >/dev/null 2>&1 <<<"$listing"; then
    tag="$(jq -r '[.[] | select(.draft==false and (.tag_name|type=="string")) | .tag_name | select(startswith("kaloneo-1.00."))] | first // ""' <<<"$listing")"
  fi
  if [[ "$tag" =~ ^kaloneo-1[.]00[.][0-9]+$ ]]; then break; fi
  tag=""
  echo "Release source pas encore accessible ($i/12)"
  sleep 15
done
if [[ -z "$tag" ]]; then echo "::error::Aucune Release KALONEO source accessible"; exit 1; fi

version="${tag#kaloneo-}"
exe="KALONEO-Setup-$version.exe"
sha="$exe.sha256"
source_exe_hash=""
source_sha_hash=""
source_size="0"
for i in $(seq 1 12); do
  src="$(gh api "repos/mini56/Kaloneo/releases/tags/$tag" 2>/dev/null || true)"
  if jq -e --arg tag "$tag" 'type=="object" and .tag_name==$tag and (.assets|type=="array")' >/dev/null 2>&1 <<<"$src"; then
    source_exe_hash="$(jq -r --arg name "$exe" '[.assets[]? | select(.name==$name) | .digest] | first // ""' <<<"$src")"
    source_sha_hash="$(jq -r --arg name "$sha" '[.assets[]? | select(.name==$name) | .digest] | first // ""' <<<"$src")"
    source_size="$(jq -r --arg name "$exe" '[.assets[]? | select(.name==$name) | .size] | first // 0' <<<"$src")"
    if [[ "$source_exe_hash" =~ ^sha256:[0-9a-fA-F]{64}$ && "$source_sha_hash" =~ ^sha256:[0-9a-fA-F]{64}$ && "$source_size" =~ ^[0-9]+$ ]] && ((source_size>=100000000)); then break; fi
  fi
  echo "EXE/SHA256 officiels pas encore complets ($i/12)"
  sleep 15
done
if [[ ! "$source_exe_hash" =~ ^sha256:[0-9a-fA-F]{64}$ || ! "$source_sha_hash" =~ ^sha256:[0-9a-fA-F]{64}$ || ! "$source_size" =~ ^[0-9]+$ ]] || ((source_size<100000000)); then
  echo "::error::Setup ou SHA256 officiels absents ou incorrects pour $tag"; exit 1
fi

# Si un jeton Actions:write pour le depot MAJ est configure, declencher
# directement le workflow miroir. Sinon la planification reste active.
if [[ -n "${KALONEO_MAJ_DISPATCH_TOKEN:-}" && "${KALONEO_SKIP_MIRROR_DISPATCH:-0}" != "1" ]]; then
  echo "Déclenchement immédiat de Kaloneo-MAJ"
  if ! GH_TOKEN="$KALONEO_MAJ_DISPATCH_TOKEN" gh api -X POST 'repos/mini56/Kaloneo-MAJ/actions/workflows/synchroniser-releases.yml/dispatches' -f ref=main >/dev/null 2>&1; then
    echo "::warning::Déclenchement direct MAJ indisponible ; vérification planifiée maintenue."
  fi
fi

for i in $(seq 1 "$attempts"); do
  mirror="$(gh api "repos/mini56/Kaloneo-MAJ/releases/tags/$tag" 2>/dev/null || true)"
  # 404 avec corps JSON est NORMAL avant la synchronisation : pas de faux rouge.
  if jq -e --arg tag "$tag" 'type=="object" and .tag_name==$tag and (.assets|type=="array")' >/dev/null 2>&1 <<<"$mirror"; then
    dst_exe="$(jq -r --arg name "$exe" '[.assets[]? | select(.name==$name) | .digest] | first // ""' <<<"$mirror")"
    dst_sha="$(jq -r --arg name "$sha" '[.assets[]? | select(.name==$name) | .digest] | first // ""' <<<"$mirror")"
    dst_size="$(jq -r --arg name "$exe" '[.assets[]? | select(.name==$name) | .size] | first // 0' <<<"$mirror")"
    count="$(jq -r '.assets|length' <<<"$mirror")"
    if [[ "$dst_exe" == "$source_exe_hash" && "$dst_sha" == "$source_sha_hash" && "$dst_size" == "$source_size" && "$count" == "2" ]]; then
      echo "KALONEO_MAJ_DISTRIBUTION=SUCCESS $tag"
      {
        echo "### Mise à jour $tag — miroir validé"
        echo "EXE et SHA256 identiques à la Release source."
        echo "https://github.com/mini56/Kaloneo-MAJ/releases/tag/$tag"
      } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
      exit 0
    fi
    echo "Release MAJ présente, mais fichiers ou SHA256 non conformes ($i/$attempts)"
  else
    echo "Release MAJ non encore créée : attente de synchronisation ($i/$attempts)"
  fi
  if ((i<attempts)); then sleep "$delay"; fi
done
echo "::error::Release $tag absente ou différente du Setup source après vérification."
exit 1
