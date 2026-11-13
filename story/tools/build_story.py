"""Generates story/characters.json, stages.json, barks.json, ships.json and scenes/*.json.
Source of truth for all dialogue. Re-run after edits: python3 tools/build_story.py"""
import json, os
import os as _os
_H=_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
_PROJ=_os.path.dirname(_H) if _os.path.basename(_H)=='story' else _H  # works from tools/ or story/tools/
ROOT=_PROJ+'/story'
EXPR=['neutral','determined','worried','smile','shock','hurt']
def P(cid,exprs=EXPR): return {e:f'img/portraits/{cid}_{e}.webp' for e in exprs}

characters={
 'captain_a':{'name':'Captain Vey','title':'Captain, survey cutter Kestrel','color':'#e8c15a','portraits':P('captain_a')},
 'captain_b':{'name':'Captain Vey','title':'Captain, survey cutter Kestrel','color':'#e8c15a','portraits':P('captain_b')},
 'li':{'name':'Li','title':'Pilot, courier-gunship Halcyon','color':'#6fd3c8','portraits':P('li')},
 'engineer':{'name':'Moss Okafor','title':'Chief engineer, Kestrel','color':'#f08a4b','portraits':P('engineer')},
 'sparrow_pilot':{'name':'Teo Marsh','title':'Scout pilot, Sparrow (Kestrel\'s helm in ch1)','color':'#5cc8ff','portraits':P('sparrow_pilot')},
 'finch_pilot':{'name':'Priya "Nanda" Nandakumar','short':'Nanda','title':'Captain, escort Finch (newly appointed)','color':'#9fb4ff','portraits':P('finch_pilot'),
   'bio':'Youngest escort captain in the flotilla; Finch is the first command. Nervous, meticulous, logs everything. Killed in ch1_finch_down.'},
 'wren_pilot':{'name':'Sefa Lowe','short':'Sefa','title':'Pilot, escort Wren','color':'#d4a373','portraits':P('wren_pilot'),
   'bio':'Late-forties Samoan veteran escort pilot; grey-streaked braid, laugh lines, small chin scar; tan shoulder stripe. Warm, teasing, mothers the young pilots. Rams the Seed\'s bow in ch1_hurl.'},
 'kite_pilot':{'name':'Dov Ancell','short':'Dov','title':'Pilot, escort Kite','color':'#c7a0f0','portraits':P('kite_pilot'),
   'bio':'Mid-thirties, shaved head, short dark beard, silver earring; violet shoulder stripe. Laconic, bone-dry humour, Sefa\'s wingmate for years. Rams the Seed\'s stern in ch1_hurl.'},
 'tern_pilot':{'name':'Hollis Brandt','title':"Pilot, Tern (Li's wingmate)",'color':'#8fd18b','portraits':P('tern_pilot')},
 'meridian':{'name':'Controller Abara','title':'Traffic control, Meridian Station','color':'#c9d3e8','portraits':P('meridian')},
 'mimic':{'name':'Warden Cole','title':'Ashfall Outpost (so it claims)','color':'#d9a7a0','portraits':P('mimic')},
 'weave':{'name':'The Weave','title':'Builder species','color':'#ff5a8a','portraits':P('weave',['calm','pulse','hostile'])},
 'narrator':{'name':'','title':'Caption (no portrait)','color':'#8f9cba','portraits':{}},
}
stages={
 'kestrel_bridge':{'img':'img/stages/kestrel_bridge.webp','focus':[0.45,0.45]},
 'kestrel_engine_bay':{'img':'img/stages/kestrel_engine_bay.webp','focus':[0.5,0.45]},
 'halcyon_bridge':{'img':'img/stages/halcyon_bridge.webp','focus':[0.55,0.4]},
 'comms_screen':{'img':'img/stages/comms_screen.webp','focus':[0.5,0.5]},
 'salvage_wreck':{'img':'img/stages/salvage_wreck.webp','focus':[0.55,0.5]},
 'meridian_dark':{'img':'img/stages/meridian_dark.webp','focus':[0.5,0.48]},
 'ashfall_outpost':{'img':'img/stages/ashfall_outpost.webp','focus':[0.5,0.5]},
 'weave_lattice':{'img':'img/stages/weave_lattice.webp','focus':[0.5,0.5]},
 'vista_corridor':{'img':'img/stages/vista_corridor.webp','focus':[0.5,0.55]},
 'vista_quiet_water':{'img':'img/stages/vista_quiet_water.webp','focus':[0.5,0.7]},
 'vista_bloom':{'img':'img/stages/vista_bloom.webp','focus':[0.5,0.45]},
 'campaign_map':{'img':'img/stages/campaign_map.webp','focus':[0.5,0.55],
   'spots':{'ch1':[0.50,0.90],'ch2':[0.50,0.72],'ch3':[0.50,0.55],'ch4a':[0.30,0.38],'ch4b':[0.72,0.38],'ch5':[0.50,0.20]}},
}
ships={
 'kestrel':{'name':'Kestrel','side':'player','segments':[[-1,0],[0,0],[1,0]],'img':'img/ships/kestrel.webp','note':'3-segment line cutter (campaign kestrel@ch1 and kestrel@ch2; the ch2 launcher replaces a mount, no new segment)'},
 'kestrel_refit':{'name':'Kestrel (refit)','side':'player','segments':[[-1,0],[0,0],[1,0],[0,-1]],'img':'img/ships/kestrel_refit.webp','note':'ch3-4 refit (campaign kestrel@ch3 / kestrel@ch4a): 4 segments, +[0,-1] SHIELD segment from the ch2 salvage. The ch2 launcher is bolted onto the existing 3-hex hull (see kestrel)'},
 'kestrel_grafted':{'name':'Kestrel (grafted)','side':'player','segments':[[-1,0],[0,0],[1,0],[0,-1],[-1,1],[0,1]],'img':'img/ships/kestrel_grafted.webp','note':'Kestrel refit + Tern fused at [-1,1],[0,1]; glowing Weave seam (ch4a)'},
 'sparrow':{'name':'Sparrow','side':'player','segments':[[0,0]],'img':'img/ships/sparrow.webp'},
 'finch':{'name':'Finch','side':'player','segments':[[0,0]],'img':'img/ships/finch.webp','note':'ch1 escort (Nanda); destroyed in ch1_finch_down'},
 'wren':{'name':'Wren','side':'player','segments':[[0,0]],'img':'img/ships/wren.webp','note':'v2: ch1 AI escort (Sefa Lowe), 1 hex gunboat; not yet in campaign-v1 (25992f1)'},
 'kite':{'name':'Kite','side':'player','segments':[[0,0],[1,0]],'img':'img/ships/kite.webp','note':'v2: ch1 AI escort (Dov Ancell), 2 hexes: cockpit + gun; not yet in campaign-v1 (25992f1)'},
 'halcyon':{'name':'Halcyon','side':'player','segments':[[0,0],[1,0],[0,1]],'img':'img/ships/halcyon.webp'},
 'tern':{'name':'Tern','side':'player','segments':[[0,0],[1,0]],'img':'img/ships/tern.webp'},
 'seed':{'name':'Seed','side':'weave','segments':[[0,0],[1,0]],'img':'img/ships/seed.webp'},
 'seed_a':{'name':'Seed','side':'weave','segments':[[0,0],[1,0]],'img':'img/ships/seed.webp','note':'alias of seed (campaign seed_a@ch2)'},
 'seed_b':{'name':'Seed','side':'weave','segments':[[0,0],[1,0]],'img':'img/ships/seed.webp','note':'alias of seed (campaign seed_b@ch2)'},
 'twin':{'name':'Twin','side':'weave','segments':[[0,0],[1,0],[0,1],[1,-1],[2,-1],[2,-2]],'img':'img/ships/twin.webp','note':'two 3-cell triangles joined; twin_a matches PR #2 split fixture'},
 'twin_a':{'name':'Twin (A half)','side':'weave','segments':[[0,0],[1,0],[0,1]],'img':'img/ships/twin_a.webp'},
 'twin_b':{'name':'Twin (B half)','side':'weave','segments':[[1,-1],[2,-1],[2,-2]],'img':'img/ships/twin_b.webp','note':'unsplit-frame offsets (as cells sit inside twin). Campaign twin_b@ch3 re-centres on [1,-1] -> [0,0],[1,0],[1,-1]'},
 'husk':{'name':'Husk','side':'weave','segments':[[0,0],[1,0]],'img':'img/ships/husk.webp','note':'generic alias, same shape as husk_2'},
 'husk_1':{'name':'Husk (1 cell)','side':'weave','segments':[[0,0]],'img':'img/ships/husk_1.webp'},
 'husk_2':{'name':'Husk (2 cells)','side':'weave','segments':[[0,0],[1,0]],'img':'img/ships/husk_2.webp'},
 'husk_3':{'name':'Husk (1 cell)','side':'weave','segments':[[0,0]],'img':'img/ships/husk_3.webp'},
 'bloom':{'name':'Bloom','side':'weave','segments':[[0,0],[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],'img':'img/ships/bloom.webp','note':'centre + full ring'},
}

# ---- helpers for terse scene writing ----
def L(sp,ex,tx,**kw): d={'speaker':sp,'expression':ex,'text':tx}; d.update(kw); return d
def C(sp,ex,tx): return L(sp,ex,tx,via='comms')
def N(tx): return {'speaker':'narrator','text':tx}
def W(ex,tx): return {'speaker':'weave','expression':ex,'glyphs':True,'text':tx}
def ST(s): return {'stage':s}
def FX(e): return {'effect':e}
def SH(s): return {'show_ship':s}
def HS(): return {'hide_ship':True}
def cast(*pairs): return [{'id':i,'side':s} for i,s in pairs]
CAP='captain'

scenes={}
def scene(id,stage,cst,lines,choice=None,**meta):
    d={'id':id,'stage':stage,'cast':cst,'lines':lines,'choice':choice}; d.update(meta); scenes[id]=d

# ================= CHAPTER 1: FIRST CONTACT (v2: Kestrel + escorts Finch, Wren, Kite) =================
scene('ch1_intro','kestrel_bridge',cast((CAP,'left'),('finch_pilot','right')),[
 ST('vista_corridor'),
 N('The Channels: frontier lanes threaded between asteroid belts and nebula banks. Day 41 out of Harrow Yard.'),
 N('The survey cutter Kestrel flies home to Meridian Station with three escorts: Finch, Wren and Kite.'),
 N('The scout Sparrow rides in its cradle. Its pilot, Teo Marsh, has Kestrel\'s helm today.'),
 ST('kestrel_bridge'),
 L('engineer','smile','Channel Nine, Captain. Narrowest lane on the chart, and nobody ever bothered to name it. I\'m calling it the Throat.'),
 L(CAP,'neutral','Please don\'t.'),
 L('engineer','smile','Too late. It\'s in the log.'),
 C('finch_pilot','worried','Finch to Kestrel. Holding escort position. Probably. Captain, is my spacing right? It looks wrong from here.'),
 L(CAP,'smile','Your spacing is perfect, Nanda. It was perfect the last four times you asked.'),
 C('finch_pilot','smile','Right. Good. Great. Captain... permission to panic?'),
 L(CAP,'smile','Denied. Captains panic in private. You have your own cabin now. Use it.'),
 C('wren_pilot','smile','Sefa here. I panicked through my whole first command, Nanda. Still brought the ship home. Mostly the same shape.'),
 C('kite_pilot','smile','Dov here. Can confirm. It was a different shape.'),
 C('finch_pilot','smile','Noted. Finch will panic quietly, privately and in formation.'),
 L('sparrow_pilot','smile','Helm\'s steady. For the record, I\'d also like permission to panic. This ship is four times bigger than mine.'),
 L(CAP,'smile','Denied, Teo. Nobody panics on my bridge before lunch.'),
 L('engineer','neutral','Oh, and a packet came in on the Meridian relay. Personal. I didn\'t read it.'),
 L('engineer','smile','...I read the header.'),
 C('li','smile','Vey. Halcyon\'s out on a courier run, but I\'ll be back on station before you dock. Don\'t you dare take the long way.'),
 C('li','smile','See you at Meridian.'),
 L(CAP,'smile','(quietly) See you at Meridian.'),
 C('finch_pilot','smile','Captain, you\'re smiling. I can hear it over comms.'),
 L(CAP,'determined','Eyes on the lane, Finch. All escorts: run the buoys. Let\'s get home.'),
 C('finch_pilot','determined','Finch copies. First command, first lane. Let\'s get home.'),
], chapter=1, kind='intro')

scene('ch1_contact','vista_corridor',cast((CAP,'left'),('sparrow_pilot','right')),[
 C('finch_pilot','worried','Contact, bearing zero-one-zero, inside the rock wall. It\'s... not on any registry.'),
 SH('seed'),
 L('sparrow_pilot','shock','It\'s glowing. Why is it glowing? Ships don\'t glow.'),
 W('pulse','(untranslated: five pulses, rising, then silence)'),
 L('engineer','worried','That\'s no beacon code. It\'s a pattern. Fives. It\'s counting at us.'),
 C('wren_pilot','determined','Wren and Kite, sliding out to the flanks. Nanda, you hold the middle.'),
 C('finch_pilot','determined','Holding the middle. Not panicking. Logging everything.'),
 L(CAP,'determined','All ships, weapons free, but keep your distance. Nobody gets cute.'),
 W('hostile','(untranslated: five pulses, sharp)'),
], chapter=1, kind='mid_battle')

scene('ch1_finch_down','vista_corridor',cast((CAP,'left'),('sparrow_pilot','right')),[
 SH('finch'),
 C('finch_pilot','shock','Missile inbound on Finch! It went straight through my shield. Captain—'),
 FX('flash'), FX('shake'), HS(),
 L(CAP,'shock','Nanda!'),
 L('sparrow_pilot','shock','Finch is gone. No pod. Captain, there\'s no pod.'),
 C('wren_pilot','hurt','Oh, Nanda. Oh, kiddo.'),
 L('engineer','determined','It hit Finch from outside our sensor range. It\'s picking off the small ships first.'),
 L(CAP,'determined','Wren, Kite: close on Kestrel. Nobody else goes alone.'),
], chapter=1, kind='mid_battle')

scene('ch1_hurl','vista_corridor',cast((CAP,'left'),('wren_pilot','right')),[
 FX('shake'),
 C('kite_pilot','hurt','Kite\'s guns are gone. It sheared them right off the hull.'),
 C('wren_pilot','determined','Wren too. No guns left. Just engines and a lot of hull.'),
 C('wren_pilot','determined','Dov, take the stern. I\'ll take the bow. Its shield can\'t cover both ends at once.'),
 L(CAP,'shock','Negative! Fall back on Kestrel. Sefa, Dov, that\'s an order!'),
 C('kite_pilot','smile','Respectfully, Captain: no. Get Teo and Moss home.'),
 C('wren_pilot','smile','You\'ve got a promise waiting at Meridian, Vey. Go and keep it.'),
 SH('wren'), SH('kite'), SH('seed'),
 FX('flash'), FX('shake'), HS(),
 L(CAP,'hurt','Sefa! Dov!'),
 L('sparrow_pilot','hurt','Bow and stern. They hit both ends. Its shield is down, Captain. It\'s open.'),
], chapter=1, kind='mid_battle', added=True)

scene('ch1_victory','vista_corridor',cast((CAP,'left'),('engineer','right')),[
 FX('flash'),
 L('sparrow_pilot','determined','It\'s breaking up. It\'s... it\'s over.'),
 W('calm','(untranslated: one long pulse, fading)'),
 L('engineer','hurt','Finch. Wren. Kite. Twenty minutes ago Nanda was asking about spacing.'),
 L(CAP,'hurt','One ship. It took one ship to take three of ours.'),
 L('engineer','neutral','Then we make sure the next one can\'t. Something in that wreck is still warm.'),
 L(CAP,'determined','Teo, suit up and go across. Moss, log it. Log everything.'),
 L('sparrow_pilot','determined','On my way, Captain.'),
], chapter=1, kind='victory')

scene('ch1_salvage','salvage_wreck',cast((CAP,'left'),('sparrow_pilot','right')),[
 N('The wreck is warm. It shouldn\'t be.'),
 C('sparrow_pilot','determined','Okay. The walls are... cells? Like honeycomb, but soft. Keep talking to me, Captain.'),
 C('sparrow_pilot','neutral','Found something. A hex-shaped pod with a rack of... those are missiles. Six. And a launcher that\'s still twitching.'),
 C('engineer','neutral','Bring it. Bring all of it. If we\'d had that an hour ago—'),
 C('engineer','hurt','...Sorry. Just bring it.'),
 C('sparrow_pilot','worried','Captain, Wren\'s and Kite\'s guns. It didn\'t blow them up. It cut them off. Like it wanted the pieces.'),
 L(CAP,'worried','...'),
 C('li','smile','(relay, recorded hours ago) Vey, me again. Halcyon\'s making good time. Whatever the lane throws at you: see you at Meridian.'),
 L(CAP,'hurt','(quietly) Three escorts out, one ship home. See you at Meridian, Li. I\'m holding you to it.'),
 N('Kestrel logs three names: Priya Nandakumar. Sefa Lowe. Dov Ancell.'),
 FX('fade_out'),
], chapter=1, kind='salvage', unlocks=['launcher','missiles'])

scene('ch1_defeat','kestrel_bridge',cast((CAP,'left'),('sparrow_pilot','right')),[
 FX('glitch'),
 L('engineer','hurt','Hull\'s cracking! Pulling back to the buoy line!'),
 L(CAP,'determined','It\'s fast, but it\'s alone. Keep Kestrel\'s guns on it and make it come to us. Again.'),
], chapter=1, kind='defeat')

# ================= CHAPTER 2: QUIET WATER =================
scene('ch2_intro','kestrel_engine_bay',cast((CAP,'left'),('engineer','right')),[
 N('Two days later. A nebula bank the charts call Quiet Water.'),
 L('engineer','smile','Behold. One alien launcher: bolted, wired, and only slightly on fire.'),
 L(CAP,'worried','Slightly?'),
 L('engineer','smile','It\'s a decorative fire.'),
 SH('kestrel'),
 L('engineer','determined','And these are our own survey charges. Retune the fuses and they stop mapping rock. They burn out the engines of whatever bumps into them.'),
 L('engineer','neutral','I went through Finch\'s last logs. Weave ships hunt by heat and motion. A cold charge sitting still is invisible to them.'),
 L(CAP,'hurt','Logging everything. That was Nanda.'),
 L('engineer','neutral','Then let\'s make it count. Teo\'s already in Sparrow.'),
 ST('vista_quiet_water'),
 SH('sparrow'),
 C('sparrow_pilot','determined','Sparrow\'s out of the cradle. First real sortie. I\'m flying this one for Nanda, Sefa and Dov.'),
 C('sparrow_pilot','neutral','The passage ahead is narrow. One way in, one way out. Perfect place for an ambush.'),
 L(CAP,'determined','Good. Let\'s be the ones setting it.'),
], chapter=2, kind='intro')

scene('ch2_contact','vista_quiet_water',cast((CAP,'left'),('sparrow_pilot','right')),[
 C('sparrow_pilot','worried','Two contacts entering the passage. Same glow, same fives.'),
 SH('seed'),
 W('pulse','(untranslated: five pulses, answered by five)'),
 C('sparrow_pilot','worried','They\'re talking to each other. Can we not let them finish the conversation?'),
 L(CAP,'determined','Hold still. Let them come to us. Moss, the charges?'),
 L('engineer','determined','Cold, quiet and very rude. Ready when they are.'),
], chapter=2, kind='mid_battle')

scene('ch2_first_mine','vista_quiet_water',cast((CAP,'left'),('sparrow_pilot','right')),[
 FX('flash'), FX('shake'),
 C('sparrow_pilot','shock','Whoa! It flew right into it! Didn\'t even flinch!'),
 L('engineer','determined','The charge cooked its engine cells. No burn, no steering. It\'s just drifting.'),
 C('sparrow_pilot','smile','It\'s dead in the water! Sit there and think about what you did.'),
 W('hostile','(untranslated: broken pulses, three, then two)'),
 L('engineer','smile','And it never saw the charge. Heat and motion, nothing else. Nanda called it.'),
 L(CAP,'determined','Then we stay cold, let the passage stop them, and finish them where they float.'),
], chapter=2, kind='mid_battle')

scene('ch2_victory','vista_quiet_water',cast((CAP,'left'),('engineer','right')),[
 C('sparrow_pilot','smile','Both dead in the water, both done. Quiet Water lives up to its name. Very quiet. Extremely quiet now.'),
 L('engineer','smile','Never lit an engine again, either of them. That launcher earned its keep. I\'m naming it.'),
 L(CAP,'smile','Please don\'t.'),
 L('engineer','smile','Too late. It\'s called Rosalind.'),
 C('sparrow_pilot','neutral','Captain, the second wreck is still putting out power. Something in there is recharging itself.'),
], chapter=2, kind='victory')

scene('ch2_salvage','salvage_wreck',cast((CAP,'left'),('engineer','right')),[
 C('sparrow_pilot','determined','There\'s a big shiny web in here. It keeps knitting itself back together every time I cut it.'),
 L('engineer','shock','Teo, don\'t cut it! That\'s a shield. A shield that repairs itself.'),
 L('engineer','smile','Do you know what I\'d give for a shield that repairs itself? I\'d stop sleeping. Again.'),
 C('sparrow_pilot','worried','It\'s growing toward the airlock. Slowly. Like a plant toward light.'),
 L(CAP,'neutral','Pack it in a cold box. We\'ll fit it properly at Meridian.'),
 C('li','smile','Vey, a quick one. The relay\'s patchy out here. Meridian\'s very quiet tonight. Bring me a story.'),
 L(CAP,'hurt','I\'ve got a few. Not all of them are good.'),
], chapter=2, kind='salvage', unlocks=['shield'])

scene('ch2_defeat','vista_quiet_water',cast((CAP,'left'),('sparrow_pilot','right')),[
 L('engineer','worried','They found our heat. Pull back into the nebula!'),
 C('sparrow_pilot','determined','They can\'t see the charges. Sit still and let them drift into the passage. Again, Captain.'),
], chapter=2, kind='defeat')

# ================= CHAPTER 3: THE SPLITTING =================
scene('ch3_intro','meridian_dark',cast((CAP,'left'),('engineer','right')),[
 N('Meridian Station. Home port for nine hundred people.'),
 N('No lights.'),
 L('engineer','worried','No beacon, no traffic control, no life signs I can read from here. The ring\'s... cold.'),
 L(CAP,'worried','Hail them. All channels.'),
 C('meridian','hurt','—this is Controller Abara, Meridian— they came out of the cells in the walls— evacuating to the lower ring— if anyone hears this, don\'t dock. Don\'t—'),
 FX('glitch'),
 L(CAP,'shock','Li. Try Halcyon. Try Li.'),
 L('engineer','worried','Nothing. No answer. I\'m sorry, Captain.'),
 SH('kestrel_refit'),
 L('engineer','worried','One small mercy: we came in behind the rock cluster. Whatever did this hasn\'t seen us yet.'),
 L(CAP,'determined','Then we use it. Everyone stays behind the rocks until we know what we\'re facing.'),
], chapter=3, kind='intro')

scene('ch3_split','meridian_dark',cast((CAP,'left'),('engineer','right')),[
 SH('twin'),
 L('engineer','shock','The big one is coming apart! No, it\'s splitting on purpose!'),
 FX('flash'),
 SH('twin_a'), SH('twin_b'),
 W('pulse','(untranslated: five pulses, divided between two voices)'),
 C('sparrow_pilot','shock','Two ships! It was one ship a second ago! That\'s cheating!'),
 L('engineer','determined','Each half is smaller. Pick one and hammer it.'),
], chapter=3, kind='mid_battle')

scene('ch3_despair','meridian_dark',cast((CAP,'left'),('engineer','right')),[
 FX('shake'),
 L('engineer','hurt','Missiles gone, every one. They\'re swatting them out of the sky.'),
 L('engineer','worried','Point defence. They learned it. From us, maybe.'),
 C('sparrow_pilot','hurt','Sparrow\'s leaking air. I can hold. I can hold— Captain, permission to panic?'),
 L(CAP,'hurt','...Denied. Nanda asked me that, too. Hold on, Teo.'),
 L(CAP,'worried','Li said see you at Meridian.'),
 L(CAP,'hurt','...I\'m at Meridian.'),
 W('calm','(untranslated: slow pulses, patient, like breathing)'),
], chapter=3, kind='mid_battle')

scene('ch3_li_arrives','meridian_dark',cast((CAP,'left'),('engineer','right')),[
 FX('flash'),
 C('li','determined','Vey! Sorry I\'m late. Traffic was terrible.'),
 L(CAP,'shock','Li?!'),
 SH('halcyon'),
 C('li','smile','Halcyon and Tern, coming in behind them. Hollis, say hello.'),
 C('tern_pilot','smile','Hello.'),
 SH('tern'),
 C('li','determined','They\'re facing you, not us. Let\'s fix that.'),
 L(CAP,'determined','All ships, hit them together. Now!'),
], chapter=3, kind='mid_battle')

scene('ch3_victory','meridian_dark',cast((CAP,'left'),('engineer','right')),[
 C('tern_pilot','smile','Both halves down. That\'s a first. I\'ll have it put on a mug.'),
 L('engineer','smile','Their point defence is still ticking. I want it. I want it so much.'),
 C('li','smile','Kestrel, Halcyon requests permission to dock. And a hug. In that order, or the other one.'),
 L(CAP,'smile','Permission granted. Both.'),
], chapter=3, kind='victory', unlocks=['point_defence'])

scene('ch3_reunion','halcyon_bridge',cast((CAP,'left'),('li','right')),[
 N('Halcyon, docked against Kestrel\'s flank. The first warm air in days.'),
 L('li','smile','Hey, you.'),
 L(CAP,'smile','Hey. You were supposed to be on station.'),
 L('li','worried','I was. When they came out of the walls, Hollis and I got thirty people into the lower ring and sealed it. Then I came looking for you.'),
 L('li','smile','I told you not to take the long way.'),
 L(CAP,'smile','I took the Throat. Moss named it.'),
 L('li','smile','Of course Moss named it.'),
 L('li','worried','Vey... where are your escorts? Where\'s Nanda?'),
 L(CAP,'hurt','Finch, Wren and Kite. We lost all three in the Throat. Nanda, Sefa, Dov.'),
 L('li','hurt','Oh, Vey. I\'m so sorry. You kept the promise anyway. You came.'),
 C('tern_pilot','neutral','The survivors are holding in the lower ring, and Abara is with them. Abara says go, and draw the Weave away from the station.'),
 L('li','determined','So we\'re coming with you. Halcyon brings long-range comms and seeker drones. Tern brings docking clamps, so we can lock two hulls together when we need the muscle.'),
 C('engineer','smile','And I bring one alien point-defence turret, fresh off the wreck. My birthday came early.'),
 L('li','smile','So. Same fleet now?'),
 L(CAP,'smile','Same fleet. For good.'),
], chapter=3, kind='reunion', unlocks=['comms','seeker_drone','docking_clamps','halcyon','tern'])

scene('ch3_defeat','meridian_dark',cast((CAP,'left'),('sparrow_pilot','right')),[
 L('engineer','hurt','Hull breach! Fall back behind the rocks!'),
 C('sparrow_pilot','determined','The rocks hid us once. Use them again and make it come to you, Captain.'),
], chapter=3, kind='defeat')

# ================= CHAPTER 4: THE FORK =================
scene('ch4_fork','campaign_map',cast((CAP,'left'),('li','right')),[
 N('Two routes lead out of Meridian.'),
 L('li','neutral','The Long Dark runs east. Slow, empty, no Weave sightings. We\'d lose them in a week.'),
 C('tern_pilot','neutral','And west is Ashfall Outpost. A mining station, fourteen people. Captain... it\'s transmitting.'),
 C('mimic','worried','Ashfall Outpost to any human ship. This is Warden Cole. Our hull is open. Our people are... we are fourteen. Please come. We have room for you.'),
 FX('glitch'),
 C('engineer','worried','That\'s a distress call. A bad one.'),
 C('tern_pilot','neutral','Odd phrasing. "We have room for you."'),
 L('li','worried','People in shock say odd things, Hollis.'),
], choice={
 'prompt':'Where does the fleet go?',
 'options':[
  {'id':'ch4a','label':'West to Ashfall: answer the distress call'},
  {'id':'ch4b','label':'East into the Long Dark: keep the fleet safe',
   'then':[
    C('sparrow_pilot','worried','Captain... you heard the call. Fourteen people.'),
    C('engineer','hurt','We couldn\'t reach Finch, Wren or Kite in time. We can still reach Ashfall.'),
    L('li','determined','I know you\'re trying to protect us. I love that about you. But not while people are dying, Vey.'),
    C('engineer','neutral','The Long Dark isn\'t going anywhere. Ashfall might be.'),
    FX('glitch'),
    C('tern_pilot','worried','...And the eastern relay just dropped. The Long Dark\'s nav signal is gone. We couldn\'t fly it blind if we wanted to.'),
   ],
   'lock_after':True,'locked_label':'Signal lost'}],
 'repeat_until':'ch4a'}, chapter=4, kind='fork')

scene('ch4a_intro','ashfall_outpost',cast((CAP,'left'),('engineer','right')),[
 N('Ashfall Outpost. The distress call loops: the same words, the same pauses, the same cough.'),
 L('engineer','worried','No life signs. No heat. Just the transmitter.'),
 C('mimic','neutral','This is Warden Cole. Our hull is open. We have room for you.'),
 C('li','worried','Maybe they\'re down in the lower shafts, shielded.'),
 SH('husk_2'),
 C('sparrow_pilot','neutral','Contacts. Weave... I think? They look chewed.'),
 W('calm','[partial translation] ...COLD... OPEN... ROOM...'),
 C('tern_pilot','neutral','The translator is starting to catch words. About one in three.'),
 L('engineer','determined','Husks. Whatever hit Ashfall hurt them too. Let\'s finish it.'),
], chapter=4, kind='intro')

scene('ch4a_graft_found','salvage_wreck',cast((CAP,'left'),('engineer','right')),[
 C('li','neutral','The distress call stopped the moment the last husk went dark.'),
 C('tern_pilot','neutral','Transmitter battery, probably.'),
 C('sparrow_pilot','neutral','Nobody in the shafts. No bodies either. They must have evacuated.'),
 C('sparrow_pilot','smile','But Moss, you\'re going to want to see hangar four. There\'s a rig in here. Like a docking cradle, but... nicer.'),
 L('engineer','shock','Nicer is an understatement. Look at the couplings. No bolts, no clamp teeth. The surfaces just... meet.'),
 L('engineer','smile','This is Ashfall\'s prototype. It has to be. A hull-graft rig. It fuses two ships into one: no drift, no stress, no thrust penalty. None of the junk our clamps give us.'),
 C('tern_pilot','neutral','Ashfall was a mining outpost. Where did they get the money for a miracle?'),
 L('engineer','smile','Miners are cleverer than pilots, Hollis. Everyone knows that.'),
 C('sparrow_pilot','neutral','No maker\'s stamp anywhere. And the housing is warm. It\'s running on its own power.'),
 L('engineer','smile','Hand-built and self-heating. Like I said: miracle.'),
 C('li','neutral','If it works, Kestrel and Tern could become one ship. Hollis?'),
 C('tern_pilot','smile','Tern always wanted a bigger home.'),
 L(CAP,'determined','Do it. Carefully, Moss.'),
], chapter=4, kind='salvage', unlocks=['hull_graft'])

scene('ch4a_outro','kestrel_bridge',cast((CAP,'left'),('engineer','right')),[
 N('Six hours later, Kestrel and Tern are one hull.'),
 SH('kestrel_grafted'),
 L('engineer','smile','The seam\'s sealed. Thrust is up thirty percent, no clamp drag. Kestrel has never flown this clean.'),
 L('tern_pilot','smile','My bunk is now forty metres closer to the coffee. Best day of my life.'),
 C('sparrow_pilot','smile','Party on the big ship! Sparrow\'s bringing snacks. The snacks are crackers.'),
 C('li','smile','Look at us. A real fleet.'),
 L(CAP,'smile','A real fleet.'),
 L('tern_pilot','neutral','Captain, can you hear the seam? It hums.'),
 L('engineer','smile','That\'s just the coupling settling. Old ships creak, new ships hum.'),
 L('tern_pilot','smile','It\'s a nice rhythm. Almost like counting.'),
 FX('fade_out'),
], chapter=4, kind='outro')

scene('ch4a_defeat','ashfall_outpost',cast((CAP,'left'),('engineer','right')),[
 L('engineer','hurt','For husks, they bite!'),
 C('li','determined','They\'re slow, Vey. Don\'t let them bunch up on us. One more pass.'),
], chapter=4, kind='defeat')

# ================= CHAPTER 5: THE BLOOM =================
scene('ch5_intro','halcyon_bridge',cast((CAP,'left'),('li','right')),[
 N('The Channels, three days west of Ashfall. The strongest fleet the frontier has ever seen. Probably.'),
 L('li','smile','You\'re doing the thing.'),
 L(CAP,'smile','What thing?'),
 L('li','smile','The thing where you stare at the tactical map like it owes you money.'),
 L(CAP,'smile','It does owe me money.'),
 L('li','neutral','When this is done and Meridian is safe, I want a month somewhere with weather. Real rain.'),
 L(CAP,'smile','I\'ll bring the good tea.'),
 L('li','smile','You always say that. You never bring the tea.'),
 C('engineer','smile','Bridge, the seam\'s purring like a cat. Best ship I\'ve ever worked on.'),
 C('sparrow_pilot','smile','Bring on the Weave. Missiles, mines, shields, a turret, drones, and a ship that hums. What could go wrong?'),
 C('tern_pilot','neutral','Never say that, kid.'),
], chapter=5, kind='intro')

scene('ch5_bloom','vista_bloom',cast((CAP,'left'),('tern_pilot','right')),[
 L('tern_pilot','shock','Contact. Big. Bigger. Captain, it\'s seven cells. I\'ve never seen seven.'),
 SH('bloom'),
 W('pulse','[partial translation] SEVEN. WHOLE. ...SMALL CELLS... COME HOME.'),
 FX('glitch'),
 L('tern_pilot','worried','Comms are jammed! I can\'t reach Halcyon, I can\'t reach Sparrow—'),
 L(CAP,'determined','Then we fight by line of sight. Everyone stay where I can see you.'),
], chapter=5, kind='mid_battle')

scene('ch5_seam_wakes','kestrel_bridge',cast((CAP,'left'),('engineer','right')),[
 FX('flash'), FX('glitch'),
 L('engineer','shock','Shields are dropping. No, they\'re being dropped, from the inside!'),
 W('calm','[partial translation] CELL. YOU ARE ALREADY PART.'),
 L(CAP,'shock','The helm\'s locked. I have no helm!'),
 L('tern_pilot','shock','It\'s the seam. The seam is glowing red, all the way down!'),
 L('engineer','hurt','Ashfall\'s prototype. Oh no. Oh no, no. I put it on us. I put it on us myself.'),
 FX('shake'),
 L('tern_pilot','worried','We\'re moving. Captain, we\'re moving toward it.'),
], chapter=5, kind='mid_battle')

scene('ch5_li_moves','halcyon_bridge',cast(('li','right'),)+[],[
 L('li','worried','Kestrel, respond. Kestrel! Vey, why are you drifting?'),
 C('sparrow_pilot','shock','Kestrel\'s heading straight for the Bloom! The engines aren\'t even lit!'),
 L('li','determined','Halcyon, full burn. Bring us about.'),
 L('li','determined','Hold on, Vey. I\'m coming.'),
], chapter=5, kind='mid_battle')

scene('ch5_cliff','vista_bloom',cast((CAP,'left'),('engineer','right')),[
 SH('kestrel_grafted'),
 N('Kestrel drifts toward the Bloom, its seam burning crimson.'),
 W('calm','[partial translation] WELCOME HOME, LITTLE CELL.'),
 L('engineer','hurt','I\'m sorry. Captain, I\'m so sorry.'),
 L(CAP,'determined','It\'s not your fault, Moss. Keep cutting. Cut anything.'),
 SH('halcyon'),
 N('Behind them, Halcyon turns: every engine lit, nose pointed at Kestrel.'),
 N('Through the static, one line gets through.'),
 C('li','determined','See you at Meridian, Vey.'),
 FX('fade_out'),
 N('End of Chapter Five.'),
], chapter=5, kind='cliff')

# ---- addition: ch5_defeat (in case the Bloom battle is lost before the seam event) ----
scene('ch5_defeat','vista_bloom',cast((CAP,'left'),('tern_pilot','right')),[
 L('tern_pilot','hurt','It\'s too strong head-on!'),
 C('li','determined','Regroup on Halcyon. We\'re not done, Vey. Again.'),
], chapter=5, kind='defeat', added=True)

barks={
 'b1_scouts_ahead':{'speaker':'finch_pilot','expression':'smile','lines':['Finch, Wren and Kite running ahead.','If the rocks move, I\'ll yell.']},
 'b1_contact_glyphs':{'speaker':'finch_pilot','expression':'worried','lines':['It\'s pulsing at us in groups of five.','Logging everything.']},
 'b1_finch_hit':{'speaker':'finch_pilot','expression':'hurt','lines':['Finch is hit! I\'m losing systems!']},
 'b1_seed_shield':{'speaker':'engineer','expression':'worried','lines':['Our shots are splashing off. It has a shield!','Keep hitting the same side.']},
 'b1_seed_closing':{'speaker':'captain','expression':'determined','lines':['It\'s closing on Kestrel. Teo, keep our guns on it!']},
 'b1_weapons_gone':{'speaker':'wren_pilot','expression':'worried','lines':['Wren\'s guns are slag. Kite\'s too.','We\'ve got engines. That\'s all we\'ve got.']},
 'b1_hurl_wren':{'speaker':'wren_pilot','expression':'determined','lines':['Wren, taking the bow.','Don\'t watch this one, Captain.']},
 'b1_hurl_kite':{'speaker':'kite_pilot','expression':'determined','lines':['Kite has the stern.','Been a privilege, Kestrel.']},
 'b2_mines_set':{'speaker':'engineer','expression':'smile','lines':['Charges are cold and quiet.','Please don\'t fly into our own.']},
 'b2_choke':{'speaker':'sparrow_pilot','expression':'determined','lines':['They\'re in the choke. Nowhere to turn.']},
 'b2_mine_boom':{'speaker':'sparrow_pilot','expression':'smile','lines':['Boom! Map that!']},
 'b2_dead_in_water':{'speaker':'sparrow_pilot','expression':'smile','lines':['Its engines are cooked! It\'s just drifting!','Dead in the water. Line it up.']},
 'b2_second_seed':{'speaker':'sparrow_pilot','expression':'determined','lines':['Second contact, right behind the first.','It still hasn\'t seen the charges.']},
 'b3_cover':{'speaker':'captain','expression':'determined','lines':['Stay behind the rocks. Make it come to us.']},
 'b3_pd_stopped':{'speaker':'engineer','expression':'worried','lines':['Missile swatted. Their point defence is fast.']},
 'b3_hull_low':{'speaker':'engineer','expression':'hurt','lines':['The hull\'s paper-thin. One more hit and we\'re breathing vacuum.']},
 'b3_flank_open':{'speaker':'li','expression':'determined','lines':['Their back\'s wide open. Hitting it now!']},
 'b4_too_easy':{'speaker':'sparrow_pilot','expression':'smile','lines':['Is it just me, or are these things barely fighting?','Easiest job ever.']},
 'b4_graft_hint':{'speaker':'engineer','expression':'smile','lines':['I\'m reading a strange power source in hangar four.','Ooh. Shiny.']},
 'b4_seam_hums':{'speaker':'tern_pilot','expression':'smile','lines':['The seam\'s humming again.','Kind of soothing, actually.']},
 'b5_jammed':{'speaker':'tern_pilot','expression':'worried','lines':['Comms are jammed! Line of sight only!']},
 'b5_kestrel_unresponsive':{'speaker':'engineer','expression':'shock','lines':['Kestrel isn\'t answering the helm!','Something is overriding us!']},
 'b5_li_coming':{'speaker':'li','expression':'determined','lines':['Hold on, Vey. I\'m coming.']},
}

def dump(p,o):
    with open(p,'w') as f: json.dump(o,f,indent=1,ensure_ascii=False); f.write('\n')
dump(ROOT+'/characters.json',characters); dump(ROOT+'/stages.json',stages); dump(ROOT+'/barks.json',barks); dump(ROOT+'/ships.json',ships)
for k,v in scenes.items(): dump(f'{ROOT}/scenes/{k}.json',v)
dump(ROOT+'/scenes/index.json',{'scenes':list(scenes.keys()),'barks':list(barks.keys())})
print(len(scenes),'scenes',len(barks),'barks')
