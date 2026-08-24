/**
 * Guarda os arquivos enviados pelo operador no modo mock.
 *
 * `localStorage` só guarda texto, e um áudio enviado precisa sobreviver ao
 * recarregamento — senão a biblioteca do mock vira uma lista de nomes mortos.
 * IndexedDB guarda o `Blob` de verdade; o repositório resolve para object URL
 * no `load()`.
 */

const DB = 'sounddeck'
const STORE = 'blobs'

let handle: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!handle) {
    handle = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponível'))
    })
  }
  return handle
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('falha no IndexedDB'))
      }),
  )
}

export const blobs = {
  put: (key: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, key)),
  get: (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key)),
  remove: (key: string) => tx('readwrite', (s) => s.delete(key)),
}
