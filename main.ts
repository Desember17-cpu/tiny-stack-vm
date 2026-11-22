// Tiny stack VM — pre-decoded per byte address (@desember179).
// Jumps into an immediate decode the target byte on its own; semantics follow vm.mjs.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// [opcode, immediate bytes, pops, pushes]
const T=[[0,0,0,0],[1,1,0,1],[2,4,0,1],[3,0,1,0],[4,0,1,2],[5,0,2,2],[6,0,2,3],[7,0,3,3],
[16,0,2,1],[17,0,2,1],[18,0,2,1],[19,0,2,1],[20,0,2,1],[21,0,2,1],[22,0,2,1],[23,0,1,1],
[24,0,2,1],[25,0,2,1],[26,0,2,1],[27,0,1,1],[28,0,2,1],[29,0,2,1],[30,0,2,1],[32,0,2,1],
[33,0,2,1],[34,0,2,1],[48,2,0,0],[49,2,1,0],[50,2,1,0],[51,2,0,0],[52,0,0,0],[64,0,1,1],
[65,0,2,0],[80,0,1,0],[81,0,1,0],[82,0,0,1],[83,0,1,0]];
const IMM = new Int8Array(256).fill(-1);
const POPS = new Uint8Array(256);
const PUSHES = new Uint8Array(256);
for (const [b, i, p, q] of T) { IMM[b] = i; POPS[b] = p; PUSHES[b] = q; }

function run(prog, input) {
  const n = prog.length;
  // Pre-decode: one entry per byte address. opc -1 = unknown opcode,
  // -2 = immediate cut off by the end of the program.
  const opc = new Int16Array(n);
  const arg = new Int32Array(n);
  const nxt = new Int32Array(n);
  for (let p = 0; p < n; p++) {
    const b = prog[p];
    const im = IMM[b];
    if (im < 0) { opc[p] = -1; continue; }
    if (p + im >= n) { opc[p] = -2; continue; }
    opc[p] = b;
    nxt[p] = p + 1 + im;
    if (b === 0x01) arg[p] = (prog[p + 1] << 24) >> 24;
    else if (b === 0x02) arg[p] = prog[p + 1] | (prog[p + 2] << 8) | (prog[p + 3] << 16) | (prog[p + 4] << 24);
    else if (b >= 0x30 && b <= 0x32) arg[p] = ((prog[p + 1] | (prog[p + 2] << 8)) << 16) >> 16;
    else if (b === 0x33) arg[p] = prog[p + 1] | (prog[p + 2] << 8);
  }
  const D = new Int32Array(256);
  let sp = 0;
  const C = new Int32Array(64);
  let csp = 0;
  const M = new Int32Array(256);
  const out = [];
  let olen = 0;
  let inPos = 0;
  let pc = 0;
  let steps = 0;
  const done = (exit) => ({ stdout: Buffer.from(out), exit });
  for (;;) {
    if (steps === 1000000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const o = opc[pc];
    if (o < 0) return done(o === -1 ? 5 : 9);
    steps++;
    const nx = nxt[pc];
    const a = arg[pc];
    if (sp < POPS[o]) return done(2);
    if (sp - POPS[o] + PUSHES[o] > 256) return done(3);
    pc = nx;
    switch (o) {
      case 0x00: return done(0);
      case 0x01: case 0x02: D[sp++] = a; break;
      case 0x03: sp--; break;
      case 0x04: D[sp] = D[sp - 1]; sp++; break;
      case 0x05: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 0x06: D[sp] = D[sp - 2]; sp++; break;
      case 0x07: { const t = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = t; break; }
      case 0x17: D[sp - 1] = -D[sp - 1] | 0; break;
      case 0x1b: D[sp - 1] = ~D[sp - 1]; break;
      case 0x30: pc = nx + a; break;
      case 0x31: { const v = D[--sp]; if (v === 0) pc = nx + a; break; }
      case 0x32: { const v = D[--sp]; if (v !== 0) pc = nx + a; break; }
      case 0x33:
        if (csp === 64) return done(7);
        C[csp++] = nx; pc = a; break;
      case 0x34:
        if (csp === 0) return done(8);
        pc = C[--csp]; break;
      case 0x40: {
        const ad = D[sp - 1];
        if (ad < 0 || ad >= 256) return done(6);
        D[sp - 1] = M[ad]; break;
      }
      case 0x41: {
        const ad = D[sp - 1];
        const v = D[sp - 2];
        if (ad < 0 || ad >= 256) return done(6);
        sp -= 2; M[ad] = v; break;
      }
      case 0x50: {
        const s = String(D[sp - 1]);
        if (olen + s.length > 65536) return done(11);
        sp--;
        for (let k = 0; k < s.length; k++) out.push(s.charCodeAt(k));
        olen += s.length; break;
      }
      case 0x51:
        if (olen + 1 > 65536) return done(11);
        out.push(D[--sp] & 255); olen++; break;
      case 0x52: D[sp++] = inPos < input.length ? input[inPos++] : -1; break;
      case 0x53: return done(D[--sp] & 255);
      default: {
        // Binary ops 0x10-0x16, 0x18-0x1a, 0x1c-0x1e, 0x20-0x22.
        const b = D[sp - 1];
        const av = D[sp - 2];
        let r;
        switch (o) {
          case 0x10: r = (av + b) | 0; break;
          case 0x11: r = (av - b) | 0; break;
          case 0x12: r = Math.imul(av, b); break;
          case 0x13:
            if (b === 0) return done(4);
            r = av === -2147483648 && b === -1 ? av : (av / b) | 0; break;
          case 0x14:
            if (b === 0) return done(4);
            r = b === -1 ? 0 : (av % b) | 0; break;
          case 0x15:
            if (b === 0) return done(4);
            r = Math.floor((av >>> 0) / (b >>> 0)) | 0; break;
          case 0x16:
            if (b === 0) return done(4);
            r = ((av >>> 0) % (b >>> 0)) | 0; break;
          case 0x18: r = av & b; break;
          case 0x19: r = av | b; break;
          case 0x1a: r = av ^ b; break;
          case 0x1c: r = av << (b & 31); break;
          case 0x1d: r = av >> (b & 31); break;
          case 0x1e: r = (av >>> (b & 31)) | 0; break;
          case 0x20: r = av === b ? 1 : 0; break;
          case 0x21: r = av < b ? 1 : 0; break;
          default: r = (av >>> 0) < (b >>> 0) ? 1 : 0; break;
        }
        sp -= 2; D[sp++] = r; break;
      }
    }
  }
}

const ids = readdirSync(I, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
for (const id of ids) {
  const dir = join(I, id);
  let prog;
  let input;
  try { prog = readFileSync(join(dir, 'program.bin')); } catch { prog = Buffer.alloc(0); }
  try { input = readFileSync(join(dir, 'input.bin')); } catch { input = Buffer.alloc(0); }
  const r = run(prog, input);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.stdout);
  writeFileSync(join(O, id, 'exit.txt'), String(r.exit) + '\n');
}
