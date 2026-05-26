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
