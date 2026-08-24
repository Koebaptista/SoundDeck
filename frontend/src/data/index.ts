import type { Repo } from './repo'
import { mockRepo } from './mockRepo'
import { apiRepo } from './apiRepo'

/**
 * A troca de backend acontece aqui e em nenhum outro lugar.
 *
 * Com `VITE_DATA=api` o deck passa a falar com o Django; sem isso, roda no
 * mock. Nenhum componente importa `mockRepo` ou `apiRepo` diretamente.
 */
export const repo: Repo = import.meta.env.VITE_DATA === 'api' ? apiRepo : mockRepo

export const usingMock = repo === mockRepo

export type { Repo }
