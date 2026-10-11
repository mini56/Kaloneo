#!/usr/bin/env python3
"""Installe exactement 30 icônes PNG 96x96, sans toucher aux tests KALTEST."""
import base64,hashlib,io,json,re,subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SOURCE="KALONEO_ICONES_30_R61"
TARGET=ROOT/"kaloneo"/"icons-tests"
LIBRARY=ROOT/"kaloneo"/"icon-library.js"
BUILDER=ROOT/"kaloneo"/"test-builder.js"
def main_file(path):
    if not re.fullmatch(r"[A-Za-z0-9_./-]+",path):
        raise RuntimeError("Chemin invalide: "+path)
    return subprocess.check_output(["git","show","origin/main:"+path],cwd=ROOT)
items=json.loads(main_file(SOURCE+"/inventaire_30_icones.json").decode("utf-8"))["items"]
if len(items)!=30 or len({x["id"] for x in items})!=30:
    raise RuntimeError("Le manifeste ne contient pas 30 identifiants uniques.")
lib=LIBRARY.read_text(encoding="utf-8")
builder=BUILDER.read_text(encoding="utf-8")
old="  const api=Object.freeze({version:'kaloneo-icons-v5-70',count:icons.length,icons:Object.freeze(icons)});"
new="  const api=Object.freeze({version:'kaloneo-icons-v6-100',count:icons.length,icons:Object.freeze(icons)});"
if lib.count(old)!=1 or lib.count('"id":"')!=70:
    raise RuntimeError("Les 70 anciennes icônes ne correspondent pas : abandon sans modification.")
if "window.KaloneoIconLibrary?.count!==70" not in builder:
    raise RuntimeError("Le contrôle du sélecteur d'icônes est différent.")
if TARGET.exists() and any(TARGET.iterdir()):
    raise RuntimeError("Le dossier de sortie contient déjà des fichiers. Aucun écrasement.")
to_write={}
icons=[]
manifest={"version":"KALONEO-ICONES-R61-96","count":30,"existing_count":70,"total":100,"pixel_size":96,"items":[]}
for item in items:
    ident=item["id"]
    if not re.fullmatch(r"[a-z0-9_]+",ident) or '"id":"'+ident+'"' in lib:
        raise RuntimeError("Identifiant invalide ou existant : "+ident)
    source=SOURCE+"/apercus/"+ident+".png"
    with Image.open(io.BytesIO(main_file(source))) as im:
        if im.format!="PNG" or im.size!=(192,192):
            raise RuntimeError("Source non PNG 192x192 : "+ident)
        out=io.BytesIO()
        im.convert("RGBA").resize((96,96),Image.Resampling.LANCZOS).save(out,format="PNG",optimize=True)
        png=out.getvalue()
    if png[:8]!=bytes.fromhex("89504e470d0a1a0a") or int.from_bytes(png[16:20],"big")!=96 or int.from_bytes(png[20:24],"big")!=96:
        raise RuntimeError("PNG non 96x96 : "+ident)
    to_write[ident+".png"]=png
    icons.append({"id":ident,"label":item["label"],"data":"data:image/png;base64,"+base64.b64encode(png).decode("ascii")})
    manifest["items"].append({"id":ident,"label":item["label"],"original":"kaloneo/icons-tests/"+ident+".png","largeur":96,"hauteur":96,"sha256":hashlib.sha256(png).hexdigest().upper()})
addition="  // 30 nouvelles icônes 96 x 96, même taille que les 70 existantes.\n  icons.push(..."+json.dumps(icons,ensure_ascii=False,separators=(",",":"))+");\n"
lib=lib.replace(old,addition+new)
builder=builder.replace("window.KaloneoIconLibrary?.count!==70","window.KaloneoIconLibrary?.count!==100").replace("70 icônes attendues.","100 icônes attendues.")
TARGET.mkdir(parents=True,exist_ok=True)
for filename,png in to_write.items():
    (TARGET/filename).write_bytes(png)
(TARGET/"inventaire_30_icones.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
LIBRARY.write_text(lib,encoding="utf-8")
BUILDER.write_text(builder,encoding="utf-8")
print("ICONES_96_R61: OK - 70 existantes inchangées et 30 nouvelles PNG 96x96.")
