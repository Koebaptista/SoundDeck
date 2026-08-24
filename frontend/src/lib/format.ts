/** Formatação de tempo e contagem. Sempre em pt-BR, sempre tabular. */

/** `2:14`, `12:04`, `1:02:30`. Nunca com sinal — quem precisa dele adiciona. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`
}

/**
 * Duração de um arquivo. Arredonda para cima, nunca para baixo.
 *
 * Uma batida de porta de 0,9s exibida como `0:00` parece um cue quebrado. O que
 * importa nesta leitura é distinguir um efeito de segundos de uma música de
 * minutos, e para isso o arredondamento para cima é sempre honesto.
 */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return clock(0)
  return clock(Math.ceil(seconds))
}

/** Tempo restante, com o sinal que o operador espera ver. */
export function remaining(position: number, duration: number): string {
  return `−${clock(Math.max(0, duration - position))}`
}

export function bytes(size?: number): string {
  if (!size) return ''
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** Plural do português sem biblioteca: dois casos bastam para o que existe aqui. */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
