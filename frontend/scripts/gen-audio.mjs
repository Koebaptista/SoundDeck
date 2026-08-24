/**
 * Gera os WAVs sintéticos do modo mock.
 *
 * Dados falsos que produzem som de verdade: sem eles não dá para medir latência,
 * polifonia nem a rampa anti-estalo antes do backend existir. Rodado por
 * `predev` / `prebuild`, e pulado quando os arquivos já estão no lugar.
 *
 * As durações aqui são a fonte da verdade e estão espelhadas em `src/data/seed.ts`
 * (campo `duration`), usado só para exibição enquanto o áudio ainda não armou.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio')
const SR = 44100

/* ---------- utilidades de DSP ---------- */

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/** Filtro estado-variável (Chamberlin). Devolve lp/bp/hp amostra a amostra. */
function svf(fc, q) {
  const f = 2 * Math.sin((Math.PI * fc) / SR)
  const damp = 1 / q
  let low = 0
  let band = 0
  return (x) => {
    const high = x - low - damp * band
    band += f * high
    low += f * band
    return { lp: low, bp: band, hp: high }
  }
}

/** Ruído branco determinístico (mulberry32) — build reprodutível. */
function noise(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

const env = (t, dur, attack, release) =>
  Math.min(1, t / attack) * Math.min(1, Math.max(0, (dur - t) / release))

/** Normaliza para o pico alvo e aplica 5ms de fade nas duas pontas. */
function finish(buf, peak = 0.82) {
  let max = 0
  for (const s of buf) max = Math.max(max, Math.abs(s))
  const g = max > 0 ? peak / max : 1
  const fade = Math.floor(SR * 0.005)
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i] * g
    if (i < fade) v *= i / fade
    const tail = buf.length - 1 - i
    if (tail < fade) v *= tail / fade
    buf[i] = v
  }
  return buf
}

function writeWav(name, samples) {
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(clamp(samples[i], -1, 1) * 32767), 44 + i * 2)
  }
  writeFileSync(join(OUT, name), buf)
  return buf.length
}

const alloc = (seconds) => new Float32Array(Math.floor(SR * seconds))

/* ---------- os sons ---------- */

/** Campainha: ding-dong, dois pares de parciais decaindo. */
function campainha(dur = 1.8) {
  const out = alloc(dur)
  const hit = (f0, at, decay, gain) => {
    const start = Math.floor(at * SR)
    for (let i = start; i < out.length; i++) {
      const t = (i - start) / SR
      const a = Math.exp(-t / decay) * gain
      if (a < 1e-4) break
      out[i] +=
        a * (Math.sin(2 * Math.PI * f0 * t) + 0.45 * Math.sin(2 * Math.PI * f0 * 2.76 * t))
    }
  }
  hit(659.25, 0, 0.42, 1) // E5
  hit(523.25, 0.34, 0.55, 0.95) // C5
  return finish(out)
}

/** Porta batendo: golpe grave + estalo de ruído filtrado. */
function porta(dur = 0.9) {
  const out = alloc(dur)
  const rnd = noise(11)
  const lp = svf(340, 0.8)
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const thump = Math.sin(2 * Math.PI * 68 * t) * Math.exp(-t / 0.09)
    const crack = lp(rnd()).lp * Math.exp(-t / 0.035)
    const body = lp(rnd()).lp * Math.exp(-t / 0.22) * 0.4
    out[i] = thump * 0.9 + crack * 2.4 + body
  }
  return finish(out)
}

/** Trovão: estalo seco seguido de rolo grave longo. */
function trovao(dur = 5.2) {
  const out = alloc(dur)
  const rnd = noise(23)
  const rumble = svf(90, 1.6)
  const crackF = svf(2200, 0.9)
  let brown = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    brown = clamp(brown + rnd() * 0.02, -1, 1)
    const roll =
      rumble(brown).lp * (Math.exp(-t / 2.4) + 0.6 * Math.exp(-Math.abs(t - 1.1) / 0.9))
    const crack = crackF(rnd()).bp * Math.exp(-t / 0.07)
    out[i] = roll * 8 + crack * 0.8
  }
  return finish(out)
}

/** Passos: sete impactos irregulares de ruído em banda média. */
function passos(dur = 3.6) {
  const out = alloc(dur)
  const rnd = noise(37)
  const times = [0.05, 0.52, 1.03, 1.48, 1.99, 2.46, 2.95]
  for (const [k, at] of times.entries()) {
    const start = Math.floor(at * SR)
    const bp = svf(k % 2 === 0 ? 480 : 620, 2.2)
    const gain = 0.8 + (k % 3) * 0.12
    for (let i = start; i < out.length; i++) {
      const t = (i - start) / SR
      if (t > 0.3) break
      out[i] += bp(rnd()).bp * Math.exp(-t / 0.045) * gain * 3
      out[i] += Math.sin(2 * Math.PI * 110 * t) * Math.exp(-t / 0.03) * 0.25
    }
  }
  return finish(out, 0.7)
}

/** Vento: ruído por filtro ressonante que respira. Faixa longa, feita para loop. */
function vento(dur = 22) {
  const out = alloc(dur)
  const rnd = noise(53)
  let low = 0
  let band = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const fc =
      420 + 260 * Math.sin(2 * Math.PI * 0.07 * t) + 120 * Math.sin(2 * Math.PI * 0.19 * t)
    const f = 2 * Math.sin((Math.PI * fc) / SR)
    const high = rnd() - low - 0.45 * band
    band += f * high
    low += f * band
    out[i] = band * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.05 * t))
  }
  return finish(out, 0.6)
}

/** Aplausos: nuvem densa de estalos curtos, entrando e saindo em rampa. */
function aplausos(dur = 7) {
  const out = alloc(dur)
  const rnd = noise(71)
  const bp = svf(1800, 1.1)
  const claps = Math.floor(dur * 130)
  for (let c = 0; c < claps; c++) {
    const start = Math.floor(Math.abs(rnd()) * dur * SR)
    const amp = 0.25 + Math.abs(rnd()) * 0.75
    const until = Math.min(out.length, start + Math.floor(SR * 0.05))
    for (let i = start; i < until; i++) {
      out[i] += bp(rnd()).bp * Math.exp(-((i - start) / SR) / 0.008) * amp
    }
  }
  for (let i = 0; i < out.length; i++) out[i] *= env(i / SR, dur, 0.35, 1.4)
  return finish(out, 0.75)
}

/**
 * Música de entrada: pad de quatro acordes, 78s.
 *
 * Passa dos 45s de propósito — é o caso que exercita o caminho de streaming
 * (`HTMLAudioElement`) em vez da decodificação em memória.
 */
function musicaEntrada(dur = 78) {
  const out = alloc(dur)
  const chords = [
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [130.81, 196.0, 246.94], // C
    [196.0, 246.94, 293.66], // G
  ]
  const bar = dur / 8
  for (let b = 0; b < 8; b++) {
    const chord = chords[b % chords.length]
    const start = Math.floor(b * bar * SR)
    const end = Math.min(out.length, Math.floor((b + 1) * bar * SR + SR * 1.6))
    for (let i = start; i < end; i++) {
      const t = (i - start) / SR
      const a = env(t, bar + 1.6, 1.1, 1.5) * 0.33
      let s = 0
      for (const [k, f] of chord.entries()) {
        const detune = 1 + (k - 1) * 0.0015
        s += Math.sin(2 * Math.PI * f * detune * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t)
      }
      out[i] += (s / chord.length) * a * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.8 * t))
    }
  }
  return finish(out, 0.55)
}

/* ---------- execução ---------- */

const FILES = [
  ['campainha.wav', campainha],
  ['porta.wav', porta],
  ['trovao.wav', trovao],
  ['passos.wav', passos],
  ['vento.wav', vento],
  ['aplausos.wav', aplausos],
  ['musica-entrada.wav', musicaEntrada],
]

mkdirSync(OUT, { recursive: true })

const force = process.argv.includes('--force')
const pending = FILES.filter(([name]) => force || !existsSync(join(OUT, name)))

if (pending.length === 0) {
  console.log(`[audio] ${FILES.length} arquivos já em public/audio (use --force para regerar)`)
} else {
  for (const [name, make] of pending) {
    const bytes = writeWav(name, make())
    console.log(`[audio] ${name.padEnd(20)} ${(bytes / 1024 / 1024).toFixed(2)} MB`)
  }
}
