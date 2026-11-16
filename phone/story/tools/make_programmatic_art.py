"""Programmatic art: ships (exact pointy-top axial hex geometry), Weave portraits, campaign map overlay."""
import math, os, random, sys
ONLY=set(sys.argv[1:])  # optional: only render these names (ships, weave_<mood>, map); default everything
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import os as _os
_H=_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
_PROJ=_os.path.dirname(_H) if _os.path.basename(_H)=='story' else _H  # works from tools/ or story/tools/
ROOT=_PROJ; OUT=ROOT+'/story/img'
os.makedirs(OUT+'/ships',exist_ok=True)
S3=math.sqrt(3)
NAVY=(16,26,52); NAVY2=(28,44,84); BLUE=(92,200,255); GOLD=(232,193,90)
CRIM=(220,40,80); VIOL=(150,70,230); RED=(255,90,110)

def hex_pts(cx,cy,s,shrink=1.0):
    return [(cx+s*shrink*math.cos(math.radians(60*i-30)), cy+s*shrink*math.sin(math.radians(60*i-30))) for i in range(6)]
def axial(q,r,s): return (s*S3*(q+r/2), s*1.5*r)

def layout(cells,W,H,margin=0.16):
    pts=[axial(q,r,1) for q,r in cells]
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    w=(max(xs)-min(xs))+S3; h=(max(ys)-min(ys))+2
    s=min(W*(1-2*margin)/w, H*(1-2*margin)/h)
    cx=(max(xs)+min(xs))/2; cy=(max(ys)+min(ys))/2
    return s,[(W/2+(x-cx)*s, H/2+(y-cy)*s) for x,y in pts]

def glow(layer,radius,strength=1.0):
    g=layer.filter(ImageFilter.GaussianBlur(radius))
    if strength!=1.0:
        a=np.asarray(g).astype(np.float32); a[...,3]*=strength; g=Image.fromarray(a.clip(0,255).astype(np.uint8))
    return g

def render_ship(name,cells,kind='human',roles=None,seam=None,battered=False,seed=1):
    if ONLY and name not in ONLY: return
    random.seed(seed)
    SS=2; W,H=1024*SS,768*SS
    s,centers=layout(cells,W,H)
    base=Image.new('RGBA',(W,H),(0,0,0,0))
    lines=Image.new('RGBA',(W,H),(0,0,0,0))
    glowl=Image.new('RGBA',(W,H),(0,0,0,0))
    db=ImageDraw.Draw(base); dl=ImageDraw.Draw(lines); dg=ImageDraw.Draw(glowl)
    lw=max(3,int(s*0.035))
    for i,((x,y),cell) in enumerate(zip(centers,cells)):
        role=(roles or {}).get(tuple(cell),'hull')
        pts=hex_pts(x,y,s,0.97)
        if kind=='human':
            # painterly gradient fill: light from upper-right (gold key) and left rim (blue)
            m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon(pts,fill=255)
            grad=Image.new('RGBA',(W,H))
            gy,gx=np.mgrid[0:H,0:W].astype(np.float32)
            t=np.clip(((gx-(x-s))/(2*s))*0.5+((y+s-gy)/(2*s))*0.5,0,1)
            col=np.dstack([NAVY[0]+(NAVY2[0]+18-NAVY[0])*t, NAVY[1]+(NAVY2[1]+16-NAVY[1])*t, NAVY[2]+(NAVY2[2]+20-NAVY[2])*t, np.full_like(t,255)])
            grad=Image.fromarray(col.astype(np.uint8),'RGBA')
            base.paste(grad,(0,0),m)
            # inner plating lines
            ip=hex_pts(x,y,s,0.72)
            dl.line(ip+[ip[0]],fill=(*BLUE,70),width=max(1,lw//2))
            dl.line(pts+[pts[0]],fill=(*BLUE,230),width=lw)
            # bays (3 internal slots like the game's board renderer)
            for k,(bx,by) in enumerate([(-S3/4,-1/4),(S3/4,-1/4),(0,1/2)]):
                cxk,cyk=x+bx*s*0.9,y+by*s*0.9
                rr=s*0.13
                dl.ellipse([cxk-rr,cyk-rr,cxk+rr,cyk+rr],outline=(*GOLD,170),width=max(1,lw//2))
            if role=='core':
                dg.ellipse([x-s*0.22,y-s*0.22,x+s*0.22,y+s*0.22],fill=(*GOLD,200))
                dl.ellipse([x-s*0.12,y-s*0.12,x+s*0.12,y+s*0.12],fill=(255,236,180,255))
            if role in('engine','core','hull'):
                # engine glow at south edge
                ex,ey=x,y+s*0.86
                dg.ellipse([ex-s*0.28,ey-s*0.12,ex+s*0.28,ey+s*0.18],fill=(*BLUE,210))
            if role=='launcher':
                for k in range(3):
                    ox=x+(k-1)*s*0.22
                    dl.rectangle([ox-s*0.06,y-s*0.42,ox+s*0.06,y-s*0.12],outline=(*VIOL,230),width=max(1,lw//2))
                dg.ellipse([x-s*0.3,y-s*0.5,x+s*0.3,y-s*0.05],fill=(*VIOL,120))
            if role=='sensor':
                dl.arc([x-s*0.35,y-s*0.55,x+s*0.35,y+s*0.15],200,340,fill=(*BLUE,230),width=lw)
                dl.ellipse([x-s*0.06,y-s*0.26,x+s*0.06,y-s*0.14],fill=(*BLUE,255))
            if role=='gun':
                # escort laser turret: twin gold barrels pointing north from a ring mount
                dl.ellipse([x-s*0.2,y-s*0.2,x+s*0.2,y+s*0.2],outline=(*GOLD,230),width=lw)
                for k in (-1,1):
                    ox=x+k*s*0.09
                    dl.rectangle([ox-s*0.035,y-s*0.6,ox+s*0.035,y-s*0.18],fill=(*GOLD,220))
                dg.ellipse([x-s*0.12,y-s*0.7,x+s*0.12,y-s*0.5],fill=(*BLUE,200))
            if role=='cockpit':
                dl.polygon([(x-s*0.25,y-s*0.15),(x+s*0.25,y-s*0.15),(x,y-s*0.5)],outline=(*GOLD,230),fill=(60,110,160,220))
            if battered:
                pass
        else:
            # Weave cell: translucent membrane, crimson-violet gradient, inner nucleus, vein network
            m=Image.new('L',(W,H),0); ImageDraw.Draw(m).polygon(hex_pts(x,y,s,0.95),fill=255)
            gy,gx=np.mgrid[0:H,0:W].astype(np.float32)
            d=np.sqrt((gx-x)**2+(gy-y)**2)/s
            t=np.clip(1-d,0,1)
            cA=np.array(CRIM if (i%2==0) else VIOL,np.float32); cB=np.array((40,8,40),np.float32)
            col=cB+(cA-cB)*(t[...,None]**0.8)
            alpha=(120+135*t)
            if battered: col*=0.55; alpha*=0.85
            arr=np.dstack([col,alpha]).clip(0,255).astype(np.uint8)
            base.paste(Image.fromarray(arr,'RGBA'),(0,0),m)
            ImageDraw.Draw(base)
            dl.line(hex_pts(x,y,s,0.95)+[hex_pts(x,y,s,0.95)[0]],fill=(*RED,235) if not battered else (150,60,80,200),width=lw)
            # veins
            for v in range(7):
                a0=random.uniform(0,2*math.pi); pts_v=[(x,y)]
                rr=0
                for st in range(5):
                    rr+=s*0.15; a0+=random.uniform(-0.5,0.5)
                    pts_v.append((x+rr*math.cos(a0),y+rr*math.sin(a0)))
                dl.line(pts_v,fill=(255,150,190,110 if not battered else 50),width=max(1,lw//2))
            nr=s*0.2
            dg.ellipse([x-nr*1.6,y-nr*1.6,x+nr*1.6,y+nr*1.6],fill=(*RED,200 if not battered else 70))
            dl.ellipse([x-nr*0.6,y-nr*0.6,x+nr*0.6,y+nr*0.6],fill=(255,210,230,240 if not battered else 120))
            if battered:
                # cracks and missing chunks
                for c in range(4):
                    a0=random.uniform(0,2*math.pi); r0=random.uniform(0.2,0.6)*s
                    px,py=x+r0*math.cos(a0),y+r0*math.sin(a0)
                    seg=[(px,py)]
                    for st in range(4):
                        a0+=random.uniform(-0.9,0.9); px+=s*0.14*math.cos(a0); py+=s*0.14*math.sin(a0); seg.append((px,py))
                    dl.line(seg,fill=(10,5,15,255),width=lw)
                # bite out a chunk
                bx,by=x+s*random.uniform(-0.5,0.5),y+s*random.uniform(-0.5,0.5)
                ImageDraw.Draw(base).ellipse([bx-s*0.22,by-s*0.18,bx+s*0.22,by+s*0.18],fill=(0,0,0,0))
    if seam:
        for (a,b) in seam:
            ia=cells.index(list(a)) if isinstance(cells[0],list) else cells.index(a)
            ib=cells.index(list(b)) if isinstance(cells[0],list) else cells.index(b)
            (x1,y1),(x2,y2)=centers[ia],centers[ib]
            mx,my=(x1+x2)/2,(y1+y2)/2
            ang=math.atan2(y2-y1,x2-x1)+math.pi/2
            hl=s*0.5
            p1=(mx+hl*math.cos(ang),my+hl*math.sin(ang)); p2=(mx-hl*math.cos(ang),my-hl*math.sin(ang))
            dg.line([p1,p2],fill=(*CRIM,255),width=lw*6)
            # little hex cells along the seam
            for k in range(-3,4):
                cx2=mx+k*hl/3.3*math.cos(ang); cy2=my+k*hl/3.3*math.sin(ang)
                dl.polygon(hex_pts(cx2,cy2,s*0.07),outline=(255,140,190,255),fill=(200,40,110,200))
    if kind=='human':
        g=glow(glowl,s*0.12); g2=glow(lines,s*0.05,0.8)
        out=Image.alpha_composite(Image.new('RGBA',(W,H),(0,0,0,0)),glow(base.copy(),s*0.18,0.25))
        out=Image.alpha_composite(out,base); out=Image.alpha_composite(out,g); out=Image.alpha_composite(out,g2); out=Image.alpha_composite(out,lines)
        out=Image.alpha_composite(out,glowl.filter(ImageFilter.GaussianBlur(s*0.04)))
    else:
        halo=glow(base.copy(),s*0.25,0.6)
        out=Image.alpha_composite(halo,base)
        out=Image.alpha_composite(out,glow(glowl,s*0.1)); out=Image.alpha_composite(out,glow(lines,s*0.04,0.9)); out=Image.alpha_composite(out,lines)
    if seam:
        out=Image.alpha_composite(out,glow(glowl,s*0.2,0.7))
    out=out.resize((1024,768),Image.LANCZOS)
    p=f'{OUT}/ships/{name}.webp'; out.save(p,'WEBP',quality=88,alpha_quality=90,method=6)
    print(name,os.path.getsize(p))

R=lambda d:{tuple(k):v for k,v in d.items()}
render_ship('kestrel',[(-1,0),(0,0),(1,0)],roles={(-1,0):'launcher_slot',(0,0):'core',(1,0):'sensor'})
render_ship('kestrel_refit',[(-1,0),(0,0),(1,0),(0,-1)],roles={(-1,0):'engine',(0,0):'core',(1,0):'sensor',(0,-1):'launcher'})
graft=[(-1,0),(0,0),(1,0),(0,-1),(-1,1),(0,1)]
render_ship('kestrel_grafted',graft,roles={(0,0):'core',(1,0):'sensor',(0,-1):'launcher',(-1,1):'cockpit',(0,1):'engine'},seam=[((-1,0),(-1,1)),((0,0),(0,1)),((0,0),(-1,1)),((1,0),(0,1))])
render_ship('sparrow',[(0,0)],roles={(0,0):'cockpit'})
render_ship('finch',[(0,0)],roles={(0,0):'sensor'})
render_ship('halcyon',[(0,0),(1,0),(0,1)],roles={(0,0):'core',(1,0):'sensor',(0,1):'cockpit'})
render_ship('tern',[(0,0),(1,0)],roles={(0,0):'cockpit',(1,0):'engine'})
render_ship('wren',[(0,0)],roles={(0,0):'gun'})                          # v2: ch1 escort, 1 hex
render_ship('kite',[(0,0),(1,0)],roles={(0,0):'cockpit',(1,0):'gun'})     # v2: ch1 escort, 2 hexes
render_ship('seed',[(0,0),(1,0)],kind='weave',seed=3)
twin_a=[(0,0),(1,0),(0,1)]; twin_b=[(1,-1),(2,-1),(2,-2)]  # twin_a = PR #2 fixture split piece
render_ship('twin',twin_a+twin_b,kind='weave',seed=5)
render_ship('twin_a',twin_a,kind='weave',seed=6)
render_ship('twin_b',twin_b,kind='weave',seed=7)
render_ship('husk',[(0,0),(1,0)],kind='weave',battered=True,seed=11)
render_ship('husk_1',[(0,0)],kind='weave',battered=True,seed=12)
render_ship('husk_2',[(0,0),(1,0)],kind='weave',battered=True,seed=13)
render_ship('husk_3',[(0,0)],kind='weave',battered=True,seed=14)
render_ship('bloom',[(0,0),(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)],kind='weave',seed=21)

# ---------- Weave "portraits": abstract hex lattice, no face ----------
def weave_portrait(mood):
    if ONLY and 'weave_'+mood not in ONLY: return
    SS=2; W,H=768*SS,1024*SS
    random.seed({'calm':1,'pulse':2,'hostile':3}[mood])
    base=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(base)
    gl=Image.new('RGBA',(W,H),(0,0,0,0)); dg=ImageDraw.Draw(gl)
    s=W*0.07; cx,cy=W/2,H*0.40
    rings=3
    for q in range(-rings,rings+1):
        for r in range(-rings,rings+1):
            if abs(q+r)>rings: continue
            x,y=axial(q,r,s); x+=cx; y+=cy
            dist=max(abs(q),abs(r),abs(q+r))
            if mood=='calm': a=int(200-dist*50); col=VIOL; w=4
            elif mood=='pulse': a=int(240-dist*40); col=(255,120,200) if dist in(0,2) else VIOL; w=6
            else: a=int(255-dist*35); col=CRIM; w=8
            if a<=0: continue
            if mood=='hostile' and random.random()<0.25 and dist>1: continue
            shrink=0.9 if mood!='hostile' else random.uniform(0.75,0.95)
            pts=hex_pts(x,y,s,shrink)
            d.polygon(pts,fill=(*col,int(a*0.25)),outline=(*col,a))
            d.line(pts+[pts[0]],fill=(*col,a),width=w)
            if dist==0 or (mood=='pulse' and dist==2 and random.random()<0.5):
                dg.polygon(hex_pts(x,y,s,0.6),fill=(255,170,220,230))
    if mood=='pulse':
        for k,rad in enumerate([s*1.9,s*3.6,s*5.0]):
            dg.ellipse([cx-rad,cy-rad,cx+rad,cy+rad],outline=(255,120,200,200-k*50),width=10)
    if mood=='hostile':
        for k in range(14):
            a0=random.uniform(0,2*math.pi); r0=s*1.2; r1=s*random.uniform(3.6,5.4)
            dg.line([(cx+r0*math.cos(a0),cy+r0*math.sin(a0)),(cx+r1*math.cos(a0),cy+r1*math.sin(a0))],fill=(*RED,220),width=8)
    # body column below, like a 'torso' of cells fading out, to sit like a waist-up portrait
    for k in range(10):
        x=cx+random.uniform(-W*0.3,W*0.3); y=H*0.72+random.uniform(0,H*0.25)
        d.polygon(hex_pts(x,y,s*random.uniform(0.4,0.8)),outline=(*VIOL,90),fill=(*VIOL,25))
    out=Image.alpha_composite(glow(base,s*0.3,0.8),base)
    out=Image.alpha_composite(out,glow(gl,s*0.25)); out=Image.alpha_composite(out,gl.filter(ImageFilter.GaussianBlur(4)))
    out=out.resize((768,1024),Image.LANCZOS)
    p=f'{OUT}/portraits/weave_{mood}.webp'
    for q in (80,70,60,50,40):
        out.save(p,'WEBP',quality=q,alpha_quality=70,method=6)
        if os.path.getsize(p)<150_000: break; print(p,os.path.getsize(p))
for m in ('calm','pulse','hostile'): weave_portrait(m)

# ---------- campaign map: clear the node spots, add faint channel routes ----------
if ONLY and 'map' not in ONLY: sys.exit(0)
spots={'ch1':(0.50,0.90),'ch2':(0.50,0.72),'ch3':(0.50,0.55),'ch4a':(0.30,0.38),'ch4b':(0.72,0.38),'ch5':(0.50,0.20)}
im=Image.open(ROOT+'/src/stages/campaign_map.jpg').convert('RGB').resize((1920,1080),Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2,40,2))
W,H=im.size
arr=np.asarray(im).astype(np.float32)
gy,gx=np.mgrid[0:H,0:W].astype(np.float32)
dark=np.ones((H,W),np.float32)
for k,(fx,fy) in spots.items():
    d=np.sqrt((gx-fx*W)**2+(gy-fy*H)**2)
    dark=np.minimum(dark,np.clip((d-40)/70,0,1)*0.55+0.45)
target=np.array([8,13,28],np.float32)
arr=arr*dark[...,None]+target*(1-dark[...,None])
im=Image.fromarray(arr.clip(0,255).astype(np.uint8)).convert('RGBA')
ov=Image.new('RGBA',(W,H),(0,0,0,0)); do=ImageDraw.Draw(ov)
def route(a,b,col,dash=14,gap=10,width=3,alpha=150):
    (x1,y1),(x2,y2)=[(spots[a][0]*W,spots[a][1]*H),(spots[b][0]*W,spots[b][1]*H)]
    L=math.hypot(x2-x1,y2-y1); ux,uy=(x2-x1)/L,(y2-y1)/L
    t=58
    while t<L-58:
        e=min(t+dash,L-58)
        do.line([(x1+ux*t,y1+uy*t),(x1+ux*e,y1+uy*e)],fill=(*col,alpha),width=width)
        t+=dash+gap
route('ch1','ch2',GOLD); route('ch2','ch3',GOLD); route('ch3','ch4a',GOLD); route('ch3','ch4b',BLUE,alpha=110)
route('ch4a','ch5',GOLD); route('ch4b','ch5',BLUE,alpha=60)
im=Image.alpha_composite(im,ov.filter(ImageFilter.GaussianBlur(4))); im=Image.alpha_composite(im,ov).convert('RGB')
q=88
while True:
    im.save(OUT+'/stages/campaign_map.webp','WEBP',quality=q,method=6)
    if os.path.getsize(OUT+'/stages/campaign_map.webp')<350_000 or q<50: break
    q-=6
print('map',q,os.path.getsize(OUT+'/stages/campaign_map.webp'))
