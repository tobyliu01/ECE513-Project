// prepare for backend API calls and app state management
const API_BASE_URL = "/api";
const TOKEN_KEY = "heartTrackToken";

let authToken = null;
let currentUser = null;
let currentDevices = [];
let weeklyMetrics = { avg: 0, min: 0, max: 0 };
let dailyMetrics = { labels: [], hr: [], spo2: [] };
let selectedDate = new Date(Date.now() - 7 * 60 * 60 * 1000);

let physicianDirectory = [];
const loadPhysicians = async () => {
  const res = await apiRequest("/physicians/public", {
    method: "GET",
    skipAuth: true,
  });
  physicianDirectory = res.data || [];
  return physicianDirectory;
};

// Persists the latest JWT token state so API calls stay authenticated.
const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

// Small wrapper around fetch that injects auth headers and JSON parsing.
const apiRequest = async (
  path,
  { method = "GET", body, skipAuth = false } = {}
) => {
  const headers = { "Content-Type": "application/json" };
  if (!skipAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = {};
  try {
    payload = await res.json();
  } catch (err) {
    // ignore JSON parse errors
  }

  if (!res.ok || payload.success === false) {
    const error = new Error(payload.message || "Request failed");
    error.status = res.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

// Normalizes the backend user payload into the shape expected by the UI.
const mapUser = (raw) => ({
  id: raw.id,
  email: raw.email,
  name: raw.name,
  settings: {
    frequency: raw.config?.frequency ?? 30,
    startTime: raw.config?.startTime ?? "08:00",
    endTime: raw.config?.endTime ?? "22:00",
  },
  physician: raw.physician
    ? {
        id: raw.physician.id,
        name: raw.physician.name,
        email: raw.physician.email,
        specialty: raw.physician.specialty,
        practiceName: raw.physician.practiceName,
        assignedAt: raw.physician.assignedAt,
      }
    : null,
});

// Converts a device document into the simplified UI representation.
const mapDevice = (device) => ({
  id: device.deviceId,
  mongoId: device.mongoId || device._id,
  name: device.name,
});

// Clears all cached user/device/metric state when logging out or failing auth.
const resetAppState = () => {
  currentUser = null;
  currentDevices = [];
  weeklyMetrics = { avg: 0, min: 0, max: 0 };
  dailyMetrics = { labels: [], hr: [], spo2: [] };
  selectedDate = new Date(Date.now() - 7 * 60 * 60 * 1000);
};

// Fetches user profile, devices, and metrics before showing the dashboard.
const bootstrapApp = async (seedUser) => {
  const today = formatLocalDateInputValue(selectedDate);

  const [userRes, deviceRes, weeklyRes, dailyRes] = await Promise.all([
    seedUser ? Promise.resolve({ data: seedUser }) : apiRequest("/account/me"),
    apiRequest("/account/devices"),
    apiRequest("/measurements/weekly"),
    apiRequest(`/measurements/daily?date=${today}`),
  ]);

  const userPayload = userRes.data || userRes.user || seedUser;
  currentUser = mapUser(userPayload);
  currentDevices = (deviceRes.data || []).map(mapDevice);
  weeklyMetrics = weeklyRes.data || weeklyMetrics;
  dailyMetrics = dailyRes.data || dailyMetrics;

  authContainer.classList.add("hidden");
  appContainer.classList.remove("hidden");

  // syncPatientAssignmentData();
  initializeApp();
};

// ------------------------- MOCK CHART DATA -------------------------
const mockDailyData = {
  labels: [
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
  ],
  hr: [72, 75, 74, 65, 68, 70, 88, 92, 85],
  spo2: [98, 99, 98, 97, 96, 97, 98, 99, 98],
};
const mockWeeklyData = { avg: 76, min: 65, max: 92 };
// -------------------------------------------------------------------

// Chart variables
let hrChartInstance = null;
let spo2ChartInstance = null;

// DOM elements
const authContainer = document.getElementById("auth-container");
const appContainer = document.getElementById("app-container");
const mainViews = document.querySelectorAll(".main-view");
const navButtons = document.querySelectorAll(".nav-button");

// Authentication elements
const loginTabButton = document.getElementById("login-tab-button");
const signupTabButton = document.getElementById("signup-tab-button");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const logoutButton = document.getElementById("logout-button");

// Login fields
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

// Signup fields
const signupEmail = document.getElementById("signup-email");
const signupDeviceId = document.getElementById("signup-device-id");
const signupPassword = document.getElementById("signup-password");
const signupConfirmPassword = document.getElementById(
  "signup-confirm-password"
);
const signupEmailError = document.getElementById("signup-email-error");
const signupPasswordError = document.getElementById("signup-password-error");
const signupConfirmError = document.getElementById("signup-confirm-error");

// Data view fields
const weeklyTabButton = document.getElementById("weekly-tab-button");
const dailyTabButton = document.getElementById("daily-tab-button");
const weeklyViewContent = document.getElementById("weekly-view-content");
const dailyViewContent = document.getElementById("daily-view-content");
const dailyDatePicker = document.getElementById("daily-date-picker");
const weeklyDateRangeText = document.getElementById("weekly-date-range");

if (dailyDatePicker) {
  dailyDatePicker.value = formatLocalDateInputValue(selectedDate);
}

// Device list fields
const deviceList = document.getElementById("device-list");
const addDeviceForm = document.getElementById("add-device-form");

// Account setting fields
const accountSettingsForm = document.getElementById("account-settings-form");
const measurementSettingsForm = document.getElementById(
  "measurement-settings-form"
);
const physicianSelectionForm = document.getElementById(
  "physician-selection-form"
);
const physicianSelect = document.getElementById("physician-select");
const physicianStatusText = document.getElementById("physician-status-text");

// Settings fields
const accountPassword = document.getElementById("account-password");
const accountConfirmPassword = document.getElementById(
  "account-confirm-password"
);

// Create and load LUCIDE icon
const createIcon = (name, size = 20) => {
  const icon = lucide.icons[name];
  if (!icon) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = icon[2];
  return svg;
};

document
  .getElementById("icon-dashboard")
  .appendChild(createIcon("LayoutDashboard"));
document.getElementById("icon-device").appendChild(createIcon("Smartphone"));
document.getElementById("icon-settings").appendChild(createIcon("Settings"));
document.getElementById("icon-logout").appendChild(createIcon("LogOut"));

// Set input error messages
function setInputError(inputEl, errorEl, message) {
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }
  inputEl.classList.add("input-error");
}

// Clear input error messages
function clearInputError(inputEl, errorEl) {
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }
  inputEl.classList.remove("input-error");
}

// Validate an email format
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Validate a password's format
function validatePassword(password) {
  // Length >= 8
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long.",
    };
  }

  // Lowercase letter >= 1
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Must contain at least one lowercase letter.",
    };
  }

  // Uppercase letter >= 1
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Must contain at least one uppercase letter.",
    };
  }

  // Number >= 1
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: "Must contain at least one number." };
  }

  return { isValid: true, message: "" };
}

// Switch between login and signup tabs
function switchAuthTab(tab) {
  clearInputError(loginPassword, loginError);
  clearInputError(signupEmail, signupEmailError);
  clearInputError(signupPassword, signupPasswordError);
  clearInputError(signupConfirmPassword, signupConfirmError);

  if (tab === "login") {
    loginTabButton.className =
      "border-red-500 text-red-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
    signupTabButton.className =
      "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
  } else {
    loginTabButton.className =
      "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
    signupTabButton.className =
      "border-red-500 text-red-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
    loginForm.classList.add("hidden");
    signupForm.classList.remove("hidden");
  }
}

// Handle login button
async function handleLogin(e) {
  e.preventDefault();
  clearInputError(loginPassword, loginError);

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    setInputError(
      loginPassword,
      loginError,
      "Please enter email and password."
    );
    return;
  }

  try {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });

    setAuthToken(response.token);
    await bootstrapApp(response.user);
  } catch (err) {
    if (err.status === 404) {
      alert(err.message || "No account found with this email.");
      return;
    }
    setInputError(
      loginPassword,
      loginError,
      err.message || "Login failed. Please try again."
    );
  }
}

// Handle signup button
async function handleSignup(e) {
  e.preventDefault();
  clearInputError(signupEmail, signupEmailError);
  clearInputError(signupPassword, signupPasswordError);
  clearInputError(signupConfirmPassword, signupConfirmError);

  const email = signupEmail.value.trim();
  const password = signupPassword.value;
  const confirmPassword = signupConfirmPassword.value;
  const deviceId = signupDeviceId.value.trim();

  if (!email || !password || !deviceId) {
    alert("Error: Please fill in all fields (Email, Device ID, and Password).");
    return;
  }

  if (!validateEmail(email)) {
    setInputError(
      signupEmail,
      signupEmailError,
      "Please enter a valid email address."
    );
    return;
  }

  const validation = validatePassword(password);
  if (!validation.isValid) {
    setInputError(signupPassword, signupPasswordError, validation.message);
    return;
  }

  if (password !== confirmPassword) {
    setInputError(
      signupConfirmPassword,
      signupConfirmError,
      "Passwords do not match."
    );
    return;
  }

  try {
    const response = await apiRequest("/auth/register", {
      method: "POST",
      body: { email, password, deviceId },
      skipAuth: true,
    });

    setAuthToken(response.token);
    await bootstrapApp(response.user);
    alert("Sign up successful! You are now logged in.");
  } catch (err) {
    if (err.status === 409) {
      alert(err.message || "Account or device already exists.");
      return;
    }

    alert(`Signup failed: ${err.message || "Unexpected error."}`);
  }
}

// Handle logout button
function handleLogout() {
  resetAppState();
  setAuthToken(null);
  authContainer.classList.remove("hidden");
  appContainer.classList.add("hidden");
}

// Initialize the app page
function initializeApp() {
  showView("dashboard-view");
  loadWeeklySummary();
  initCharts();
  renderDeviceList();
  loadSettingsForms();
}

// Show dashboard view
function showView(viewId) {
  mainViews.forEach((view) => view.classList.add("hidden"));
  navButtons.forEach((button) => {
    button.classList.remove("bg-gray-700", "text-white");
    button.classList.add("hover:bg-gray-700", "hover:text-white");
  });
  document.getElementById(viewId).classList.remove("hidden");
  const activeButton = document.querySelector(
    `.nav-button[data-view="${viewId}"]`
  );
  activeButton.classList.add("bg-gray-700", "text-white");
  activeButton.classList.remove("hover:bg-gray-700", "hover:text-white");
}

// Switch between weekly and daily dashboards
function switchDashboardTab(tab) {
  if (tab === "weekly") {
    weeklyTabButton.className =
      "border-red-500 text-red-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
    dailyTabButton.className =
      "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
    weeklyViewContent.classList.remove("hidden");
    dailyViewContent.classList.add("hidden");
  } else {
    weeklyTabButton.className =
      "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
    dailyTabButton.className =
      "border-red-500 text-red-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm";
    weeklyViewContent.classList.add("hidden");
    dailyViewContent.classList.remove("hidden");
  }
}

// Build the "Past 7 Days" date range in the user's local time zone.
function formatWeeklyDateRange(now = new Date()) {
  const end = new Date(Date.now() - 7 * 60 * 60 * 1000);
  const start = new Date(Date.now() - 7 * 60 * 60 * 1000);
  start.setDate(end.getDate() - 6);

  const sameYear = start.getFullYear() === end.getFullYear();
  const startFormatter = new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const endFormatter = new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `Past 7 Days (${startFormatter.format(start)} - ${endFormatter.format(
    end
  )})`;
}

// Returns the default value of the date picker.
function formatLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Load user's weekly summary
function loadWeeklySummary() {
  const avg = Math.round(weeklyMetrics.avg || 0);
  const min = Math.round(weeklyMetrics.min || 0);
  const max = Math.round(weeklyMetrics.max || 0);

  if (weeklyDateRangeText) {
    weeklyDateRangeText.textContent = formatWeeklyDateRange();
  }

  document.getElementById(
    "weekly-avg-hr"
  ).innerHTML = `${avg} <span class="text-lg font-medium text-gray-600">bpm</span>`;
  document.getElementById(
    "weekly-min-hr"
  ).innerHTML = `${min} <span class="text-lg font-medium text-gray-600">bpm</span>`;
  document.getElementById(
    "weekly-max-hr"
  ).innerHTML = `${max} <span class="text-lg font-medium text-gray-600">bpm</span>`;
}

// Load user's daily metrics for the provided date and refresh charts.
async function loadDailyMetricsFor(dateString) {
  const targetDate = dateString || formatLocalDateInputValue(selectedDate);
  const response = await apiRequest(`/measurements/daily?date=${targetDate}`);
  dailyMetrics = response.data || { labels: [], hr: [], spo2: [] };
  selectedDate = new Date(`${targetDate}T00:00:00`);
  if (dailyDatePicker && dailyDatePicker.value !== targetDate) {
    dailyDatePicker.value = targetDate;
  }
  initCharts();
}

// Initialize the data chart
function initCharts() {
  if (hrChartInstance) hrChartInstance.destroy();
  if (spo2ChartInstance) spo2ChartInstance.destroy();

  const hrCtx = document.getElementById("hrChart").getContext("2d");
  const spo2Ctx = document.getElementById("spo2Chart").getContext("2d");

  const labels = dailyMetrics.labels || [];
  const hrData = dailyMetrics.hr || [];
  const spo2Data = dailyMetrics.spo2 || [];

  const hrMin = hrData.length ? Math.min(...hrData) : 0;
  const hrMax = hrData.length ? Math.max(...hrData) : 0;
  const spo2Min = spo2Data.length ? Math.min(...spo2Data) : 0;
  const spo2Max = spo2Data.length ? Math.max(...spo2Data) : 0;

  document.getElementById("hr-min-text").textContent = `${hrMin} bpm`;
  document.getElementById("hr-max-text").textContent = `${hrMax} bpm`;
  document.getElementById("spo2-min-text").textContent = `${spo2Min}%`;
  document.getElementById("spo2-max-text").textContent = `${spo2Max}%`;

  const createPointStyles = (data, minVal, maxVal) =>
    data.map((val) => {
      if (val === minVal) return "rgb(59, 130, 246)";
      if (val === maxVal) return "rgb(239, 68, 68)";
      return "rgba(239, 68, 68, 0.5)";
    });

  hrChartInstance = new Chart(hrCtx, {
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
          pointBackgroundColor: createPointStyles(hrData, hrMin, hrMax),
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: { responsive: true, scales: { y: { beginAtZero: false } } },
  });

  spo2ChartInstance = new Chart(spo2Ctx, {
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
          pointBackgroundColor: createPointStyles(spo2Data, spo2Min, spo2Max),
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: { responsive: true, scales: { y: { beginAtZero: false } } },
  });
}

async function handleDailyDateChange(e) {
  const newDate = e.target.value;
  if (!newDate) {
    e.target.value = formatLocalDateInputValue(selectedDate);
    return;
  }

  try {
    await loadDailyMetricsFor(newDate);
  } catch (err) {
    console.error("Failed to load measurements for", newDate, err);
    alert(err.message || "Failed to load measurements for selected date.");
    e.target.value = formatLocalDateInputValue(selectedDate);
  }
}

// Render device list
function renderDeviceList() {
  deviceList.innerHTML = "";

  if (!currentDevices.length) {
    deviceList.innerHTML = `<li class="p-6 text-center text-gray-500">No devices registered.</li>`;
    return;
  }

  currentDevices.forEach((device) => {
    const li = document.createElement("li");
    li.className = "px-6 py-4 flex items-center justify-between";
    li.innerHTML = `
      <div class="flex items-center flex-grow">
          <span id="icon-dev-${device.id}" class="text-gray-500"></span>
          <div class="ml-3">
              <p id="device-name-${device.id}" class="text-sm font-medium text-gray-900">${device.name}</p>
              <input id="device-edit-input-${device.id}" type="text" value="${device.name}" class="text-sm border-gray-300 rounded-md shadow-sm hidden w-3/4">
              <p class="text-sm text-gray-500">${device.id}</p>
          </div>
      </div>
      <div class="flex-shrink-0 space-x-2">
          <button data-id="${device.id}" data-mongo="${device.mongoId}" class="edit-device-btn rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Edit</button>
          <button data-id="${device.id}" data-mongo="${device.mongoId}" class="remove-device-btn rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500">Remove</button>
          <button data-id="${device.id}" data-mongo="${device.mongoId}" class="save-device-btn rounded-md bg-green-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 hidden">Save</button>
          <button data-id="${device.id}" class="cancel-edit-btn rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hidden">Cancel</button>
      </div>
    `;

    deviceList.appendChild(li);
    document
      .getElementById(`icon-dev-${device.id}`)
      .appendChild(createIcon("Smartphone"));
  });
}

// Handle button of adding a device
async function handleAddDevice(e) {
  e.preventDefault();
  const nameInput = document.getElementById("device-name");
  const idInput = document.getElementById("device-id");
  const name = nameInput.value.trim();
  const deviceId = idInput.value.trim();

  if (!name || !deviceId) {
    alert("Error: Please provide both device name and device ID.");
    return;
  }

  if (currentDevices.find((d) => d.id === deviceId)) {
    alert("Error: You have already registered a device with this ID.");
    return;
  }

  if (currentDevices.find((d) => d.name.toLowerCase() === name.toLowerCase())) {
    alert("Error: A device with this name already exists.");
    return;
  }

  try {
    const response = await apiRequest("/account/devices", {
      method: "POST",
      body: { deviceId, name },
    });

    currentDevices.push(mapDevice(response.data));
    renderDeviceList();
    nameInput.value = "";
    idInput.value = "";
  } catch (err) {
    alert(`Failed to add device: ${err.message}`);
  }
}

// Handle button of deleting a device
async function handleRemoveDevice(id) {
  const device = currentDevices.find((d) => d.id === id);
  if (!device) return;

  if (!confirm("Are you sure you want to remove this device?")) {
    return;
  }

  try {
    await apiRequest(`/account/devices/${device.mongoId}`, {
      method: "DELETE",
    });

    currentDevices = currentDevices.filter((d) => d.id !== id);
    renderDeviceList();
  } catch (err) {
    alert(`Failed to remove device: ${err.message}`);
  }
}

// Handle button of editing a device information
function toggleEditMode(id, isEditing) {
  const nameEl = document.getElementById(`device-name-${id}`);
  const inputEl = document.getElementById(`device-edit-input-${id}`);
  const li = nameEl.closest("li");
  const editBtn = li.querySelector(".edit-device-btn");
  const removeBtn = li.querySelector(".remove-device-btn");
  const saveBtn = li.querySelector(".save-device-btn");
  const cancelBtn = li.querySelector(".cancel-edit-btn");

  if (isEditing) {
    nameEl.classList.add("hidden");
    editBtn.classList.add("hidden");
    removeBtn.classList.add("hidden");

    inputEl.classList.remove("hidden");
    saveBtn.classList.remove("hidden");
    cancelBtn.classList.remove("hidden");
  } else {
    nameEl.classList.remove("hidden");
    editBtn.classList.remove("hidden");
    removeBtn.classList.remove("hidden");

    inputEl.classList.add("hidden");
    saveBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");

    inputEl.value = nameEl.textContent;
  }
}

// Handle button of saving device information
async function handleSaveDevice(id) {
  const device = currentDevices.find((d) => d.id === id);
  if (!device) return;

  const inputEl = document.getElementById(`device-edit-input-${id}`);
  const newName = inputEl.value.trim();

  if (!newName) {
    alert("Error: Device name cannot be empty.");
    return;
  }

  if (
    currentDevices.find(
      (d) => d.name.toLowerCase() === newName.toLowerCase() && d.id !== id
    )
  ) {
    alert("Error: A device with this name already exists.");
    return;
  }

  try {
    const response = await apiRequest(`/account/devices/${device.mongoId}`, {
      method: "PUT",
      body: { name: newName },
    });

    device.name = response.data.name;
    renderDeviceList();
  } catch (err) {
    alert(`Failed to update device: ${err.message}`);
  }
}

// Load account settings forms
function loadSettingsForms() {
  if (!currentUser) return;

  document.getElementById("user-name-display").textContent = currentUser.name;
  document.getElementById("user-email-display").textContent = currentUser.email;
  document.getElementById("account-name").value = currentUser.name;
  document.getElementById("account-email").value = currentUser.email;
  document.getElementById("measurement-frequency").value =
    currentUser.settings.frequency;
  document.getElementById("measurement-start").value =
    currentUser.settings.startTime;
  document.getElementById("measurement-end").value =
    currentUser.settings.endTime;
  renderPhysicianOptions();
}

async function renderPhysicianOptions() {
  if (!physicianSelect || !physicianStatusText) return;

  const physicians = await loadPhysicians();
  const currentAssignment = getCurrentAssignment();

  physicianSelect.innerHTML =
    '<option value="">Select from registered physicians</option>';

  physicians.forEach((doctor) => {
    const option = document.createElement("option");
    option.value = doctor.id;
    option.textContent = `${doctor.name} (${doctor.email})`;
    if (currentAssignment?.id === doctor.id) {
      option.selected = true;
    }
    physicianSelect.appendChild(option);
  });

  physicianSelect.disabled = !physicians.length;

  if (!physicians.length) {
    physicianStatusText.textContent =
      "No physicians registered yet. Share the link below.";
  } else if (currentAssignment) {
    physicianStatusText.textContent = `${currentAssignment.name} (${currentAssignment.email})`;
  } else {
    physicianStatusText.textContent = "No physician selected";
  }
}

// Pushes the latest user metrics/settings into their physician record.
async function handlePhysicianSelection(e) {
  e.preventDefault();
  if (!currentUser || !physicianSelect) return;

  const selectedPhysicianId = physicianSelect.value;
  console.log("selected physician:", selectedPhysicianId);
  console.log("authToken:", authToken);

  try {
    const response = selectedPhysicianId
      ? await apiRequest("/account/physician", {
          method: "PUT",
          body: { physicianId: selectedPhysicianId },
        })
      : await apiRequest("/account/physician", { method: "DELETE" });

    currentUser = mapUser(response.data);
    await renderPhysicianOptions();
    alert(
      selectedPhysicianId
        ? "Physician selection saved."
        : "Physician assignment cleared."
    );
  } catch (err) {
    alert(err.message || "Failed to update physician assignment.");
  }
}

// Handle button of saving account profile
async function handleSaveAccount(e) {
  e.preventDefault();
  const newName = document.getElementById("account-name").value.trim();
  const newPassword = accountPassword.value;
  const confirmNewPassword = accountConfirmPassword.value;

  if (!newName) {
    alert("Error: Name cannot be empty.");
    return;
  }

  if (newPassword || confirmNewPassword) {
    if (newPassword !== confirmNewPassword) {
      alert("Error: New passwords do not match.");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      alert(`Invalid new password: ${validation.message}`);
      return;
    }
  }

  try {
    const response = await apiRequest("/account/me", {
      method: "PUT",
      body: {
        name: newName,
        password: newPassword || undefined,
      },
    });

    currentUser = mapUser(response.data);
    loadSettingsForms();
    accountPassword.value = "";
    accountConfirmPassword.value = "";
    alert("Account details saved!");
  } catch (err) {
    alert(`Failed to update account: ${err.message}`);
  }
}

// Handle button of saving measurement settings
async function handleSaveMeasurements(e) {
  e.preventDefault();

  const payload = {
    frequency: Number(document.getElementById("measurement-frequency").value),
    startTime: document.getElementById("measurement-start").value,
    endTime: document.getElementById("measurement-end").value,
  };

  try {
    const response = await apiRequest("/account/config", {
      method: "PUT",
      body: payload,
    });

    currentUser.settings = {
      frequency: response.data.frequency,
      startTime: response.data.startTime,
      endTime: response.data.endTime,
    };

    // syncPatientAssignmentData();

    alert("Measurement settings saved!");
  } catch (err) {
    alert(`Failed to update settings: ${err.message}`);
  }
}

// MAIN LOGIC
document.addEventListener("DOMContentLoaded", async () => {
  // Load the database from mgdb
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) {
    setAuthToken(storedToken);
    try {
      await bootstrapApp();
    } catch (err) {
      console.warn("Auto-login failed:", err.message);
      handleLogout();
    }
  }

  loginTabButton.addEventListener("click", () => switchAuthTab("login"));
  signupTabButton.addEventListener("click", () => switchAuthTab("signup"));
  loginForm.addEventListener("submit", handleLogin);
  signupForm.addEventListener("submit", handleSignup);
  logoutButton.addEventListener("click", handleLogout);

  // Email/Password validation listeners
  signupEmail.addEventListener("input", () => {
    if (!validateEmail(signupEmail.value)) {
      setInputError(
        signupEmail,
        signupEmailError,
        "Please enter a valid email address."
      );
    } else {
      clearInputError(signupEmail, signupEmailError);
    }
  });
  signupPassword.addEventListener("input", () => {
    const password = signupPassword.value;
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setInputError(signupPassword, signupPasswordError, validation.message);
    } else {
      clearInputError(signupPassword, signupPasswordError);
    }
  });
  signupConfirmPassword.addEventListener("input", () => {
    const password = signupPassword.value;
    const confirmPassword = signupConfirmPassword.value;
    if (password !== confirmPassword) {
      setInputError(
        signupConfirmPassword,
        signupConfirmError,
        "Passwords do not match."
      );
    } else {
      clearInputError(signupConfirmPassword, signupConfirmError);
    }
  });

  // Buttons' listeners on the app page
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const viewId = button.getAttribute("data-view");
      showView(viewId);
    });
  });
  weeklyTabButton.addEventListener("click", () => switchDashboardTab("weekly"));
  dailyTabButton.addEventListener("click", () => switchDashboardTab("daily"));
  if (dailyDatePicker) {
    dailyDatePicker.addEventListener("change", handleDailyDateChange);
  }
  addDeviceForm.addEventListener("submit", handleAddDevice);

  // Updated device list listener
  deviceList.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;

    const id = button.dataset.id;

    if (button.classList.contains("remove-device-btn")) {
      handleRemoveDevice(id);
    } else if (button.classList.contains("edit-device-btn")) {
      toggleEditMode(id, true);
    } else if (button.classList.contains("save-device-btn")) {
      handleSaveDevice(id);
    } else if (button.classList.contains("cancel-edit-btn")) {
      toggleEditMode(id, false);
    }
  });

  accountSettingsForm.addEventListener("submit", handleSaveAccount);
  measurementSettingsForm.addEventListener("submit", handleSaveMeasurements);
  if (physicianSelectionForm) {
    physicianSelectionForm.addEventListener("submit", handlePhysicianSelection);
    renderPhysicianOptions();
  }
});
