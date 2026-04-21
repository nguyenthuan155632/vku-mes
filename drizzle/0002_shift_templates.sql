ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'unscheduled_production';

CREATE TABLE shift_templates (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  shift_number SMALLINT NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults matching previous hardcoded behaviour
INSERT INTO shift_templates (name, shift_number, start_time, end_time)
VALUES ('Ca 1', 1, '08:00', '20:00'),
       ('Ca 2', 2, '20:00', '08:00');
