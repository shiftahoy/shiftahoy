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

const LANGUAGE_OPTIONS = [
  { code: "af-ZA", native: "Afrikaans", flag: "🇿🇦" }, { code: "sq-AL", native: "Shqip", flag: "🇦🇱" }, { code: "am-ET", native: "አማርኛ", flag: "🇪🇹" }, { code: "ar-SA", native: "العربية", flag: "🇸🇦" }, { code: "hy-AM", native: "Հայերեն", flag: "🇦🇲" }, { code: "az-AZ", native: "Azərbaycan", flag: "🇦🇿" },
  { code: "eu-ES", native: "Euskara", flag: "🇪🇸" }, { code: "bn-BD", native: "বাংলা", flag: "🇧🇩" }, { code: "bs-BA", native: "Bosanski", flag: "🇧🇦" }, { code: "bg-BG", native: "Български", flag: "🇧🇬" }, { code: "ca-ES", native: "Català", flag: "🇪🇸" }, { code: "zh-CN", native: "简体中文", flag: "🇨🇳" }, { code: "zh-TW", native: "繁體中文", flag: "🇹🇼" },
  { code: "hr-HR", native: "Hrvatski", flag: "🇭🇷" }, { code: "cs-CZ", native: "Čeština", flag: "🇨🇿" }, { code: "da-DK", native: "Dansk", flag: "🇩🇰" }, { code: "nl-NL", native: "Nederlands", flag: "🇳🇱" }, { code: "en-US", native: "English", flag: "🇺🇸" }, { code: "et-EE", native: "Eesti", flag: "🇪🇪" },
  { code: "fi-FI", native: "Suomi", flag: "🇫🇮" }, { code: "fr-FR", native: "Français", flag: "🇫🇷" }, { code: "gl-ES", native: "Galego", flag: "🇪🇸" }, { code: "ka-GE", native: "ქართული", flag: "🇬🇪" }, { code: "de-DE", native: "Deutsch", flag: "🇩🇪" }, { code: "el-GR", native: "Ελληνικά", flag: "🇬🇷" }, { code: "gu-IN", native: "ગુજરાતી", flag: "🇮🇳" },
  { code: "he-IL", native: "עברית", flag: "🇮🇱" }, { code: "hi-IN", native: "हिन्दी", flag: "🇮🇳" }, { code: "hu-HU", native: "Magyar", flag: "🇭🇺" }, { code: "is-IS", native: "Íslenska", flag: "🇮🇸" }, { code: "id-ID", native: "Bahasa Indonesia", flag: "🇮🇩" }, { code: "ga-IE", native: "Gaeilge", flag: "🇮🇪" }, { code: "it-IT", native: "Italiano", flag: "🇮🇹" },
  { code: "ja-JP", native: "日本語", flag: "🇯🇵" }, { code: "kn-IN", native: "ಕನ್ನಡ", flag: "🇮🇳" }, { code: "kk-KZ", native: "Қазақ", flag: "🇰🇿" }, { code: "ko-KR", native: "한국어", flag: "🇰🇷" }, { code: "lv-LV", native: "Latviešu", flag: "🇱🇻" }, { code: "lt-LT", native: "Lietuvių", flag: "🇱🇹" },
  { code: "ms-MY", native: "Bahasa Melayu", flag: "🇲🇾" }, { code: "ml-IN", native: "മലയാളം", flag: "🇮🇳" }, { code: "mr-IN", native: "मराठी", flag: "🇮🇳" }, { code: "ne-NP", native: "नेपाली", flag: "🇳🇵" }, { code: "no-NO", native: "Norsk", flag: "🇳🇴" }, { code: "fa-IR", native: "فارسی", flag: "🇮🇷" }, { code: "pl-PL", native: "Polski", flag: "🇵🇱" },
  { code: "pt-BR", native: "Português", flag: "🇧🇷" }, { code: "pa-IN", native: "ਪੰਜਾਬੀ", flag: "🇮🇳" }, { code: "ro-RO", native: "Română", flag: "🇷🇴" }, { code: "ru-RU", native: "Русский", flag: "🇷🇺" }, { code: "sr-RS", native: "Српски", flag: "🇷🇸" }, { code: "sk-SK", native: "Slovenčina", flag: "🇸🇰" }, { code: "sl-SI", native: "Slovenščina", flag: "🇸🇮" },
  { code: "es-ES", native: "Español", flag: "🇪🇸" }, { code: "sw-KE", native: "Kiswahili", flag: "🇰🇪" }, { code: "sv-SE", native: "Svenska", flag: "🇸🇪" }, { code: "ta-IN", native: "தமிழ்", flag: "🇮🇳" }, { code: "te-IN", native: "తెలుగు", flag: "🇮🇳" }, { code: "th-TH", native: "ไทย", flag: "🇹🇭" }, { code: "tr-TR", native: "Türkçe", flag: "🇹🇷" },
  { code: "uk-UA", native: "Українська", flag: "🇺🇦" }, { code: "ur-PK", native: "اردو", flag: "🇵🇰" }, { code: "vi-VN", native: "Tiếng Việt", flag: "🇻🇳" }, { code: "cy-GB", native: "Cymraeg", flag: "🏴" }, { code: "zu-ZA", native: "isiZulu", flag: "🇿🇦" }
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
let timeOffSettings = { requestsEnabled: true, shiftSwapsEnabled: true, blockedDates: [], holidayDates: [] };
let timeOffCalendarMonth = startOfMonth(new Date());
let timeOffRangeStart = null;
let timeOffRangeEnd = null;
let auditLogs = [];
let auditPage = 1;
let auditTotalPages = 1;
let auditTotal = 0;
let allPlans = [];
let currentPlanRecord = null;
let pendingRecoveryMode = "password";
let ownerSecuritySettings = { twoFactorEnabled: false };
let lastPrintedScheduleTitle = "Shift Ahoy Schedule";
let lastSchedulePayload = { cells: [], coverage: [], warnings: [], health: null };
let pendingClockAction = null;
let selectedBusinessAccountNumber = localStorage.getItem("shiftAhoyBusinessAccountNumber") || "";
let selectedBusinessName = localStorage.getItem("shiftAhoyBusinessName") || "";
let businessGatePendingActivation = false;
let clockSessionToken = sessionStorage.getItem("shiftAhoyClockSessionToken") || "";

const message = document.getElementById("message");

const signupFieldIds = [
  "signupFirstName",
  "signupLastName",
  "signupBusinessName",
  "signupEmail",
  "signupPassword"
];
const loginFieldIds = ["businessAccountNumber", "loginValue", "loginPassword"];


function $(id) {
  return document.getElementById(id);
}

function dashboardWelcomeText() {
  const name = userDisplayName();
  const id = userAccountNumber();
  const label = id ? `${name} · ID# ${id}` : name;
  return label ? `Welcome aboard, ${label}` : "Welcome aboard";
}

function setDashboardWelcome(text) {
  const loginText = $("dashboardLoginText");
  if (!loginText) return;

  const prefix = "Welcome aboard,";
  loginText.textContent = text.startsWith(prefix) ? text.replace(prefix, "").trim() : text;
}

function showMessage(text, type = "error") {
  const status = $("dashboardStatus");
  if (status) {
    status.className = "dashboardStatus hidden";
    status.textContent = "";
  }

  if (text) {
    const logger = type === "error" ? console.warn : console.info;
    logger.call(console, text);
  }
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
  ["scheduleLocationName", "shiftLocationName", "employeeLocationName", "locationRulesLocationName", "employeePortalLocationName", "managerPortalLocationName"].forEach((id) => {
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


function normalizeLanguageCode(code) {
  const text = String(code || "").trim();
  if (!text) return "en-US";
  const exact = LANGUAGE_OPTIONS.find((language) => language.code.toLowerCase() === text.toLowerCase());
  if (exact) return exact.code;
  const base = text.split("-")[0].toLowerCase();
  return LANGUAGE_OPTIONS.find((language) => language.code.toLowerCase().startsWith(`${base}-`))?.code || "en-US";
}

function detectDeviceLanguage() {
  const saved = localStorage.getItem("shiftAhoyLanguage");
  if (saved) return normalizeLanguageCode(saved);
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
  return normalizeLanguageCode(candidates[0]);
}

function currentLanguageOption() {
  const code = normalizeLanguageCode(localStorage.getItem("shiftAhoyLanguage") || detectDeviceLanguage());
  return LANGUAGE_OPTIONS.find((language) => language.code === code) || LANGUAGE_OPTIONS.find((language) => language.code === "en-US");
}

function renderLanguageSelector(targetId) {
  const target = $(targetId);
  if (!target) return;
  const selected = currentLanguageOption();
  target.innerHTML = `
    <label class="languageSelectWrap" for="${targetId}Select">
      <select id="${targetId}Select" class="languageSelect" aria-label="Language">
        ${LANGUAGE_OPTIONS.map((language) => `<option value="${escapeHtml(language.code)}" ${language.code === selected.code ? "selected" : ""}>${escapeHtml(language.flag)} ${escapeHtml(language.native)}</option>`).join("")}
      </select>
    </label>
  `;
  const select = $(`${targetId}Select`);
  select?.addEventListener("change", () => setLanguage(select.value));
}

function setLanguage(code) {
  const normalized = normalizeLanguageCode(code);
  localStorage.setItem("shiftAhoyLanguage", normalized);
  document.documentElement.lang = normalized;
  renderLanguageSelector("authLanguageDock");
  renderLanguageSelector("settingsLanguageSelector");
}

function userDisplayName() {
  const first = currentUser?.firstName || currentUser?.first_name || "";
  const last = currentUser?.lastName || currentUser?.last_name || "";
  return `${first} ${last}`.trim() || currentUser?.accountNumber || currentUser?.account_number || currentUser?.email || "Shift Ahoy User";
}

function userAccountNumber() {
  return currentUser?.accountNumber || currentUser?.account_number || currentUser?.employeeCode || currentUser?.employee_code || currentUser?.businessAccountNumber || currentUser?.business_account_number || "";
}

function userDisplayNameWithId() {
  const id = userAccountNumber();
  const name = userDisplayName();
  return id ? `${name} · ID# ${id}` : name;
}

function userInitials() {
  const name = userDisplayName();
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2);
  return initials.toUpperCase();
}

function profileAvatarHtml(extraClass = "") {
  const initials = escapeHtml(userInitials());
  return `<span class="profileMiniAvatar ${extraClass}" aria-label="${escapeHtml(userDisplayName())}">${initials}</span>`;
}

function renderProfileSettings() {
  const name = userDisplayName();
  const accountNumber = userAccountNumber() || "ID# unavailable";
  const email = currentUser?.email || "Email unavailable";

  if ($("settingsProfileName")) $("settingsProfileName").textContent = name;
  if ($("settingsProfileUsername")) $("settingsProfileUsername").textContent = `ID# ${accountNumber}`;
  if ($("settingsProfileEmail")) $("settingsProfileEmail").textContent = email;
  if ($("settingsProfileInitials")) {
    $("settingsProfileInitials").textContent = userInitials();
    $("settingsProfileInitials").classList.remove("hidden");
  }
}

function updateProfileAvatars() {
  document.querySelectorAll("[data-profile-avatar]").forEach((slot) => {
    slot.innerHTML = profileAvatarHtml("embeddedAvatar");
  });
}

function applyAccountVisibility() {
  const employeeOnly = currentUser?.role === "employee";
  document.querySelectorAll(".nonEmployeeOnly").forEach((el) => el.classList.toggle("hidden", employeeOnly));
}

function applyAppearanceMode(mode = localStorage.getItem("shiftAhoyAppearance") || "system") {
  const safeMode = ["system", "light", "dark"].includes(mode) ? mode : "system";
  localStorage.setItem("shiftAhoyAppearance", safeMode);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  document.body.classList.toggle("theme-dark", safeMode === "dark" || (safeMode === "system" && prefersDark));
  if ($("appearanceMode")) $("appearanceMode").value = safeMode;
}

async function loadOwnerSecuritySettings() {
  if (!accessToken || !isOwner()) return;
  try {
    const data = await api("/auth/settings");
    ownerSecuritySettings = data.settings || ownerSecuritySettings;
    if ($("ownerTwoFactorEnabled")) $("ownerTwoFactorEnabled").checked = !!ownerSecuritySettings.twoFactorEnabled;
  } catch (err) {
    setNotice("ownerSecurityNotice", "error", err.message);
  }
}

async function saveOwnerSecuritySettings() {
  if (!isOwner()) return;
  const enabled = !!$("ownerTwoFactorEnabled")?.checked;
  const saved = await runOwnerCredentialAction({
    title: enabled ? "Enable Owner 2FA" : "Disable Owner 2FA",
    message: "Enter your password to update the owner security setting.",
    confirmLabel: enabled ? "Enable 2FA" : "Disable 2FA",
    onConfirm: (actorPassword) => api("/auth/settings", {
      method: "PUT",
      body: JSON.stringify({ twoFactorEnabled: enabled, actorPassword })
    })
  });
  if (saved) {
    ownerSecuritySettings.twoFactorEnabled = enabled;
    setNotice("ownerSecurityNotice", "success", "Owner security setting saved.");
  } else if ($("ownerTwoFactorEnabled")) {
    $("ownerTwoFactorEnabled").checked = !!ownerSecuritySettings.twoFactorEnabled;
  }
}

function openRecoveryDialog(mode) {
  pendingRecoveryMode = mode === "id" ? "id" : "password";
  const isIdRecovery = pendingRecoveryMode === "id";

  if ($("recoveryTitle")) $("recoveryTitle").textContent = isIdRecovery ? "Forgot ID#" : "Reset Password";
  if ($("recoveryMessage")) {
    $("recoveryMessage").textContent = isIdRecovery
      ? "Enter the verified email on your account and we will send your permanent Shift Ahoy ID#."
      : "Enter the verified email on your account and we will send a password-reset link.";
  }
  if ($("submitRecoveryButton")) $("submitRecoveryButton").textContent = isIdRecovery ? "Send ID#" : "Send Reset Link";

  const recoveryEmail = $("recoveryEmail");
  const loginValue = $("loginValue")?.value || "";
  if (recoveryEmail) {
    recoveryEmail.value = currentUser?.email || (loginValue.includes("@") ? loginValue : "");
  }

  resetFieldState("recoveryEmail", "Required");
  setNotice("recoveryNotice", "", "");
  $("recoveryDialog")?.showModal();
  window.setTimeout(() => recoveryEmail?.focus?.(), 30);
}

function validateRecoveryEmail(showEmptyErrors = true) {
  const emailInput = $("recoveryEmail");
  const email = emailInput?.value?.trim() || "";

  if (!email) {
    setFieldState("recoveryEmail", showEmptyErrors ? "invalid" : "neutral", "Required");
    return false;
  }

  if (!isValidEmailInput(email)) {
    setFieldState("recoveryEmail", "invalid", "Enter a valid email");
    return false;
  }

  setFieldState("recoveryEmail", "valid", "Valid email");
  return true;
}

async function submitRecovery(event) {
  event.preventDefault();

  if (!validateRecoveryEmail(true)) {
    setNotice("recoveryNotice", "error", "Enter a valid email address.");
    $("recoveryEmail")?.focus?.();
    return;
  }

  const email = $("recoveryEmail")?.value?.trim();
  const endpoint = pendingRecoveryMode === "id" ? "/auth/forgot-id" : "/auth/forgot-password";

  try {
    const data = await api(endpoint, { method: "POST", body: JSON.stringify({ email }) });
    setNotice("recoveryNotice", "success", data.message || "If that email exists, instructions have been sent.");
  } catch (err) {
    setNotice("recoveryNotice", "error", err.message);
  }
}

function setupEnterToSubmit() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.isComposing) return;
    const control = event.target;
    if (!(control instanceof HTMLElement)) return;
    const tag = control.tagName.toLowerCase();
    if (!["input", "select", "textarea"].includes(tag) || tag === "textarea") return;
    const form = control.closest("form");
    if (form) {
      event.preventDefault();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return;
    }
    const fallbackMap = {
      signupFirstName: "signupButton", signupLastName: "signupButton", signupBusinessName: "signupButton", signupEmail: "signupButton", signupPassword: "signupButton",
      loginValue: "loginButton", loginPassword: "loginButton", employeeFilter: null, locationFilter: null, shiftFilter: null
    };
    const buttonId = fallbackMap[control.id];
    if (buttonId && $(buttonId)) {
      event.preventDefault();
      $(buttonId).click();
    }
  });
}

function cleanUsernameInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 30);
}

function normalizeIdInput(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 9);
}

function isValidIdInput(value) {
  return /^\d{9}$/.test(String(value || ""));
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
  const group = document.querySelector(`[data-field="${inputId}"]`) || input?.closest?.(".fieldGroup");
  const status = $(`${inputId}Status`);

  if (!input) return;

  group?.classList.remove("is-valid", "is-invalid");
  input.classList.remove("inputInvalid");

  if (state === "valid") {
    group?.classList.add("is-valid");
    input.setAttribute("aria-invalid", "false");
    if (status) status.textContent = message ? `✓ ${message}` : "✓";
    return;
  }

  if (state === "invalid") {
    group?.classList.add("is-invalid");
    input.classList.add("inputInvalid");
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
  return ["locationsPanel", "portalsPanel", "schedulePanel", "shiftsPanel", "employeesPanel", "auditPanel"]
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

  const scrollToExactPanelStart = () => {
    const topOffset = sectionId === "locationsPanel"
      ? 0
      : Math.max(0, Math.round(sectionDocumentTop(section)));

    window.scrollTo({ top: topOffset, behavior: "smooth" });
  };

  window.history.replaceState(null, "", `#${sectionId}`);
  scrollToExactPanelStart();

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(scrollToExactPanelStart);
  });
}

function updateActiveNavigationFromScroll() {
  if (Date.now() < navigationClickHoldUntil) return;

  const sections = visibleSectionCandidates();
  if (!sections.length) return;

  if (window.scrollY <= 4) {
    setActiveNavigation("locationsPanel");
    return;
  }

  const viewportTopY = window.scrollY;
  let activeSection = sections[0];

  for (const section of sections) {
    const activationY = sectionDocumentTop(section);

    if (viewportTopY >= activationY - 1) {
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
    message.includes("password") ||
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
    const actorPassword = window.prompt(message || "Enter your password to continue.");
    if (!actorPassword || !onConfirm) return false;
    await onConfirm(actorPassword);
    return true;
  }

  resetCredentialDialog();
  if (titleEl) titleEl.textContent = title || "Confirm Delete";
  if (messageEl) messageEl.textContent = message || "Enter your password to continue.";
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
        setNotice("credentialDialogNotice", "error", "Password is required.");
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
    return Promise.resolve(window.prompt(message || "Enter your password to continue."));
  }

  resetCredentialDialog();
  if (titleEl) titleEl.textContent = title || "Confirm Delete";
  if (messageEl) messageEl.textContent = message || "Enter your password to continue.";
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
        setNotice("credentialDialogNotice", "error", "Password is required.");
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

  if (false && inputId === "signupUsername") {
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

function currentBusinessAccountNumber() {
  return normalizeIdInput(selectedBusinessAccountNumber || $("businessAccountNumber")?.value || currentUser?.businessAccountNumber || "");
}

function businessActiveLabel() {
  if (!selectedBusinessAccountNumber) return "";
  const name = selectedBusinessName || "Shift Ahoy";
  return `${name} · Business ID# ${selectedBusinessAccountNumber}`;
}

function setAuthTransition(message = "") {
  const banner = $("authTransitionBanner");
  if (!banner) return;

  if (!selectedBusinessAccountNumber) {
    banner.className = "formNotice success authTransitionBanner hidden";
    banner.textContent = "";
    return;
  }

  banner.className = "formNotice success authTransitionBanner";
  banner.textContent = message || `Business selected: ${businessActiveLabel()}. Login or use Clock In / Out below.`;
}

function renderBusinessGate(options = {}) {
  const input = $("businessAccountNumber");
  const hasSelectedBusiness = !!selectedBusinessAccountNumber;
  const hasActivatedBusiness = hasSelectedBusiness && !businessGatePendingActivation;

  if (input && hasSelectedBusiness) input.value = selectedBusinessAccountNumber;

  const cards = $("authCards");
  cards?.classList.toggle("businessActive", hasActivatedBusiness);
  cards?.classList.toggle("businessPendingActivation", hasSelectedBusiness && businessGatePendingActivation);

  $("ownerSignupCard")?.classList.remove("hidden");
  $("businessGateCard")?.classList.toggle("hidden", hasActivatedBusiness);

  const grid = $("authMiniGrid");
  if (grid) grid.classList.toggle("hidden", !hasActivatedBusiness);

  const active = $("businessGateActive");
  if (active) {
    active.classList.add("hidden");
    active.textContent = "";
  }

  setAuthTransition(hasActivatedBusiness ? options.message || "" : "");
  updateClockPortalAccessState();
}

async function activateBusinessGate() {
  const input = $("businessAccountNumber");
  const businessAccountNumber = normalizeIdInput(input?.value || "");

  if (!isValidIdInput(businessAccountNumber)) {
    setNotice("businessGateMessage", "error", "Enter a valid 9 digit Business ID#.");
    setFieldState("businessAccountNumber", "invalid", "Required");
    return;
  }

  try {
    const data = await api("/auth/business/lookup", {
      method: "POST",
      body: JSON.stringify({ businessAccountNumber })
    });

    selectedBusinessAccountNumber = data.business?.businessAccountNumber || businessAccountNumber;
    selectedBusinessName = data.business?.businessName || "";
    businessGatePendingActivation = false;
    localStorage.setItem("shiftAhoyBusinessAccountNumber", selectedBusinessAccountNumber);
    localStorage.setItem("shiftAhoyBusinessName", selectedBusinessName);
    setFieldState("businessAccountNumber", "valid", "Business selected");
    setNotice("businessGateMessage", "success", "Business selected. Login and Clock In / Out are now available.");
    renderBusinessGate();
    updateClockPortalAccessState();
  } catch (err) {
    selectedBusinessAccountNumber = "";
    selectedBusinessName = "";
    businessGatePendingActivation = false;
    localStorage.removeItem("shiftAhoyBusinessAccountNumber");
    localStorage.removeItem("shiftAhoyBusinessName");
    renderBusinessGate();
    setNotice("businessGateMessage", "error", err.message || "Business lookup failed.");
    setFieldState("businessAccountNumber", "invalid", "Not found");
  }
}

function validateLoginForm(showEmptyErrors = false) {
  const businessAccountNumber = currentBusinessAccountNumber();
  const loginValue = $("loginValue")?.value?.trim() || "";
  const password = normalizePasswordInput($("loginPassword")?.value || "");

  if (!isValidIdInput(businessAccountNumber)) {
    setFieldState("businessAccountNumber", showEmptyErrors ? "invalid" : "neutral", "Required");
  } else {
    setFieldState("businessAccountNumber", "valid", "Business active");
  }

  if (!loginValue) {
    setFieldState("loginValue", showEmptyErrors ? "invalid" : "neutral", "Required");
  } else {
    setFieldState("loginValue", "valid", "Looks good");
  }

  if (!password) {
    setFieldState("loginPassword", showEmptyErrors ? "invalid" : "neutral", "Required");
  } else {
    setFieldState("loginPassword", "valid", "Password entered");
  }

  return isValidIdInput(businessAccountNumber) && !!loginValue && !!password;
}

function clearAuthFieldStates() {
  signupFieldIds.forEach((id) => resetFieldState(id, id === "signupPassword" ? "12–128" : "Required"));
  loginFieldIds.forEach((id) => resetFieldState(id, "Required"));
}

function setSignupApiError(err) {
  const message = err?.message || "Account creation failed.";
  const lowerMessage = message.toLowerCase();
  let inputId = err?.field || "signupBusinessName";

  if (lowerMessage.includes("first name")) inputId = "signupFirstName";
  else if (lowerMessage.includes("last name")) inputId = "signupLastName";
  else if (lowerMessage.includes("business")) inputId = "signupBusinessName";
  else if (lowerMessage.includes("email")) inputId = "signupEmail";
  else if (lowerMessage.includes("password")) inputId = "signupPassword";

  setFieldState(inputId, "invalid", message);
  $(inputId)?.focus?.();
}

function setLoginApiError(err) {
  const message = err?.message || "Login failed.";
  setFieldState("loginValue", "invalid", message);
  setFieldState("loginPassword", "invalid", "Check password");
  $("loginValue")?.focus?.();
}

function setAuthButtonBusy(buttonId, busy, busyText = "Working...") {
  const button = $(buttonId);
  if (!button) return;

  if (busy) {
    button.dataset.originalText = button.textContent || "";
    button.textContent = busyText;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.originalText || button.textContent || "Submit";
  button.disabled = false;
}

async function signup(event) {
  event?.preventDefault?.();
  setNotice("signupFormMessage", "", "");
  setNotice("loginFormMessage", "", "");

  if (!validateSignupForm(true)) {
    setNotice("signupFormMessage", "error", "Please fix the highlighted fields before creating the account.");
    return;
  }

  const payload = {
    firstName: $("signupFirstName")?.value?.trim() || "",
    lastName: $("signupLastName")?.value?.trim() || "",
    businessName: $("signupBusinessName")?.value?.trim() || "",
    email: $("signupEmail")?.value?.trim() || "",
    password: normalizePasswordInput($("signupPassword")?.value || "")
  };

  setAuthButtonBusy("signupButton", true, "Creating...");

  try {
    const data = await api("/auth/signup", {
      method: "POST",
      skipRefresh: true,
      body: JSON.stringify(payload)
    });

    const successMessage = data.message || "Owner account created.";

    if (data.businessAccountNumber) {
      selectedBusinessAccountNumber = data.businessAccountNumber;
      selectedBusinessName = data.businessName || payload.businessName;
      businessGatePendingActivation = true;
      localStorage.setItem("shiftAhoyBusinessAccountNumber", selectedBusinessAccountNumber);
      localStorage.setItem("shiftAhoyBusinessName", selectedBusinessName);
      renderBusinessGate();
      setNotice("signupFormMessage", "success", `${successMessage} Your permanent Business ID# is ${selectedBusinessAccountNumber}. Check your email for verification.`);
      setAuthTransition(`Business ID# ready: ${selectedBusinessName || "Shift Ahoy"} · Business ID# ${selectedBusinessAccountNumber}. Press Continue in 00 to reveal Login and Clock In / Out.`);
      setNotice("businessGateMessage", "success", "Business ID# filled in. Press Continue to continue.");
      setFieldState("businessAccountNumber", "valid", "Ready");
      $("businessGateButton")?.focus?.();
    } else {
      setNotice("signupFormMessage", "success", successMessage);
    }

    if ($("loginValue")) $("loginValue").value = payload.email;
    if ($("loginPassword")) $("loginPassword").value = "";
  } catch (err) {
    setSignupApiError(err);
    setNotice("signupFormMessage", "error", err.message || "Account creation failed.");
  } finally {
    setAuthButtonBusy("signupButton", false);
  }
}

async function login(event) {
  event?.preventDefault?.();
  setNotice("loginFormMessage", "", "");
  showMessage("");

  const loginValue = $("loginValue")?.value?.trim() || "";
  const password = normalizePasswordInput($("loginPassword")?.value || "");

  if (!validateLoginForm(true)) {
    setNotice("loginFormMessage", "error", "Enter your Business ID#, Employee ID# or email, and password.");
    return;
  }

  setAuthButtonBusy("loginButton", true, "Logging in...");

  try {
    const data = await api("/auth/login", {
      method: "POST",
      skipRefresh: true,
      body: JSON.stringify({ login: loginValue, password, businessAccountNumber: currentBusinessAccountNumber() })
    });

    if (data.twoFactorRequired) {
      const twoFactorCode = window.prompt("Enter the 6 digit verification code sent to your email.");
      if (!twoFactorCode) throw new Error("Verification code is required.");
      const verified = await api("/auth/login", {
        method: "POST",
        skipRefresh: true,
        body: JSON.stringify({ login: loginValue, password, businessAccountNumber: currentBusinessAccountNumber(), twoFactorCode })
      });
      accessToken = verified.accessToken;
      currentUser = verified.user;
    } else {
      accessToken = data.accessToken;
      currentUser = data.user;
    }

    renderProfileSettings();
    updateProfileAvatars();

    if (!accessToken || !currentUser) {
      throw new Error("Login succeeded, but the server did not return a session.");
    }

    applyRoleUI();
    await loadPlans(false).catch(() => {});
    await loadLocations({ resetPage: true });
    await loadOwnerSecuritySettings().catch(() => {});
    renderUltimateAutomationPanels();
  } catch (err) {
    accessToken = null;
    currentUser = null;
    setLoginApiError(err);
    setNotice("loginFormMessage", "error", err.message || "Login failed.");
  } finally {
    setAuthButtonBusy("loginButton", false);
  }
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
  renderProfileSettings();
  updateProfileAvatars();
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

function desktopClockHeaders() {
  return { "X-ShiftAhoy-Desktop-Clock": "1" };
}

function applyRoleUI() {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  const owner = isOwner();
  const canManage = canManageSchedule();
  const employeeOnly = currentUser?.role === "employee";

  document.body.classList.toggle("employeePortalOnly", employeeOnly);
  applyAccountVisibility();
  $("upgradeButton").classList.toggle("hidden", !owner || employeeOnly);
  $("currentPlanText").classList.toggle("hidden", !owner || employeeOnly);
  $("settingsButton").classList.toggle("hidden", !currentUser);

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

  applyAccountVisibility();
  renderProfileSettings();
  updateProfileAvatars();

  document.querySelectorAll(".managerOnly").forEach((el) => {
    el.classList.toggle("hidden", !canManage || employeeOnly);
  });

  document.querySelectorAll(".employeeOnlyHidden").forEach((el) => {
    el.classList.toggle("hidden", employeeOnly);
  });

  if (employeeOnly) {
    ["locationsPanel", "schedulePanel", "shiftsPanel", "employeesPanel", "auditPanel", "managerPortalPanel"].forEach((id) => $(id)?.classList.add("hidden"));
    $("portalsPanel")?.classList.remove("hidden");
    setActiveNavigation("portalsPanel");
  }

  setDashboardWelcome(dashboardWelcomeText());
  showMessage("");
  updateActiveNavigationFromScroll();
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
          <button class="button secondary" data-action="duplicate-location" data-id="${escapeHtml(location.id)}">Duplicate</button>
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
    await Promise.all([loadEmployeeSchedule(), loadOpenShifts(), loadShiftSwaps()]);
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


async function duplicateLocation(locationId) {
  const source = locations.find((location) => location.id === locationId) || selectedLocationRecord;
  if (!source) return;

  const copied = await runOwnerCredentialAction({
    title: "Duplicate Location",
    message: `Enter your password to duplicate ${source.name}. Shifts, schedule rules, blocked dates, and holidays will be copied. Employees and historical schedules are not copied.`,
    confirmLabel: "Duplicate Location",
    onConfirm: (actorPassword) =>
      api(`/locations/${encodeURIComponent(locationId)}/duplicate`, {
        method: "POST",
        skipRefresh: true,
        body: JSON.stringify({
          actorPassword,
          name: `${source.name} Copy`,
          copyShifts: true,
          copyScheduleRules: true,
          copyTimeOffRules: true
        })
      })
  });

  if (!copied?.location) return;
  selectedLocationId = copied.location.id;
  selectedLocationRecord = copied.location;
  await loadLocations();
  showMessage(`${copied.location.name} duplicated.`, "success");
}

async function deleteLocation(locationId) {
  const location = locations.find((item) => item.id === locationId);
  if (!location) return;

  const deleted = await runOwnerCredentialAction({
    title: "Delete Location",
    message: `Enter your password to delete ${location.name}. This also removes its shifts and employees.`,
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

  lastSchedulePayload = {
    cells: data.cells || [],
    coverage: data.coverage || [],
    warnings: data.warnings || [],
    health: data.health || null,
    skipped: data.skipped || []
  };
  renderSchedule(lastSchedulePayload.cells, data.employees || []);
  renderScheduleHealth(lastSchedulePayload.health, lastSchedulePayload.coverage, lastSchedulePayload.warnings);
  renderUltimateAutomationPanels();
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

function renderSchedule(cells, employeesForRows = []) {
  const table = $("scheduleTable");
  const grouped = new Map();

  for (const employee of employeesForRows || []) {
    grouped.set(employee.employee_id, {
      priority: Number(employee.priority || 0),
      employeeCode: employee.account_number || employee.employee_code || "—",
      employee: `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.account_number || "Employee",
      title: employee.title || "—",
      days: {}
    });
  }

  for (const cell of cells) {
    if (!grouped.has(cell.employee_id)) {
      grouped.set(cell.employee_id, {
        priority: Number(cell.priority || 0),
        employeeCode: cell.account_number || cell.employee_code || "—",
        employee: `${cell.first_name || ""} ${cell.last_name || ""}`.trim() || cell.account_number || "Employee",
        title: cell.title || "—",
        days: {}
      });
    }

    grouped.get(cell.employee_id).days[cell.work_date] = cell;
  }

  const rows = [...grouped.values()].sort((a, b) => (
    Number(a.priority) - Number(b.priority) ||
    String(a.employeeCode).localeCompare(String(b.employeeCode)) ||
    String(a.employee).localeCompare(String(b.employee))
  ));

  const weekEnd = addDays(currentWeekStart, 6);
  const totalCells = Array.isArray(cells) ? cells.length : 0;
  const scheduledEmployees = Array.isArray(cells) ? new Set(cells.map((cell) => cell.employee_id)).size : 0;

  table.innerHTML = `
    <caption class="scheduleCaption">
      <strong>Schedule Forecast</strong>
      <span>${escapeHtml(selectedLocationName())} · ${escapeHtml(formatDateForLabel(currentWeekStart))} – ${escapeHtml(formatDateForLabel(weekEnd))} · ${escapeHtml(totalCells)} shift assignment${totalCells === 1 ? "" : "s"} across ${escapeHtml(scheduledEmployees)} scheduled employee${scheduledEmployees === 1 ? "" : "s"}; ${escapeHtml(rows.length)} employee row${rows.length === 1 ? "" : "s"} shown</span>
    </caption>
    <thead>
      <tr>
        <th scope="col" class="employeeMetaCol">Priority</th>
        <th scope="col" class="employeeMetaCol">ID#</th>
        <th scope="col" class="employeeNameCol">Employee</th>
        <th scope="col" class="employeeMetaCol">Title</th>
        ${DAYS.map((day, index) => {
          const current = addDays(currentWeekStart, index);
          return `<th scope="col" class="dayCol">${day.long}<span class="dateSub">${dateOnly(current)}</span></th>`;
        }).join("")}
      </tr>
    </thead>
    <tbody>
      ${
        rows.length === 0
          ? `<tr><td colspan="11" class="emptyScheduleCell">No forecasted schedule for this week. Add a location, shifts, and employees with available days.</td></tr>`
          : rows.map((row) => `
            <tr>
              <td class="employeeMetaCell">${escapeHtml(row.priority || "—")}</td>
              <td class="employeeMetaCell">${escapeHtml(row.employeeCode)}</td>
              <th scope="row" class="employeeNameCell">${escapeHtml(row.employee)}</th>
              <td class="employeeMetaCell">${escapeHtml(row.title)}</td>
              ${DAYS.map((day, index) => {
                const current = dateOnly(addDays(currentWeekStart, index));
                const cell = row.days[current];

                if (!cell) return `<td class="scheduleCell mutedCell"><span class="offLabel">Off</span></td>`;

                const reasonText = (cell.assignment_reason || []).join(" • ");
                return `
                  <td class="scheduleCell assignedCell">
                    <strong>${escapeHtml(cell.shift_name || "Shift")}</strong>
                    <span class="shiftTime">${escapeHtml((cell.start_time || "").slice(0, 5))}–${escapeHtml((cell.end_time || "").slice(0, 5))}</span>
                    <small class="assignmentReason" title="${escapeHtml(reasonText)}">Score ${escapeHtml(cell.fairness_score ?? "—")}</small>
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
    message: `Enter your password to delete shift ${shift.name}.`,
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
  $("employeeTitle").value = "";
  $("employeeFirstName").value = "";
  $("employeeLastName").value = "";
  if ($("employeeCode")) $("employeeCode").value = "";
  $("employeePassword").value = "";
  if ($("employeePassword")) $("employeePassword").type = "password";
  if ($("showEmployeePasswordButton")) $("showEmployeePasswordButton").textContent = "Show";
  $("employmentType").value = "full_time";
  $("weeklyHours").value = "40";
  $("dailyHours").value = "8";
  if ($("payRateDollars")) $("payRateDollars").value = "0";
  if ($("overtimeAllowed")) $("overtimeAllowed").checked = true;
  if ($("overtimeThresholdHours")) $("overtimeThresholdHours").value = "40";
  if ($("minRestHours")) $("minRestHours").value = "8";
  $("employeePriority").value = "1";
  $("orientationStart").value = dateOnly(new Date());
  $("canManageSchedule").checked = false;
  employeeDaysOff = new Set();
  setNotice("employeeFormMessage", "", "");
  resetFieldState("employeeCode", "Required");
  resetFieldState("employeePassword", "Required");
  renderAvailabilityEditor(defaultAvailability());
  renderDaysOffList();
  populatePreferredShiftSelect();
}

async function loadEmployees() {
  if (!selectedLocationId || !canManageSchedule()) return;

  const filter = $("employeeFilter").value.trim();

  const planCap = currentPlanRecord?.employee_limit === null || filter ? 5 : Math.max(1, Math.min(5, Number(currentPlanRecord?.employee_limit || 5)));
  const data = await api(
    `/employees?locationId=${encodeURIComponent(selectedLocationId)}&page=${employeePage}&pageSize=${planCap}&filter=${encodeURIComponent(filter)}`
  );

  employees = data.employees || [];
  employeePage = data.page || employeePage;
  employeeTotalPages = data.totalPages || 1;
  renderEmployees();
  updatePager("employee", employeePage, employeeTotalPages);
}

function renderEmployees() {
  const list = $("employeeList");

  const filterText = $("employeeFilter")?.value?.trim() || "";
  const capNote = currentPlanRecord?.employee_limit !== null && !filterText
    ? `<div class="formNotice success">${escapeHtml(currentPlanRecord?.name || "Current")} plan displays up to ${escapeHtml(currentPlanRecord?.employee_limit)} scheduled employee${Number(currentPlanRecord?.employee_limit) === 1 ? "" : "s"} by default. Use search to find any active employee.</div>`
    : "";

  if (!employees.length) {
    list.innerHTML = `${capNote}<div class="emptyState">No employees found for this location.</div>`;
    return;
  }

  list.innerHTML = capNote + employees.map((employee) => {
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
          <strong>Employee ID# ${escapeHtml(employee.employee_code || employee.account_number)} — ${escapeHtml(`${employee.first_name || ""} ${employee.last_name || ""}`.trim())}</strong>
          <span>${escapeHtml(employee.title)} · ${escapeHtml(employee.employment_type)} · ${escapeHtml(employee.weekly_hours)} hrs/week · Pay $${escapeHtml(((Number(employee.pay_rate_cents || 0) / 100).toFixed(2)))} · Available: ${escapeHtml(availableDays)}</span>
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
  resetFieldState("employeePassword", "Optional while editing");
  $("employeeId").value = employee.id;
  if ($("employeeGeneratedIdText")) $("employeeGeneratedIdText").textContent = `Employee Company ID# ${employee.employee_code || employee.account_number || ""}`;
  if ($("employeeCode")) $("employeeCode").value = employee.employee_code || employee.account_number || "";
  $("employeeTitle").value = employee.title || "";
  $("employeeFirstName").value = employee.first_name || "";
  $("employeeLastName").value = employee.last_name || "";
  $("employeePassword").value = "";
  $("employmentType").value = employee.employment_type || "full_time";
  $("weeklyHours").value = employee.weekly_hours || "40";
  $("dailyHours").value = employee.daily_hours || "8";
  if ($("payRateDollars")) $("payRateDollars").value = ((Number(employee.pay_rate_cents || 0) / 100).toFixed(2));
  if ($("overtimeAllowed")) $("overtimeAllowed").checked = employee.overtime_allowed !== false;
  if ($("overtimeThresholdHours")) $("overtimeThresholdHours").value = employee.overtime_threshold_hours || "40";
  if ($("minRestHours")) $("minRestHours").value = employee.min_rest_hours || "8";
  $("employeePriority").value = employee.priority || "1";
  $("orientationStart").value = employee.orientation_start ? String(employee.orientation_start).slice(0, 10) : "";
  $("canManageSchedule").checked = Boolean(employee.can_manage_schedule);
  employeeDaysOff = new Set(normalizeDaysOffArray(employee.days_off));
  renderAvailabilityEditor(employee.availability || defaultAvailability());
  renderDaysOffList();
  populatePreferredShiftSelect(employee.preferred_shift_id || "");
  $("employeeFirstName")?.focus?.();
}

async function saveEmployee(event) {
  event.preventDefault();
  setNotice("employeeFormMessage", "", "");
  resetFieldState("employeePassword", $("employeeId").value ? "Optional while editing" : "Required");

  if (!selectedLocationId) {
    setNotice("employeeFormMessage", "error", "Select a location first.");
    return;
  }

  const employeeId = $("employeeId").value;
  const body = {
    locationId: selectedLocationId,
    employeeCode: normalizeIdInput($("employeeCode")?.value || ""),
    title: $("employeeTitle").value.trim(),
    firstName: $("employeeFirstName").value.trim(),
    lastName: $("employeeLastName").value.trim(),
    password: normalizePasswordInput($("employeePassword").value),
    employmentType: $("employmentType").value,
    weeklyHours: Number($("weeklyHours").value),
    dailyHours: Number($("dailyHours").value),
    payRateCents: Math.max(0, Math.round(Number($("payRateDollars")?.value || 0) * 100)),
    overtimeAllowed: $("overtimeAllowed")?.checked !== false,
    overtimeThresholdHours: Number($("overtimeThresholdHours")?.value || 40),
    minRestHours: Number($("minRestHours")?.value || 8),
    priority: Number($("employeePriority").value),
    preferredShiftId: $("preferredShiftId").value || null,
    orientationStart: $("orientationStart").value || null,
    availability: collectAvailability(),
    daysOff: [...employeeDaysOff],
    canManageSchedule: $("canManageSchedule").checked
  };

  let isValid = true;

  if (!isValidIdInput(body.employeeCode)) {
    setFieldState("employeeCode", "invalid", "9 digits required");
    isValid = false;
  } else {
    setFieldState("employeeCode", "valid", "Looks good");
  }

  if (!body.orientationStart) {
    setFieldState("orientationStart", "invalid", "Required");
    isValid = false;
  } else {
    setFieldState("orientationStart", "valid", "Looks good");
  }

  if (!employeeId && !body.password) {
    setFieldState("employeePassword", "invalid", "Required");
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

function toggleEmployeePasswordVisibility() {
  const input = $("employeePassword");
  const button = $("showEmployeePasswordButton");
  if (!input) return;
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  if (button) button.textContent = showing ? "Show" : "Hide";
}

async function copyEmployeePassword() {
  const value = $("employeePassword")?.value || "";
  if (!value) {
    setNotice("employeeFormMessage", "error", "Enter a password before copying it.");
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    setNotice("employeeFormMessage", "success", "Password copied.");
  } catch {
    setNotice("employeeFormMessage", "error", "Copy failed. Select and copy the password manually.");
  }
}

async function deleteEmployee(employeeId) {
  const employee = employees.find((item) => item.id === employeeId);
  if (!employee) return;

  const deleted = await runOwnerCredentialAction({
    title: "Delete Employee",
    message: `Enter your password to delete employee ID# ${employee.employee_code || employee.account_number}.`,
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
    allPlans = data.plans || [];
    currentPlanCode = data.currentPlan || "free";
    currentPlanRecord = allPlans.find((plan) => plan.code === currentPlanCode) || null;
    $("currentPlanText").innerHTML = `Current Plan: <strong>${escapeHtml(currentPlanRecord?.name || "Free")}</strong>`;

    if (renderDialog) {
      renderPlans(allPlans, currentPlanCode);
    }
  } catch (err) {
    showMessage(err.message);
  }
}

function planFeatures(plan) {
  const employeeLimit = plan.employee_limit === null ? "Unlimited employees" : `${plan.employee_limit} scheduled employee${plan.employee_limit === 1 ? "" : "s"}`;
  const featureMap = {
    free: ["Local desktop scheduling", employeeLimit, "Owner workspace"],
    plus: ["Everything in Free", employeeLimit, "Manager approvals and portals"],
    premium: ["Everything in Plus", employeeLimit, "Labor forecasting and warnings"],
    pro: ["Everything in Premium", employeeLimit, "Full business scheduling scale"]
  };

  return featureMap[plan.code] || [employeeLimit, "Automatic scheduling", "Clean desktop dashboard"];
}

function planRank(plan) {
  return Number(plan?.monthly_price_cents || 0);
}

function planActionLabel(plan) {
  if (!currentPlanRecord || plan.code === currentPlanCode) return "Current Plan";
  if (planRank(plan) > planRank(currentPlanRecord)) return `Upgrade to ${plan.name}`;
  if (planRank(plan) < planRank(currentPlanRecord)) return `Downgrade to ${plan.name}`;
  return `Switch to ${plan.name}`;
}

function renderPlans(plans, currentPlan) {
  const list = $("planList");

  list.innerHTML = plans.map((plan) => {
    const price = plan.monthly_price_cents === 0
      ? "$0"
      : `$${(plan.monthly_price_cents / 100).toFixed(0)}`;

    const active = plan.code === currentPlan;
    const actionLabel = planActionLabel(plan);
    const meta = plan.employee_limit === null ? "No employee display cap." : `Shows ${plan.employee_limit} scheduled employee${plan.employee_limit === 1 ? "" : "s"} by default; search still reaches all employees.`;

    return `
      <article class="planCard ${active ? "active" : ""}">
        <div>
          <p class="eyebrow">${active ? "Current plan" : (planRank(plan) > planRank(currentPlanRecord) ? "Upgrade option" : "Downgrade option")}</p>
          <h3>${escapeHtml(plan.name)}</h3>
          <div class="planPrice">${price}<span>/month</span></div>
          <p class="planActionMeta">${escapeHtml(meta)}</p>
        </div>
        <ul>
          ${planFeatures(plan).map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
        </ul>
        <button class="button ${active ? "secondary" : "primary"}" data-action="select-plan" data-code="${escapeHtml(plan.code)}" ${active ? "disabled" : ""}>
          ${escapeHtml(actionLabel)}
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
  const selectedPlan = allPlans.find((plan) => plan.code === planCode);
  if (!selectedPlan || selectedPlan.code === currentPlanCode) return;
  const actionWord = planRank(selectedPlan) > planRank(currentPlanRecord) ? "upgrade" : planRank(selectedPlan) < planRank(currentPlanRecord) ? "downgrade" : "switch";
  const confirmed = await runOwnerCredentialAction({
    title: `${actionWord[0].toUpperCase()}${actionWord.slice(1)} Plan`,
    message: `Are you sure you want to ${actionWord} from ${currentPlanRecord?.name || currentPlanCode} to ${selectedPlan.name}? Enter the password to continue.`,
    confirmLabel: `${actionWord[0].toUpperCase()}${actionWord.slice(1)} Plan`,
    onConfirm: (actorPassword) => api("/plans/change", {
      method: "POST",
      body: JSON.stringify({ planCode, actorPassword })
    })
  });

  if (!confirmed) return;
  await loadPlans(true);
  await loadEmployees();
  showMessage(`Plan ${actionWord} saved. Employee search still includes all active employees.`, "success");
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
    expandRecurringMapItem(map, item, "blocked_date", item.reason || "Blocked by owner");
  }

  return map;
}

function activeHolidayDateMap() {
  const today = dateOnly(new Date());
  const map = new Map();

  for (const item of timeOffSettings.holidayDates || []) {
    expandRecurringMapItem(map, item, "holiday_date", item.name || "Holiday");
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
      shiftSwapsEnabled: data.settings?.shiftSwapsEnabled !== false,
      blockedDates: data.blockedDates || [],
      holidayDates: data.holidayDates || []
    };
    renderTimeOffSettings();
  } catch (err) {
    timeOffSettings = { requestsEnabled: true, shiftSwapsEnabled: true, blockedDates: [], holidayDates: [] };
    renderTimeOffSettings();
  }
}

function resetBlockedDateForm() {
  const blockedDateInput = $("blockedDateInput");
  const reasonInput = $("blockedDateReason");
  if (blockedDateInput) blockedDateInput.value = "";
  if (reasonInput) reasonInput.value = "";
  if ($("blockedDateYearly")) $("blockedDateYearly").checked = false;
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
  if ($("holidayDateYearly")) $("holidayDateYearly").checked = false;
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

function isRecurringDate(item) {
  return item?.recurs_yearly === true || item?.recursYearly === true;
}

function recurringDateLabel(item, dateKey) {
  return isRecurringDate(item) ? `${dateKey} · Yearly` : dateKey;
}

function annualDateForYear(value, year) {
  const parsed = parseDateOnly(formatRequestDate(value));
  if (!parsed) return null;
  return `${year}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function expandRecurringMapItem(map, item, dateField, label) {
  const rawDate = formatRequestDate(item?.[dateField]);
  if (!rawDate) return;

  if (!isRecurringDate(item)) {
    if (rawDate >= dateOnly(new Date())) map.set(rawDate, label);
    return;
  }

  const monthAnchors = [timeOffCalendarMonth, addMonths(timeOffCalendarMonth, 1), new Date()];
  const years = new Set(monthAnchors.map((date) => date.getFullYear()));
  for (const year of years) {
    const annualDate = annualDateForYear(rawDate, year);
    if (annualDate) map.set(annualDate, `${label} (yearly)`);
  }
}

function effectiveUpcomingDate(item, dateField) {
  const rawDate = formatRequestDate(item?.[dateField]);
  if (!rawDate) return "";
  if (!isRecurringDate(item)) return rawDate;

  const today = dateOnly(new Date());
  const thisYear = annualDateForYear(rawDate, new Date().getFullYear());
  if (thisYear && thisYear >= today) return thisYear;
  return annualDateForYear(rawDate, new Date().getFullYear() + 1) || rawDate;
}

function renderTimeOffSettings() {
  const enabledInput = $("timeOffRequestsEnabled");
  const shiftSwapsInput = $("shiftSwapsEnabled");
  const requestForm = $("timeOffRequestForm");
  const disabledNotice = $("timeOffDisabledNotice");
  const requestButton = $("showTimeOffRequestFormButton");
  const swapButton = $("showSwapRequestButton");
  const swapForm = $("swapRequestForm");
  const swapDisabledNotice = $("shiftSwapsDisabledNotice");
  const blockedList = $("blockedDateList");
  const holidayList = $("holidayDateList");

  if (enabledInput) enabledInput.checked = timeOffSettings.requestsEnabled !== false;
  if (shiftSwapsInput) shiftSwapsInput.checked = timeOffSettings.shiftSwapsEnabled !== false;

  if (requestButton) {
    requestButton.disabled = timeOffSettings.requestsEnabled === false;
  }

  if (requestForm && timeOffSettings.requestsEnabled === false && !canManageSchedule()) {
    requestForm.classList.add("hidden");
  }

  if (disabledNotice) {
    disabledNotice.classList.toggle("hidden", timeOffSettings.requestsEnabled !== false || canManageSchedule());
  }

  if (swapButton) {
    swapButton.disabled = timeOffSettings.shiftSwapsEnabled === false;
  }

  if (swapForm && timeOffSettings.shiftSwapsEnabled === false && !canManageSchedule()) {
    swapForm.classList.add("hidden");
  }

  if (swapDisabledNotice) {
    swapDisabledNotice.classList.toggle("hidden", timeOffSettings.shiftSwapsEnabled !== false || canManageSchedule());
  }

  if (holidayList) {
    const today = dateOnly(new Date());
    const holidayDates = (timeOffSettings.holidayDates || [])
      .filter((item) => isRecurringDate(item) || formatRequestDate(item.holiday_date) >= today)
      .sort((a, b) => effectiveUpcomingDate(a, "holiday_date").localeCompare(effectiveUpcomingDate(b, "holiday_date")));
    holidayList.innerHTML = holidayDates.length
      ? `<div class="chipListLabel">Holidays</div>` + holidayDates.map((item) => {
          const dateText = formatRequestDate(item.holiday_date);
          return `
          <span class="dateChip holidayChip">
            ${escapeHtml(recurringDateLabel(item, dateText))}
            <small>${escapeHtml(item.name || "Holiday")}</small>
            <button class="button textDanger miniButton" type="button" data-action="remove-holiday-date" data-id="${escapeHtml(item.id)}">Remove</button>
          </span>
        `;
        }).join("")
      : `<div class="emptyState compactEmpty">No holiday dates.</div>`;
  }

  if (blockedList) {
    const today = dateOnly(new Date());
    const blockedDates = (timeOffSettings.blockedDates || [])
      .filter((item) => isRecurringDate(item) || formatRequestDate(item.blocked_date) >= today)
      .sort((a, b) => effectiveUpcomingDate(a, "blocked_date").localeCompare(effectiveUpcomingDate(b, "blocked_date")));
    blockedList.innerHTML = blockedDates.length
      ? `<div class="chipListLabel">Blocked Dates</div>` + blockedDates.map((item) => {
          const dateText = formatRequestDate(item.blocked_date);
          return `
          <span class="dateChip">
            ${escapeHtml(recurringDateLabel(item, dateText))}
            <small>${escapeHtml(item.reason || "No reason")}</small>
            <button class="button textDanger miniButton" type="button" data-action="remove-blocked-date" data-id="${escapeHtml(item.id)}">Remove</button>
          </span>
        `;
        }).join("")
      : `<div class="emptyState compactEmpty">No blocked dates.</div>`;
  }

  renderTimeOffCalendar();
}

async function saveTimeOffSettings(event) {
  if (!isOwner()) return;

  const target = event?.target;
  const isShiftSwapToggle = target?.id === "shiftSwapsEnabled";
  const enabledInput = $("timeOffRequestsEnabled");
  const shiftSwapsInput = $("shiftSwapsEnabled");
  const previousRequestsValue = timeOffSettings.requestsEnabled !== false;
  const previousShiftSwapsValue = timeOffSettings.shiftSwapsEnabled !== false;
  const nextRequestsValue = isShiftSwapToggle ? previousRequestsValue : enabledInput?.checked !== false;
  const nextShiftSwapsValue = isShiftSwapToggle ? shiftSwapsInput?.checked !== false : previousShiftSwapsValue;

  if (enabledInput) enabledInput.checked = previousRequestsValue;
  if (shiftSwapsInput) shiftSwapsInput.checked = previousShiftSwapsValue;

  const title = isShiftSwapToggle
    ? (nextShiftSwapsValue ? "Turn On Shift Cover / Swap" : "Turn Off Shift Cover / Swap")
    : (nextRequestsValue ? "Turn On Time Off Requests" : "Turn Off Time Off Requests");
  const message = isShiftSwapToggle
    ? `Enter your password to ${nextShiftSwapsValue ? "turn on" : "turn off"} employee shift cover and swap requests.`
    : `Enter your password to ${nextRequestsValue ? "turn on" : "turn off"} employee time off requests.`;

  const updated = await runOwnerCredentialAction({
    title,
    message,
    confirmLabel: isShiftSwapToggle
      ? (nextShiftSwapsValue ? "Turn On" : "Turn Off")
      : (nextRequestsValue ? "Turn On" : "Turn Off"),
    onConfirm: (actorPassword) =>
      api("/time-off/settings/toggle", {
        method: "POST",
        skipRefresh: true,
        body: JSON.stringify({
          requestsEnabled: nextRequestsValue,
          shiftSwapsEnabled: nextShiftSwapsValue,
          actorPassword,
          locationId: selectedLocationId
        })
      })
  });

  if (!updated) {
    if (enabledInput) enabledInput.checked = previousRequestsValue;
    if (shiftSwapsInput) shiftSwapsInput.checked = previousShiftSwapsValue;
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
  const recursYearly = !!$("holidayDateYearly")?.checked;

  let isValid = true;
  if (!holidayDate) { setFieldState("holidayDateInput", "invalid", "Required"); isValid = false; }
  else setFieldState("holidayDateInput", "valid", "Looks good");

  if (!name) { setFieldState("holidayDateName", "invalid", "Required"); isValid = false; }
  else setFieldState("holidayDateName", "valid", "Looks good");

  if (!isValid) return;

  try {
    await api("/time-off/holidays", {
      method: "POST",
      body: JSON.stringify({ holidayDate, name, recursYearly, locationId: selectedLocationId })
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
  const recursYearly = !!$("blockedDateYearly")?.checked;

  let isValid = true;
  if (!blockedDate) { setFieldState("blockedDateInput", "invalid", "Required"); isValid = false; }
  else setFieldState("blockedDateInput", "valid", "Looks good");

  if (!reason) { setFieldState("blockedDateReason", "invalid", "Required"); isValid = false; }
  else setFieldState("blockedDateReason", "valid", "Looks good");

  if (!isValid) return;

  try {
    await api("/time-off/blocked-dates", {
      method: "POST",
      body: JSON.stringify({ blockedDate, reason, recursYearly, locationId: selectedLocationId })
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
  return `${request.first_name || ""} ${request.last_name || ""}`.trim() || request.account_number || "Employee";
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
    reason: $("timeOffReason").value.trim(),
    leaveType: $("timeOffLeaveType")?.value || "unpaid",
    requestedHours: $("timeOffRequestedHours")?.value || ""
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
  if (!selectedLocationId || !canManageSchedule()) return;

  try {
    const data = await api(`/audit?locationId=${encodeURIComponent(selectedLocationId)}&page=${auditPage}&pageSize=5`);
    auditLogs = data.logs || [];
    auditPage = data.page || auditPage;
    auditTotalPages = data.totalPages || 1;
    auditTotal = data.total || auditLogs.length;

    if (!auditLogs.length && auditPage > 1) {
      auditPage = Math.max(1, auditPage - 1);
      await loadAuditLog();
      return;
    }

    renderAuditLog();
    updatePager("audit", auditPage, auditTotalPages);
  } catch (err) {
    $("auditLogList").innerHTML = `<div class="emptyState">${escapeHtml(err.message)}</div>`;
  }
}

function auditDayListLabel(openDays = []) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = Array.isArray(openDays) ? openDays.map(Number).filter((day) => day >= 1 && day <= 7) : [];
  return days.length ? days.map((day) => labels[day - 1]).join(", ") : "No open days";
}

function formatAuditTime(value) {
  const text = String(value || "").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(text)) return "";
  const [hoursText, minutes] = text.split(":");
  const hours = Number(hoursText);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function formatAuditDetails(details, fallback = "Action recorded") {
  if (!details) return fallback;

  let parsed = details;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    if (!trimmed) return fallback;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
    }
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) return fallback;

  if (parsed.summary) return String(parsed.summary);
  if (parsed.message) return String(parsed.message);
  if (parsed.reason) return String(parsed.reason);

  const hasScheduleRuleFields = ["open_days", "operating_start", "operating_end", "default_required_staff", "labor_budget_cents", "time_zone"].some((key) => Object.prototype.hasOwnProperty.call(parsed, key));
  if (hasScheduleRuleFields) {
    const openDays = auditDayListLabel(parsed.open_days);
    const start = formatAuditTime(parsed.operating_start);
    const end = formatAuditTime(parsed.operating_end);
    const staff = Number(parsed.default_required_staff || 0);
    const min = Number(parsed.min_employees_per_day || 0);
    const max = parsed.max_employees_per_day === null || parsed.max_employees_per_day === undefined ? "No max" : `${parsed.max_employees_per_day} max`;
    const budget = Number(parsed.labor_budget_cents || 0) > 0 ? `$${(Number(parsed.labor_budget_cents) / 100).toFixed(2)} weekly budget` : "No weekly labor budget";
    return `Open ${openDays} · ${start}–${end} · ${staff} default staff · ${min} min/day · ${max} · ${budget}`;
  }

  const allowedKeys = ["status", "employeeName", "shiftName", "workDate", "startDate", "endDate", "planCode", "fromPlan", "toPlan"];
  const parts = allowedKeys
    .filter((key) => parsed[key] !== undefined && parsed[key] !== null && parsed[key] !== "")
    .map((key) => `${key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}: ${parsed[key]}`);

  return parts.length ? parts.join(" · ") : fallback;
}

function renderAuditLog() {
  const list = $("auditLogList");

  if (!auditLogs.length) {
    list.innerHTML = `<div class="emptyState">No audit log entries for this location yet.</div>`;
    return;
  }

  list.innerHTML = auditLogs.map((entry) => {
    const actor = `${entry.first_name || ""} ${entry.last_name || ""}`.trim() || entry.account_number || entry.username || entry.full_login || "Unknown user";
    const date = new Date(entry.created_at).toLocaleString();
    return `
      <article class="listItem auditItem">
        <div>
          <strong>${escapeHtml(entry.action)}</strong>
          <span>${escapeHtml(formatAuditDetails(entry.details, entry.entity_type || "Action recorded"))}</span>
          <span>${escapeHtml(actor)} · ${escapeHtml(date)}</span>
        </div>
      </article>
    `;
  }).join("");
}


function ensureSchedulePrintHeader() {
  const schedulePanel = $("schedulePanel");
  if (!schedulePanel) return null;

  let header = $("schedulePrintHeader");
  if (!header) {
    header = document.createElement("section");
    header.id = "schedulePrintHeader";
    header.className = "schedulePrintHeader";
    schedulePanel.insertAdjacentElement("afterbegin", header);
  }

  const weekEnd = addDays(currentWeekStart, 6);
  const health = lastSchedulePayload.health || {};
  const cells = lastSchedulePayload.cells || [];
  const warnings = lastSchedulePayload.warnings || [];

  header.innerHTML = `
    <div>
      <p class="eyebrow">Shift Ahoy Schedule Forecast</p>
      <h1>${escapeHtml(selectedLocationName())}</h1>
      <p>${escapeHtml(formatDateForLabel(currentWeekStart))} – ${escapeHtml(formatDateForLabel(weekEnd))}</p>
    </div>
    <dl>
      <div><dt>Assignments</dt><dd>${escapeHtml(cells.length)}</dd></div>
      <div><dt>Health</dt><dd>${escapeHtml(health.score ?? "—")}${health.score === undefined || health.score === null ? "" : "%"}</dd></div>
      <div><dt>Needed</dt><dd>${escapeHtml(health.coverageNeeded ?? 0)}</dd></div>
      <div><dt>Warnings</dt><dd>${escapeHtml(warnings.length)}</dd></div>
    </dl>
  `;

  return header;
}

function printSchedule() {
  if (!lastSchedulePayload.cells?.length) {
    showMessage("Load a schedule before previewing or printing.");
    return;
  }
  lastPrintedScheduleTitle = `${selectedLocationName()} · Week of ${formatDateForLabel(currentWeekStart)}`;
  ensureSchedulePrintHeader();
  document.body.classList.add("printingSchedule");
  document.title = `Shift Ahoy Schedule - ${lastPrintedScheduleTitle}`;
  window.print();
  window.setTimeout(() => {
    document.title = "Shift Ahoy";
    document.body.classList.remove("printingSchedule");
  }, 250);
}

async function logout() {
  try {
    await api("/auth/logout", { method: "POST", skipRefresh: true }).catch(() => null);
  } finally {
    accessToken = null;
    currentUser = null;
    selectedLocationId = null;
    selectedLocationRecord = null;
    locations = [];
    shifts = [];
    employees = [];
    timeOffRequests = [];
    auditLogs = [];
    timeOffSettings = { requestsEnabled: true, shiftSwapsEnabled: true, blockedDates: [], holidayDates: [] };
    $("settingsDialog")?.close?.();
    $("appView")?.classList.add("hidden");
    $("authView")?.classList.remove("hidden");
    $("settingsButton")?.classList.add("hidden");
    $("upgradeButton")?.classList.add("hidden");
    $("currentPlanText")?.classList.add("hidden");
    document.body.classList.remove("employeePortalOnly");
    clearAuthFieldStates();
    setNotice("loginFormMessage", "", "");
    setNotice("signupFormMessage", "", "");
    $("loginPassword") && ($("loginPassword").value = "");
    $("loginValue")?.focus?.();
  }
}

function setupEvents() {
  $("signupButton").addEventListener("click", signup);
  $("loginButton").addEventListener("click", login);
  $("businessGateButton")?.addEventListener("click", activateBusinessGate);
  $("businessAccountNumber")?.addEventListener("input", () => { const input = $("businessAccountNumber"); if (input) input.value = normalizeIdInput(input.value); });
  $("clockUnlockButton")?.addEventListener("click", unlockClockPortal);
  $("clockLookupButton")?.addEventListener("click", () => submitClockAction("clock_in"));
  $("clockInButton")?.addEventListener("click", () => submitClockAction("clock_in"));
  $("clockOutButton")?.addEventListener("click", () => submitClockAction("clock_out"));
  $("clockAccountNumber")?.addEventListener("input", handleClockIdInput);
  $("clockAccountNumber")?.addEventListener("keydown", handleClockIdKeydown);
  $("employeeCode")?.addEventListener("input", () => { const input = $("employeeCode"); if (input) input.value = normalizeIdInput(input.value); });
  $("showEmployeePasswordButton")?.addEventListener("click", toggleEmployeePasswordVisibility);
  $("copyEmployeePasswordButton")?.addEventListener("click", copyEmployeePassword);
  renderBusinessGate();
  $("forgotPasswordButton")?.addEventListener("click", () => openRecoveryDialog("password"));
  $("forgotIdButton")?.addEventListener("click", () => openRecoveryDialog("id"));
  $("settingsForgotPasswordButton")?.addEventListener("click", () => openRecoveryDialog("password"));
  $("settingsForgotIdButton")?.addEventListener("click", () => openRecoveryDialog("id"));
  $("recoveryForm")?.addEventListener("submit", submitRecovery);
  $("recoveryEmail")?.addEventListener("input", () => validateRecoveryEmail(false));
  $("recoveryEmail")?.addEventListener("blur", () => validateRecoveryEmail(true));
  $("cancelRecoveryButton")?.addEventListener("click", () => $("recoveryDialog")?.close());
  $("cancelRecoveryX")?.addEventListener("click", () => $("recoveryDialog")?.close());
  $("appearanceMode")?.addEventListener("change", () => applyAppearanceMode($("appearanceMode").value));
  $("ownerTwoFactorEnabled")?.addEventListener("change", saveOwnerSecuritySettings);

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

    if (action === "duplicate-location") {
      event.stopPropagation();
      await duplicateLocation(id);
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
  $("shiftSwapsEnabled")?.addEventListener("change", saveTimeOffSettings);
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

  $("prevAuditPage")?.addEventListener("click", async () => {
    auditPage = Math.max(1, auditPage - 1);
    await loadAuditLog();
  });

  $("nextAuditPage")?.addEventListener("click", async () => {
    auditPage += 1;
    await loadAuditLog();
  });

  $("upgradeButton").addEventListener("click", openPlanDialog);
  $("settingsButton").addEventListener("click", async () => {
    renderProfileSettings();
    applyAccountVisibility();
    if (isOwner()) await loadOwnerSecuritySettings();
    $("settingsDialog").showModal();
  });
  $("closeSettingsDialog").addEventListener("click", () => $("settingsDialog").close());
  $("settingsLogoutButton")?.addEventListener("click", logout);
  $("closePlanDialog").addEventListener("click", () => $("planDialog").close());
  $("planList").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action='select-plan']");
    if (!button || button.disabled) return;
    await changePlan(button.dataset.code);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  setupEnterToSubmit();
  setLanguage(detectDeviceLanguage());
  renderLanguageSelector("authLanguageDock");
  renderLanguageSelector("settingsLanguageSelector");
  renderProfileSettings();
  applyAppearanceMode();
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => applyAppearanceMode());
  setupSectionNavigationHighlighting();
  resetLocationForm();
  $("locationForm").classList.add("hidden");
  renderShiftDayEditor(defaultShiftDays());
  renderAvailabilityEditor(defaultAvailability());
  renderDaysOffList();
  resetShiftForm();
  $("shiftForm").classList.add("hidden");
  resetEmployeeForm();
  resetFieldState("loginValue", "Required");
  resetFieldState("loginPassword", "Required");
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

// Ultimate automation layer: publish states, employee view, open shifts, shift swaps, labor forecasting, location rules, and manager queue.
function moneyFromCents(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}


function syncAutomationRoleVisibility() {
  const owner = isOwner();
  const canManage = canManageSchedule();
  const employeeOnly = currentUser?.role === "employee";

  document.body.classList.toggle("employeePortalOnly", employeeOnly);
  applyAccountVisibility();

  document.querySelectorAll(".ownerOnly").forEach((el) => {
    if (el.classList.contains("editorForm")) {
      if (!owner) el.classList.add("hidden");
      return;
    }
    el.classList.toggle("hidden", !owner);
  });

  document.querySelectorAll(".nonOwnerOnly").forEach((el) => {
    el.classList.toggle("hidden", owner);
  });

  document.querySelectorAll(".managerOnly").forEach((el) => {
    el.classList.toggle("hidden", !canManage || employeeOnly);
  });

  document.querySelectorAll(".employeeOnlyHidden").forEach((el) => {
    el.classList.toggle("hidden", employeeOnly);
  });

  if (employeeOnly) {
    ["locationsPanel", "schedulePanel", "shiftsPanel", "employeesPanel", "auditPanel", "managerPortalPanel"].forEach((id) => $(id)?.classList.add("hidden"));
    $("portalsPanel")?.classList.remove("hidden");
  }
}

function ensureUltimateAutomationLayout() {
  const locationsPanel = $("locationsPanel");
  const schedulePanel = $("schedulePanel");
  const shiftsPanel = $("shiftsPanel");
  const workspace = document.querySelector(".dashboardPanels") || document.querySelector(".workspace");

  if (!workspace || !locationsPanel || !schedulePanel) return;

  const portalIntroHtml = `
    <section id="portalsPanel" class="card panelCard portalHubCard">
      <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
        <div class="dashboardTitleGroup">
          <span class="iconBadge">02</span>
          <div>
            <h2>Portals</h2>
            <p class="panelHint">Employee self-service first, followed by manager controls for the selected location.</p>
            <p class="selectedLocationHint">Selected location: <strong id="employeePortalLocationName">${escapeHtml(selectedLocationName())}</strong></p>
          </div>
        </div>
      </div>

      <section id="employeePortalPanel" class="portalSection">
        <div class="portalSectionHeader">
          <span class="portalBadge">EP</span>
          <div>
            <h3>Employee Portal</h3>
            <p>My Schedule, time-off requests, open shifts, and cover/swap requests.</p>
          </div>
        </div>
        <div id="employeePortalContent" class="portalContent"></div>
      </section>

      <section id="managerPortalPanel" class="portalSection managerOnly hidden">
        <div class="portalSectionHeader">
          <span class="portalBadge">MP</span>
          <div>
            <h3>Manager Portal</h3>
            <p>Approval queue plus shortcuts for forecast review and schedule overrides at <strong id="managerPortalLocationName">${escapeHtml(selectedLocationName())}</strong>.</p>
          </div>
        </div>
        <div id="managerPortalContent" class="portalContent"></div>
      </section>
    </section>
  `;

  if (!$("portalsPanel")) {
    locationsPanel.insertAdjacentHTML("afterend", portalIntroHtml);
  }

  const locationRulesHtml = `
    <section id="locationRulesPanel" class="automationCard managerOnly hidden locationRulesInline locationRulesPanelBlock">
      <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction locationRulesHeader locationPanelSubheader">
        <div class="dashboardTitleGroup">
          <span class="iconBadge">01B</span>
          <div>
            <h2>Location Rules</h2>
            <p class="panelHint">Operating days, labor budget, default staffing, publish day, and local scheduling controls for <strong id="locationRulesLocationName">${escapeHtml(selectedLocationName())}</strong>.</p>
          </div>
        </div>
        <div class="inlineToolbar rulesHeaderToolbar"><button id="createLocationRulesButton" class="button secondary" type="button">Update Rules</button></div>
      </div>
      <form id="locationRulesForm" class="editorForm automationForm hidden locationRulesForm">
        <div class="formGrid twoColumn locationRulesGrid">
          <div class="fieldGroup"><label class="fieldLabel" for="ruleOperatingStart">Operating Start</label><input id="ruleOperatingStart" type="time" /></div>
          <div class="fieldGroup"><label class="fieldLabel" for="ruleOperatingEnd">Operating End</label><input id="ruleOperatingEnd" type="time" /></div>
          <div class="fieldGroup"><label class="fieldLabel" for="ruleMinEmployees">Min Employees / Day</label><input id="ruleMinEmployees" type="number" min="0" /></div>
          <div class="fieldGroup"><label class="fieldLabel" for="ruleMaxEmployees">Max Employees / Day</label><input id="ruleMaxEmployees" type="number" min="1" placeholder="No cap" /></div>
          <div class="fieldGroup"><label class="fieldLabel" for="ruleDefaultRequired">Default Employees Needed</label><input id="ruleDefaultRequired" type="number" min="0" max="99" /></div>
          <div class="fieldGroup"><label class="fieldLabel" for="ruleLaborBudget">Weekly Labor Budget</label><input id="ruleLaborBudget" type="number" min="0" step="0.01" /></div>
          <div class="fieldGroup"><label class="fieldLabel" for="rulePublishDay">Publish Day</label><select id="rulePublishDay"><option value="" selected disabled>Select publish day</option>${DAYS.map((day) => `<option value="${day.value}">${day.long}</option>`).join("")}</select></div>
          <div class="fieldGroup"><label class="fieldLabel" for="ruleTimeZone">Time Zone</label><input id="ruleTimeZone" /></div>
        </div>
        <div class="fieldGroup locationRulesOpenDaysField"><span class="fieldLabel">Open Days</span><div id="ruleOpenDays" class="dotDayRow"></div></div>
      </form>
      <div id="locationRulesNotice" class="formNotice hidden"></div>
    </section>
  `;

  if (!$("locationRulesPanel")) {
    const locationPager = $("locationPager");
    if (locationPager) {
      locationPager.insertAdjacentHTML("afterend", locationRulesHtml);
    } else {
      locationsPanel.insertAdjacentHTML("beforeend", locationRulesHtml);
    }
  }

  if ($("publishScheduleBar")) {
    const eyebrow = $("publishScheduleBar")?.querySelector(".eyebrow");
    const heading = $("publishedScheduleStatus");
    const hint = $("publishScheduleBar")?.querySelector(".panelHint");

    if (eyebrow) eyebrow.textContent = "Forecast & Override";
    if (heading && heading.textContent === "Forecast is live") heading.textContent = "Forecast has not been saved yet";
    if (hint) hint.textContent = "Review the live forecast, save a draft, publish, or revise after overriding schedule cells.";
  }

  if (!$("publishScheduleBar")) {
    schedulePanel.insertAdjacentHTML("beforeend", `
      <section id="publishScheduleBar" class="automationCard managerOnly hidden">
        <div>
          <p class="eyebrow">Forecast & Override</p>
          <h3 id="publishedScheduleStatus">Forecast has not been saved yet</h3>
          <p class="panelHint">Review the live forecast, save a draft, publish, or revise after overriding schedule cells.</p>
        </div>
        <div class="inlineToolbar wrapToolbar">
          <input id="schedulePublishNotes" class="searchInput" placeholder="Optional publish note" />
          <button id="saveDraftScheduleButton" class="button secondary" type="button">Save Draft</button>
          <button id="publishScheduleButton" class="button primary" type="button">Publish</button>
          <button id="reviseScheduleButton" class="button ghost" type="button">Revise</button>
        </div>
      </section>
    `);
  }

  const employeePortalContent = $("employeePortalContent");
  const managerPortalContent = $("managerPortalContent");

  if (employeePortalContent && !$("employeePortalIdentity")) {
    employeePortalContent.insertAdjacentHTML("afterbegin", `
      <section id="employeePortalIdentity" class="portalSubcard profilePortalCard">
        <div data-profile-avatar class="profilePortalAvatarSlot">${profileAvatarHtml("embeddedAvatar")}</div>
        <div>
          <h3>${escapeHtml(userDisplayName())}</h3>
          <p class="panelHint">${escapeHtml(userAccountNumber() ? `ID# ${userAccountNumber()}` : currentUser?.email || "Employee")}</p>
        </div>
      </section>
    `);
  } else if ($("employeePortalIdentity")) {
    const title = $("employeePortalIdentity")?.querySelector("h3");
    const meta = $("employeePortalIdentity")?.querySelector(".panelHint");
    if (title) title.textContent = userDisplayName();
    if (meta) meta.textContent = userAccountNumber() ? `ID# ${userAccountNumber()}` : currentUser?.email || "Employee";
  }
  updateProfileAvatars();

  if (employeePortalContent && !$("employeeSchedulePanel")) {
    employeePortalContent.insertAdjacentHTML("beforeend", `
      <section id="employeeSchedulePanel" class="portalSubcard">
        <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
          <div class="dashboardTitleGroup"><span class="iconBadge">EP-01</span><div><h2>My Schedule</h2><p class="panelHint">Published shifts, upcoming request status, and available open shifts.</p></div></div>
        </div>
        <div id="employeeScheduleList" class="listStack"></div>
      </section>
    `);
  } else if (employeePortalContent && $("employeeSchedulePanel") && $("employeeSchedulePanel").parentElement !== employeePortalContent) {
    employeePortalContent.appendChild($("employeeSchedulePanel"));
  }

  const timeOffPanel = $("timeOffPanel");
  if (employeePortalContent && timeOffPanel && timeOffPanel.parentElement !== employeePortalContent) {
    employeePortalContent.appendChild(timeOffPanel);
  }

  if (timeOffPanel) {
    timeOffPanel.classList.add("portalSubcard");
    timeOffPanel.classList.remove("card");
    const badge = timeOffPanel.querySelector(".iconBadge");
    const title = timeOffPanel.querySelector("h2");
    const hint = timeOffPanel.querySelector(".panelHint");
    if (badge) badge.textContent = "EP-02";
    if (title) title.textContent = "Request Time Off";
    if (hint) hint.textContent = "Submit date-range requests, review request status, and view blocked or holiday dates for your location.";
  }

  if (employeePortalContent && !$("openShiftsPanel")) {
    employeePortalContent.insertAdjacentHTML("beforeend", `
      <section id="openShiftsPanel" class="portalSubcard">
        <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
          <div class="dashboardTitleGroup"><span class="iconBadge">EP-03</span><div><h2>Open Shifts</h2><p class="panelHint">Coverage gaps from published schedules become claimable open shifts.</p></div></div>
          <button id="refreshOpenShiftsButton" class="button secondary" type="button">Refresh</button>
        </div>
        <div id="openShiftsList" class="listStack"></div>
      </section>
    `);
  } else if (employeePortalContent && $("openShiftsPanel") && $("openShiftsPanel").parentElement !== employeePortalContent) {
    employeePortalContent.appendChild($("openShiftsPanel"));
  }

  if (employeePortalContent && !$("shiftSwapsPanel")) {
    employeePortalContent.insertAdjacentHTML("beforeend", `
      <section id="shiftSwapsPanel" class="portalSubcard">
        <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
          <div class="dashboardTitleGroup"><span class="iconBadge">EP-04</span><div><h2>Shift Cover / Swap</h2><p class="panelHint">Offer a shift for cover, accept a coworker request, and let a manager approve the change.</p></div></div>
          <button id="showSwapRequestButton" class="button secondary" type="button">Request Cover</button>
        </div>
        <form id="swapRequestForm" class="editorForm hidden">
          <div class="formGrid twoColumn">
            <div class="fieldGroup"><label class="fieldLabel" for="swapWorkDate">Work Date</label><input id="swapWorkDate" type="date" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="swapRequestType">Request Type</label><select id="swapRequestType"><option value="cover">Cover</option><option value="swap">Swap</option></select></div>
          </div>
          <div class="fieldGroup"><label class="fieldLabel" for="swapReason">Reason</label><input id="swapReason" placeholder="Optional reason" /></div>
          <div class="formActions"><button class="button primary" type="submit">Submit Request</button><button id="cancelSwapRequestButton" class="button ghost" type="button">Cancel</button></div>
        </form>
        <div id="shiftSwapList" class="listStack"></div>
      </section>
    `);
  } else if (employeePortalContent && $("shiftSwapsPanel") && $("shiftSwapsPanel").parentElement !== employeePortalContent) {
    employeePortalContent.appendChild($("shiftSwapsPanel"));
  }

  if (employeePortalContent && !$("employeePayrollPanel")) {
    employeePortalContent.insertAdjacentHTML("beforeend", `
      <section id="employeePayrollPanel" class="portalSubcard">
        <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
          <div class="dashboardTitleGroup"><span class="iconBadge">EP-05</span><div><h2>Payroll</h2><p class="panelHint">Your current pay-period hours, estimated pay, and clock history.</p></div></div>
          <button id="refreshEmployeePayrollButton" class="button secondary" type="button">Refresh</button>
        </div>
        <div id="employeePayrollList" class="listStack"></div>
      </section>
    `);
    $("refreshEmployeePayrollButton")?.addEventListener("click", loadEmployeePayrollSummary);
  } else if (employeePortalContent && $("employeePayrollPanel") && $("employeePayrollPanel").parentElement !== employeePortalContent) {
    employeePortalContent.appendChild($("employeePayrollPanel"));
  }

  if (managerPortalContent && !$("managerForecastPanel")) {
    managerPortalContent.insertAdjacentHTML("beforeend", `
      <section id="managerForecastPanel" class="portalSubcard managerOnly hidden">
        <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
          <div class="dashboardTitleGroup"><span class="iconBadge">MP-01</span><div><h2>Forecast & Override</h2><p class="panelHint">Jump to the schedule forecast, manually override cells as needed, then save draft, publish, or revise.</p></div></div>
          <button id="managerForecastShortcutButton" class="button primary" type="button">Open Schedule</button>
        </div>
      </section>
    `);
  }

  if (managerPortalContent && !$("approvalQueuePanel")) {
    managerPortalContent.insertAdjacentHTML("beforeend", `
      <section id="approvalQueuePanel" class="portalSubcard managerOnly hidden">
        <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
          <div class="dashboardTitleGroup"><span class="iconBadge">MP-02</span><div><h2>Manager Approval Queue</h2><p class="panelHint">One place for time off, shift cover/swap requests, and open coverage gaps.</p></div></div>
          <button id="refreshApprovalQueueButton" class="button secondary" type="button">Refresh</button>
        </div>
        <div id="approvalQueueList" class="listStack"></div>
      </section>
    `);
  } else if (managerPortalContent && $("approvalQueuePanel") && $("approvalQueuePanel").parentElement !== managerPortalContent) {
    managerPortalContent.appendChild($("approvalQueuePanel"));
  }

  if (managerPortalContent && !$("laborPanel")) {
    managerPortalContent.insertAdjacentHTML("beforeend", `
      <section id="laborPanel" class="portalSubcard managerOnly hidden">
        <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
          <div class="dashboardTitleGroup"><span class="iconBadge">MP-03</span><div><h2>Labor Forecast</h2><p class="panelHint">Estimated costs, overtime warnings, and budget control for the selected week.</p></div></div>
          <button id="refreshLaborButton" class="button secondary" type="button">Refresh</button>
        </div>
        <div id="laborForecastList" class="listStack"></div>
      </section>
    `);
  } else if (managerPortalContent && $("laborPanel") && $("laborPanel").parentElement !== managerPortalContent) {
    managerPortalContent.appendChild($("laborPanel"));
  }

  if (managerPortalContent && !$("managerPayrollPanel")) {
    managerPortalContent.insertAdjacentHTML("beforeend", `
      <section id="managerPayrollPanel" class="portalSubcard managerOnly hidden">
        <div class="cardTitle dashboardCardTitle dashboardCardTitleWithAction">
          <div class="dashboardTitleGroup"><span class="iconBadge">MP-05</span><div><h2>Payroll</h2><p class="panelHint">Owner-managed pay cycle settings, current period totals, and early/late clock alerts.</p></div></div>
          <button id="refreshManagerPayrollButton" class="button secondary" type="button">Refresh</button>
        </div>
        <div id="payrollSettingsNotice" class="formNotice hidden" role="status" aria-live="polite"></div>
        <form id="payrollSettingsForm" class="editorForm ownerOnly hidden">
          <div class="formGrid twoColumn">
            <div class="fieldGroup"><label class="fieldLabel" for="payrollStartDate">First Pay Cycle Start Date</label><input id="payrollStartDate" type="date" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="payPeriodWeeks">Pay Every X Weeks</label><input id="payPeriodWeeks" type="number" min="1" max="12" value="2" /></div>
            <label class="checkRow"><input id="inAppClockEnabled" type="checkbox" checked /> In-app desktop clock enabled</label>
            <label class="checkRow"><input id="requireClockSession" type="checkbox" checked /> Require manager/owner unlock for clock portal</label>
            <label class="checkRow"><input id="enforceScheduledClockIn" type="checkbox" checked /> Enforce scheduled clock-in window</label>
            <div class="fieldGroup"><label class="fieldLabel" for="clockInEarlyGraceMinutes">Clock-in Early Grace Minutes</label><input id="clockInEarlyGraceMinutes" type="number" min="0" max="240" value="0" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="clockInLateGraceMinutes">Clock-in Late Grace Minutes</label><input id="clockInLateGraceMinutes" type="number" min="0" max="240" value="5" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="clockOutGraceMinutes">Clock-out Grace Minutes</label><input id="clockOutGraceMinutes" type="number" min="0" max="240" value="15" /></div>
          </div>
          <div class="automationDivider">PTO, Sick Leave, Bonuses & Pay Bumps</div>
          <div class="formGrid twoColumn">
            <label class="checkRow"><input id="ptoEnabled" type="checkbox" /> PTO enabled</label>
            <label class="checkRow"><input id="sickLeaveEnabled" type="checkbox" /> Sick leave enabled</label>
            <label class="checkRow"><input id="bonusEnabled" type="checkbox" /> Cash bonus rules enabled</label>
            <label class="checkRow"><input id="payBumpEnabled" type="checkbox" /> Automatic pay bump enabled</label>
            <label class="checkRow"><input id="allowNegativeLeaveBalance" type="checkbox" /> Allow negative leave balances</label>
            <label class="checkRow"><input id="autoAccrueOnClockOut" type="checkbox" checked /> Auto-accrue on clock out</label>
            <label class="checkRow"><input id="autoAwardBonusesOnClockOut" type="checkbox" checked /> Auto-award bonuses on clock out</label>
            <div class="fieldGroup"><label class="fieldLabel" for="leaveYearResetMonth">Leave Year Reset Month</label><input id="leaveYearResetMonth" type="number" min="1" max="12" value="1" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="leaveYearResetDay">Leave Year Reset Day</label><input id="leaveYearResetDay" type="number" min="1" max="31" value="1" /></div>
          </div>
          <div class="formGrid twoColumn leaveRuleGrid">
            <div class="fieldGroup"><label class="fieldLabel" for="ptoAccrualRate">PTO Hours Earned Per Worked Hour</label><input id="ptoAccrualRate" type="number" min="0" step="0.0001" value="0" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="ptoMaxBalanceHours">PTO Max Balance Hours</label><input id="ptoMaxBalanceHours" type="number" min="0" step="0.25" placeholder="No cap" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="sickAccrualRate">Sick Hours Earned Per Worked Hour</label><input id="sickAccrualRate" type="number" min="0" step="0.0001" value="0" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="sickMaxBalanceHours">Sick Max Balance Hours</label><input id="sickMaxBalanceHours" type="number" min="0" step="0.25" placeholder="No cap" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="bonusRuleName">Reward Rule Name</label><input id="bonusRuleName" placeholder="Example: 500 hour pay bump" /><small class="fieldHelp">Used in payroll award history and audit-friendly manager views.</small></div>
            <div class="fieldGroup"><label class="fieldLabel" for="bonusHoursThreshold">Hours Required Before Reward</label><input id="bonusHoursThreshold" type="number" min="0" step="0.25" /><small class="fieldHelp">Uses total worked hours unless reset by creating a new rule.</small></div>
            <div class="fieldGroup"><label class="fieldLabel" for="bonusAmountDollars">Optional Cash Bonus</label><input id="bonusAmountDollars" type="number" min="0" step="0.01" /><small class="fieldHelp">Set to 0 when only using pay bumps.</small></div>
            <div class="fieldGroup"><label class="fieldLabel" for="payBumpDollars">Pay Bump Amount / Hour</label><input id="payBumpDollars" type="number" min="0" step="0.01" /><small class="fieldHelp">Added to the employee hourly pay rate when the threshold is reached.</small></div>
            <label class="checkRow"><input id="bonusRecurring" type="checkbox" /> Repeat reward every threshold cycle</label>
            <div class="fieldGroup"><label class="fieldLabel" for="bonusMaxCycles">Maximum Pay Bump / Reward Cycles</label><input id="bonusMaxCycles" type="number" min="1" placeholder="No cap" /><small class="fieldHelp">Caps raises so employees stop receiving bumps after this many cycles.</small></div>
          </div>
          <div class="formActions"><button class="button primary" type="submit">Save Payroll / Leave Settings</button><button id="runLeaveAccrualButton" class="button secondary" type="button">Run Accrual Now</button><button id="evaluateBonusRulesButton" class="button ghost" type="button">Evaluate Bonuses</button></div>
        </form>
        <section class="payrollSuiteBox ownerOnly">
          <div class="automationDivider">Legal Payroll Processor / Provider Handoff</div>
          <div class="formGrid twoColumn">
            <div class="fieldGroup"><label class="fieldLabel" for="payrollProvider">Payroll Provider</label><select id="payrollProvider"><option value="csv">Universal CSV export</option><option value="adp">ADP Workforce Now</option><option value="gusto">Gusto Embedded/App Integration</option><option value="quickbooks">QuickBooks Payroll/Time</option><option value="custom">Custom provider</option></select><small class="fieldHelp">Use CSV for businesses with an existing payroll system; connect providers when API approval is available.</small></div>
            <div class="fieldGroup"><label class="fieldLabel" for="providerExternalCompanyId">Provider Company ID</label><input id="providerExternalCompanyId" placeholder="Optional provider/company code" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="taxHandlingMode">Tax & Deduction Handling</label><select id="taxHandlingMode"><option value="provider">Provider calculates taxes/deductions</option><option value="external">External payroll system calculates</option><option value="manual_reference_only">Manual reference only</option></select></div>
            <div class="fieldGroup"><label class="fieldLabel" for="overtimePolicy">Overtime Policy</label><select id="overtimePolicy"><option value="flsa_40">FLSA weekly 40+</option><option value="state_daily_weekly">State daily + weekly</option><option value="company_weekly">Company weekly threshold</option><option value="custom">Custom / provider-managed</option></select></div>
            <div class="fieldGroup"><label class="fieldLabel" for="weeklyOvertimeHours">Weekly OT After Hours</label><input id="weeklyOvertimeHours" type="number" min="1" max="168" step="0.25" value="40" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="dailyOvertimeHours">Daily OT After Hours</label><input id="dailyOvertimeHours" type="number" min="1" max="24" step="0.25" placeholder="State/company rule" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="defaultUnpaidBreakMinutes">Default Unpaid Break Minutes</label><input id="defaultUnpaidBreakMinutes" type="number" min="0" max="240" value="0" /></div>
            <label class="checkRow"><input id="requirePayrollApprovalLock" type="checkbox" checked /> Require payroll approval lock before export</label>
          </div>
          <div class="fieldGroup"><label class="fieldLabel" for="providerNotes">Provider Notes</label><input id="providerNotes" placeholder="CSV column mapping, ADP/Gusto/QuickBooks notes, tax/deduction notes" /></div>
          <div class="formActions"><button id="saveProviderSettingsButton" class="button primary" type="button">Save Provider Settings</button><button id="approvePayrollButton" class="button secondary" type="button">Approve & Lock Payroll</button><button id="finalizePayrollButton" class="button secondary" type="button">Finalize Report</button><button id="exportPayrollCsvButton" class="button ghost" type="button">Export CSV</button></div>
          <div class="automationDivider">Manual Payroll Entries</div>
          <div class="formGrid twoColumn">
            <div class="fieldGroup"><label class="fieldLabel" for="manualPayrollEmployeeId">Employee UUID</label><input id="manualPayrollEmployeeId" placeholder="Paste employee ID from payroll row" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="manualAdjustmentAmount">Adjustment Amount</label><input id="manualAdjustmentAmount" type="number" step="0.01" placeholder="Example: 25.00 or -10.00" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="manualAdjustmentType">Adjustment Type</label><select id="manualAdjustmentType"><option value="bonus">Bonus</option><option value="reimbursement">Reimbursement</option><option value="deduction">Deduction</option><option value="retro_pay">Retro Pay</option><option value="correction">Correction</option><option value="other">Other</option></select></div>
            <div class="fieldGroup"><label class="fieldLabel" for="manualAdjustmentReason">Adjustment Reason</label><input id="manualAdjustmentReason" placeholder="Required audit reason" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="manualPunchEntryId">Clock Entry UUID</label><input id="manualPunchEntryId" placeholder="Optional existing clock entry ID" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="manualPunchInAt">Correct Clock In</label><input id="manualPunchInAt" type="datetime-local" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="manualPunchOutAt">Correct Clock Out</label><input id="manualPunchOutAt" type="datetime-local" /></div>
            <div class="fieldGroup"><label class="fieldLabel" for="manualPunchReason">Punch Correction Reason</label><input id="manualPunchReason" placeholder="Required audit reason" /></div>
          </div>
          <div class="formActions"><button id="savePayrollAdjustmentButton" class="button secondary" type="button">Save Adjustment</button><button id="savePunchCorrectionButton" class="button ghost" type="button">Save Punch Correction</button></div>
          <div id="payrollSuiteList" class="listStack"></div>
        </section>
        <div id="managerPayrollList" class="listStack"></div>
      </section>
    `);
    $("refreshManagerPayrollButton")?.addEventListener("click", loadManagerPayrollSummary);
    $("payrollSettingsForm")?.addEventListener("submit", savePayrollSettings);
    $("runLeaveAccrualButton")?.addEventListener("click", runLeaveAccrualNow);
    $("evaluateBonusRulesButton")?.addEventListener("click", evaluateBonusRulesNow);
    $("saveProviderSettingsButton")?.addEventListener("click", saveProviderSettings);
    $("approvePayrollButton")?.addEventListener("click", () => lockPayroll(false));
    $("finalizePayrollButton")?.addEventListener("click", () => lockPayroll(true));
    $("exportPayrollCsvButton")?.addEventListener("click", exportPayrollCsv);
    $("savePayrollAdjustmentButton")?.addEventListener("click", savePayrollAdjustment);
    $("savePunchCorrectionButton")?.addEventListener("click", savePunchCorrection);
  } else if (managerPortalContent && $("managerPayrollPanel") && $("managerPayrollPanel").parentElement !== managerPortalContent) {
    managerPortalContent.appendChild($("managerPayrollPanel"));
  }

  const overridePanel = $("timeOffSettingsCard");
  if (managerPortalContent && overridePanel) {
    overridePanel.classList.add("portalSubcard", "managerOnly", "overridePanel");
    overridePanel.classList.remove("settingsInlineCard", "ownerOnly");

    const overrideHeader = overridePanel.querySelector(".cardTitle, .sectionHeader");
    if (overrideHeader) {
      overrideHeader.classList.add("cardTitle", "dashboardCardTitle", "dashboardCardTitleWithAction", "overrideCardHeader");
      overrideHeader.classList.remove("sectionHeader", "compactHeader");
    }

    const titleContainer = overrideHeader?.querySelector(":scope > .dashboardTitleGroup") || overrideHeader?.querySelector(":scope > div:first-child");
    if (titleContainer && !titleContainer.classList.contains("dashboardTitleGroup")) {
      titleContainer.classList.add("dashboardTitleGroup");
      titleContainer.innerHTML = `<span class="iconBadge">MP-04</span><div>${titleContainer.innerHTML}</div>`;
    }

    const badge = overridePanel.querySelector(".iconBadge");
    const title = overridePanel.querySelector("h2, h3");
    if (badge) badge.textContent = "MP-04";
    if (title) {
      title.textContent = "Override";
      if (title.tagName === "H3") {
        const heading = document.createElement("h2");
        heading.textContent = title.textContent;
        title.replaceWith(heading);
      }
    }

    const hint = overridePanel.querySelector(".panelHint");
    if (hint) hint.textContent = "Owner controls for employee requests, cover/swap workflow, and blocked dates.";

    if (overridePanel.parentElement !== managerPortalContent) {
      managerPortalContent.appendChild(overridePanel);
    }
  }

  if (shiftsPanel) {
    const badge = shiftsPanel.querySelector(".iconBadge");
    if (badge) badge.textContent = "04";
  }

  updateSelectedLocationLabels();
  syncAutomationRoleVisibility();
}


const DEFAULT_LOCATION_RULES = {
  open_days: [1, 2, 3, 4, 5],
  operating_start: "08:00",
  operating_end: "17:00",
  min_employees_per_day: 0,
  max_employees_per_day: null,
  default_required_staff: 1,
  labor_budget_cents: 0,
  schedule_publish_day: 1,
  time_zone: "America/Chicago"
};

let locationRulesEditorOpen = false;
let cachedLocationRules = null;

function setLocationRulesEditorOpen(open) {
  locationRulesEditorOpen = Boolean(open);
  const form = $("locationRulesForm");
  const button = $("createLocationRulesButton");

  form?.classList.toggle("hidden", !locationRulesEditorOpen);
  if (button) button.textContent = locationRulesEditorOpen ? "Save Rules" : "Update Rules";
}


function renderRuleOpenDays(openDays = []) {
  const selected = new Set(openDays.map(Number));
  const box = $("ruleOpenDays");
  if (!box) return;
  box.innerHTML = DAYS.map((day) => `
    <button class="dotDay ${selected.has(day.value) ? "active" : ""}" type="button" data-day="${day.value}" aria-pressed="${selected.has(day.value)}">${day.short}</button>
  `).join("");
}

function collectRuleOpenDays() {
  return [...document.querySelectorAll("#ruleOpenDays .dotDay.active")].map((button) => Number(button.dataset.day));
}

function resetLocationRulesForm() {
  const form = $("locationRulesForm");
  if (!form) return;

  form.reset();
  [
    "ruleOperatingStart",
    "ruleOperatingEnd",
    "ruleMinEmployees",
    "ruleMaxEmployees",
    "ruleDefaultRequired",
    "ruleLaborBudget",
    "rulePublishDay",
    "ruleTimeZone"
  ].forEach((id) => {
    const field = $(id);
    if (field) field.value = "";
  });
  renderRuleOpenDays([]);
}

function normalizeLocationRulesForForm(rules = {}) {
  return {
    ...DEFAULT_LOCATION_RULES,
    ...rules,
    open_days: Array.isArray(rules.open_days) && rules.open_days.length
      ? rules.open_days
      : DEFAULT_LOCATION_RULES.open_days,
    operating_start: rules.operating_start || DEFAULT_LOCATION_RULES.operating_start,
    operating_end: rules.operating_end || DEFAULT_LOCATION_RULES.operating_end,
    min_employees_per_day: rules.min_employees_per_day ?? DEFAULT_LOCATION_RULES.min_employees_per_day,
    max_employees_per_day: rules.max_employees_per_day ?? DEFAULT_LOCATION_RULES.max_employees_per_day,
    default_required_staff: rules.default_required_staff ?? DEFAULT_LOCATION_RULES.default_required_staff,
    labor_budget_cents: rules.labor_budget_cents ?? DEFAULT_LOCATION_RULES.labor_budget_cents,
    schedule_publish_day: rules.schedule_publish_day ?? DEFAULT_LOCATION_RULES.schedule_publish_day,
    time_zone: rules.time_zone || DEFAULT_LOCATION_RULES.time_zone
  };
}

function populateLocationRulesForm(rules = {}) {
  if (!$("locationRulesForm")) return;

  const normalizedRules = normalizeLocationRulesForForm(rules);
  $("ruleOperatingStart").value = String(normalizedRules.operating_start).slice(0, 5);
  $("ruleOperatingEnd").value = String(normalizedRules.operating_end).slice(0, 5);
  $("ruleMinEmployees").value = normalizedRules.min_employees_per_day;
  $("ruleMaxEmployees").value = normalizedRules.max_employees_per_day ?? "";
  $("ruleDefaultRequired").value = normalizedRules.default_required_staff;
  $("ruleLaborBudget").value = (Number(normalizedRules.labor_budget_cents || 0) / 100).toFixed(2);
  $("rulePublishDay").value = normalizedRules.schedule_publish_day;
  $("ruleTimeZone").value = normalizedRules.time_zone;
  renderRuleOpenDays(normalizedRules.open_days);
}

async function loadLocationRules() {
  if (!$("locationRulesForm")) return;
  cachedLocationRules = null;
  resetLocationRulesForm();
  setLocationRulesEditorOpen(false);
  setNotice("locationRulesNotice", "", "");
}

async function createLocationRules() {
  if (!selectedLocationId || !canManageSchedule() || !$("locationRulesForm")) return;

  if (locationRulesEditorOpen) {
    await saveLocationRules({ preventDefault() {} });
    return;
  }

  try {
    const data = await api(`/automation/rules?locationId=${encodeURIComponent(selectedLocationId)}`);
    cachedLocationRules = data.rules || DEFAULT_LOCATION_RULES;
    populateLocationRulesForm(cachedLocationRules);
    setLocationRulesEditorOpen(true);
    setNotice("locationRulesNotice", "", "");
  } catch (err) {
    cachedLocationRules = DEFAULT_LOCATION_RULES;
    populateLocationRulesForm(cachedLocationRules);
    setLocationRulesEditorOpen(true);
    setNotice("locationRulesNotice", "error", err.message);
  }
}

async function saveLocationRules(event) {
  event?.preventDefault?.();
  if (!selectedLocationId) return;
  try {
    const data = await api("/automation/rules", {
      method: "PUT",
      body: JSON.stringify({
        locationId: selectedLocationId,
        openDays: collectRuleOpenDays(),
        operatingStart: $("ruleOperatingStart").value,
        operatingEnd: $("ruleOperatingEnd").value,
        minEmployeesPerDay: Number($("ruleMinEmployees").value || 0),
        maxEmployeesPerDay: $("ruleMaxEmployees").value || null,
        defaultRequiredStaff: Number($("ruleDefaultRequired").value || 1),
        laborBudgetCents: Math.round(Number($("ruleLaborBudget").value || 0) * 100),
        schedulePublishDay: Number($("rulePublishDay").value || 1),
        timeZone: $("ruleTimeZone").value || "America/Chicago"
      })
    });
    cachedLocationRules = data.rules || DEFAULT_LOCATION_RULES;
    populateLocationRulesForm(cachedLocationRules);
    setLocationRulesEditorOpen(false);
    setNotice("locationRulesNotice", "success", data.message || "Rules updated.");
    await Promise.all([loadSchedule(), loadAuditLog()]);
  } catch (err) {
    setNotice("locationRulesNotice", "error", err.message);
  }
}

async function saveScheduleState(state) {
  if (!selectedLocationId) return;
  if (!lastSchedulePayload.cells.length && state !== "draft") {
    showMessage("No forecast cells are available to publish yet.");
    return;
  }
  try {
    const data = await api("/automation/schedules/publish", {
      method: "POST",
      body: JSON.stringify({
        locationId: selectedLocationId,
        weekStart: dateOnly(currentWeekStart),
        state,
        notes: $("schedulePublishNotes")?.value || "",
        cells: lastSchedulePayload.cells,
        coverage: lastSchedulePayload.coverage
      })
    });
    showMessage(data.message || "Schedule saved.", "success");
    await Promise.all([loadPublishedScheduleStatus(), loadOpenShifts(), loadLaborForecast(), loadApprovalQueue(), loadAuditLog()]);
  } catch (err) {
    showMessage(err.message);
  }
}

async function loadPublishedScheduleStatus() {
  if (!selectedLocationId || !$("publishedScheduleStatus")) return;
  try {
    const data = await api(`/automation/schedules/published?locationId=${encodeURIComponent(selectedLocationId)}&weekStart=${dateOnly(currentWeekStart)}`);
    const schedule = data.schedule;
    $("publishedScheduleStatus").textContent = schedule
      ? `${String(schedule.status || "draft").toUpperCase()} · Revision ${schedule.revision_number || 1}`
      : "Forecast has not been saved yet";
  } catch {
    $("publishedScheduleStatus").textContent = "Published status unavailable";
  }
}

async function loadEmployeeSchedule() {
  const list = $("employeeScheduleList");
  if (!list || !accessToken) return;
  try {
    const data = await api(`/automation/employee-schedule?weekStart=${dateOnly(currentWeekStart)}`);
    const cells = data.cells || [];
    const timeOff = data.timeOff || [];
    const openShifts = data.openShifts || [];
    const cellByDate = new Map();
    for (const cell of cells) {
      const key = String(cell.work_date || "").slice(0, 10);
      if (!cellByDate.has(key)) cellByDate.set(key, []);
      cellByDate.get(key).push(cell);
    }

    const todayKey = dateOnly(new Date());
    const defaultSelected = [...cellByDate.keys()].sort().find((date) => date >= todayKey) || dateOnly(currentWeekStart);
    const selectedDate = list.dataset.selectedDate || defaultSelected;
    const selectedDateObj = parseDateOnly(selectedDate) || currentWeekStart;
    const selectedDay = selectedDateObj.getDay() === 0 ? 7 : selectedDateObj.getDay();
    const weekRemainder = DAYS.map((day, index) => dateOnly(addDays(currentWeekStart, index)))
      .filter((date) => {
        const parsed = parseDateOnly(date);
        const day = parsed.getDay() === 0 ? 7 : parsed.getDay();
        return day >= selectedDay;
      });
    const selectedCells = cellByDate.get(selectedDate) || [];

    list.innerHTML = `
      <article class="automationSummary healthMetricCard"><strong>${cells.length}</strong><span>published shifts this week</span></article>
      <div class="employeeCalendarGrid" role="grid" aria-label="Employee schedule calendar">
        ${DAYS.map((day, index) => {
          const date = dateOnly(addDays(currentWeekStart, index));
          const dayCells = cellByDate.get(date) || [];
          return `<button class="employeeCalendarDay ${date === selectedDate ? "selected" : ""} ${dayCells.length ? "working" : ""}" data-action="employee-calendar-day" data-date="${escapeHtml(date)}" type="button">
            <strong>${escapeHtml(day.short)}</strong>
            <span>${escapeHtml(String((parseDateOnly(date) || new Date()).getDate()))}</span>
            ${dayCells.length ? `<em>${escapeHtml(dayCells.length)} shift${dayCells.length === 1 ? "" : "s"}</em>` : `<small>Off</small>`}
          </button>`;
        }).join("")}
      </div>
      <div class="automationDivider">Selected day</div>
      ${selectedCells.length ? selectedCells.map((cell) => `
        <article class="listItem personalizedListItem"><span data-profile-avatar>${profileAvatarHtml("embeddedAvatar")}</span><div><strong>${escapeHtml(formatRequestDate(cell.work_date))} — ${escapeHtml(cell.shift_name || "Shift")}</strong><span>${escapeHtml(String(cell.start_time || "").slice(0,5))}–${escapeHtml(String(cell.end_time || "").slice(0,5))} · ${escapeHtml(cell.location_name || "")}</span></div></article>
      `).join("") : `<div class="emptyState compactEmpty">No published shift on ${escapeHtml(formatRequestDate(selectedDate))}.</div>`}
      <div class="automationDivider">Rest of week from ${escapeHtml(formatRequestDate(selectedDate))}</div>
      ${weekRemainder.map((date) => {
        const dayCells = cellByDate.get(date) || [];
        return `<article class="listItem"><div><strong>${escapeHtml(formatRequestDate(date))}</strong><span>${dayCells.length ? dayCells.map((cell) => `${cell.shift_name || "Shift"} ${String(cell.start_time || "").slice(0,5)}–${String(cell.end_time || "").slice(0,5)}`).join(" · ") : "Off"}</span></div></article>`;
      }).join("")}
      <div class="automationDivider">Request status</div>
      ${timeOff.length ? timeOff.map((request) => `<article class="listItem personalizedListItem"><span data-profile-avatar>${profileAvatarHtml("embeddedAvatar")}</span><div><strong>${escapeHtml(formatRequestDate(request.start_date))}–${escapeHtml(formatRequestDate(request.end_date))}</strong><span>${escapeHtml(request.status)} · ${escapeHtml(request.reason || "")}</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No upcoming time off requests.</div>`}
      <div class="automationDivider">Open shifts at your location</div>
      ${openShifts.length ? openShifts.slice(0, 5).map((shift) => `<article class="listItem personalizedListItem"><span data-profile-avatar>${profileAvatarHtml("embeddedAvatar")}</span><div><strong>${escapeHtml(formatRequestDate(shift.work_date))} — ${escapeHtml(shift.shift_name)}</strong><span>${escapeHtml(String(shift.start_time || "").slice(0,5))}–${escapeHtml(String(shift.end_time || "").slice(0,5))} · ${escapeHtml(shift.slots_open)} open</span></div><button class="button secondary" data-action="claim-open-shift" data-id="${escapeHtml(shift.id)}">Claim</button></article>`).join("") : `<div class="emptyState compactEmpty">No open shifts available.</div>`}
    `;
    updateProfileAvatars();
  } catch (err) {
    list.innerHTML = `<div class="emptyState compactEmpty">${escapeHtml(err.message)}</div>`;
  }
}

async function loadOpenShifts() {
  const list = $("openShiftsList");
  if (!list || !selectedLocationId) return;
  try {
    const data = await api(`/automation/open-shifts?locationId=${encodeURIComponent(selectedLocationId)}&weekStart=${dateOnly(currentWeekStart)}`);
    const shifts = data.openShifts || [];
    list.innerHTML = shifts.length ? shifts.map((shift) => `
      <article class="listItem">
        <div><strong>${escapeHtml(formatRequestDate(shift.work_date))} — ${escapeHtml(shift.shift_name)}</strong><span>${escapeHtml(String(shift.start_time || "").slice(0,5))}–${escapeHtml(String(shift.end_time || "").slice(0,5))} · ${escapeHtml(shift.slots_open)} open · ${escapeHtml(shift.status)}</span></div>
        <button class="button secondary" data-action="claim-open-shift" data-id="${escapeHtml(shift.id)}">Claim</button>
      </article>`).join("") : `<div class="emptyState compactEmpty">No open shifts have been published for this week.</div>`;
  } catch (err) {
    list.innerHTML = `<div class="emptyState compactEmpty">${escapeHtml(err.message)}</div>`;
  }
}

async function claimOpenShift(id) {
  try {
    await api(`/automation/open-shifts/${encodeURIComponent(id)}/claim`, { method: "POST", body: JSON.stringify({ note: "Claimed from Shift Ahoy desktop." }) });
    await Promise.all([loadOpenShifts(), loadEmployeeSchedule(), loadApprovalQueue(), loadAuditLog()]);
  } catch (err) {
    showMessage(err.message);
  }
}

async function loadShiftSwaps() {
  const list = $("shiftSwapList");
  if (!list) return;
  try {
    const suffix = selectedLocationId ? `?locationId=${encodeURIComponent(selectedLocationId)}` : "";
    const data = await api(`/automation/shift-swaps${suffix}`);
    const requests = data.requests || [];
    list.innerHTML = requests.length ? requests.map((request) => {
      const fromName = `${request.from_first_name || ""} ${request.from_last_name || ""}`.trim() || request.from_username || "Employee";
      const toName = `${request.to_first_name || ""} ${request.to_last_name || ""}`.trim() || request.to_username || "No taker yet";
      return `<article class="listItem"><div><strong>${escapeHtml(formatRequestDate(request.work_date))} · ${escapeHtml(request.request_type)}</strong><span>${escapeHtml(fromName)} → ${escapeHtml(toName)} · ${escapeHtml(request.status)} · ${escapeHtml(request.reason || "")}</span></div><div class="rowActions"><button class="button secondary" data-action="accept-swap" data-id="${escapeHtml(request.id)}">Accept</button><button class="button primary managerOnly" data-action="approve-swap" data-id="${escapeHtml(request.id)}">Approve</button><button class="button ghost managerOnly" data-action="deny-swap" data-id="${escapeHtml(request.id)}">Deny</button></div></article>`;
    }).join("") : `<div class="emptyState compactEmpty">No shift cover or swap requests yet.</div>`;
  } catch (err) {
    list.innerHTML = `<div class="emptyState compactEmpty">${escapeHtml(err.message)}</div>`;
  }
}

async function submitSwapRequest(event) {
  event.preventDefault();
  if (timeOffSettings.shiftSwapsEnabled === false) {
    setNotice("timeOffFormMessage", "error", "Shift cover and swap requests are currently turned off by the owner.");
    return;
  }
  try {
    await api("/automation/shift-swaps", {
      method: "POST",
      body: JSON.stringify({
        workDate: $("swapWorkDate").value,
        requestType: $("swapRequestType").value,
        reason: $("swapReason").value
      })
    });
    $("swapRequestForm").classList.add("hidden");
    await Promise.all([loadShiftSwaps(), loadApprovalQueue(), loadAuditLog()]);
  } catch (err) {
    showMessage(err.message);
  }
}

async function decideSwap(id, decision) {
  try {
    await api(`/automation/shift-swaps/${encodeURIComponent(id)}/${decision === "accept" ? "accept" : "decision"}`, {
      method: "POST",
      body: decision === "accept" ? JSON.stringify({}) : JSON.stringify({ decision, reason: "Handled from manager queue." })
    });
    await Promise.all([loadShiftSwaps(), loadApprovalQueue(), loadEmployeeSchedule(), loadAuditLog()]);
  } catch (err) {
    showMessage(err.message);
  }
}

async function loadLaborForecast() {
  const list = $("laborForecastList");
  if (!list || !selectedLocationId || !canManageSchedule()) return;
  try {
    const data = await api(`/automation/labor?locationId=${encodeURIComponent(selectedLocationId)}&weekStart=${dateOnly(currentWeekStart)}`);
    const employeeRows = data.byEmployee || [];
    const warnings = data.warnings || [];
    list.innerHTML = `
      <section class="automationMetrics healthMetricGrid">
        <article><strong>${moneyFromCents(data.totalCostCents)}</strong><span>estimated labor</span></article>
        <article><strong>${moneyFromCents(data.laborBudgetCents)}</strong><span>weekly budget</span></article>
        <article><strong>${warnings.length}</strong><span>warnings</span></article>
      </section>
      ${warnings.length ? `<div class="scheduleWarningsList"><ul>${warnings.map((w) => `<li>${escapeHtml(w.message)}</li>`).join("")}</ul></div>` : `<div class="scheduleWarningsList success">Labor is within configured limits.</div>`}
      ${employeeRows.length ? employeeRows.map((row) => `<article class="listItem"><div><strong>${escapeHtml(row.name || row.employeeCode)}</strong><span>${escapeHtml(row.hours.toFixed(2))} hours · ${moneyFromCents(row.costCents)} · OT after ${escapeHtml(row.overtimeThresholdHours)}</span></div></article>`).join("") : `<div class="emptyState compactEmpty">Save or publish a schedule to calculate labor.</div>`}
    `;
  } catch (err) {
    list.innerHTML = `<div class="emptyState compactEmpty">${escapeHtml(err.message)}</div>`;
  }
}

async function loadApprovalQueue() {
  const list = $("approvalQueueList");
  if (!list || !selectedLocationId || !canManageSchedule()) return;
  try {
    const data = await api(`/automation/approval-queue?locationId=${encodeURIComponent(selectedLocationId)}`);
    const queue = data.queue || { timeOff: [], shiftSwaps: [], openShifts: [], total: 0 };
    list.innerHTML = `
      <section class="automationMetrics healthMetricGrid"><article><strong>${escapeHtml(queue.total || 0)}</strong><span>items needing attention</span></article><article><strong>${escapeHtml(queue.timeOff.length)}</strong><span>time off</span></article><article><strong>${escapeHtml(queue.shiftSwaps.length)}</strong><span>swap/cover</span></article><article><strong>${escapeHtml(queue.openShifts.length)}</strong><span>open shifts</span></article></section>
      <div class="automationDivider">Time Off</div>
      ${queue.timeOff.length ? queue.timeOff.map((r) => `<article class="listItem"><div><strong>${escapeHtml(`${r.first_name || ""} ${r.last_name || ""}`.trim() || r.account_number)}</strong><span>${escapeHtml(formatRequestDate(r.start_date))}–${escapeHtml(formatRequestDate(r.end_date))} · ${escapeHtml(r.reason || "")}</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No pending time off.</div>`}
      <div class="automationDivider">Shift Swaps / Covers</div>
      ${queue.shiftSwaps.length ? queue.shiftSwaps.map((r) => `<article class="listItem"><div><strong>${escapeHtml(formatRequestDate(r.work_date))} · ${escapeHtml(r.request_type)}</strong><span>${escapeHtml(r.status)} · ${escapeHtml(r.reason || "")}</span></div><div class="rowActions"><button class="button primary" data-action="approve-swap" data-id="${escapeHtml(r.id)}">Approve</button><button class="button ghost" data-action="deny-swap" data-id="${escapeHtml(r.id)}">Deny</button></div></article>`).join("") : `<div class="emptyState compactEmpty">No shift swap approvals.</div>`}
      <div class="automationDivider">Coverage Gaps</div>
      ${queue.openShifts.length ? queue.openShifts.map((s) => `<article class="listItem"><div><strong>${escapeHtml(formatRequestDate(s.work_date))} — ${escapeHtml(s.shift_name)}</strong><span>${escapeHtml(s.slots_open)} open slot(s)</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No open coverage gaps.</div>`}
    `;
  } catch (err) {
    list.innerHTML = `<div class="emptyState compactEmpty">${escapeHtml(err.message)}</div>`;
  }
}


function formatHoursFromMinutes(minutes) {
  return (Math.max(0, Number(minutes || 0)) / 60).toFixed(2);
}

function clockDecisionText(data = {}, fallback = "") {
  const decision = data.decision || {};
  return decision.reason || data.reason || data.error || data.message || fallback;
}

function clockStatusLabel(data = {}, fallback = "") {
  const decision = data.decision || {};
  return decision.title || data.statusLabel || fallback || "Clock status";
}

function hasUnlockedClockPortal() {
  return !!clockSessionToken && !!currentBusinessAccountNumber();
}

function updateClockPortalAccessState() {
  const unlocked = hasUnlockedClockPortal();
  const card = document.querySelector(".clockCard");
  const input = $("clockAccountNumber");
  const actionButtons = [$("clockLookupButton"), $("clockInButton"), $("clockOutButton")].filter(Boolean);

  card?.classList.toggle("clockPortalLocked", !unlocked);

  if (input) {
    input.disabled = false;
    input.removeAttribute("aria-disabled");
    input.placeholder = unlocked
      ? "Scan or enter 9 digit Employee ID#"
      : "Scan or enter Employee Company ID# — unlock required to clock";
  }

  for (const button of actionButtons) {
    button.disabled = !unlocked;
    button.setAttribute("aria-disabled", String(!unlocked));
  }
}

function requireUnlockedClockPortal() {
  if (hasUnlockedClockPortal()) return true;
  updateClockPortalAccessState();
  setClockCardState("rejected", {
    decision: {
      title: "Locked",
      reason: "A manager or owner must unlock the clock portal before employees can clock in or clock out.",
      audited: false
    }
  });
  setNotice("clockFormMessage", "error", "Unlock the Clock Portal with owner or manager credentials before clocking employees in or out.");
  return false;
}

function setClockCardState(state = "idle", data = {}) {
  const card = document.querySelector(".clockCard");
  const preview = $("clockStatusPreview");
  const employeeName = data.employee?.name || data.entry?.employeeName || "Employee";
  const label = clockStatusLabel(data, state === "approved" ? "Approved" : state === "rejected" ? "Rejected" : "Clock status");
  const reason = clockDecisionText(data, "Ready for the next employee scan or entry.");
  const auditText = data.decision?.audited || data.audited ? "Audited" : "Audit record pending";

  card?.classList.remove("clockStateApproved", "clockStateRejected", "clockStateWarning", "clockStateUnlocked");

  if (state === "approved") card?.classList.add("clockStateApproved");
  if (state === "rejected") card?.classList.add("clockStateRejected");
  if (state === "warning") card?.classList.add("clockStateWarning");
  if (state === "unlocked") card?.classList.add("clockStateUnlocked");

  if (!preview) return;

  if (state === "idle") {
    preview.className = "clockStatusPreview hidden";
    preview.innerHTML = "";
    return;
  }

  preview.className = `clockStatusPreview clockStatusPreview--${state}`;
  preview.innerHTML = `
    <strong>${escapeHtml(label)}</strong>
    <span>${escapeHtml(employeeName)}</span>
    <small>${escapeHtml(reason)}</small>
    <em>${escapeHtml(auditText)}</em>
  `;
}

function setClockButtonsForLookup(data = {}) {
  const clockInButton = $("clockInButton");
  const clockOutButton = $("clockOutButton");
  clockInButton?.classList.remove("hidden");
  clockOutButton?.classList.remove("hidden");
  updateClockPortalAccessState();
}

function clearClockPunchState() {
  pendingClockAction = null;
  setClockCardState("idle");
  $("clockOutButton")?.classList.remove("hidden");
  $("clockInButton")?.classList.remove("hidden");
  updateClockPortalAccessState();
}

function resetClockAfterDecision() {
  const input = $("clockAccountNumber");
  if (input) input.value = "";
  pendingClockAction = null;
  $("clockOutButton")?.classList.remove("hidden");
  $("clockInButton")?.classList.remove("hidden");
  updateClockPortalAccessState();
}

async function unlockClockPortal() {
  const businessAccountNumber = currentBusinessAccountNumber();
  const password = normalizePasswordInput($("clockManagerPassword")?.value || "");

  if (!isValidIdInput(businessAccountNumber)) {
    setClockCardState("rejected", {
      decision: {
        title: "Rejected",
        reason: "Activate a valid Business ID# before unlocking the clock portal.",
        audited: false
      }
    });
    setNotice("clockFormMessage", "error", "Enter and activate a valid Business ID# first.");
    return;
  }

  if (!password) {
    setClockCardState("rejected", {
      decision: {
        title: "Rejected",
        reason: "Owner or manager password is required to unlock the employee clock station.",
        audited: false
      }
    });
    setNotice("clockFormMessage", "error", "Enter an owner or manager password to unlock the clock portal.");
    return;
  }

  try {
    const data = await api("/payroll/clock/session", {
      method: "POST",
      skipRefresh: true,
      headers: desktopClockHeaders(),
      body: JSON.stringify({ businessAccountNumber, password })
    });
    clockSessionToken = data.clockSessionToken || "";
    sessionStorage.setItem("shiftAhoyClockSessionToken", clockSessionToken);
    updateClockPortalAccessState();
    if ($("clockManagerPassword")) $("clockManagerPassword").value = "";
    setClockCardState("unlocked", {
      employee: { name: data.business?.businessName || selectedBusinessName || "Shift Ahoy" },
      decision: {
        title: "Clock Portal Unlocked",
        reason: "Employees may now scan or enter their Employee Company ID# to clock in or out.",
        audited: true
      }
    });
    setNotice("clockFormMessage", "success", data.message || "Clock portal unlocked.");
    $("clockAccountNumber")?.focus?.();
  } catch (err) {
    clockSessionToken = "";
    sessionStorage.removeItem("shiftAhoyClockSessionToken");
    updateClockPortalAccessState();
    setClockCardState("rejected", {
      decision: {
        title: "Rejected",
        reason: err.message || "Clock unlock failed.",
        audited: false
      }
    });
    setNotice("clockFormMessage", "error", err.message || "Clock unlock failed.");
  }
}

async function lookupClockStatus() {
  if (!requireUnlockedClockPortal()) return null;
  const input = $("clockAccountNumber");
  const number = normalizeIdInput(input?.value || "");
  if (input) input.value = number;
  clearClockPunchState();

  if (number.length !== 9) {
    setClockCardState("rejected", {
      decision: {
        title: "Rejected",
        reason: "Enter or scan a complete 9 digit Employee Company ID#.",
        audited: false
      }
    });
    setNotice("clockFormMessage", "error", "Enter a 9 digit Employee Company ID#.");
    return null;
  }

  try {
    const data = await api("/payroll/clock/lookup", {
      method: "POST",
      skipRefresh: true,
      headers: desktopClockHeaders(),
      body: JSON.stringify({ businessAccountNumber: currentBusinessAccountNumber(), employeeCode: number, accountNumber: number, clockSessionToken })
    });
    pendingClockAction = data.clockedIn ? "clock_out" : "clock_in";
    setClockButtonsForLookup(data);
    setClockCardState("unlocked", {
      employee: data.employee,
      decision: {
        title: data.clockedIn ? "Ready to Clock Out" : "Ready to Clock In",
        reason: data.clockedIn ? "This employee currently has an open clock entry." : "Employee ID# found. Press Clock In or scan again to clock in automatically.",
        audited: false
      }
    });
    setNotice("clockFormMessage", "success", data.clockedIn ? "ID# found. Employee is currently clocked in." : "ID# found. Ready to clock in.");
    return data;
  } catch (err) {
    setClockCardState("rejected", {
      decision: {
        title: "Rejected",
        reason: err.message || "Clock lookup failed.",
        audited: false
      }
    });
    setNotice("clockFormMessage", "error", err.message || "Clock lookup failed.");
    return null;
  }
}

async function submitClockAction(actionOverride = null) {
  if (!requireUnlockedClockPortal()) return;
  const input = $("clockAccountNumber");
  const number = normalizeIdInput(input?.value || "");
  if (input) input.value = number;

  const action = actionOverride || pendingClockAction || "clock_in";

  if (number.length !== 9) {
    setClockCardState("rejected", {
      decision: {
        title: "Rejected",
        reason: "Enter or scan a complete 9 digit Employee Company ID#.",
        audited: false
      }
    });
    setNotice("clockFormMessage", "error", "Enter a 9 digit Employee Company ID#.");
    return;
  }

  try {
    const data = await api("/payroll/clock", {
      method: "POST",
      skipRefresh: true,
      headers: desktopClockHeaders(),
      body: JSON.stringify({ businessAccountNumber: currentBusinessAccountNumber(), employeeCode: number, accountNumber: number, action, clockSessionToken })
    });

    const normalizedStatus = String(data.status || "on_time").toLowerCase();
    const visualState = normalizedStatus === "on_time" ? "approved" : "warning";
    setClockCardState(visualState, data);
    setNotice("clockFormMessage", visualState === "approved" ? "success" : "warning", clockDecisionText(data, data.message || "Clock action recorded."));
    resetClockAfterDecision();

    if (accessToken) {
      loadPayrollPanels().catch(() => {});
    }
  } catch (err) {
    const data = err.data || {};
    setClockCardState("rejected", data.decision ? data : {
      employee: data.employee,
      decision: {
        title: "Rejected",
        reason: err.message || "Clock action failed.",
        audited: !!data.audited
      }
    });
    setNotice("clockFormMessage", "error", clockDecisionText(data, err.message || "Clock action failed."));
  }
}

let clockScanTimer = null;
function handleClockIdInput() {
  const input = $("clockAccountNumber");
  if (!input) return;
  input.value = normalizeIdInput(input.value);
  clearTimeout(clockScanTimer);
  clearClockPunchState();

  if (!hasUnlockedClockPortal()) {
    updateClockPortalAccessState();
    return;
  }

  if (input.value.length === 9) {
    clockScanTimer = setTimeout(() => submitClockAction("clock_in"), 220);
  }
}

function handleClockIdKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    if (!requireUnlockedClockPortal()) return;
    submitClockAction("clock_in");
  }
}

async function savePayrollSettings(event) {
  event?.preventDefault?.();
  try {
    const data = await api("/payroll/settings", {
      method: "PUT",
      body: JSON.stringify({
        firstPayPeriodStart: $("payrollStartDate")?.value || "",
        payPeriodWeeks: Number($("payPeriodWeeks")?.value || 2),
        inAppClockEnabled: !!$("inAppClockEnabled")?.checked,
        requireClockSession: !!$("requireClockSession")?.checked,
        enforceScheduledClockIn: !!$("enforceScheduledClockIn")?.checked,
        clockInEarlyGraceMinutes: Number($("clockInEarlyGraceMinutes")?.value || 0),
        clockInLateGraceMinutes: Number($("clockInLateGraceMinutes")?.value || 5),
        clockOutGraceMinutes: Number($("clockOutGraceMinutes")?.value || 15),
        ptoEnabled: !!$("ptoEnabled")?.checked,
        sickLeaveEnabled: !!$("sickLeaveEnabled")?.checked,
        bonusEnabled: !!$("bonusEnabled")?.checked || !!$("payBumpEnabled")?.checked
      })
    });

    await api("/payroll/leave/settings", {
      method: "PUT",
      body: JSON.stringify(buildLeaveSettingsPayload())
    });

    setNotice("payrollSettingsNotice", "success", "Payroll, leave, and bonus settings saved.");
    await loadPayrollPanels();
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to save payroll settings.");
  }
}


function dollarsToCents(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

function setChecked(id, value) {
  const element = $(id);
  if (element) element.checked = !!value;
}

function setValue(id, value) {
  const element = $(id);
  if (element && value !== undefined && value !== null) element.value = value;
}

function buildLeaveSettingsPayload() {
  const bonusRuleName = String($("bonusRuleName")?.value || "").trim();
  const bonusRules = [];
  const cashBonusEnabled = !!$("bonusEnabled")?.checked;
  const payBumpEnabled = !!$("payBumpEnabled")?.checked;
  const hoursThreshold = Number($("bonusHoursThreshold")?.value || 0);
  const bonusCents = cashBonusEnabled ? dollarsToCents($("bonusAmountDollars")?.value) : 0;
  const payBumpCents = payBumpEnabled ? dollarsToCents($("payBumpDollars")?.value) : 0;

  if ((cashBonusEnabled || payBumpEnabled || bonusRuleName || hoursThreshold > 0) && hoursThreshold > 0) {
    bonusRules.push({
      name: bonusRuleName || (payBumpEnabled ? "Automatic hours-based pay bump" : "Hours milestone bonus"),
      enabled: cashBonusEnabled || payBumpEnabled,
      awardType: "all_time_hours",
      hoursThreshold,
      bonusCents,
      payBumpCents,
      recurring: !!$("bonusRecurring")?.checked,
      maxCycles: $("bonusMaxCycles")?.value ? Number($("bonusMaxCycles")?.value) : null,
      applyPayBumpToEmployee: payBumpEnabled
    });
  }

  return {
    ptoEnabled: !!$("ptoEnabled")?.checked,
    sickLeaveEnabled: !!$("sickLeaveEnabled")?.checked,
    bonusEnabled: !!$("bonusEnabled")?.checked || !!$("payBumpEnabled")?.checked,
    allowNegativeLeaveBalance: !!$("allowNegativeLeaveBalance")?.checked,
    autoAccrueOnClockOut: !!$("autoAccrueOnClockOut")?.checked,
    autoAwardBonusesOnClockOut: !!$("autoAwardBonusesOnClockOut")?.checked,
    leaveYearResetMonth: Number($("leaveYearResetMonth")?.value || 1),
    leaveYearResetDay: Number($("leaveYearResetDay")?.value || 1),
    leaveRules: [
      {
        leaveType: "pto",
        enabled: !!$("ptoEnabled")?.checked,
        yearsOfServiceMin: 0,
        accrualMethod: "worked_hours",
        accrualHoursPerWorkedHour: Number($("ptoAccrualRate")?.value || 0),
        maxBalanceHours: $("ptoMaxBalanceHours")?.value || null
      },
      {
        leaveType: "sick",
        enabled: !!$("sickLeaveEnabled")?.checked,
        yearsOfServiceMin: 0,
        accrualMethod: "worked_hours",
        accrualHoursPerWorkedHour: Number($("sickAccrualRate")?.value || 0),
        maxBalanceHours: $("sickMaxBalanceHours")?.value || null
      }
    ],
    bonusRules
  };
}

function hydrateLeaveSettings(settings = {}, leaveRules = [], bonusRules = []) {
  setChecked("inAppClockEnabled", settings.in_app_clock_enabled !== false);
  setChecked("requireClockSession", settings.require_clock_session !== false);
  setChecked("enforceScheduledClockIn", settings.enforce_scheduled_clock_in !== false);
  setValue("clockInEarlyGraceMinutes", settings.clock_in_early_grace_minutes ?? 0);
  setValue("clockInLateGraceMinutes", settings.clock_in_late_grace_minutes ?? 5);
  setValue("clockOutGraceMinutes", settings.clock_out_grace_minutes ?? 15);
  setChecked("ptoEnabled", settings.pto_enabled === true);
  setChecked("sickLeaveEnabled", settings.sick_leave_enabled === true);
  setChecked("bonusEnabled", settings.bonus_enabled === true);
  setChecked("allowNegativeLeaveBalance", settings.allow_negative_leave_balance === true);
  setChecked("autoAccrueOnClockOut", settings.auto_accrue_on_clock_out !== false);
  setChecked("autoAwardBonusesOnClockOut", settings.auto_award_bonuses_on_clock_out !== false);
  setValue("leaveYearResetMonth", settings.leave_year_reset_month ?? 1);
  setValue("leaveYearResetDay", settings.leave_year_reset_day ?? 1);

  const ptoRule = leaveRules.find((rule) => rule.leave_type === "pto" && Number(rule.years_of_service_min || 0) === 0) || leaveRules.find((rule) => rule.leave_type === "pto") || {};
  const sickRule = leaveRules.find((rule) => rule.leave_type === "sick" && Number(rule.years_of_service_min || 0) === 0) || leaveRules.find((rule) => rule.leave_type === "sick") || {};
  setValue("ptoAccrualRate", ptoRule.accrual_hours_per_worked_hour ?? 0);
  setValue("ptoMaxBalanceHours", ptoRule.max_balance_hours ?? "");
  setValue("sickAccrualRate", sickRule.accrual_hours_per_worked_hour ?? 0);
  setValue("sickMaxBalanceHours", sickRule.max_balance_hours ?? "");

  const bonusRule = bonusRules[0] || {};
  setValue("bonusRuleName", bonusRule.name || "");
  setValue("bonusHoursThreshold", bonusRule.hours_threshold ?? "");
  setValue("bonusAmountDollars", bonusRule.bonus_cents ? (Number(bonusRule.bonus_cents) / 100).toFixed(2) : "");
  setValue("payBumpDollars", bonusRule.pay_bump_cents ? (Number(bonusRule.pay_bump_cents) / 100).toFixed(2) : "");
  setChecked("payBumpEnabled", Number(bonusRule.pay_bump_cents || 0) > 0 && bonusRule.enabled !== false);
  setChecked("bonusEnabled", Number(bonusRule.bonus_cents || 0) > 0 && bonusRule.enabled !== false);
  setChecked("bonusRecurring", bonusRule.recurring === true);
  setValue("bonusMaxCycles", bonusRule.max_cycles ?? "");
}

async function loadLeaveSettingsForForm() {
  if (!accessToken || !canManageSchedule()) return null;
  try {
    const data = await api("/payroll/leave/settings");
    hydrateLeaveSettings(data.settings || {}, data.leaveRules || [], data.bonusRules || []);
    return data;
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to load leave settings.");
    return null;
  }
}

async function runLeaveAccrualNow() {
  try {
    const body = selectedLocationId ? { locationId: selectedLocationId } : {};
    const data = await api("/payroll/leave/accrue", { method: "POST", body: JSON.stringify(body) });
    setNotice("payrollSettingsNotice", "success", `Accrual complete for ${escapeHtml(data.periodStart || "current period")} to ${escapeHtml(data.periodEnd || "current period")}.`);
    await loadPayrollPanels();
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to run accrual.");
  }
}

async function evaluateBonusRulesNow() {
  try {
    const body = selectedLocationId ? { locationId: selectedLocationId } : {};
    const data = await api("/payroll/bonuses/evaluate", { method: "POST", body: JSON.stringify(body) });
    setNotice("payrollSettingsNotice", "success", `${(data.awards || []).length} new bonus/pay-bump award(s) created.`);
    await loadPayrollPanels();
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to evaluate bonuses.");
  }
}

function leaveBalanceCardsHtml(leaveBalances = []) {
  if (!leaveBalances.length) return "";
  return `
    <div class="automationDivider">PTO & Sick Leave Balances</div>
    <section class="automationMetrics healthMetricGrid">
      ${leaveBalances.map((row) => `<article><strong>${escapeHtml(formatHoursFromMinutes(row.balance_minutes))}</strong><span>${escapeHtml(String(row.leave_type || "leave").toUpperCase())} balance · ${escapeHtml(formatHoursFromMinutes(row.used_minutes_lifetime))} used</span></article>`).join("")}
    </section>
  `;
}

function bonusAwardsHtml(bonusAwards = []) {
  if (!bonusAwards.length) return `<div class="emptyState compactEmpty">No bonus or pay-bump awards yet.</div>`;
  return bonusAwards.map((award) => `<article class="listItem"><div><strong>${escapeHtml(award.rule_name || "Bonus award")}</strong><span>${moneyFromCents(award.bonus_cents || 0)} bonus · ${moneyFromCents(award.pay_bump_cents || 0)}/hr bump · ${escapeHtml(Number(award.hours_at_award || 0).toFixed(2))} hours at award</span></div></article>`).join("");
}



function hydrateProviderSettings(settings = {}) {
  if ($("payrollProvider")) $("payrollProvider").value = settings.payroll_provider || "csv";
  if ($("providerExternalCompanyId")) $("providerExternalCompanyId").value = settings.provider_external_company_id || "";
  if ($("providerNotes")) $("providerNotes").value = settings.provider_notes || "";
  if ($("taxHandlingMode")) $("taxHandlingMode").value = settings.tax_handling_mode || "provider";
  if ($("overtimePolicy")) $("overtimePolicy").value = settings.overtime_policy || "flsa_40";
  if ($("weeklyOvertimeHours")) $("weeklyOvertimeHours").value = settings.weekly_overtime_hours || 40;
  if ($("dailyOvertimeHours")) $("dailyOvertimeHours").value = settings.daily_overtime_hours || "";
  if ($("defaultUnpaidBreakMinutes")) $("defaultUnpaidBreakMinutes").value = settings.default_unpaid_break_minutes || 0;
  if ($("requirePayrollApprovalLock")) $("requirePayrollApprovalLock").checked = settings.require_payroll_approval_lock !== false;
}

async function saveProviderSettings() {
  try {
    const data = await api("/payroll/provider-settings", {
      method: "PUT",
      body: JSON.stringify({
        provider: $("payrollProvider")?.value || "csv",
        providerExternalCompanyId: $("providerExternalCompanyId")?.value || "",
        providerNotes: $("providerNotes")?.value || "",
        taxHandlingMode: $("taxHandlingMode")?.value || "provider",
        overtimePolicy: $("overtimePolicy")?.value || "flsa_40",
        weeklyOvertimeHours: $("weeklyOvertimeHours")?.value || 40,
        dailyOvertimeHours: $("dailyOvertimeHours")?.value || "",
        defaultUnpaidBreakMinutes: $("defaultUnpaidBreakMinutes")?.value || 0,
        requirePayrollApprovalLock: $("requirePayrollApprovalLock")?.checked !== false
      })
    });
    hydrateProviderSettings(data.settings || {});
    setNotice("payrollSettingsNotice", "success", "Payroll provider, overtime, break, and tax/deduction handoff settings saved.");
    await loadPayrollSuite();
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to save provider settings.");
  }
}


async function savePayrollAdjustment() {
  try {
    await api("/payroll/adjustments", {
      method: "POST",
      body: JSON.stringify({
        employeeId: $("manualPayrollEmployeeId")?.value || "",
        amountDollars: $("manualAdjustmentAmount")?.value || 0,
        adjustmentType: $("manualAdjustmentType")?.value || "other",
        reason: $("manualAdjustmentReason")?.value || ""
      })
    });
    setNotice("payrollSettingsNotice", "success", "Payroll adjustment saved.");
    await loadPayrollSuite();
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to save payroll adjustment.");
  }
}

async function savePunchCorrection() {
  try {
    await api("/payroll/punch-corrections", {
      method: "POST",
      body: JSON.stringify({
        employeeId: $("manualPayrollEmployeeId")?.value || "",
        timeClockEntryId: $("manualPunchEntryId")?.value || null,
        clockInAt: $("manualPunchInAt")?.value || null,
        clockOutAt: $("manualPunchOutAt")?.value || null,
        reason: $("manualPunchReason")?.value || ""
      })
    });
    setNotice("payrollSettingsNotice", "success", "Manual punch correction saved and audited.");
    await loadPayrollSuite();
    await loadManagerPayrollSummary();
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to save punch correction.");
  }
}

async function loadPayrollSuite() {
  const target = $("payrollSuiteList");
  if (!target || !canManageSchedule()) return;
  try {
    const query = selectedLocationId ? `?locationId=${encodeURIComponent(selectedLocationId)}` : "";
    const data = await api(`/payroll/suite${query}`);
    hydrateProviderSettings(data.settings || {});
    const rows = data.rows || [];
    const batch = data.batch || {};
    const gross = rows.reduce((sum, row) => sum + Number(row.gross_pay_cents || 0), 0);
    const hours = rows.reduce((sum, row) => sum + Number(row.net_minutes || 0), 0);
    target.innerHTML = `
      <section class="automationMetrics healthMetricGrid">
        <article><strong>${escapeHtml(String(batch.status || "open").toUpperCase())}</strong><span>approval status</span></article>
        <article><strong>${escapeHtml(formatHoursFromMinutes(hours))}</strong><span>net payable hours</span></article>
        <article><strong>${moneyFromCents(gross)}</strong><span>gross payroll before provider taxes/deductions</span></article>
        <article><strong>${escapeHtml((data.settings?.payroll_provider || "csv").toUpperCase())}</strong><span>provider handoff</span></article>
      </section>
      <div class="scheduleWarningsList success">Payroll taxes, deductions, filings, and direct deposit should be calculated by the connected payroll provider or existing business payroll system. Shift Ahoy prepares the locked time, overtime, break, adjustment, and export record.</div>
      <div class="automationDivider">Export Preview</div>
      ${rows.length ? rows.slice(0, 15).map((row) => `<article class="listItem"><div><strong>${escapeHtml(`${row.first_name || ""} ${row.last_name || ""}`.trim() || row.employee_code)}</strong><span>${escapeHtml(row.location_name || "")} · ${escapeHtml(formatHoursFromMinutes(row.net_minutes))} net hours · ${escapeHtml(formatHoursFromMinutes(row.overtime_minutes))} OT · ${moneyFromCents(row.gross_pay_cents || 0)} gross</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No payable payroll rows for this period yet.</div>`}
      <div class="automationDivider">Recent Corrections & Adjustments</div>
      ${(data.corrections || []).length || (data.adjustments || []).length ? [...(data.corrections || []), ...(data.adjustments || [])].slice(0, 12).map((item) => `<article class="listItem"><div><strong>${escapeHtml(`${item.first_name || ""} ${item.last_name || ""}`.trim() || item.employee_code || "Entry")}</strong><span>${escapeHtml(item.reason || item.adjustment_type || "Payroll item")} · ${escapeHtml(new Date(item.created_at).toLocaleString())}</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No manual punch corrections or payroll adjustments this period.</div>`}
    `;
  } catch (err) {
    target.innerHTML = `<div class="emptyState compactEmpty">${escapeHtml(err.message)}</div>`;
  }
}

async function lockPayroll(finalize = false) {
  try {
    const body = selectedLocationId ? { locationId: selectedLocationId, finalize } : { finalize };
    const data = await api("/payroll/approval-lock", { method: "POST", body: JSON.stringify(body) });
    setNotice("payrollSettingsNotice", "success", finalize ? "Payroll finalized." : "Payroll approved and locked.");
    await loadPayrollSuite();
    return data;
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to lock payroll.");
  }
}

async function exportPayrollCsv() {
  try {
    const query = selectedLocationId ? `?locationId=${encodeURIComponent(selectedLocationId)}` : "";
    const res = await fetch(`${API_URL}/payroll/export.csv${query}`, {
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to export payroll CSV.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shift-ahoy-payroll-${dateOnly(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("payrollSettingsNotice", "success", "Payroll CSV exported.");
    await loadPayrollSuite();
  } catch (err) {
    setNotice("payrollSettingsNotice", "error", err.message || "Failed to export payroll CSV.");
  }
}

async function loadPayrollPanels() {
  if (!accessToken) return;
  if (currentUser?.role === "employee") {
    await loadEmployeePayrollSummary();
  }
  if (canManageSchedule()) {
    await loadManagerPayrollSummary();
  }
}

async function loadEmployeePayrollSummary() {
  const target = $("employeePayrollList");
  if (!target) return;
  try {
    const data = await api("/payroll/employee-summary");
    const period = data.currentPeriod || {};
    const entries = data.entries || [];
    const violations = data.violations || [];
    const allTime = data.allTime || {};
    target.innerHTML = `
      <section class="automationMetrics healthMetricGrid">
        <article><strong>${escapeHtml(formatHoursFromMinutes(period.minutes_worked))}</strong><span>current period hours</span></article>
        <article><strong>${escapeHtml(formatHoursFromMinutes(allTime.minutes_worked))}</strong><span>all-time hours</span></article>
        <article><strong>${moneyFromCents(period.estimated_pay_cents || 0)}</strong><span>estimated next pay</span></article>
      </section>
      ${leaveBalanceCardsHtml(data.leaveBalances || [])}
      <div class="automationDivider">Recent Clock Activity</div>
      ${entries.length ? entries.map((entry) => `<article class="listItem"><div><strong>${escapeHtml(new Date(entry.clock_in_at).toLocaleString())}</strong><span>Out: ${escapeHtml(entry.clock_out_at ? new Date(entry.clock_out_at).toLocaleString() : "Still clocked in")} · ${escapeHtml(formatHoursFromMinutes(entry.minutes_worked))} hours · In ${escapeHtml(entry.clock_in_status || "on_time")} / Out ${escapeHtml(entry.clock_out_status || "pending")}</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No payroll time entries yet.</div>`}
      <div class="automationDivider">Violations</div>
      ${violations.length ? violations.map((violation) => `<article class="listItem"><div><strong>${escapeHtml(new Date(violation.attempted_at || violation.created_at).toLocaleString())}</strong><span>${escapeHtml(String(violation.violation_type || "violation").replaceAll("_", " "))} · ${escapeHtml(violation.reason || "")}</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No violations logged.</div>`}
      <div class="automationDivider">Bonus / Pay Bump Awards</div>
      ${bonusAwardsHtml(data.bonusAwards || [])}
    `;
  } catch (err) {
    target.innerHTML = `<div class="emptyState compactEmpty">${escapeHtml(err.message)}</div>`;
  }
}

async function loadManagerPayrollSummary() {
  const target = $("managerPayrollList");
  if (!target) return;
  try {
    const query = selectedLocationId ? `?locationId=${encodeURIComponent(selectedLocationId)}` : "";
    const data = await api(`/payroll/manager-summary${query}`);
    const settings = data.settings || {};
    if ($("payrollStartDate") && settings.first_pay_period_start) $("payrollStartDate").value = String(settings.first_pay_period_start).slice(0, 10);
    if ($("payPeriodWeeks") && settings.pay_period_weeks) $("payPeriodWeeks").value = settings.pay_period_weeks;
    hydrateLeaveSettings(settings, [], []);
    hydrateProviderSettings(settings);
    await loadLeaveSettingsForForm();
    await loadPayrollSuite();
    const employees = data.employees || [];
    const alerts = data.alerts || [];
    const violations = data.violations || [];
    const totalPay = employees.reduce((sum, row) => sum + Number(row.estimated_pay_cents || 0), 0);
    target.innerHTML = `
      <section class="automationMetrics healthMetricGrid">
        <article><strong>${escapeHtml(employees.length)}</strong><span>employees</span></article>
        <article><strong>${moneyFromCents(totalPay)}</strong><span>estimated payroll</span></article>
        <article><strong>${escapeHtml(alerts.length)}</strong><span>recent alerts</span></article>
        <article><strong>${escapeHtml(violations.length)}</strong><span>violations</span></article>
      </section>
      ${alerts.length ? `<div class="scheduleWarningsList"><strong>Payroll alerts</strong><ul>${alerts.map((alert) => `<li>${escapeHtml(alert.message)}</li>`).join("")}</ul></div>` : `<div class="scheduleWarningsList success">No recent early/late clock alerts.</div>`}
      ${violations.length ? `<div class="scheduleWarningsList"><strong>Violations</strong><ul>${violations.slice(0, 10).map((violation) => `<li>${escapeHtml(`${violation.employee_code || ""} — ${String(violation.violation_type || "").replaceAll("_", " ")} · ${violation.reason || ""}`)}</li>`).join("")}</ul></div>` : `<div class="scheduleWarningsList success">No recent clock violations.</div>`}
      <div class="automationDivider">PTO / Sick Leave Balances</div>
      ${(data.leaveBalances || []).length ? (data.leaveBalances || []).slice(0, 20).map((row) => `<article class="listItem"><div><strong>${escapeHtml(`${row.first_name || ""} ${row.last_name || ""}`.trim() || row.employee_code)}</strong><span>${escapeHtml(String(row.leave_type || "leave").toUpperCase())}: ${escapeHtml(formatHoursFromMinutes(row.balance_minutes))} available · ${escapeHtml(formatHoursFromMinutes(row.used_minutes_lifetime))} used lifetime</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No PTO or sick leave balances yet.</div>`}
      <div class="automationDivider">Recent Bonus / Pay Bump Awards</div>
      ${(data.bonusAwards || []).length ? (data.bonusAwards || []).slice(0, 10).map((award) => `<article class="listItem"><div><strong>${escapeHtml(`${award.first_name || ""} ${award.last_name || ""}`.trim() || award.employee_code)}</strong><span>${escapeHtml(award.rule_name || "Bonus award")} · ${moneyFromCents(award.bonus_cents || 0)} bonus · ${moneyFromCents(award.pay_bump_cents || 0)}/hr bump</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No bonus or pay-bump awards yet.</div>`}
      <div class="automationDivider">Current Pay Period</div>
      ${employees.length ? employees.map((row) => `<article class="listItem"><div><strong>${escapeHtml(`${row.first_name || ""} ${row.last_name || ""}`.trim() || row.account_number || row.employee_code)}</strong><span>ID# ${escapeHtml(row.employee_code || row.account_number)} · ${escapeHtml(formatHoursFromMinutes(row.minutes_worked))} period hours · ${escapeHtml(formatHoursFromMinutes(row.all_time_minutes_worked))} all-time hours · ${moneyFromCents(row.estimated_pay_cents || 0)} estimated pay</span></div></article>`).join("") : `<div class="emptyState compactEmpty">No active employees in this payroll view.</div>`}
    `;
  } catch (err) {
    target.innerHTML = `<div class="emptyState compactEmpty">${escapeHtml(err.message)}</div>`;
  }
}

function renderUltimateAutomationPanels() {
  if (!accessToken) return;
  ensureUltimateAutomationLayout();
  syncAutomationRoleVisibility();
  loadPublishedScheduleStatus();
  loadPayrollPanels().catch(() => {});
  loadEmployeeSchedule();
  loadOpenShifts();
  loadShiftSwaps();
  loadLaborForecast();
  loadApprovalQueue();
  loadLocationRules();
}

function setupUltimateAutomationEvents() {
  ensureUltimateAutomationLayout();
  renderRuleOpenDays();
  setLocationRulesEditorOpen(false);
  $("createLocationRulesButton")?.addEventListener("click", createLocationRules);
  $("locationRulesForm")?.addEventListener("submit", saveLocationRules);
  $("ruleOpenDays")?.addEventListener("click", (event) => {
    const button = event.target.closest(".dotDay");
    if (!button) return;
    button.classList.toggle("active");
    button.setAttribute("aria-pressed", button.classList.contains("active"));
  });
  $("saveDraftScheduleButton")?.addEventListener("click", () => saveScheduleState("draft"));
  $("publishScheduleButton")?.addEventListener("click", () => saveScheduleState("published"));
  $("reviseScheduleButton")?.addEventListener("click", () => saveScheduleState("revised"));
  $("refreshOpenShiftsButton")?.addEventListener("click", loadOpenShifts);
  $("refreshLaborButton")?.addEventListener("click", loadLaborForecast);
  $("refreshApprovalQueueButton")?.addEventListener("click", loadApprovalQueue);
  $("managerForecastShortcutButton")?.addEventListener("click", () => scrollToSectionForNav("schedulePanel"));
  $("showSwapRequestButton")?.addEventListener("click", () => {
    if (timeOffSettings.shiftSwapsEnabled === false) {
      setNotice("timeOffFormMessage", "error", "Shift cover and swap requests are currently turned off by the owner.");
      return;
    }
    $("swapRequestForm")?.classList.remove("hidden");
  });
  $("cancelSwapRequestButton")?.addEventListener("click", () => $("swapRequestForm")?.classList.add("hidden"));
  $("swapRequestForm")?.addEventListener("submit", submitSwapRequest);
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "employee-calendar-day") {
      const list = $("employeeScheduleList");
      if (list) list.dataset.selectedDate = button.dataset.date || "";
      await loadEmployeeSchedule();
      return;
    }
    if (button.dataset.action === "claim-open-shift") await claimOpenShift(button.dataset.id);
    if (button.dataset.action === "accept-swap") await decideSwap(button.dataset.id, "accept");
    if (button.dataset.action === "approve-swap") await decideSwap(button.dataset.id, "approve");
    if (button.dataset.action === "deny-swap") await decideSwap(button.dataset.id, "deny");
  });
}

document.addEventListener("DOMContentLoaded", setupUltimateAutomationEvents);
