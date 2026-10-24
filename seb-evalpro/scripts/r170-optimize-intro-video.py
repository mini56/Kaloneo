#!/usr/bin/env python3
"""R170 — conserver l'original GitHub et optimiser uniquement la copie Electron."""
from pathlib import Path
import hashlib, json, re, subprocess
from imageio_ffmpeg import get_ffmpeg_exe
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"source"/"assets"/"debut_de_parcours.mp4"
TARGET=ROOT/"app"/"web"/"assets"/"debut_de_parcours-lecture.mp4"
POSTER=ROOT/"app"/"web"/"assets"/"debut_de_parcours-affiche.jpg"
MANIFEST=ROOT/"app"/"web"/"assets"/"debut_de_parcours-lecture.json"
assert SOURCE.is_file() and SOURCE.stat().st_size>100_000
ffmpeg=get_ffmpeg_exe()
meta=subprocess.run([ffmpeg,"-hide_banner","-i",str(SOURCE)],
 capture_output=True,text=True,errors="replace").stderr
match=re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)",meta)
assert match, "Durée de la vidéo absente"
duration=int(match[1])*3600+int(match[2])*60+float(match[3])
assert 2<=duration<=90, f"Durée inattendue: {duration}"
assert re.search(r"Video:\s*h264\b",meta), "H.264 attendu"
assert not re.search(r"Stream #[^\n]+Audio:",meta), "Vidéo non muette : ne pas retirer l'audio"
TARGET.parent.mkdir(parents=True,exist_ok=True)
subprocess.run([ffmpeg,"-nostdin","-hide_banner","-loglevel","error","-y",
 "-i",str(SOURCE),"-map","0:v:0","-an",
 "-vf","scale=1280:-2:flags=lanczos",
 "-c:v","libx264","-preset","medium","-crf","23",
 "-pix_fmt","yuv420p","-movflags","+faststart","-threads","2",str(TARGET)],
 check=True,timeout=150)
subprocess.run([ffmpeg,"-nostdin","-hide_banner","-loglevel","error","-y",
 "-ss","0.25","-i",str(SOURCE),"-vf","scale=1280:-2:flags=lanczos",
 "-frames:v","1","-q:v","4",str(POSTER)],check=True,timeout=30)
size=TARGET.stat().st_size
original=SOURCE.stat().st_size
assert 100_000<size<original*.70, f"La compression ne suffit pas: {original} -> {size}"
assert POSTER.stat().st_size>5000
out=subprocess.run([ffmpeg,"-hide_banner","-i",str(TARGET)],capture_output=True,
 text=True,errors="replace").stderr
assert "Video: h264" in out and "yuv420p" in out and "1280x" in out
sha=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
record={"format":"kaloneo-intro-video-render","version":1,
 "originalSource":"source/assets/debut_de_parcours.mp4",
 "originalBytes":original,"originalSha256":sha,
 "render":"assets/debut_de_parcours-lecture.mp4","renderBytes":size,
 "poster":"assets/debut_de_parcours-affiche.jpg",
 "durationSeconds":duration,"width":1280,"fps":24,"audio":False}
MANIFEST.write_text(json.dumps(record,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
print(f"KALONEO_R170_INTRO_CONVERTED=OK 24fps source {original} -> {size} bytes "
 f"({(1-size/original)*100:.1f}% saved), original SHA256={sha}; poster={POSTER.stat().st_size}")
