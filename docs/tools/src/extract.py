import yaml, json, math, glob, os
R='/workspace/repo-main'
W=yaml.safe_load(open(R+'/rules/world_v0.4.yaml'))
WB=yaml.safe_load(open(R+'/beta/rules/world_v0.4.yaml'))
F=yaml.safe_load(open(R+'/rules/fleets_v0.4.yaml'))
parts={}
for slot,grp in (('bay',W['bay_parts']),('mount',W['mount_parts'])):
    for k,v in grp.items(): parts[k]=dict(v,slot=slot)
mun=W['munitions']
def disc(c,r):
    out=[]
    for dq in range(-r,r+1):
        for dr in range(max(-r,-dq-r),min(r,-dq+r)+1): out.append([c[0]+dq,c[1]+dr])
    return out
def tcells(t):
    if isinstance(t.get('radius'),int): return disc(t['at'],t['radius'])
    if t.get('size')==3: a=t['at']; return [[a[0]-1,a[1]],a,[a[0]+1,a[1]]]
    if t.get('size')==7: return disc(t['at'],1)
    return [t['at']]
EDGE={'north':lambda c,R:c[1]+R,'south':lambda c,R:R-c[1]}
def stats(hull,load=None):
    n=len(hull); cnt={}
    for s in hull:
        for p in (s.get('bays') or [])+(s.get('mounts') or []): cnt[p]=cnt.get(p,0)+1
    sensor=2*cnt.get('core',0) if cnt.get('core') else 0
    sensor=2+2*cnt.get('sensor',0)
    sig=max(n-cnt.get('stealth',0), math.ceil(n/3))
    cost=3*n+sum(parts[p]['cost']*c for p,c in cnt.items() if p in parts)+sum(mun[k]['cost']*v for k,v in (load or {}).items())
    link=max([4]+([12] if cnt.get('comms') else []))
    return dict(segments=n,sensor=sensor,signature=sig,thrust=cnt.get('engine',0),lasers=cnt.get('laser',0),armour_hp=2*cnt.get('armour',0),shields=cnt.get('shield',0),pd=cnt.get('point_defence',0),launchers=cnt.get('launcher',0),magazine=3*cnt.get('magazine',0),link=link,cost=cost,parts=cnt)
def mapdata(path,deploy=None,kind='rules'):
    m=yaml.safe_load(open(path))['map']; Rr=m['board']['radius']
    terr=[]
    for t in m.get('terrain',[]): terr.append({'type':t['type'],'cells':tcells(t)})
    zones={}
    for zn,z in (m.get('zones') or {}).items():
        if isinstance(z,list): zones[zn]=z
        elif isinstance(z,dict) and 'edge' in z:
            zones[zn]=[c for c in disc([0,0],Rr) if EDGE[z['edge']](c,Rr)<z['depth']]
    return dict(name=m['name'],file=os.path.relpath(path,R),radius=Rr,terrain=terr,zones=zones,objective=m.get('objective'),deploy=deploy or [],kind=kind)
# fleets
fleet=[]
for sh in F['player_1']['ships']:
    fleet.append(dict(name=sh['name'],flagship=sh.get('flagship',False),load=sh.get('load',{}),hull=sh['hull'],stats=stats(sh['hull'],sh.get('load')),src='rules/fleets_v0.4.yaml'))
def hullcells(hull,at,mirror=False):
    return [[at[0]+(-s['at'][0] if mirror else s['at'][0]),at[1]+(-s['at'][1] if mirror else s['at'][1])] for s in hull]
byname={s['name']:s for s in F['player_1']['ships']}
dep=[]
for d in F['player_1']['deployment']:
    if 'ship' in d: dep.append({'side':0,'label':d['ship'],'cells':hullcells(byname[d['ship']]['hull'],d['at'])}); dep.append({'side':1,'label':d['ship'],'cells':hullcells(byname[d['ship']]['hull'],[-d['at'][0],-d['at'][1]],True)})
    else: dep.append({'side':0,'label':'mine','cells':[d['mine']],'mine':True}); dep.append({'side':1,'label':'mine','cells':[[-d['mine'][0],-d['mine'][1]]],'mine':True})
maps=[mapdata(R+'/rules/map_skirmish.yaml',dep),mapdata(R+'/rules/map_open_space.yaml',[]),mapdata(R+'/rules/map_beacon_story.yaml',dep)]
# campaign
C=R+'/beta/campaign'
ships=yaml.safe_load(open(C+'/ships.yaml'))
camp=yaml.safe_load(open(C+'/campaign.yaml'))['campaign']
cships=[]
for k,v in ships.items():
    cships.append(dict(key=k,flagship=v.get('flagship',False),load=v.get('load',{}),hull=v['hull'],joined=v.get('joined',False),seams=v.get('seams'),stats=stats(v['hull'],v.get('load'))))
def pick(id,ch):
    order=['ch1','ch2','ch3','ch4a','ch5']
    for c in reversed(order[:order.index(ch)+1]):
        if f'{id}@{c}' in ships: return ships[f'{id}@{c}']
chapters=[]
for n in camp['nodes']:
    if 'file' not in n: chapters.append(dict(id=n['id'],title=n['title'],locked=True)); continue
    ch=yaml.safe_load(open(C+'/'+n['file']))['chapter']
    dep=[]
    for side,key in ((0,'player'),(1,'enemy')):
        for d in (ch.get(key) or {}).get('deployment',[]) or []:
            if 'mine' in d: dep.append({'side':side,'label':'mine','cells':[d['mine']],'mine':True}); continue
            if 'ship' not in d: continue
            h=pick(d['ship'],n['id'])
            if h: dep.append({'side':side,'label':d['ship'],'cells':hullcells(h['hull'],d['at'])})
        for d in (ch.get(key) or {}).get('mines',[]) or []:
            pass
    md=mapdata(C+'/'+ch['map'].replace('maps/','maps/'),dep,'campaign')
    md['chapter']=n['id']; md['title']=n['title']
    maps.append(md)
    shipsList=[]
    for side,key in (('player','player'),('enemy','enemy')):
        for s in (ch.get(key) or {}).get('ships',[]) or []:
            shipsList.append((side, s if isinstance(s,str) else s.get('id')))
    chapters.append(dict(id=n['id'],title=n['title'],file='campaign/'+n['file'],map=ch['map'],ships=shipsList,scripts=len(ch.get('script',[])),win=ch.get('win'),lose=ch.get('lose'),rewards=ch.get('rewards'),groups=list((ch.get('groups') or {}).keys()) if isinstance(ch.get('groups'),dict) else [g.get('id') for g in ch.get('groups') or [] if isinstance(g,dict)]))
data=dict(world=dict(turns=W['turns'],actions=W['actions'],segments=W['segments'],movement={k:v for k,v in W['movement'].items() if k!='examples'},movement_examples=W['movement'].get('examples'),detection=W['detection'],damage=W['damage'],terrain=W['terrain'],comms=W['comms']),
  beta=dict(ram=WB['actions'].get('ram'),attack_run_bonus=WB['detection'].get('attack_run_bonus'),laser=WB['mount_parts']['laser'],shield=WB['mount_parts']['shield'],mine=WB['munitions']['mine']),
  parts=parts,munitions=mun,fleet=fleet,budget=F['budget'],maps=maps,campaign=dict(title=camp['title'],start=camp['start'],start_state=camp['start_state'],nodes=camp['nodes']),chapters=chapters,cships=cships)
json.dump(data,open('/workspace/v2work/guide/data.json','w'),separators=(',',':'),default=str)
print(len(json.dumps(data)), [m['name'] for m in maps], [ (s['name'],s['stats']['cost'],s['stats']['sensor'],s['stats']['signature']) for s in fleet])
for c in cships: print(c['key'],c['stats']['segments'],c['stats']['sensor'],c['stats']['signature'],c['stats']['thrust'],c['stats']['cost'])
for c in chapters: print(c)
