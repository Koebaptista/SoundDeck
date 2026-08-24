/**
 * Proteção de campos de escolha contra troca acidental.
 *
 * Um `<select>` com foco — e um `<input type="date">` também — muda de valor
 * quando a roda do mouse passa por cima dele. Numa lista de montagem isso
 * realoca uma cena para outro dia, troca o áudio de um cue ou adianta a data
 * de uma apresentação sem que ninguém tenha decidido nada: o operador só
 * estava rolando a página.
 *
 * Tirar o foco no primeiro evento de roda devolve o gesto ao que ele deveria
 * fazer, que é rolar. Nenhum outro comportamento do controle muda: clique,
 * teclado e leitor de tela continuam idênticos.
 */
export function blurOnWheel(event: React.WheelEvent<HTMLElement>) {
  if (document.activeElement === event.currentTarget) event.currentTarget.blur()
}
