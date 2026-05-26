# Shift Ahoy Automation Upgrade

## Double-check results

- Employee time-off request workflow was already present: employee request form, request history, manager/owner approve/deny flow, settings, blocked dates, holidays, and approved time off feeding the forecast.
- Shift staffing limits were partially present as `maxStaff`, but the system did not have a true `employees needed` coverage target. This update adds `required_staff` / `requiredStaff` while keeping optional `maxStaff` as a cap.

## Added

- Employees needed per shift day.
- Optional max staff cap remains available.
- Fair rotation scoring in the schedule generator.
- Assignment explanations for generated schedule cells.
- Schedule Health score and summary.
- Coverage heat map.
- Open slot counts for under-covered shifts.
- Conflict/health warnings for missing shifts, missing employees, invalid shift times, under-staffing, low weekly hours, and max-staff below required-staff.
- Database migration for `shift_days.required_staff`.
- Default shift days now need 1 employee on weekdays and 0 on closed days.

## Updated files

### App
- `app/renderer.js`
- `app/styles.css`
- `app/package.json`

### Server
- `server/schema.sql`
- `server/shifts.js`
- `server/schedules.js`
- `server/package.json`

## Validation

All JavaScript files in the updated app and server passed `node --check` syntax validation.
