-- Schema do InimigoScore (Neon/PostgreSQL)
-- Reconstituído a partir do uso real no código (api/[...slug].js e backend/src/*).
-- Idempotente: seguro rodar contra o banco existente (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS jogadores (
  id        SERIAL PRIMARY KEY,
  nome      TEXT NOT NULL,
  posicao   TEXT NOT NULL CHECK (posicao IN ('GOL', 'ATA', 'MEI', 'DEF')),
  firepower INTEGER NOT NULL DEFAULT 60 CHECK (firepower BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS partidas (
  id      SERIAL PRIMARY KEY,
  data    DATE NOT NULL,
  is_test BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS confrontos (
  id          SERIAL PRIMARY KEY,
  fk_partida  INTEGER NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  sequencia   INTEGER,
  placar_a    INTEGER NOT NULL DEFAULT 0,
  placar_b    INTEGER NOT NULL DEFAULT 0,
  resultado   TEXT CHECK (resultado IN ('A', 'B', 'EMPATE')),
  nome_time_a TEXT,
  nome_time_b TEXT
);

CREATE TABLE IF NOT EXISTS jogadores_confronto (
  id            SERIAL PRIMARY KEY,
  fk_confronto  INTEGER NOT NULL REFERENCES confrontos(id) ON DELETE CASCADE,
  fk_jogador    INTEGER NOT NULL REFERENCES jogadores(id) ON DELETE CASCADE,
  time          TEXT NOT NULL CHECK (time IN ('A', 'B')),
  gols          INTEGER NOT NULL DEFAULT 0,
  assistencias  INTEGER NOT NULL DEFAULT 0,
  falhas        INTEGER NOT NULL DEFAULT 0,
  desarmes      INTEGER NOT NULL DEFAULT 0,
  dribles       INTEGER NOT NULL DEFAULT 0,
  faltas        INTEGER NOT NULL DEFAULT 0,
  amarelos      INTEGER NOT NULL DEFAULT 0,
  vermelhos     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_confrontos_fk_partida        ON confrontos(fk_partida);
CREATE INDEX IF NOT EXISTS idx_jogadores_confronto_confronto ON jogadores_confronto(fk_confronto);
CREATE INDEX IF NOT EXISTS idx_jogadores_confronto_jogador   ON jogadores_confronto(fk_jogador);

-- Linha única usada para sincronizar o sorteio ativo entre dispositivos.
-- (já criada automaticamente pelo handler em runtime; replicada aqui por completude)
CREATE TABLE IF NOT EXISTS sorteio_atual (
  id             SMALLINT PRIMARY KEY DEFAULT 1,
  times          JSONB,
  goleiros       JSONB,
  atualizado_em  TIMESTAMPTZ DEFAULT NOW()
);
