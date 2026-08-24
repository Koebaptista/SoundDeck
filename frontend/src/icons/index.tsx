/**
 * Conjunto de ícones do SoundDeck, desenhado à mão.
 *
 * Uma regra interna, aplicada sem exceção: **transporte é sólido** (tocar,
 * pausar, parar — são formas, e formas sólidas se leem de relance no escuro),
 * **ação é contorno** de 1.5px com pontas arredondadas. Grade de 16px.
 *
 * Nenhuma biblioteca de ícones entra no projeto: um punhado de glifos não justifica a
 * dependência, e um segundo conjunto quebraria a coerência.
 */

type Props = { size?: number; className?: string }

const stroke = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false as const,
  className,
})

const solid = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: false as const,
  className,
})

/* ---- transporte: sólido ---- */

export const PlayIcon = ({ size = 16, className }: Props) => (
  <svg {...solid(size, className)}>
    <path d="M4.5 3.2a.6.6 0 0 1 .92-.5l7 4.8a.6.6 0 0 1 0 1l-7 4.8a.6.6 0 0 1-.92-.5V3.2Z" />
  </svg>
)

export const PauseIcon = ({ size = 16, className }: Props) => (
  <svg {...solid(size, className)}>
    <rect x="4" y="3" width="3" height="10" rx="1" />
    <rect x="9" y="3" width="3" height="10" rx="1" />
  </svg>
)

export const StopIcon = ({ size = 16, className }: Props) => (
  <svg {...solid(size, className)}>
    <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
  </svg>
)

/* ---- ação: contorno ---- */

export const RestartIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M13 8a5 5 0 1 1-1.6-3.66" />
    <path d="M13.2 2.4v2.6h-2.6" />
  </svg>
)

/**
 * Retroceder e avançar dez segundos.
 *
 * O arco é o mesmo do reinício — espelhado num sentido e no outro — e o número
 * vai dentro dele. É a única exceção à regra do contorno: um `10` vazado some
 * na coxia, então ele é sólido, com o arco em volta continuando de contorno.
 */
const dez = {
  x: 8,
  y: 10.5,
  textAnchor: 'middle' as const,
  fontSize: 7,
  fontWeight: 700,
  fill: 'currentColor',
  stroke: 'none',
}

export const Back10Icon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M3 8a5 5 0 1 0 1.6-3.66" />
    <path d="M2.8 2.4v2.6h2.6" />
    <text {...dez}>10</text>
  </svg>
)

export const Fwd10Icon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M13 8a5 5 0 1 1-1.6-3.66" />
    <path d="M13.2 2.4v2.6h-2.6" />
    <text {...dez}>10</text>
  </svg>
)

export const LoopIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h5A2.5 2.5 0 0 1 13 6.5v.7" />
    <path d="M13 9.5A2.5 2.5 0 0 1 10.5 12h-5A2.5 2.5 0 0 1 3 9.5v-.7" />
    <path d="M11.4 5.6 13 7.2l1.4-1.6M4.6 10.4 3 8.8l-1.4 1.6" />
  </svg>
)

export const PlusIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
)

/** Duplicar: duas folhas do mesmo roteiro, uma atrás da outra. */
export const CopyIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <rect x="5.75" y="5.75" width="7.5" height="7.5" rx="1.5" />
    <path d="M10.25 3.75a1.5 1.5 0 0 0-1.5-1.5h-4.5a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5" />
  </svg>
)

export const TrashIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8" />
  </svg>
)

export const UpIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />
  </svg>
)

export const DownIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />
  </svg>
)

export const WarnIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M8 2.6 14.2 13H1.8L8 2.6Z" />
    <path d="M8 6.6v3.1" />
    <circle cx="8" cy="11.4" r="0.75" fill="currentColor" stroke="none" />
  </svg>
)

export const CheckIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M3 8.6 6.3 12 13 4.6" />
  </svg>
)

export const UploadIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M8 10.5v-8M4.8 5.7 8 2.5l3.2 3.2" />
    <path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10" />
  </svg>
)

export const CloseIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

/** Trocar: duas vias opostas. O botão que abre o seletor de peça e dia. */
export const SwapIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M2.75 5.5h9.5M9.75 3l2.5 2.5-2.5 2.5" />
    <path d="M13.25 10.5h-9.5M6.25 8l-2.5 2.5 2.5 2.5" />
  </svg>
)

/** Avançar um nível na hierarquia: peça → dias, dia → cenas, cena → cues. */
export const NextIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
)

export const SpeakerIcon = ({ size = 16, className }: Props) => (
  <svg {...stroke(size, className)}>
    <path d="M8.5 3 5 5.8H2.6v4.4H5L8.5 13V3Z" />
    <path d="M11 6.2a2.6 2.6 0 0 1 0 3.6M13 4.4a5.2 5.2 0 0 1 0 7.2" />
  </svg>
)
