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
