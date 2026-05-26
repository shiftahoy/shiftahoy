const express = require("express");
const pool = require("./db");
const { requireAuth } = require("./middleware");

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 7, short: "Sun", long: "Sunday" }
];

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours * 60) + (minutes || 0);
}

function timeFromMinutes(totalMinutes) {
  const minutesInDay = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hours = Math.floor(minutesInDay / 60);
  const minutes = minutesInDay % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function dayOfWeekForDate(date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function dayLabel(dayOfWeek) {
  return DAYS.find((day) => day.value === Number(dayOfWeek))?.long || `Day ${dayOfWeek}`;
}

function employeeName(employee) {
  return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.username || employee.employee_code || "Employee";
}

async function assertScheduleAccess(user, locationId) {
  if (!locationId) {
    const error = new Error("Location ID is required.");
    error.status = 400;
    throw error;
  }

  if (user.role === "owner") {
    const locationResult = await pool.query(
      `SELECT id
       FROM locations
       WHERE id = $1
         AND business_id = $2`,
      [locationId, user.businessId]
    );

    if (locationResult.rows.length === 0) {
      const error = new Error("Location not found.");
      error.status = 404;
      throw error;
    }

    return;
  }

  const assignedResult = await pool.query(
    `SELECT 1
     FROM employees
     WHERE business_id = $1
       AND user_id = $2
       AND location_id = $3
       AND active = true
     LIMIT 1`,
    [user.businessId, user.id, locationId]
  );

  if (assignedResult.rows.length === 0) {
    const error = new Error("You can only view schedules for your assigned location.");
    error.status = 403;
    throw error;
  }
}

function buildAvailabilityMap(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.employee_id)) map.set(row.employee_id, new Map());
    map.get(row.employee_id).set(Number(row.day_of_week), Boolean(row.available));
  }

  return map;
}

function buildDaysOffMap(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.employee_id)) map.set(row.employee_id, new Set());
    map.get(row.employee_id).add(toDateOnly(new Date(row.day_off)));
  }

  return map;
}

function buildApprovedTimeOffMap(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.employee_id)) map.set(row.employee_id, new Set());

    const start = new Date(`${toDateOnly(new Date(row.start_date))}T00:00:00.000Z`);
    const end = new Date(`${toDateOnly(new Date(row.end_date))}T00:00:00.000Z`);

    for (let date = start; date <= end; date = addDays(date, 1)) {
      map.get(row.employee_id).add(toDateOnly(date));
    }
  }

  return map;
}

function buildLastScheduledMap(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.employee_id || !row.last_worked) continue;
    map.set(row.employee_id, toDateOnly(new Date(row.last_worked)));
  }

  return map;
}

function buildShiftOptions(rows) {
  const fallbackByDay = new Map();
  const byPreferredShift = new Map();

  for (const row of rows) {
    const requiredStaff = Math.max(0, Number(row.required_staff || 0));
    const maxStaff = row.max_staff === null || row.max_staff === undefined ? null : Math.max(1, Number(row.max_staff));

    const item = {
      shiftId: row.shift_id,
      shiftName: row.shift_name,
      dayOfWeek: Number(row.day_of_week),
      startTime: row.start_time,
      endTime: row.end_time,
      startMinutes: minutesFromTime(row.start_time),
      endMinutes: minutesFromTime(row.end_time),
      requiredStaff,
      maxStaff,
      sortOrder: Number(row.sort_order || 1)
    };

    if (!byPreferredShift.has(row.shift_id)) byPreferredShift.set(row.shift_id, new Map());
    byPreferredShift.get(row.shift_id).set(item.dayOfWeek, item);

    if (!fallbackByDay.has(item.dayOfWeek)) fallbackByDay.set(item.dayOfWeek, []);
    fallbackByDay.get(item.dayOfWeek).push(item);
  }

  for (const options of fallbackByDay.values()) {
    options.sort((a, b) => a.sortOrder - b.sortOrder || a.shiftName.localeCompare(b.shiftName));
  }

  return { fallbackByDay, byPreferredShift };
}

function explainSkip({ employee, dayOfWeek, workDateText, shift, availabilityByEmployee, daysOffByEmployee, approvedTimeOffByEmployee, assignedDailyDates, assignedWeeklyMinutes, byPreferredShift }) {
  const reasons = [];
  const employeeAvailability = availabilityByEmployee.get(employee.employee_id) || new Map();
  const employeeDaysOff = daysOffByEmployee.get(employee.employee_id) || new Set();
  const employeeTimeOff = approvedTimeOffByEmployee.get(employee.employee_id) || new Set();
  const available = employeeAvailability.has(dayOfWeek) ? employeeAvailability.get(dayOfWeek) : true;
  const weeklyAssigned = assignedWeeklyMinutes.get(employee.employee_id) || 0;
  const weeklyTarget = Math.round(Number(employee.weekly_hours || 0) * 60);

  if (!available) reasons.push("outside availability");
  if (employeeDaysOff.has(workDateText)) reasons.push("manual day off");
  if (employeeTimeOff.has(workDateText)) reasons.push("approved time off");
  if (assignedDailyDates.has(`${employee.employee_id}:${workDateText}`)) reasons.push("already scheduled that day");
  if (weeklyTarget > 0 && weeklyAssigned >= weeklyTarget) reasons.push("weekly target reached");

  if (employee.preferred_shift_id) {
    const preferredForDay = byPreferredShift.get(employee.preferred_shift_id)?.get(dayOfWeek);
    if (preferredForDay && preferredForDay.shiftId !== shift.shiftId) reasons.push("different preferred shift");
  }

  return reasons;
}

function isEligibleForShift(args) {
  return explainSkip(args).length === 0;
}

function scoreEmployee({ employee, assignedWeeklyMinutes, lastScheduledByEmployee }) {
  const weeklyTarget = Math.max(0, Math.round(Number(employee.weekly_hours || 0) * 60));
  const assigned = assignedWeeklyMinutes.get(employee.employee_id) || 0;
  const remainingRatio = weeklyTarget > 0 ? (weeklyTarget - assigned) / weeklyTarget : 0;
  const priorityScore = Math.max(0, 26 - Number(employee.priority || 25)) / 25;
  const lastWorked = lastScheduledByEmployee.get(employee.employee_id);
  const recencyScore = lastWorked ? Math.min(1, Math.max(0, (Date.now() - new Date(`${lastWorked}T00:00:00.000Z`).getTime()) / (DAY_MS * 14))) : 1;
  const typeScore = employee.employment_type === "full_time" ? 0.04 : 0;

  return (remainingRatio * 0.62) + (priorityScore * 0.22) + (recencyScore * 0.12) + typeScore;
}

function buildHealth({ warnings, coverageSlots, cells, employeesCount, shiftsCount }) {
  const warningPenalty = warnings.reduce((total, warning) => {
    if (warning.severity === "error") return total + 18;
    if (warning.severity === "warning") return total + 9;
    return total + 4;
  }, 0);

  const coverageNeeded = coverageSlots.reduce((total, slot) => total + slot.requiredStaff, 0);
  const coverageAssigned = coverageSlots.reduce((total, slot) => total + slot.assignedCount, 0);
  const coverageRatio = coverageNeeded > 0 ? Math.min(1, coverageAssigned / coverageNeeded) : (shiftsCount > 0 ? 1 : 0);
  const baseScore = Math.round(coverageRatio * 100);
  const score = Math.max(0, Math.min(100, baseScore - warningPenalty));

  return {
    score,
    label: score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 55 ? "Needs attention" : "Critical",
    warningCount: warnings.length,
    coverageNeeded,
    coverageAssigned,
    openShiftCount: Math.max(0, coverageNeeded - coverageAssigned),
    assignedShiftCount: cells.length,
    employeeCount: employeesCount,
    enabledShiftDayCount: shiftsCount
  };
}

router.get("/", requireAuth, async (req, res) => {
  const { locationId, weekStart } = req.query;
  const weekStartDate = parseDateOnly(weekStart);

  if (!locationId || !weekStartDate) {
    return res.status(400).json({ error: "Location ID and valid week start are required." });
  }

  try {
    await assertScheduleAccess(req.user, locationId);

    const employeesResult = await pool.query(
      `SELECT
         e.id AS employee_id,
         e.priority,
         e.employee_code,
         e.title,
         e.employment_type,
         e.weekly_hours,
         e.daily_hours,
         e.preferred_shift_id,
         u.first_name,
         u.last_name,
         u.username,
         u.role,
         u.can_manage_schedule
       FROM employees e
       JOIN users u ON u.id = e.user_id
       WHERE e.business_id = $1
         AND e.location_id = $2
         AND e.active = true
         AND u.active = true
       ORDER BY e.priority ASC, u.last_name ASC, u.first_name ASC`,
      [req.user.businessId, locationId]
    );

    const availabilityResult = await pool.query(
      `SELECT ea.employee_id, ea.day_of_week, ea.available
       FROM employee_availability ea
       JOIN employees e ON e.id = ea.employee_id
       WHERE e.business_id = $1
         AND e.location_id = $2
         AND e.active = true`,
      [req.user.businessId, locationId]
    );

    const daysOffResult = await pool.query(
      `SELECT edo.employee_id, edo.day_off
       FROM employee_days_off edo
       JOIN employees e ON e.id = edo.employee_id
       WHERE e.business_id = $1
         AND e.location_id = $2
         AND e.active = true
         AND edo.day_off >= $3::date
         AND edo.day_off < ($3::date + interval '7 days')`,
      [req.user.businessId, locationId, toDateOnly(weekStartDate)]
    );

    const timeOffResult = await pool.query(
      `SELECT tor.employee_id, tor.start_date, tor.end_date
       FROM time_off_requests tor
       JOIN employees e ON e.id = tor.employee_id
       WHERE tor.business_id = $1
         AND tor.location_id = $2
         AND tor.status = 'approved'
         AND e.active = true
         AND tor.start_date < ($3::date + interval '7 days')
         AND tor.end_date >= $3::date`,
      [req.user.businessId, locationId, toDateOnly(weekStartDate)]
    );

    const shiftsResult = await pool.query(
      `SELECT
         s.id AS shift_id,
         s.name AS shift_name,
         s.sort_order,
         sd.day_of_week,
         sd.required_staff,
         sd.max_staff,
         to_char(sd.start_time, 'HH24:MI') AS start_time,
         to_char(sd.end_time, 'HH24:MI') AS end_time
       FROM shifts s
       JOIN shift_days sd ON sd.shift_id = s.id
       WHERE s.business_id = $1
         AND s.location_id = $2
         AND sd.enabled = true
         AND sd.start_time IS NOT NULL
         AND sd.end_time IS NOT NULL
         AND COALESCE(sd.required_staff, 0) > 0
       ORDER BY s.sort_order, s.name, sd.day_of_week`,
      [req.user.businessId, locationId]
    );

    const lastScheduledResult = await pool.query(
      `SELECT sc.employee_id, max(sc.work_date) AS last_worked
       FROM schedule_cells sc
       JOIN schedules sch ON sch.id = sc.schedule_id
       JOIN employees e ON e.id = sc.employee_id
       WHERE sch.business_id = $1
         AND sch.location_id = $2
         AND sc.work_date < $3::date
         AND e.active = true
       GROUP BY sc.employee_id`,
      [req.user.businessId, locationId, toDateOnly(weekStartDate)]
    );

    const availabilityByEmployee = buildAvailabilityMap(availabilityResult.rows);
    const daysOffByEmployee = buildDaysOffMap(daysOffResult.rows);
    const approvedTimeOffByEmployee = buildApprovedTimeOffMap(timeOffResult.rows);
    const lastScheduledByEmployee = buildLastScheduledMap(lastScheduledResult.rows);
    const { fallbackByDay, byPreferredShift } = buildShiftOptions(shiftsResult.rows);
    const assignedWeeklyMinutes = new Map();
    const assignedDailyDates = new Set();
    const cells = [];
    const warnings = [];
    const coverageSlots = [];
    const skipped = [];

    for (const employee of employeesResult.rows) {
      assignedWeeklyMinutes.set(employee.employee_id, 0);
    }

    if (employeesResult.rows.length === 0) {
      warnings.push({
        type: "no_active_employees",
        severity: "error",
        message: "This location has no active employees to schedule."
      });
    }

    if (shiftsResult.rows.length === 0) {
      warnings.push({
        type: "no_enabled_shifts",
        severity: "error",
        message: "This location has no enabled shift days with employees needed."
      });
    }

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const workDate = addDays(weekStartDate, dayOffset);
      const workDateText = toDateOnly(workDate);
      const dayOfWeek = dayOfWeekForDate(workDate);
      const shiftOptions = fallbackByDay.get(dayOfWeek) || [];

      for (const shift of shiftOptions) {
        const requiredStaff = Math.max(0, Number(shift.requiredStaff || 0));
        const maxStaff = shift.maxStaff === null ? null : Number(shift.maxStaff);
        const targetStaff = maxStaff ? Math.min(requiredStaff, maxStaff) : requiredStaff;
        const shiftMinutes = Math.max(0, shift.endMinutes - shift.startMinutes);

        if (shiftMinutes <= 0) {
          warnings.push({
            type: "invalid_shift_time",
            severity: "error",
            shiftId: shift.shiftId,
            date: workDateText,
            message: `${dayLabel(dayOfWeek)} ${shift.shiftName} has an invalid time range.`
          });
          continue;
        }

        if (maxStaff !== null && maxStaff < requiredStaff) {
          warnings.push({
            type: "max_below_required",
            severity: "warning",
            shiftId: shift.shiftId,
            date: workDateText,
            message: `${dayLabel(dayOfWeek)} ${shift.shiftName} needs ${requiredStaff} employees but max is ${maxStaff}.`
          });
        }

        const eligibleEmployees = [];
        const skippedForThisSlot = [];

        for (const employee of employeesResult.rows) {
          const args = {
            employee,
            dayOfWeek,
            workDateText,
            shift,
            availabilityByEmployee,
            daysOffByEmployee,
            approvedTimeOffByEmployee,
            assignedDailyDates,
            assignedWeeklyMinutes,
            byPreferredShift
          };

          const skipReasons = explainSkip(args);

          if (skipReasons.length === 0) {
            eligibleEmployees.push(employee);
          } else {
            skippedForThisSlot.push({
              employee_id: employee.employee_id,
              employee_name: employeeName(employee),
              date: workDateText,
              shift_id: shift.shiftId,
              shift_name: shift.shiftName,
              reasons: skipReasons
            });
          }
        }

        eligibleEmployees.sort((a, b) => {
          const aScore = scoreEmployee({ employee: a, assignedWeeklyMinutes, lastScheduledByEmployee });
          const bScore = scoreEmployee({ employee: b, assignedWeeklyMinutes, lastScheduledByEmployee });
          return bScore - aScore || Number(a.priority) - Number(b.priority) || String(a.last_name || "").localeCompare(String(b.last_name || ""));
        });

        const selectedEmployees = eligibleEmployees.slice(0, targetStaff);
        const openSlots = Math.max(0, requiredStaff - selectedEmployees.length);

        coverageSlots.push({
          date: workDateText,
          dayOfWeek,
          dayName: dayLabel(dayOfWeek),
          shiftId: shift.shiftId,
          shiftName: shift.shiftName,
          startTime: shift.startTime,
          endTime: shift.endTime,
          requiredStaff,
          maxStaff,
          assignedCount: selectedEmployees.length,
          openSlots,
          status: requiredStaff === 0 ? "closed" : openSlots > 0 ? "under" : "covered"
        });

        if (openSlots > 0) {
          warnings.push({
            type: "understaffed_shift",
            severity: "warning",
            shiftId: shift.shiftId,
            date: workDateText,
            message: `${dayLabel(dayOfWeek)} ${shift.shiftName} needs ${requiredStaff} employee${requiredStaff === 1 ? "" : "s"} but only ${selectedEmployees.length} can be scheduled.`
          });
          skipped.push(...skippedForThisSlot.slice(0, 8));
        }

        for (const employee of selectedEmployees) {
          const weeklyAssigned = assignedWeeklyMinutes.get(employee.employee_id) || 0;
          const weeklyTarget = Math.round(Number(employee.weekly_hours || 0) * 60);
          const maxDailyMinutes = Math.round(Number(employee.daily_hours || 0) * 60);
          const scheduledMinutes = Math.min(shiftMinutes, maxDailyMinutes, Math.max(0, weeklyTarget - weeklyAssigned));

          if (scheduledMinutes <= 0) continue;

          const nextWeeklyAssigned = weeklyAssigned + scheduledMinutes;
          const weeklyHours = Math.round((nextWeeklyAssigned / 60) * 100) / 100;
          const weeklyTargetHours = Math.round((weeklyTarget / 60) * 100) / 100;
          const lastScheduled = lastScheduledByEmployee.get(employee.employee_id) || null;

          cells.push({
            employee_id: employee.employee_id,
            priority: employee.priority,
            employee_code: employee.employee_code,
            title: employee.title,
            first_name: employee.first_name,
            last_name: employee.last_name,
            username: employee.username,
            role: employee.role,
            can_manage_schedule: employee.can_manage_schedule,
            employment_type: employee.employment_type,
            weekly_hours: Number(employee.weekly_hours || 0),
            daily_hours: Number(employee.daily_hours || 0),
            hours_this_week_after_shift: weeklyHours,
            weekly_target_hours: weeklyTargetHours,
            last_scheduled: lastScheduled,
            fairness_score: Math.round(scoreEmployee({ employee, assignedWeeklyMinutes, lastScheduledByEmployee }) * 100),
            assignment_reason: [
              `Available ${dayLabel(dayOfWeek)}`,
              "No approved/manual day off",
              `Needs ${Math.max(0, Math.round(((weeklyTarget - weeklyAssigned) / 60) * 100) / 100)} more hours this week`,
              lastScheduled ? `Last scheduled ${lastScheduled}` : "No previous scheduled shift found",
              employee.preferred_shift_id === shift.shiftId ? "Preferred shift match" : "Fits this shift"
            ],
            work_date: workDateText,
            shift_id: shift.shiftId,
            shift_name: shift.shiftName,
            start_time: timeFromMinutes(shift.startMinutes),
            end_time: timeFromMinutes(shift.startMinutes + scheduledMinutes),
            required_staff: shift.requiredStaff,
            max_staff: shift.maxStaff,
            is_forecast: true
          });

          assignedWeeklyMinutes.set(employee.employee_id, nextWeeklyAssigned);
          assignedDailyDates.add(`${employee.employee_id}:${workDateText}`);
        }
      }
    }

    for (const employee of employeesResult.rows) {
      const assigned = assignedWeeklyMinutes.get(employee.employee_id) || 0;
      const target = Math.round(Number(employee.weekly_hours || 0) * 60);

      if (target > 0 && assigned < target * 0.5) {
        warnings.push({
          type: "low_weekly_hours",
          severity: "info",
          employeeId: employee.employee_id,
          message: `${employeeName(employee)} is forecasted for ${Math.round((assigned / 60) * 100) / 100}/${Math.round((target / 60) * 100) / 100} target hours this week.`
        });
      }
    }

    cells.sort((a, b) => a.work_date.localeCompare(b.work_date) || a.shift_name.localeCompare(b.shift_name) || Number(a.priority) - Number(b.priority));

    const health = buildHealth({
      warnings,
      coverageSlots,
      cells,
      employeesCount: employeesResult.rows.length,
      shiftsCount: shiftsResult.rows.length
    });

    res.json({ cells, warnings, health, coverage: coverageSlots, skipped: skipped.slice(0, 30) });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load schedule." });
  }
});

module.exports = router;
