const API_BASE_URL = "/api";
const PHYSICIAN_TOKEN_KEY = "heartTrackPhysicianToken";
const SELECTED_PATIENT_KEY = "heartTrackSelectedPatient";

let physicianToken = null;
let currentPhysician = null;
let physicianPatients = [];
let selectedPatientId = null;
let hrChartInstance = null;
let spo2ChartInstance = null;

const mapPhysician = (raw) => ({
  id: raw.id || raw._id,
  name: raw.name,
  email: raw.email,
  specialty: raw.specialty || "",
  practiceName: raw.practiceName || "",
});

const bootstrapPhysicianPortal = async () => {
  try {
    const [meRes, patientsRes] = await Promise.all([
      apiRequest("/physicians/me"),
      apiRequest("/physicians/patients"),
    ]);

    currentPhysician = mapPhysician(meRes.data);
    physicianNameDisplay.textContent = currentPhysician.name;
    physicianEmailDisplay.textContent = currentPhysician.email;

    selectedPatientId = getPersistedSelection();
    setPatients(patientsRes.data || []);
    if (selectedPatientId) {
      await loadDailyMetrics(selectedPatientId);
    }

    loginSection?.classList.add("hidden");
    portalSection?.classList.remove("hidden");
    setPortalView("patient-list-view");
  } catch (err) {
    alert(err.message || "Failed to initialize physician portal.");
    handlePhysicianLogout();
  }
};

const attemptTokenLogin = async () => {
  const storedToken = localStorage.getItem(PHYSICIAN_TOKEN_KEY);
  if (!storedToken) return;
  setPhysicianToken(storedToken);
  try {
    await bootstrapPhysicianPortal();
  } catch (err) {
    console.warn("Failed to restore physician session:", err.message);
    handlePhysicianLogout();
  }
};

const handlePhysicianLogout = () => {
  setPhysicianToken(null);
  currentPhysician = null;
  physicianPatients = [];
  selectedPatientId = null;
  persistSelectedPatient();
  destroyCharts();
  portalSection?.classList.add("hidden");
  loginSection?.classList.remove("hidden");
};

const setPhysicianToken = (token) => {
  physicianToken = token;
  if (token) {
    localStorage.setItem(PHYSICIAN_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(PHYSICIAN_TOKEN_KEY);
  }
};

const apiRequest = async (path, { method = "GET", body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (physicianToken) {
    headers.Authorization = `Bearer ${physicianToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    const err = new Error(payload.message || "Request failed");
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
};

const loginSection = document.getElementById("physician-auth");
const portalSection = document.getElementById("physician-app");
const loginForm = document.getElementById("physician-login-form");
const loginError = document.getElementById("physician-login-error");
const loginTabButton = document.getElementById("physician-login-tab");
const registerTabButton = document.getElementById("physician-register-tab");
const registerForm = document.getElementById("physician-register-form");
const registerNameInput = document.getElementById("physician-register-name");
const registerEmailInput = document.getElementById("physician-register-email");
const registerPasswordInput = document.getElementById(
  "physician-register-password"
);
const registerConfirmInput = document.getElementById(
  "physician-register-confirm"
);
const registerErrorText = document.getElementById("physician-register-error");
const registerSuccessText = document.getElementById(
  "physician-register-success"
);
const logoutButton = document.getElementById("physician-logout-button");
const navButtons = document.querySelectorAll(".portal-nav-button");
const portalViews = document.querySelectorAll(".physician-view");
const physicianNameDisplay = document.getElementById("physician-name-display");
const physicianEmailDisplay = document.getElementById(
  "physician-email-display"
);
const selectedPatientNameDisplay = document.getElementById(
  "selected-patient-name"
);
const patientCountPill = document.getElementById("patient-count-pill");
const patientRows = document.getElementById("physician-patient-rows");
const summaryEmptyState = document.getElementById("patient-summary-empty");
const summaryContent = document.getElementById("patient-summary-content");
const summaryName = document.getElementById("patient-summary-name");
const summaryEmail = document.getElementById("patient-summary-email");
const summaryAvg = document.getElementById("patient-summary-avg");
const summaryMin = document.getElementById("patient-summary-min");
const summaryMax = document.getElementById("patient-summary-max");
const frequencyForm = document.getElementById("physician-frequency-form");
const frequencySelect = document.getElementById("physician-frequency-select");
const dailyEmptyState = document.getElementById("patient-daily-empty");
const dailyContent = document.getElementById("patient-daily-content");
const hrMinText = document.getElementById("physician-hr-min");
const hrMaxText = document.getElementById("physician-hr-max");
const spo2MinText = document.getElementById("physician-spo2-min");
const spo2MaxText = document.getElementById("physician-spo2-max");
const hrChartCanvas = document.getElementById("physician-hr-chart");
const spo2ChartCanvas = document.getElementById("physician-spo2-chart");

const fallbackDailyData = {
  labels: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
  hr: [68, 72, 75, 78, 74, 70],
  spo2: [98, 99, 99, 98, 97, 98],
};

// Generates a pseudo-unique identifier for a new physician account.
const generatePhysicianId = () =>
  `phys-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// Validates the format of physician passwords.
const validatePhysicianPassword = (password) => {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long.",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one lowercase letter.",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one uppercase letter.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: "Password must include at least one number.",
    };
  }

  return { isValid: true };
};

// Displays a registration error message inline with the form.
const showRegisterError = (message) => {
  if (!registerErrorText) return;
  registerErrorText.textContent = message;
  registerErrorText.classList.remove("hidden");
  registerSuccessText?.classList.add("hidden");
};

// Displays a success banner once physician registration completes.
const showRegisterSuccess = (message) => {
  if (!registerSuccessText) return;
  registerSuccessText.textContent = message;
  registerSuccessText.classList.remove("hidden");
  registerErrorText?.classList.add("hidden");
};

// Hides any previous registration error or success feedback.
const clearRegisterMessages = () => {
  registerErrorText?.classList.add("hidden");
  registerSuccessText?.classList.add("hidden");
};

const AUTH_ACTIVE_TAB =
  "border-red-500 text-red-600 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm";
const AUTH_INACTIVE_TAB =
  "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm";

// Switches between the login and registration forms for physicians.
const switchAuthTab = (tab) => {
  if (!loginForm || !registerForm) return;

  if (tab === "register") {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    registerTabButton?.classList.remove(...AUTH_INACTIVE_TAB.split(" "));
    registerTabButton?.classList.add(...AUTH_ACTIVE_TAB.split(" "));
    loginTabButton?.classList.remove(...AUTH_ACTIVE_TAB.split(" "));
    loginTabButton?.classList.add(...AUTH_INACTIVE_TAB.split(" "));
  } else {
    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
    loginTabButton?.classList.remove(...AUTH_INACTIVE_TAB.split(" "));
    loginTabButton?.classList.add(...AUTH_ACTIVE_TAB.split(" "));
    registerTabButton?.classList.remove(...AUTH_ACTIVE_TAB.split(" "));
    registerTabButton?.classList.add(...AUTH_INACTIVE_TAB.split(" "));
  }

  loginError?.classList.add("hidden");
  clearRegisterMessages();
};

// Formats a BPM value for display, handling missing data.
const formatBpm = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-- bpm";
  return `${Math.round(value)} bpm`;
};

// Formats the measurement frequency text for the patient table.
const formatFrequency = (value) => {
  if (!value) return "User default";
  return `${value} min`;
};

const getPersistedSelection = () =>
  localStorage.getItem(SELECTED_PATIENT_KEY) || null;

const persistSelectedPatient = () => {
  if (selectedPatientId) {
    localStorage.setItem(SELECTED_PATIENT_KEY, selectedPatientId);
  } else {
    localStorage.removeItem(SELECTED_PATIENT_KEY);
  }
};

const setPatients = (patients = []) => {
  physicianPatients = patients;
  if (
    selectedPatientId &&
    !physicianPatients.some((p) => p.patientId === selectedPatientId)
  ) {
    selectedPatientId = null;
    persistSelectedPatient();
  }
  renderPatientList();
  renderPatientSummary();
  renderPatientDaily();
};

const getPatientsForPhysician = () => physicianPatients;

const getSelectedPatientRecord = () =>
  physicianPatients.find((p) => p.patientId === selectedPatientId) || null;

selectedPatientId = getPersistedSelection();

// Handles view switching in the physician portal sidebar.
const setPortalView = (viewId) => {
  portalViews.forEach((view) => view.classList.add("hidden"));
  navButtons.forEach((btn) => btn.classList.remove("active"));
  const activeView = document.getElementById(viewId);
  const activeButton = document.querySelector(
    `.portal-nav-button[data-view="${viewId}"]`
  );

  activeView?.classList.remove("hidden");
  activeButton?.classList.add("active");

  if (viewId === "patient-summary-view") {
    renderPatientSummary();
  }
  if (viewId === "patient-daily-view") {
    renderPatientDaily();
  }
};

// Updates the banner showing which patient is currently active.
const updateSelectedPatientBanner = () => {
  if (!selectedPatientNameDisplay) return;
  const patient = getSelectedPatientRecord();
  selectedPatientNameDisplay.textContent = patient
    ? `${patient.patientName} (${patient.patientEmail})`
    : "None selected";
};

// Renders the master patient table with metrics and actions.
const renderPatientList = () => {
  if (!patientRows || !patientCountPill) return;

  const patients = getPatientsForPhysician().sort((a, b) =>
    (a.patientName || "").localeCompare(b.patientName || "")
  );

  patientCountPill.textContent =
    patients.length === 1 ? "1 patient" : `${patients.length} patients`;

  if (!patients.length) {
    patientRows.innerHTML = `<tr>
      <td colspan="6" class="px-4 py-6 text-center text-gray-500">
        No patients have assigned you yet. Ask them to select you from their account settings.
      </td>
    </tr>`;
    selectedPatientId = null;
    persistSelectedPatient();
    updateSelectedPatientBanner();
    renderPatientSummary();
    renderPatientDaily();
    return;
  }

  if (
    selectedPatientId &&
    !patients.some((p) => p.patientId === selectedPatientId)
  ) {
    selectedPatientId = null;
    persistSelectedPatient();
  }

  patientRows.innerHTML = "";

  patients.forEach((patient) => {
    const row = document.createElement("tr");
    const isSelected = patient.patientId === selectedPatientId;
    if (isSelected) {
      row.classList.add("bg-red-50");
    }

    const actionButtonClass = isSelected
      ? "bg-gray-300 text-gray-600 cursor-default"
      : "bg-red-600 text-white hover:bg-red-700";

    row.innerHTML = `
      <td class="px-4 py-4">
        <div class="text-sm font-medium text-gray-900">${
          patient.patientName
        }</div>
        <div class="text-sm text-gray-500">${patient.patientEmail}</div>
      </td>
      <td class="px-4 py-4 text-sm text-gray-900">${formatBpm(
        patient.weeklyMetrics?.avg
      )}</td>
      <td class="px-4 py-4 text-sm text-gray-900">${formatBpm(
        patient.weeklyMetrics?.max
      )}</td>
      <td class="px-4 py-4 text-sm text-gray-900">${formatBpm(
        patient.weeklyMetrics?.min
      )}</td>
      <td class="px-4 py-4 text-sm text-gray-600">${formatFrequency(
        patient.measurementFrequency
      )}</td>
      <td class="px-4 py-4 text-right">
        <button class="select-patient-btn inline-flex items-center rounded-md border border-transparent px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${actionButtonClass}"
          data-patient-id="${patient.patientId}" ${
      isSelected ? "disabled" : ""
    }>
          ${isSelected ? "Selected" : "View"}
        </button>
      </td>
    `;

    patientRows.appendChild(row);
  });

  updateSelectedPatientBanner();
};

// Populates the weekly summary widgets for the selected patient.
const renderPatientSummary = () => {
  if (!summaryContent || !summaryEmptyState || !frequencySelect) return;
  const patient = getSelectedPatientRecord();

  if (!patient) {
    summaryContent.classList.add("hidden");
    summaryEmptyState.classList.remove("hidden");
    return;
  }

  summaryContent.classList.remove("hidden");
  summaryEmptyState.classList.add("hidden");
  summaryName.textContent = patient.patientName;
  summaryEmail.textContent = patient.patientEmail;
  summaryAvg.textContent = formatBpm(patient.weeklyMetrics?.avg);
  summaryMax.textContent = formatBpm(patient.weeklyMetrics?.max);
  summaryMin.textContent = formatBpm(patient.weeklyMetrics?.min);

  const freqValue = String(patient.measurementFrequency || 30);
  const optionExists = Array.from(frequencySelect.options).some(
    (opt) => opt.value === freqValue
  );
  frequencySelect.value = optionExists ? freqValue : "30";
};

// Destroys any existing trend charts before redrawing them.
const destroyCharts = () => {
  hrChartInstance?.destroy();
  spo2ChartInstance?.destroy();
  hrChartInstance = null;
  spo2ChartInstance = null;
};

const loadDailyMetrics = async (patientId, date = new Date()) => {
  if (!patientId) return;
  const isoDate = date.toISOString().split("T")[0];

  try {
    const res = await apiRequest(
      `/physicians/patients/${patientId}/daily?date=${isoDate}`
    );
    const patient = physicianPatients.find((p) => p.patientId === patientId);
    if (patient) {
      patient.dailyMetrics = res.data || { labels: [], hr: [], spo2: [] };
    }
  } catch (err) {
    console.error("Failed to load daily metrics:", err);
    throw err;
  }
};

// Builds the per-day trend charts and supporting stats for the active patient.
const renderPatientDaily = () => {
  if (
    !dailyContent ||
    !dailyEmptyState ||
    !hrMinText ||
    !hrMaxText ||
    !spo2MinText ||
    !spo2MaxText
  ) {
    return;
  }
  const patient = getSelectedPatientRecord();

  if (!patient) {
    dailyContent.classList.add("hidden");
    dailyEmptyState.classList.remove("hidden");
    destroyCharts();
    return;
  }

  dailyContent.classList.remove("hidden");
  dailyEmptyState.classList.add("hidden");

  const metrics = patient.dailyMetrics || fallbackDailyData;
  const labels = metrics.labels?.length
    ? metrics.labels
    : fallbackDailyData.labels;
  const hrData = metrics.hr?.length ? metrics.hr : fallbackDailyData.hr;
  const spo2Data = metrics.spo2?.length ? metrics.spo2 : fallbackDailyData.spo2;

  const hrMin = hrData.length ? Math.min(...hrData) : 0;
  const hrMax = hrData.length ? Math.max(...hrData) : 0;
  const spo2Min = spo2Data.length ? Math.min(...spo2Data) : 0;
  const spo2Max = spo2Data.length ? Math.max(...spo2Data) : 0;

  const formatValue = (value, unit) =>
    Number.isFinite(value) ? `${value} ${unit}` : `-- ${unit}`;

  hrMinText.textContent = formatValue(hrMin, "bpm");
  hrMaxText.textContent = formatValue(hrMax, "bpm");
  spo2MinText.textContent = formatValue(spo2Min, "%");
  spo2MaxText.textContent = formatValue(spo2Max, "%");

  destroyCharts();

  if (hrChartCanvas) {
    hrChartInstance = new Chart(hrChartCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Heart Rate",
            data: hrData,
            borderColor: "rgb(239, 68, 68)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: { responsive: true, scales: { y: { beginAtZero: false } } },
    });
  }

  if (spo2ChartCanvas) {
    spo2ChartInstance = new Chart(spo2ChartCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "SpO2",
            data: spo2Data,
            borderColor: "rgb(59, 130, 246)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: { responsive: true, scales: { y: { beginAtZero: false } } },
    });
  }
};

// Handles measurement frequency updates submitted by the physician.
const handleFrequencyUpdate = async (event) => {
  event.preventDefault();
  if (!selectedPatientId) {
    alert("Select a patient before updating the measurement plan.");
    return;
  }

  const newFrequency = Number(frequencySelect.value);
  if (!newFrequency || Number.isNaN(newFrequency)) {
    alert("Please enter a valid frequency.");
    return;
  }

  try {
    await apiRequest(`/physicians/patients/${selectedPatientId}/frequency`, {
      method: "PUT",
      body: { frequency: newFrequency },
    });

    const patient = getSelectedPatientRecord();
    if (patient) {
      patient.measurementFrequency = newFrequency;
    }

    renderPatientList();
    renderPatientSummary();
    alert("Measurement frequency updated.");
  } catch (err) {
    alert(err.message || "Unable to update frequency.");
  }
};

// Validates and stores a brand-new physician account in local storage.
const handlePhysicianRegister = async (event) => {
  event.preventDefault();
  clearRegisterMessages();

  const name = registerNameInput?.value.trim();
  const email = registerEmailInput?.value.trim().toLowerCase();
  const password = registerPasswordInput?.value;
  const confirmPassword = registerConfirmInput?.value;

  if (!name || !email || !password || !confirmPassword) {
    return showRegisterError("Please complete all fields.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showRegisterError("Please enter a valid email address.");
  }
  const validation = validatePhysicianPassword(password);
  if (!validation.isValid) {
    return showRegisterError(validation.message);
  }
  if (password !== confirmPassword) {
    return showRegisterError("Passwords do not match.");
  }

  try {
    const res = await apiRequest("/physicians/register", {
      method: "POST",
      body: { name, email, password },
    });
    setPhysicianToken(res.token);
    currentPhysician = res.physician;
    registerForm?.reset();
    showRegisterSuccess("Account created! Redirecting...");
    await bootstrapPhysicianPortal();
  } catch (err) {
    showRegisterError(err.message || "Registration failed.");
  }
};

// Authenticates a physician and launches the portal UI.
const handlePhysicianLogin = async (event) => {
  event.preventDefault();
  loginError?.classList.add("hidden");

  const email = document
    .getElementById("physician-login-email")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("physician-login-password").value;

  if (!email || !password) {
    loginError?.classList.remove("hidden");
    loginError.textContent = "Please provide email and password.";
    return;
  }

  try {
    const res = await apiRequest("/physicians/login", {
      method: "POST",
      body: { email, password },
    });
    setPhysicianToken(res.token);
    currentPhysician = res.physician;
    await bootstrapPhysicianPortal();
  } catch (err) {
    loginError?.classList.remove("hidden");
    loginError.textContent = err.message || "Invalid credentials.";
  }
};

patientRows?.addEventListener("click", async (event) => {
  const button = event.target.closest(".select-patient-btn");
  if (!button) return;

  const patientId = button.dataset.patientId;
  if (!patientId || patientId === selectedPatientId) {
    setPortalView("patient-summary-view");
    return;
  }

  selectedPatientId = patientId;
  persistSelectedPatient();

  try {
    await loadDailyMetrics(patientId);
  } catch (err) {
    console.warn("Failed to load daily metrics:", err.message);
  }

  renderPatientList();
  renderPatientSummary();
  renderPatientDaily();
  updateSelectedPatientBanner();
  setPortalView("patient-summary-view");
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.getAttribute("data-view");
    setPortalView(view);
  });
});

frequencyForm?.addEventListener("submit", handleFrequencyUpdate);
loginForm?.addEventListener("submit", handlePhysicianLogin);
registerForm?.addEventListener("submit", handlePhysicianRegister);
logoutButton?.addEventListener("click", handlePhysicianLogout);
loginTabButton?.addEventListener("click", () => switchAuthTab("login"));
registerTabButton?.addEventListener("click", () => switchAuthTab("register"));

const wantsRegister = window.location.hash === "#register";
switchAuthTab(wantsRegister ? "register" : "login");

window.addEventListener("hashchange", () => {
  if (window.location.hash === "#register") {
    switchAuthTab("register");
  } else {
    switchAuthTab("login");
  }
});
attemptTokenLogin();
