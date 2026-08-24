/**
 * Do repositório ao instalador, num comando.
 *
 * São quatro coisas em sequência, e a ordem entre elas não é livre: a
 * interface precisa estar compilada antes de o PyInstaller rodar, porque ela
 * viaja *dentro* do executável do servidor; e o executável do servidor precisa
 * existir antes do electron-builder, porque ele viaja dentro do instalador.
 * Uma boneca russa, montada de dentro para fora.
 *
 *   1. `frontend/` compila em modo `desktop` — mesma origem, sem CORS
 *   2. o resultado é copiado para `backend/spa/`
 *   3. o PyInstaller congela `backend/` num `.exe` sem Python instalado
 *   4. o electron-builder embrulha tudo num instalador do Windows
 *
 * Rode com `node desktop/scripts/build.mjs`.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..', '..')
const FRONTEND = path.join(RAIZ, 'frontend')
const BACKEND = path.join(RAIZ, 'backend')
const DESKTOP = path.join(RAIZ, 'desktop')

const SPA = path.join(BACKEND, 'spa')
const SERVIDOR = path.join(BACKEND, 'dist', 'sounddeck-server')

let passo = 0

function anunciar(texto) {
  passo += 1
  console.log(`\n[1m[${passo}/5] ${texto}[0m`)
}

/** Roda um comando e explode se ele falhar — sem seguir para o passo seguinte. */
function rodar(comando, argumentos, opcoes = {}) {
  // O `npm` e o `npx` do Windows são `.cmd`: sem shell, o `spawn` não os
  // encontra. O Python vem daqui com caminho absoluto, e aí o shell é o
  // problema, não a solução — o `cmd.exe` corta o caminho no primeiro espaço,
  // e este repositório mora numa pasta chamada "GABRIEL DOCUMENTOS".
  const precisaDeShell = process.platform === 'win32' && !path.isAbsolute(comando)

  return new Promise((resolve, reject) => {
    const processo = spawn(comando, argumentos, {
      stdio: 'inherit',
      shell: precisaDeShell,
      ...opcoes,
    })
    processo.on('error', reject)
    processo.on('exit', (codigo) =>
      codigo === 0
        ? resolve()
        : reject(new Error(`${comando} ${argumentos.join(' ')} terminou com código ${codigo}`)),
    )
  })
}

/** O Python do ambiente virtual do backend, se ele existir; senão o do sistema. */
function python() {
  const venv = path.join(BACKEND, '.venv', 'Scripts', 'python.exe')
  return existsSync(venv) ? venv : 'python'
}

async function conferirDependencias() {
  anunciar('Conferindo o que precisa estar instalado')

  const exe = python()
  await rodar(exe, ['-c', 'import waitress, PyInstaller'], { cwd: BACKEND }).catch(() => {
    throw new Error(
      'faltam o waitress e/ou o PyInstaller no ambiente do backend.\n' +
        `Instale com:\n\n    ${path.relative(RAIZ, exe)} -m pip install -r backend/requirements-desktop.txt\n`,
    )
  })

  if (!existsSync(path.join(FRONTEND, 'node_modules'))) {
    throw new Error('frontend/node_modules não existe — rode `npm install` em frontend/.')
  }
  if (!existsSync(path.join(DESKTOP, 'node_modules'))) {
    throw new Error('desktop/node_modules não existe — rode `npm install` em desktop/.')
  }
  console.log('ok')
}

async function compilarInterface() {
  anunciar('Compilando a interface (modo desktop)')
  await rodar('npm', ['run', 'build:desktop'], { cwd: FRONTEND })

  // Recriada do zero: um arquivo com hash antigo que sobrevivesse aqui entraria
  // no pacote como peso morto, e num `index.html` que não o referencia mais.
  await rm(SPA, { recursive: true, force: true })
  await mkdir(SPA, { recursive: true })
  await cp(path.join(FRONTEND, 'dist'), SPA, { recursive: true })
  console.log(`interface copiada para ${path.relative(RAIZ, SPA)}`)
}

async function congelarServidor() {
  anunciar('Congelando o servidor com o PyInstaller')
  await rm(path.join(BACKEND, 'dist'), { recursive: true, force: true })
  await rodar(
    python(),
    ['-m', 'PyInstaller', 'sounddeck.spec', '--noconfirm', '--clean', '--log-level', 'WARN'],
    { cwd: BACKEND },
  )
  if (!existsSync(path.join(SERVIDOR, 'sounddeck-server.exe'))) {
    throw new Error('o PyInstaller terminou sem produzir sounddeck-server.exe')
  }
  console.log(`servidor em ${path.relative(RAIZ, SERVIDOR)}`)
}

async function desenharIcone() {
  anunciar('Desenhando o ícone a partir do favicon.svg')
  await rodar('npx', ['electron', 'scripts/make-icon.mjs'], { cwd: DESKTOP })
}

async function empacotar() {
  anunciar('Montando o instalador')
  await rodar('npx', ['electron-builder', '--win', '--x64'], { cwd: DESKTOP })
  console.log(`\ninstalador em ${path.relative(RAIZ, path.join(DESKTOP, 'release'))}`)
}

try {
  await conferirDependencias()
  await compilarInterface()
  await congelarServidor()
  await desenharIcone()
  await empacotar()
  console.log('\n[32mPronto.[0m')
} catch (erro) {
  console.error(`\n[31m${erro.message}[0m`)
  process.exit(1)
}
