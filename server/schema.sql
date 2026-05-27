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
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_2fa_enabled BOOLEAN NOT NULL DEFAULT false;

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
  required_staff INTEGER NOT NULL DEFAULT 1 CHECK (required_staff >= 0 AND required_staff <= 99),
  max_staff INTEGER CHECK (max_staff IS NULL OR (max_staff >= 1 AND max_staff <= 99)),
  UNIQUE (shift_id, day_of_week)
);

ALTER TABLE shift_days ADD COLUMN IF NOT EXISTS required_staff INTEGER NOT NULL DEFAULT 1 CHECK (required_staff >= 0 AND required_staff <= 99);
ALTER TABLE shift_days ADD COLUMN IF NOT EXISTS max_staff INTEGER CHECK (max_staff IS NULL OR (max_staff >= 1 AND max_staff <= 99));


UPDATE shift_days
SET required_staff = CASE
  WHEN enabled = false THEN 0
  WHEN COALESCE(required_staff, 0) = 0 AND max_staff IS NOT NULL THEN max_staff
  WHEN COALESCE(required_staff, 0) = 0 THEN 1
  ELSE required_staff
END;

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

CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS time_off_requests_location_status_idx
ON time_off_requests (business_id, location_id, status, start_date);

CREATE INDEX IF NOT EXISTS time_off_requests_employee_status_idx
ON time_off_requests (employee_id, status, start_date);

CREATE TABLE IF NOT EXISTS time_off_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  requests_enabled BOOLEAN NOT NULL DEFAULT true,
  shift_swaps_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE time_off_settings
ADD COLUMN IF NOT EXISTS shift_swaps_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS time_off_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT,
  recurs_yearly BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, location_id, blocked_date)
);

ALTER TABLE time_off_blocked_dates
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE CASCADE;

ALTER TABLE time_off_blocked_dates
ADD COLUMN IF NOT EXISTS recurs_yearly BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE time_off_blocked_dates
DROP CONSTRAINT IF EXISTS time_off_blocked_dates_business_id_blocked_date_key;

UPDATE time_off_blocked_dates t
SET location_id = (
  SELECT id
  FROM locations
  WHERE business_id = t.business_id
  ORDER BY created_at ASC NULLS LAST, name ASC
  LIMIT 1
)
WHERE t.location_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS time_off_blocked_dates_business_location_date_unique
ON time_off_blocked_dates (business_id, location_id, blocked_date);

CREATE INDEX IF NOT EXISTS time_off_blocked_dates_business_location_date_idx
ON time_off_blocked_dates (business_id, location_id, blocked_date);

CREATE TABLE IF NOT EXISTS time_off_holiday_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  recurs_yearly BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, location_id, holiday_date)
);

ALTER TABLE time_off_holiday_dates
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE CASCADE;

ALTER TABLE time_off_holiday_dates
ADD COLUMN IF NOT EXISTS recurs_yearly BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE time_off_holiday_dates
DROP CONSTRAINT IF EXISTS time_off_holiday_dates_business_id_holiday_date_key;

UPDATE time_off_holiday_dates t
SET location_id = (
  SELECT id
  FROM locations
  WHERE business_id = t.business_id
  ORDER BY created_at ASC NULLS LAST, name ASC
  LIMIT 1
)
WHERE t.location_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS time_off_holiday_dates_business_location_date_unique
ON time_off_holiday_dates (business_id, location_id, holiday_date);

CREATE INDEX IF NOT EXISTS time_off_holiday_dates_business_location_date_idx
ON time_off_holiday_dates (business_id, location_id, holiday_date);

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

  INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time, required_staff, max_staff)
  SELECT
    new_shift_id,
    day_number,
    day_number BETWEEN 1 AND 5,
    CASE WHEN day_number BETWEEN 1 AND 5 THEN '08:00'::time ELSE NULL END,
    CASE WHEN day_number BETWEEN 1 AND 5 THEN '17:00'::time ELSE NULL END,
    CASE WHEN day_number BETWEEN 1 AND 5 THEN 1 ELSE 0 END,
    NULL
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

    INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time, required_staff, max_staff)
    SELECT
      new_shift_id,
      day_number,
      day_number BETWEEN 1 AND 5,
      CASE WHEN day_number BETWEEN 1 AND 5 THEN '08:00'::time ELSE NULL END,
      CASE WHEN day_number BETWEEN 1 AND 5 THEN '17:00'::time ELSE NULL END,
      CASE WHEN day_number BETWEEN 1 AND 5 THEN 1 ELSE 0 END,
      NULL
    FROM generate_series(1, 7) AS day_number;
  END LOOP;
END $$;

ALTER TABLE time_off_requests ADD COLUMN IF NOT EXISTS decision_reason TEXT;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audit_logs_business_created_idx
ON audit_logs (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_business_location_created_idx
ON audit_logs (business_id, location_id, created_at DESC);

-- Ultimate automation upgrade: publishing, open shifts, swaps, labor rules, and location rules.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pay_rate_cents INTEGER NOT NULL DEFAULT 0 CHECK (pay_rate_cents >= 0);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS overtime_allowed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS overtime_threshold_hours NUMERIC(5,2) NOT NULL DEFAULT 40;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS min_rest_hours NUMERIC(5,2) NOT NULL DEFAULT 8;

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'forecast' CHECK (status IN ('forecast', 'draft', 'published', 'revised', 'archived'));
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1 CHECK (revision_number >= 1);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE schedule_cells ADD COLUMN IF NOT EXISTS assignment_reason JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE schedule_cells ADD COLUMN IF NOT EXISTS fairness_score INTEGER;
ALTER TABLE schedule_cells ADD COLUMN IF NOT EXISTS estimated_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (estimated_cost_cents >= 0);
ALTER TABLE schedule_cells ADD COLUMN IF NOT EXISTS revised_from_cell_id UUID REFERENCES schedule_cells(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS location_schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE UNIQUE,
  open_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  operating_start TIME NOT NULL DEFAULT '08:00',
  operating_end TIME NOT NULL DEFAULT '17:00',
  min_employees_per_day INTEGER NOT NULL DEFAULT 0 CHECK (min_employees_per_day >= 0),
  max_employees_per_day INTEGER CHECK (max_employees_per_day IS NULL OR max_employees_per_day >= 1),
  default_required_staff INTEGER NOT NULL DEFAULT 1 CHECK (default_required_staff >= 0 AND default_required_staff <= 99),
  manager_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  time_zone TEXT NOT NULL DEFAULT 'America/Chicago',
  labor_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK (labor_budget_cents >= 0),
  schedule_publish_day INTEGER NOT NULL DEFAULT 1 CHECK (schedule_publish_day BETWEEN 1 AND 7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_schedule_rules_business_location_idx
ON location_schedule_rules (business_id, location_id);

CREATE TABLE IF NOT EXISTS open_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  work_date DATE NOT NULL,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  shift_name TEXT NOT NULL DEFAULT 'Open Shift',
  start_time TIME,
  end_time TIME,
  slots_open INTEGER NOT NULL DEFAULT 1 CHECK (slots_open >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'filled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS open_shifts_business_location_week_idx
ON open_shifts (business_id, location_id, week_start, status);

CREATE TABLE IF NOT EXISTS open_shift_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  open_shift_id UUID NOT NULL REFERENCES open_shifts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (open_shift_id, employee_id)
);

CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  schedule_cell_id UUID REFERENCES schedule_cells(id) ON DELETE SET NULL,
  from_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  to_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL DEFAULT 'cover' CHECK (request_type IN ('cover', 'swap')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending_employee' CHECK (status IN ('pending_employee', 'pending_manager', 'approved', 'denied', 'cancelled')),
  accepted_at TIMESTAMPTZ,
  manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  manager_decision_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shift_swap_requests_business_location_status_idx
ON shift_swap_requests (business_id, location_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS shift_swap_requests_employee_idx
ON shift_swap_requests (business_id, from_employee_id, to_employee_id, created_at DESC);

INSERT INTO location_schedule_rules (business_id, location_id)
SELECT business_id, id
FROM locations
ON CONFLICT (location_id) DO NOTHING;

-- Immutable 9 digit account IDs and payroll/time clock support.
CREATE TABLE IF NOT EXISTS issued_account_ids (
  account_number CHAR(9) PRIMARY KEY CHECK (account_number ~ '^\d{9}$'),
  issued_to TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number CHAR(9) UNIQUE CHECK (account_number ~ '^\d{9}$');

CREATE UNIQUE INDEX IF NOT EXISTS users_account_number_unique
ON users (account_number)
WHERE account_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_code_global_unique
ON employees (employee_code);

CREATE TABLE IF NOT EXISTS payroll_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  first_pay_period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  pay_period_weeks INTEGER NOT NULL DEFAULT 2 CHECK (pay_period_weeks BETWEEN 1 AND 12),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_clock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  account_number CHAR(9) NOT NULL CHECK (account_number ~ '^\d{9}$'),
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_at TIMESTAMPTZ,
  clock_in_status TEXT NOT NULL DEFAULT 'on_time' CHECK (clock_in_status IN ('early', 'on_time', 'late', 'unscheduled')),
  clock_out_status TEXT CHECK (clock_out_status IN ('early', 'on_time', 'late', 'unscheduled')),
  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at TIMESTAMPTZ,
  minutes_worked INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN clock_out_at IS NULL THEN NULL
      ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (clock_out_at - clock_in_at)) / 60)::int)
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_clock_entries_employee_clock_idx
ON time_clock_entries (business_id, employee_id, clock_in_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS time_clock_entries_one_open_per_employee
ON time_clock_entries (employee_id)
WHERE clock_out_at IS NULL;

CREATE TABLE IF NOT EXISTS payroll_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  time_clock_entry_id UUID REFERENCES time_clock_entries(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('clock_in_early', 'clock_in_late', 'clock_in_unscheduled', 'clock_out_early', 'clock_out_late', 'clock_out_unscheduled')),
  message TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payroll_alerts_business_location_created_idx
ON payroll_alerts (business_id, location_id, created_at DESC);

INSERT INTO payroll_settings (business_id)
SELECT id
FROM businesses
ON CONFLICT (business_id) DO NOTHING;
