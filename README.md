# Shift Ahoy

Shift Ahoy is a desktop employee scheduling system for small teams and multi-location businesses. It combines an Electron desktop app with a local Node/Express API and PostgreSQL database so owners and managers can build schedules, manage employees, review time-off requests, publish schedules, and monitor coverage health from one organized dashboard.

## Current Feature Set

### Scheduling automation

- Automatic schedule forecasting by location and week
- Employees-needed staffing targets per shift day
- Optional maximum-staff limits per shift day
- Fair rotation scoring based on availability, time off, weekly hour targets, daily limits, priority, recent scheduling, and current weekly load
- Assignment explanations that help show why an employee was selected
- Schedule Health score with warnings and coverage summaries
- Coverage heat map for under-staffed, fully staffed, over-staffed, and closed/no-shift days

### Schedule lifecycle

- Forecast schedules that update from current employee, shift, availability, and time-off data
- Draft schedules for manager review
- Published schedules employees can rely on
- Revised schedules with revision tracking after changes
- Publish notes, publisher tracking, and published timestamps

### Employees and roles

- Owner account creation and login
- Employee management by location
- Manager schedule permissions
- Employee availability by day
- Manual employee days off
- Employee pay rate fields for labor-cost forecasting
- Overtime settings, overtime threshold, and minimum-rest-hour fields

### Time off

- Employee time-off request submission
- Date-range requests with optional reasons
- Request history with Pending, Approved, and Denied statuses
- Manager/owner approval and denial workflow
- Approved time off automatically feeds into schedule forecasting
- Time-off request enable/disable setting
- Blocked dates and holiday dates by location

### Open shifts and shift coverage

- Open shifts generated from published schedule coverage gaps
- Employees can claim open shifts
- Shift cover and shift swap request workflow
- Manager/owner approval or denial for cover/swap requests
- Approved cover/swap requests can update saved schedule cells when linked to a published schedule cell

### Manager operations

- Unified approval queue for pending time-off requests, pending cover/swap requests, and open coverage gaps
- Location-level scheduling rules:
  - Open days
  - Operating hours
  - Minimum employees per day
  - Maximum employees per day
  - Default employees needed
  - Weekly labor budget
  - Schedule publish day
  - Time zone field
- Audit log for important schedule, employee, time-off, open-shift, and approval actions

### Labor and compliance support

- Estimated labor cost by week
- Labor cost by employee
- Weekly labor-budget warnings
- Overtime threshold warnings
- Overtime allowed flag
- Minimum rest hours stored for future compliance checks

> Shift Ahoy provides scheduling support and helpful warnings, but it is not a legal compliance engine. Always review applicable labor, overtime, predictive-scheduling, and fair-workweek rules for your location.

## Project Structure

```text
shiftahoy/
  app/
    index.html
    main.js
    preload.js
    renderer.js
    styles.css
    package.json
    package-lock.json

  server/
    index.js
    auth.js
    automation.js
    audit.js
    db.js
    employees.js
    locations.js
    mailer.js
    middleware.js
    plans.js
    schedules.js
    schema.sql
    shifts.js
    timeoff.js
    .env.example
    package.json
    package-lock.json

  CHANGELOG.md
  LICENSE.md
  README.md
```

## Built With

- Electron
- JavaScript
- HTML
- CSS
- Node.js
- Express
- PostgreSQL
- JWT authentication
- Argon2 password hashing
- Nodemailer for optional email delivery

## Requirements

- Node.js 22 or newer is recommended
- PostgreSQL
- npm
- PowerShell, Terminal, or another command-line shell

## Server Setup

From the `server` folder, install dependencies:

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Update `.env` with your local PostgreSQL connection and secure JWT secrets. At minimum, configure:

```text
PORT=3001
DATABASE_URL=postgres://postgres:your_password@localhost:5432/shiftahoy
JWT_ACCESS_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_a_different_long_random_secret
APP_URL=http://localhost:3001
EMAIL_FROM=Shift Ahoy <no-reply@shiftahoy.local>
```

Optional SMTP fields can be configured when you are ready to send real email:

```text
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

Create or update the database schema:

```bash
psql -U postgres -d shiftahoy -f "./schema.sql"
```

Start the API server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

The API runs on:

```text
http://localhost:3001
```

A health check is available at:

```text
http://localhost:3001/health
```

## Desktop App Setup

From the `app` folder, install dependencies:

```bash
npm install
```

Start the Electron app:

```bash
npm start
```

Build the desktop app:

```bash
npm run build
```

Create a distributable package without publishing updates:

```bash
npm run dist
```

## Recommended Local Startup Order

1. Start PostgreSQL.
2. Apply or update the schema from `server/schema.sql`.
3. Start the API from the `server` folder.
4. Start the Electron desktop app from the `app` folder.
5. Create an owner account and begin adding locations, shifts, employees, and schedule rules.

## Core Workflow

1. Create an owner account.
2. Add one or more locations.
3. Configure location-level schedule rules.
4. Add shifts and define each shift day:
   - Enabled or closed
   - Start time
   - End time
   - Employees needed
   - Optional maximum staff
5. Add employees and configure:
   - Assigned location
   - Schedule-management permission if applicable
   - Availability
   - Manual days off
   - Weekly and daily hour targets
   - Pay and overtime settings
6. Review employee time-off requests.
7. Generate a schedule forecast.
8. Review Schedule Health, warnings, open shifts, and labor cost.
9. Save the schedule as a draft.
10. Publish the schedule when ready.
11. Use the approval queue for time off, open-shift claims, and shift cover/swap requests.
12. Review the audit log for important changes.

## API Areas

The server is organized into route modules:

- `/auth` — signup, login, refresh, verification, and password flows
- `/plans` — plan listing and plan changes
- `/locations` — location management
- `/employees` — employee records, availability, days off, pay, and overtime fields
- `/shifts` — shift templates and day-level staffing rules
- `/schedules` — schedule forecasting, health, drafting, publishing, and schedule cells
- `/time-off` — time-off requests, approval flow, settings, blocked dates, and holidays
- `/automation` — schedule lifecycle, employee schedule view, open shifts, shift cover/swap requests, location rules, labor forecasting, and approval queue
- `/audit` — audit-log retrieval
- `/health` — API health check

## Security Notes

- Passwords are hashed with Argon2.
- Access tokens are short-lived JWTs.
- Refresh tokens are stored as secure hashes in the database.
- The Electron app uses context isolation with Node integration disabled.
- Owner-password confirmation is required for sensitive destructive or high-impact actions.
- Replace all default development secrets before using the app outside local development.

## Packaging Notes

The Electron app is configured with `electron-builder`. The current app package includes:

- `index.html`
- `main.js`
- `preload.js`
- `renderer.js`
- `styles.css`
- `assets/**/*`

Auto-update publishing is configured for a generic provider at:

```text
https://updates.shiftahoy.com/releases/
```

Update this URL before production distribution if needed.

## License

This project currently uses the CC0 1.0 Universal license. See `LICENSE.md` for details.

## Changelog

See `CHANGELOG.md` for the latest update history.
