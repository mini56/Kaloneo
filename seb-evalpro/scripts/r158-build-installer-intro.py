#!/usr/bin/env python3
"""R158: Convert the APPROVED chameleon MP4 to silent native NSIS BMP frames.

NSIS never launches any external video player during installation.
Frames are created only on the GitHub Windows build runner; the MP4 source is
unchanged, and there is no transcoding or ffmpeg dependency on candidate PCs.
"""
from pathlib import Path
import math
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VIDEO = ROOT.parent / "video_ecran_mq" / "Chameleon_walking_laptop_53805_Seedance_20_Mini.mp4"
OUT = ROOT / "build" / "pilot-resources" / "intro-frames"
FPS = 8
MAX_DURATION = 30.0
assert VIDEO.is_file() and VIDEO.stat().st_size > 10_000, f"Original video missing: {VIDEO}"
probe = subprocess.run(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration",
     "-of", "default=noprint_wrappers=1:nokey=1", str(VIDEO)],
    capture_output=True, text=True, check=True,
)
duration = float(probe.stdout.strip())
assert math.isfinite(duration) and 0.5 <= duration <= MAX_DURATION, (
    f"Unreasonable video duration {duration}s; inspect before publishing"
)
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
filter_graph = (
    f"fps={FPS},scale=450:228:force_original_aspect_ratio=decrease,"
    "pad=450:228:(ow-iw)/2:(oh-ih)/2:color=white"
)
subprocess.run(
    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
     "-i", str(VIDEO), "-an", "-vf", filter_graph,
     "-pix_fmt", "bgr24", "-c:v", "bmp", str(OUT / "frame_%d.bmp")],
    check=True,
)
frames = sorted(OUT.glob("frame_*.bmp"), key=lambda p: int(p.stem.split("_")[-1]))
assert 4 <= len(frames) <= FPS * MAX_DURATION + 2, f"Invalid frame count: {len(frames)}"
assert all(frame.name == f"frame_{i}.bmp" and frame.stat().st_size > 50_000
           for i, frame in enumerate(frames, 1)), "Missing or corrupt BMP frame"
(OUT / "intro-meta.nsh").write_text(
    f"!define KALONEO_INTRO_FRAME_COUNT {len(frames)}\n"
    f"!define KALONEO_INTRO_FRAME_MS {int(1000/FPS)}\n",
    encoding="ascii",
)
print(f"KALONEO_R158_INTRO_FRAMES=OK video={VIDEO.name} "
      f"duration={duration:.3f}s frames={len(frames)} fps={FPS} "
      "resolution=450x228 silent, no external player")
