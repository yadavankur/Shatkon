// Playing across two devices without a server.
//   Turn code: the actions of one turn, short enough to paste into a chat.
//   Game code: the whole game, for starting, saving or recovering one.
// Both devices run the same engine, so replaying a turn code gives the same result;
// the fingerprints inside the code prove the two games still match.

import { apply } from './turn.js';
import { current } from './state.js';
import { hashState, parseAction, actionText, pack, unpack, scramble, fnv, stable } from './codec.js';

const enc = new TextEncoder(), dec = new TextDecoder();

// The code for the turn that has just ended on this device.
export function turnCode(state) {
  const t = state.lastTurn;
  if (!t) throw new Error('no turn has been finished yet');
  const head = 'SK1:' + t.round + ':' + (t.player + 1) + ':' + t.pre;
  return head + ':' + pack(scramble(enc.encode(t.actions.join(';')), head)) + ':' + t.post;
}

function header(code) {
  const f = String(code).replace(/\s+/g, '').split(':');
  if (f.length !== 6 || f[0] !== 'SK1') throw new Error('that does not look like a turn code');
  return { f, head: f.slice(0, 4).join(':'), round: Number(f[1]), player: Number(f[2]) - 1, pre: f[3], post: f[5] };
}
export function readTurnCode(code) {
  const h = header(code);
  let actions;
  try {
    const text = dec.decode(scramble(unpack(h.f[4]), h.head));
    actions = text ? text.split(';').map(parseAction) : [];
  } catch (e) { throw new Error('that turn code is damaged; ask your opponent to send it again'); }
  return { round: h.round, player: h.player, pre: h.pre, post: h.post, actions };
}

// Replays an opponent's turn code on this device and checks the result matches theirs.
export function applyTurnCode(state, code) {
  const h = header(code);
  if (state.phase !== 'play') throw new Error('this game is already over');
  if (h.round !== state.round || h.player !== current(state))
    throw new Error('that code is for round ' + h.round + ', player ' + (h.player + 1) + '; this game is waiting for round ' + state.round + ', player ' + (current(state) + 1));
  if (h.pre !== state.pre) throw new Error('the two games no longer match; ask your opponent for a full game code');
  const t = readTurnCode(code);
  // a game code taken part-way through a turn already holds the first few actions: skip those
  const done = state.pending.length;
  if (state.pending.join(';') !== t.actions.slice(0, done).map(actionText).join(';')) throw new Error('the two games no longer match; ask your opponent for a full game code');
  let s = state;
  try { for (const a of t.actions.slice(done)) s = apply(s, a); }
  catch (e) { throw new Error('the turn replayed differently here; ask your opponent for a full game code'); }
  if (hashState(s) !== t.post) throw new Error('the turn replayed differently here; ask your opponent for a full game code');
  return s;
}

async function squeeze(bytes, how) {
  const stream = new Blob([bytes]).stream().pipeThrough(how === 'in' ? new CompressionStream('deflate') : new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// The whole game as text. It holds everything, including both fleets, so only use
// it to start a game or to recover one.
export async function exportGame(state) {
  const { events, flight, ...rest } = state;
  // a seal over the exact text, so a code that was edited by hand or damaged in transit is caught
  const body = JSON.stringify(rest), raw = enc.encode(JSON.stringify({ seal: fnv(body).toString(36), game: JSON.parse(body) }));
  if (typeof CompressionStream === 'function') return 'SKG1:' + pack(await squeeze(raw, 'in'));
  return 'SKJ1:' + pack(raw);
}
const bad = (why) => { throw new Error(why); };
const DAMAGED = 'that game code is damaged or incomplete; ask for it again and copy all of it';
const EDITED = 'that game code has been changed since it was made, so it cannot be trusted; ask for a fresh one';
export async function importGame(code) {
  const text = String(code).replace(/\s+/g, ''), kind = text.slice(0, 5);
  if (kind !== 'SKG1:' && kind !== 'SKJ1:') bad('that does not look like a game code');
  let doc;
  try {
    let bytes = unpack(text.slice(5));
    if (kind === 'SKG1:') bytes = await squeeze(bytes, 'out');
    doc = JSON.parse(dec.decode(bytes));
  } catch (e) { bad(DAMAGED); }
  let state = doc;
  if (doc && typeof doc === 'object' && 'seal' in doc) {
    // sealed codes (this version on): the seal must match the game text exactly
    if (!doc.game || typeof doc.game !== 'object' || fnv(JSON.stringify(doc.game)).toString(36) !== doc.seal) bad(EDITED);
    state = doc.game;
  }
  checkShape(state);
  // the rules fingerprint taken when the game started must still match the rules inside
  if (state.rid && fnv(stable(state.rules)).toString(36) !== state.rid) bad(EDITED);
  state.events = [];
  return state;
}
// A game code from an older version has no seal: at least make sure it is a whole, sane game.
function checkShape(s) {
  const int = (x) => Number.isInteger(x);
  const ok = s && typeof s === 'object' && s.v === 1 && s.rules && typeof s.rules === 'object' && s.rules.parts && s.rules.board
    && Array.isArray(s.players) && s.players.length >= 2 && Array.isArray(s.ships) && Array.isArray(s.objs)
    && int(s.round) && s.round >= 1 && (s.phase === 'play' || s.phase === 'over') && Array.isArray(s.order)
    && s.ships.every((x) => x && typeof x.id === 'string' && int(x.owner) && x.owner >= 0 && x.owner < s.players.length
      && Array.isArray(x.pos) && x.pos.length === 2 && x.pos.every(int) && Array.isArray(x.segs) && x.segs.length > 0
      && x.segs.every((g) => g && Array.isArray(g.off) && Array.isArray(g.parts) && g.parts.every((pt) => pt && s.rules.parts[pt.t] && typeof pt.hp === 'number')));
  if (!ok) bad(DAMAGED);
}
