-- Core fund model: seasons, checkpoints, participants, picks, prices, benchmarks, cohorts.

CREATE TABLE seasons (
  id         SERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  fiscal     TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL
);

CREATE TABLE checkpoints (
  id              SERIAL PRIMARY KEY,
  season_id       INT NOT NULL REFERENCES seasons(id),
  seq_no          SMALLINT NOT NULL,
  checkpoint_date DATE NOT NULL,
  UNIQUE (season_id, seq_no)
);

-- Identity = full_name; the source JSON has no participant ids and names drift
-- between seasons ("Karen"/"Karin Korchinski"). seed_from_json.py carries an
-- explicit alias map and prints anything it can't match instead of duping.
CREATE TABLE participants (
  id        SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL UNIQUE,
  gender    CHAR(1) CHECK (gender IN ('M','W')),
  role      CHAR(1) CHECK (role IN ('H','W','U'))
);

CREATE TABLE picks (
  id             SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id),
  season_id      INT NOT NULL REFERENCES seasons(id),
  ticker         TEXT NOT NULL,
  opening_price  NUMERIC(12,4) NOT NULL,
  rationale      TEXT,
  UNIQUE (participant_id, season_id)
);

-- Replaces the JSON prices[5]/changes[4] arrays. Quarterly returns are derived
-- at query time with window functions, never stored.
CREATE TABLE price_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  ticker        TEXT NOT NULL,
  checkpoint_id INT REFERENCES checkpoints(id),
  snapshot_date DATE NOT NULL,
  price         NUMERIC(12,4) NOT NULL,
  source        TEXT NOT NULL DEFAULT 'seed_from_json',
  UNIQUE (ticker, snapshot_date)
);
CREATE INDEX idx_price_snapshots_ticker_date ON price_snapshots (ticker, snapshot_date);

CREATE TABLE benchmarks (
  id           SERIAL PRIMARY KEY,
  season_id    INT NOT NULL REFERENCES seasons(id),
  ticker       TEXT NOT NULL,
  display_name TEXT,
  UNIQUE (season_id, ticker)
);

-- Cohorts are normalized: membership re-derived from source data by
-- scripts/derive_cohorts.py. Cohort return series are computed via
-- AVG() GROUP BY at query time for derived cohorts.
CREATE TABLE cohorts (
  id        SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES seasons(id),
  name      TEXT NOT NULL,
  category  TEXT NOT NULL, -- 'name','school','country','generation','gender','family','benchmark','fund'
  derived   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (season_id, name)
);

CREATE TABLE cohort_memberships (
  cohort_id      INT NOT NULL REFERENCES cohorts(id),
  participant_id INT NOT NULL REFERENCES participants(id),
  PRIMARY KEY (cohort_id, participant_id)
);

-- The published (pre-averaged) series from groups.json, kept verbatim as an
-- audit trail for derived cohorts and as the serving source for any cohort the
-- solver could not match (cohorts.derived = false).
CREATE TABLE cohort_series_published (
  cohort_id         INT NOT NULL REFERENCES cohorts(id),
  checkpoint_seq    SMALLINT NOT NULL,
  cumulative_return NUMERIC(10,6) NOT NULL,
  PRIMARY KEY (cohort_id, checkpoint_seq)
);

CREATE TABLE diamond_hands_report (
  id             SERIAL PRIMARY KEY,
  participant_id INT REFERENCES participants(id),
  ticker         TEXT NOT NULL,
  start_price    NUMERIC(12,4) NOT NULL,
  end_price      NUMERIC(12,4) NOT NULL,
  change         NUMERIC(10,6) GENERATED ALWAYS AS (ROUND((end_price - start_price) / start_price, 6)) STORED
);
