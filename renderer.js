const API_URL = "http://localhost:3001";
const FORECAST_WEEKS = 3;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

let accessToken = null;
let currentUser = null;
let selectedLocationId = null;
let currentWeekStart = startOfWeek(new Date());
let employeePage = 1;
let shiftPage = 1;

const message = document.getElementById("message");

const signupFieldIds = [
  "signupFirstName",
  "signupLastName",
  "signupBusinessName",
  "signupEmail",
  "signupUsername",
  "signupPassword"
];

function dashboardWelcomeText() {
  const login = currentUser?.fullLogin || currentUser?.username || currentUser?.email || "";
  return login ? `Welcome aboard, ${login}.` : "Welcome aboard.";
}

function showMessage(text) {
  if (message) message.textContent = text;
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

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDayNumber(dayOfWeek) {
  const labels = {
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
    6: "Sat",
    7: "Sun"
  };

  return labels[dayOfWeek] || dayOfWeek;
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
  const notice = document.getElementById(id);
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
  const input = document.getElementById(inputId);
  const group = document.querySelector(`[data-field="${inputId}"]`);
  const status = document.getElementById(`${inputId}Status`);

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
  const input = document.getElementById(inputId);
  if (!input) return false;

  const value = input.value.trim();

  if (inputId === "signupFirstName") {
    if (!value) {
      setFieldState(inputId, showEmptyErrors ? "invalid" : "neutral", "Required");
      return false;
    }

    setFieldState(inputId, "valid", "Looks good");
    return true;
  }

  if (inputId === "signupLastName") {
    if (!value) {
      setFieldState(inputId, showEmptyErrors ? "invalid" : "neutral", "Required");
      return false;
    }

    setFieldState(inputId, "valid", "Looks good");
    return true;
  }

  if (inputId === "signupBusinessName") {
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

    if (input.value !== cleaned) {
      input.value = cleaned;
    }

    if (!cleaned) {
      setFieldState(inputId, showEmptyErrors ? "invalid" : "neutral", "3–30 letters or numbers");
      return false;
    }

    if (cleaned.length < 3) {
      setFieldState(inputId, "invalid", "3–30 letters or numbers");
      return false;
    }

    setFieldState(inputId, "valid", "Username works");
    return true;
  }

  if (inputId === "signupPassword") {
    const normalizedPassword = normalizePasswordInput(input.value);

    if (!normalizedPassword) {
      setFieldState(inputId, showEmptyErrors ? "invalid" : "neutral", "12–128 characters");
      return false;
    }

    if (!isValidPasswordInput(normalizedPassword)) {
      setFieldState(inputId, "invalid", "12–128 characters");
      return false;
    }

    setFieldState(inputId, "valid", "Password length works");
    return true;
  }

  return true;
}

function validateSignupForm(showEmptyErrors = false) {
  const results = signupFieldIds.map((id) => validateSignupField(id, showEmptyErrors));
  return results.every(Boolean);
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
    if (res.status === 402 && currentUser?.role === "owner") {
      openPlanDialog().catch(() => {});
    }

    throw new Error(data.error || "Request failed");
  }

  return data;
}

function applyRoleUI() {
  document.getElementById("authView").classList.add("hidden");
  document.getElementById("appView").classList.remove("hidden");

  const isOwner = currentUser.role === "owner";
  const canManage = canManageSchedule();

  document.getElementById("upgradeButton").classList.toggle("hidden", !isOwner);
  document.getElementById("ownerLocationTools").classList.toggle("hidden", !isOwner);

  document.querySelectorAll(".managerOnly").forEach((el) => {
    el.classList.toggle("hidden", !canManage);
  });

  document.getElementById("generateScheduleButton").classList.toggle("hidden", !canManage);

  showMessage(dashboardWelcomeText());
}

async function signup() {
  setNotice("signupFormMessage", "", "");

  const valid = validateSignupForm(true);

  if (!valid) {
    setNotice("signupFormMessage", "error", "Please fix the highlighted fields before creating your account.");

    const firstInvalid = document.querySelector(".fieldGroup.is-invalid input");
    if (firstInvalid) firstInvalid.focus();

    return;
  }

  const username = cleanUsernameInput(document.getElementById("signupUsername").value);
  const password = normalizePasswordInput(document.getElementById("signupPassword").value);

  const body = {
    firstName: document.getElementById("signupFirstName").value.trim(),
    lastName: document.getElementById("signupLastName").value.trim(),
    businessName: document.getElementById("signupBusinessName").value.trim(),
    email: document.getElementById("signupEmail").value.trim(),
    username,
    password
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
        login: document.getElementById("loginValue").value,
        password: normalizePasswordInput(document.getElementById("loginPassword").value)
      })
    });

    accessToken = data.accessToken;
    currentUser = data.user;

    applyRoleUI();
    await loadLocations();
  } catch (err) {
    setNotice("loginFormMessage", "error", err.message);
  }
}

async function loadLocations() {
  const data = await api("/locations");
  const select = document.getElementById("locationSelect");

  if (!data.locations || data.locations.length === 0) {
    select.innerHTML = `<option value="">No locations found</option>`;
    selectedLocationId = null;
    renderEmptySchedule();
    return;
  }

  select.innerHTML = data.locations
    .map((location) => `<option value="${escapeHtml(location.id)}">${escapeHtml(location.name)}</option>`)
    .join("");

  selectedLocationId = select.value || data.locations[0]?.id || null;

  if (selectedLocationId) {
    await loadSelectedLocationData();
  }
}

async function loadSelectedLocationData() {
  await loadSchedule();

  if (canManageSchedule()) {
    await Promise.all([loadEmployees(), loadShifts()]);
  }
}

async function addLocation() {
  const input = document.getElementById("newLocationName");
  const name = input.value.trim();

  if (!name) {
    input.classList.add("inputInvalid");
    return;
  }

  input.classList.remove("inputInvalid");

  try {
    await api("/locations", {
      method: "POST",
      body: JSON.stringify({ name })
    });

    input.value = "";
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

  document.getElementById("weekLabel").textContent = dateOnly(currentWeekStart);

  const data = await api(
    `/schedules?locationId=${encodeURIComponent(selectedLocationId)}&weekStart=${dateOnly(currentWeekStart)}`
  );

  renderSchedule(data.cells || []);
}

function renderEmptySchedule() {
  const table = document.getElementById("scheduleTable");

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
  const table = document.getElementById("scheduleTable");
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const grouped = new Map();

  for (const cell of cells) {
    if (!grouped.has(cell.employee_id)) {
      grouped.set(cell.employee_id, {
        priority: cell.priority,
        employee: `${cell.first_name} ${cell.last_name}`,
        title: cell.title,
        days: {}
      });
    }

    grouped.get(cell.employee_id).days[cell.work_date] = cell;
  }

  if (grouped.size === 0) {
    table.innerHTML = `
      <thead>
        <tr>
          <th>Priority</th>
          <th>Employee</th>
          <th>Title</th>
          ${days.map((day) => `<th>${day}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="10">No schedule generated for this week yet.</td>
        </tr>
      </tbody>
    `;
    return;
  }

  table.innerHTML = `
    <thead>
      <tr>
        <th>Priority</th>
        <th>Employee</th>
        <th>Title</th>
        ${days.map((day) => `<th>${day}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${Array.from(grouped.values())
        .map((row, index) => {
          const dayCells = days.map((_, dayIndex) => {
            const workDate = dateOnly(new Date(currentWeekStart.getTime() + dayIndex * 86400000));
            const cell = row.days[workDate];

            if (!cell) return "<td></td>";

            const className = cell.is_orientation ? "orientationCell" : "";
            const text = cell.is_orientation
              ? "Orientation"
              : cell.start_time && cell.end_time
                ? `${escapeHtml(cell.start_time)} - ${escapeHtml(cell.end_time)}`
                : "";

            return `<td class="${className}">${text}</td>`;
          });

          return `
            <tr class="${index % 2 === 1 ? "strongRow" : ""}">
              <td>${escapeHtml(row.priority)}</td>
              <td>${escapeHtml(row.employee)}</td>
              <td>${escapeHtml(row.title)}</td>
              ${dayCells.join("")}
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
}

async function generateSchedule() {
  if (!selectedLocationId) {
    showMessage("Choose a location first.");
    return;
  }

  try {
    await api("/schedules/generate", {
      method: "POST",
      body: JSON.stringify({
        locationId: selectedLocationId,
        weekStart: dateOnly(currentWeekStart),
        weeks: FORECAST_WEEKS
      })
    });

    await loadSchedule();
    showMessage(`Schedule forecast generated for up to ${FORECAST_WEEKS} weeks.`);
  } catch (err) {
    showMessage(err.message);
  }
}

async function loadEmployees() {
  if (!selectedLocationId || !canManageSchedule()) return;

  const data = await api(
    `/employees?locationId=${encodeURIComponent(selectedLocationId)}&page=${employeePage}&pageSize=25`
  );

  const employees = data.employees || [];
  const list = document.getElementById("employeeList");

  if (employees.length === 0) {
    list.innerHTML = `
      <div class="listRow">
        <strong>No employees yet</strong>
        <span>Add your team from the employee tools.</span>
        <span></span>
      </div>
    `;
    return;
  }

  list.innerHTML = employees
    .map(
      (employee) => `
        <div class="listRow">
          <strong>${escapeHtml(employee.priority)}. ${escapeHtml(employee.first_name)} ${escapeHtml(employee.last_name)}</strong>
          <span>${escapeHtml(employee.title)}</span>
          <span>${escapeHtml(employee.full_login)}</span>
        </div>
      `
    )
    .join("");
}

async function loadShifts() {
  if (!selectedLocationId || !canManageSchedule()) return;

  const filter = document.getElementById("shiftFilter").value || "";

  const data = await api(
    `/shifts?locationId=${encodeURIComponent(selectedLocationId)}&page=${shiftPage}&pageSize=10&filter=${encodeURIComponent(filter)}`
  );

  const shifts = data.shifts || [];
  const list = document.getElementById("shiftList");

  if (shifts.length === 0) {
    list.innerHTML = `
      <div class="listRow">
        <strong>No shifts yet</strong>
        <span>Create shift templates on the server or with the future shift form.</span>
        <span></span>
      </div>
    `;
    return;
  }

  list.innerHTML = shifts
    .map((shift) => {
      const enabledDays = Array.isArray(shift.days)
        ? shift.days
            .filter((day) => day.enabled)
            .map((day) => `${formatDayNumber(day.dayOfWeek)}: ${day.startTime || "--"}-${day.endTime || "--"}`)
            .join(", ")
        : "";

      return `
        <div class="listRow">
          <strong>${escapeHtml(shift.name)}</strong>
          <span>${escapeHtml(enabledDays || "No active days")}</span>
          <span>Sort ${escapeHtml(shift.sort_order ?? 1)}</span>
        </div>
      `;
    })
    .join("");
}

async function openPlanDialog() {
  if (!currentUser || currentUser.role !== "owner") {
    showMessage("Only the owner can change the plan.");
    return;
  }

  const dialog = document.getElementById("planDialog");
  const data = await api("/plans");

  document.getElementById("planList").innerHTML = (data.plans || [])
    .map(
      (plan) => `
        <button class="planButton" data-plan="${escapeHtml(plan.code)}">
          ${escapeHtml(plan.name)} — $${(Number(plan.monthly_price_cents) / 100).toFixed(2)}
          · ${plan.employee_limit === null ? "Unlimited employees" : `${escapeHtml(plan.employee_limit)} employees`}
        </button>
      `
    )
    .join("");

  dialog.showModal();
}

function printSchedule() {
  window.print();
}

document.getElementById("signupButton").addEventListener("click", () => {
  signup();
});

document.getElementById("loginButton").addEventListener("click", () => {
  login();
});

signupFieldIds.forEach((id) => {
  const input = document.getElementById(id);

  if (!input) return;

  input.addEventListener("input", () => {
    validateSignupField(id, false);
    setNotice("signupFormMessage", "", "");
  });

  input.addEventListener("blur", () => {
    validateSignupField(id, true);
  });
});

const signupUsernameInput = document.getElementById("signupUsername");

if (signupUsernameInput) {
  signupUsernameInput.setAttribute("maxlength", "30");
  signupUsernameInput.setAttribute("pattern", "[a-z0-9]{3,30}");
  signupUsernameInput.setAttribute("title", "Use 3 to 30 lowercase letters and numbers only.");

  signupUsernameInput.addEventListener("input", () => {
    signupUsernameInput.value = cleanUsernameInput(signupUsernameInput.value);
  });
}

const signupPasswordInput = document.getElementById("signupPassword");

if (signupPasswordInput) {
  signupPasswordInput.setAttribute("minlength", String(PASSWORD_MIN_LENGTH));
  signupPasswordInput.setAttribute("maxlength", String(PASSWORD_MAX_LENGTH));
  signupPasswordInput.setAttribute(
    "title",
    `Use ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters. Spaces and symbols are allowed.`
  );
}

const loginPasswordInput = document.getElementById("loginPassword");

if (loginPasswordInput) {
  loginPasswordInput.setAttribute("maxlength", String(PASSWORD_MAX_LENGTH));
}

document.getElementById("locationSelect").addEventListener("change", async (event) => {
  selectedLocationId = event.target.value;
  await loadSelectedLocationData();
});

document.getElementById("addLocationButton").addEventListener("click", () => {
  addLocation();
});

document.getElementById("generateScheduleButton").addEventListener("click", () => {
  generateSchedule();
});

document.getElementById("printScheduleButton").addEventListener("click", printSchedule);

document.getElementById("upgradeButton").addEventListener("click", () => {
  openPlanDialog().catch((err) => showMessage(err.message));
});

document.getElementById("closePlanDialog").addEventListener("click", () => {
  document.getElementById("planDialog").close();
});

document.getElementById("prevWeekButton").addEventListener("click", async () => {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  await loadSchedule();
});

document.getElementById("nextWeekButton").addEventListener("click", async () => {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  await loadSchedule();
});

document.getElementById("prevEmployeePage").addEventListener("click", async () => {
  employeePage = Math.max(1, employeePage - 1);
  await loadEmployees();
});

document.getElementById("nextEmployeePage").addEventListener("click", async () => {
  employeePage += 1;
  await loadEmployees();
});

document.getElementById("prevShiftPage").addEventListener("click", async () => {
  shiftPage = Math.max(1, shiftPage - 1);
  await loadShifts();
});

document.getElementById("nextShiftPage").addEventListener("click", async () => {
  shiftPage += 1;
  await loadShifts();
});

document.getElementById("shiftFilter").addEventListener("input", () => {
  shiftPage = 1;
  loadShifts().catch((err) => showMessage(err.message));
});

document.getElementById("planList").addEventListener("click", async (event) => {
  const button = event.target.closest(".planButton");
  if (!button) return;

  try {
    await api("/plans/change", {
      method: "POST",
      body: JSON.stringify({ planCode: button.dataset.plan })
    });

    document.getElementById("planDialog").close();
    showMessage(dashboardWelcomeText());
  } catch (err) {
    showMessage(err.message);
  }
});

document.querySelectorAll(".navItem").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".navItem").forEach((navItem) => {
      navItem.classList.remove("active");
    });

    item.classList.add("active");
  });
});
