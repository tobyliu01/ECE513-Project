// --- MOCK LOCAL DATABASE ---
const DB_KEY = "heartTrackDatabase";
let db = {
  users: {},
};
let currentUser = null; // Logged-in user's data
let currentEmail = null; // Logged-in user's email

// Load database from local storage
function loadDatabase() {
  const storedDb = localStorage.getItem(DB_KEY);
  if (storedDb) {
    db = JSON.parse(storedDb);
  } else {
    // If no DB, save the empty one
    saveDatabase();
  }
}

// Save the database to local storage
function saveDatabase() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Convert ArrayBuffer to hex string
function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

// Convert hex string to ArrayBuffer
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Generate a random 16-byte salt
async function generateSalt() {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  return bytesToHex(salt);
}

// Hashe a password with a given hex-format salt
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

// Verify a password against a stored salt and hash
async function verifyPassword(password, saltHex, hashHex) {
  const newHashHex = await hashPassword(password, saltHex);
  return newHashHex === hashHex;
}

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

// Device list fields
const deviceList = document.getElementById("device-list");
const addDeviceForm = document.getElementById("add-device-form");

// Account setting fields
const accountSettingsForm = document.getElementById("account-settings-form");
const measurementSettingsForm = document.getElementById(
  "measurement-settings-form"
);

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

  const email = loginEmail.value;
  const password = loginPassword.value;

  // Check if the user exists
  const user = db.users[email];
  if (!user) {
    alert("Error: No account found with this email.");
    return;
  }

  // Check password by verifying the hash
  const isValid = await verifyPassword(password, user.salt, user.hash);
  if (!isValid) {
    setInputError(
      loginPassword,
      loginError,
      "Incorrect password. Please try again."
    );
    return;
  }

  currentUser = user;
  currentEmail = email;
  authContainer.classList.add("hidden");
  appContainer.classList.remove("hidden");

  // Load the app with the logged-in user's data
  initializeApp(user, email);
}

// Handle signup button
async function handleSignup(e) {
  e.preventDefault();
  clearInputError(signupEmail, signupEmailError);
  clearInputError(signupPassword, signupPasswordError);
  clearInputError(signupConfirmPassword, signupConfirmError);

  const email = signupEmail.value;
  const password = signupPassword.value;
  const confirmPassword = signupConfirmPassword.value;
  const deviceId = signupDeviceId.value;

  // Validate all fields are filled
  if (!email || !password || !deviceId) {
    alert("Error: Please fill in all fields (Email, Device ID, and Password).");
    return;
  }

  // Validate email format
  if (!validateEmail(email)) {
    setInputError(
      signupEmail,
      signupEmailError,
      "Please enter a valid email address."
    );
    return;
  }

  // Check if email exists
  if (db.users[email]) {
    alert("Error: This email is already registered. Please login.");
    return;
  }

  // Validate password format
  const validation = validatePassword(password);
  if (!validation.isValid) {
    setInputError(signupPassword, signupPasswordError, validation.message);
    return;
  }

  // Check if two passwords are matched
  if (password !== confirmPassword) {
    setInputError(
      signupConfirmPassword,
      signupConfirmError,
      "Passwords do not match."
    );
    return;
  }

  // Create new user data structure
  const salt = await generateSalt();
  const hash = await hashPassword(password, salt);
  const newUser = {
    name: email.split("@")[0],
    hash: hash,
    salt: salt,
    devices: [{ id: deviceId, name: "Initial Device" }],
    settings: {
      frequency: "30",
      startTime: "08:00",
      endTime: "22:00",
    },
    measurements: [],
  };

  db.users[email] = newUser;
  saveDatabase();

  alert("Sign up successful! You are now logged in.");
  currentUser = newUser;
  currentEmail = email;
  authContainer.classList.add("hidden");
  appContainer.classList.remove("hidden");

  // Load the app with the new user's data
  initializeApp(newUser, email);
}

// Handle logout button
function handleLogout() {
  currentUser = null;
  currentEmail = null;

  authContainer.classList.remove("hidden");
  appContainer.classList.add("hidden");

  if (hrChartInstance) {
    hrChartInstance.destroy();
  }
  if (spo2ChartInstance) {
    spo2ChartInstance.destroy();
  }
  hrChartInstance = null;
  spo2ChartInstance = null;
}

// Initialize the app page
function initializeApp(user, email) {
  showView("dashboard-view");
  loadWeeklySummary(user);
  initCharts(user);
  renderDeviceList();
  loadSettingsForms(user, email);
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

// Load user's weekly summary
function loadWeeklySummary(user) {
  // CURRENTLY: USE MOCK DATA
  // REAL VERSION: USE user.measurements

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

// Initialize the data chart
function initCharts(user) {
  // CURRENTLY: USE MOCK DATA
  // REAL VERSION: USE user.measurements

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

// Render device list
function renderDeviceList() {
  deviceList.innerHTML = "";
  if (currentUser.devices.length === 0) {
    deviceList.innerHTML = `<li class="p-6 text-center text-gray-500">No devices registered.</li>`;
    return;
  }
  currentUser.devices.forEach((device) => {
    const li = document.createElement("li");
    li.className = "px-6 py-4 flex items-center justify-between";

    // Create element content with placeholders
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
          <button data-id="${device.id}" class="edit-device-btn rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Edit</button>
          <button data-id="${device.id}" class="remove-device-btn rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500">Remove</button>
          
          <button data-id="${device.id}" class="save-device-btn rounded-md bg-green-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 hidden">Save</button>
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
  const name = nameInput.value;
  const deviceId = idInput.value;

  if (name && deviceId) {
    // Check if device ID exists
    if (currentUser.devices.find((d) => d.id === deviceId)) {
      alert("Error: You have already registered a device with this ID.");
      return;
    }

    // Check if device name exists
    if (
      currentUser.devices.find(
        (d) => d.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      alert("Error: A device with this name already exists.");
      return;
    }

    currentUser.devices.push({ id: deviceId, name: name });
    saveDatabase();
    renderDeviceList();
    nameInput.value = "";
    idInput.value = "";
  }
}

// Handle button of deleting a device
async function handleRemoveDevice(id) {
  if (!confirm("Are you sure you want to remove this device?")) {
    return;
  }

  currentUser.devices = currentUser.devices.filter(
    (device) => device.id !== id
  );
  saveDatabase();
  renderDeviceList();
}

// Handle button of editing a device information
function toggleEditMode(id, isEditing) {
  // Get all elements for this device row
  const nameEl = document.getElementById(`device-name-${id}`);
  const inputEl = document.getElementById(`device-edit-input-${id}`);

  // Find buttons within the list item
  const li = nameEl.closest("li");
  const editBtn = li.querySelector(".edit-device-btn");
  const removeBtn = li.querySelector(".remove-device-btn");
  const saveBtn = li.querySelector(".save-device-btn");
  const cancelBtn = li.querySelector(".cancel-edit-btn");

  if (isEditing) {
    // Show edit state
    nameEl.classList.add("hidden");
    editBtn.classList.add("hidden");
    removeBtn.classList.add("hidden");

    inputEl.classList.remove("hidden");
    saveBtn.classList.remove("hidden");
    cancelBtn.classList.remove("hidden");
  } else {
    // Show view state
    nameEl.classList.remove("hidden");
    editBtn.classList.remove("hidden");
    removeBtn.classList.remove("hidden");

    inputEl.classList.add("hidden");
    saveBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");

    // Reset input value to original name
    inputEl.value = nameEl.textContent;
  }
}

// Handle button of saving device information
function handleSaveDevice(id) {
  const inputEl = document.getElementById(`device-edit-input-${id}`);
  const newName = inputEl.value;

  // Check if the name is empty
  if (!newName.trim()) {
    alert("Error: Device name cannot be empty.");
    return;
  }

  // Check if the name exists
  const isDuplicate = currentUser.devices.find(
    (d) => d.name.toLowerCase() === newName.toLowerCase() && d.id !== id
  );
  if (isDuplicate) {
    alert("Error: A device with this name already exists.");
    return;
  }

  // Update the device information
  const deviceIndex = currentUser.devices.findIndex((d) => d.id === id);
  if (deviceIndex > -1) {
    currentUser.devices[deviceIndex].name = newName;
    saveDatabase();
    renderDeviceList();
  }
}

// Load account settings forms
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

// Handle button of saving account profile
async function handleSaveAccount(e) {
  e.preventDefault();
  const newName = document.getElementById("account-name").value;
  const newPassword = accountPassword.value;
  const confirmNewPassword = accountConfirmPassword.value;

  currentUser.name = newName;
  document.getElementById("user-name-display").textContent = newName;

  // Only validate and save password if user entered one
  if (newPassword) {
    // Check if two passwords match
    if (newPassword !== confirmNewPassword) {
      alert("Error: New passwords do not match.");
      return;
    }

    // Check new password's format
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      alert(`Invalid new password: ${validation.message}`);
      return;
    }

    // Re-hash and save new password
    const salt = await generateSalt();
    const hash = await hashPassword(newPassword, salt);
    currentUser.hash = hash;
    currentUser.salt = salt;
  } else if (confirmNewPassword) {
    alert("Error: Please enter a new password.");
    return;
  }

  saveDatabase();
  alert("Account details saved!");

  // Clear password fields
  accountPassword.value = "";
  accountConfirmPassword.value = "";
}

// Handle button of saving measurement settings
async function handleSaveMeasurements(e) {
  e.preventDefault();

  currentUser.settings.frequency = document.getElementById(
    "measurement-frequency"
  ).value;
  currentUser.settings.startTime =
    document.getElementById("measurement-start").value;
  currentUser.settings.endTime =
    document.getElementById("measurement-end").value;

  saveDatabase();
  alert("Measurement settings saved!");
}

// MAIN LOGIC
document.addEventListener("DOMContentLoaded", () => {
  // Load the database from local storage
  loadDatabase();

  // Login/Signup page listeners
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
});
