/**
 * A única coisa que a página pode pedir ao Electron: reabrir o programa.
 *
 * Existe por causa da importação. Um espetáculo que chega num `.sounddeck` só
 * entra na próxima abertura — trocar o arquivo do banco com o servidor lendo
 * dele não é seguro —, e sem esta ponte o produto teria de pedir a alguém que
 * acabou de receber o programa que o feche e o abra na mão.
 *
 * A superfície é deliberadamente do tamanho de um botão. `contextIsolation`
 * está ligado, então a página não alcança o Node; o que ela alcança é isto, e
 * isto não recebe argumento nenhum — não há o que forjar do outro lado.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sounddeck', {
  reabrir: () => ipcRenderer.send('sounddeck:reabrir'),
})
