const API_URL = "http://localhost:3001";
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const DAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 7, short: "Sun", long: "Sunday" }
];

let accessToken = null;
let currentUser = null;
let selectedLocationId = null;
let locations = [];
let shifts = [];
let employees = [];
let currentWeekStart = startOfWeek(new Date());
let employeePage = 1;
let shiftPage = 1;
let currentPlanCode = "free";
let employeeDaysOff = new Set();

const message = document.getElementById("message");

const signupFieldIds = [
  "signupFirstName",
  "signupLastName",
  "signupBusinessName",
  "signupEmail",
  "signupUsername",
  "signupPassword"
];

function $(id) {
  return document.getElementById(id);
}

function dashboardWelcomeText() {
  const login = currentUser?.fullLogin || currentUser?.username || currentUser?.email || "";
  return login ? `Welcome aboard, ${login}` : "Welcome aboard";
}

function showMessage(text) {
  const loginText = $("dashboardLoginText");

  if (loginText && text.startsWith("Welcome aboard,")) {
    loginText.textContent = text.replace("Welcome aboard,", "").trim();
    return;
  }

  if (message) message.textContent = text;
}

function isOwner() {
  return currentUser?.role === "owner";
}

function canManageSchedule() {
  return !!currentUser && (currentUser.role === "owner" || currentUser.canManageSchedule);
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateForLabel(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanUsernameInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}

function normalizePasswordInput(value) {
  return String(value || "").normalize("NFKC");
}

function isValidPasswordInput(value) {
  const normalizedPassword = normalizePasswordInput(value);

  return (
    normalizedPassword.length >= PASSWORD_MIN_LENGTH &&
    normalizedPassword.length <= PASSWORD_MAX_LENGTH
  );
}

function isValidEmailInput(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function setNotice(id, type, text) {
  const notice = $(id);
  if (!notice) return;

  if (!text) {
    notice.className = "formNotice hidden";
    notice.textContent = "";
    return;
  }

  notice.className = `formNotice ${type}`;
  notice.textContent = text;
}

function setFieldState(inputId, state, message) {
  const input = $(inputId);
  const group = document.querySelector(`[data-field="${inputId}"]`);
  const status = $(`${inputId}Status`);

  if (!input || !group) return;

  group.classList.remove("is-valid", "is-invalid");

  if (state === "valid") {
    group.classList.add("is-valid");
    input.setAttribute("aria-invalid", "false");
    if (status) status.textContent = `✓ ${message}`;
    return;
  }

  if (state === "invalid") {
    group.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    if (status) status.textContent = message;
    return;
  }

  input.removeAttribute("aria-invalid");
  if (status) status.textContent = message;
}

function validateSignupField(inputId, showEmptyErrors = false) {
  const input = $(inputId);
  if (!input) return false;

  const value = input.value.trim();

  if (["signupFirstName", "signupLastName", "signupBusinessName"].includes(inputId)) {
    if (!value) {
      setFieldState(inputId, showEmptyErrors ? "invalid" : "neutral", "Required");
      return false;
    }

    setFieldState(inputId, "valid", "Looks good");
    return true;
  }

  if (inputId === "signupEmail") {
    if (!value) {
      setFieldState(inputId, showEmptyErrors ? "invalid" : "neutral", "Required");
      return false;
    }

    if (!isValidEmailInput(value)) {
      setFieldState(inputId, "invalid", "Enter a valid email");
      return false;
    }

    setFieldState(inputId, "valid", "Valid email");
    return true;
  }

  if (inputId === "signupUsername") {
    const cleaned = cleanUsernameInput(input.value);

    if (input.value !== cleaned) input.value = cleaned;

    if (!cleaned || cleaned.length < 3) {
      setFieldState(inputId, showEmptyErrors ? "invalid" : "neutral", "3–30 letters or numbers");
      return false;
    }

    setFieldState(inputId, "valid", "Username works");
    return true;
  }

  if (inputId === "signupPassword") {
    const normalizedPassword = normalizePasswordInput(input.value);

    if (!normalizedPassword || !isValidPasswordInput(normalizedPassword)) {
      setFieldState(inputId, showEmptyErrors ? "invalid" : "neutral", "12–128 characters");
      return false;
    }

    setFieldState(inputId, "valid", "Password length works");
    return true;
  }

  return true;
}

function validateSignupForm(showEmptyErrors = false) {
  return signupFieldIds.map((id) => validateSignupField(id, showEmptyErrors)).every(Boolean);
}

async function api(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 402 && isOwner()) {
      openPlanDialog().catch(() => {});
    }

    throw new Error(data.error || "Request failed");
  }

  return data;
}

function applyRoleUI() {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  const owner = isOwner();
  const canManage = canManageSchedule();

  $("upgradeButton").classList.toggle("hidden", !owner);
  $("currentPlanText").classList.toggle("hidden", !owner);
  $("ownerLocationTools").classList.toggle("hidden", !owner);
  $("shiftForm").classList.toggle("hidden", !owner);

  document.querySelectorAll(".ownerOnly").forEach((el) => {
    el.classList.toggle("hidden", !owner);
  });

  document.querySelectorAll(".nonOwnerOnly").forEach((el) => {
    el.classList.toggle("hidden", owner);
  });

  document.querySelectorAll(".managerOnly").forEach((el) => {
    el.classList.toggle("hidden", !canManage);
  });

  document.querySelectorAll(".employeeOnlyHidden").forEach((el) => {
    el.classList.toggle("hidden", currentUser?.role === "employee");
  });

  showMessage(dashboardWelcomeText());
}

async function signup() {
  setNotice("signupFormMessage", "", "");

  if (!validateSignupForm(true)) {
    setNotice("signupFormMessage", "error", "Please fix the highlighted fields before creating your account.");
    const firstInvalid = document.querySelector(".fieldGroup.is-invalid input");
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  const body = {
    firstName: $("signupFirstName").value.trim(),
    lastName: $("signupLastName").value.trim(),
    businessName: $("signupBusinessName").value.trim(),
    email: $("signupEmail").value.trim(),
    username: cleanUsernameInput($("signupUsername").value),
    password: normalizePasswordInput($("signupPassword").value)
  };

  try {
    const data = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify(body)
    });

    setNotice(
      "signupFormMessage",
      "success",
      `Account created. Your login is ${data.fullLogin}. Use this exact login with your password to sign in.`
    );
  } catch (err) {
    setNotice("signupFormMessage", "error", err.message);
  }
}

async function login() {
  setNotice("loginFormMessage", "", "");

  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        login: $("loginValue").value,
        password: normalizePasswordInput($("loginPassword").value)
      })
    });

    accessToken = data.accessToken;
    currentUser = data.user;

    applyRoleUI();
    await loadPlans(false);
    await loadLocations();
  } catch (err) {
    setNotice("loginFormMessage", "error", err.message);
  }
}

async function loadLocations() {
  const data = await api("/locations");
  locations = data.locations || [];

  if (locations.length === 0) {
    selectedLocationId = null;
    renderLocations();
    renderEmptySchedule();
    return;
  }

  if (!selectedLocationId || !locations.some((location) => location.id === selectedLocationId)) {
    selectedLocationId = locations[0].id;
  }

  renderLocations();
  await loadSelectedLocationData();
}

function renderLocations() {
  const list = $("locationList");

  if (!locations.length) {
    list.innerHTML = `<div class="emptyState">No locations found.</div>`;
    return;
  }

  list.innerHTML = locations.map((location) => {
    const active = location.id === selectedLocationId;
    const ownerControls = isOwner()
      ? `
        <div class="rowActions">
          <button class="button ghost" data-action="edit-location" data-id="${escapeHtml(location.id)}">Edit</button>
          <button class="button danger" data-action="delete-location" data-id="${escapeHtml(location.id)}">Delete</button>
        </div>
      `
      : "";

    return `
      <article class="locationItem ${active ? "active" : ""}" data-action="select-location" data-id="${escapeHtml(location.id)}">
        <div>
          <strong>${escapeHtml(location.name)}</strong>
          <span>${escapeHtml(location.address || "No address")}</span>
        </div>
        ${ownerControls}
      </article>
    `;
  }).join("");
}

async function loadSelectedLocationData() {
  await loadSchedule();

  if (canManageSchedule()) {
    await Promise.all([loadShifts(), loadEmployees()]);
  }
}

async function addLocation() {
  const nameInput = $("newLocationName");
  const addressInput = $("newLocationAddress");
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.classList.add("inputInvalid");
    return;
  }

  nameInput.classList.remove("inputInvalid");

  try {
    await api("/locations", {
      method: "POST",
      body: JSON.stringify({ name, address: addressInput.value.trim() || null })
    });

    nameInput.value = "";
    addressInput.value = "";
    await loadLocations();
  } catch (err) {
    showMessage(err.message);
  }
}

async function editLocation(locationId) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;

  const name = prompt("Location name:", location.name);
  if (name === null) return;

  const trimmedName = name.trim();
  if (!trimmedName) {
    showMessage("Location name is required.");
    return;
  }

  const address = prompt("Location address optional:", location.address || "");
  if (address === null) return;

  try {
    await api(`/locations/${encodeURIComponent(locationId)}`, {
      method: "PUT",
      body: JSON.stringify({ name: trimmedName, address: address.trim() || null })
    });

    await loadLocations();
  } catch (err) {
    showMessage(err.message);
  }
}

async function deleteLocation(locationId) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;

  const actorPassword = prompt(`Enter your owner password to delete ${location.name}. This also removes its shifts and employees.`);
  if (!actorPassword) return;

  try {
    await api(`/locations/${encodeURIComponent(locationId)}`, {
      method: "DELETE",
      body: JSON.stringify({ actorPassword })
    });

    selectedLocationId = null;
    await loadLocations();
  } catch (err) {
    showMessage(err.message);
  }
}

async function loadSchedule() {
  if (!selectedLocationId) {
    renderEmptySchedule();
    return;
  }

  const weekEnd = addDays(currentWeekStart, 6);
  $("weekLabel").textContent = `${formatDateForLabel(currentWeekStart)} – ${formatDateForLabel(weekEnd)}`;

  const data = await api(
    `/schedules?locationId=${encodeURIComponent(selectedLocationId)}&weekStart=${dateOnly(currentWeekStart)}`
  );

  renderSchedule(data.cells || []);
}

function renderEmptySchedule() {
  const table = $("scheduleTable");

  table.innerHTML = `
    <thead>
      <tr>
        <th>Schedule</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>No schedule data yet.</td>
      </tr>
    </tbody>
  `;
}

function renderSchedule(cells) {
  const table = $("scheduleTable");
  const grouped = new Map();

  for (const cell of cells) {
    if (!grouped.has(cell.employee_id)) {
      grouped.set(cell.employee_id, {
        priority: cell.priority,
        employeeCode: cell.employee_code,
        employee: `${cell.first_name || ""} ${cell.last_name || ""}`.trim() || cell.username,
        title: cell.title,
        days: {}
      });
    }

    grouped.get(cell.employee_id).days[cell.work_date] = cell;
  }

  table.innerHTML = `
    <thead>
      <tr>
        <th>Priority</th>
        <th>Employee #</th>
        <th>Employee</th>
        <th>Title</th>
        ${DAYS.map((day, index) => {
          const current = addDays(currentWeekStart, index);
          return `<th>${day.long}<span class="dateSub">${dateOnly(current)}</span></th>`;
        }).join("")}
      </tr>
    </thead>
    <tbody>
      ${
        grouped.size === 0
          ? `<tr><td colspan="11">No forecasted schedule for this week. Add a location, shifts, and employees with available days.</td></tr>`
          : [...grouped.values()].map((row) => `
            <tr>
              <td>${escapeHtml(row.priority)}</td>
              <td>${escapeHtml(row.employeeCode)}</td>
              <td>${escapeHtml(row.employee)}</td>
              <td>${escapeHtml(row.title)}</td>
              ${DAYS.map((day, index) => {
                const current = dateOnly(addDays(currentWeekStart, index));
                const cell = row.days[current];

                if (!cell) return `<td class="mutedCell">Off</td>`;

                return `
                  <td>
                    <strong>${escapeHtml(cell.shift_name || "Shift")}</strong>
                    <span>${escapeHtml((cell.start_time || "").slice(0, 5))}–${escapeHtml((cell.end_time || "").slice(0, 5))}</span>
                  </td>
                `;
              }).join("")}
            </tr>
          `).join("")
      }
    </tbody>
  `;
}

function defaultShiftDays() {
  return DAYS.map((day) => ({
    dayOfWeek: day.value,
    enabled: day.value <= 5,
    startTime: day.value <= 5 ? "08:00" : "",
    endTime: day.value <= 5 ? "17:00" : ""
  }));
}

function renderShiftDayEditor(days = defaultShiftDays()) {
  const map = new Map(days.map((day) => [Number(day.dayOfWeek), day]));

  $("shiftDayEditor").innerHTML = DAYS.map((day) => {
    const value = map.get(day.value) || {
      dayOfWeek: day.value,
      enabled: false,
      startTime: "",
      endTime: ""
    };

    return `
      <div class="dayTimeRow" data-day="${day.value}">
        <label class="checkboxLine">
          <input type="checkbox" class="shiftDayEnabled" ${value.enabled ? "checked" : ""} />
          ${day.short}
        </label>
        <input type="time" class="shiftStart" value="${escapeHtml(value.startTime || "")}" />
        <input type="time" class="shiftEnd" value="${escapeHtml(value.endTime || "")}" />
      </div>
    `;
  }).join("");
}

function collectShiftDays() {
  return [...document.querySelectorAll("#shiftDayEditor .dayTimeRow")].map((row) => {
    const enabled = row.querySelector(".shiftDayEnabled").checked;

    return {
      dayOfWeek: Number(row.dataset.day),
      enabled,
      startTime: enabled ? row.querySelector(".shiftStart").value : null,
      endTime: enabled ? row.querySelector(".shiftEnd").value : null
    };
  });
}

function resetShiftForm() {
  $("shiftId").value = "";
  $("shiftName").value = "Standard";
  $("shiftSortOrder").value = "1";
  renderShiftDayEditor(defaultShiftDays());
}

async function saveShift(event) {
  event.preventDefault();

  if (!selectedLocationId) {
    showMessage("Select a location first.");
    return;
  }

  const shiftId = $("shiftId").value;
  const body = {
    locationId: selectedLocationId,
    name: $("shiftName").value.trim(),
    sortOrder: Number($("shiftSortOrder").value || 1),
    days: collectShiftDays()
  };

  if (!body.name) {
    showMessage("Shift name is required.");
    return;
  }

  try {
    await api(shiftId ? `/shifts/${encodeURIComponent(shiftId)}` : "/shifts", {
      method: shiftId ? "PUT" : "POST",
      body: JSON.stringify(body)
    });

    resetShiftForm();
    await Promise.all([loadShifts(), loadSchedule()]);
  } catch (err) {
    showMessage(err.message);
  }
}

async function loadShifts() {
  if (!selectedLocationId || !canManageSchedule()) return;

  const filter = $("shiftFilter").value.trim();

  const data = await api(
    `/shifts?locationId=${encodeURIComponent(selectedLocationId)}&page=${shiftPage}&pageSize=100&filter=${encodeURIComponent(filter)}`
  );

  shifts = data.shifts || [];
  renderShifts();
  populatePreferredShiftSelect();
}

function renderShifts() {
  const list = $("shiftList");

  if (!shifts.length) {
    list.innerHTML = `<div class="emptyState">No shifts found for this location.</div>`;
    return;
  }

  list.innerHTML = shifts.map((shift) => {
    const days = Array.isArray(shift.days) ? shift.days : [];
    const summary = days
      .filter((day) => day.enabled)
      .map((day) => {
        const label = DAYS.find((item) => item.value === Number(day.dayOfWeek))?.short || day.dayOfWeek;
        return `${label} ${day.startTime || ""}–${day.endTime || ""}`;
      })
      .join(", ") || "No active days";

    const ownerButtons = isOwner()
      ? `
        <div class="rowActions">
          <button class="button ghost" data-action="edit-shift" data-id="${escapeHtml(shift.id)}">Edit</button>
          <button class="button danger" data-action="delete-shift" data-id="${escapeHtml(shift.id)}">Delete</button>
        </div>
      `
      : "";

    return `
      <article class="listItem">
        <div>
          <strong>${escapeHtml(shift.name)}</strong>
          <span>${escapeHtml(summary)}</span>
        </div>
        ${ownerButtons}
      </article>
    `;
  }).join("");
}

function editShift(shiftId) {
  const shift = shifts.find((item) => item.id === shiftId);
  if (!shift) return;

  $("shiftId").value = shift.id;
  $("shiftName").value = shift.name;
  $("shiftSortOrder").value = shift.sort_order || 1;
  renderShiftDayEditor(shift.days || defaultShiftDays());
  $("shiftName").focus();
}

async function deleteShift(shiftId) {
  const shift = shifts.find((item) => item.id === shiftId);
  if (!shift) return;

  const actorPassword = prompt(`Enter your owner password to delete shift ${shift.name}.`);
  if (!actorPassword) return;

  try {
    await api(`/shifts/${encodeURIComponent(shiftId)}`, {
      method: "DELETE",
      body: JSON.stringify({ actorPassword })
    });

    await Promise.all([loadShifts(), loadSchedule()]);
  } catch (err) {
    showMessage(err.message);
  }
}

function defaultAvailability() {
  return DAYS.map((day) => ({ dayOfWeek: day.value, available: true }));
}

function renderAvailabilityEditor(availability = defaultAvailability()) {
  const map = new Map(availability.map((item) => [Number(item.dayOfWeek), Boolean(item.available)]));

  $("availabilityEditor").innerHTML = DAYS.map((day) => {
    const available = map.has(day.value) ? map.get(day.value) : true;

    return `
      <button type="button" class="dotDay ${available ? "active" : ""}" data-day="${day.value}" aria-pressed="${available}">
        <span class="dot"></span>
        ${day.short}
      </button>
    `;
  }).join("");
}

function collectAvailability() {
  return [...document.querySelectorAll("#availabilityEditor .dotDay")].map((button) => ({
    dayOfWeek: Number(button.dataset.day),
    available: button.classList.contains("active")
  }));
}

function normalizeDaysOffArray(values) {
  return [...new Set((values || []).map((value) => String(value).slice(0, 10)).filter(Boolean))].sort();
}

function renderDaysOffList() {
  const values = [...employeeDaysOff].sort();

  $("daysOffList").innerHTML = values.length
    ? values.map((value) => `
      <button type="button" class="pill" data-action="remove-day-off" data-date="${escapeHtml(value)}">
        ${escapeHtml(value)} ×
      </button>
    `).join("")
    : `<span class="fieldHelp">No requested days off.</span>`;
}

function addDayOff() {
  const value = $("daysOffInput").value;
  if (!value) return;

  employeeDaysOff.add(value);
  $("daysOffInput").value = "";
  renderDaysOffList();
}

function removeDayOff(value) {
  employeeDaysOff.delete(value);
  renderDaysOffList();
}

function populatePreferredShiftSelect(selected = "") {
  const select = $("preferredShiftId");
  if (!select) return;

  select.innerHTML = `<option value="">No preference</option>` + shifts.map((shift) => `
    <option value="${escapeHtml(shift.id)}" ${shift.id === selected ? "selected" : ""}>${escapeHtml(shift.name)}</option>
  `).join("");
}

function resetEmployeeForm() {
  $("employeeId").value = "";
  $("employeeCode").value = "";
  $("employeeTitle").value = "";
  $("employeeFirstName").value = "";
  $("employeeLastName").value = "";
  $("employeeUsername").value = "";
  $("employeePassword").value = "";
  $("employmentType").value = "full_time";
  $("weeklyHours").value = "40";
  $("dailyHours").value = "8";
  $("employeePriority").value = "1";
  $("orientationStart").value = "";
  $("canManageSchedule").checked = false;
  employeeDaysOff = new Set();
  renderAvailabilityEditor(defaultAvailability());
  renderDaysOffList();
  populatePreferredShiftSelect();
}

async function loadEmployees() {
  if (!selectedLocationId || !canManageSchedule()) return;

  const data = await api(
    `/employees?locationId=${encodeURIComponent(selectedLocationId)}&page=${employeePage}&pageSize=100`
  );

  employees = data.employees || [];
  renderEmployees();
}

function renderEmployees() {
  const list = $("employeeList");

  if (!employees.length) {
    list.innerHTML = `<div class="emptyState">No employees found for this location.</div>`;
    return;
  }

  list.innerHTML = employees.map((employee) => {
    const availability = Array.isArray(employee.availability) ? employee.availability : [];
    const availableDays = availability
      .filter((day) => day.available)
      .sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek))
      .map((day) => DAYS.find((item) => item.value === Number(day.dayOfWeek))?.short)
      .join(", ") || "No days";

    const daysOff = normalizeDaysOffArray(employee.days_off);
    const deleteButton = isOwner()
      ? `<button class="button danger" data-action="delete-employee" data-id="${escapeHtml(employee.id)}">Delete</button>`
      : "";

    return `
      <article class="listItem">
        <div>
          <strong>${escapeHtml(employee.employee_code)} — ${escapeHtml(`${employee.first_name || ""} ${employee.last_name || ""}`.trim())}</strong>
          <span>${escapeHtml(employee.title)} · ${escapeHtml(employee.employment_type)} · ${escapeHtml(employee.weekly_hours)} hrs/week · Available: ${escapeHtml(availableDays)}</span>
          <span>Days off: ${escapeHtml(daysOff.join(", ") || "None")}</span>
        </div>
        <div class="rowActions">
          <button class="button ghost" data-action="edit-employee" data-id="${escapeHtml(employee.id)}">Edit</button>
          ${deleteButton}
        </div>
      </article>
    `;
  }).join("");
}

function editEmployee(employeeId) {
  const employee = employees.find((item) => item.id === employeeId);
  if (!employee) return;

  $("employeeForm").classList.remove("hidden");
  $("employeeId").value = employee.id;
  $("employeeCode").value = employee.employee_code || "";
  $("employeeTitle").value = employee.title || "";
  $("employeeFirstName").value = employee.first_name || "";
  $("employeeLastName").value = employee.last_name || "";
  $("employeeUsername").value = employee.username || "";
  $("employeePassword").value = "";
  $("employmentType").value = employee.employment_type || "full_time";
  $("weeklyHours").value = employee.weekly_hours || "40";
  $("dailyHours").value = employee.daily_hours || "8";
  $("employeePriority").value = employee.priority || "1";
  $("orientationStart").value = employee.orientation_start ? String(employee.orientation_start).slice(0, 10) : "";
  $("canManageSchedule").checked = Boolean(employee.can_manage_schedule);
  employeeDaysOff = new Set(normalizeDaysOffArray(employee.days_off));
  renderAvailabilityEditor(employee.availability || defaultAvailability());
  renderDaysOffList();
  populatePreferredShiftSelect(employee.preferred_shift_id || "");
  $("employeeCode").focus();
}

async function saveEmployee(event) {
  event.preventDefault();

  if (!selectedLocationId) {
    showMessage("Select a location first.");
    return;
  }

  const employeeId = $("employeeId").value;
  const body = {
    locationId: selectedLocationId,
    employeeCode: $("employeeCode").value.trim(),
    title: $("employeeTitle").value.trim(),
    firstName: $("employeeFirstName").value.trim(),
    lastName: $("employeeLastName").value.trim(),
    username: cleanUsernameInput($("employeeUsername").value),
    password: normalizePasswordInput($("employeePassword").value),
    employmentType: $("employmentType").value,
    weeklyHours: Number($("weeklyHours").value),
    dailyHours: Number($("dailyHours").value),
    priority: Number($("employeePriority").value),
    preferredShiftId: $("preferredShiftId").value || null,
    orientationStart: $("orientationStart").value || null,
    availability: collectAvailability(),
    daysOff: [...employeeDaysOff],
    canManageSchedule: $("canManageSchedule").checked
  };

  if (!body.employeeCode || !body.username || (!employeeId && !body.password)) {
    showMessage("Employee #, username, and password for new employees are required.");
    return;
  }

  if (!employeeId && !isValidPasswordInput(body.password)) {
    showMessage("Password must be 12–128 characters.");
    return;
  }

  try {
    await api(employeeId ? `/employees/${encodeURIComponent(employeeId)}` : "/employees", {
      method: employeeId ? "PUT" : "POST",
      body: JSON.stringify(body)
    });

    resetEmployeeForm();
    $("employeeForm").classList.add("hidden");
    await Promise.all([loadEmployees(), loadSchedule()]);
  } catch (err) {
    showMessage(err.message);
  }
}

async function deleteEmployee(employeeId) {
  const employee = employees.find((item) => item.id === employeeId);
  if (!employee) return;

  const actorPassword = prompt(`Enter your owner password to delete employee ${employee.employee_code}.`);
  if (!actorPassword) return;

  try {
    await api(`/employees/${encodeURIComponent(employeeId)}`, {
      method: "DELETE",
      body: JSON.stringify({ actorPassword })
    });

    await Promise.all([loadEmployees(), loadSchedule()]);
  } catch (err) {
    showMessage(err.message);
  }
}

async function loadPlans(renderDialog = true) {
  if (!accessToken) return;

  try {
    const data = await api("/plans");
    currentPlanCode = data.currentPlan || "free";
    const current = (data.plans || []).find((plan) => plan.code === currentPlanCode);
    $("currentPlanText").innerHTML = `Current Plan: <strong>${escapeHtml(current?.name || "Free")}</strong>`;

    if (renderDialog) {
      renderPlans(data.plans || [], currentPlanCode);
    }
  } catch (err) {
    showMessage(err.message);
  }
}

function planFeatures(plan) {
  const employeeLimit = plan.employee_limit === null ? "Unlimited employees" : `${plan.employee_limit} employee${plan.employee_limit === 1 ? "" : "s"}`;
  const featureMap = {
    free: ["Forever schedule forecast", employeeLimit, "Single location starter tools"],
    plus: ["Everything in Free", employeeLimit, "Manager-assisted scheduling"],
    premium: ["Everything in Plus", employeeLimit, "Multi-location growth support"],
    pro: ["Everything in Premium", employeeLimit, "Full business scheduling scale"]
  };

  return featureMap[plan.code] || [employeeLimit, "Automatic scheduling", "Clean desktop dashboard"];
}

function renderPlans(plans, currentPlan) {
  const list = $("planList");

  list.innerHTML = plans.map((plan) => {
    const price = plan.monthly_price_cents === 0
      ? "$0"
      : `$${(plan.monthly_price_cents / 100).toFixed(0)}`;

    const active = plan.code === currentPlan;

    return `
      <article class="planCard ${active ? "active" : ""}">
        <div>
          <p class="eyebrow">${active ? "Current plan" : "Upgrade option"}</p>
          <h3>${escapeHtml(plan.name)}</h3>
          <div class="planPrice">${price}<span>/month</span></div>
        </div>
        <ul>
          ${planFeatures(plan).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
        </ul>
        <button class="button ${active ? "secondary" : "primary"}" data-action="select-plan" data-code="${escapeHtml(plan.code)}" ${active ? "disabled" : ""}>
          ${active ? "Current Plan" : `Choose ${escapeHtml(plan.name)}`}
        </button>
      </article>
    `;
  }).join("");
}

async function openPlanDialog() {
  await loadPlans(true);
  $("planDialog").showModal();
}

async function changePlan(planCode) {
  try {
    await api("/plans/change", {
      method: "POST",
      body: JSON.stringify({ planCode })
    });

    await loadPlans(true);
    await loadEmployees();
  } catch (err) {
    showMessage(err.message);
  }
}

function printSchedule() {
  window.print();
}

function setupEvents() {
  $("signupButton").addEventListener("click", signup);
  $("loginButton").addEventListener("click", login);

  signupFieldIds.forEach((id) => {
    const input = $(id);
    if (input) {
      input.addEventListener("input", () => validateSignupField(id, false));
      input.addEventListener("blur", () => validateSignupField(id, true));
    }
  });

  $("addLocationButton").addEventListener("click", addLocation);
  $("locationList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "select-location") {
      selectedLocationId = id;
      renderLocations();
      await loadSelectedLocationData();
    }

    if (action === "edit-location") {
      event.stopPropagation();
      await editLocation(id);
    }

    if (action === "delete-location") {
      event.stopPropagation();
      await deleteLocation(id);
    }
  });

  $("prevWeekButton").addEventListener("click", async () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    await loadSchedule();
  });

  $("nextWeekButton").addEventListener("click", async () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    await loadSchedule();
  });

  $("printScheduleButton").addEventListener("click", printSchedule);

  $("shiftForm").addEventListener("submit", saveShift);
  $("resetShiftButton").addEventListener("click", resetShiftForm);
  $("shiftFilter").addEventListener("input", async () => {
    shiftPage = 1;
    await loadShifts();
  });
  $("shiftList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "edit-shift") editShift(button.dataset.id);
    if (button.dataset.action === "delete-shift") await deleteShift(button.dataset.id);
  });

  $("prevShiftPage").addEventListener("click", async () => {
    shiftPage = Math.max(1, shiftPage - 1);
    await loadShifts();
  });

  $("nextShiftPage").addEventListener("click", async () => {
    shiftPage += 1;
    await loadShifts();
  });

  $("showEmployeeFormButton").addEventListener("click", () => {
    resetEmployeeForm();
    $("employeeForm").classList.remove("hidden");
  });

  $("employeeForm").addEventListener("submit", saveEmployee);
  $("cancelEmployeeButton").addEventListener("click", () => {
    resetEmployeeForm();
    $("employeeForm").classList.add("hidden");
  });

  $("availabilityEditor").addEventListener("click", (event) => {
    const button = event.target.closest(".dotDay");
    if (!button) return;

    button.classList.toggle("active");
    button.setAttribute("aria-pressed", button.classList.contains("active"));
  });

  $("addDayOffButton").addEventListener("click", addDayOff);
  $("daysOffList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='remove-day-off']");
    if (button) removeDayOff(button.dataset.date);
  });

  $("employmentType").addEventListener("change", () => {
    if ($("employmentType").value === "full_time") {
      $("weeklyHours").value = "40";
      $("dailyHours").value = "8";
    } else {
      $("weeklyHours").value = "22.5";
      $("dailyHours").value = "4.5";
    }
  });

  $("employeeList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "edit-employee") editEmployee(button.dataset.id);
    if (button.dataset.action === "delete-employee") await deleteEmployee(button.dataset.id);
  });

  $("prevEmployeePage").addEventListener("click", async () => {
    employeePage = Math.max(1, employeePage - 1);
    await loadEmployees();
  });

  $("nextEmployeePage").addEventListener("click", async () => {
    employeePage += 1;
    await loadEmployees();
  });

  $("upgradeButton").addEventListener("click", openPlanDialog);
  $("closePlanDialog").addEventListener("click", () => $("planDialog").close());
  $("planList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action='select-plan']");
    if (!button || button.disabled) return;
    await changePlan(button.dataset.code);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  renderShiftDayEditor(defaultShiftDays());
  renderAvailabilityEditor(defaultAvailability());
  renderDaysOffList();
  resetShiftForm();
  resetEmployeeForm();
});
