#!/usr/bin/env python3
from pathlib import Path
from imageio_ffmpeg import get_ffmpeg_exe
import subprocess
p=Path(__file__).resolve().parents[1]/'source'/'assets'/'debut_de_parcours.mp4'
assert p.is_file()
exe=get_ffmpeg_exe()
proc=subprocess.run([exe,'-hide_banner','-i',str(p)],capture_output=True,text=True,errors='replace')
assert 'Duration:' in proc.stderr, proc.stderr[-1200:]
print('KALONEO_INTRO_MP4_METADATA_START')
for l in proc.stderr.splitlines():
 if any(s in l for s in ('Input #','Duration:','Stream #','Metadata:','major_brand','compatible_brands')): print(l.strip())
print('KALONEO_INTRO_MP4_METADATA_END')
