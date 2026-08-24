# Product

## Register

product

## Users

Um operador de sonoplastia único — a mesma pessoa que cadastrou os áudios é a
que dispara ao vivo. Não há equipe, turno ou entrega para terceiros.

**Contexto de operação:** varia entre a coxia/cabine no escuro (caso crítico,
durante o espetáculo), a mesa técnica na plateia e a sala iluminada (ensaios,
eventos). A tela é frequentemente a única fonte de luz no campo de visão do
operador e não pode vazar para o palco.

**O trabalho a ser feito:** acompanhar a ação no palco e disparar o som certo
no instante exato da deixa. O operador não está olhando para a tela — está
olhando para o palco, e desvia o olhar por um segundo para clicar. A interface
é consultada de relance, sob pressão, sem chance de segunda tentativa.

**Frequência:** montagem intensa antes da estreia (cadastro de áudios, cenas,
atalhos), depois uso puramente operacional e repetido a cada apresentação.

**Entrada primária:** mouse/trackpad. Atalhos de teclado são a rede de
segurança, não a interface principal.

**Escala:** indefinida e crescente. O layout precisa servir tanto a uma peça de
6 disparos quanto a um roteiro de 60 sem redesenho.

## Product Purpose

SoundDeck é um deck de disparo de áudio para apresentações ao vivo, rodando
localmente. Cadastra-se os áudios uma vez, organiza-se em cenas na ordem do
roteiro, e durante o espetáculo cada clique produz som imediatamente.

**Sucesso é a ausência de evento:** a peça acontece e ninguém na plateia
percebeu que havia software envolvido. O produto falha se o operador hesitar,
se o som atrasar, ou se ele precisar pensar na ferramenta em vez de na cena.

**Não-objetivo:** não é uma DAW, não é edição de áudio, não é mixagem. Ele
dispara arquivos prontos e para arquivos tocando.

## Brand Personality

Silencioso, preciso, confiável. Um instrumento, não um aplicativo.

**Voz:** direta e operacional, em português. Rótulos são substantivos e verbos
do teatro ("cena", "deixa", "disparar", "parar tudo"), não jargão de software
("item", "registro", "entidade"). Nenhuma exclamação, nenhuma personalidade
falante, nenhum emoji na interface de operação.

**Emoção alvo:** calma sob pressão. O operador deve sentir que a ferramenta
está sob controle antes mesmo de clicar.

## Anti-references

- **Console skeumórfico.** Faders desenhados, knobs, texturas de metal
  escovado, LEDs falsos. Equipamento de verdade é assim porque é físico;
  imitá-lo em tela é fantasia, não função.
- **Terminal verde-neon / estética hacker.** Monoespaçado em tudo, verde
  fosforescente sobre preto, scanlines. É o reflexo óbvio para "app técnico no
  escuro" e não ajuda ninguém a achar um botão mais rápido.
- **Grade de pads coloridos (Launchpad/MPC).** Cor como identidade de cada
  botão satura a tela e destrói o único sinal que importa de verdade: o que
  está tocando AGORA.
- **Dashboard de SaaS.** Cards iguais em grade, métricas grandes decorativas,
  gráficos que ninguém consultou. Aqui não há nada para analisar.
- **Confirmações modais no caminho da operação.** "Tem certeza?" no meio de uma
  peça é pior que o erro que tenta evitar.

## Design Principles

1. **A cor é o som.** A tela em repouso é neutra e sem cor alguma. Cor só
   aparece onde há áudio saindo pelas caixas naquele instante. Olhar a tela de
   relance e ver cor significa "tem som no ar" — sem ler uma palavra.
2. **Nada destrutivo perto do dedo que opera.** Editar, renomear e excluir
   vivem em um modo separado do modo de disparo. Durante a peça, o único botão
   perigoso na tela é o que interrompe o som — e ele é perigoso de propósito.
3. **Legível de relance, não de leitura.** Cada cue é lido em menos de um
   segundo, com o olhar vindo do palco. Alvo grande, rótulo grande, separação
   generosa, contraste alto. Densidade é inimiga aqui.
4. **Pronto antes do primeiro clique.** Latência não se otimiza durante a peça,
   se elimina antes dela. Todo áudio é carregado e decodificado na abertura, e
   a interface declara abertamente o que está armado e o que falhou.
5. **O estado nunca é adivinhado.** O que está tocando, há quanto tempo, quanto
   falta e em que volume está sempre visível sem nenhuma interação. O operador
   nunca precisa clicar para descobrir o que o sistema está fazendo.

## Accessibility & Inclusion

- WCAG AA como piso: corpo de texto ≥4.5:1, texto grande e bordas de controle
  ≥3:1 contra seu fundo. Placeholder segue a mesma régua do corpo.
- Cor nunca é o único portador de informação. "Tocando" carrega cor **e**
  movimento de progresso **e** rótulo textual. Falha carrega cor **e** ícone
  **e** texto.
- Todo alvo de disparo tem no mínimo 44×44px; no modo de operação, muito mais.
- Foco de teclado sempre visível, em branco de alto contraste — nunca na mesma
  cor do estado "tocando", para os dois nunca se confundirem.
- `prefers-reduced-motion` respeitado: as transições viram corte seco. A barra
  de progresso permanece, porque é dado e não decoração.
- Nenhum requisito específico declarado pelo operador; as regras acima são o
  piso da casa.
