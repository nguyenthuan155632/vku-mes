-- Enable TimescaleDB when available (local Docker); silently skip on vanilla Postgres (e.g. Render)
DO $$ BEGIN EXECUTE 'CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE TYPE pulse_source AS ENUM ('sensor', 'manual');
CREATE TYPE alert_type   AS ENUM ('silent_machine', 'low_output');
CREATE TYPE user_role    AS ENUM ('operator', 'supervisor', 'viewer');

CREATE TABLE workcenters (
  id                          serial PRIMARY KEY,
  code                        text UNIQUE NOT NULL,
  name                        text NOT NULL,
  target_qty_per_hour         int  NOT NULL,
  alert_threshold_minutes     int  NOT NULL DEFAULT 10,
  low_output_threshold_pct    int  NOT NULL DEFAULT 60,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE production_metrics (
  time            timestamptz NOT NULL,
  workcenter_id   int  NOT NULL REFERENCES workcenters(id),
  qty             int  NOT NULL CHECK (qty >= 0),
  defect_qty      int  NOT NULL DEFAULT 0 CHECK (defect_qty >= 0),
  source          pulse_source NOT NULL,
  note            text,
  PRIMARY KEY (time, workcenter_id)
);
DO $$ BEGIN PERFORM create_hypertable('production_metrics', 'time', chunk_time_interval => INTERVAL '1 day'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE INDEX ON production_metrics (workcenter_id, time DESC);

CREATE TABLE downtime_events (
  id                serial PRIMARY KEY,
  workcenter_id     int NOT NULL REFERENCES workcenters(id),
  start_time        timestamptz NOT NULL,
  end_time          timestamptz,
  duration_minutes  int GENERATED ALWAYS AS
                       (CASE WHEN end_time IS NULL THEN NULL
                             ELSE (EXTRACT(EPOCH FROM (end_time - start_time))::int / 60) END) STORED,
  reason            text
);
CREATE INDEX ON downtime_events (workcenter_id, start_time DESC);
CREATE UNIQUE INDEX one_open_per_wc ON downtime_events (workcenter_id) WHERE end_time IS NULL;

CREATE TABLE shifts (
  id              serial PRIMARY KEY,
  workcenter_id   int NOT NULL REFERENCES workcenters(id),
  shift_date      date NOT NULL,
  shift_number    smallint NOT NULL CHECK (shift_number IN (1, 2)),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  total_qty       int NOT NULL DEFAULT 0,
  defect_qty      int NOT NULL DEFAULT 0,
  runtime_minutes int NOT NULL DEFAULT 0,
  oee_score       numeric(5,4),
  closed_at       timestamptz,
  UNIQUE (workcenter_id, shift_date, shift_number)
);

CREATE TABLE alerts (
  id              serial PRIMARY KEY,
  workcenter_id   int NOT NULL REFERENCES workcenters(id),
  type            alert_type NOT NULL,
  message         text NOT NULL,
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     user_role
);
CREATE INDEX ON alerts (resolved_at) WHERE resolved_at IS NULL;

-- Simple migration tracking so migrate.ts is idempotent
CREATE TABLE IF NOT EXISTS _migrations (
  id   int PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
