-- Live layer: current quote per ticker (replaces public/live/prices.json) and
-- ingestion observability (the old update-prices.mjs kept zero run history).

CREATE TABLE live_quotes (
  ticker     TEXT PRIMARY KEY,
  price      NUMERIC(12,4) NOT NULL,
  quote_date DATE NOT NULL,
  source     TEXT NOT NULL DEFAULT 'yahoo_finance_chart_v8',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ingestion_runs (
  id                BIGSERIAL PRIMARY KEY,
  started_at        TIMESTAMPTZ NOT NULL,
  finished_at       TIMESTAMPTZ,
  tickers_attempted INT,
  tickers_succeeded INT,
  tickers_failed    INT,
  breaker_state     TEXT,
  failed_tickers    JSONB
);
