#!/usr/bin/env python3
"""Analyse les deux flashs de l'animation NSIS à partir du MP4 ORIGINEL."""
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image
from imageio_ffmpeg import get_ffmpeg_exe
import json, subprocess, statistics

root=Path(__file__).resolve().parents[2]
src=root/"video_ecran_mq"/"Chameleon_walking_laptop_53805_Seedance_20_Mini.mp4"
assert src.exists(), src
ffmpeg=get_ffmpeg_exe()
fps=12
frames=[]
with TemporaryDirectory(prefix="kaloneo_intro_audit_") as tmp:
    output=Path(tmp)
    subprocess.run([
       ffmpeg, "-nostdin","-hide_banner","-loglevel","error","-y",
       "-i",str(src),"-an","-vf",f"fps={fps},scale=240:-1",
       str(output/"%04d.png")],check=True)
    for i,file in enumerate(sorted(output.glob("*.png"))):
        with Image.open(file) as im:
            rgb=im.convert("RGB").resize((64,36))
            pix=list(rgb.getdata())
            nearwhite=sum(1 for r,g,b in pix if min(r,g,b)>=243)/len(pix)
            pale=sum(1 for r,g,b in pix if min(r,g,b)>=225)/len(pix)
            brightness=statistics.mean((r+g+b)/3 for r,g,b in pix)
            frames.append({"time":round(i/fps,3),"white":round(nearwhite,4),
                           "pale":round(pale,4),"mean":round(brightness,1)})
assert frames
flashes=[]
for i in range(1,len(frames)-1):
    a,b,c=frames[i-1:i+2]
    if b["white"]>0.89 and a["white"]<0.78 and c["white"]<0.78:
        flashes.append({"frame":i+1,**b,"before":a["white"],"after":c["white"]})
peaks=[{"frame":i+1,**x} for i,x in enumerate(frames) if x["white"]>0.94]
print("KALONEO_INTRO_VIDEO_AUDIT="+json.dumps({
  "fps":fps,"frames":len(frames),"durationSeconds":round(len(frames)/fps,2),
  "singleWhiteFlashes":flashes,"whiteFrames":peaks,
  "highestWhite":[{"frame":i+1,**v} for i,v in sorted(enumerate(frames),key=lambda p:p[1]["white"],reverse=True)[:15]],
  "lowBrightness":[{"frame":i+1,**v} for i,v in sorted(enumerate(frames),key=lambda p:p[1]["mean"])[:5]]
},ensure_ascii=False))
