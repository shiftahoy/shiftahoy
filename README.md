# Shift Ahoy

## Complete PTO, Sick Leave, Bonus, and Pay-Bump Engine

This package expands the earlier leave foundation into a working operational balance system:

- PTO and sick leave can be enabled separately from Payroll / Leave settings.
- Owners/managers can configure accrual by worked hour, max balances, yearly reset dates, negative-balance policy, and automatic accrual on clock-out.
- Employees now see PTO and sick leave balances, lifetime used/accrued totals, recent leave transactions, violations, and bonus/pay-bump awards in the Employee Portal payroll area.
- Time-off requests now support Unpaid, PTO, or Sick Leave plus requested paid hours. Approved PTO/sick requests deduct the matching balance; denials of previously approved requests restore the balance.
- Managers can run pay-period accruals, manually adjust balances with required reasons, and review balances by location.
- Bonus rules can reward employees after reaching hour milestones with one-time or recurring bonuses. A separate automatic pay-bump toggle can raise hourly pay after a configured number of worked hours, repeat per cycle, and stop after a manager-defined cap.
- Bonus/pay-bump evaluation can run automatically on clock-out or manually from the Manager Portal.
- All balance changes are stored as append-only leave transactions for auditability instead of silently overwriting balances.

> PTO, sick leave, bonuses, pay bumps, overtime, final payroll, and leave compliance vary by jurisdiction. Treat Shift Ahoy calculations as operational records and confirm final payroll/legal compliance with your payroll provider and local requirements.


## Web-verified hardening pass

This package includes a second implementation pass based on current security and reliability guidance for Electron, PostgreSQL-backed clocking, and email-based verification codes. The time clock now uses both database protection and a transaction-scoped advisory lock to prevent duplicate concurrent punches. Email 2FA codes are hashed with a server-side secret, expire quickly, are single-use, include attempt counters, and throttle rapid resend attempts. The Electron shell now includes a restrictive Content Security Policy and keeps clock routes limited to requests from the desktop clock UI.

Shift Ahoy is a desktop employee scheduling system for small teams and multi-location businesses. It combines an Electron desktop app with a local Node/Express API and PostgreSQL database so owners and managers can build schedules, manage employees, review time-off requests, publish schedules, and monitor coverage health from one organized dashboard.

## Business ID#, Company Employee IDs, Secure Clock, 2FA, Leave, and Plan Limits

This update changes Shift Ahoy identity from globally generated employee/user ID# values to a business-scoped model:

- New owner signup creates a permanent unique 9 digit **Business ID#** for the business workspace.
- Employee creation now requires the company's existing 9 digit **Employee Company ID#** instead of auto-generating one.
- Employee Company ID# values must be unique inside the same Business ID#, but the same employee number may exist in a different business.
- Login starts with a Business ID# gate. After the Business ID# is validated, the Login and Clock In / Out panels become available for that business.
- Users log in with Business ID# + Employee Company ID# or email + password. When 2FA is enabled, an email verification code is required after the password step.
- Employees can update their profile email, change their password, and enable or disable email-based 2FA from their profile/security workflow.
- Clock In / Out requires Business ID# context and, by default, a manager or owner unlocks the clock portal with their own password before employees can punch.
- Clock In / Out uses row locking plus a database-level one-open-entry-per-employee rule to prevent duplicate clock-ins from multiple devices.
- Payroll settings include in-app clock enablement, manager/owner clock-session requirement, scheduled clock-in enforcement, early grace, late grace, and clock-out grace controls.
- Early blocked clock-in attempts and late/unscheduled punches are logged as employee violations with date, time, and reason.
- Employee payroll summaries include current pay-period hours, all-time hours, recent clock history, and violation history.
- Manager payroll summaries include current period hours, all-time hours, estimated pay, alerts, and violations.
- Leave and rewards foundations were added for PTO, sick leave, accrual tiers by years of service, employee balances, leave transactions, recurring/capped bonus rules, bonus awards, and pay bump tracking.
- Employee orientation/start date is required so service-based PTO, sick leave, bonuses, and pay bumps can be calculated consistently.
- Plan location limits are now stored and enforced: Free = 1 location, Plus = 3, Premium = 5, Pro = unlimited.



## Manager-Controlled Automatic Pay Bump Rules

Shift Ahoy now includes a dedicated Manager Portal pay-bump control that can be turned on or off separately from cash bonuses. Managers can set:

- the number of worked hours required before a raise is earned;
- the hourly pay bump amount;
- whether the bump repeats every threshold cycle;
- the maximum number of bump/reward cycles so raises stop after the cap;
- whether the award engine runs automatically on clock-out or only when manually evaluated.

When enabled, Shift Ahoy evaluates completed clock entries against the rule, creates an award record, and applies the hourly pay-rate increase to the employee record only once per eligible cycle. Duplicate awards are prevented with the employee/rule/cycle uniqueness constraint, so employees cannot receive the same bump twice for the same milestone.

## ID# Login and Payroll Time Clock Updates

- Owner accounts no longer collect a username during signup. Shift Ahoy automatically creates a permanent unique 9 digit Business ID# for the business workspace.
- Employee creation now requires the company's existing 9 digit Employee Company ID# and stores it as the employee code used throughout schedules.
- Business ID# values are issued through `issued_account_ids` and are never reused. Employee Company ID# values are unique inside each business.
- Login now accepts ID# or verified email plus password. The old Username/Business login flow has been removed from the UI.
- The dashboard greeting, settings profile, employee portal identity, employee list, and schedule table display ID# instead of username or Employee #.
- The login screen now includes a compact Clock In / Out panel. Employees enter their 9 digit ID#, scan it, and Shift Ahoy shows the correct Clock In or Clock Out action based on their current status. After a successful punch, the ID# field is cleared.

## Payroll System

Shift Ahoy now includes a local payroll/time-clock foundation:

- Payroll settings are available in the Manager Portal. Owners can set the first pay-cycle start date and the number of weeks in each pay period.
- Employees can view payroll details in the Employee Portal, including recent clock entries, clock-in/clock-out timestamps, current pay-period hours, and estimated next pay based on their hourly pay rate.
- Managers can view current pay-period totals, estimated payroll, and recent payroll alerts for the selected location.
- Payroll alerts are created when employees clock in or out more than 15 minutes early or late compared with their published/revised schedule. Unscheduled clock events are also flagged.
- Time clock data is tied to immutable ID# values and employee records so historical payroll logs remain available even after an employee is deactivated.

> Payroll calculations are estimates for operational review. Confirm final payroll, rounding, overtime, breaks, and compliance rules with your payroll provider and local labor requirements before paying employees.

## Latest UI and Request-Control Updates

- Holiday dates and blocked dates can now be saved as one-time dates or yearly recurring dates.
- Yearly recurring blocked dates are respected when employees submit time-off requests.
- Create Owner Account, Login, and form validation errors now mark the affected fields with a red outline in both light mode and dark mode.
- Employee password status now uses the same concise “Required” wording as the other required fields.
- Settings now includes a matching Log Out action that clears the current session and returns the user to the blue login panel.

## Recent UX and Workflow Updates

- Dashboard greeting now displays the user's full name instead of their username/login.
- Removed the top dashboard alert area under the greeting; validation and workflow feedback now stay closer to the related form or action.
- Schedule Forecast is employee-centered: every active employee for the selected location appears as a row for the selected week, even when they are off all week.
- Schedule preview/print now uses a professional print-focused layout with a schedule summary header, clean table styling, and print-safe spacing.
- Dark mode now keeps form fields, validation states, warning cards, schedule health cards, portal metrics, and labor cards visually consistent.
- Employee-created usernames and passwords now follow the same rules as owner account creation.
- Owners can turn employee time-off requests on/off.
- Owners can turn employee shift cover/swap requests on/off independently from time-off requests.
- Owners can mark holiday dates and blocked dates as yearly recurring dates.

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
- Shift cover/swap request enable/disable setting
- Blocked dates and holiday dates by location, including optional yearly recurrence

### Open shifts and shift coverage

- Open shifts generated from published schedule coverage gaps
- Employees can claim open shifts
- Shift cover and shift swap request workflow
- Owner setting to turn employee shift cover/swap requests on or off
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
