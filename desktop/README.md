# SoundDeck — aplicativo de mesa

O mesmo deck, empacotado num instalador do Windows. Quem recebe não instala
Python, não instala Node, não instala Docker e não abre terminal: baixa um
`.exe`, instala, e clica no ícone.

Nada da interface mudou para isso acontecer. O que existe aqui é uma coxia.

## Como está montado

Três camadas, uma dentro da outra:

```
SoundDeck-0.1.0-instalador.exe      ← o que você manda para os amigos
└── SoundDeck.exe                   ← Electron: acende o servidor, abre a janela
    └── resources/server/           ← Django congelado pelo PyInstaller
        └── _internal/spa/          ← a interface React já compilada
```

O Electron não desenha nada. Ele sorteia uma porta livre, sobe o
`sounddeck-server.exe`, espera `/api/deck/` responder de verdade e só então
abre uma janela apontada para `http://127.0.0.1:<porta>/`.

**Uma porta serve as duas coisas.** O Django passou a servir também a interface
compilada (`deck/spa.py`), e isso é o que faz o arranjo ser simples: mesma
origem, nenhum CORS para negociar, e o `Range` de `deck/media.py` valendo para
o `<audio>` como se o arquivo fosse da própria página. Uma faixa de quatro
minutos continua sendo buscada por trecho, e não baixada inteira a cada
disparo.

Em desenvolvimento nada disso vale: continuam sendo o Vite em 5173 e o Django
em 8000, como sempre foram. `backend/spa/` só existe depois do build, e sem ela
o curinga de rota responde 501 explicando onde o deck está.

## Onde ficam os dados do operador

`%LOCALAPPDATA%\SoundDeck` — o banco, os áudios enviados e o log da última
subida:

```
sounddeck.sqlite3     o roteiro inteiro: peças, dias, cenas, cues
media\audio\          os arquivos de áudio, com o nome de origem
entrada\              largue arquivos aqui — veja a seção seguinte
anterior\             o deck que uma importação substituiu
chave-secreta         gerada na primeira abertura, uma por instalação
servidor.log          a última subida do servidor, e o motivo se ela falhou
```

Fazer backup do deck é copiar essa pasta. Levar para outra máquina, também.

Não é `Documentos` de propósito: no Windows 11 essa pasta costuma estar
redirecionada para o OneDrive, e um SQLite sendo sincronizado enquanto o deck
escreve nele é exatamente o "database is locked" que aparece no meio da peça.

Desinstalar **não** apaga a pasta. Os áudios de quem operou são dele.

## A pasta de entrada

`%LOCALAPPDATA%\SoundDeck\entrada\` é a porta de serviço do deck. O que for
largado ali entra **na próxima abertura do programa**:

- **arquivos de áudio** (`.wav .mp3 .ogg .m4a .flac .aac`) viram itens da
  biblioteca, com o nome do arquivo como nome do áudio
- **um `.sounddeck`** substitui o espetáculo inteiro

Serve para começar. A biblioteca já recebe áudio pelo botão, um a um, e isso é
o certo para acrescentar uma faixa no meio da montagem — não para os trinta
arquivos da trilha de um espetáculo, que ninguém quer enviar clicando trinta
vezes.

Na abertura, e não no instante em que o arquivo aparece: um vigia de pasta
teria de adivinhar quando a cópia terminou, e um MP3 lido pela metade entra na
biblioteca com duração errada e som cortado.

Depois de entrar, os arquivos vão para `entrada\ja-importados\`. Não são
apagados — quem largou ali pode ter largado a única cópia que tinha. A pasta se
recria sozinha, com um `LEIA-ME.txt` dentro que repete tudo isto.

## Mandar um espetáculo pronto para alguém

Quem monta e quem opera raramente são a mesma pessoa. Um **`.sounddeck`** é o
espetáculo fechado numa mala — o banco e os áudios juntos, num zip — e existe
para atravessar essa distância.

Exportar é um botão: modo **Montar**, faixa de baixo, **Exportar espetáculo**.
Sai um arquivo com o nome da peça e a data. Do outro lado há três formas de ele
entrar, e as três aplicam o mesmo arquivo:

**1. Pelo programa.** Ela clica em **Trazer espetáculo**, escolhe o arquivo, e
o SoundDeck avisa que ele entra na reabertura — com um botão que reabre na
hora. É o caminho para mandar uma versão nova a quem já tem o programa
instalado: alguns megabytes por Drive ou WhatsApp, em vez de um instalador
inteiro.

**2. Pela pasta de entrada.** Largar o `.sounddeck` em `entrada\` e abrir o
programa faz o mesmo. Útil quando o arquivo chegou por pendrive.

**3. Dentro do instalador.** Copie o `.sounddeck` para
`desktop\espetaculo.sounddeck` e construa. Ele viaja dentro do executável e é
aplicado **uma única vez, na primeira abertura** — quem instala já abre o
programa com o roteiro e os áudios no lugar, sem clicar em nada. É o caminho
para o primeiro envio, a quem nunca viu o programa.

Sem esse arquivo, o instalador nasce vazio, com a tela de primeiro uso. Ele é
opcional e não está versionado.

> **Importar substitui o deck inteiro.** O anterior não é apagado — vai para a
> pasta `anterior\` —, mas é um nível só de desfazer, e recuperá-lo de lá é
> trabalho manual. Se ela já tiver ajustado coisas, o ajuste se perde. Para
> trabalhar a quatro mãos, o caminho é ela exportar e devolver.

## Construir o instalador

Uma vez, para preparar a máquina:

```powershell
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-desktop.txt
npm install --prefix frontend
npm install --prefix desktop
```

Depois, sempre que quiser gerar uma versão nova:

```powershell
node desktop\scripts\build.mjs
```

Sai em `desktop\release\SoundDeck-<versão>-instalador.exe`, com uns 130 MB.

São cinco passos, e a ordem entre eles não é livre — é uma boneca russa montada
de dentro para fora:

1. confere que o waitress, o PyInstaller e os `node_modules` estão no lugar
2. compila o frontend em modo `desktop` e copia para `backend\spa\`
3. o PyInstaller congela o backend (com a interface dentro) em `backend\dist\`
4. desenha `build\icon.ico` a partir de `frontend\public\favicon.svg`
5. o electron-builder embrulha tudo no instalador

O passo 4 abre uma janelinha preta de 256 pixels por um segundo. É o Chromium
rasterizando o ícone; pode ignorar.

Para lançar uma versão nova, mude `version` em `desktop\package.json` antes de
rodar.

### Testar sem gerar o instalador

```powershell
npm start --prefix desktop
```

Roda o Electron sobre o servidor congelado que estiver em `backend\dist\` — ou
seja, o passo 3 precisa ter rodado pelo menos uma vez.

## O que o instalador faz na máquina de quem recebe

Instala em `%LOCALAPPDATA%\Programs\SoundDeck`, **sem pedir senha de
administrador**, com atalho na área de trabalho e no menu iniciar. A pasta de
instalação é escolhível. O desinstalador aparece em "Aplicativos instalados".

### O aviso do Windows

Na primeira vez, o SmartScreen vai dizer que "o Windows protegeu o computador"
e esconder o botão de instalar atrás de **Mais informações → Executar assim
mesmo**. Isso acontece com todo executável sem assinatura digital, e assinar
custa um certificado pago por ano. Vale avisar seus amigos antes, senão metade
deles vai desistir na tela do aviso achando que é vírus.

## Detalhes que não são óbvios

**O bilhete de abertura aparece toda vez.** `BemVindo.tsx` ensina dois botões
— `Operar`/`Montar` e `Trocar` — e sai da frente. É para quem recebeu o
programa pronto sem nunca ter visto um: são os dois controles que mudam a
tela inteira, e os dois parecem decoração até alguém dizer que não são. Toda
vez, e não só na primeira, porque quem opera um espetáculo por mês não é
quem abriu o programa ontem.

**Sem menu, e de propósito.** O menu padrão do Electron traz `Ctrl+R` e
`Ctrl+W`. Recarregar a página por engano no meio da peça derruba tudo que está
tocando. Sobraram `F11` (tela cheia) e `F12` (ferramentas de desenvolvedor),
que o deck não usa.

**O servidor não fica órfão.** O `stdin` do processo do servidor é um cano
vindo do Electron. Se o Electron for encerrado à força, o Windows fecha a outra
ponta, o `server.py` percebe e se encerra — em vez de ficar invisível segurando
o banco e fazendo a próxima abertura falhar sem explicação.

**Uma cópia por vez.** Duas janelas seriam dois servidores no mesmo banco. A
segunda abertura apenas traz a primeira para a frente.

**Os temporizadores não são estrangulados.** `backgroundThrottling: false` — o
Chromium reduz temporizadores de janela em segundo plano para uma batida por
segundo, e o deck fica em segundo plano toda vez que o operador olha outra
coisa. Sem isso a barra do cue que está no ar começaria a mentir.

## Mapa

```
main.js                 o Electron: porta, servidor, janela, encerramento
preload.js              a única ponte para a página: reabrir o programa
scripts/build.mjs       os cinco passos, em ordem
scripts/make-icon.mjs   favicon.svg → icon.ico, rasterizado pelo Chromium
package.json            dependências e a configuração do electron-builder
espetaculo.sounddeck    opcional: o espetáculo que viaja no instalador
```

Do outro lado do repositório, o que existe só por causa daqui:

```
backend/server.py                 o servidor congelado: log, dados, migrate, waitress
backend/sounddeck.spec            a receita do PyInstaller
backend/deck/spa.py               o Django servindo a interface compilada
backend/deck/pacote.py            o formato .sounddeck: montar e aplicar
backend/deck/entrada.py           a pasta de entrada
backend/requirements-desktop.txt  waitress e PyInstaller
frontend/.env.desktop             VITE_DATA=api e VITE_API_URL vazio
frontend/src/components/BemVindo.tsx    o bilhete de abertura
frontend/src/components/PacoteBar.tsx   exportar e trazer espetáculo
```
