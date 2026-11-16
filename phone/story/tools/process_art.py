import glob, os, sys, numpy as np
ONLY=sys.argv[1:]  # optional name prefixes, e.g. wren_pilot kite_pilot (default: everything)
want=lambda n: not ONLY or any(n.startswith(p) for p in ONLY)
from PIL import Image, ImageFilter
import os as _os
_H=_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
_PROJ=_os.path.dirname(_H) if _os.path.basename(_H)=='story' else _H  # works from tools/ or story/tools/
ROOT=_PROJ
OUT=ROOT+'/story/img'
os.makedirs(OUT+'/portraits',exist_ok=True); os.makedirs(OUT+'/stages',exist_ok=True)

def key(im):
    a=np.asarray(im.convert('RGB')).astype(np.float32)
    r,g,b=a[...,0],a[...,1],a[...,2]
    d=g-np.maximum(r,b)
    alpha=np.clip(1-(d-35)/(90-35),0,1)
    # despill: clamp green toward max(r,b) where green dominates
    spill=d>0
    g2=np.where(spill, np.maximum(r,b)+np.clip(d,0,None)*0.15*alpha, g)
    out=np.dstack([r,g2,b,alpha*255]).clip(0,255).astype(np.uint8)
    img=Image.fromarray(out,'RGBA')
    # soften alpha edge slightly
    al=img.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    img.putalpha(al)
    return img

def save_under(img,path,limit,q=90,**kw):
    while q>=40:
        img.save(path,'WEBP',quality=q,method=6,**kw)
        if os.path.getsize(path)<limit: return q
        q-=6
    return q

for f in sorted(glob.glob(ROOT+'/src/portraits/*.jpg')):
    n=os.path.basename(f)[:-4]
    if not want(n): continue
    im=Image.open(f).resize((768,1024),Image.LANCZOS)
    k=key(im)
    q=save_under(k,f'{OUT}/portraits/{n}.webp',150_000,alpha_quality=80)
    print(n,q,os.path.getsize(f'{OUT}/portraits/{n}.webp'))

for f in sorted(glob.glob(ROOT+'/src/stages/*.jpg')):
    n=os.path.basename(f)[:-4]
    if n=='campaign_map' or not want(n): continue  # handled in make_map.py
    im=Image.open(f).convert('RGB').resize((1920,1080),Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2,40,2))
    q=save_under(im,f'{OUT}/stages/{n}.webp',350_000,q=86)
    print(n,q,os.path.getsize(f'{OUT}/stages/{n}.webp'))
