#!/usr/bin/env python3
"""Purge contrôlée des anciens runs KALONÉO, sans toucher aux Releases ou aux workflows."""
import collections
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

REPOSITORY = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GITHUB_TOKEN"]
NOW = dt.datetime.now(dt.timezone.utc)
CUTOFF = NOW - dt.timedelta(days=4)
MAX_DELETE = min(700, max(0, int(os.environ.get("KALONEO_MAX_DELETE", "700"))))
DRY_RUN = os.environ.get("KALONEO_DRY_RUN", "false").lower() != "false"
ACTIVE_RUN = int(os.environ.get("GITHUB_RUN_ID", "0"))
BASE = "https://api.github.com/repos/" + REPOSITORY
RETAIN_LAST_PER_WORKFLOW = 3
RETAIN_LAST_SUCCESS_PER_WORKFLOW = 1
ATTEMPTS = 6

def request(path, method="GET"):
    url = BASE + path
    for attempt in range(ATTEMPTS):
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": "Bearer " + TOKEN,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "Kaloneo-retention-cleaner"
            },
            method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=40) as res:
                body = res.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            if error.code == 404 and method == "DELETE":
                return None
            if error.code not in (403, 429, 500, 502, 503, 504) or attempt + 1 == ATTEMPTS:
                raise
            reset = error.headers.get("X-RateLimit-Reset")
            retry = error.headers.get("Retry-After")
            pause = max(2, int(retry)) if retry and retry.isdigit() else min(60, 3 * (attempt + 1) ** 2)
            if error.code == 403 and error.headers.get("X-RateLimit-Remaining") == "0" and reset:
                pause = max(pause, min(3800, int(reset) - int(time.time()) + 5))
            print("GitHub API rate-limit/retry", error.code, "pause", pause, "seconds", flush=True)
            time.sleep(pause)

def paginate(path, key=None):
    result = []
    page = 1
    while True:
        separator = "&" if "?" in path else "?"
        reply = request(path + separator + "per_page=100&page=" + str(page))
        batch = reply.get(key, []) if key else reply
        result.extend(batch)
        if len(batch) < 100:
            break
        page += 1
        if page > 200:
            raise RuntimeError("pagination unexpected length")
    return result

def main():
    if not REPOSITORY.endswith("/Kaloneo"):
        raise RuntimeError("Dépôt inattendu, suppression interdite")
    if MAX_DELETE < 1:
        raise RuntimeError("Limite de suppression nulle")
    releases = paginate("/releases")
    protected_shas = {
        str(release.get("target_commitish", "")).lower()
        for release in releases
        if release.get("assets") and len(str(release.get("target_commitish", ""))) == 40
    }
    runs = paginate("/actions/runs", "workflow_runs")
    if len(runs) < 4000:
        raise RuntimeError("Nombre total de runs inférieur au niveau attendu; aucun effacement automatique")
    seen_per_workflow = collections.Counter()
    seen_success_per_workflow = collections.Counter()
    protected = collections.Counter()
    eligible = []
    breakdown = collections.Counter()
    for run in runs:
        if run.get("status") != "completed":
            protected["running"] += 1
            continue
        key = str(run.get("workflow_id") or run.get("name") or "unknown")
        seen_per_workflow[key] += 1
        is_last = seen_per_workflow[key] <= RETAIN_LAST_PER_WORKFLOW
        if run.get("conclusion") == "success":
            seen_success_per_workflow[key] += 1
        latest_success = run.get("conclusion") == "success" and seen_success_per_workflow[key] <= RETAIN_LAST_SUCCESS_PER_WORKFLOW
        stamp = dt.datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))
        preserve_reason = (
            "recent" if stamp >= CUTOFF else
            "release" if str(run.get("head_sha", "")).lower() in protected_shas else
            "latest" if is_last or latest_success else
            "current" if run["id"] == ACTIVE_RUN else None
        )
        if preserve_reason:
            protected[preserve_reason] += 1
            continue
        result = run.get("conclusion") or "unknown"
        if result not in ("success", "failure", "cancelled", "skipped", "neutral", "timed_out"):
            protected["unknown-conclusion"] += 1
            continue
        breakdown[result] += 1
        eligible.append({
            "id": run["id"], "name": run.get("name") or "",
            "result": result, "date": run["created_at"],
            "head_sha": run.get("head_sha")
        })
    # Les runs ignorés/annulés sont nettoyés en premier ; les réussites les plus anciennes en dernier.
    priority = {"skipped": 0, "cancelled": 1, "failure": 2, "timed_out": 2, "neutral": 3, "success": 4}
    eligible.sort(key=lambda v: (priority.get(v["result"], 5), v["date"]))
    chosen = eligible[:MAX_DELETE]
    print(json.dumps({
        "all_runs": len(runs), "release_tags_preserved": len(releases),
        "sha_of_releases_preserved": len(protected_shas),
        "cutoff_utc": CUTOFF.isoformat(), "protected": dict(protected),
        "eligible_by_conclusion": dict(breakdown),
        "eligible_total": len(eligible), "deletion_this_pass": len(chosen),
        "remaining_eligible_after_pass": len(eligible) - len(chosen),
        "dry_run": DRY_RUN
    }, ensure_ascii=False), flush=True)
    if DRY_RUN:
        print("KALONEO_RUN_RETENTION_DRY_RUN=SUCCESS")
        return
    removed = collections.Counter()
    for index, run in enumerate(chosen, start=1):
        request("/actions/runs/" + str(run["id"]), "DELETE")
        removed[run["result"]] += 1
        if index % 50 == 0 or index == len(chosen):
            print("SUPPRIMES", index, "/", len(chosen), "types", dict(removed), flush=True)
        time.sleep(0.18)
    print("KALONEO_OLD_WORKFLOW_RUNS_DELETED=" + str(sum(removed.values())), flush=True)
    print("KALONEO_DELETED_BY_CONCLUSION=" + json.dumps(dict(removed)), flush=True)
    print("KALONEO_RELEASES_AND_RECENT_RUNS_PRESERVED=SUCCESS", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("KALONEO_CLEANUP_FAILED: " + repr(exc), file=sys.stderr, flush=True)
        raise
