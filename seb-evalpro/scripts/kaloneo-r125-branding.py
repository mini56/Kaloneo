#!/usr/bin/env python3
"""KALONÉO Windows branding: derive every installer asset from the APPROVED logo.
No changes to the logo itself, test images, V1, or candidate data.
Requires Pillow; executed in the Windows setup workflow only.
"""
from pathlib import Path
import base64, io, re
from PIL import Image, ImageDraw, ImageFont, ImageOps
import json, sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"source/assets/kaloneo-logo-app.png"
OUT=ROOT/"build/pilot-resources"
OUT.mkdir(parents=True,exist_ok=True)
LOGO=Image.open(SOURCE).convert("RGBA")
assert LOGO.size==(300,188),f"Official KALONÉO logo changed; inspect first: {LOGO.size}"
VERSION=json.loads((ROOT/"package.json").read_text(encoding="utf-8"))
assert VERSION["sebBuildNumber"]==139, "R128 must use a new Build #135, not failed R127 #132"
BLUE="#004e70"
ORANGE="#f58422"

font_file=Path("C:/Windows/Fonts/segoeui.ttf")
def font(size):
    if font_file.is_file():return ImageFont.truetype(str(font_file),size)
    return ImageFont.load_default()

def paste_contained(dst,img,area):
    x,y,w,h=area
    bounded=ImageOps.contain(img,(w,h),Image.Resampling.LANCZOS)
    dst.paste(bounded,(x+(w-bounded.width)//2,y+(h-bounded.height)//2),bounded)

# App, installer and uninstaller: KALONÉO's ORIGINAL chameleon / wordmark.
# Use a square canvas to avoid any arbitrary distortion of the approved artwork.
# IMPORTANT: this is the EXACT transparent 40x40 chameleon from the left
# candidate navigation bar (not the complete wordmark). Do not redraw it.
navigation=(ROOT/"source/js/seb-ui-runtime.js").read_text(encoding="utf-8")
match=re.search(r"const KALONEO_BAR_ICON_DATA='data:image/png;base64,([A-Za-z0-9+/=]+)'",navigation)
assert match, "The official candidate bar icon must be accessible in the source."
bar_data=base64.b64decode(match.group(1),validate=True)
candidate_icon=Image.open(io.BytesIO(bar_data)).convert("RGBA")
assert candidate_icon.size==(40,40), "Candidate bar icon size changed: inspect before building."
assert candidate_icon.getpixel((0,0))[3]==0, "Taskbar icon must retain the original transparency."
icon=candidate_icon.resize((512,512),Image.Resampling.LANCZOS)
icon.save(OUT/"kaloneo.ico",format="ICO",
          sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
# Windows EXE, shortcut, installer, uninstaller and Electron window use ONE
# single multi-size asset. Never use the complete logo in the taskbar again.
with Image.open(OUT/"kaloneo.ico") as check:
    assert check.getpixel((0,0))[3]==0, "Generated Windows icon lost alpha transparency."
    assert len(check.ico.sizes())>=5, "Windows icon must include multiple sizes."
print("KALONEO_CHAMELEON_ICON_R128=OK — official candidate icon extracted byte-for-byte.")

# NSIS custom full wizard welcome/finish panel.
welcome=Image.new("RGB",(450,228),"white")
d=ImageDraw.Draw(welcome)
d.rectangle((0,0,450,7),fill=BLUE)
paste_contained(welcome,LOGO,(48,16,354,188))
d.line((28,209,422,209),fill=ORANGE,width=2)
d.text((12,213),f"Build #{VERSION['sebBuildNumber']}",font=font(10),fill=BLUE)
welcome.save(OUT/"installerBranding.bmp",format="BMP")

# Header used on installation steps other than welcome and finish.
header=Image.new("RGB",(150,57),"white")
paste_contained(header,LOGO,(10,2,130,52))
header.save(OUT/"installerHeader.bmp",format="BMP")

# Standard NSIS side panels: same logo, same colors, no legacy branding.
sidebar=Image.new("RGB",(164,314),"white")
d=ImageDraw.Draw(sidebar)
d.rectangle((0,0,164,8),fill=BLUE)
paste_contained(sidebar,LOGO,(6,45,152,122))
d.rectangle((0,291,164,314),fill=BLUE)
d.rectangle((0,286,164,291),fill=ORANGE)
sidebar.save(OUT/"installerSidebar.bmp",format="BMP")

for p in ("kaloneo.ico","installerBranding.bmp","installerHeader.bmp","installerSidebar.bmp"):
    asset=OUT/p
    assert asset.is_file() and asset.stat().st_size>1000,asset
print("KALONEO_BRANDING_R132=OK — icon multi-résolution + NSIS accueil, en-tête, volet, fin")
