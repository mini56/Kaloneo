#!/usr/bin/env python3
"""R168 : créer uniquement des images de RENDU, sans altérer les sources V1.
Les originaux de la bibliothèque restent inchangés, avec les mêmes SHA/exports.
"""
from __future__ import annotations
import hashlib
import io
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/"app"/"web"
LIB=WEB/"bibliotheque-images"
RENDER=WEB/"kaltest-render-images"
SOURCES={
    "tri-chevilles-kaloneo": LIB/"illustrations-tests"/"tri-chevilles-kaloneo.png",
    "dictee-bureau-soleil": LIB/"Bureau d’apprentissage au soleil.png",
}
WIDTH=1200
QUALITY=88
Image.MAX_IMAGE_PIXELS=100_000_000

def main():
    RENDER.mkdir(parents=True,exist_ok=True)
    result={"format":"kaloneo-render-variants","version":1,"width":WIDTH,"quality":QUALITY,"images":[]}
    for name, source in SOURCES.items():
        original=source.read_bytes()
        with Image.open(io.BytesIO(original)) as im:
            im=ImageOps.exif_transpose(im)
            if im.width>WIDTH: im.thumbnail((WIDTH,WIDTH*8),Image.Resampling.LANCZOS)
            # Les photos sont optimisées en WebP ; les PNG originaux restent
            # accessibles via le catalogue unique d'images.
            if im.mode not in ("RGB","RGBA"): im=im.convert("RGBA" if "A" in im.getbands() else "RGB")
            output=RENDER/(name+".webp")
            im.save(output,"WEBP",quality=QUALITY,method=6)
        compressed=output.read_bytes()
        if len(compressed)>=len(original)*.85:
            raise RuntimeError(f"Image WebP insuffisamment optimisée: {name}")
        result["images"].append({
            "original":source.relative_to(WEB).as_posix(),
            "render":output.relative_to(WEB).as_posix(),
            "originalBytes":len(original),"renderBytes":len(compressed),
            "sha256":hashlib.sha256(original).hexdigest()
        })
    # Les ressources historiques utilisées directement par les tests restent
    # dans leur chemin d'origine et gardent leur extension. Seule la COPIE
    # app/web est optimisée, jamais seb-evalpro/source ni les V1 validées.
    imageqcm=WEB/"imageqcm"
    total_saved=0
    count=0
    if imageqcm.exists():
        for path in imageqcm.iterdir():
            if not path.is_file() or path.suffix.lower() not in (".png",".jpg",".jpeg",".webp"):continue
            original=path.read_bytes()
            if len(original)<220_000: continue
            try:
                with Image.open(io.BytesIO(original)) as im:
                    im=ImageOps.exif_transpose(im)
                    if im.width<=WIDTH and im.height<=WIDTH:continue
                    im.thumbnail((WIDTH,WIDTH),Image.Resampling.LANCZOS)
                    buf=io.BytesIO()
                    ext=path.suffix.lower()
                    if ext==".png":
                        im.save(buf,format="PNG",optimize=True,compress_level=9)
                    elif ext==".webp":
                        im.save(buf,format="WEBP",quality=QUALITY,method=6)
                    else:
                        im.convert("RGB").save(buf,format="JPEG",quality=90,optimize=True,subsampling=0)
                converted=buf.getvalue()
                if len(converted)<len(original)*.88:
                    path.write_bytes(converted)
                    count+=1
                    total_saved+=len(original)-len(converted)
            except (OSError,ValueError) as error:
                print(f"KALONEO_IMAGE_SKIP {path.name}: {error}")
    result["imageqcmOptimized"]=count
    result["imageqcmBytesSaved"]=total_saved
    (RENDER/"manifest.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    original_bytes=sum(x["originalBytes"] for x in result["images"])
    render_bytes=sum(x["renderBytes"] for x in result["images"])
    print(f"KALONEO_R168_RENDER_OPTIMIZED=OK photos {original_bytes}->{render_bytes} octets; imageqcm {count} fichiers ({total_saved} octets économisés)")
if __name__=="__main__":
    main()
