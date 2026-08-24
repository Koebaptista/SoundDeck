/**
 * Primeiro uso: projeto realmente vazio.
 *
 * Não ensina o produto inteiro — mostra os quatro passos concretos até o
 * primeiro som sair pelas caixas, que é o momento em que o operador entende
 * para que serve isto. Nada de tour, nada de tela de boas-vindas.
 */

const STEPS = [
  {
    title: 'Crie a peça e os dias',
    body: 'Uma peça por espetáculo — com o teatro onde ela acontece. Dentro dela, um dia por apresentação: três noites em cartaz são três dias.',
  },
  {
    title: 'Envie os áudios',
    body: 'Na aba Biblioteca do modo Montar. Eles ficam neste computador e servem a qualquer cena, de qualquer peça.',
  },
  {
    title: 'Crie as cenas de cada dia',
    body: 'Um bloco por momento do espetáculo, na ordem em que acontecem: “Abertura”, “Entrada de Ana”. Dias iguais se montam uma vez e se duplicam.',
  },
  {
    title: 'Monte as músicas',
    body: 'Cada música entra numa cena com a sua deixa — o que acontece no palco na hora em que ela deve tocar. No espetáculo, um clique nela põe o som no ar.',
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
          O exemplo traz quatro peças, dez apresentações e sete áudios sintéticos — serve para
          testar o deck de verdade antes de subir os seus arquivos.
        </p>
      </div>
    </div>
  )
}
