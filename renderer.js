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
let selectedLocationRecord = null;
let currentWeekStart = startOfWeek(new Date());
let locationPage = 1;
let locationTotalPages = 1;
let employeePage = 1;
let employeeTotalPages = 1;
let shiftPage = 1;
let shiftTotalPages = 1;
let currentPlanCode = "free";
let employeeDaysOff = new Set();
let timeOffRequests = [];
let timeOffSettings = { requestsEnabled: true, blockedDates: [], holidayDates: [] };
let timeOffCalendarMonth = startOfMonth(new Date());
let timeOffRangeStart = null;
let timeOffRangeEnd = null;
let auditLogs = [];

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

function setDashboardWelcome(text) {
  const loginText = $("dashboardLoginText");
  if (!loginText) return;

  const prefix = "Welcome aboard,";
  loginText.textContent = text.startsWith(prefix) ? text.replace(prefix, "").trim() : text;
}

function showMessage(text, type = "error") {
  const status = $("dashboardStatus");
  if (!status) return;

  if (!text) {
    status.className = "dashboardStatus hidden";
    status.textContent = "";
    return;
  }

  status.className = `dashboardStatus ${type}`;
  status.textContent = text;
}

function isOwner() {
  return currentUser?.role === "owner";
}

function canManageSchedule() {
  return !!currentUser && (currentUser.role === "owner" || currentUser.canManageSchedule);
}

function selectedLocation() {
  return locations.find((location) => location.id === selectedLocationId) ||
    (selectedLocationRecord?.id === selectedLocationId ? selectedLocationRecord : null);
}

function selectedLocationName() {
  const location = selectedLocation();
  return location?.name || "selected location";
}

function updateSelectedLocationLabels() {
  const name = selectedLocationName();
  ["scheduleLocationName", "shiftLocationName", "employeeLocationName"].forEach((id) => {
    const element = $(id);
    if (element) element.textContent = name;
  });
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

function parseDateOnly(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfMonth(date) {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addMonths(date, months) {
  const copy = startOfMonth(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function formatMonthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDateForDisplay(value) {
  const parsed = parseDateOnly(value);
  return parsed ? parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : value;
}

function compareDateOnly(a, b) {
  return String(a || "").localeCompare(String(b || ""));
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

function resetFieldState(inputId, message = "") {
  setFieldState(inputId, "neutral", message);
}

function updatePager(prefix, page, totalPages) {
  const pager = $(`${prefix}Pager`);
  const previous = $(`prev${prefix[0].toUpperCase()}${prefix.slice(1)}Page`);
  const next = $(`next${prefix[0].toUpperCase()}${prefix.slice(1)}Page`);
  const label = $(`${prefix}PageLabel`);

  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safePage = Math.min(Math.max(1, Number(page) || 1), safeTotalPages);

  if (label) label.textContent = `Page ${safePage}/${safeTotalPages}`;
  if (previous) previous.classList.toggle("hidden", safePage <= 1);
  if (next) next.classList.toggle("hidden", safePage >= safeTotalPages);
  if (pager) pager.classList.toggle("hidden", safeTotalPages <= 1);
}
function setActiveNavigation(sectionId) {
  if (!sectionId) return;

  document.querySelectorAll(".navList .navItem").forEach((link) => {
    const targetId = (link.getAttribute("href") || "").replace("#", "");
    link.classList.toggle("active", targetId === sectionId);
  });
}

function visibleSectionCandidates() {
  return ["locationsPanel", "schedulePanel", "shiftsPanel", "employeesPanel", "timeOffPanel", "auditPanel"]
    .map((id) => $(id))
    .filter((section) => section && !section.classList.contains("hidden"));
}

let navigationScrollTicking = false;
let navigationClickHoldUntil = 0;

function sectionDocumentTop(section) {
  return section.getBoundingClientRect().top + window.scrollY;
}

function sectionDocumentBottom(section) {
  return section.getBoundingClientRect().bottom + window.scrollY;
}

function scrollToSectionForNav(sectionId) {
  const section = $(sectionId);
  if (!section) return;

  let targetY = sectionDocumentTop(section);

  if (sectionId === "locationsPanel") {
    targetY = 0;
  } else if (sectionId === "employeesPanel") {
    targetY = Math.max(0, sectionDocumentTop(section) - 14);
  } else if (sectionId === "schedulePanel") {
    targetY = Math.max(0, sectionDocumentTop(section) - 14);
  } else if (sectionId === "shiftsPanel") {
    targetY = Math.max(0, sectionDocumentBottom(section) - window.innerHeight + 18);
  }

  window.scrollTo({ top: targetY, behavior: "smooth" });
}

function updateActiveNavigationFromScroll() {
  if (Date.now() < navigationClickHoldUntil) return;

  const sections = visibleSectionCandidates();
  if (!sections.length) return;

  if (window.scrollY <= 4) {
    setActiveNavigation("locationsPanel");
    return;
  }

  const viewportBottomY = window.scrollY + window.innerHeight;
  let activeSection = sections[0];

  for (const section of sections) {
    const activationY = sectionDocumentTop(section);

    if (viewportBottomY >= activationY + 1) {
      activeSection = section;
    }
  }

  setActiveNavigation(activeSection.id);
}

function requestActiveNavigationUpdate() {
  if (navigationScrollTicking) return;

  navigationScrollTicking = true;
  window.requestAnimationFrame(() => {
    updateActiveNavigationFromScroll();
    navigationScrollTicking = false;
  });
}

function setupSectionNavigationHighlighting() {
  document.querySelectorAll(".navList .navItem").forEach((link) => {
    link.addEventListener("click", (event) => {
      const sectionId = (link.getAttribute("href") || "").replace("#", "");
      if (!sectionId) return;

      event.preventDefault();
      navigationClickHoldUntil = Date.now() + 900;
      setActiveNavigation(sectionId);
      scrollToSectionForNav(sectionId);

      window.setTimeout(() => {
        navigationClickHoldUntil = 0;
        updateActiveNavigationFromScroll();
      }, 950);
    });
  });

  window.addEventListener("scroll", requestActiveNavigationUpdate, { passive: true });
  window.addEventListener("resize", requestActiveNavigationUpdate);
  window.addEventListener("hashchange", requestActiveNavigationUpdate);
  updateActiveNavigationFromScroll();
}

function validateCredentialPassword(showEmptyErrors = false) {
  const passwordInput = $("credentialPassword");
  const password = passwordInput?.value || "";

  if (!password) {
    setFieldState("credentialPassword", showEmptyErrors ? "invalid" : "neutral", "Required");
    return false;
  }

  setFieldState("credentialPassword", "valid", "Password entered");
  return true;
}

function resetCredentialDialog() {
  setNotice("credentialDialogNotice", "", "");
  const passwordInput = $("credentialPassword");
  if (passwordInput) passwordInput.value = "";
  validateCredentialPassword(false);
}

function isOwnerCredentialError(err) {
  const message = String(err?.message || "").toLowerCase();
  return (
    message.includes("wrong password") ||
    message.includes("owner credentials") ||
    message.includes("owner password") ||
    message.includes("no refresh token") ||
    message.includes("not authenticated") ||
    message.includes("invalid or expired token")
  );
}

async function runOwnerCredentialAction({ title, message, confirmLabel = "Delete", onConfirm } = {}) {
  const dialog = $("credentialDialog");
  const form = $("credentialForm");
  const titleEl = $("credentialDialogTitle");
  const messageEl = $("credentialDialogMessage");
  const confirmButton = $("confirmCredentialButton");
  const cancelButton = $("cancelCredentialButton");
  const closeButton = $("cancelCredentialX");
  const passwordInput = $("credentialPassword");

  if (!dialog || !form || typeof dialog.showModal !== "function") {
    const actorPassword = window.prompt(message || "Enter your owner password to continue.");
    if (!actorPassword || !onConfirm) return false;
    await onConfirm(actorPassword);
    return true;
  }

  resetCredentialDialog();
  if (titleEl) titleEl.textContent = title || "Confirm Delete";
  if (messageEl) messageEl.textContent = message || "Enter your owner password to continue.";
  if (confirmButton) {
    confirmButton.textContent = confirmLabel;
    confirmButton.disabled = true;
  }

  return new Promise((resolve) => {
    let finished = false;
    let submitting = false;

    const cleanup = () => {
      form.removeEventListener("submit", handleSubmit);
      passwordInput?.removeEventListener("input", handlePasswordInput);
      passwordInput?.removeEventListener("blur", handlePasswordBlur);
      cancelButton?.removeEventListener("click", handleCancel);
      closeButton?.removeEventListener("click", handleCancel);
      dialog.removeEventListener("cancel", handleDialogCancel);
    };

    const finish = (value) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (dialog.open) dialog.close();
      resolve(value);
    };

    const handlePasswordInput = () => {
      const isValid = validateCredentialPassword(false);
      if (confirmButton) confirmButton.disabled = !isValid || submitting;
      if (isValid) setNotice("credentialDialogNotice", "", "");
    };

    const handlePasswordBlur = () => {
      const isValid = validateCredentialPassword(true);
      if (confirmButton) confirmButton.disabled = !isValid || submitting;
    };

    async function handleSubmit(event) {
      event.preventDefault();

      if (!validateCredentialPassword(true)) {
        setNotice("credentialDialogNotice", "error", "Owner password is required.");
        passwordInput?.focus();
        return;
      }

      if (!onConfirm || submitting) return;

      submitting = true;
      if (confirmButton) confirmButton.disabled = true;
      setNotice("credentialDialogNotice", "", "");

      try {
        await onConfirm(passwordInput?.value || "");
        finish(true);
      } catch (err) {
        submitting = false;

        if (isOwnerCredentialError(err)) {
          setFieldState("credentialPassword", "invalid", "Wrong password");
          setNotice("credentialDialogNotice", "", "");
          if (confirmButton) confirmButton.disabled = false;
          passwordInput?.focus();
          passwordInput?.select?.();
          return;
        }

        setNotice("credentialDialogNotice", "error", err.message || "Delete failed.");
        if (confirmButton) confirmButton.disabled = false;
      }
    }

    const handleCancel = (event) => {
      event?.preventDefault?.();
      finish(false);
    };

    const handleDialogCancel = (event) => {
      event?.preventDefault?.();
      finish(false);
    };

    form.addEventListener("submit", handleSubmit);
    passwordInput?.addEventListener("input", handlePasswordInput);
    passwordInput?.addEventListener("blur", handlePasswordBlur);
    cancelButton?.addEventListener("click", handleCancel);
    closeButton?.addEventListener("click", handleCancel);
    dialog.addEventListener("cancel", handleDialogCancel);

    dialog.showModal();
    window.setTimeout(() => passwordInput?.focus(), 30);
  });
}

function requestOwnerPassword({ title, message, confirmLabel = "Delete" } = {}) {
  const dialog = $("credentialDialog");
  const form = $("credentialForm");
  const titleEl = $("credentialDialogTitle");
  const messageEl = $("credentialDialogMessage");
  const confirmButton = $("confirmCredentialButton");
  const cancelButton = $("cancelCredentialButton");
  const closeButton = $("cancelCredentialX");
  const passwordInput = $("credentialPassword");

  if (!dialog || !form || typeof dialog.showModal !== "function") {
    return Promise.resolve(window.prompt(message || "Enter your owner password to continue."));
  }

  resetCredentialDialog();
  if (titleEl) titleEl.textContent = title || "Confirm Delete";
  if (messageEl) messageEl.textContent = message || "Enter your owner password to continue.";
  if (confirmButton) {
    confirmButton.textContent = confirmLabel;
    confirmButton.disabled = true;
  }

  return new Promise((resolve) => {
    let finished = false;

    const finish = (value) => {
      if (finished) return;
      finished = true;
      form.removeEventListener("submit", handleSubmit);
      passwordInput?.removeEventListener("input", handlePasswordInput);
      passwordInput?.removeEventListener("blur", handlePasswordBlur);
      cancelButton?.removeEventListener("click", handleCancel);
      closeButton?.removeEventListener("click", handleCancel);
      dialog.removeEventListener("cancel", handleDialogCancel);
      dialog.removeEventListener("close", handleDialogCancel);
      if (dialog.open) dialog.close();
      resolve(value);
    };

    const handlePasswordInput = () => {
      const isValid = validateCredentialPassword(false);
      if (confirmButton) confirmButton.disabled = !isValid;
      if (isValid) setNotice("credentialDialogNotice", "", "");
    };

    const handlePasswordBlur = () => {
      const isValid = validateCredentialPassword(true);
      if (confirmButton) confirmButton.disabled = !isValid;
    };

    const handleSubmit = (event) => {
      event.preventDefault();
      const password = passwordInput?.value || "";

      if (!validateCredentialPassword(true)) {
        setNotice("credentialDialogNotice", "error", "Owner password is required.");
        passwordInput?.focus();
        return;
      }

      finish(password);
    };

    const handleCancel = (event) => {
      event?.preventDefault?.();
      finish(null);
    };

    const handleDialogCancel = () => finish(null);

    form.addEventListener("submit", handleSubmit);
    passwordInput?.addEventListener("input", handlePasswordInput);
    passwordInput?.addEventListener("blur", handlePasswordBlur);
    cancelButton?.addEventListener("click", handleCancel);
    closeButton?.addEventListener("click", handleCancel);
    dialog.addEventListener("cancel", handleDialogCancel);
    dialog.addEventListener("close", handleDialogCancel);

    dialog.showModal();
    window.setTimeout(() => passwordInput?.focus(), 30);
  });
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

async function refreshSession() {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.accessToken) {
    throw new Error(data.error || "Session expired. Please log in again.");
  }

  accessToken = data.accessToken;
  currentUser = data.user || currentUser;
  return data;
}

async function api(path, options = {}, retry = true) {
  const { skipRefresh = false, ...fetchOptions } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(fetchOptions.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && retry && !skipRefresh && !path.startsWith("/auth/")) {
      await refreshSession();
      return api(path, options, false);
    }

    if (res.status === 402 && isOwner()) {
      openPlanDialog().catch(() => {});
    }

    const error = new Error(data.error || "Request failed");
    error.status = res.status;
    error.field = data.field || "";
    error.data = data;
    throw error;
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
  $("settingsButton").classList.toggle("hidden", !owner);

  document.querySelectorAll(".ownerOnly").forEach((el) => {
    if (el.classList.contains("editorForm")) {
      if (!owner) el.classList.add("hidden");
      return;
    }

    el.classList.toggle("hidden", !owner);
  });

  document.querySelectorAll(".editorForm[data-role='owner']").forEach((el) => {
    if (!owner) el.classList.add("hidden");
  });

  document.querySelectorAll(".nonOwnerOnly").forEach((el) => {
    el.classList.toggle("hidden", owner);
  });

  document.querySelectorAll(".nonManagerOnly").forEach((el) => {
    el.classList.toggle("hidden", canManage);
  });

  document.querySelectorAll(".managerOnly").forEach((el) => {
    el.classList.toggle("hidden", !canManage);
  });

  document.querySelectorAll(".employeeOnlyHidden").forEach((el) => {
    el.classList.toggle("hidden", currentUser?.role === "employee");
  });

  setDashboardWelcome(dashboardWelcomeText());
  showMessage("");
  updateActiveNavigationFromScroll();
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

async function loadLocations({ resetPage = false } = {}) {
  if (resetPage) locationPage = 1;

  const filter = ($("locationFilter")?.value || "").trim();
  const params = new URLSearchParams({
    page: String(locationPage),
    pageSize: "5",
    filter
  });

  if (selectedLocationId) {
    params.set("selectedLocationId", selectedLocationId);
  }

  const data = await api(`/locations?${params.toString()}`);
  locations = data.locations || [];
  locationPage = data.page || locationPage;
  locationTotalPages = data.totalPages || 1;
  selectedLocationRecord = data.selectedLocation || null;

  if (!locations.length && locationPage > 1) {
    locationPage = Math.max(1, locationPage - 1);
    await loadLocations();
    return;
  }

  if (!locations.length && !selectedLocationRecord) {
    selectedLocationId = null;
    shifts = [];
    employees = [];
    renderLocations();
    renderShifts();
    renderEmployees();
    updatePager("location", locationPage, locationTotalPages);
    updateSelectedLocationLabels();
    renderEmptySchedule();
    return;
  }

  const selectedStillExists =
    !!selectedLocationId &&
    (locations.some((location) => location.id === selectedLocationId) || selectedLocationRecord?.id === selectedLocationId);

  if (!selectedStillExists) {
    const firstLocation = locations[0] || selectedLocationRecord;
    selectedLocationId = firstLocation?.id || null;
    selectedLocationRecord = firstLocation || null;
  }

  renderLocations();
  updatePager("location", locationPage, locationTotalPages);
  await loadSelectedLocationData();
  if (canManageSchedule()) await loadAuditLog();
}

function resetLocationForm() {
  $("locationId").value = "";
  $("locationName").value = "";
  $("locationAddress").value = "";
  setNotice("locationFormMessage", "", "");
  resetFieldState("locationName", "Required");
}

function showLocationForm(location = null) {
  resetLocationForm();

  if (location) {
    $("locationId").value = location.id;
    $("locationName").value = location.name || "";
    $("locationAddress").value = location.address || "";
  }

  $("locationForm").classList.remove("hidden");
  $("locationName").focus();
}

function renderLocations() {
  updateSelectedLocationLabels();
  const list = $("locationList");
  const filter = ($("locationFilter")?.value || "").trim();

  if (!locations.length) {
    list.innerHTML = `<div class="emptyState">${filter ? "No locations match that filter." : "No locations found."}</div>`;
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

async function loadSelectedLocationData({ resetPages = false } = {}) {
  updateSelectedLocationLabels();

  if (resetPages) {
    shiftPage = 1;
    employeePage = 1;
    shifts = [];
    employees = [];
    renderShifts();
    renderEmployees();
    $("locationForm")?.classList.add("hidden");
    $("shiftForm")?.classList.add("hidden");
    $("employeeForm")?.classList.add("hidden");
  }

  await loadSchedule();
  await loadTimeOffSettings();
  if (!canManageSchedule()) await loadTimeOffRequests();

  if (canManageSchedule()) {
    await Promise.all([loadShifts(), loadEmployees(), loadTimeOffRequests(), loadAuditLog()]);
  } else {
    shifts = [];
    employees = [];
    renderShifts();
    renderEmployees();
  }
}

async function saveLocation(event) {
  event.preventDefault();
  setNotice("locationFormMessage", "", "");
  resetFieldState("locationName", "Required");

  const locationId = $("locationId").value;
  const name = $("locationName").value.trim();
  const address = $("locationAddress").value.trim();

  if (!name) {
    setFieldState("locationName", "invalid", "Required");
    return;
  }

  setFieldState("locationName", "valid", "Looks good");

  try {
    const previousSelectedLocationId = selectedLocationId;

    await api(locationId ? `/locations/${encodeURIComponent(locationId)}` : "/locations", {
      method: locationId ? "PUT" : "POST",
      body: JSON.stringify({ name, address: address || null })
    });

    if (!locationId && previousSelectedLocationId) {
      selectedLocationId = previousSelectedLocationId;
    }

    resetLocationForm();
    $("locationForm").classList.add("hidden");
    await loadLocations();
  } catch (err) {
    setNotice("locationFormMessage", "error", err.message);
  }
}

function editLocation(locationId) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;
  showLocationForm(location);
}

async function deleteLocation(locationId) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;

  const deleted = await runOwnerCredentialAction({
    title: "Delete Location",
    message: `Enter your owner password to delete ${location.name}. This also removes its shifts and employees.`,
    confirmLabel: "Delete Location",
    onConfirm: (actorPassword) =>
      api(`/locations/${encodeURIComponent(locationId)}/delete`, {
        method: "POST",
        skipRefresh: true,
        body: JSON.stringify({ actorPassword })
      })
  });

  if (!deleted) return;

  selectedLocationId = null;
  selectedLocationRecord = null;
  locationPage = 1;
  await loadLocations();
}

async function loadSchedule() {
  updateSelectedLocationLabels();

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
  renderScheduleHealth(data.health || null, data.coverage || [], data.warnings || []);
}

function renderEmptySchedule() {
  renderScheduleWarnings([]);
  const table = $("scheduleTable");

  table.innerHTML = `
    <thead>
      <tr>
        <th>Schedule</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Select or add a location to see its schedule.</td>
      </tr>
    </tbody>
  `;
}

function renderScheduleHealth(health, coverage = [], warnings = []) {
  const existing = $("scheduleHealth");
  if (existing) existing.remove();

  const frame = document.querySelector("#schedulePanel .tableFrame");
  if (!frame || !health) return;

  const panel = document.createElement("section");
  panel.id = "scheduleHealth";
  panel.className = "scheduleHealthBox";

  const topWarnings = Array.isArray(warnings) ? warnings.slice(0, 5) : [];
  const coverageItems = Array.isArray(coverage) ? coverage : [];

  panel.innerHTML = `
    <div class="scheduleHealthHeader">
      <div>
        <p class="eyebrow">Schedule Health</p>
        <h3>${escapeHtml(health.score ?? 0)}% <span>${escapeHtml(health.label || "Forecast")}</span></h3>
      </div>
      <div class="healthStats">
        <span><strong>${escapeHtml(health.coverageAssigned ?? 0)}</strong> assigned</span>
        <span><strong>${escapeHtml(health.coverageNeeded ?? 0)}</strong> needed</span>
        <span><strong>${escapeHtml(health.openShiftCount ?? 0)}</strong> open</span>
      </div>
    </div>
    <div class="coverageHeatMap" aria-label="Coverage heat map">
      ${coverageItems.length
        ? coverageItems.map((slot) => `
          <span class="coverageChip ${slot.status === "under" ? "under" : slot.status === "covered" ? "covered" : "closed"}"
            title="${escapeHtml(slot.dayName)} ${escapeHtml(slot.shiftName)}: ${escapeHtml(slot.assignedCount)}/${escapeHtml(slot.requiredStaff)} assigned">
            ${escapeHtml(String(slot.dayName || "").slice(0, 3))} ${escapeHtml(slot.shiftName || "Shift")}
            <strong>${escapeHtml(slot.assignedCount)}/${escapeHtml(slot.requiredStaff)}</strong>
          </span>`).join("")
        : `<span class="coverageChip under">No coverage rules yet</span>`}
    </div>
    ${topWarnings.length ? `
      <div class="scheduleWarningsList">
        <strong>${escapeHtml(health.warningCount)} warning${Number(health.warningCount) === 1 ? "" : "s"}</strong>
        <ul>${topWarnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join("")}</ul>
      </div>` : `
      <div class="scheduleWarningsList success">No schedule health warnings found for this forecast.</div>`}
  `;

  frame.insertAdjacentElement("beforebegin", panel);
}

function renderScheduleWarnings(warnings) {
  renderScheduleHealth(null, [], warnings);
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
                    <small class="assignmentReason" title="${escapeHtml((cell.assignment_reason || []).join(" • "))}">Score ${escapeHtml(cell.fairness_score ?? "—")}</small>
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
    endTime: day.value <= 5 ? "17:00" : "",
    requiredStaff: day.value <= 5 ? 1 : 0,
    maxStaff: null
  }));
}

function renderShiftDayEditor(days = defaultShiftDays()) {
  const map = new Map(days.map((day) => [Number(day.dayOfWeek), day]));

  $("shiftDayEditor").innerHTML = DAYS.map((day) => {
    const value = map.get(day.value) || {
      dayOfWeek: day.value,
      enabled: false,
      startTime: "",
      endTime: "",
      requiredStaff: 0,
      maxStaff: null
    };

    return `
      <div class="dayTimeRow" data-day="${day.value}">
        <label class="checkboxLine">
          <input type="checkbox" class="shiftDayEnabled" ${value.enabled ? "checked" : ""} />
          ${day.short}
        </label>
        <input type="time" class="shiftStart" value="${escapeHtml(value.startTime || "")}" />
        <input type="time" class="shiftEnd" value="${escapeHtml(value.endTime || "")}" />
        <label class="staffNeededLabel">Employees needed
          <input type="number" class="requiredStaff" min="0" max="99" placeholder="0" value="${escapeHtml(value.requiredStaff ?? value.employeesNeeded ?? (value.enabled ? 1 : 0))}" />
          <small>Minimum coverage target.</small>
        </label>
        <label class="staffNeededLabel">Max Staff #
          <input type="number" class="maxStaff" min="1" max="99" placeholder="No cap" value="${escapeHtml(value.maxStaff ?? "")}" />
          <small>Optional cap.</small>
        </label>
      </div>
    `;
  }).join("");
}

function normalizeRequiredStaff(value) {
  if (value === undefined || value === null || value === "") return 1;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 99) return 1;
  return number;
}

function normalizeOptionalStaffLimit(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 99) return null;
  return number;
}

function collectShiftDays() {
  return [...document.querySelectorAll("#shiftDayEditor .dayTimeRow")].map((row) => {
    const enabled = row.querySelector(".shiftDayEnabled").checked;

    return {
      dayOfWeek: Number(row.dataset.day),
      enabled,
      startTime: enabled ? row.querySelector(".shiftStart").value : null,
      endTime: enabled ? row.querySelector(".shiftEnd").value : null,
      requiredStaff: enabled ? normalizeRequiredStaff(row.querySelector(".requiredStaff")?.value) : 0,
      employeesNeeded: enabled ? normalizeRequiredStaff(row.querySelector(".requiredStaff")?.value) : 0,
      maxStaff: enabled ? normalizeOptionalStaffLimit(row.querySelector(".maxStaff")?.value) : null
    };
  });
}

function resetShiftForm() {
  $("shiftId").value = "";
  $("shiftName").value = "Standard";
  $("shiftSortOrder").value = "1";
  setNotice("shiftFormMessage", "", "");
  resetFieldState("shiftName", "Required");
  renderShiftDayEditor(defaultShiftDays());
}

function showShiftForm() {
  if (!selectedLocationId) {
    setNotice("shiftFormMessage", "error", "Select a location before creating a shift.");
    return;
  }

  resetShiftForm();
  $("shiftForm").classList.remove("hidden");
  $("shiftName").focus();
}

async function saveShift(event) {
  event.preventDefault();
  setNotice("shiftFormMessage", "", "");
  resetFieldState("shiftName", "Required");

  if (!selectedLocationId) {
    setNotice("shiftFormMessage", "error", "Select a location first.");
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
    setFieldState("shiftName", "invalid", "Required");
    return;
  }

  setFieldState("shiftName", "valid", "Looks good");

  try {
    await api(shiftId ? `/shifts/${encodeURIComponent(shiftId)}` : "/shifts", {
      method: shiftId ? "PUT" : "POST",
      body: JSON.stringify(body)
    });

    resetShiftForm();
    $("shiftForm").classList.add("hidden");
    await Promise.all([loadShifts(), loadSchedule()]);
  } catch (err) {
    setNotice("shiftFormMessage", "error", err.message);
  }
}

async function loadShifts() {
  if (!selectedLocationId || !canManageSchedule()) return;

  const filter = $("shiftFilter").value.trim();

  const data = await api(
    `/shifts?locationId=${encodeURIComponent(selectedLocationId)}&page=${shiftPage}&pageSize=5&filter=${encodeURIComponent(filter)}`
  );

  shifts = data.shifts || [];
  shiftPage = data.page || shiftPage;
  shiftTotalPages = data.totalPages || 1;
  renderShifts();
  updatePager("shift", shiftPage, shiftTotalPages);
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
        return `${label} ${day.startTime || ""}–${day.endTime || ""} · Need ${day.requiredStaff ?? day.employeesNeeded ?? 0} · Max ${day.maxStaff || "No cap"}`;
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

  $("shiftForm").classList.remove("hidden");
  setNotice("shiftFormMessage", "", "");
  resetFieldState("shiftName", "Required");
  $("shiftId").value = shift.id;
  $("shiftName").value = shift.name;
  $("shiftSortOrder").value = shift.sort_order || 1;
  renderShiftDayEditor(shift.days || defaultShiftDays());
  $("shiftName").focus();
}

async function deleteShift(shiftId) {
  const shift = shifts.find((item) => item.id === shiftId);
  if (!shift) return;

  const deleted = await runOwnerCredentialAction({
    title: "Delete Shift",
    message: `Enter your owner password to delete shift ${shift.name}.`,
    confirmLabel: "Delete Shift",
    onConfirm: (actorPassword) =>
      api(`/shifts/${encodeURIComponent(shiftId)}/delete`, {
        method: "POST",
        skipRefresh: true,
        body: JSON.stringify({ actorPassword })
      })
  });

  if (!deleted) return;

  await Promise.all([loadShifts(), loadSchedule()]);
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
  setNotice("employeeFormMessage", "", "");
  resetFieldState("employeeCode", "Required");
  resetFieldState("employeeUsername", "Required");
  resetFieldState("employeePassword", "Required for new");
  renderAvailabilityEditor(defaultAvailability());
  renderDaysOffList();
  populatePreferredShiftSelect();
}

async function loadEmployees() {
  if (!selectedLocationId || !canManageSchedule()) return;

  const filter = $("employeeFilter").value.trim();

  const data = await api(
    `/employees?locationId=${encodeURIComponent(selectedLocationId)}&page=${employeePage}&pageSize=5&filter=${encodeURIComponent(filter)}`
  );

  employees = data.employees || [];
  employeePage = data.page || employeePage;
  employeeTotalPages = data.totalPages || 1;
  renderEmployees();
  updatePager("employee", employeePage, employeeTotalPages);
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
  setNotice("employeeFormMessage", "", "");
  resetFieldState("employeeCode", "Required");
  resetFieldState("employeeUsername", "Required");
  resetFieldState("employeePassword", "Optional while editing");
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
  setNotice("employeeFormMessage", "", "");
  resetFieldState("employeeCode", "Required");
  resetFieldState("employeeUsername", "Required");
  resetFieldState("employeePassword", $("employeeId").value ? "Optional while editing" : "Required for new");

  if (!selectedLocationId) {
    setNotice("employeeFormMessage", "error", "Select a location first.");
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

  let isValid = true;

  if (!body.employeeCode) {
    setFieldState("employeeCode", "invalid", "Required");
    isValid = false;
  } else {
    setFieldState("employeeCode", "valid", "Looks good");
  }

  if (!body.username) {
    setFieldState("employeeUsername", "invalid", "Required");
    isValid = false;
  } else if (body.username.length < 3) {
    setFieldState("employeeUsername", "invalid", "3–30 letters or numbers");
    isValid = false;
  } else {
    setFieldState("employeeUsername", "valid", "Username works");
  }

  if (!employeeId && !body.password) {
    setFieldState("employeePassword", "invalid", "Required for new employees");
    isValid = false;
  } else if (body.password && !isValidPasswordInput(body.password)) {
    setFieldState("employeePassword", "invalid", "12–128 characters");
    isValid = false;
  } else if (body.password) {
    setFieldState("employeePassword", "valid", "Password length works");
  } else {
    resetFieldState("employeePassword", "Optional while editing");
  }

  if (!isValid) return;

  try {
    await api(employeeId ? `/employees/${encodeURIComponent(employeeId)}` : "/employees", {
      method: employeeId ? "PUT" : "POST",
      body: JSON.stringify(body)
    });

    resetEmployeeForm();
    $("employeeForm").classList.add("hidden");
    await Promise.all([loadEmployees(), loadSchedule()]);
  } catch (err) {
    setNotice("employeeFormMessage", "error", err.message);
  }
}

async function deleteEmployee(employeeId) {
  const employee = employees.find((item) => item.id === employeeId);
  if (!employee) return;

  const deleted = await runOwnerCredentialAction({
    title: "Delete Employee",
    message: `Enter your owner password to delete employee ${employee.employee_code}.`,
    confirmLabel: "Delete Employee",
    onConfirm: (actorPassword) =>
      api(`/employees/${encodeURIComponent(employeeId)}/delete`, {
        method: "POST",
        skipRefresh: true,
        body: JSON.stringify({ actorPassword })
      })
  });

  if (!deleted) return;

  await Promise.all([loadEmployees(), loadSchedule()]);
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

function formatRequestDate(value) {
  return String(value || "").slice(0, 10);
}

function statusBadge(status) {
  const safe = String(status || "pending");
  return `<span class="statusBadge ${escapeHtml(safe)}">${escapeHtml(safe)}</span>`;
}

function activeBlockedDateMap() {
  const today = dateOnly(new Date());
  const map = new Map();

  for (const item of timeOffSettings.blockedDates || []) {
    const blockedDate = formatRequestDate(item.blocked_date);
    if (blockedDate >= today) {
      map.set(blockedDate, item.reason || "Blocked by owner");
    }
  }

  return map;
}

function activeHolidayDateMap() {
  const today = dateOnly(new Date());
  const map = new Map();

  for (const item of timeOffSettings.holidayDates || []) {
    const holidayDate = formatRequestDate(item.holiday_date);
    if (holidayDate >= today) {
      map.set(holidayDate, item.name || "Holiday");
    }
  }

  return map;
}

function dateRangeIncludesBlockedDate(startDate, endDate) {
  if (!startDate || !endDate) return null;

  const blocked = activeBlockedDateMap();
  let cursor = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!cursor || !end) return null;

  while (cursor <= end) {
    const cursorDate = dateOnly(cursor);
    if (blocked.has(cursorDate)) {
      return { date: cursorDate, reason: blocked.get(cursorDate) };
    }
    cursor = addDays(cursor, 1);
  }

  return null;
}

function setTimeOffRange(startDate, endDate) {
  timeOffRangeStart = startDate;
  timeOffRangeEnd = endDate;

  const startInput = $("timeOffStartDate");
  const endInput = $("timeOffEndDate");
  const rangeInput = $("timeOffDateRange");

  if (startInput) startInput.value = startDate || "";
  if (endInput) endInput.value = endDate || "";
  if (rangeInput) rangeInput.value = startDate && endDate ? `${startDate} to ${endDate}` : "";

  const rangeText = $("timeOffSelectedRange");
  if (rangeText) {
    rangeText.textContent = startDate && endDate
      ? startDate === endDate
        ? `Selected: ${formatDateForDisplay(startDate)}`
        : `Selected: ${formatDateForDisplay(startDate)} – ${formatDateForDisplay(endDate)}`
      : "No dates selected.";
  }

  renderTimeOffCalendar();
}

function renderCalendarMonth(monthDate, blockedDates, holidayDates, today) {
  const monthStart = startOfMonth(monthDate);
  const firstDayIndex = monthStart.getDay();
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstDayIndex; index += 1) {
    cells.push(`<span class="calendarDay spacer" aria-hidden="true"></span>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const dateValue = dateOnly(date);
    const isPast = dateValue < today;
    const isBlocked = blockedDates.has(dateValue);
    const isHoliday = holidayDates.has(dateValue);
    const isSelected = dateValue === timeOffRangeStart || dateValue === timeOffRangeEnd;
    const isInRange = timeOffRangeStart && timeOffRangeEnd && dateValue > timeOffRangeStart && dateValue < timeOffRangeEnd;
    const classes = ["calendarDay"];
    if (isPast) classes.push("past");
    if (isHoliday) classes.push("holiday");
    if (isBlocked) classes.push("blocked");
    if (isSelected) classes.push("selected");
    if (isInRange) classes.push("inRange");

    const title = isPast
      ? "Past date"
      : isBlocked
        ? `Blocked: ${blockedDates.get(dateValue)}`
        : isHoliday
          ? `Holiday: ${holidayDates.get(dateValue)}`
          : "Available";

    cells.push(`
      <button
        class="${classes.join(" ")}"
        type="button"
        data-date="${escapeHtml(dateValue)}"
        ${isPast || isBlocked ? "disabled" : ""}
        title="${escapeHtml(title)}"
        aria-label="${escapeHtml(`${formatDateForDisplay(dateValue)} - ${title}`)}"
      >
        <span>${day}</span>
      </button>
    `);
  }

  return `
    <section class="calendarMonth" aria-label="${escapeHtml(formatMonthLabel(monthStart))}">
      <h4>${escapeHtml(formatMonthLabel(monthStart))}</h4>
      <div class="calendarWeekdays" aria-hidden="true">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>
      <div class="calendarDays">${cells.join("")}</div>
    </section>
  `;
}

function renderTimeOffCalendar() {
  const grid = $("timeOffCalendarGrid");
  const label = $("timeOffCalendarLabel");
  if (!grid) return;

  const today = dateOnly(new Date());
  const blockedDates = activeBlockedDateMap();
  const holidayDates = activeHolidayDateMap();
  const firstMonth = startOfMonth(timeOffCalendarMonth);
  const secondMonth = addMonths(firstMonth, 1);

  if (label) {
    label.textContent = `${formatMonthLabel(firstMonth)} – ${formatMonthLabel(secondMonth)}`;
  }

  grid.innerHTML = `${renderCalendarMonth(firstMonth, blockedDates, holidayDates, today)}${renderCalendarMonth(secondMonth, blockedDates, holidayDates, today)}`;

  const rangeText = $("timeOffSelectedRange");
  if (rangeText && (!timeOffRangeStart || !timeOffRangeEnd)) {
    rangeText.textContent = "No dates selected.";
  }
}

function selectTimeOffCalendarDate(dateValue) {
  const blocked = activeBlockedDateMap();
  const today = dateOnly(new Date());

  if (dateValue < today) {
    setFieldState("timeOffDateRange", "invalid", "Choose today or a future date");
    return;
  }

  if (blocked.has(dateValue)) {
    setFieldState("timeOffDateRange", "invalid", `Blocked: ${formatDateForDisplay(dateValue)}`);
    return;
  }

  setNotice("timeOffFormMessage", "", "");

  let startDate = dateValue;
  let endDate = dateValue;

  if (timeOffRangeStart && timeOffRangeEnd && timeOffRangeStart === timeOffRangeEnd) {
    if (dateValue < timeOffRangeStart) {
      startDate = dateValue;
      endDate = timeOffRangeStart;
    } else {
      startDate = timeOffRangeStart;
      endDate = dateValue;
    }
  }

  const blockedInRange = dateRangeIncludesBlockedDate(startDate, endDate);
  if (blockedInRange) {
    setFieldState("timeOffDateRange", "invalid", `Blocked: ${formatDateForDisplay(blockedInRange.date)}`);
    return;
  }

  setTimeOffRange(startDate, endDate);
  setFieldState("timeOffDateRange", "valid", "Selected");
}

async function loadTimeOffSettings() {
  if (!currentUser) return;

  try {
    const settingsPath = selectedLocationId
      ? `/time-off/settings?locationId=${encodeURIComponent(selectedLocationId)}`
      : "/time-off/settings";
    const data = await api(settingsPath);
    timeOffSettings = {
      requestsEnabled: data.settings?.requestsEnabled !== false,
      blockedDates: data.blockedDates || [],
      holidayDates: data.holidayDates || []
    };
    renderTimeOffSettings();
  } catch (err) {
    timeOffSettings = { requestsEnabled: true, blockedDates: [], holidayDates: [] };
    renderTimeOffSettings();
  }
}

function resetBlockedDateForm() {
  const blockedDateInput = $("blockedDateInput");
  const reasonInput = $("blockedDateReason");
  if (blockedDateInput) blockedDateInput.value = "";
  if (reasonInput) reasonInput.value = "";
  resetFieldState("blockedDateInput", "Required");
  resetFieldState("blockedDateReason", "Required");
  resetFieldState("holidayDateInput", "Required");
  resetFieldState("holidayDateName", "Required");
  setNotice("timeOffFormMessage", "", "");
}

function resetHolidayDateForm() {
  const holidayDateInput = $("holidayDateInput");
  const nameInput = $("holidayDateName");
  if (holidayDateInput) holidayDateInput.value = "";
  if (nameInput) nameInput.value = "";
  resetFieldState("holidayDateInput", "Required");
  resetFieldState("holidayDateName", "Required");
  setNotice("timeOffFormMessage", "", "");
}

function hideHolidayDateForm() {
  resetHolidayDateForm();
  $("holidayDateForm")?.classList.add("hidden");
}

function showHolidayDateForm() {
  resetHolidayDateForm();
  hideBlockedDateForm();
  $("holidayDateForm")?.classList.remove("hidden");
  $("holidayDateInput")?.focus();
}

function hideBlockedDateForm() {
  resetBlockedDateForm();
  $("blockedDateForm")?.classList.add("hidden");
}

function showBlockedDateForm() {
  resetBlockedDateForm();
  hideHolidayDateForm();
  $("blockedDateForm")?.classList.remove("hidden");
  $("blockedDateInput")?.focus();
}

function resetTimeOffRequestForm() {
  const startInput = $("timeOffStartDate");
  const endInput = $("timeOffEndDate");
  const rangeInput = $("timeOffDateRange");
  const reasonInput = $("timeOffReason");
  if (startInput) startInput.value = "";
  if (endInput) endInput.value = "";
  if (rangeInput) rangeInput.value = "";
  if (reasonInput) reasonInput.value = "";
  timeOffRangeStart = null;
  timeOffRangeEnd = null;
  timeOffCalendarMonth = startOfMonth(new Date());
  resetFieldState("timeOffDateRange", "Required");
  resetFieldState("timeOffReason", "Required");
  resetFieldState("blockedDateInput", "Required");
  resetFieldState("blockedDateReason", "Required");
  resetFieldState("holidayDateInput", "Required");
  resetFieldState("holidayDateName", "Required");
  resetFieldState("holidayDateInput", "Required");
  resetFieldState("holidayDateName", "Required");
  resetFieldState("decisionReason", "Required");
  renderTimeOffCalendar();
}

function hideTimeOffRequestForm() {
  resetTimeOffRequestForm();
  $("timeOffRequestForm")?.classList.add("hidden");
}

function showTimeOffRequestForm() {
  if (timeOffSettings.requestsEnabled === false) {
    setNotice("timeOffFormMessage", "error", "Time off requests are currently turned off by the owner.");
    return;
  }

  resetTimeOffRequestForm();
  $("timeOffRequestForm")?.classList.remove("hidden");
  renderTimeOffCalendar();
  $("timeOffCalendarGrid")?.querySelector("button.calendarDay:not([disabled])")?.focus();
}

function renderTimeOffSettings() {
  const enabledInput = $("timeOffRequestsEnabled");
  const requestForm = $("timeOffRequestForm");
  const disabledNotice = $("timeOffDisabledNotice");
  const requestButton = $("showTimeOffRequestFormButton");
  const blockedList = $("blockedDateList");
  const holidayList = $("holidayDateList");

  if (enabledInput) enabledInput.checked = timeOffSettings.requestsEnabled !== false;

  if (requestButton) {
    requestButton.disabled = timeOffSettings.requestsEnabled === false;
  }

  if (requestForm && timeOffSettings.requestsEnabled === false && !canManageSchedule()) {
    requestForm.classList.add("hidden");
  }

  if (disabledNotice) {
    disabledNotice.classList.toggle("hidden", timeOffSettings.requestsEnabled !== false || canManageSchedule());
  }

  if (holidayList) {
    const today = dateOnly(new Date());
    const holidayDates = (timeOffSettings.holidayDates || []).filter((item) => formatRequestDate(item.holiday_date) >= today);
    holidayList.innerHTML = holidayDates.length
      ? `<div class="chipListLabel">Holidays</div>` + holidayDates.map((item) => `
          <span class="dateChip holidayChip">
            ${escapeHtml(formatRequestDate(item.holiday_date))}
            <small>${escapeHtml(item.name || "Holiday")}</small>
            <button class="button textDanger miniButton" type="button" data-action="remove-holiday-date" data-id="${escapeHtml(item.id)}">Remove</button>
          </span>
        `).join("")
      : `<div class="emptyState compactEmpty">No holiday dates.</div>`;
  }

  if (blockedList) {
    const today = dateOnly(new Date());
    const blockedDates = (timeOffSettings.blockedDates || []).filter((item) => formatRequestDate(item.blocked_date) >= today);
    blockedList.innerHTML = blockedDates.length
      ? `<div class="chipListLabel">Blocked Dates</div>` + blockedDates.map((item) => `
          <span class="dateChip">
            ${escapeHtml(formatRequestDate(item.blocked_date))}
            <small>${escapeHtml(item.reason || "No reason")}</small>
            <button class="button textDanger miniButton" type="button" data-action="remove-blocked-date" data-id="${escapeHtml(item.id)}">Remove</button>
          </span>
        `).join("")
      : `<div class="emptyState compactEmpty">No blocked dates.</div>`;
  }

  renderTimeOffCalendar();
}

async function saveTimeOffSettings(event) {
  if (!isOwner()) return;

  const enabledInput = $("timeOffRequestsEnabled");
  const nextValue = enabledInput?.checked !== false;
  const previousValue = timeOffSettings.requestsEnabled !== false;

  if (enabledInput) enabledInput.checked = previousValue;

  const updated = await runOwnerCredentialAction({
    title: nextValue ? "Turn On Time Off Requests" : "Turn Off Time Off Requests",
    message: `Enter your owner password to ${nextValue ? "turn on" : "turn off"} employee time off requests.`,
    confirmLabel: nextValue ? "Turn On" : "Turn Off",
    onConfirm: (actorPassword) =>
      api("/time-off/settings/toggle", {
        method: "POST",
        skipRefresh: true,
        body: JSON.stringify({ requestsEnabled: nextValue, actorPassword, locationId: selectedLocationId })
      })
  });

  if (!updated) {
    if (enabledInput) enabledInput.checked = previousValue;
    return;
  }

  await Promise.all([loadTimeOffSettings(), loadAuditLog()]);
}


function setTimeOffFieldApiError(err, fallbackField = "timeOffReason") {
  const message = err?.message || "Please check this field.";
  const field = err?.field || "";
  const lowerMessage = message.toLowerCase();

  let inputId = fallbackField;

  if (field === "holidayDate" || lowerMessage.includes("holiday date")) inputId = "holidayDateInput";
  else if (field === "holidayName" || lowerMessage.includes("holiday name")) inputId = "holidayDateName";
  else if (field === "blockedDate" || lowerMessage.includes("blocked date") || lowerMessage.includes("cannot be requested for")) inputId = "blockedDateInput";
  else if (field === "blockedReason" || lowerMessage.includes("blocked date reason")) inputId = "blockedDateReason";
  else if (field === "dateRange" || lowerMessage.includes("start and end") || lowerMessage.includes("end date") || lowerMessage.includes("selected range")) inputId = "timeOffDateRange";
  else if (field === "requestReason" || lowerMessage === "reason is required." || lowerMessage.includes("request reason")) inputId = "timeOffReason";

  setFieldState(inputId, "invalid", message);
  $(inputId)?.focus?.();
}

function clearTimeOffFormNotice() {
  setNotice("timeOffFormMessage", "", "");
}

async function addHolidayDate(event) {
  event?.preventDefault?.();
  const holidayDate = $("holidayDateInput")?.value;
  const name = $("holidayDateName")?.value.trim() || "";

  let isValid = true;
  if (!holidayDate) { setFieldState("holidayDateInput", "invalid", "Required"); isValid = false; }
  else setFieldState("holidayDateInput", "valid", "Looks good");

  if (!name) { setFieldState("holidayDateName", "invalid", "Required"); isValid = false; }
  else setFieldState("holidayDateName", "valid", "Looks good");

  if (!isValid) return;

  try {
    await api("/time-off/holidays", {
      method: "POST",
      body: JSON.stringify({ holidayDate, name, locationId: selectedLocationId })
    });
    hideHolidayDateForm();
    await Promise.all([loadTimeOffSettings(), loadAuditLog()]);
  } catch (err) {
    setTimeOffFieldApiError(err, err?.field === "holidayDate" ? "holidayDateInput" : "holidayDateName");
  }
}

async function removeHolidayDate(id) {
  try {
    await api(`/time-off/holidays/${encodeURIComponent(id)}/delete`, {
      method: "POST",
      body: JSON.stringify({ locationId: selectedLocationId })
    });
    await Promise.all([loadTimeOffSettings(), loadAuditLog()]);
  } catch (err) {
    setNotice("timeOffFormMessage", "error", err.message);
  }
}

async function addBlockedDate(event) {
  event?.preventDefault?.();
  const blockedDate = $("blockedDateInput")?.value;
  const reason = $("blockedDateReason")?.value.trim() || "";

  let isValid = true;
  if (!blockedDate) { setFieldState("blockedDateInput", "invalid", "Required"); isValid = false; }
  else setFieldState("blockedDateInput", "valid", "Looks good");

  if (!reason) { setFieldState("blockedDateReason", "invalid", "Required"); isValid = false; }
  else setFieldState("blockedDateReason", "valid", "Looks good");

  if (!isValid) return;

  try {
    await api("/time-off/blocked-dates", {
      method: "POST",
      body: JSON.stringify({ blockedDate, reason, locationId: selectedLocationId })
    });
    hideBlockedDateForm();
    await Promise.all([loadTimeOffSettings(), loadAuditLog()]);
  } catch (err) {
    setTimeOffFieldApiError(err, err?.field === "blockedDate" ? "blockedDateInput" : "blockedDateReason");
  }
}

async function removeBlockedDate(id) {
  try {
    await api(`/time-off/blocked-dates/${encodeURIComponent(id)}/delete`, {
      method: "POST",
      body: JSON.stringify({ locationId: selectedLocationId })
    });
    await Promise.all([loadTimeOffSettings(), loadAuditLog()]);
  } catch (err) {
    setNotice("timeOffFormMessage", "error", err.message);
  }
}

async function loadTimeOffRequests() {
  const hasTimeOffUi = $("pendingTimeOffList") || $("approvedTimeOffList") || $("deniedTimeOffList");
  if (!hasTimeOffUi || !currentUser) return;

  const path = canManageSchedule()
    ? `/time-off?locationId=${encodeURIComponent(selectedLocationId || "")}`
    : "/time-off";

  if (canManageSchedule() && !selectedLocationId) return;

  const data = await api(path);
  timeOffRequests = data.requests || [];
  renderTimeOffRequests();
}

function requestStatusColumnId(status) {
  if (status === "approved") return "approvedTimeOffList";
  if (status === "denied") return "deniedTimeOffList";
  return "pendingTimeOffList";
}

function requesterName(request) {
  return `${request.first_name || ""} ${request.last_name || ""}`.trim() || request.username || "Employee";
}

function approverName(request) {
  return `${request.approver_first_name || ""} ${request.approver_last_name || ""}`.trim() || request.approver_username || "Manager/Owner";
}

function renderRequestCard(request) {
  const managerActions = canManageSchedule() && request.status === "pending"
    ? `<div class="rowActions">
        <button class="button secondary" data-action="approve-time-off" data-id="${escapeHtml(request.id)}">Approve</button>
        <button class="button ghost" data-action="deny-time-off" data-id="${escapeHtml(request.id)}">Not Approve</button>
      </div>`
    : "";

  const decisionDetails = request.status !== "pending"
    ? `<span><strong>${request.status === "approved" ? "Approved" : "Not approved"} by:</strong> ${escapeHtml(approverName(request))}</span>
       <span><strong>Decision reason:</strong> ${escapeHtml(request.decision_reason || "No reason recorded")}</span>`
    : "";

  return `
    <article class="listItem timeOffRequestItem">
      <div>
        <strong>${escapeHtml(requesterName(request))} · ${statusBadge(request.status)}</strong>
        <span>${escapeHtml(formatRequestDate(request.start_date))} → ${escapeHtml(formatRequestDate(request.end_date))}</span>
        <span><strong>Request reason:</strong> ${escapeHtml(request.reason || "No reason provided")}</span>
        ${decisionDetails}
      </div>
      ${managerActions}
    </article>
  `;
}

function renderTimeOffRequests() {
  const columns = ["pendingTimeOffList", "approvedTimeOffList", "deniedTimeOffList"];
  if (!columns.some((id) => $(id))) return;

  const grouped = { pendingTimeOffList: [], approvedTimeOffList: [], deniedTimeOffList: [] };
  for (const request of timeOffRequests) {
    grouped[requestStatusColumnId(request.status)].push(request);
  }

  for (const columnId of columns) {
    const list = $(columnId);
    if (!list) continue;
    list.innerHTML = grouped[columnId].length
      ? grouped[columnId].map(renderRequestCard).join("")
      : `<div class="emptyState compactEmpty">No requests.</div>`;
  }
}

function validateDecisionReason(showEmptyErrors = false) {
  const value = $("decisionReason")?.value.trim() || "";
  if (!value) {
    setFieldState("decisionReason", showEmptyErrors ? "invalid" : "neutral", "Required");
    return false;
  }
  setFieldState("decisionReason", "valid", "Looks good");
  return true;
}

function requestDecisionReason({ title, message, confirmLabel }) {
  const dialog = $("decisionDialog");
  const form = $("decisionForm");
  const titleEl = $("decisionDialogTitle");
  const messageEl = $("decisionDialogMessage");
  const confirmButton = $("confirmDecisionButton");
  const cancelButton = $("cancelDecisionButton");
  const closeButton = $("cancelDecisionX");
  const reasonInput = $("decisionReason");

  if (!dialog || !form || typeof dialog.showModal !== "function") {
    const reason = window.prompt(message || "Enter a reason.");
    return Promise.resolve(reason && reason.trim() ? reason.trim() : null);
  }

  setNotice("decisionDialogNotice", "", "");
  if (reasonInput) reasonInput.value = "";
  resetFieldState("decisionReason", "Required");
  if (titleEl) titleEl.textContent = title || "Decision Reason";
  if (messageEl) messageEl.textContent = message || "Enter the reason for this decision.";
  if (confirmButton) {
    confirmButton.textContent = confirmLabel || "Save Decision";
    confirmButton.disabled = true;
  }

  return new Promise((resolve) => {
    let finished = false;

    const cleanup = () => {
      form.removeEventListener("submit", handleSubmit);
      reasonInput?.removeEventListener("input", handleInput);
      reasonInput?.removeEventListener("blur", handleBlur);
      cancelButton?.removeEventListener("click", handleCancel);
      closeButton?.removeEventListener("click", handleCancel);
      dialog.removeEventListener("cancel", handleCancel);
    };

    const finish = (value) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (dialog.open) dialog.close();
      resolve(value);
    };

    const handleInput = () => {
      const isValid = validateDecisionReason(false);
      if (confirmButton) confirmButton.disabled = !isValid;
    };

    const handleBlur = () => {
      const isValid = validateDecisionReason(true);
      if (confirmButton) confirmButton.disabled = !isValid;
    };

    function handleSubmit(event) {
      event.preventDefault();
      if (!validateDecisionReason(true)) {
        setNotice("decisionDialogNotice", "error", "Reason is required.");
        reasonInput?.focus();
        return;
      }
      finish(reasonInput?.value.trim() || null);
    }

    function handleCancel(event) {
      event?.preventDefault?.();
      finish(null);
    }

    form.addEventListener("submit", handleSubmit);
    reasonInput?.addEventListener("input", handleInput);
    reasonInput?.addEventListener("blur", handleBlur);
    cancelButton?.addEventListener("click", handleCancel);
    closeButton?.addEventListener("click", handleCancel);
    dialog.addEventListener("cancel", handleCancel);

    dialog.showModal();
    window.setTimeout(() => reasonInput?.focus(), 30);
  });
}

async function submitTimeOffRequest(event) {
  event.preventDefault();
  setNotice("timeOffFormMessage", "", "");
  resetFieldState("timeOffDateRange", "Required");
  resetFieldState("timeOffReason", "Required");
  resetFieldState("blockedDateInput", "Required");
  resetFieldState("blockedDateReason", "Required");
  resetFieldState("holidayDateInput", "Required");
  resetFieldState("holidayDateName", "Required");
  resetFieldState("holidayDateInput", "Required");
  resetFieldState("holidayDateName", "Required");
  resetFieldState("decisionReason", "Required");

  const body = {
    startDate: $("timeOffStartDate").value,
    endDate: $("timeOffEndDate").value,
    reason: $("timeOffReason").value.trim()
  };

  let isValid = true;
  if (!body.startDate || !body.endDate) {
    setFieldState("timeOffDateRange", "invalid", "Required");
    isValid = false;
  } else if (body.endDate < body.startDate) {
    setFieldState("timeOffDateRange", "invalid", "End date must be after start");
    isValid = false;
  } else {
    const blockedInRange = dateRangeIncludesBlockedDate(body.startDate, body.endDate);
    if (blockedInRange) {
      setFieldState("timeOffDateRange", "invalid", `Blocked: ${formatDateForDisplay(blockedInRange.date)}`);
      isValid = false;
    } else {
      setFieldState("timeOffDateRange", "valid", "Selected");
    }
  }

  if (!body.reason) { setFieldState("timeOffReason", "invalid", "Required"); isValid = false; }
  else setFieldState("timeOffReason", "valid", "Looks good");

  if (!isValid) return;

  try {
    await api("/time-off", { method: "POST", body: JSON.stringify(body) });
    hideTimeOffRequestForm();
    setNotice("timeOffFormMessage", "success", "Time off request submitted.");
    await Promise.all([loadTimeOffRequests(), loadAuditLog()]);
  } catch (err) {
    setTimeOffFieldApiError(err, err?.field === "dateRange" ? "timeOffDateRange" : "timeOffReason");
  }
}

async function decideTimeOffRequest(id, decision) {
  const approved = decision === "approve";
  const decisionReason = await requestDecisionReason({
    title: approved ? "Approve Time Off" : "Not Approve Time Off",
    message: approved ? "Enter the required approval reason." : "Enter the required reason this request is not approved.",
    confirmLabel: approved ? "Approve" : "Not Approve"
  });

  if (!decisionReason) return;

  try {
    await api(`/time-off/${encodeURIComponent(id)}/${decision}`, {
      method: "POST",
      body: JSON.stringify({ decisionReason })
    });
    await Promise.all([loadTimeOffRequests(), loadSchedule(), loadAuditLog()]);
  } catch (err) {
    setNotice("timeOffFormMessage", "error", err.message);
  }
}

async function loadAuditLog() {
  const list = $("auditLogList");
  if (!list || !currentUser || !canManageSchedule()) return;

  try {
    if (currentUser.role === "employee" || !selectedLocationId) {
      auditLogs = [];
      renderAuditLog();
      return;
    }

    const data = await api(`/audit?locationId=${encodeURIComponent(selectedLocationId)}`);
    auditLogs = data.logs || [];
    renderAuditLog();
  } catch (err) {
    list.innerHTML = `<div class="emptyState">Audit log could not be loaded.</div>`;
  }
}

function renderAuditLog() {
  const list = $("auditLogList");
  if (!list) return;

  if (!auditLogs.length) {
    list.innerHTML = `<div class="emptyState">No audit log entries yet.</div>`;
    return;
  }

  list.innerHTML = auditLogs.map((entry) => {
    const actor = `${entry.first_name || ""} ${entry.last_name || ""}`.trim() || entry.username || entry.full_login || "Unknown user";
    const date = new Date(entry.created_at).toLocaleString();
    return `
      <article class="listItem auditItem">
        <div>
          <strong>${escapeHtml(entry.action)}</strong>
          <span>${escapeHtml(entry.details || entry.entity_type || "Action recorded")}</span>
          <span>${escapeHtml(actor)} · ${escapeHtml(date)}</span>
        </div>
      </article>
    `;
  }).join("");
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

  $("showLocationFormButton").addEventListener("click", () => showLocationForm());
  $("locationForm").addEventListener("submit", saveLocation);
  $("cancelLocationButton").addEventListener("click", () => {
    resetLocationForm();
    $("locationForm").classList.add("hidden");
  });
  $("locationFilter").addEventListener("input", async () => {
    locationPage = 1;
    await loadLocations();
  });
  $("prevLocationPage")?.addEventListener("click", async () => {
    locationPage = Math.max(1, locationPage - 1);
    await loadLocations();
  });
  $("nextLocationPage")?.addEventListener("click", async () => {
    locationPage += 1;
    await loadLocations();
  });
  $("locationList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "select-location") {
      if (selectedLocationId === id) return;
      selectedLocationId = id;
      selectedLocationRecord = locations.find((location) => location.id === id) || selectedLocationRecord;
      renderLocations();
      await loadSelectedLocationData({ resetPages: true });
    }

    if (action === "edit-location") {
      event.stopPropagation();
      editLocation(id);
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

  $("showShiftFormButton").addEventListener("click", showShiftForm);
  $("shiftForm").addEventListener("submit", saveShift);
  $("resetShiftButton").addEventListener("click", () => {
    resetShiftForm();
    $("shiftForm").classList.add("hidden");
  });
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
    if (!selectedLocationId) {
      setNotice("employeeFormMessage", "error", "Select a location before adding an employee.");
      return;
    }

    resetEmployeeForm();
    $("employeeForm").classList.remove("hidden");
  });

  $("employeeFilter").addEventListener("input", async () => {
    employeePage = 1;
    await loadEmployees();
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

  $("showTimeOffRequestFormButton")?.addEventListener("click", showTimeOffRequestForm);
  $("cancelTimeOffRequestButton")?.addEventListener("click", hideTimeOffRequestForm);
  $("timeOffRequestForm")?.addEventListener("submit", submitTimeOffRequest);
  $("prevTimeOffCalendarMonth")?.addEventListener("click", () => {
    timeOffCalendarMonth = addMonths(timeOffCalendarMonth, -1);
    renderTimeOffCalendar();
  });
  $("nextTimeOffCalendarMonth")?.addEventListener("click", () => {
    timeOffCalendarMonth = addMonths(timeOffCalendarMonth, 1);
    renderTimeOffCalendar();
  });
  $("timeOffCalendarGrid")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button || button.disabled) return;
    selectTimeOffCalendarDate(button.dataset.date);
  });
  $("timeOffRequestsEnabled")?.addEventListener("change", saveTimeOffSettings);
  $("showHolidayDateFormButton")?.addEventListener("click", showHolidayDateForm);
  $("cancelHolidayDateButton")?.addEventListener("click", hideHolidayDateForm);
  $("holidayDateForm")?.addEventListener("submit", addHolidayDate);
  $("showBlockedDateFormButton")?.addEventListener("click", showBlockedDateForm);
  $("cancelBlockedDateButton")?.addEventListener("click", hideBlockedDateForm);
  $("blockedDateForm")?.addEventListener("submit", addBlockedDate);
  $("holidayDateList")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action='remove-holiday-date']");
    if (button) await removeHolidayDate(button.dataset.id);
  });
  $("blockedDateList")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action='remove-blocked-date']");
    if (button) await removeBlockedDate(button.dataset.id);
  });
  $("timeOffPanel")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "approve-time-off") await decideTimeOffRequest(button.dataset.id, "approve");
    if (button.dataset.action === "deny-time-off") await decideTimeOffRequest(button.dataset.id, "deny");
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
  $("settingsButton").addEventListener("click", () => $("settingsDialog").showModal());
  $("closeSettingsDialog").addEventListener("click", () => $("settingsDialog").close());
  $("closePlanDialog").addEventListener("click", () => $("planDialog").close());
  $("planList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action='select-plan']");
    if (!button || button.disabled) return;
    await changePlan(button.dataset.code);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  setupSectionNavigationHighlighting();
  resetLocationForm();
  $("locationForm").classList.add("hidden");
  renderShiftDayEditor(defaultShiftDays());
  renderAvailabilityEditor(defaultAvailability());
  renderDaysOffList();
  resetShiftForm();
  $("shiftForm").classList.add("hidden");
  resetEmployeeForm();
  resetFieldState("timeOffDateRange", "Required");
  resetFieldState("timeOffReason", "Required");
  resetFieldState("blockedDateInput", "Required");
  resetFieldState("blockedDateReason", "Required");
  resetFieldState("holidayDateInput", "Required");
  resetFieldState("holidayDateName", "Required");
  resetFieldState("holidayDateInput", "Required");
  resetFieldState("holidayDateName", "Required");
  resetFieldState("decisionReason", "Required");
});
