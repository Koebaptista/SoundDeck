/**
 * Primeiro uso: projeto realmente vazio.
 *
 * Não ensina o produto inteiro — mostra os três passos concretos até o
 * primeiro som sair pelas caixas, que é o momento em que o operador entende
 * para que serve isto. Nada de tour, nada de tela de boas-vindas.
 */

const STEPS = [
  {
    title: 'Envie os áudios',
    body: 'Na aba Biblioteca do modo Montar. Eles ficam neste computador e podem ser usados em qualquer cena.',
  },
  {
    title: 'Crie as cenas do roteiro',
    body: 'Um bloco por momento do espetáculo, na ordem em que acontecem: “Abertura”, “Entrada de Ana”.',
  },
  {
    title: 'Monte os cues',
    body: 'Cada cue liga um áudio a uma deixa — o que acontece no palco quando ele deve tocar — e ganha uma tecla.',
  },
]

export function FirstRun({ onStart, onSeed }: { onStart: () => void; onSeed: () => void }) {
  return (
    <div className="firstrun">
      <div className="firstrun__inner">
        <h1 className="firstrun__title">Nenhum espetáculo montado ainda</h1>
        <p className="firstrun__lead">
          O SoundDeck dispara áudio ao vivo. Você cadastra uma vez, organiza na ordem do roteiro e,
          durante a peça, cada clique produz som na hora.
        </p>

        <ol className="firstrun__steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="firstrun__num num">{index + 1}</span>
              <div>
                <h2 className="firstrun__steptitle">{step.title}</h2>
                <p className="firstrun__stepbody">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="firstrun__actions">
          <button type="button" className="btn btn--primary" onClick={onStart}>
            Começar a montar
          </button>
          <button type="button" className="btn" onClick={onSeed}>
            Carregar o roteiro de exemplo
          </button>
        </div>

        <p className="hint firstrun__note">
          O exemplo traz sete áudios sintéticos e quatro cenas — serve para testar o deck de verdade
          antes de subir os seus arquivos.
        </p>
      </div>
    </div>
  )
}
