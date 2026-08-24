import { useEffect, useRef } from 'react'
import { CloseIcon, SwapIcon } from '../icons'

/**
 * O bilhete de abertura: os dois botões que mudam a tela inteira.
 *
 * O deck é montado por uma pessoa e operado por outra, e quem opera muitas
 * vezes recebe o programa pronto sem nunca ter visto um. Para essa pessoa a
 * tela não tem problema de densidade — tem problema de orientação. Ela não
 * sabe que existe um segundo modo, nem que o roteiro que está no ar é um entre
 * vários, e nada na tela grita isso: são dois controles discretos, no alto,
 * que parecem decoração até alguém dizer que não são.
 *
 * Por isso o bilhete não ensina o produto. Ele ensina exatamente dois botões,
 * mostrando cada um com a cara que ele tem lá em cima, e sai da frente. Tudo
 * o mais se descobre clicando; esses dois, não.
 *
 * Aparece em toda abertura, e é uma escolha, não um esquecimento: quem opera
 * um espetáculo por mês não é a mesma pessoa que abriu o programa ontem, e o
 * custo de reler quatro linhas é menor que o de travar na estreia.
 */

export function BemVindo({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  return (
    <dialog className="dialog bemvindo" ref={ref} onClose={onClose} aria-labelledby="bemvindo-title">
      <div className="dialog__head">
        <h2 id="bemvindo-title" className="dialog__title">
          Como usar o SoundDeck
        </h2>
        <form method="dialog">
          <button type="submit" className="icon-btn" aria-label="Fechar">
            <CloseIcon size={14} />
          </button>
        </form>
      </div>

      <ol className="bemvindo__list">
        <li className="bemvindo__item">
          {/* A réplica do controle de verdade, e não um desenho dele: o olho
              procura na tela a mesma forma que viu aqui. Sem interação — o
              lugar de clicar é lá em cima. */}
          <div className="bemvindo__art" aria-hidden="true">
            <span className="segmented segmented--mostra">
              <span className="segmented__item">Operar</span>
              <span className="segmented__item" data-on="">
                Montar
              </span>
            </span>
          </div>
          <div className="bemvindo__text">
            <h3 className="bemvindo__title">Operar ou Montar — no alto da tela</h3>
            <p>
              <strong>Montar</strong> é a preparação: enviar áudios, criar as cenas e dizer qual
              tecla dispara o quê. <strong>Operar</strong> é o espetáculo: a tela grande, onde você
              clica para o som sair.
            </p>
            <p className="bemvindo__aside">
              Dá para ir e voltar quantas vezes quiser — nada se perde na troca.
            </p>
          </div>
        </li>

        <li className="bemvindo__item">
          <div className="bemvindo__art" aria-hidden="true">
            <span className="btn bemvindo__swap">
              <SwapIcon size={15} />
              Trocar
            </span>
          </div>
          <div className="bemvindo__text">
            <h3 className="bemvindo__title">Trocar — na barra logo abaixo</h3>
            <p>
              O deck guarda várias peças, e cada peça tem os seus dias. O <strong>Trocar</strong>{' '}
              escolhe qual roteiro está carregado agora — é por ele que se passa da estreia para a
              sessão de sábado.
            </p>
            <p className="bemvindo__aside">
              Ele não apaga nem renomeia nada. Abriu por engano? <kbd>Esc</kbd> fecha sem mudar
              coisa alguma.
            </p>
          </div>
        </li>
      </ol>

      <p className="dialog__note">
        Durante o espetáculo, <kbd>Esc</kbd> para tudo na hora e <kbd>Espaço</kbd> congela o que
        está no ar. A lista inteira de teclas fica no botão de teclado, no canto direito do alto.
      </p>

      <form method="dialog" className="bemvindo__done">
        <button type="submit" className="btn btn--primary">
          Entendi
        </button>
      </form>
    </dialog>
  )
}
