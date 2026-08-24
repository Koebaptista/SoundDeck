/**
 * Gera `build/icon.ico` a partir de `frontend/public/favicon.svg`.
 *
 * O ícone da barra de tarefas e o do instalador precisam ser `.ico`, que é um
 * formato de bitmap em vários tamanhos — e o desenho da marca é um SVG. Falta
 * um rasterizador no meio, e a resposta óbvia seria mais uma dependência de
 * build.
 *
 * Mas o rasterizador já está instalado: é o Chromium do Electron, que este
 * projeto baixa de qualquer jeito. Este script roda *dentro* do Electron
 * (`electron scripts/make-icon.mjs`, não `node`), abre o SVG numa janela de
 * 256 pixels e fotografa. O `.ico` sai daqui montado à mão, que é meia dúzia
 * de campos: o formato aceita PNG embutido desde o Windows Vista.
 *
 * Derivar em vez de versionar um binário mantém a marca com uma origem só.
 * Mudou o `favicon.svg`, mudou o ícone do aplicativo.
 */

import { app, BrowserWindow, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..', '..')

const ORIGEM = path.join(RAIZ, 'frontend', 'public', 'favicon.svg')
const DESTINO = path.join(RAIZ, 'desktop', 'build', 'icon.ico')

/**
 * O relatório vai para arquivo, não para o terminal.
 *
 * No Windows o `electron.exe` é um binário de subsistema gráfico: ele não se
 * prende ao console que o chamou, e todo `console.log` daqui cai no vazio. Sem
 * isto, uma falha na geração seria um comando que termina em silêncio e não
 * produz nada — o pior jeito possível de descobrir um erro.
 */
const RELATORIO = path.join(RAIZ, 'desktop', 'build', 'icone.log')

/** O corpo da fonte do wordmark, para o "SD" sair com a letra certa. */
const INTER = path.join(
  RAIZ,
  'frontend',
  'node_modules',
  '@fontsource-variable',
  'inter',
  'files',
  'inter-latin-wght-normal.woff2',
)

/** O lado da captura. Acima disso o `.ico` não usa, e abaixo perde nitidez. */
const LADO = 256

/**
 * Os tamanhos que o Windows pede.
 *
 * 16 e 32 são a barra de tarefas e o Explorer em lista; 48 é o ícone médio;
 * 256 é o que o instalador e a visualização grande usam. Faltar um deles faz o
 * Windows reduzir outro na marra, e o resultado sai sujo justamente no tamanho
 * pequeno, que é onde a marca aparece o dia inteiro.
 */
const TAMANHOS = [256, 128, 64, 48, 32, 16]

/** Teto para cada etapa. Um build não pode ficar preso esperando um quadro. */
const PACIENCIA_MS = 20_000

/** A página que a janela carrega: o SVG a 256, e nada mais. */
function pagina(svg, fonte) {
  const face = fonte
    ? [
        '@font-face {',
        "  font-family: 'Inter';",
        '  font-weight: 100 900;',
        `  src: url('${pathToFileURL(fonte).href}') format('woff2');`,
        '}',
      ].join('\n')
    : ''

  return [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<style>',
    face,
    '  html, body { margin: 0; padding: 0; }',
    `  svg { display: block; width: ${LADO}px; height: ${LADO}px; }`,
    '</style>',
    svg,
  ].join('\n')
}

function comPaciencia(promessa, oQue) {
  return Promise.race([
    promessa,
    new Promise((_, rejeitar) =>
      setTimeout(
        () => rejeitar(new Error(`${oQue} não terminou em ${PACIENCIA_MS}ms`)),
        PACIENCIA_MS,
      ),
    ),
  ])
}

/**
 * Fotografa, e tenta de novo quando o compositor diz que não tem imagem.
 *
 * `UnknownVizError` é o Viz — o compositor do Chromium — respondendo que não
 * há quadro para entregar. Numa máquina ocupada, e logo depois de o
 * PyInstaller ter acabado de espremer a CPU, ele às vezes ainda não terminou
 * de se apresentar à janela recém-criada. Não é erro de programa: é pressa.
 *
 * Meio segundo entre as tentativas resolve, e falhar o build por causa disto
 * seria perder um instalador inteiro por um ícone.
 */
async function capturarInsistindo(janela, oQue, tentativas = 6) {
  let ultima
  for (let restantes = tentativas; restantes > 0; restantes -= 1) {
    try {
      const foto = await comPaciencia(janela.webContents.capturePage(), oQue)
      if (!foto.isEmpty()) return foto
      ultima = new Error(`${oQue} veio vazia`)
    } catch (erro) {
      ultima = erro
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw ultima
}

/**
 * Devolve a captura com o alfa que o desenho realmente tem.
 *
 * O caminho direto seria uma janela `transparent: true`, e ele não existe: o
 * compositor do Windows recusa capturar uma janela transparente e devolve
 * `UnknownVizError`. A janela precisa ser opaca — e uma janela opaca entrega
 * os cantos arredondados preenchidos com a cor do fundo, que é justamente o
 * que um ícone não pode ter.
 *
 * A saída é fotografar duas vezes, sobre branco e sobre preto, e resolver a
 * composição de trás para frente. Um pixel qualquer vale `C·a + F·(1-a)`, onde
 * `F` é o fundo. Sobre preto isso é `C·a`; sobre branco, `C·a + (1-a)`. A
 * diferença entre as duas é exatamente `1-a` — o alfa sai de graça, e sem
 * chute, inclusive na borda meio pintada dos cantos.
 *
 * E a foto sobre preto já é `C·a`, que é a cor pré-multiplicada pelo alfa: o
 * formato que o Skia usa internamente. Ela entra direto no bitmap de saída,
 * sem dividir nada.
 */
async function fotografarComAlfa(janela) {
  const sobre = async (cor) => {
    await janela.webContents.executeJavaScript(
      `document.documentElement.style.background = '${cor}'; true`,
    )
    // Dois quadros de espera, e não um: o primeiro é o que o navegador pode ter
    // agendado antes da troca de fundo, o segundo é o que já a contém.
    await janela.webContents.executeJavaScript(
      'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))',
    )
    return capturarInsistindo(janela, `a captura sobre ${cor}`)
  }

  const branca = await sobre('#ffffff')
  const preta = await sobre('#000000')

  const { width, height } = preta.getSize()
  const sobreBranco = branca.toBitmap()
  const sobrePreto = preta.toBitmap()
  const saida = Buffer.alloc(sobrePreto.length)

  for (let i = 0; i < saida.length; i += 4) {
    // Os três canais concordam em teoria; a média absorve o arredondamento de
    // cada um deles. O quarto byte das capturas é sempre opaco e se descarta.
    const diferenca =
      (sobreBranco[i] - sobrePreto[i] +
        (sobreBranco[i + 1] - sobrePreto[i + 1]) +
        (sobreBranco[i + 2] - sobrePreto[i + 2])) /
      3
    const alfa = Math.max(0, Math.min(255, Math.round(255 - diferenca)))

    saida[i] = sobrePreto[i]
    saida[i + 1] = sobrePreto[i + 1]
    saida[i + 2] = sobrePreto[i + 2]
    saida[i + 3] = alfa
  }

  return nativeImage.createFromBitmap(saida, { width, height })
}

/**
 * Monta o `.ico`: um cabeçalho, uma entrada por tamanho, e os PNGs no fim.
 *
 * O campo de largura e altura tem um byte só, então 256 não cabe — o formato
 * resolve isso escrevendo zero, que é lido como 256. É a única esquisitice
 * aqui; o resto é contar deslocamento.
 */
function montarIco(imagens) {
  const CABECALHO = 6
  const ENTRADA = 16

  const cabecalho = Buffer.alloc(CABECALHO)
  cabecalho.writeUInt16LE(0, 0) // reservado
  cabecalho.writeUInt16LE(1, 2) // 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4)

  let deslocamento = CABECALHO + ENTRADA * imagens.length
  const entradas = imagens.map(({ tamanho, png }) => {
    const entrada = Buffer.alloc(ENTRADA)
    const lado = tamanho >= 256 ? 0 : tamanho
    entrada.writeUInt8(lado, 0)
    entrada.writeUInt8(lado, 1)
    entrada.writeUInt8(0, 2) // cores na paleta: nenhuma, é RGBA
    entrada.writeUInt8(0, 3) // reservado
    entrada.writeUInt16LE(1, 4) // planos
    entrada.writeUInt16LE(32, 6) // bits por pixel
    entrada.writeUInt32LE(png.length, 8)
    entrada.writeUInt32LE(deslocamento, 12)
    deslocamento += png.length
    return entrada
  })

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.png)])
}

async function gerar() {
  const svg = await readFile(ORIGEM, 'utf8')
  const fonte = existsSync(INTER) ? INTER : null
  const aviso = fonte ? '' : 'Inter não encontrada: o "SD" saiu na fonte do sistema.\n'

  // Um arquivo em disco, e não uma `data:` URL, porque a `@font-face` precisa
  // apontar para um `file://` — e uma página `data:` não pode carregar um.
  const temporaria = path.join(tmpdir(), `sounddeck-icone-${process.pid}`)
  await mkdir(temporaria, { recursive: true })
  const html = path.join(temporaria, 'icone.html')
  await writeFile(html, pagina(svg, fonte), 'utf8')

  // Visível, na tela, e por isso mesmo ela pisca por um segundo durante o
  // build. É o preço de uma captura que funciona.
  //
  // As duas alternativas foram tentadas e as duas falham no mesmo ponto. Uma
  // janela `show: false` pode nunca receber um quadro do compositor; uma
  // janela posicionada fora de todos os monitores o Windows simplesmente não
  // compõe. Nos dois casos `capturePage` responde `UnknownVizError`, que é o
  // compositor dizendo que não existe imagem para entregar.
  const janela = new BrowserWindow({
    width: LADO,
    height: LADO,
    useContentSize: true,
    show: true,
    frame: false,
    skipTaskbar: true,
    title: 'gerando o ícone do SoundDeck',
  })

  try {
    await comPaciencia(janela.loadFile(html), 'o carregamento da página')
    // A fonte chega depois do documento, e fotografar antes dela entregaria o
    // "SD" na letra de reserva.
    await comPaciencia(
      janela.webContents.executeJavaScript('document.fonts.ready.then(() => true)'),
      'o carregamento da fonte',
    )

    const foto = await fotografarComAlfa(janela)
    if (foto.isEmpty()) throw new Error('a captura veio vazia — o Chromium não pintou a janela')

    const imagens = TAMANHOS.map((tamanho) => ({
      tamanho,
      png: foto.resize({ width: tamanho, height: tamanho, quality: 'best' }).toPNG(),
    }))

    await mkdir(path.dirname(DESTINO), { recursive: true })
    await writeFile(DESTINO, montarIco(imagens))

    const { width } = foto.getSize()
    return `${aviso}icon.ico gerado de uma captura de ${width}px: ${TAMANHOS.join(', ')} px`
  } finally {
    janela.destroy()
    await rm(temporaria, { recursive: true, force: true })
  }
}

async function relatar(texto) {
  await mkdir(path.dirname(RELATORIO), { recursive: true })
  await writeFile(RELATORIO, `${texto}\n`, 'utf8')
}

// Destruir a janela da captura dispara `window-all-closed`, e o padrão do
// Electron é encerrar o processo ali mesmo — antes de o relatório ser escrito.
// O manipulador vazio existe só para tirar esse padrão do caminho.
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  try {
    await relatar(await gerar())
    app.exit(0)
  } catch (erro) {
    await relatar(String(erro?.stack ?? erro))
    app.exit(1)
  }
})
