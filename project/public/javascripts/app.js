// --- CLIENT-SIDE DATABASE (Using localStorage) ---
const DB_KEY = "heartTrackDatabase";
let db = {
  users: {}, // This will hold all user accounts
};
let currentUser = null; // This will hold the logged-in user's data
let currentEmail = null; // This will hold the logged-in user's email (key)

// Load database from localStorage when the script starts
function loadDatabase() {
  const storedDb = localStorage.getItem(DB_KEY);
  if (storedDb) {
    db = JSON.parse(storedDb);
  } else {
    // If no DB, save the empty one
    saveDatabase();
  }
}

// Save the database to localStorage
function saveDatabase() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// --- PASSWORD HASHING (Using Web Crypto API) ---
// Helper to convert ArrayBuffer to hex string
function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

// Helper to convert hex string back to ArrayBuffer
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Generates a random 16-byte salt
async function generateSalt() {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(salt); // Store salt as a hex string
}

// Hashes a password with a given salt (as hex string)
async function hashPassword(password, saltHex) {
  const salt = hexToBytes(saltHex);
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    data,
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(hashBuffer));
}

// Verifies a password against a stored salt and hash
async function verifyPassword(password, saltHex, hashHex) {
  const newHashHex = await hashPassword(password, saltHex);
  return newHashHex === hashHex;
}

// --- MOCK CHART DATA (Unchanged) ---
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

// --- CHART VARIABLES ---
let hrChartInstance = null;
let spo2ChartInstance = null;

// --- DOM ELEMENTS ---
const authContainer = document.getElementById("auth-container");
const appContainer = document.getElementById("app-container");
const mainViews = document.querySelectorAll(".main-view");
const navButtons = document.querySelectorAll(".nav-button");

// Auth elements
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

// (Rest of DOM elements are the same...)
const weeklyTabButton = document.getElementById("weekly-tab-button");
const dailyTabButton = document.getElementById("daily-tab-button");
const weeklyViewContent = document.getElementById("weekly-view-content");
const dailyViewContent = document.getElementById("daily-view-content");
const deviceList = document.getElementById("device-list");
const addDeviceForm = document.getElementById("add-device-form");
const accountSettingsForm = document.getElementById("account-settings-form");
const measurementSettingsForm = document.getElementById(
  "measurement-settings-form"
);

// Settings fields
const accountPassword = document.getElementById("account-password");
const accountConfirmPassword = document.getElementById(
  "account-confirm-password"
); // <-- ADDED

// --- LUCIDE ICONS ---
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

// --- VALIDATION & ERROR HELPERS ---
function setInputError(inputEl, errorEl, message) {
  // Ensure errorEl exists before trying to set its textContent
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }
  inputEl.classList.add("input-error");
}

function clearInputError(inputEl, errorEl) {
  // Ensure errorEl exists
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
  }
  inputEl.classList.remove("input-error");
}

// Added email validation function
function validateEmail(email) {
  // Simple regex for email format
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePassword(password) {
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long.",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Must contain at least one lowercase letter.",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Must contain at least one uppercase letter.",
    };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: "Must contain at least one number." };
  }
  return { isValid: true, message: "" };
}

// --- API HELPER (REMOVED) ---

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  // Load the database from localStorage
  loadDatabase();

  // Auth Listeners
  loginTabButton.addEventListener("click", () => switchAuthTab("login"));
  signupTabButton.addEventListener("click", () => switchAuthTab("signup"));
  loginForm.addEventListener("submit", handleLogin);
  signupForm.addEventListener("submit", handleSignup);
  logoutButton.addEventListener("click", handleLogout);

  // Real-time Validation Listeners
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

  // (Rest of listeners are the same...)
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const viewId = button.getAttribute("data-view");
      showView(viewId);
    });
  });
  weeklyTabButton.addEventListener("click", () => switchDashboardTab("weekly"));
  dailyTabButton.addEventListener("click", () => switchDashboardTab("daily"));
  addDeviceForm.addEventListener("submit", handleAddDevice);
  deviceList.addEventListener("click", handleRemoveDevice);
  accountSettingsForm.addEventListener("submit", handleSaveAccount);
  measurementSettingsForm.addEventListener("submit", handleSaveMeasurements);
});

// --- AUTH FUNCTIONS (Using localStorage) ---
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

async function handleLogin(e) {
  e.preventDefault();
  clearInputError(loginPassword, loginError);

  const email = loginEmail.value;
  const password = loginPassword.value;

  // Req 6: Check if user exists
  const user = db.users[email];
  if (!user) {
    alert("Error: No account found with this email.");
    return;
  }

  // Req 7: Check password by verifying the hash
  const isValid = await verifyPassword(password, user.salt, user.hash);
  if (!isValid) {
    setInputError(
      loginPassword,
      loginError,
      "Incorrect password. Please try again."
    );
    return;
  }

  // Login Success
  currentUser = user;
  currentEmail = email;
  authContainer.classList.add("hidden");
  appContainer.classList.remove("hidden");

  // Load the app with the logged-in user's data
  initializeApp(user, email);
}

async function handleSignup(e) {
  e.preventDefault();
  // Clear all errors
  clearInputError(signupEmail, signupEmailError);
  clearInputError(signupPassword, signupPasswordError);
  clearInputError(signupConfirmPassword, signupConfirmError);

  const email = signupEmail.value;
  const password = signupPassword.value;
  const confirmPassword = signupConfirmPassword.value;
  const deviceId = signupDeviceId.value;

  // --- NEW VALIDATION (Req 1) ---
  if (!email || !password || !deviceId) {
    alert("Error: Please fill in all fields (Email, Device ID, and Password).");
    return;
  }

  // --- NEW VALIDATION (Req 2) ---
  if (!validateEmail(email)) {
    setInputError(
      signupEmail,
      signupEmailError,
      "Please enter a valid email address."
    );
    return;
  }

  // Req 4: Check if email exists
  if (db.users[email]) {
    alert("Error: This email is already registered. Please login.");
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

  // Req 5: Create new user with hashed password
  const salt = await generateSalt();
  const hash = await hashPassword(password, salt);

  const newUser = {
    name: email.split("@")[0],
    hash: hash, // Store the hash
    salt: salt, // Store the salt
    devices: [{ id: deviceId, name: "Initial Device" }], // Add the device
    settings: {
      frequency: "30",
      startTime: "08:00",
      endTime: "22:00",
    },
    // We will store measurements in the user object
    measurements: [],
  };

  db.users[email] = newUser;
  saveDatabase();

  // Sign up success
  alert("Sign up successful! You are now logged in.");

  // Log the user in
  currentUser = newUser;
  currentEmail = email;
  authContainer.classList.add("hidden");
  appContainer.classList.remove("hidden");

  // Load the app with the new user's data
  initializeApp(newUser, email);
}

function handleLogout() {
  currentUser = null;
  currentEmail = null;

  authContainer.classList.remove("hidden");
  appContainer.classList.add("hidden");

  if (hrChartInstance) hrChartInstance.destroy();
  if (spo2ChartInstance) spo2ChartInstance.destroy();
  hrChartInstance = null;
  spo2ChartInstance = null;
}

// --- APP INITIALIZATION ---
// This function loads all user data from the logged-in user object
function initializeApp(user, email) {
  showView("dashboard-view");
  loadWeeklySummary(user); // Switched to user object
  initCharts(user); // Switched to user object
  renderDeviceList(); // Uses global currentUser
  loadSettingsForms(user, email);
}

// --- VIEW NAVIGATION ---
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

// --- DASHBOARD FUNCTIONS (Now uses local data) ---
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

function loadWeeklySummary(user) {
  // This will use mock data for now, as we have no measurements
  // In a real version, we would calculate this from user.measurements

  // TODO: Add logic to calculate this from user.measurements array

  const avg = Math.round(mockWeeklyData.avg || 0);
  const min = Math.round(mockWeeklyData.min || 0);
  const max = Math.round(mockWeeklyData.max || 0);

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

function initCharts(user) {
  // This will use mock data for now

  // TODO: Add logic to pull data from user.measurements array

  if (hrChartInstance) hrChartInstance.destroy();
  if (spo2ChartInstance) spo2ChartInstance.destroy();
  const hrCtx = document.getElementById("hrChart").getContext("2d");
  const spo2Ctx = document.getElementById("spo2Chart").getContext("2d");
  const hrData = mockDailyData.hr;
  const spo2Data = mockDailyData.spo2;
  const hrMin = Math.min(...hrData);
  const hrMax = Math.max(...hrData);
  const spo2Min = Math.min(...spo2Data);
  const spo2Max = Math.max(...spo2Data);
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
      labels: mockDailyData.labels,
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
      labels: mockDailyData.labels,
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
    options: {
      responsive: true,
      scales: { y: { beginAtZero: false, min: 90, max: 100 } },
    },
  });
}

// --- DEVICE FUNCTIONS (Using local object) ---
function renderDeviceList() {
  deviceList.innerHTML = "";
  if (currentUser.devices.length === 0) {
    deviceList.innerHTML = `<li class="p-6 text-center text-gray-500">No devices registered.</li>`;
    return;
  }
  currentUser.devices.forEach((device) => {
    const li = document.createElement("li");
    li.className = "px-6 py-4 flex items-center justify-between";
    li.innerHTML = `
      <div class="flex items-center">
          <span id="icon-dev-${device.id}" class="text-gray-500"></span>
          <div class="ml-3">
              <p class="text-sm font-medium text-gray-900">${device.name}</p>
              <p class="text-sm text-gray-500">${device.id}</p>
          </div>
      </div>
      <button data-id="${device.id}" class="remove-device-btn rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Remove</button>
    `;
    deviceList.appendChild(li);
    document
      .getElementById(`icon-dev-${device.id}`)
      .appendChild(createIcon("Smartphone"));
  });
}

async function handleAddDevice(e) {
  e.preventDefault();
  const nameInput = document.getElementById("device-name");
  const idInput = document.getElementById("device-id");
  const name = nameInput.value;
  const deviceId = idInput.value;

  if (name && deviceId) {
    // Check if device ID is unique *for this user*
    if (currentUser.devices.find((d) => d.id === deviceId)) {
      alert("Error: You have already registered a device with this ID.");
      return;
    }

    currentUser.devices.push({ id: deviceId, name: name });
    saveDatabase(); // Save to localStorage
    renderDeviceList();
    nameInput.value = "";
    idInput.value = "";
  }
}

async function handleRemoveDevice(e) {
  if (e.target.classList.contains("remove-device-btn")) {
    const id = e.target.getAttribute("data-id");
    if (!confirm("Are you sure you want to remove this device?")) {
      return;
    }

    currentUser.devices = currentUser.devices.filter(
      (device) => device.id !== id
    );
    saveDatabase(); // Save to localStorage
    renderDeviceList();
  }
}

// --- SETTINGS FUNCTIONS (Using local object) ---
function loadSettingsForms(user, email) {
  document.getElementById("user-name-display").textContent = user.name;
  document.getElementById("user-email-display").textContent = email;
  document.getElementById("account-name").value = user.name;
  document.getElementById("account-email").value = email;
  document.getElementById("measurement-frequency").value =
    user.settings.frequency;
  document.getElementById("measurement-start").value = user.settings.startTime;
  document.getElementById("measurement-end").value = user.settings.endTime;
}

// ##### MODIFICATION HERE #####
async function handleSaveAccount(e) {
  e.preventDefault();
  const newName = document.getElementById("account-name").value;
  const newPassword = accountPassword.value;
  const confirmNewPassword = accountConfirmPassword.value;

  currentUser.name = newName;
  document.getElementById("user-name-display").textContent = newName;

  if (confirmNewPassword && !newPassword) {
    alert(`Enter new password!`);
    return;
  }

  if (newPassword) {
    // Check strength
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      alert(`Invalid new password: ${validation.message}`);
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmNewPassword) {
      alert("Error: New passwords do not match.");
      return;
    }

    // Re-hash and save new password
    const salt = await generateSalt();
    const hash = await hashPassword(newPassword, salt);
    currentUser.hash = hash;
    currentUser.salt = salt;
  }

  saveDatabase(); // Save to localStorage
  alert("Account details saved!");

  // Clear both password fields
  accountPassword.value = "";
  accountConfirmPassword.value = "";
}
// ###########################

async function handleSaveMeasurements(e) {
  e.preventDefault();

  currentUser.settings.frequency = document.getElementById(
    "measurement-frequency"
  ).value;
  currentUser.settings.startTime =
    document.getElementById("measurement-start").value;
  currentUser.settings.endTime =
    document.getElementById("measurement-end").value;

  saveDatabase(); // Save to localStorage
  alert("Measurement settings saved!");
}
