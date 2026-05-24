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

  const displayName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ");
  showMessage(displayName ? `Welcome aboard, ${displayName}.` : "Welcome aboard.");
}

async function signup() {
  const username = cleanUsernameInput(document.getElementById("signupUsername").value);
  const password = normalizePasswordInput(document.getElementById("signupPassword").value);

  if (username.length < 3) {
    alert("Username must be 3 to 30 characters and can only contain lowercase letters and numbers.");
    return;
  }

  if (!isValidPasswordInput(password)) {
    alert(`Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters. Spaces and symbols are allowed.`);
    return;
  }

  const body = {
    firstName: document.getElementById("signupFirstName").value,
    lastName: document.getElementById("signupLastName").value,
    businessName: document.getElementById("signupBusinessName").value,
    email: document.getElementById("signupEmail").value,
    username,
    password
  };

  const data = await api("/auth/signup", {
    method: "POST",
    body: JSON.stringify(body)
  });

  alert(
    `Account created.\n\nYour login is:\n${data.fullLogin}\n\nUse this exact login with your password to sign in.`
  );
}

async function login() {
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
    alert("Location name is required.");
    return;
  }

  await api("/locations", {
    method: "POST",
    body: JSON.stringify({ name })
  });

  input.value = "";
  await loadLocations();
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
    alert("Choose a location first.");
    return;
  }

  await api("/schedules/generate", {
    method: "POST",
    body: JSON.stringify({
      locationId: selectedLocationId,
      weekStart: dateOnly(currentWeekStart),
      weeks: FORECAST_WEEKS
    })
  });

  await loadSchedule();

  alert(`Schedule forecast generated for up to ${FORECAST_WEEKS} weeks.`);
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
    alert("Only the owner can change the plan.");
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
  signup().catch((err) => alert(err.message));
});

document.getElementById("loginButton").addEventListener("click", () => {
  login().catch((err) => alert(err.message));
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
  addLocation().catch((err) => alert(err.message));
});

document.getElementById("generateScheduleButton").addEventListener("click", () => {
  generateSchedule().catch((err) => alert(err.message));
});

document.getElementById("printScheduleButton").addEventListener("click", printSchedule);

document.getElementById("upgradeButton").addEventListener("click", () => {
  openPlanDialog().catch((err) => alert(err.message));
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
  loadShifts().catch((err) => alert(err.message));
});

document.getElementById("planList").addEventListener("click", async (event) => {
  const button = event.target.closest(".planButton");
  if (!button) return;

  await api("/plans/change", {
    method: "POST",
    body: JSON.stringify({ planCode: button.dataset.plan })
  });

  document.getElementById("planDialog").close();
  alert("Plan updated immediately.");
});

document.querySelectorAll(".navItem").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".navItem").forEach((navItem) => {
      navItem.classList.remove("active");
    });

    item.classList.add("active");
  });
});
