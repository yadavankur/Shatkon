/* ---------- story ---------- */
const CAST = [
  ['captain_a', 'Captain Vey', 'Captain, survey cutter Kestrel', '#cfe8ff', 'Keeps a steady voice on an open channel. Has a promise waiting at Meridian. (The player picks one of two portrait sets.)'],
  ['li', 'Li', 'Pilot, courier-gunship Halcyon', '#2fe0b0', 'Vey\'s person. "See you at Meridian." Arrives late and right on time.'],
  ['engineer', 'Moss Okafor', 'Chief engineer, Kestrel', '#56b8ff', 'Names everything, bolts alien hardware onto the hull, and starts only decorative fires.'],
  ['sparrow_pilot', 'Teo Marsh', 'Scout pilot, Sparrow', '#7fd8f0', 'Has Kestrel\'s helm in ch1. Asks permission to panic.'],
  ['finch_pilot', 'Priya "Nanda" Nandakumar', 'Captain, escort Finch', '#9fb4ff', 'Youngest escort captain in the flotilla, on a first command. Logs everything.'],
  ['wren_pilot', 'Sefa Lowe', 'Pilot, escort Wren', '#6fd3c8', 'Veteran escort pilot. Warm, teasing, looks after the young pilots.'],
  ['kite_pilot', 'Dov Ancell', 'Pilot, escort Kite', '#9fb8d8', 'Laconic, bone-dry humour, Sefa\'s wingmate for years.'],
  ['tern_pilot', 'Hollis Brandt', 'Pilot, Tern', '#4fd0b0', 'Li\'s wingmate. Says very little.'],
  ['meridian', 'Controller Abara', 'Traffic control, Meridian Station', '#8ab4ff', 'The voice of home port.'],
  ['mimic', 'Warden Cole', 'Ashfall Outpost (so it claims)', '#b48cff', 'Asks you to come. Has room for you.'],
  ['weave_calm', 'The Weave', 'Builder species', '#ff5fc8', 'Builds ships out of cells. Counts in fives. Learns from every fight.'],
];
const TEASER = [
  { bg: 'kestrel_bridge', who: 'narrator', t: 'The Channels: frontier lanes threaded between asteroid belts and nebula banks. Day 41 out of Harrow Yard.' },
  { bg: 'kestrel_bridge', who: 'finch_pilot', p: 'finch_pilot_worried', side: 'r', t: 'Right. Good. Great. Captain... permission to panic?' },
  { bg: 'kestrel_bridge', who: 'captain_a', p: 'captain_a_smile', side: 'l', t: 'Denied. Captains panic in private. You have your own cabin now. Use it.' },
  { bg: 'comms_screen', who: 'li', p: 'li_smile', side: 'r', t: 'See you at Meridian.' },
  { bg: 'vista_corridor', who: 'finch_pilot', p: 'finch_pilot_determined', side: 'r', t: 'Contact, bearing zero-one-zero, inside the rock wall. It\'s... not on any registry.' },
  { bg: 'vista_corridor', who: 'sparrow_pilot', p: 'sparrow_pilot_shock', side: 'r', t: 'It\'s glowing. Why is it glowing? Ships don\'t glow.' },
  { bg: 'weave_lattice', who: 'weave', p: 'weave_hostile', side: 'r', t: '(untranslated: five pulses, rising, then silence)' },
  { bg: 'vista_corridor', who: 'engineer', p: 'engineer_worried', side: 'r', t: 'That\'s no beacon code. It\'s a pattern. Fives. It\'s counting at us.' },
  { bg: 'vista_corridor', who: 'captain_a', p: 'captain_a_determined', side: 'l', t: 'All ships, weapons free, but keep your distance. Nobody gets cute.' },
  { bg: 'meridian_dark', who: 'narrator', t: 'Meridian Station. Home port for nine hundred people.' },
  { bg: 'meridian_dark', who: 'narrator', t: 'No lights.' },
];
const NAMES = { narrator: '', captain_a: 'CAPTAIN VEY', li: 'LI', engineer: 'MOSS', sparrow_pilot: 'TEO', finch_pilot: 'NANDA', weave: 'THE WEAVE' };
const COLORS = { captain_a: '#cfe8ff', li: '#2fe0b0', engineer: '#56b8ff', sparrow_pilot: '#7fd8f0', finch_pilot: '#9fb4ff', weave: '#ff5fc8', narrator: '#ccc' };
function initTeaser() {
  const bg = $('#tBg'), L = $('#tPL'), Ri = $('#tPR'), nm = $('#tNm'), ln = $('#tLn'), title = $('#tTitle');
  bg.style.backgroundImage = 'url(img/stages/vista_corridor.webp)';
  let i = -1, timer = 0, typing = 0, paused = false, running = false;
  const show = (k) => {
    const s = TEASER[k];
    bg.style.backgroundImage = `url(img/stages/${s.bg}.webp)`;
    [L, Ri].forEach((p) => p.classList.remove('on'));
    if (s.p) { const box = s.side === 'l' ? L : Ri; const img = $('img', box); img.src = `img/portraits/${s.p}.webp`; img.alt = (NAMES[s.who] || s.who) + ' portrait'; box.classList.add('on'); }
    nm.textContent = NAMES[s.who] || ''; nm.style.color = COLORS[s.who] || '#fff';
    ln.style.fontStyle = s.who === 'narrator' || s.who === 'weave' ? 'italic' : 'normal';
    clearInterval(typing);
    if (RM) { ln.textContent = s.t; } else { let n = 0; ln.textContent = ''; typing = setInterval(() => { n += 2; ln.textContent = s.t.slice(0, n); if (n >= s.t.length) clearInterval(typing); }, 28); }
  };
  const next = () => {
    clearTimeout(timer);
    i++;
    if (i >= TEASER.length) { running = false; title.style.opacity = 1; title.style.pointerEvents = 'auto'; $('#tGo').textContent = '↺ Replay teaser'; i = -1; return; }
    show(i);
    if (!paused) timer = setTimeout(next, 1400 + TEASER[i].t.length * 45);
  };
  $('#tGo').addEventListener('click', () => { title.style.opacity = 0; title.style.pointerEvents = 'none'; paused = false; running = true; i = -1; next(); });
  $('#tSkip').addEventListener('click', () => { if (!running) { $('#tGo').click(); return; } next(); });
  $('#tPause').addEventListener('click', (e) => { if (!running) return; paused = !paused; e.currentTarget.textContent = paused ? '▶' : '❚❚'; e.currentTarget.setAttribute('aria-label', paused ? 'Resume teaser' : 'Pause teaser'); if (!paused) timer = setTimeout(next, 1500); else clearTimeout(timer); });
}
const CHAPTERS = [
  { id: 'ch1', title: 'First Contact', img: 'vista_corridor', c: '#7fd8f0', map: 'The Corridor · r7',
    open: 'Kestrel and three escorts, Finch, Wren and Kite, run Channel Nine home to Meridian. Moss calls it "the Throat". Then a glowing ship on no registry starts pulsing at them in fives.',
    spoil: 'The Seed picks the small ships off from outside sensor range, and <b>Nanda is killed</b> when Finch goes down. With their guns sheared off, Sefa and Dov refuse the order to fall back and <b>hurl Wren and Kite into the Seed\'s bow and stern</b>. Its shield can\'t cover both ends. Kestrel finishes it, and the wreck is warm when they board it.',
    q: ['Respectfully, Captain: no. Get Teo and Moss home.', 'Dov, ch1_hurl'], mech: ['helm: script escorts', 'ram (the hurl)', 'protect', 'move guides'] },
  { id: 'ch2', title: 'Quiet Water', img: 'vista_quiet_water', c: '#2fe0b0', map: 'Quiet Water · r8',
    open: 'Two days later, in a nebula bank called Quiet Water. Moss has bolted the alien launcher onto Kestrel ("only slightly on fire"). Two Seeds come south, one down each side of an asteroid mass.',
    spoil: 'The crew\'s survey charges are strung across both lanes. A Seed flies straight into one, the charge <b>tears out its engines</b>, and it drifts dead in the water while Kestrel and Sparrow finish it where it lies.',
    q: ['It\'s dead in the water! Sit there and think about what you did.', 'Teo, ch2_first_mine'], mech: ['mine strikes: engines', 'engines_out', 'pre-placed mines'] },
  { id: 'ch3', title: 'The Splitting', img: 'meridian_dark', c: '#4a8cff', map: 'Meridian Approach · r9',
    open: 'Meridian Station, home port for nine hundred people. No lights. Then a six-cell Weave ship comes hunting.',
    spoil: 'The Twin <b>splits in two on purpose</b> and swats Kestrel\'s missiles out of the sky with point defence it seems to have learned. Teo asks permission to panic, the way Nanda used to. Then <b>Li arrives</b> behind the enemy with Halcyon and Tern. At the fork, the crew chooses between the Long Dark (signal lost) and Ashfall.',
    q: ['Vey! Sorry I\'m late. Traffic was terrible.', 'Li, ch3_li_arrives'], mech: ['split', 'point defence', 'spawn groups', 'fork scene'] },
  { id: 'ch4a', title: 'Ashfall', img: 'ashfall_outpost', c: '#9b6bff', map: 'Ashfall Outpost · r8',
    open: 'A distress call loops from Ashfall Outpost: the same words, the same pauses, the same cough. "This is Warden Cole. We have room for you."',
    spoil: 'Three battered husks barely fight. Nobody is in the shafts, and there are no bodies either. In hangar four Teo finds <b>Ashfall\'s prototype hull-graft rig</b>, and Moss grafts Kestrel and Tern into one ship. It\'s a breather, and a trap the player isn\'t meant to see.',
    q: ['There\'s a rig in here. Like a docking cradle, but... nicer.', 'Teo, ch4a_graft_found'], mech: ['graft', 'locks with a reason', 'protect: side'] },
  { id: 'ch5', title: 'The Bloom', img: 'vista_bloom', c: '#ff5fc8', map: 'The Bloom · r10',
    open: 'The strongest fleet the crew has ever had. Then a seven-cell Weave ship arrives and jams every channel.',
    spoil: 'When Kestrel engages, <b>the graft seam wakes</b>: shields drop from the inside, the helm locks, and Kestrel drifts toward the Bloom. Li turns Halcyon toward Kestrel, every engine lit. <b>Cliffhanger:</b> through the static, one line gets through. <i>To be continued.</i>',
    q: ['[partial translation] CELL. YOU ARE ALREADY PART.', 'The Weave, ch5_seam_wakes'], mech: ['forced move_toward', 'disable parts', 'end: to_be_continued'] },
];
// enemy names and beats are picked out in the Weave's purple/pink
const foe = (t) => t.replace(/\b(two Seeds|the Seed|The Seed|A Seed|Seeds?|six-cell Weave ship|seven-cell Weave ship|Weave ship|Weave|The Twin|Twin|husks|the Bloom|Warden Cole)\b/g, '<span class="foe">$1</span>');
function initStory() {
  const tl = $('#timeline');
  CHAPTERS.forEach((c, i) => {
    const d = document.createElement('div'); d.className = 'chap'; d.style.setProperty('--c', c.c);
    d.innerHTML = `<div class="node">${i + 1}</div><div class="card"><div class="pic"><img loading="lazy" src="img/stages/${c.img}.webp" alt="${esc(c.title)} stage art"></div><div class="txt">
      <div class="kicker" style="--c:${c.c};margin-bottom:6px">${c.id} · ${c.map}</div><h3>${c.title}</h3><p>${foe(c.open)}</p>
      <p class="spoil">${foe(c.spoil)}</p><div class="quote spoil${/^The Weave/.test(c.q[1]) ? ' foe-q' : ''}">“${esc(c.q[0])}”<small>${esc(c.q[1])}</small></div>
      <div>${c.mech.map((m) => `<span class="tag">${m}</span>`).join('')}</div></div></div>`;
    tl.appendChild(d);
    if (c.id === 'ch3') {
      const f = document.createElement('div'); f.className = 'chap'; f.style.setProperty('--c', '#777');
      f.innerHTML = `<div class="node">4b</div><div class="card" style="grid-template-columns:minmax(0,1fr)"><div class="txt"><div class="kicker" style="--c:#999;margin-bottom:6px">ch4b · locked</div><h3>The Long Dark <span class="tag ndef">not yet defined</span></h3><p>The east route at the fork. On the campaign map it shows as <i>"Signal lost"</i>, and it has no chapter file yet.</p></div></div>`;
      tl.appendChild(f);
    }
  });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }), { threshold: .2 });
  $$('.chap').forEach((c) => (RM ? c.classList.add('in') : io.observe(c)));
  const b = $('#spoilBtn');
  b.addEventListener('click', () => { const on = document.body.classList.toggle('spoilers'); b.setAttribute('aria-pressed', on); b.textContent = on ? '🙉 Hide spoilers' : '🙈 Show spoilers'; });
  const cast = $('#cast');
  CAST.forEach(([id, n, t, c, bio]) => {
    const d = document.createElement('div'); d.className = 'card who'; d.style.setProperty('--c', c);
    const img = id === 'weave_calm' ? 'weave_calm' : id + '_neutral';
    d.innerHTML = `<div class="pp"><img loading="lazy" src="img/portraits/${img}.webp" alt="Portrait of ${esc(n)}"></div><b style="color:${c}">${esc(n)}</b><small>${esc(t)}</small><small style="margin-top:6px;color:#b9cbe0">${esc(bio)}</small>`;
    cast.appendChild(d);
  });
  initTeaser();
}

/* ---------- design guides ---------- */
const GUIDES = [
  ['🗺️', 'Designing a map', `<p>A map is one YAML file under <code>map:</code>. List it in <code>rules/index.yaml</code>, and pick it with the fleets file's <code>map:</code> line. Campaign maps live in <code>campaign/maps/</code>.</p>
<pre><span class="k">map</span>:
  <span class="k">name</span>: <span class="s">"Skirmish"</span>
  <span class="k">world</span>: world_v0.4.yaml
  <span class="k">board</span>: { <span class="k">shape</span>: hexagon, <span class="k">radius</span>: <span class="n">8</span> }      <span class="c"># 217 hexes</span>
  <span class="k">zones</span>:
    <span class="k">player_1_home</span>: { <span class="k">edge</span>: south, <span class="k">depth</span>: <span class="n">3</span> }
    <span class="k">player_2_home</span>: { <span class="k">edge</span>: north, <span class="k">depth</span>: <span class="n">3</span> }
    <span class="k">no_mans_land</span>:  { <span class="k">everything_else</span>: true }
  <span class="k">setup</span>:
    <span class="k">secret</span>: true
    <span class="k">mines</span>: { <span class="k">own_home_zone</span>: true, <span class="k">rows_into_no_mans_land</span>: <span class="n">6</span> }
  <span class="k">terrain</span>:
    - { <span class="k">type</span>: nebula,   <span class="k">at</span>: [<span class="n">0</span>, <span class="n">0</span>],  <span class="k">radius</span>: <span class="n">1</span> }   <span class="c"># disc</span>
    - { <span class="k">type</span>: asteroid, <span class="k">at</span>: [<span class="n">-4</span>, <span class="n">1</span>], <span class="k">size</span>: <span class="n">1</span> }     <span class="c"># 1 hex · 3 = a row · 7 = a disc of 1</span>
  <span class="k">objective</span>: { <span class="k">at</span>: [<span class="n">0</span>,<span class="n">0</span>], <span class="k">radius</span>: <span class="n">1</span>, <span class="k">points_to_win</span>: <span class="n">5</span> }   <span class="c"># optional beacon</span></pre>
<h4>Checklist</h4><ul class="check"><li>Make it point-symmetric (q,r → −q,−r) for fair skirmish maps. Story maps may be lopsided on purpose.</li><li>Lines of fire: asteroids block sight, so check every lane you want open or closed.</li><li>Nebulae hide (−2 signature) and blind (−3 sensor). Put them where ambushes should happen.</li><li>Mind the distance from home zone to first contact: sensor + signature decides the round when the fleets meet.</li><li>Story maps: name extra zones (<code>li_arrival</code>, <code>outpost</code>) for spawns, guides and triggers.</li><li>Run the engine check: the map loads with no problems listed.</li></ul>`],
  ['🛠️', 'Designing a ship and a fleet', `<pre><span class="k">budget</span>: <span class="n">200</span>
<span class="k">player_1</span>:
  <span class="k">ships</span>:
    - <span class="k">name</span>: <span class="s">"Blob B"</span>
      <span class="k">flagship</span>: true
      <span class="k">load</span>: { <span class="k">missile</span>: <span class="n">2</span> }          <span class="c"># fits in one magazine (3)</span>
      <span class="k">hull</span>:
        - { <span class="k">at</span>: [<span class="n">0</span>, <span class="n">0</span>], <span class="k">bays</span>: [core, magazine, comms] }
        - { <span class="k">at</span>: [<span class="n">1</span>, <span class="n">0</span>], <span class="k">bays</span>: [engine, engine, coupling], <span class="k">mounts</span>: [laser, shield] }
  <span class="k">deployment</span>:
    - { <span class="k">ship</span>: <span class="s">"Blob B"</span>, <span class="k">at</span>: [<span class="n">-2</span>, <span class="n">7</span>] }
    - { <span class="k">mine</span>: [<span class="n">2</span>, <span class="n">1</span>] }
<span class="k">player_2</span>: { <span class="k">copy_of</span>: player_1, <span class="k">mirror_ships</span>: true, <span class="k">mirror_deployment</span>: true }</pre>
<h4>Checklist (what <code>engine/rules.js</code> rejects)</h4><ul class="check"><li>1–7 segments, all joined, no two on the same hex.</li><li>Exactly one core per ship (grafted campaign hulls may carry several).</li><li>At most 3 bay parts and 3 mount parts per segment, each in the right kind of slot.</li><li>Couplings ≥ segments − 1.</li><li>Munitions ≤ 3 × magazines, and a launcher if you carry any.</li><li>Exactly one flagship per fleet, and total cost within the budget.</li><li>Deploy inside your own home zone. Mines can go up to 6 rows into no man's land.</li></ul>
<h4>Design tips</h4><p>Protect the core with layers. Two stealth parts make a 3-segment ship hard to see (signature floor 1). One shared thrust pool means a fat flagship slows the whole fleet. Use the builder above and the Lab's Monte-Carlo series to test.</p>`],
  ['📖', 'Designing a campaign chapter', `<p>Chapters live in <code>campaign/chapters/</code>, hulls in <code>campaign/ships.yaml</code> (<code>id@chapter</code>, newest earlier version as fallback), and the chapter graph in <code>campaign/campaign.yaml</code>.</p>
<pre><span class="k">chapter</span>:
  <span class="k">id</span>: ch1
  <span class="k">title</span>: <span class="s">"First Contact"</span>
  <span class="k">world</span>: world_v0.4.yaml
  <span class="k">world_overrides</span>: { <span class="s">"turns.turn_limit"</span>: <span class="n">20</span> }
  <span class="k">map</span>: maps/ch1_corridor.yaml
  <span class="k">player</span>:
    <span class="k">ships</span>: [kestrel, { <span class="k">id</span>: wren, <span class="k">helm</span>: script }]
    <span class="k">deployment</span>: [ { <span class="k">ship</span>: kestrel, <span class="k">at</span>: [<span class="n">-3</span>, <span class="n">7</span>] } ]
  <span class="k">enemy</span>: { <span class="k">ships</span>: [seed], <span class="k">ai</span>: { <span class="k">default</span>: hunter } }
  <span class="k">ai_profiles</span>:
    <span class="k">hunter</span>: { <span class="k">level</span>: normal, <span class="k">stance</span>: hunt, <span class="k">stand_off</span>: { <span class="k">from</span>: kestrel, <span class="k">hexes</span>: <span class="n">9</span> } }
  <span class="k">script</span>:
    - <span class="k">id</span>: contact
      <span class="k">when</span>: { <span class="k">sees</span>: ... }
      <span class="k">do</span>: [ { <span class="k">scene</span>: ch1_contact }, { <span class="k">bark</span>: b1_contact_glyphs } ]
      <span class="k">guide</span>: { <span class="k">ship</span>: kestrel, <span class="k">steps</span>: [ ... ] }
  <span class="k">win</span>:  [ { <span class="k">destroyed</span>: seed } ]
  <span class="k">lose</span>: [ { <span class="k">destroyed</span>: kestrel } ]
  <span class="k">scenes</span>: { <span class="k">intro</span>: ch1_intro, <span class="k">win</span>: [ch1_victory, ch1_salvage], <span class="k">lose</span>: ch1_defeat }
  <span class="k">rewards</span>: { <span class="k">capabilities</span>: [launcher, magazine, missile, mine] }</pre>
<h4>Checklist</h4><ul class="check"><li>Header comment with the key numbers: start distances, who sees whom at what range, thrust per hex.</li><li>A fallback beat for every story moment (for example "split fallback round 4"), so no game stalls.</li><li>Protect ships the story needs alive (<code>protect</code>), and give every lock a <code>reason</code>.</li><li>Run <code>campaign/tools</code>: ALL CHECKS PASSED, 40/40 games finish, guide tests 15/15.</li><li>Tune in the play screen: Campaign map → <b>Test a chapter</b> → <b>Copy changes</b>.</li><li>Pass messages through <code>handoff/</code>: write in the owner's inbox and update STATUS.md.</li></ul>`],
  ['🎬', 'Designing a story scene', `<p>Scenes are JSON in <code>story/scenes/</code>, listed in <code>scenes/index.json</code>. Characters, stages and ships come from <code>characters.json</code>, <code>stages.json</code> and <code>ships.json</code>. The <code>captain</code> speaker resolves to whichever portrait set the player picked.</p>
<pre>{
  <span class="k">"id"</span>: <span class="s">"ch2_first_mine"</span>,
  <span class="k">"stage"</span>: <span class="s">"vista_quiet_water"</span>,
  <span class="k">"cast"</span>: [ { <span class="k">"id"</span>: <span class="s">"captain"</span>, <span class="k">"side"</span>: <span class="s">"left"</span> }, { <span class="k">"id"</span>: <span class="s">"sparrow_pilot"</span>, <span class="k">"side"</span>: <span class="s">"right"</span> } ],
  <span class="k">"lines"</span>: [
    { <span class="k">"effect"</span>: <span class="s">"flash"</span> },
    { <span class="k">"speaker"</span>: <span class="s">"sparrow_pilot"</span>, <span class="k">"expression"</span>: <span class="s">"smile"</span>, <span class="k">"via"</span>: <span class="s">"comms"</span>,
      <span class="k">"text"</span>: <span class="s">"It's dead in the water! Sit there and think about what you did."</span> }
  ]
}</pre>
<p>Line keys: <code>speaker</code>, <code>expression</code> (neutral, determined, worried, smile, shock, hurt), <code>text</code>, <code>via</code>, <code>effect</code> (flash, shake, glitch, fade_out), <code>show_ship</code>/<code>hide_ship</code>, <code>glyphs</code> and <code>stage</code>. A scene may also carry <code>choice</code>, <code>chapter</code> and <code>kind</code>.</p>
<h4>player.js API (unchanged)</h4>
<pre><span class="k">import</span> { loadStory, playScene, preloadScenes } <span class="k">from</span> <span class="s">'./story/player.js'</span>;
<span class="k">import</span> { showBark } <span class="k">from</span> <span class="s">'./story/bark.js'</span>;
<span class="k">await</span> loadStory(<span class="s">'story/'</span>);
<span class="k">await</span> preloadScenes([<span class="s">'ch1_intro'</span>]);
<span class="k">await</span> playScene(<span class="s">'ch1_intro'</span>, mountEl, { captain: <span class="s">'captain_a'</span>, textSpeed: <span class="s">'normal'</span>, skippable: <span class="n">true</span> });
showBark(<span class="s">'b1_contact_glyphs'</span>, mountEl, { captain: <span class="s">'captain_a'</span> });   <span class="c">// non-blocking toast</span></pre>
<p><b>Editor:</b> <code>story/editor.html</code> edits scenes in the browser and previews them through the real player, without changing <code>player.js</code>.</p>
<h4>Checklist</h4><ul class="check"><li>Never gender Captain Vey: no he, she, his or her. Use the name or "Captain".</li><li>PG-13: loss happens off-screen and is felt through the crew.</li><li>No text baked into the art. Portraits are 3:4 and stages 16:9.</li><li>Keep lines short, one beat each, about 2 lines in the box.</li><li>Barks are 1–2 lines, for battle moments that don't pause play.</li><li>Every scene id used by a chapter exists in <code>scenes/index.json</code>.</li></ul>`],
];
function initGuides() {
  const g = $('#guides');
  GUIDES.forEach(([e, t, h], i) => { const d = document.createElement('details'); if (i === 0) d.open = true; d.innerHTML = `<summary><span aria-hidden="true">${e}</span>${t}</summary><div style="padding-bottom:14px">${h}</div>`; g.appendChild(d); });
}
const GLOSS = [
  ['Axial [q, r]', 'Hex coordinates. q runs east, r runs south-east (r grows southward). The third axis is s = −q−r.'],
  ['Bay', 'An inside slot. Three per segment: core, engine, sensor, stealth, flare mask, magazine, comms, coupling.'],
  ['Mount', 'An outside slot. Three per segment: shield, armour, laser, launcher, point defence.'],
  ['Segment', 'One hex of a ship. Costs 3. Up to 7 per ship.'],
  ['Coupling', 'A bay part that joins a segment on. One is needed for every segment after the first.'],
  ['Core', 'The ship\'s brain: sensor 2, link 4, layer 6. Lose it and the ship dies.'],
  ['Layer', 'Damage order inside a segment, from 1 (shield) to 6 (core). The lowest working layer takes the hit.'],
  ['Command point (CP)', '3 per turn, bank up to 6. Every order costs 1.'],
  ['Thrust pool', 'Fleet-wide movement budget: 1 per working engine. 1 hex costs 1 per segment.'],
  ['Signature', 'How visible a ship is: segments − stealth (floor ⌈n/3⌉), plus flare, plus 1 after a big move, −2 in a nebula.'],
  ['Flare', 'A temporary signature spike from firing (+3 when the beam hits), launching (+2), point defence (+2) or scanning (+2).'],
  ['Fuzzy contact', 'A red circle of radius 2: something is near here, but you don\'t know exactly where.'],
  ['Network', 'Ships linked by comms (within the longer link range). Any ship can fire at what the network sees.'],
  ['Flight phase', 'After both players\' turns, missiles and drones move in 6 ticks.'],
  ['Seeker', 'A missile\'s own sensor (range 2 + target signature). It takes over when the lock is lost.'],
  ['Wreck', 'A segment with nothing left to damage. It stays attached and still weighs the ship down, and shots pass through it.'],
  ['Flagship', 'The ship you can\'t lose. Sink the enemy flagship to win.'],
  ['Beacon', 'An objective hex area. Start your turn holding it alone to score.'],
  ['Hurl / ram', 'Campaign only. A ship destroys itself to deal 4 hits per living segment, piercing shields.'],
  ['Graft / dock', 'Campaign only. Join two touching ships into one. Docking costs CP per extra core; grafting doesn\'t, but it leaves a seam.'],
  ['Dead in the water', 'A ship whose engines are all gone. It can\'t move, but it can still shoot.'],
  ['helm: script', 'A friendly ship that flies itself by following script orders.'],
  ['The Weave', 'The builder species. Its ships are made of cells: Seed, Twin, Husk, Bloom.'],
  ['Turn code', 'A short text string that carries a turn between two devices.'],
];
function initGloss() { $('#gloss').innerHTML = GLOSS.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join(''); }
function initRoadmap() {
  const cards = [
    ['ok', 'Shipped', 'var(--lime)', ['Rules v0.4: full fog-of-war skirmish, Lab, AI, pass-and-play and turn codes (main a933596).', 'Story campaign ch1–ch5 in /beta/ (campaign-engine 960a0f7): ALL CHECKS PASSED, 40/40 games finish, 75 tests.', 'Move guides, Test a chapter, Combat v2 (beta only).', 'Story pack v3: 31 scenes, cutscene player, barks, editor.']],
    ['beta', 'In review / in progress', 'var(--gold)', ['PR #2 campaign-engine → main is open for Ankur\'s review.', 'Combat v2 numbers are not in main\'s rules/ yet.', 'ch3 now runs about 12.7 rounds after the AI change ("move for a shot"), so the maps bot may re-tune it.', 'story/editor.html; no text in the art.']],
    ['ndef', 'Not yet defined', 'var(--red)', ['ch4b "The Long Dark": locked, no chapter file.', 'What happens after ch5\'s cliffhanger.', 'The five tutorial channels in the Channels draft (map and fleet files not written).', 'Should the stock AI move to get a shot when every shot is blocked? Parked, low priority.']],
    ['prop', 'Parked for later (world_v0.4.yaml)', 'var(--violet)', ['Ships that rotate.', 'A destroyed coupling splits the ship; twins split on purpose (the campaign has a scripted split).', 'Part upgrade levels; cutting a wrecked segment loose.', 'Tractor beams, tunnels, distortion stealth.', 'Space rivers, gravity wells, warped hexes, sphere or doughnut boards.', 'Campaign: branching map, unlocks and upgrades, salvage collectors, raw materials, a planet-sized final boss.']],
  ];
  const r = $('#roadmapCards');
  cards.forEach(([cls, t, c, items]) => { const d = document.createElement('div'); d.className = 'card glow'; d.style.setProperty('--c', c); d.innerHTML = `<h3><span class="tag ${cls}">${t}</span></h3><ul style="padding-left:18px;margin:0">${items.map((x) => `<li style="margin-bottom:6px">${esc(x)}</li>`).join('')}</ul>`; r.appendChild(d); });
  const s = document.createElement('p'); s.className = 'src'; s.style.gridColumn = '1/-1'; s.textContent = 'handoff/STATUS.md · handoff/to-maps.md · handoff/to-engine.md · rules/world_v0.4.yaml "Parked for later" · campaign_world_map.yaml'; r.appendChild(s);
  r.style.gridTemplateColumns = 'repeat(auto-fit,minmax(260px,1fr))';
}
function initV2() {
  const b = D.beta, v = $('#v2Cards');
  const cards = [
    ['🔴', 'Harder lasers', `${b.laser.hits} hits out to 4 hexes, 2 hits out to ${b.laser.range}.`],
    ['🏃', 'Attack run', `<code>attack_run_bonus: ${b.attack_run_bonus}</code>: +1 hit if the ship moved at least 1 hex this turn before firing.`],
    ['🛡️', 'Shields stay down', 'Shields come back only after a round in which they weren\'t hit (<code>recharge_if_unhit</code>, <code>recharge_every: 1</code>). Sustained fire keeps them down.'],
    ['🎯', 'Aim at any hex', 'Missiles fly the straight hex line toward any aimed hex, then carry straight on. The seeker can still take over.'],
    ['⚙️', 'Mines hit engines', '<code>strikes: engines</code> sends each mine hit to the working engine nearest the blast. With no engines left the ship is dead in the water (used in ch2). The default is <code>layers</code>.'],
    ['☄️', 'The hurl (ram)', `Script-only, no player button. The rammer is destroyed. The target takes ${b.ram.hits_per_segment} × the rammer's living segments, starting at the nearest segment and spilling over. Reach is the rammer's move + ${b.ram.reach_bonus}. Pierces shields.`],
  ];
  cards.forEach(([e, t, d]) => { const x = document.createElement('div'); x.className = 'card glow'; x.style.setProperty('--c', 'var(--gold)'); x.innerHTML = `<h3><span class="em" aria-hidden="true">${e}</span>${t}</h3><p style="font-size:14px;margin:0">${d}</p>`; v.appendChild(x); });
  const fl = D.world.detection.flare;
  $('#flareList').innerHTML = Object.entries(fl).map(([k, x]) => `${k.replace(/_/g, ' ')} <b>+${x}</b>`).join(', ');
  $('#lzHits').textContent = D.parts.laser.hits;
  const M = D.munitions;
  $('#munTable').innerHTML = '<tr><th></th><th>Speed</th><th>Fuel</th><th>Hits</th><th>Blast</th><th>Cost</th><th>Special</th></tr>' +
    [['🚀 missile', M.missile, `turn rate ${M.missile.turn_rate}, seeker ${M.missile.seeker_range}`], ['🛸 seeker drone', M.seeker_drone, `sensor ${M.seeker_drone.sensor_range}, patrols ${M.seeker_drone.patrol}, reports, remote detonate`], ['◆ mine', M.mine, `signature ${M.mine.signature}, setup only, max ${M.mine.max_per_player}`]]
      .map(([n, m, s]) => `<tr><td><b>${n}</b></td><td>${m.speed}</td><td>${m.fuel === undefined ? '∞' : m.fuel}</td><td>${m.hits}</td><td>${m.blast_radius}</td><td>${m.cost}</td><td style="font-size:12.5px">${s}</td></tr>`).join('');
}
/* ---------- boot ---------- */
function boot() {
  const steps = [initNav, initHero, initHeroMark, initMotifs, initGeometry, initQuick, initBoard, initShips, initFleets, initCombat, initV2, initMaps, initWorld, initStory, initGuides, initGloss, initRoadmap];
  for (const f of steps) { try { f(); } catch (e) { console.error('[guide] ' + f.name + ' failed', e); } }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
