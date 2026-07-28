import { apiFetch } from './api.js'

export const QUEUE_KEY = 'inis_sync_queue'

let flushing = false

export function enqueue(item) {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  q.push(item)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function getQueueLength() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length
  } catch {
    return 0
  }
}

// Returns number of items remaining in queue after flush attempt
export async function flushQueue() {
  if (flushing) return getQueueLength()
  flushing = true
  try {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    if (!q.length) return 0
    let i = 0
    for (; i < q.length; i++) {
      const item = q[i]
      const type = item.type ?? 'confronto'
      try {
        if (type === 'confronto') {
          let pId = item.partida_id
          if (!pId) {
            const r = await apiFetch('/partidas', {
              method: 'POST',
              body: JSON.stringify({ data: item.data, is_test: item.is_test })
            })
            if (!r.ok) throw new Error()
            pId = (await r.json()).id
          }
          const rc = await apiFetch('/partidas/confrontos', {
            method: 'POST',
            body: JSON.stringify({ fk_partida: pId, ...item.confronto })
          })
          if (!rc.ok) throw new Error()
          const { id: confrontoId } = await rc.json()
          const jr = await apiFetch(`/partidas/confrontos/${confrontoId}/jogadores`, {
            method: 'POST',
            body: JSON.stringify(item.jogadores)
          })
          if (!jr.ok) throw new Error()

        } else if (type === 'jogador_update') {
          const r = await apiFetch(`/jogadores/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify(item.data)
          })
          if (!r.ok) throw new Error()

        } else if (type === 'jogador_delete') {
          const r = await apiFetch(`/jogadores/${item.id}`, { method: 'DELETE' })
          if (!r.ok && r.status !== 404) throw new Error()
        }
      } catch {
        break
      }
    }
    const remaining = q.slice(i)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
    return remaining.length
  } finally {
    flushing = false
  }
}
