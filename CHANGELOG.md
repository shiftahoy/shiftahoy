
# Shift Ahoy Dedicated Automatic Pay Bump Control

This update expands the v3 rewards engine with a clearer Manager Portal pay-bump workflow.

## Added

- Dedicated Automatic Pay Bump toggle in the Manager Portal payroll settings.
- Configurable hours-required threshold for pay bumps.
- Configurable hourly bump amount.
- Repeat-every-cycle option for milestone raises.
- Maximum pay-bump/reward cycle cap so raises stop after the configured limit.
- Help text and labels that match the existing Shift Ahoy card, field, and portal design system.

## Updated

- Cash bonuses and hourly pay bumps are now presented as separate controls while still using the same audited reward engine.
- Saving payroll settings now enables the reward engine when either cash bonuses or automatic pay bumps are enabled.
- README now documents manager-controlled pay bump automation and cap behavior.

## Validation

- Updated JavaScript files were checked with `node --check`.

---
# Shift Ahoy Complete PTO, Sick Leave, Bonus, and Pay-Bump Engine

This update expands the business-ID and secure-clock update into a complete leave and reward workflow.

## Added

- PTO and sick leave balance tables, transaction ledger, accrual run tracking, and year-end run tracking.
- Time-off request fields for unpaid/PTO/sick leave and requested paid hours.
- PTO/sick approval deductions and denial restoration logic.
- Automatic leave accrual on clock-out when enabled.
- Manual pay-period accrual endpoint with duplicate-run protection.
- Manager manual balance adjustments with required reasons and audit logs.
- Bonus and pay-bump rules with hour thresholds, recurring cycles, max cycles, and optional automatic pay-rate updates.
- Automatic bonus/pay-bump evaluation on clock-out when enabled.
- Manager Portal controls for PTO, sick leave, accrual, clock grace windows, bonus rules, and manual accrual/evaluation actions.
- Employee Portal display for leave balances, leave usage, clock violations, all-time hours, and bonus/pay-bump awards.

## Updated

- Payroll summary APIs now include PTO/sick balances and recent bonus awards.
- Manager payroll summaries now include location-filtered leave balances and bonus award history.
- README now documents the complete PTO, sick leave, bonus, and pay-bump workflow.

## Validation

- Updated JavaScript files were checked with `node --check`.

---

# Shift Ahoy Web-Verified Reliability and Security Expansion

This follow-up pass hardens the previous Business ID#, clock portal, 2FA, and payroll update after reviewing current implementation guidance.

## Added

- Transaction-scoped PostgreSQL advisory locking around clock in/out actions, in addition to the existing unique open-entry guard.
- Desktop-only clock request header required by clock session, lookup, and punch routes.
- Email 2FA attempt counters, resend throttling, single-use invalidation, and sent-to tracking.
- Restrictive Electron Content Security Policy in the desktop HTML shell.

## Updated

- 2FA code hashing now uses an HMAC keyed by `TWO_FACTOR_CODE_SECRET` when present, falling back to the JWT secret for local development.
- Clock punch transaction flow now serializes per business + employee ID# to prevent device-race exploits before checking/inserting open entries.
- README now documents the web-verified hardening pass and implementation notes.

## Validation

- Updated JavaScript files were checked with `node --check`.

---

# Shift Ahoy Business ID, Secure Clock, 2FA, Leave, Bonus, and Plan Location Limit Update

## Added

- Permanent unique 9 digit Business ID# generation during owner signup.
- Business ID# gate before Login and Clock In / Out become visible.
- Business-scoped login using Business ID# plus Employee Company ID# or email and password.
- Email-based 2FA support for users who enable it on their profile.
- Profile endpoints for changing email, changing password, and enabling/disabling 2FA.
- Manager/owner clock portal unlock with a signed clock session token.
- Clock portal settings for in-app clock enablement, manager/owner session requirement, scheduled clock-in enforcement, early grace, late grace, and clock-out grace.
- Payroll violation log with employee, date/time, scheduled time, violation type, and reason.
- Employee payroll all-time hours and violation history.
- Manager payroll all-time hours, alerts, and violations.
- PTO and sick leave data model with accrual rules, employee balances, and leave transactions.
- Bonus and pay-bump data model with hour thresholds, recurring rules, caps, and award tracking.
- Plan location limits: Free 1, Plus 3, Premium 5, Pro unlimited.

## Updated

- Employee creation now requires a company-provided 9 digit Employee Company ID# instead of auto-generating one.
- Employee Company ID# values are unique inside the same Business ID#.
- Owner signup messaging now refers to Business ID# instead of employee/user ID#.
- Clock In / Out now uses Business ID# + Employee Company ID# and prevents duplicate open punches with database constraints and transactional row locks.
- Manager credential prompts now ask for the current authorized user password instead of saying owner password where a manager can perform the action.
- Employee password fields are masked by default and include Show and Copy controls.
- Orientation / Start Date is required for new employees.
- README updated for the new identity, security, clock, leave, bonus, and plan-limit workflows.

## Validation

- Updated JavaScript files were checked with `node --check`.

---

# Shift Ahoy Immutable ID# and Payroll Time Clock Update

This update replaces usernames and manually-entered employee numbers with permanent unique 9 digit ID# values and adds the first payroll/time-clock workflow.

## Added

- Automatic permanent 9 digit ID# creation for owner accounts.
- Automatic permanent 9 digit ID# creation for employees.
- `issued_account_ids` registry so ID# values cannot be reused, even after employee deletion/deactivation.
- Login by ID# or email.
- Clock In / Out panel beside Login on the blue auth screen.
- Payroll API with settings, clock lookup, clock in/out, employee payroll summary, manager payroll summary, and payroll alerts.
- Payroll settings in Manager Portal with owner-only first pay-cycle start date and pay-period week controls.
- Employee Portal payroll log with recent worked dates, clock in/out times, current-period hours, and estimated next pay.
- Manager Portal payroll view with current period totals, estimated payroll, and early/late/unscheduled clock alerts.
- Database tables for payroll settings, time clock entries, and payroll alerts.

## Updated

- Create Owner Account no longer asks for Username.
- Login no longer says Username/Business; it now uses ID# or Email.
- Employee creation no longer asks for Employee # or Username.
- Schedule table now labels Employee # as ID#.
- Dashboard and profile areas now display the permanent ID# with the full name.
- Employee list, employee portal identity, and settings profile now prefer ID# labels.
- README documents immutable ID# login and payroll/time-clock behavior.

## Validation

- Updated JavaScript files were checked with `node --check`.

---

# Shift Ahoy Recurring Dates and Validation Polish

This update adds yearly recurrence for holiday and blocked dates, improves field-level error styling, and adds an in-settings logout workflow.

## Added

- Yearly recurring option for holiday dates.
- Yearly recurring option for blocked dates.
- Database support for `time_off_blocked_dates.recurs_yearly` and `time_off_holiday_dates.recurs_yearly`.
- Settings logout button that matches the existing settings design and returns users to the blue login panel.

## Updated

- Create Owner Account errors now outline the affected field in red.
- Login errors now outline both login fields in red when credentials are missing or invalid.
- Shared field validation now works for all form fields by falling back to the nearest `.fieldGroup`.
- Light mode and dark mode invalid fields now use a red outline without changing the field fill color.
- Employee password status now says `Required` instead of `Required for new employees`.
- README now documents recurring blocked/holiday dates, validation polish, and logout behavior.

## Validation

- Updated JavaScript files were checked with `node --check`.

---

# Shift Ahoy Current Dashboard Polish

This update refines the dashboard experience, schedule forecast layout, print workflow, dark mode, employee credentials, and employee request controls.

## Added

- Employee-centered Schedule Forecast rows: every active employee assigned to the selected location appears for the selected forecast week.
- Professional schedule preview/print output with location, week range, assignment counts, health summary, and print-safe table styling.
- Owner-controlled setting for employee shift cover/swap requests.
- Existing owner-controlled time-off request setting is reflected in the updated request controls panel.
- Database support for `time_off_settings.shift_swaps_enabled`.

## Updated

- Dashboard greeting now displays the user's full name instead of username/login.
- Removed the top dashboard alert area underneath the greeting.
- Employee dashboard username and password creation now follows the same guidelines as owner account creation.
- Dark-mode form error, warning, success, autofill, and invalid states stay dark and readable.
- My Schedule, Manager Approval Queue, and Labor Forecast metric cards now visually match Schedule Health in dark mode.
- README now reflects current schedule, print, dark-mode, employee credential, and request-control behavior.

## Validation

- Updated JavaScript files were checked with `node --check`.

---

# Shift Ahoy Ultimate Automation Overhaul

This update expands Shift Ahoy from a live scheduling forecast into a fuller automated scheduling system.

## Added

- Location-level schedule rules:
  - Open days
  - Operating hours
  - Minimum employees per day
  - Maximum employees per day
  - Default employees needed
  - Labor budget
  - Schedule publish day
  - Time zone field

- Schedule lifecycle:
  - Forecast
  - Draft
  - Published
  - Revised
  - Revision number
  - Publish notes
  - Published timestamp and publisher

- Employee schedule view:
  - Published employee shifts
  - Upcoming request status
  - Open shifts at assigned location

- Open shifts:
  - Under-covered published schedule slots create open shifts
  - Employees can claim open shifts
  - Open shift claims are audit logged

- Shift cover / shift swap workflow:
  - Employee request cover/swap
  - Coworker can accept
  - Manager/owner can approve or deny
  - Approved requests can update schedule cells when tied to a saved cell

- Labor cost forecasting:
  - Employee pay rate fields
  - Weekly labor cost estimate
  - Cost by employee
  - Labor budget warning
  - Overtime threshold warning
  - Overtime allowed flag
  - Minimum rest hours stored for future compliance checks

- Manager approval queue:
  - Pending time-off requests
  - Pending shift cover/swap requests
  - Open coverage gaps

- Expanded audit logging:
  - Location rule updates
  - Draft/publish/revise schedule actions
  - Open shift claims
  - Shift cover/swap lifecycle

## Updated

- Employee form now includes:
  - Pay rate
  - Overtime allowed
  - Overtime threshold
  - Minimum rest hours

- Server now mounts `/automation` routes.

## Files changed

- `server/schema.sql`
- `server/index.js`
- `server/automation.js`
- `server/employees.js`
- `app/index.html`
- `app/renderer.js`
- `app/styles.css`

## Validation

All JavaScript files were checked with `node --check`.
