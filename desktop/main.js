/**
 * O SoundDeck como aplicativo de mesa.
 *
 * Este arquivo é só a coxia: ele acende o servidor Django empacotado, espera
 * a API responder de verdade e só então abre a janela. Nada da interface está
 * aqui — o deck continua sendo o mesmo React servido pelo mesmo Django, e é
 * exatamente por isso que ele quase não mudou para virar um `.exe`.
 *
 * A ordem importa. Abrir a janela antes de o servidor responder mostraria o
 * "o servidor local não respondeu" de `apiRepo.ts` como primeira impressão do
 * aplicativo, num erro que se resolveria sozinho meio segundo depois.
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const { spawn } = require('node:child_process')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')

/** Quantas portas tentar antes de desistir, se a sorteada estiver ocupada. */
const TENTATIVAS = 4

/**
 * Teto para o servidor subir. Generoso de propósito: na primeira abertura o
 * antivírus do Windows lê o executável inteiro antes de deixá-lo rodar.
 */
const ESPERA_MAXIMA_MS = 60_000

/** Código com que `server.py` avisa que a porta foi tomada. */
const PORTA_OCUPADA = 3

let servidor = null
let janela = null
let encerrando = false

/**
 * A pasta do operador: o banco, os áudios e o log.
 *
 * `%LOCALAPPDATA%` e não `Documentos` por um motivo específico: no Windows 11
 * a pasta Documentos costuma estar redirecionada para o OneDrive, e um SQLite
 * sendo sincronizado enquanto o deck escreve nele é a receita do "database is
 * locked" — no meio da peça, que é justamente quando o deck escreve.
 */
function pastaDeDados() {
  const local = process.env.LOCALAPPDATA
  return local ? path.join(local, 'SoundDeck') : app.getPath('userData')
}

/** O executável do servidor: dentro do pacote, ou na saída do PyInstaller. */
function caminhoDoServidor() {
  const nome = 'sounddeck-server.exe'
  return app.isPackaged
    ? path.join(process.resourcesPath, 'server', nome)
    : path.join(__dirname, '..', 'backend', 'dist', 'sounddeck-server', nome)
}

/** Pede uma porta ao sistema e devolve a que ele deu. */
function portaLivre() {
  return new Promise((resolve, reject) => {
    const tomada = net.createServer()
    tomada.unref()
    tomada.on('error', reject)
    tomada.listen(0, '127.0.0.1', () => {
      const { port } = tomada.address()
      tomada.close(() => resolve(port))
    })
  })
}

/**
 * Sobe o servidor e resolve quando a API responder.
 *
 * A sondagem é em `/api/deck/`, e não numa rota de saúde inventada: é a
 * primeira coisa que o deck pede ao carregar. Se ela responde, o Django subiu,
 * a migração passou e o banco abriu — os três de uma vez, sem fingir.
 */
function acender(porta) {
  return new Promise((resolve) => {
    const processo = spawn(caminhoDoServidor(), [], {
      // `stdin` é o cano que `server.py` vigia: quando este processo morre, o
      // Windows fecha a ponta de lá e o servidor se encerra sozinho. É o que
      // impede um servidor órfão de segurar o banco depois de um fechamento
      // à força.
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
      env: {
        ...process.env,
        SOUNDDECK_PORT: String(porta),
        SOUNDDECK_DATA: pastaDeDados(),
      },
    })

    let respondido = false
    const responder = (resultado) => {
      if (respondido) return
      respondido = true
      resolve(resultado)
    }

    processo.on('error', (erro) => responder({ ok: false, erro }))
    processo.on('exit', (codigo) => responder({ ok: false, codigo }))

    const limite = Date.now() + ESPERA_MAXIMA_MS
    const sondar = () => {
      if (respondido) return
      if (Date.now() > limite) {
        return responder({ ok: false, erro: new Error('o servidor não respondeu a tempo') })
      }
      const pedido = http.get(
        { host: '127.0.0.1', port: porta, path: '/api/deck/', timeout: 2000 },
        (resposta) => {
          resposta.resume()
          if (resposta.statusCode === 200) responder({ ok: true, processo })
          else setTimeout(sondar, 150)
        },
      )
      pedido.on('timeout', () => pedido.destroy())
      pedido.on('error', () => setTimeout(sondar, 150))
    }
    sondar()
  })
}

/** Tenta portas até uma pegar; devolve a porta viva ou a última falha. */
async function subirServidor() {
  let ultima = null
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa += 1) {
    const porta = await portaLivre()
    const resultado = await acender(porta)
    if (resultado.ok) {
      servidor = resultado.processo
      vigiarServidor()
      return { porta }
    }
    ultima = resultado
    // Porta tomada entre o sorteio e o `bind` vale outra tentativa; qualquer
    // outra falha vai se repetir igual, e insistir só atrasa o aviso.
    if (resultado.codigo !== PORTA_OCUPADA) break
  }
  return { falha: ultima }
}

/** Se o servidor cair com a peça em andamento, isso precisa ser dito. */
function vigiarServidor() {
  servidor.on('exit', () => {
    servidor = null
    if (encerrando) return
    dialog.showErrorBox(
      'O servidor do SoundDeck parou',
      'O deck perdeu contato com o servidor e precisa ser reaberto.\n\n' +
        `O motivo costuma estar em:\n${path.join(pastaDeDados(), 'servidor.log')}`,
    )
    app.quit()
  })
}

function abrirJanela(porta) {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    // A mesma cor do `<meta name="theme-color">` do deck, para a janela não
    // dar um flash branco entre aparecer e a página pintar.
    backgroundColor: '#0e0e0e',
    show: false,
    autoHideMenuBar: true,
    title: 'SoundDeck',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      // O deck fica em segundo plano toda vez que o operador olha outra coisa
      // — e continua tocando. Com o estrangulamento padrão do Chromium os
      // temporizadores de uma janela escondida caem para uma batida por
      // segundo, e a barra do cue que está no ar começa a mentir.
      backgroundThrottling: false,
    },
  })

  Menu.setApplicationMenu(null)
  janela.once('ready-to-show', () => janela.show())
  janela.on('closed', () => {
    janela = null
  })

  // Sem menu não existem `Ctrl+R` nem `Ctrl+W` — e isso é metade do motivo de
  // não haver menu: recarregar a página por engano no meio da peça derruba
  // tudo que está tocando. O que sobra são duas teclas que o deck não usa.
  janela.webContents.on('before-input-event', (evento, entrada) => {
    if (entrada.type !== 'keyDown') return
    if (entrada.key === 'F11') {
      evento.preventDefault()
      janela.setFullScreen(!janela.isFullScreen())
    } else if (entrada.key === 'F12') {
      evento.preventDefault()
      janela.webContents.toggleDevTools()
    }
  })

  // Um link para fora abre no navegador do sistema; a janela do deck é do deck.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  janela.webContents.on('will-navigate', (evento, url) => {
    if (new URL(url).port !== String(porta)) {
      evento.preventDefault()
      shell.openExternal(url)
    }
  })

  janela.loadURL(`http://127.0.0.1:${porta}/`)
}

function descreverFalha(falha) {
  if (!falha) return 'O servidor não subiu.'
  if (falha.erro) return falha.erro.message
  return `O servidor encerrou com código ${falha.codigo}.`
}

// Duas cópias do deck na mesma máquina seriam dois servidores no mesmo banco.
// A segunda apenas traz a primeira para a frente.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!janela) return
    if (janela.isMinimized()) janela.restore()
    janela.focus()
  })

  app.setAppUserModelId('com.sounddeck.deck')
  // Disparar um cue já é um gesto do operador, mas o Chromium só conta gestos
  // feitos dentro da própria página — e o primeiro som de um deck que abre
  // tocando ficaria mudo sem isto.
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

  app.whenReady().then(async () => {
    const { porta, falha } = await subirServidor()
    if (!porta) {
      dialog.showErrorBox(
        'O SoundDeck não conseguiu abrir',
        `${descreverFalha(falha)}\n\n` +
          `O que aconteceu costuma estar em:\n${path.join(pastaDeDados(), 'servidor.log')}`,
      )
      return app.quit()
    }
    abrirJanela(porta)
  })

  // O único pedido que a página faz ao Electron. Ela o faz depois de receber
  // um espetáculo importado, que só entra com o banco fechado.
  ipcMain.on('sounddeck:reabrir', () => {
    encerrando = true
    if (servidor) servidor.kill()
    // A instância nova nasce antes de esta terminar de morrer, e a trava de
    // cópia única a mandaria embora na porta. Soltá-la aqui é o que faz o
    // "Reabrir agora" reabrir de fato, em vez de só fechar.
    app.releaseSingleInstanceLock()
    app.relaunch()
    app.exit(0)
  })

  app.on('window-all-closed', () => app.quit())

  app.on('before-quit', () => {
    encerrando = true
    if (servidor) servidor.kill()
  })
}
