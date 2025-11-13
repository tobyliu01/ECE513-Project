const PHYSICIANS_STORAGE_KEY = "heartTrackPhysicians";
const PATIENT_ASSIGNMENTS_KEY = "heartTrackPhysicianAssignments";
const PHYSICIAN_SESSION_KEY = "heartTrackPhysicianSession";
const SELECTED_PATIENT_KEY = "heartTrackSelectedPatient";

let currentPhysician = null;
let selectedPatientId = null;
let hrChartInstance = null;
let spo2ChartInstance = null;

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
const physicianEmailDisplay = document.getElementById("physician-email-display");
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

const generatePhysicianId = () =>
  `phys-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

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

const showRegisterError = (message) => {
  if (!registerErrorText) return;
  registerErrorText.textContent = message;
  registerErrorText.classList.remove("hidden");
  registerSuccessText?.classList.add("hidden");
};

const showRegisterSuccess = (message) => {
  if (!registerSuccessText) return;
  registerSuccessText.textContent = message;
  registerSuccessText.classList.remove("hidden");
  registerErrorText?.classList.add("hidden");
};

const clearRegisterMessages = () => {
  registerErrorText?.classList.add("hidden");
  registerSuccessText?.classList.add("hidden");
};

const AUTH_ACTIVE_TAB =
  "border-red-500 text-red-600 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm";
const AUTH_INACTIVE_TAB =
  "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm";

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

const getStoredPhysicians = () => {
  try {
    return JSON.parse(localStorage.getItem(PHYSICIANS_STORAGE_KEY)) || [];
  } catch (err) {
    console.warn("Unable to parse physician storage:", err);
    return [];
  }
};

const savePhysicians = (payload) => {
  localStorage.setItem(PHYSICIANS_STORAGE_KEY, JSON.stringify(payload));
};

const getAssignments = () => {
  try {
    return JSON.parse(localStorage.getItem(PATIENT_ASSIGNMENTS_KEY)) || {};
  } catch (err) {
    console.warn("Unable to parse patient assignments:", err);
    return {};
  }
};

const saveAssignments = (payload) => {
  localStorage.setItem(PATIENT_ASSIGNMENTS_KEY, JSON.stringify(payload));
};

const getSelectedPatientMap = () => {
  try {
    return JSON.parse(localStorage.getItem(SELECTED_PATIENT_KEY)) || {};
  } catch (err) {
    console.warn("Unable to parse selected patient storage:", err);
    return {};
  }
};

const persistSelectedPatient = () => {
  if (!currentPhysician) return;
  const map = getSelectedPatientMap();
  if (selectedPatientId) {
    map[currentPhysician.id] = selectedPatientId;
  } else {
    delete map[currentPhysician.id];
  }
  localStorage.setItem(SELECTED_PATIENT_KEY, JSON.stringify(map));
};

const getPatientsForPhysician = () => {
  if (!currentPhysician) return [];
  const assignments = getAssignments();
  return Object.values(assignments).filter(
    (entry) => entry.physicianId === currentPhysician.id
  );
};

const formatBpm = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-- bpm";
  return `${Math.round(value)} bpm`;
};

const formatFrequency = (value) => {
  if (!value) return "User default";
  return `${value} min`;
};

const getSelectedPatientRecord = () => {
  if (!selectedPatientId) return null;
  const assignments = getAssignments();
  const entry = assignments[selectedPatientId];
  if (!entry || entry.physicianId !== currentPhysician?.id) return null;
  return entry;
};

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

const updateSelectedPatientBanner = () => {
  if (!selectedPatientNameDisplay) return;
  const patient = getSelectedPatientRecord();
  selectedPatientNameDisplay.textContent = patient
    ? `${patient.patientName} (${patient.patientEmail})`
    : "None selected";
};

const renderPatientList = () => {
  if (!patientRows || !patientCountPill) return;

  const patients = getPatientsForPhysician().sort((a, b) =>
    (a.patientName || "").localeCompare(b.patientName || "")
  );

  patientCountPill.textContent =
    patients.length === 1
      ? "1 patient"
      : `${patients.length} patients`;

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
        <div class="text-sm font-medium text-gray-900">${patient.patientName}</div>
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

const destroyCharts = () => {
  hrChartInstance?.destroy();
  spo2ChartInstance?.destroy();
  hrChartInstance = null;
  spo2ChartInstance = null;
};

const renderPatientDaily = () => {
  if (
    !dailyContent ||
    !dailyEmptyState ||
    !hrMinText ||
    !hrMaxText ||
    !spo2MinText ||
    !spo2MaxText
  )
    return;
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
  const labels = metrics.labels?.length ? metrics.labels : fallbackDailyData.labels;
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

const handlePatientSelection = (patientId) => {
  if (!patientId || !currentPhysician) return;
  selectedPatientId = patientId;
  persistSelectedPatient();
  updateSelectedPatientBanner();
  renderPatientList();
  renderPatientSummary();
  renderPatientDaily();
  setPortalView("patient-summary-view");
};

const handleFrequencyUpdate = (event) => {
  event.preventDefault();
  if (!selectedPatientId) {
    alert("Select a patient before updating the measurement plan.");
    return;
  }

  const assignments = getAssignments();
  const entry = assignments[selectedPatientId];
  if (!entry) {
    alert("Patient record was not found.");
    return;
  }

  entry.measurementFrequency = Number(frequencySelect.value);
  assignments[selectedPatientId] = entry;
  saveAssignments(assignments);
  renderPatientList();
  alert("Measurement frequency updated for this patient.");
};

const handlePhysicianRegister = (event) => {
  event.preventDefault();
  clearRegisterMessages();

  const name = registerNameInput?.value.trim();
  const email = registerEmailInput?.value.trim().toLowerCase();
  const password = registerPasswordInput?.value;
  const confirmPassword = registerConfirmInput?.value;

  if (!name || !email || !password || !confirmPassword) {
    showRegisterError("Please complete all fields.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showRegisterError("Please enter a valid email address.");
    return;
  }

  const passwordCheck = validatePhysicianPassword(password);
  if (!passwordCheck.isValid) {
    showRegisterError(passwordCheck.message);
    return;
  }

  if (password !== confirmPassword) {
    showRegisterError("Passwords do not match.");
    return;
  }

  const physicians = getStoredPhysicians();
  if (physicians.some((doc) => doc.email === email)) {
    showRegisterError("An account with this email already exists.");
    return;
  }

  physicians.push({
    id: generatePhysicianId(),
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
  });

  savePhysicians(physicians);
  registerForm?.reset();
  showRegisterSuccess("Registration successful! Please sign in.");
  setTimeout(() => {
    clearRegisterMessages();
    switchAuthTab("login");
  }, 1600);
};

const handlePhysicianLogin = (event) => {
  event.preventDefault();
  loginError?.classList.add("hidden");

  const email = document
    .getElementById("physician-login-email")
    .value.trim()
    .toLowerCase();
  const password = document
    .getElementById("physician-login-password")
    .value;

  const physicians = getStoredPhysicians();
  const physician = physicians.find(
    (doc) => doc.email === email && doc.password === password
  );

  if (!physician) {
    loginError?.classList.remove("hidden");
    return;
  }

  currentPhysician = physician;
  localStorage.setItem(PHYSICIAN_SESSION_KEY, physician.id);
  loginSection?.classList.add("hidden");
  portalSection?.classList.remove("hidden");
  physicianNameDisplay.textContent = physician.name;
  physicianEmailDisplay.textContent = physician.email;
  const map = getSelectedPatientMap();
  if (map[physician.id]) {
    selectedPatientId = map[physician.id];
  } else {
    selectedPatientId = null;
  }
  renderPatientList();
  updateSelectedPatientBanner();
  renderPatientSummary();
  renderPatientDaily();
  setPortalView("patient-list-view");
};

const attemptSessionLogin = () => {
  const storedId = localStorage.getItem(PHYSICIAN_SESSION_KEY);
  if (!storedId) return;
  const physicians = getStoredPhysicians();
  const physician = physicians.find((doc) => doc.id === storedId);
  if (!physician) {
    localStorage.removeItem(PHYSICIAN_SESSION_KEY);
    return;
  }
  currentPhysician = physician;
  loginSection?.classList.add("hidden");
  portalSection?.classList.remove("hidden");
  physicianNameDisplay.textContent = physician.name;
  physicianEmailDisplay.textContent = physician.email;
  const map = getSelectedPatientMap();
  selectedPatientId = map[physician.id] || null;
  renderPatientList();
  updateSelectedPatientBanner();
  renderPatientSummary();
  renderPatientDaily();
  setPortalView("patient-list-view");
};

const handleLogout = () => {
  currentPhysician = null;
  selectedPatientId = null;
  destroyCharts();
  portalSection?.classList.add("hidden");
  loginSection?.classList.remove("hidden");
  localStorage.removeItem(PHYSICIAN_SESSION_KEY);
};

patientRows?.addEventListener("click", (event) => {
  const button = event.target.closest(".select-patient-btn");
  if (!button) return;
  handlePatientSelection(button.dataset.patientId);
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
logoutButton?.addEventListener("click", handleLogout);
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

window.addEventListener("storage", (event) => {
  if (event.key !== PATIENT_ASSIGNMENTS_KEY || !currentPhysician) return;
  renderPatientList();
  updateSelectedPatientBanner();
  renderPatientSummary();
  renderPatientDaily();
});

attemptSessionLogin();
