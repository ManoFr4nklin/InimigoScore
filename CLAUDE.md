# InimigoScore — Contexto do Projeto para o Claude

## O que é isso
App PWA de pelada de futebol. Registra confrontos, calcula notas e firepower dos jogadores.
Stack: React (Vite) no frontend, Express + Neon PostgreSQL no backend, deploy na Vercel.

## Banco de dados (Neon PostgreSQL)
Connection string em variável de ambiente `DATABASE_URL`. Para scripts de manutenção avulsos
use a string direta (ela está em `backend/src/database/db.js` ou no painel Neon).
Tabelas principais: `jogadores`, `partidas`, `confrontos`, `jogadores_confronto`, `sorteio_atual`.

**Atenção**: scripts avulsos `.mjs` na raiz de `backend/` ficam no .gitignore — eles podem
conter a connection string hardcoded. Crie-os ali sem medo.

## Fórmulas importantes

### Nota do dia (por confronto, depois AVG)
```
nota = 6
  + gols*2
  + assistencias*1
  + desarmes * (DEF=0.5, MEI=0.4, ATA=0.3)
  + dribles  * (DEF=0.3, MEI=0.5, ATA=0.5)
  - falhas*0.3
  - faltas*0.5
  - amarelos*1
  - vermelhos*2
```
Clamp: `min(10, max(0, nota))`

### Firepower
Bayesian shrinkage C=1, delta assimétrico:
```js
notaAdj = (1 * 6.0 + n * notaBruta) / (1 + n)
delta   = notaAdj >= 6 ? round(diff * 2) : round(diff * 3)  // penalidade mais pesada
novoFP  = clamp(0, 100, fpAtual + delta)
```

## Arquitetura offline (PWA)
- `frontend/src/sync.js` — fila localStorage (`inis_sync_queue`), lock anti-concorrência
- Sorteio: fallback para `inis_jogadores_cache` quando offline
- Jogadores: escrita otimista + enqueue na falha, flush no evento `online`
- Resultados: tenta API → cache `inis_resultados_{data}` → reconstrói da fila
- Partida: `resetar()` faz `await flushQueue()` antes de navegar para Resultados

## Como rodar scripts de correção de banco
```bash
cd backend
node nome_do_script.mjs
```
Modelo de script em `backend/fix_stats.mjs` ou `backend/fix_fp.mjs` (veja no git stash
ou recrie: Pool do `pg`, connection string, query SQL, `client.release()`, `pool.end()`).

## Histórico de decisões relevantes

| Decisão | Motivo |
|---------|--------|
| Shrinkage C=1 (era C=3) | FP cai mais rápido para jogadores ruins |
| Delta negativo ×3 (era ×2) | Penalidade mais rígida por queda de performance |
| Dribles contam para DEF (0.3) | Usuário pediu explicitamente |
| Cache de resultados só quando `ranking.length > 0` | Evitar sobrescrever com lista vazia (race condition ao encerrar pelada) |
| `Partida` sempre montada (`display:none`) | Evitar perda de estado ao trocar de aba |

## Funcionalidade pendente (não implementada ainda)
- **Substituição de jogador no Sorteio**: o usuário pediu um botão ⇄ em cada jogador dos
  times sorteados para trocar por alguém da lista de presentes que não está em nenhum time.
  A proposta foi apresentada mas ainda não confirmada/implementada.

## Fluxo de uma pelada
1. **Jogadores** — cadastro e gestão de jogadores (CRUD)
2. **Sorteio** — seleciona presentes, sorteia times automaticamente, exibe FP ao lado dos nomes
3. **Partida** — registra confrontos (placar, gols, faltas etc.)
4. **Resultados** — exibe ranking do dia e ranking de times

## Última pelada registrada
- **2026-08-24** — 20 jogadores, 12 confrontos aprox.
- Correções aplicadas manualmente: +1A Abraão, +1A Gustavo, +1G Paulo
