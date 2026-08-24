import { useEffect } from 'react'

/**
 * O teclado não opera o deck. Este arquivo é o que garante isso.
 *
 * Aqui moravam os atalhos: `1..9` disparava o cue, `Espaço` congelava tudo,
 * `Esc` parava, as setas trocavam de cena. Eram uma rede de segurança para o
 * operador — e viraram a maior armadilha do produto. No escuro da coxia, com
 * gente passando atrás da mesa, uma manga que encosta no teclado dispara som
 * no meio da peça. O gesto não tem confirmação e não tem desfazer: o teatro
 * inteiro ouve.
 *
 * Então o disparo é do mouse, e só. Remover o `keydown` que ouvia as teclas
 * resolveu a maior parte — mas não toda, e o resto é a razão de este arquivo
 * existir em vez de simplesmente ter sido apagado.
 *
 * **Um `<button>` do navegador dispara com `Enter` e com `Espaço`, sem que
 * ninguém tenha escrito isso.** E o botão fica com o foco depois de ser
 * clicado. Ou seja: o operador dispara um cue com o mouse, o foco fica ali, e
 * qualquer `Espaço` esbarrado repete o disparo — exatamente o acidente que se
 * queria evitar, agora sem nenhum código nosso envolvido.
 *
 * Este gancho tira essa porta da frente enquanto o modo operar está na tela.
 *
 * Duas exceções, e as duas de propósito:
 *
 * - **Campo de texto.** Não existe um no modo operar hoje, mas o dia em que
 *   existir, digitar precisa continuar sendo digitar.
 * - **Diálogo aberto.** Um diálogo é uma conversa deliberada, e nenhum botão
 *   dentro de um faz som. Travar o teclado ali só deixaria alguém preso numa
 *   janela que não fecha.
 */

/** Só estas duas acionam um botão em foco. O resto já não faz nada. */
const ACIONAM = new Set([' ', 'Spacebar', 'Enter'])

function digitando(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  if (alvo.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)
}

export function useTecladoInerte(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return

    const aoTeclar = (evento: KeyboardEvent) => {
      if (!ACIONAM.has(evento.key)) return
      if (digitando(evento.target)) return
      if (document.querySelector('dialog[open]')) return
      // O clique do navegador nasce como ação padrão da tecla, depois que os
      // ouvintes rodam. Impedir a ação padrão aqui é o que impede o cue de
      // disparar — tanto no `Enter`, que aciona no `keydown`, quanto no
      // `Espaço`, que aciona no `keyup` mas depende deste mesmo padrão.
      evento.preventDefault()
    }

    // Captura, e não bolha: assim nada dentro da árvore pode agir antes.
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [ativo])
}
