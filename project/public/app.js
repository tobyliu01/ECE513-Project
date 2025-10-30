// --- MOCK DATA ---
let mockSettings = {
    name: "Test User",
    email: "user@example.com",
    frequency: "30",
    startTime: "08:00",
    endTime: "22:00"
};

let mockDevices = [
    { id: "A1B2C3", name: "Main Monitor" },
    { id: "X4Y5Z6", name: "Portable Monitor" }
];

const mockDailyData = {
    labels: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"],
    hr: [72, 75, 74, 65, 68, 70, 88, 92, 85],
    spo2: [98, 99, 98, 97, 96, 97, 98, 99, 98]
};

const mockWeeklyData = {
    avg: 76,
    min: 65,
    max: 92
};

// --- CHART VARIABLES ---
let hrChartInstance = null;
let spo2ChartInstance = null;

// --- DOM ELEMENTS ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const mainViews = document.querySelectorAll('.main-view');
const navButtons = document.querySelectorAll('.nav-button');

// Auth elements
const loginTabButton = document.getElementById('login-tab-button');
const signupTabButton = document.getElementById('signup-tab-button');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginButton = document.getElementById('login-button');
const signupButton = document.getElementById('signup-button');
const logoutButton = document.getElementById('logout-button');

// Dashboard elements
const weeklyTabButton = document.getElementById('weekly-tab-button');
const dailyTabButton = document.getElementById('daily-tab-button');
const weeklyViewContent = document.getElementById('weekly-view-content');
const dailyViewContent = document.getElementById('daily-view-content');

// Devices elements
const deviceList = document.getElementById('device-list');
const addDeviceForm = document.getElementById('add-device-form');

// Settings elements
const accountSettingsForm = document.getElementById('account-settings-form');
const measurementSettingsForm = document.getElementById('measurement-settings-form');

// --- LUCIDE ICONS ---
// We must create and mount icons dynamically as script-based CDNs don't auto-replace
const createIcon = (name, size = 20) => {
    // 'lucide' is a global variable from the script
    const icon = lucide.icons[name];
    if (!icon) return null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = icon[2]; // icon[2] holds the path data
    return svg;
};

// Mount icons
document.getElementById('icon-dashboard').appendChild(createIcon('LayoutDashboard'));
document.getElementById('icon-device').appendChild(createIcon('Smartphone'));
document.getElementById('icon-settings').appendChild(createIcon('Settings'));
document.getElementById('icon-logout').appendChild(createIcon('LogOut'));

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Auth Listeners
    loginTabButton.addEventListener('click', () => switchAuthTab('login'));
    signupTabButton.addEventListener('click', () => switchAuthTab('signup'));
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    logoutButton.addEventListener('click', handleLogout);

    // Nav Listeners
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const viewId = button.getAttribute('data-view');
            showView(viewId);
        });
    });

    // Dashboard Tab Listeners
    weeklyTabButton.addEventListener('click', () => switchDashboardTab('weekly'));
    dailyTabButton.addEventListener('click', () => switchDashboardTab('daily'));

    // Device Listeners
    addDeviceForm.addEventListener('submit', handleAddDevice);
    deviceList.addEventListener('click', handleRemoveDevice); // Event delegation

    // Settings Listeners
    accountSettingsForm.addEventListener('submit', handleSaveAccount);
    measurementSettingsForm.addEventListener('submit', handleSaveMeasurements);
});

// --- AUTH FUNCTIONS ---
function switchAuthTab(tab) {
    if (tab === 'login') {
        loginTabButton.className = 'border-red-500 text-red-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
        signupTabButton.className = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    } else {
        loginTabButton.className = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
        signupTabButton.className = 'border-red-500 text-red-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    }
}

function handleLogin(e) {
    e.preventDefault();
    // In a real app: POST to /api/auth/login, get JWT
    console.log('Login attempt');
    // Mock success
    mockSettings.email = document.getElementById('login-email').value;
    document.getElementById('user-email-display').textContent = mockSettings.email;

    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Load app data
    initializeApp();
}

function handleSignup(e) {
    e.preventDefault();
    // In a real app: POST to /api/auth/register, get JWT
    console.log('Signup attempt');
    // Mock success
    mockSettings.email = document.getElementById('signup-email').value;
    document.getElementById('user-email-display').textContent = mockSettings.email;

    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Add the new device
    const newDeviceName = "Initial Device";
    const newDeviceId = document.getElementById('signup-device-id').value;
    if (newDeviceId) {
        mockDevices.push({ id: newDeviceId, name: newDeviceName });
    }

    // Load app data
    initializeApp();
}

function handleLogout() {
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');

    // Clean up
    if (hrChartInstance) hrChartInstance.destroy();
    if (spo2ChartInstance) spo2ChartInstance.destroy();
    hrChartInstance = null;
    spo2ChartInstance = null;
}

// --- APP INITIALIZATION ---
function initializeApp() {
    showView('dashboard-view'); // Default view
    loadWeeklySummary();
    initCharts();
    renderDeviceList();
    loadSettingsForms();
}

// --- VIEW NAVIGATION ---
function showView(viewId) {
    // Hide all views
    mainViews.forEach(view => view.classList.add('hidden'));

    // Deactivate all nav buttons
    navButtons.forEach(button => {
        button.classList.remove('bg-gray-700', 'text-white');
        button.classList.add('hover:bg-gray-700', 'hover:text-white');
    });

    // Show the selected view
    document.getElementById(viewId).classList.remove('hidden');

    // Activate the selected nav button
    const activeButton = document.querySelector(`.nav-button[data-view="${viewId}"]`);
    activeButton.classList.add('bg-gray-700', 'text-white');
    activeButton.classList.remove('hover:bg-gray-700', 'hover:text-white');
}

// --- DASHBOARD FUNCTIONS ---
function switchDashboardTab(tab) {
    if (tab === 'weekly') {
        weeklyTabButton.className = 'border-red-500 text-red-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
        dailyTabButton.className = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
        weeklyViewContent.classList.remove('hidden');
        dailyViewContent.classList.add('hidden');
    } else {
        weeklyTabButton.className = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
        dailyTabButton.className = 'border-red-500 text-red-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
        weeklyViewContent.classList.add('hidden');
        dailyViewContent.classList.remove('hidden');
    }
}

function loadWeeklySummary() {
    // In a real app, fetch this data
    document.getElementById('weekly-avg-hr').innerHTML = `${mockWeeklyData.avg} <span class="text-lg font-medium text-gray-600">bpm</span>`;
    document.getElementById('weekly-min-hr').innerHTML = `${mockWeeklyData.min} <span class="text-lg font-medium text-gray-600">bpm</span>`;
    document.getElementById('weekly-max-hr').innerHTML = `${mockWeeklyData.max} <span class="text-lg font-medium text-gray-600">bpm</span>`;
}

function initCharts() {
    // Destroy existing charts if they exist
    if (hrChartInstance) hrChartInstance.destroy();
    if (spo2ChartInstance) spo2ChartInstance.destroy();

    const hrCtx = document.getElementById('hrChart').getContext('2d');
    const spo2Ctx = document.getElementById('spo2Chart').getContext('2d');

    const hrData = mockDailyData.hr;
    const spo2Data = mockDailyData.spo2;

    const hrMin = Math.min(...hrData);
    const hrMax = Math.max(...hrData);
    const spo2Min = Math.min(...spo2Data);
    const spo2Max = Math.max(...spo2Data);

    // Update min/max text
    document.getElementById('hr-min-text').textContent = `${hrMin} bpm`;
    document.getElementById('hr-max-text').textContent = `${hrMax} bpm`;
    document.getElementById('spo2-min-text').textContent = `${spo2Min}%`;
    document.getElementById('spo2-max-text').textContent = `${spo2Max}%`;

    // Function to create point styling for min/max
    const createPointStyles = (data, minVal, maxVal) => {
        return data.map(val => {
            if (val === minVal) return 'rgb(59, 130, 246)'; // blue
            if (val === maxVal) return 'rgb(239, 68, 68)'; // red
            return 'rgba(239, 68, 68, 0.5)'; // default point color
        });
    };

    hrChartInstance = new Chart(hrCtx, {
        type: 'line',
        data: {
            labels: mockDailyData.labels,
            datasets: [{
                label: 'Heart Rate',
                data: hrData,
                borderColor: 'rgb(239, 68, 68)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: createPointStyles(hrData, hrMin, hrMax),
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: false }
            }
        }
    });

    spo2ChartInstance = new Chart(spo2Ctx, {
        type: 'line',
        data: {
            labels: mockDailyData.labels,
            datasets: [{
                label: 'SpO2',
                data: spo2Data,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: createPointStyles(spo2Data, spo2Min, spo2Max),
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    min: 90, // SpO2 is usually in a tight range
                    max: 100
                }
            }
        }
    });
}

// --- DEVICE FUNCTIONS ---
function renderDeviceList() {
    deviceList.innerHTML = ''; // Clear existing list

    if (mockDevices.length === 0) {
        deviceList.innerHTML = `<li class="p-6 text-center text-gray-500">No devices registered.</li>`;
        return;
    }

    mockDevices.forEach(device => {
        const li = document.createElement('li');
        li.className = 'px-6 py-4 flex items-center justify-between';
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
        // Add icon
        document.getElementById(`icon-dev-${device.id}`).appendChild(createIcon('Smartphone'));
    });
}

function handleAddDevice(e) {
    e.preventDefault();
    const nameInput = document.getElementById('device-name');
    const idInput = document.getElementById('device-id');

    const name = nameInput.value;
    const id = idInput.value;

    if (name && id) {
        // In a real app: POST to /api/devices
        mockDevices.push({ id, name });
        renderDeviceList();
        nameInput.value = '';
        idInput.value = '';
    }
}

function handleRemoveDevice(e) {
    if (e.target.classList.contains('remove-device-btn')) {
        const id = e.target.getAttribute('data-id');
        // In a real app: DELETE /api/devices/:id
        mockDevices = mockDevices.filter(device => device.id !== id);
        renderDeviceList();
    }
}

// --- SETTINGS FUNCTIONS ---
function loadSettingsForms() {
    document.getElementById('user-name-display').textContent = mockSettings.name;
    document.getElementById('user-email-display').textContent = mockSettings.email;

    document.getElementById('account-name').value = mockSettings.name;
    document.getElementById('account-email').value = mockSettings.email;

    document.getElementById('measurement-frequency').value = mockSettings.frequency;
    document.getElementById('measurement-start').value = mockSettings.startTime;
    document.getElementById('measurement-end').value = mockSettings.endTime;
}

function handleSaveAccount(e) {
    e.preventDefault();
    // In a real app: PUT /api/user
    const newName = document.getElementById('account-name').value;
    const newPassword = document.getElementById('account-password').value;

    mockSettings.name = newName;
    document.getElementById('user-name-display').textContent = newName;

    console.log('Saving account info (mock):', { name: newName, password: newPassword ? '******' : 'unchanged' });
    // Show a success message
    document.getElementById('account-password').value = '';
}

function handleSaveMeasurements(e) {
    e.preventDefault();
    // In a real app: PUT /api/user/config
    mockSettings.frequency = document.getElementById('measurement-frequency').value;
    mockSettings.startTime = document.getElementById('measurement-start').value;
    mockSettings.endTime = document.getElementById('measurement-end').value;

    console.log('Saving measurement config (mock):', mockSettings);
    // Show a success message
}