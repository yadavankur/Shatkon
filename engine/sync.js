// Playing across two devices without a server.
//   Turn code: the actions of one turn, short enough to paste into a chat.
//   Game code: the whole game, for starting, saving or recovering one.
// Both devices run the same engine, so replaying a turn code gives the same result;
// the fingerprints inside the code prove the two games still match.

import { apply } from './turn.js';
import { current } from './state.js';
import { hashState, parseAction, actionText, pack, unpack, scramble } from './codec.js';

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
  const { events, ...rest } = state;
  const raw = enc.encode(JSON.stringify(rest));
  if (typeof CompressionStream === 'function') return 'SKG1:' + pack(await squeeze(raw, 'in'));
  return 'SKJ1:' + pack(raw);
}
export async function importGame(code) {
  const text = String(code).replace(/\s+/g, ''), kind = text.slice(0, 5);
  if (kind !== 'SKG1:' && kind !== 'SKJ1:') throw new Error('that does not look like a game code');
  let bytes = unpack(text.slice(5));
  if (kind === 'SKG1:') bytes = await squeeze(bytes, 'out');
  const state = JSON.parse(dec.decode(bytes));
  state.events = [];
  return state;
}
