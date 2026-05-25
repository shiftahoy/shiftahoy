CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  business_slug TEXT UNIQUE NOT NULL,
  plan_code TEXT NOT NULL DEFAULT 'free',
  plan_employee_limit INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS businesses_business_slug_unique
ON businesses (business_slug);

CREATE TABLE IF NOT EXISTS plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL,
  employee_limit INTEGER
);

INSERT INTO plans (code, name, monthly_price_cents, employee_limit)
VALUES
  ('free', 'Free', 0, 1),
  ('plus', 'Plus', 999, 15),
  ('premium', 'Premium', 2499, 50),
  ('pro', 'Pro', 9999, NULL)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  employee_limit = EXCLUDED.employee_limit;

UPDATE businesses SET plan_code = 'plus' WHERE plan_code = 'starter';
UPDATE businesses SET plan_code = 'premium' WHERE plan_code = 'growth';
UPDATE businesses SET plan_code = 'pro' WHERE plan_code = 'unlimited';

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  username TEXT NOT NULL,
  full_login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'employee')),
  can_manage_schedule BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS users_business_username_unique
ON users (business_id, username);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
ON users (lower(email))
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_full_login_unique
ON users (full_login);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, name)
);

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS shift_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  enabled BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  UNIQUE (shift_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 25),
  employee_code TEXT NOT NULL,
  title TEXT NOT NULL,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('part_time', 'full_time')),
  weekly_hours NUMERIC(5,2) NOT NULL,
  daily_hours NUMERIC(5,2) NOT NULL,
  orientation_start TIMESTAMPTZ,
  preferred_shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, employee_code)
);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS employee_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  available BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (employee_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS employee_days_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day_off DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, day_off)
);

CREATE INDEX IF NOT EXISTS employee_days_off_employee_date_idx
ON employee_days_off (employee_id, day_off);

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, week_start)
);

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS schedule_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  start_time TIME,
  end_time TIME,
  is_orientation BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  UNIQUE (schedule_id, employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_token_hash_idx
ON refresh_tokens (token_hash);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_tokens_token_hash_idx
ON email_verification_tokens (token_hash);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx
ON password_reset_tokens (token_hash);

CREATE OR REPLACE FUNCTION create_default_shift_for_location()
RETURNS trigger AS $$
DECLARE
  new_shift_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM shifts
    WHERE business_id = NEW.business_id
      AND location_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO shifts (business_id, location_id, name, sort_order)
  VALUES (NEW.business_id, NEW.id, 'Standard', 1)
  RETURNING id INTO new_shift_id;

  INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time)
  SELECT
    new_shift_id,
    day_number,
    day_number BETWEEN 1 AND 5,
    CASE WHEN day_number BETWEEN 1 AND 5 THEN '08:00'::time ELSE NULL END,
    CASE WHEN day_number BETWEEN 1 AND 5 THEN '17:00'::time ELSE NULL END
  FROM generate_series(1, 7) AS day_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS locations_create_default_shift ON locations;

CREATE TRIGGER locations_create_default_shift
AFTER INSERT ON locations
FOR EACH ROW
EXECUTE FUNCTION create_default_shift_for_location();

DO $$
DECLARE
  location_row RECORD;
  new_shift_id UUID;
BEGIN
  FOR location_row IN
    SELECT l.id, l.business_id
    FROM locations l
    WHERE NOT EXISTS (
      SELECT 1
      FROM shifts s
      WHERE s.location_id = l.id
        AND s.business_id = l.business_id
    )
  LOOP
    INSERT INTO shifts (business_id, location_id, name, sort_order)
    VALUES (location_row.business_id, location_row.id, 'Standard', 1)
    RETURNING id INTO new_shift_id;

    INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time)
    SELECT
      new_shift_id,
      day_number,
      day_number BETWEEN 1 AND 5,
      CASE WHEN day_number BETWEEN 1 AND 5 THEN '08:00'::time ELSE NULL END,
      CASE WHEN day_number BETWEEN 1 AND 5 THEN '17:00'::time ELSE NULL END
    FROM generate_series(1, 7) AS day_number;
  END LOOP;
END $$;
