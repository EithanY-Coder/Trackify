// ==========================================================================
// TRACKIFY APPLICATION STATE & INITIALIZATION
// ==========================================================================

const state = {
    transactions: [],
    categories: [],
    activeTab: 'dashboard',
    chartFilter: 'all', // 'all', 'month', 'week'
    currentUser: null,
    authMode: 'login' // 'login' or 'register'
};

// DOM Elements
const elements = {
    // Auth Containers
    authContainer: document.getElementById('auth-container'),
    appContainer: document.getElementById('app-container'),
    
    // Auth Form Elements
    authForm: document.getElementById('auth-form'),
    authTitle: document.getElementById('auth-title'),
    authSubtitle: document.getElementById('auth-subtitle'),
    authEmailInput: document.getElementById('auth-email'),
    authPasswordInput: document.getElementById('auth-password'),
    btnAuthSubmit: document.getElementById('btn-auth-submit'),
    btnAuthToggle: document.getElementById('btn-auth-toggle'),
    authToggleText: document.getElementById('auth-toggle-text'),
    sidebarLogoutBtn: document.getElementById('sidebar-logout-btn'),
    sidebarUserWelcome: document.getElementById('sidebar-user-welcome'),

    navButtons: document.querySelectorAll('.nav-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    sidebarNetBalance: document.getElementById('sidebar-net-balance'),
    sidebarStatusMsg: document.getElementById('sidebar-status-msg'),
    
    // Stats elements
    dashboardTotalIncome: document.getElementById('dashboard-total-income'),
    dashboardTotalExpenses: document.getElementById('dashboard-total-expenses'),
    dashboardNetSavings: document.getElementById('dashboard-net-savings'),
    
    // Forms
    expenseForm: document.getElementById('expense-form'),
    incomeForm: document.getElementById('income-form'),
    customCategoryForm: document.getElementById('custom-category-form'),
    
    // Switches
    btnSwitchExpense: document.getElementById('btn-switch-expense'),
    btnSwitchIncome: document.getElementById('btn-switch-income'),
    useWageCalc: document.getElementById('use-wage-calc'),
    incomeAmountGroup: document.getElementById('income-amount-group'),
    wageCalcFields: document.getElementById('wage-calc-fields'),
    
    // Form Inputs
    expenseAmount: document.getElementById('expense-amount'),
    expenseCategory: document.getElementById('expense-category'),
    expenseDate: document.getElementById('expense-date'),
    expenseDesc: document.getElementById('expense-desc'),
    
    incomeAmount: document.getElementById('income-amount'),
    incomeHours: document.getElementById('income-hours'),
    incomeWage: document.getElementById('income-wage'),
    calcPreviewTotal: document.getElementById('calc-preview-total'),
    incomeCategory: document.getElementById('income-category'),
    incomeDate: document.getElementById('income-date'),
    incomeDesc: document.getElementById('income-desc'),
    
    newCatName: document.getElementById('new-cat-name'),
    newCatIcon: document.getElementById('new-cat-icon'),
    newCatColor: document.getElementById('new-cat-color'),
    
    // Lists
    recentTransactionsTbody: document.getElementById('recent-transactions-tbody'),
    dashboardCategoryList: document.getElementById('dashboard-category-list'),
    historyTransactionsTbody: document.getElementById('history-transactions-tbody'),
    categorySettingsGrid: document.getElementById('category-settings-grid'),
    
    // History Filters
    historySearch: document.getElementById('history-search'),
    historyFilterType: document.getElementById('history-filter-type'),
    historyFilterTime: document.getElementById('history-filter-time'),
    viewAllHistory: document.getElementById('view-all-history'),
    
    // Charts Containers
    timelineChartContainer: document.getElementById('timeline-chart-container'),
    categoryChartContainer: document.getElementById('category-breakdown-container'),
    
    // Mobile Navigation
    mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
    sidebar: document.querySelector('.sidebar'),
    toastContainer: document.getElementById('toast-container')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    elements.expenseDate.value = today;
    elements.incomeDate.value = today;
    
    initNavigation();
    initFormSwitcher();
    initIncomeCalculator();
    initFormSubmissions();
    initHistoryFilters();
    
    // Initialize custom searchable dropdown triggers
    setupCustomDropdown('expense');
    setupCustomDropdown('edit');
    setupCustomDropdown('ai-preview');
    
    // Initialize custom datepicker calendars
    initCustomDatepickers();
    
    // Initialize Edit Modals Close/Cancel events
    initModalEvents();
    
    // Initialize AI Logger
    initAiLogger();
    
    // Check authentication and initialize app data
    initAuth();
});

// ==========================================================================
// TOAST NOTIFICATIONS Helper
// ==========================================================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'i';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-text">${message}</span>
        <span class="toast-close">&times;</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Close button event listener
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.animation = 'toastSlideIn 0.35s reverse forwards';
        setTimeout(() => toast.remove(), 350);
    });
    
    // Auto remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'toastSlideIn 0.35s reverse forwards';
            setTimeout(() => toast.remove(), 350);
        }
    }, 4000);
}

// ==========================================================================
// AUTHENTICATION LOGIC & EVENT HANDLERS (SUPABASE AUTH)
// ==========================================================================

// Initialize Supabase Client
const SUPABASE_URL = "https://yikvwuvigvocakylxsvb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MMFH_VKRbg6wrV700meNmg_flCb8ktU";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function initAuth() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            state.currentUser = session.user.email;
            elements.sidebarUserWelcome.textContent = `Logged in as ${state.currentUser}`;
            elements.authContainer.classList.add('hidden');
            elements.appContainer.classList.remove('hidden');
            fetchData();
        } else {
            state.currentUser = null;
            elements.appContainer.classList.add('hidden');
            elements.authContainer.classList.remove('hidden');
            setupAuthEventListeners();
        }
    } catch (err) {
        console.error('Failed to check auth status:', err);
        showToast('Connection to server failed. Please try again.', 'error');
    }
}

function setupAuthEventListeners() {
    // Only attach once
    if (elements.authForm.dataset.initialized) return;
    
    const passwordInput = document.getElementById('auth-password');
    const passwordToggleBtn = document.getElementById('btn-password-toggle');
    
    // Toggle login/register mode
    elements.btnAuthToggle.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.authMode === 'login') {
            state.authMode = 'register';
            elements.authTitle.textContent = 'Create your account';
            elements.authSubtitle.textContent = 'Enter an email and password to sign up';
            elements.btnAuthSubmit.textContent = 'Register';
            elements.authToggleText.textContent = 'Already have an account?';
            elements.btnAuthToggle.textContent = 'Log in here';
        } else {
            state.authMode = 'login';
            elements.authTitle.textContent = 'Log in to your account';
            elements.authSubtitle.textContent = 'Enter your email and password below';
            elements.btnAuthSubmit.textContent = 'Log In';
            elements.authToggleText.textContent = "Don't have an account?";
            elements.btnAuthToggle.textContent = 'Register here';
        }
        elements.authForm.reset();
        
        // Reset password visibility
        if (passwordInput && passwordToggleBtn) {
            passwordInput.type = 'password';
            const eyeClosed = passwordToggleBtn.querySelector('.eye-icon-closed');
            const eyeOpen = passwordToggleBtn.querySelector('.eye-icon-open');
            if (eyeClosed) eyeClosed.classList.remove('hidden');
            if (eyeOpen) eyeOpen.classList.add('hidden');
        }
    });
    
    // Password visibility toggle (click and hold)
    if (passwordInput && passwordToggleBtn) {
        const eyeClosed = passwordToggleBtn.querySelector('.eye-icon-closed');
        const eyeOpen = passwordToggleBtn.querySelector('.eye-icon-open');
        
        const showPassword = (e) => {
            e.preventDefault();
            passwordInput.type = 'text';
            if (eyeClosed) eyeClosed.classList.add('hidden');
            if (eyeOpen) eyeOpen.classList.remove('hidden');
        };
        
        const hidePassword = (e) => {
            e.preventDefault();
            passwordInput.type = 'password';
            if (eyeClosed) eyeClosed.classList.remove('hidden');
            if (eyeOpen) eyeOpen.classList.add('hidden');
        };
        
        // Mouse events
        passwordToggleBtn.addEventListener('mousedown', showPassword);
        passwordToggleBtn.addEventListener('mouseup', hidePassword);
        passwordToggleBtn.addEventListener('mouseleave', hidePassword);
        
        // Touch events for mobile
        passwordToggleBtn.addEventListener('touchstart', showPassword);
        passwordToggleBtn.addEventListener('touchend', hidePassword);
        passwordToggleBtn.addEventListener('touchcancel', hidePassword);
    }
    
    // Auth Form submission
    elements.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = elements.authEmailInput.value.trim();
        const password = elements.authPasswordInput.value;
        
        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }
        
        if (state.authMode === 'register') {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
            if (!passwordRegex.test(password)) {
                showToast('Password must be at least 8 characters and contain uppercase, lowercase, a number, and a special character.', 'error');
                return;
            }
        }
        
        try {
            elements.btnAuthSubmit.disabled = true;
            elements.btnAuthSubmit.textContent = 'Processing...';
            
            if (state.authMode === 'login') {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    showToast(error.message || 'Login failed', 'error');
                } else {
                    showToast('Welcome back!', 'success');
                    elements.authForm.reset();
                    initAuth();
                }
            } else {
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password
                });
                
                if (error) {
                    showToast(error.message || 'Registration failed', 'error');
                } else {
                    if (data.user && data.session === null) {
                        showToast('Check your email for the confirmation link!', 'info');
                    } else {
                        showToast('Registration successful!', 'success');
                    }
                    state.authMode = 'login';
                    elements.authTitle.textContent = 'Log in to your account';
                    elements.authSubtitle.textContent = 'Enter your email and password below';
                    elements.btnAuthSubmit.textContent = 'Log In';
                    elements.authToggleText.textContent = "Don't have an account?";
                    elements.btnAuthToggle.textContent = 'Register here';
                    elements.authForm.reset();
                }
            }
        } catch (err) {
            console.error('Auth request error:', err);
            showToast('Failed to connect to authentication server.', 'error');
        } finally {
            elements.btnAuthSubmit.disabled = false;
            elements.btnAuthSubmit.textContent = state.authMode === 'login' ? 'Log In' : 'Register';
        }
    });
    
    // Sidebar logout button
    elements.sidebarLogoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (!error) {
                showToast('Logged out successfully', 'success');
                initAuth();
            } else {
                showToast('Failed to log out', 'error');
            }
        } catch (err) {
            console.error('Logout error:', err);
            showToast('Server connection failed.', 'error');
        }
    });
    
    elements.authForm.dataset.initialized = "true";
}

async function handleSessionExpiry() {
    state.currentUser = null;
    try {
        await supabaseClient.auth.signOut();
    } catch (e) {
        console.error('Error signing out during expiry:', e);
    }
    showToast('Your session has expired. Please log in again.', 'error');
    elements.appContainer.classList.add('hidden');
    elements.authContainer.classList.remove('hidden');
    setupAuthEventListeners();
}

async function apiCall(url, options = {}) {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${session.access_token}`
            };
        }
        
        const response = await fetch(url, options);
        if (response.status === 401) {
            handleSessionExpiry();
            throw new Error('Unauthorized');
        }
        return response;
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            console.error('API Error:', err);
        }
        throw err;
    }
}

// ==========================================================================
// DATA FETCHING & STATE MANAGEMENT
// ==========================================================================
async function fetchData() {
    try {
        await Promise.all([
            fetchCategories(),
            fetchTransactions()
        ]);
    } catch (err) {
        console.error('Error fetching initial data:', err);
        if (err.message !== 'Unauthorized') {
            showToast('Failed to connect to Flask API server. Make sure server is running.', 'error');
        }
    }
}

async function fetchCategories() {
    const response = await apiCall('/api/categories');
    if (!response.ok) throw new Error('Failed to load categories');
    
    state.categories = await response.json();
    populateCategoryDropdowns();
    renderCategorySettings();
}

async function fetchTransactions() {
    const response = await apiCall('/api/transactions');
    if (!response.ok) throw new Error('Failed to load transactions');
    
    state.transactions = await response.json();
    updateDashboardMetrics();
    renderRecentTransactions();
    renderCategoryBudgets();
    renderHistoryTransactions();
    renderCharts();
}

// ==========================================================================
// FORM DROPDOWNS POPULATION
// ==========================================================================
// ==========================================================================
// FORM DROPDOWNS POPULATION (CUSTOM SEARCHABLE SELECT)
// ==========================================================================
function closeAllCustomDropdowns() {
    document.querySelectorAll('.custom-select-options').forEach(el => el.classList.add('hidden'));
}

document.addEventListener('click', closeAllCustomDropdowns);

function setupCustomDropdown(prefix) {
    const trigger = document.getElementById(`${prefix}-category-trigger`);
    const dropdown = document.getElementById(`${prefix}-category-options-dropdown`);
    const searchInput = document.getElementById(`${prefix}-category-search`);
    const list = document.getElementById(`${prefix}-category-options-list`);
    
    if (!trigger || !dropdown || !searchInput || !list) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasHidden = dropdown.classList.contains('hidden');
        closeAllCustomDropdowns();
        closeAllActionMenus();
        if (wasHidden) {
            dropdown.classList.remove('hidden');
            searchInput.value = '';
            list.querySelectorAll('.custom-option').forEach(opt => opt.style.display = 'flex');
            searchInput.focus();
        }
    });

    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const options = list.querySelectorAll('.custom-option');
        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            if (text.includes(query)) {
                opt.style.display = 'flex';
            } else {
                opt.style.display = 'none';
            }
        });
    });
}

function populateCustomDropdownOptions(prefix, selectedValue) {
    const trigger = document.getElementById(`${prefix}-category-trigger`);
    const dropdown = document.getElementById(`${prefix}-category-options-dropdown`);
    const list = document.getElementById(`${prefix}-category-options-list`);
    const hiddenInput = document.getElementById(`${prefix}-category`);
    
    if (!trigger || !dropdown || !list || !hiddenInput) return;
    
    const displayVal = trigger.querySelector('.selected-val');
    
    list.innerHTML = state.categories.map(cat => {
        const isSelected = cat.name === selectedValue;
        return `
            <div class="custom-option ${isSelected ? 'selected' : ''}" data-value="${cat.name}">
                <span class="cat-dot" style="background-color: ${cat.color}"></span>
                <span>${cat.name}</span>
            </div>
        `;
    }).join('');
    
    let matchedCat = state.categories.find(c => c.name === selectedValue);
    if (!matchedCat) {
        if (prefix === 'income') {
            matchedCat = state.categories.find(c => c.name === 'Miscellaneous') || state.categories[0];
        } else {
            matchedCat = state.categories[0];
        }
    }
    
    if (matchedCat) {
        hiddenInput.value = matchedCat.name;
        displayVal.innerHTML = `<span class="cat-dot" style="background-color: ${matchedCat.color}"></span> ${matchedCat.name}`;
        const opt = list.querySelector(`[data-value="${matchedCat.name}"]`);
        if (opt) opt.classList.add('selected');
    } else {
        hiddenInput.value = '';
        displayVal.textContent = 'Select Category...';
    }
    
    list.querySelectorAll('.custom-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = opt.getAttribute('data-value');
            const cat = state.categories.find(c => c.name === val);
            
            hiddenInput.value = val;
            displayVal.innerHTML = `<span class="cat-dot" style="background-color: ${cat.color}"></span> ${val}`;
            
            list.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            
            hiddenInput.dispatchEvent(new Event('change'));
            dropdown.classList.add('hidden');
        });
    });
}

function populateCategoryDropdowns() {
    const currentExpenseVal = elements.expenseCategory ? elements.expenseCategory.value : '';
    const currentIncomeVal = elements.incomeCategory ? elements.incomeCategory.value : '';
    const currentEditVal = document.getElementById('edit-category') ? document.getElementById('edit-category').value : '';
    const currentAiVal = document.getElementById('ai-preview-category') ? document.getElementById('ai-preview-category').value : '';
    
    populateCustomDropdownOptions('expense', currentExpenseVal);
    populateCustomDropdownOptions('income', currentIncomeVal);
    populateCustomDropdownOptions('edit', currentEditVal);
    populateCustomDropdownOptions('ai-preview', currentAiVal);
}

// ==========================================================================
// METRIC CALCULATIONS & FORMATTING
// ==========================================================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function updateDashboardMetrics() {
    let incomeTotal = 0;
    let expenseTotal = 0;
    
    state.transactions.forEach(t => {
        if (t.type === 'income') {
            incomeTotal += t.amount;
        } else {
            expenseTotal += t.amount;
        }
    });
    
    const netSavings = incomeTotal - expenseTotal;
    
    // Update labels
    elements.dashboardTotalIncome.textContent = formatCurrency(incomeTotal);
    elements.dashboardTotalExpenses.textContent = formatCurrency(expenseTotal);
    elements.dashboardNetSavings.textContent = formatCurrency(netSavings);
    
    // Sidebar Update
    elements.sidebarNetBalance.textContent = formatCurrency(netSavings);
    
    if (netSavings < 0) {
        elements.dashboardNetSavings.style.color = 'var(--color-rose)';
        elements.sidebarNetBalance.style.color = 'var(--color-rose)';
        elements.sidebarStatusMsg.innerHTML = 'Spending more than earning!';
        elements.sidebarStatusMsg.style.color = 'var(--color-rose)';
    } else if (netSavings > 0) {
        elements.dashboardNetSavings.style.color = 'var(--color-emerald)';
        elements.sidebarNetBalance.style.color = 'var(--color-emerald)';
        elements.sidebarStatusMsg.innerHTML = 'Healthy savings progress!';
        elements.sidebarStatusMsg.style.color = 'var(--text-muted)';
    } else {
        elements.dashboardNetSavings.style.color = 'var(--text-primary)';
        elements.sidebarNetBalance.style.color = 'var(--text-primary)';
        elements.sidebarStatusMsg.innerHTML = 'Balance is perfectly neutral.';
        elements.sidebarStatusMsg.style.color = 'var(--text-muted)';
    }
}

// ==========================================================================
// NAVIGATION CONTROLS
// ==========================================================================
function initNavigation() {
    elements.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
            
            // Close mobile menu if open
            elements.sidebar.classList.remove('mobile-open');
        });
    });
    
    // Mobile Menu Toggle
    elements.mobileMenuToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('mobile-open');
    });
    
    // Quick "View All" link
    elements.viewAllHistory.addEventListener('click', () => {
        switchTab('history');
    });
    
    // Chart filter clicks
    const chartFilterBtns = document.querySelectorAll('[data-chart-filter]');
    chartFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            chartFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.chartFilter = btn.getAttribute('data-chart-filter');
            renderCharts();
        });
    });
}

function switchTab(tabId) {
    state.activeTab = tabId;
    
    // Toggle nav buttons
    elements.navButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Toggle content sections
    elements.tabContents.forEach(content => {
        if (content.id === tabId) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    
    // Re-render charts when switching to dashboard to ensure SVG dimensions are computed correctly
    if (tabId === 'dashboard') {
        renderCharts();
    }
}

// ==========================================================================
// FORM SWITCHERS & CALCULATORS
// ==========================================================================
function initFormSwitcher() {
    elements.btnSwitchExpense.addEventListener('click', () => {
        elements.btnSwitchExpense.classList.add('active');
        elements.btnSwitchIncome.classList.remove('active');
        elements.expenseForm.classList.add('active');
        elements.incomeForm.classList.remove('active');
    });
    
    elements.btnSwitchIncome.addEventListener('click', () => {
        elements.btnSwitchIncome.classList.add('active');
        elements.btnSwitchExpense.classList.remove('active');
        elements.incomeForm.classList.add('active');
        elements.expenseForm.classList.remove('active');
    });
}

function initIncomeCalculator() {
    const btnHourly = document.getElementById('btn-income-hourly');
    const btnSalary = document.getElementById('btn-income-salary');
    const modeHidden = document.getElementById('income-mode');
    
    const amountGroup = document.getElementById('income-amount-group');
    const wageFields = document.getElementById('wage-calc-fields');
    
    const taxToggleBtn = document.getElementById('btn-income-toggle-tax');
    const taxGroup = document.getElementById('income-tax-group');
    const taxRateInput = document.getElementById('income-tax-rate');
    
    const updateIncomePreview = () => {
        const mode = modeHidden.value;
        let gross = 0.0;
        
        if (mode === 'hourly') {
            const hours = parseFloat(elements.incomeHours.value) || 0;
            const wage = parseFloat(elements.incomeWage.value) || 0;
            gross = hours * wage;
        } else {
            gross = parseFloat(elements.incomeAmount.value) || 0;
        }
        
        const taxRate = parseFloat(taxRateInput.value) || 0;
        const taxVal = gross * (taxRate / 100);
        const net = gross - taxVal;
        
        document.getElementById('income-preview-gross').textContent = formatCurrency(gross);
        
        const taxRow = document.getElementById('income-preview-tax-row');
        if (taxRate > 0) {
            taxRow.classList.remove('hidden');
            document.getElementById('income-preview-tax').textContent = `-$${taxVal.toFixed(2)}`;
        } else {
            taxRow.classList.add('hidden');
        }
        
        document.getElementById('income-preview-net').textContent = formatCurrency(net);
    };
    
    // Mode Switching
    btnHourly.addEventListener('click', () => {
        btnHourly.classList.add('active');
        btnSalary.classList.remove('active');
        modeHidden.value = 'hourly';
        
        amountGroup.classList.add('hidden');
        wageFields.classList.remove('hidden');
        elements.incomeAmount.required = false;
        elements.incomeHours.required = true;
        elements.incomeWage.required = true;
        updateIncomePreview();
    });
    
    btnSalary.addEventListener('click', () => {
        btnSalary.classList.add('active');
        btnHourly.classList.remove('active');
        modeHidden.value = 'salary';
        
        wageFields.classList.add('hidden');
        amountGroup.classList.remove('hidden');
        elements.incomeAmount.required = true;
        elements.incomeHours.required = false;
        elements.incomeWage.required = false;
        updateIncomePreview();
    });
    
    // Tax Toggle Button
    taxToggleBtn.addEventListener('click', () => {
        const isTaxActive = taxToggleBtn.classList.contains('active');
        if (isTaxActive) {
            taxToggleBtn.classList.remove('active');
            taxToggleBtn.textContent = '+ Add Tax';
            taxGroup.classList.add('hidden');
            taxRateInput.value = '';
        } else {
            taxToggleBtn.classList.add('active');
            taxToggleBtn.textContent = '✓ Tax Added';
            taxGroup.classList.remove('hidden');
        }
        updateIncomePreview();
    });
    
    elements.incomeHours.addEventListener('input', updateIncomePreview);
    elements.incomeWage.addEventListener('input', updateIncomePreview);
    elements.incomeAmount.addEventListener('input', updateIncomePreview);
    taxRateInput.addEventListener('input', updateIncomePreview);
}

// ==========================================================================
// TRANSACTION CRUD OPERATIONS
// ==========================================================================
function initFormSubmissions() {
    // Expense Form submit
    elements.expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            type: 'expense',
            amount: parseFloat(elements.expenseAmount.value),
            category_name: elements.expenseCategory.value,
            date: elements.expenseDate.value,
            description: elements.expenseDesc.value
        };
        
        await saveTransaction(data, elements.expenseForm);
    });
    
    // Income Form submit
    elements.incomeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const mode = document.getElementById('income-mode').value;
        const grossAmount = calculateIncomeGrossAmount(mode);
        const taxRate = parseFloat(document.getElementById('income-tax-rate').value) || 0.0;
        const netAmount = grossAmount * (1 - taxRate / 100);
        
        const data = {
            type: 'income',
            amount: parseFloat(netAmount.toFixed(2)),
            gross_amount: parseFloat(grossAmount.toFixed(2)),
            tax_rate: taxRate > 0 ? taxRate : null,
            category_name: 'Income',
            date: document.getElementById('income-date').value,
            description: elements.incomeDesc.value
        };
        
        if (mode === 'hourly') {
            data.hours_worked = parseFloat(elements.incomeHours.value);
            data.hourly_wage = parseFloat(elements.incomeWage.value);
        }
        
        await saveTransaction(data, elements.incomeForm);
        resetIncomeFormFields();
    });
    
    // Custom Category Form submit
    elements.customCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            name: elements.newCatName.value,
            icon: elements.newCatIcon.value,
            color: elements.newCatColor.value
        };
        
        try {
            const response = await apiCall('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showToast(`Category "${result.name}" created!`, 'success');
                elements.customCategoryForm.reset();
                // Select defaults
                elements.newCatColor.value = "#748ffc";
                // Reload state
                await fetchCategories();
            } else {
                showToast(result.error || 'Failed to create category', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error while creating category', 'error');
        }
    });
}

async function saveTransaction(data, formElement) {
    try {
        const response = await apiCall('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(`Transaction added successfully!`, 'success');
            formElement.reset();
            
            // Re-default custom date pickers to today
            resetCustomDatepickers();
            
            // Sync custom dropdown values
            populateCategoryDropdowns();
            
            await fetchTransactions();
            switchTab('dashboard');
        } else {
            showToast(result.error || 'Failed to save transaction', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error while saving transaction', 'error');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
        const response = await apiCall(`/api/transactions/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        if (response.ok) {
            showToast('Transaction deleted successfully!', 'info');
            await fetchTransactions();
        } else {
            showToast(result.error || 'Failed to delete transaction', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error while deleting transaction', 'error');
    }
}

// ==========================================================================
// RENDER RECENT TRANSACTIONS TABLE (DASHBOARD)
// ==========================================================================
function renderRecentTransactions() {
    const recent = state.transactions.slice(0, 5);
    
    if (recent.length === 0) {
        elements.recentTransactionsTbody.innerHTML = `
            <tr>
                <td colspan="5" class="no-data-msg">No transactions logged yet.</td>
            </tr>
        `;
        return;
    }
    
    elements.recentTransactionsTbody.innerHTML = recent.map(t => {
        const cat = state.categories.find(c => c.name === t.category_name) || { color: '#ADB5BD' };
        const displayAmount = (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount);
        const amountClass = t.type === 'income' ? 'income' : 'expense';
        
        return `
            <tr>
                <td>${t.date}</td>
                <td>${t.description || '<span style="color: var(--text-muted); font-style: italic;">No description</span>'}</td>
                <td>
                    <span class="badge-category" style="background-color: ${cat.color}20; color: ${cat.color}">
                        <span class="cat-dot" style="background-color: ${cat.color}; display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px;"></span> ${t.category_name}
                    </span>
                </td>
                <td class="table-amount ${amountClass}">${displayAmount}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="toggleActionMenu(event, this)">⋮</button>
                        <div class="action-dropdown hidden">
                            <button onclick="openEditTransactionModal(${t.id})">Edit</button>
                            <button onclick="deleteTransaction(${t.id})" class="delete-action-btn">Delete</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ==========================================================================
// RENDER CATEGORY BUDGETS PROGRESS (DASHBOARD)
// ==========================================================================
function renderCategoryBudgets() {
    // Aggregate expense by category
    const catTotals = {};
    let totalExpense = 0;
    
    state.transactions.forEach(t => {
        if (t.type === 'expense') {
            catTotals[t.category_name] = (catTotals[t.category_name] || 0) + t.amount;
            totalExpense += t.amount;
        }
    });
    
    if (totalExpense === 0) {
        elements.dashboardCategoryList.innerHTML = `<div class="no-data-msg">No expenses to display.</div>`;
        return;
    }
    
    // Sort categories by expenditure
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    
    elements.dashboardCategoryList.innerHTML = sortedCats.map(([catName, amt]) => {
        const cat = state.categories.find(c => c.name === catName) || { color: '#ADB5BD' };
        const percent = Math.round((amt / totalExpense) * 100);
        
        return `
            <div class="category-progress-item">
                <div class="cat-progress-details">
                    <span class="cat-progress-name">
                        <span class="cat-dot" style="background-color: ${cat.color}; display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px;"></span> ${catName}
                    </span>
                    <span class="cat-progress-amount">
                        ${formatCurrency(amt)} <span style="font-size: 0.75rem; color: var(--text-muted);">(${percent}%)</span>
                    </span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%; background-color: ${cat.color}"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================================================
// RENDER CATEGORY SETTINGS VIEW (TAB 4)
// ==========================================================================
function renderCategorySettings() {
    if (state.categories.length === 0) {
        elements.categorySettingsGrid.innerHTML = `<div class="no-data-msg">No categories loaded.</div>`;
        return;
    }
    
    elements.categorySettingsGrid.innerHTML = state.categories.map(cat => {
        // Calculate count of transactions in this category
        const count = state.transactions.filter(t => t.category_name === cat.name).length;
        
        return `
            <div class="card glass cat-setting-card" onclick="openCategoryTransactionsModal('${cat.name}')" style="color: ${cat.color}">
                <div class="cat-card-color-glow" style="background-color: ${cat.color}"></div>
                <div class="cat-icon" style="color: ${cat.color}">${cat.icon}</div>
                <h4 style="color: var(--text-primary)">${cat.name}</h4>
                <p>${count} associated transaction${count === 1 ? '' : 's'}</p>
            </div>
        `;
    }).join('');
}

// ==========================================================================
// TRANSACTION HISTORY TAB & FILTERS
// ==========================================================================
function initHistoryFilters() {
    const filterHandler = () => {
        renderHistoryTransactions();
    };
    
    elements.historySearch.addEventListener('input', filterHandler);
    elements.historyFilterType.addEventListener('change', filterHandler);
    elements.historyFilterTime.addEventListener('change', filterHandler);
    
    const dateFilterVal = document.getElementById('history-date-filter');
    if (dateFilterVal) {
        dateFilterVal.addEventListener('change', filterHandler);
    }
}

function renderHistoryTransactions() {
    const query = elements.historySearch.value.toLowerCase().trim();
    const typeFilter = elements.historyFilterType.value;
    const timeFilter = elements.historyFilterTime.value;
    const dateFilterVal = document.getElementById('history-date-filter') ? document.getElementById('history-date-filter').value : '';
    
    const now = new Date();
    
    // Filter transactions
    const filtered = state.transactions.filter(t => {
        // 1. Search Query
        const matchSearch = t.description.toLowerCase().includes(query) || t.category_name.toLowerCase().includes(query);
        if (!matchSearch) return false;
        
        // 2. Type
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        
        // 3. Specific Date Filter
        if (dateFilterVal && t.date !== dateFilterVal) return false;
        
        // 4. Timeframe (only if specific date isn't filtered)
        if (!dateFilterVal && timeFilter !== 'all') {
            const tDate = new Date(t.date);
            const diffTime = Math.abs(now - tDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (timeFilter === 'day') {
                const todayStr = now.toISOString().split('T')[0];
                if (t.date !== todayStr) return false;
            } else if (timeFilter === 'week') {
                if (diffDays > 7) return false;
            } else if (timeFilter === 'month') {
                if (diffDays > 30) return false;
            }
        }
        
        return true;
    });
    
    if (filtered.length === 0) {
        elements.historyTransactionsTbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-data-msg">No transactions match your search filters.</td>
            </tr>
        `;
        return;
    }
    
    elements.historyTransactionsTbody.innerHTML = filtered.map(t => {
        const cat = state.categories.find(c => c.name === t.category_name) || { icon: '📦', color: '#ADB5BD' };
        const displayAmount = (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount);
        const amountClass = t.type === 'income' ? 'income' : 'expense';
        
        let details = '-';
        if (t.type === 'income') {
            let detailParts = [];
            
            if (t.hours_worked !== null && t.hourly_wage !== null) {
                detailParts.push(`${t.hours_worked} hrs @ $${t.hourly_wage}/hr`);
            }
            
            if (t.gross_amount !== null && t.tax_rate !== null && t.tax_rate > 0) {
                const taxVal = t.gross_amount * (t.tax_rate / 100);
                detailParts.push(`Gross: $${t.gross_amount.toFixed(2)} (Tax: ${t.tax_rate}% / -$${taxVal.toFixed(2)})`);
            } else if (t.gross_amount !== null) {
                detailParts.push(`Gross: $${t.gross_amount.toFixed(2)} (No Tax)`);
            }
            
            if (detailParts.length > 0) {
                details = `<div style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px;">${detailParts.map(p => `<span>${p}</span>`).join('')}</div>`;
            }
        }
        
        const typeBadge = t.type === 'income' 
            ? `<span class="badge-category" style="background-color: var(--income-glow); color: var(--income-color);">Income</span>`
            : `<span class="badge-category" style="background-color: var(--expense-glow); color: var(--expense-color);">Expense</span>`;
            
        return `
            <tr>
                <td>${t.date}</td>
                <td>${typeBadge}</td>
                <td>${t.description || '<span style="color: var(--text-muted); font-style: italic;">No description</span>'}</td>
                <td>
                    <span class="badge-category" style="background-color: ${cat.color}20; color: ${cat.color}">
                        <span class="cat-dot" style="background-color: ${cat.color}; display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px;"></span> ${t.category_name}
                    </span>
                </td>
                <td class="table-amount ${amountClass}">${displayAmount}</td>
                <td>${details}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="toggleActionMenu(event, this)">⋮</button>
                        <div class="action-dropdown hidden">
                            <button onclick="openEditTransactionModal(${t.id})">Edit</button>
                            <button onclick="deleteTransaction(${t.id})" class="delete-action-btn">Delete</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Make delete global for HTML onclick bindings
window.deleteTransaction = deleteTransaction;

// ==========================================================================
// CUSTOM SVG CHART DRAWING UTILITIES
// ==========================================================================
function renderCharts() {
    // Only render if tab is visible to calculate widths correctly
    if (state.activeTab !== 'dashboard') return;
    
    renderTimelineChart();
    renderCategoryDonutChart();
}

// 1. CASH FLOW TIMELINE LINE CHART (SVG)
function renderTimelineChart() {
    const container = elements.timelineChartContainer;
    container.innerHTML = ''; // Clear container
    
    // Filter history based on time filter
    const now = new Date();
    let chartTransactions = [...state.transactions].reverse(); // Chronological
    
    if (state.chartFilter !== 'all') {
        chartTransactions = chartTransactions.filter(t => {
            const tDate = new Date(t.date);
            const diffTime = Math.abs(now - tDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (state.chartFilter === 'week') return diffDays <= 7;
            if (state.chartFilter === 'month') return diffDays <= 30;
            return true;
        });
    }
    
    if (chartTransactions.length === 0) {
        container.innerHTML = `<div class="no-data-msg">No transactions for this timeframe.</div>`;
        return;
    }
    
    // Group transactions by date
    const dateMap = {};
    chartTransactions.forEach(t => {
        if (!dateMap[t.date]) {
            dateMap[t.date] = { income: 0, expense: 0 };
        }
        if (t.type === 'income') {
            dateMap[t.date].income += t.amount;
        } else {
            dateMap[t.date].expense += t.amount;
        }
    });
    
    const dates = Object.keys(dateMap).sort();
    
    // If only 1 date, pad it for nice visuals
    if (dates.length === 1) {
        const d = new Date(dates[0]);
        d.setDate(d.getDate() - 1);
        const prevDateStr = d.toISOString().split('T')[0];
        dates.unshift(prevDateStr);
        dateMap[prevDateStr] = { income: 0, expense: 0 };
    }
    
    const dataIncome = dates.map(d => dateMap[d].income);
    const dataExpense = dates.map(d => dateMap[d].expense);
    
    // Setup Chart Dimensions
    const width = container.clientWidth || 600;
    const height = 220;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;
    
    // Find Max Value
    const maxVal = Math.max(...dataIncome, ...dataExpense, 10); // Minimum scale limit $10
    const roundedMax = Math.ceil(maxVal * 1.1 / 10) * 10; // Round up with 10% padding
    
    // Create SVG Node
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'chart-svg');
    
    // Defs for gradients & shadow filters
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Area gradients
    defs.innerHTML = `
        <linearGradient id="income-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--color-emerald)" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="var(--color-emerald)" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="expense-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--color-rose)" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="var(--color-rose)" stop-opacity="0"/>
        </linearGradient>
    `;
    svg.appendChild(defs);
    
    // Draw Y-Axis Gridlines & Labels
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
        const val = (roundedMax / gridCount) * i;
        const y = height - paddingBottom - (val / roundedMax) * graphHeight;
        
        // Gridline
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', paddingLeft);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width - paddingRight);
        line.setAttribute('y2', y);
        line.setAttribute('class', 'chart-grid-line');
        svg.appendChild(line);
        
        // Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', paddingLeft - 10);
        text.setAttribute('y', y + 4);
        text.setAttribute('class', 'chart-text y-axis');
        text.textContent = `$${Math.round(val)}`;
        svg.appendChild(text);
    }
    
    // Draw X-Axis Labels
    const maxLabels = Math.min(dates.length, 6);
    const labelStep = Math.max(1, Math.floor(dates.length / maxLabels));
    
    for (let i = 0; i < dates.length; i += labelStep) {
        const x = paddingLeft + (i / (dates.length - 1)) * graphWidth;
        const y = height - paddingBottom + 18;
        
        // Parse date for clean representation (MM/DD)
        const parts = dates[i].split('-');
        const dateFormatted = parts.length > 2 ? `${parts[1]}/${parts[2]}` : dates[i];
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('class', 'chart-text x-axis');
        text.textContent = dateFormatted;
        svg.appendChild(text);
    }
    
    // Coordinates calculation
    const getCoords = (data) => {
        return data.map((val, idx) => {
            const x = paddingLeft + (idx / (dates.length - 1)) * graphWidth;
            const y = height - paddingBottom - (val / roundedMax) * graphHeight;
            return { x, y };
        });
    };
    
    const coordsIncome = getCoords(dataIncome);
    const coordsExpense = getCoords(dataExpense);
    
    // Generate Path Data
    const getPathData = (coords) => {
        if (coords.length === 0) return '';
        // Draw straight line path
        let pathStr = `M ${coords[0].x} ${coords[0].y}`;
        for (let i = 1; i < coords.length; i++) {
            pathStr += ` L ${coords[i].x} ${coords[i].y}`;
        }
        return pathStr;
    };
    
    // Draw Areas
    const drawArea = (coords, gradId, classType) => {
        if (coords.length === 0) return;
        let areaPathStr = getPathData(coords);
        // Connect to bottom
        areaPathStr += ` L ${coords[coords.length - 1].x} ${height - paddingBottom}`;
        areaPathStr += ` L ${coords[0].x} ${height - paddingBottom} Z`;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', areaPathStr);
        path.setAttribute('class', `chart-area-${classType}`);
        svg.appendChild(path);
    };
    
    drawArea(coordsIncome, 'income-area-grad', 'income');
    drawArea(coordsExpense, 'expense-area-grad', 'expense');
    
    // Draw Lines
    const drawLine = (coords, classType) => {
        const pathData = getPathData(coords);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('class', `chart-path-${classType}`);
        svg.appendChild(path);
        
        try {
            const exactLength = path.getTotalLength() || 1000;
            path.style.strokeDasharray = exactLength;
            path.style.strokeDashoffset = exactLength;
        } catch (e) {
            const fallbackLength = coords.length * 200;
            path.style.strokeDasharray = fallbackLength;
            path.style.strokeDashoffset = fallbackLength;
        }
    };
    
    drawLine(coordsIncome, 'income');
    drawLine(coordsExpense, 'expense');
    
    // Draw Data Tooltip Node
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    container.appendChild(tooltip);
    
    // Draw Data Dots & Mouse Interactive Overlay
    const drawDots = (coords, data, type) => {
        coords.forEach((c, idx) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', c.x);
            circle.setAttribute('cy', c.y);
            circle.setAttribute('r', 4);
            circle.setAttribute('class', `chart-dot ${type}`);
            
            // Hover events
            circle.addEventListener('mouseover', (e) => {
                const dateStr = dates[idx];
                tooltip.style.opacity = '1';
                tooltip.innerHTML = `
                    <div class="chart-tooltip-date">${dateStr}</div>
                    <div class="chart-tooltip-row">
                        <span>${type.toUpperCase()}:</span>
                        <span style="color: var(--color-${type === 'income' ? 'emerald' : 'rose'});">${formatCurrency(data[idx])}</span>
                    </div>
                `;
                
                // Position tooltip
                const rect = container.getBoundingClientRect();
                const xPos = c.x - tooltip.clientWidth / 2;
                const yPos = c.y - tooltip.clientHeight - 10;
                tooltip.style.left = `${xPos}px`;
                tooltip.style.top = `${yPos}px`;
            });
            
            circle.addEventListener('mouseout', () => {
                tooltip.style.opacity = '0';
            });
            
            svg.appendChild(circle);
        });
    };
    
    drawDots(coordsIncome, dataIncome, 'income');
    drawDots(coordsExpense, dataExpense, 'expense');
    
    container.appendChild(svg);
}

// 2. SPENDING BY CATEGORY DONUT CHART (SVG)
function renderCategoryDonutChart() {
    const container = elements.categoryChartContainer;
    if (!container) return;
    container.innerHTML = '';
    
    // Aggregate expense by category
    const catTotals = {};
    let totalExpense = 0;
    
    state.transactions.forEach(t => {
        if (t.type === 'expense') {
            catTotals[t.category_name] = (catTotals[t.category_name] || 0) + t.amount;
            totalExpense += t.amount;
        }
    });
    
    if (totalExpense === 0) {
        container.innerHTML = `<div class="no-data-msg">No expense data available for this range.</div>`;
        return;
    }
    
    // Sort categories by amount descending
    const sortedCategories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    
    const breakdownList = document.createElement('div');
    breakdownList.className = 'breakdown-list-container';
    
    sortedCategories.forEach(([catName, amount]) => {
        const cat = state.categories.find(c => c.name === catName) || { color: '#ADB5BD' };
        const percent = Math.round((amount / totalExpense) * 100);
        
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        item.innerHTML = `
            <div class="breakdown-info">
                <div class="breakdown-label-wrap">
                    <span class="breakdown-dot" style="background-color: ${cat.color}"></span>
                    <span>${catName}</span>
                </div>
                <span class="breakdown-meta">${formatCurrency(amount)} · ${percent}%</span>
            </div>
            <div class="breakdown-bar-bg">
                <div class="breakdown-bar-fill" style="background-color: ${cat.color}; width: 0%;"></div>
            </div>
        `;
        breakdownList.appendChild(item);
        
        // Trigger horizontal bar width animation
        setTimeout(() => {
            const fill = item.querySelector('.breakdown-bar-fill');
            if (fill) fill.style.width = `${percent}%`;
        }, 50);
    });
    
    container.appendChild(breakdownList);
}

// ==========================================================================
// EDIT TRANSACTION & EDIT CATEGORY MODAL HANDLERS
// ==========================================================================
function closeAllActionMenus() {
    document.querySelectorAll('.action-dropdown').forEach(el => el.classList.add('hidden'));
}
document.addEventListener('click', closeAllActionMenus);

function toggleActionMenu(event, btnElement) {
    event.stopPropagation();
    const container = btnElement.closest('.action-menu-container');
    const dropdown = container.querySelector('.action-dropdown');
    const wasHidden = dropdown.classList.contains('hidden');
    closeAllActionMenus();
    closeAllCustomDropdowns();
    if (wasHidden) {
        dropdown.classList.remove('hidden');
    }
}

const editTModal = document.getElementById('edit-transaction-modal');
const editCModal = document.getElementById('edit-category-modal');

function initModalEvents() {
    document.getElementById('btn-close-edit-modal').addEventListener('click', closeEditTransactionModal);
    document.getElementById('btn-cancel-edit').addEventListener('click', closeEditTransactionModal);
    
    document.getElementById('btn-close-cat-modal').addEventListener('click', closeEditCategoryModal);
    document.getElementById('btn-cancel-cat-edit').addEventListener('click', closeEditCategoryModal);
    
    const switchExpense = document.getElementById('modal-btn-switch-expense');
    const switchIncome = document.getElementById('modal-btn-switch-income');
    const hiddenType = document.getElementById('edit-t-type');
    const amountGroup = document.getElementById('edit-amount-group');
    const wageFields = document.getElementById('edit-wage-calc-fields');
    
    const incomeSwitcher = document.getElementById('edit-income-switcher');
    const taxSection = document.getElementById('edit-tax-section');
    const previewCard = document.getElementById('edit-income-preview-card');
    const catGroup = document.getElementById('edit-category-group');
    
    const btnHourly = document.getElementById('edit-btn-income-hourly');
    const btnSalary = document.getElementById('edit-btn-income-salary');
    const modeHidden = document.getElementById('edit-income-mode');
    
    const taxToggleBtn = document.getElementById('edit-btn-toggle-tax');
    const taxGroup = document.getElementById('edit-tax-group');
    const taxRateInput = document.getElementById('edit-tax-rate');
    
    const updateEditPreview = () => {
        const type = hiddenType.value;
        if (type === 'expense') return;
        
        const mode = modeHidden.value;
        let gross = 0.0;
        
        if (mode === 'hourly') {
            const hours = parseFloat(document.getElementById('edit-hours').value) || 0;
            const wage = parseFloat(document.getElementById('edit-wage').value) || 0;
            gross = hours * wage;
        } else {
            gross = parseFloat(document.getElementById('edit-amount').value) || 0;
        }
        
        const taxRate = parseFloat(taxRateInput.value) || 0;
        const taxVal = gross * (taxRate / 100);
        const net = gross - taxVal;
        
        document.getElementById('edit-preview-gross').textContent = formatCurrency(gross);
        
        const taxRow = document.getElementById('edit-preview-tax-row');
        if (taxRate > 0) {
            taxRow.classList.remove('hidden');
            document.getElementById('edit-preview-tax').textContent = `-$${taxVal.toFixed(2)}`;
        } else {
            taxRow.classList.add('hidden');
        }
        
        document.getElementById('edit-preview-net').textContent = formatCurrency(net);
    };
    
    switchExpense.addEventListener('click', () => {
        switchExpense.classList.add('active');
        switchIncome.classList.remove('active');
        hiddenType.value = 'expense';
        amountGroup.classList.remove('hidden');
        wageFields.classList.add('hidden');
        
        incomeSwitcher.classList.add('hidden');
        taxSection.classList.add('hidden');
        previewCard.classList.add('hidden');
        catGroup.classList.remove('hidden');
        
        document.getElementById('edit-amount').required = true;
    });
    
    switchIncome.addEventListener('click', () => {
        switchIncome.classList.add('active');
        switchExpense.classList.remove('active');
        hiddenType.value = 'income';
        
        incomeSwitcher.classList.remove('hidden');
        taxSection.classList.remove('hidden');
        previewCard.classList.remove('hidden');
        catGroup.classList.add('hidden');
        document.getElementById('edit-category').value = 'Income';
        
        const mode = modeHidden.value;
        if (mode === 'hourly') {
            amountGroup.classList.add('hidden');
            wageFields.classList.remove('hidden');
            document.getElementById('edit-amount').required = false;
        } else {
            amountGroup.classList.remove('hidden');
            wageFields.classList.add('hidden');
            document.getElementById('edit-amount').required = true;
        }
        updateEditPreview();
    });
    
    btnHourly.addEventListener('click', () => {
        btnHourly.classList.add('active');
        btnSalary.classList.remove('active');
        modeHidden.value = 'hourly';
        
        amountGroup.classList.add('hidden');
        wageFields.classList.remove('hidden');
        document.getElementById('edit-amount').required = false;
        updateEditPreview();
    });
    
    btnSalary.addEventListener('click', () => {
        btnSalary.classList.add('active');
        btnHourly.classList.remove('active');
        modeHidden.value = 'salary';
        
        wageFields.classList.add('hidden');
        amountGroup.classList.remove('hidden');
        document.getElementById('edit-amount').required = true;
        updateEditPreview();
    });
    
    taxToggleBtn.addEventListener('click', () => {
        const isTaxActive = taxToggleBtn.classList.contains('active');
        if (isTaxActive) {
            taxToggleBtn.classList.remove('active');
            taxToggleBtn.textContent = '+ Add Tax';
            taxGroup.classList.add('hidden');
            taxRateInput.value = '';
        } else {
            taxToggleBtn.classList.add('active');
            taxToggleBtn.textContent = '✓ Tax Added';
            taxGroup.classList.remove('hidden');
        }
        updateEditPreview();
    });
    
    document.getElementById('edit-hours').addEventListener('input', updateEditPreview);
    document.getElementById('edit-wage').addEventListener('input', updateEditPreview);
    document.getElementById('edit-amount').addEventListener('input', updateEditPreview);
    taxRateInput.addEventListener('input', updateEditPreview);
    
    document.getElementById('edit-transaction-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const tId = document.getElementById('edit-t-id').value;
        const type = hiddenType.value;
        const categoryName = type === 'income' ? 'Income' : document.getElementById('edit-category').value;
        const dateVal = document.getElementById('edit-date').value;
        const descVal = document.getElementById('edit-desc').value;
        
        const payload = {
            type: type,
            category_name: categoryName,
            date: dateVal,
            description: descVal
        };
        
        if (type === 'expense') {
            payload.amount = parseFloat(document.getElementById('edit-amount').value);
        } else {
            const mode = modeHidden.value;
            const taxRate = parseFloat(taxRateInput.value) || 0.0;
            let gross = 0.0;
            if (mode === 'hourly') {
                payload.hours_worked = parseFloat(document.getElementById('edit-hours').value);
                payload.hourly_wage = parseFloat(document.getElementById('edit-wage').value);
                gross = payload.hours_worked * payload.hourly_wage;
            } else {
                gross = parseFloat(document.getElementById('edit-amount').value);
            }
            const net = gross * (1 - taxRate / 100);
            
            payload.amount = parseFloat(net.toFixed(2));
            payload.gross_amount = parseFloat(gross.toFixed(2));
            payload.tax_rate = taxRate > 0 ? taxRate : null;
        }
        
        try {
            const response = await apiCall(`/api/transactions/${tId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (response.ok) {
                showToast('Transaction updated successfully!', 'success');
                closeEditTransactionModal();
                await fetchTransactions();
            } else {
                showToast(result.error || 'Failed to update transaction', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error while updating transaction', 'error');
        }
    });

    document.getElementById('edit-category-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cId = document.getElementById('edit-c-id').value;
        const nameVal = document.getElementById('edit-cat-name').value;
        const iconVal = document.getElementById('edit-cat-icon').value;
        const colorVal = document.getElementById('edit-cat-color').value;
        
        try {
            const response = await apiCall(`/api/categories/${cId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameVal, icon: iconVal, color: colorVal })
            });
            const result = await response.json();
            if (response.ok) {
                showToast(`Category "${result.name}" updated!`, 'success');
                closeEditCategoryModal();
                await fetchCategories();
                await fetchTransactions();
            } else {
                showToast(result.error || 'Failed to update category', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error while updating category', 'error');
        }
    });
}

function openEditTransactionModal(id) {
    closeAllActionMenus();
    const t = state.transactions.find(item => item.id === id);
    if (!t) return;
    
    document.getElementById('edit-t-id').value = t.id;
    
    // Set custom datepicker selection state
    const tDate = new Date(t.date + 'T12:00:00'); // Prevent timezone offset errors
    datepickerState['edit'] = {
        currentMonth: tDate.getMonth(),
        currentYear: tDate.getFullYear(),
        selectedDate: tDate
    };
    document.getElementById('edit-date').value = t.date;
    document.getElementById('edit-date-trigger').querySelector('.selected-date').textContent = formatDateDisplay(tDate);
    
    document.getElementById('edit-desc').value = t.description || '';
    
    const hiddenType = document.getElementById('edit-t-type');
    const switchExpense = document.getElementById('modal-btn-switch-expense');
    const switchIncome = document.getElementById('modal-btn-switch-income');
    const amountGroup = document.getElementById('edit-amount-group');
    const wageFields = document.getElementById('edit-wage-calc-fields');
    
    const incomeSwitcher = document.getElementById('edit-income-switcher');
    const taxSection = document.getElementById('edit-tax-section');
    const previewCard = document.getElementById('edit-income-preview-card');
    const catGroup = document.getElementById('edit-category-group');
    
    hiddenType.value = t.type;
    
    if (t.type === 'expense') {
        switchExpense.classList.add('active');
        switchIncome.classList.remove('active');
        amountGroup.classList.remove('hidden');
        wageFields.classList.add('hidden');
        
        incomeSwitcher.classList.add('hidden');
        taxSection.classList.add('hidden');
        previewCard.classList.add('hidden');
        catGroup.classList.remove('hidden');
        
        document.getElementById('edit-amount').value = t.amount;
        document.getElementById('edit-amount').required = true;
        
        populateCustomDropdownOptions('edit', t.category_name);
    } else {
        switchIncome.classList.add('active');
        switchExpense.classList.remove('active');
        
        incomeSwitcher.classList.remove('hidden');
        taxSection.classList.remove('hidden');
        previewCard.classList.remove('hidden');
        catGroup.classList.add('hidden');
        document.getElementById('edit-category').value = 'Income';
        
        // Handle Hourly vs Salary Mode
        const modeHidden = document.getElementById('edit-income-mode');
        const btnHourly = document.getElementById('edit-btn-income-hourly');
        const btnSalary = document.getElementById('edit-btn-income-salary');
        
        if (t.hours_worked !== null && t.hourly_wage !== null) {
            modeHidden.value = 'hourly';
            btnHourly.classList.add('active');
            btnSalary.classList.remove('active');
            
            amountGroup.classList.add('hidden');
            wageFields.classList.remove('hidden');
            document.getElementById('edit-hours').value = t.hours_worked;
            document.getElementById('edit-wage').value = t.hourly_wage;
            document.getElementById('edit-amount').value = '';
            document.getElementById('edit-amount').required = false;
        } else {
            modeHidden.value = 'salary';
            btnSalary.classList.add('active');
            btnHourly.classList.remove('active');
            
            amountGroup.classList.remove('hidden');
            wageFields.classList.add('hidden');
            document.getElementById('edit-hours').value = '';
            document.getElementById('edit-wage').value = '';
            document.getElementById('edit-amount').value = t.gross_amount || t.amount;
            document.getElementById('edit-amount').required = true;
        }
        
        // Handle Tax populate
        const taxRateInput = document.getElementById('edit-tax-rate');
        const taxToggleBtn = document.getElementById('edit-btn-toggle-tax');
        const taxGroup = document.getElementById('edit-tax-group');
        
        if (t.tax_rate !== null && t.tax_rate > 0) {
            taxRateInput.value = t.tax_rate;
            taxToggleBtn.classList.add('active');
            taxToggleBtn.textContent = '✓ Tax Added';
            taxGroup.classList.remove('hidden');
        } else {
            taxRateInput.value = '';
            taxToggleBtn.classList.remove('active');
            taxToggleBtn.textContent = '+ Add Tax';
            taxGroup.classList.add('hidden');
        }
        
        taxRateInput.dispatchEvent(new Event('input'));
    }
    
    editTModal.classList.add('open');
}

function closeEditTransactionModal() {
    editTModal.classList.remove('open');
}

function openEditCategoryModal(id) {
    closeAllActionMenus();
    const cat = state.categories.find(item => item.id === id);
    if (!cat) return;
    
    document.getElementById('edit-c-id').value = cat.id;
    document.getElementById('edit-cat-name').value = cat.name;
    document.getElementById('edit-cat-icon').value = cat.icon;
    document.getElementById('edit-cat-color').value = cat.color;
    
    editCModal.classList.add('open');
}

function closeEditCategoryModal() {
    editCModal.classList.remove('open');
}

async function deleteCategory(id) {
    closeAllActionMenus();
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;
    
    if (cat.name === 'Miscellaneous') {
        showToast('The "Miscellaneous" category cannot be deleted.', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete category "${cat.name}"? All associated transactions will be reassigned to the default "Miscellaneous" category.`)) {
        return;
    }
    
    try {
        const response = await apiCall(`/api/categories/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (response.ok) {
            showToast('Category deleted and transactions reassigned successfully!', 'info');
            await fetchCategories();
            await fetchTransactions();
        } else {
            showToast(result.error || 'Failed to delete category', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error while deleting category', 'error');
    }
}

window.openEditTransactionModal = openEditTransactionModal;
window.toggleActionMenu = toggleActionMenu;
window.openEditCategoryModal = openEditCategoryModal;
window.deleteCategory = deleteCategory;

// ==========================================================================
// CUSTOM DATEPICKER CALENDAR & INCOME LOGGING HELPERS
// ==========================================================================
const datepickerState = {};

function initCustomDatepickers() {
    setupCustomDatepicker('expense');
    setupCustomDatepicker('income');
    setupCustomDatepicker('edit');
    setupCustomDatepicker('ai-preview');
    setupCustomDatepicker('history', true);
}

function setupCustomDatepicker(prefix, isOptional = false) {
    const trigger = document.getElementById(`${prefix}-date-trigger`);
    const calendar = document.getElementById(`${prefix}-datepicker-calendar`);
    const hiddenInput = document.getElementById(prefix === 'history' ? 'history-date-filter' : `${prefix}-date`);
    if (!trigger || !calendar || !hiddenInput) return;
    
    const displayVal = trigger.querySelector('.selected-date');
    const today = new Date();
    
    datepickerState[prefix] = {
        currentMonth: today.getMonth(),
        currentYear: today.getFullYear(),
        selectedDate: isOptional ? null : today
    };
    
    if (!isOptional) {
        hiddenInput.value = formatDateISO(today);
        displayVal.textContent = formatDateDisplay(today);
    } else {
        hiddenInput.value = '';
        displayVal.textContent = 'All Dates';
    }
    
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasHidden = calendar.classList.contains('hidden');
        closeAllCustomCalendars();
        closeAllCustomDropdowns();
        closeAllActionMenus();
        if (wasHidden) {
            calendar.classList.remove('hidden');
            renderCalendarGrid(prefix, isOptional);
        }
    });
    
    calendar.addEventListener('click', (e) => e.stopPropagation());
}

function closeAllCustomCalendars() {
    document.querySelectorAll('.custom-datepicker-calendar').forEach(el => el.classList.add('hidden'));
}
document.addEventListener('click', closeAllCustomCalendars);

function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateDisplay(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function renderCalendarGrid(prefix, isOptional) {
    const calendar = document.getElementById(`${prefix}-datepicker-calendar`);
    const stateVal = datepickerState[prefix];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    calendar.innerHTML = `
        <div class="calendar-header">
            <button class="cal-nav-btn prev-btn" type="button">◀</button>
            <span class="cal-month-year">${months[stateVal.currentMonth]} ${stateVal.currentYear}</span>
            <button class="cal-nav-btn next-btn" type="button">▶</button>
        </div>
        <div class="calendar-weekdays">
            <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>
        <div class="calendar-days-grid"></div>
        ${isOptional ? `<button class="cal-clear-btn" type="button">Clear Filter</button>` : ''}
    `;
    
    calendar.querySelector('.prev-btn').addEventListener('click', () => {
        stateVal.currentMonth--;
        if (stateVal.currentMonth < 0) {
            stateVal.currentMonth = 11;
            stateVal.currentYear--;
        }
        renderCalendarGrid(prefix, isOptional);
    });
    
    calendar.querySelector('.next-btn').addEventListener('click', () => {
        stateVal.currentMonth++;
        if (stateVal.currentMonth > 11) {
            stateVal.currentMonth = 0;
            stateVal.currentYear++;
        }
        renderCalendarGrid(prefix, isOptional);
    });
    
    if (isOptional) {
        calendar.querySelector('.cal-clear-btn').addEventListener('click', () => {
            stateVal.selectedDate = null;
            const hiddenInput = document.getElementById('history-date-filter');
            const displayVal = document.getElementById(`${prefix}-date-trigger`).querySelector('.selected-date');
            hiddenInput.value = '';
            displayVal.textContent = 'All Dates';
            hiddenInput.dispatchEvent(new Event('change'));
            closeAllCustomCalendars();
        });
    }
    
    const daysGrid = calendar.querySelector('.calendar-days-grid');
    const firstDayIndex = new Date(stateVal.currentYear, stateVal.currentMonth, 1).getDay();
    const lastDay = new Date(stateVal.currentYear, stateVal.currentMonth + 1, 0).getDate();
    
    for (let i = 0; i < firstDayIndex; i++) {
        const blank = document.createElement('span');
        blank.className = 'empty-day';
        daysGrid.appendChild(blank);
    }
    
    const today = new Date();
    for (let d = 1; d <= lastDay; d++) {
        const dayCell = document.createElement('span');
        dayCell.className = 'calendar-day';
        dayCell.textContent = d;
        
        const thisDate = new Date(stateVal.currentYear, stateVal.currentMonth, d);
        
        if (stateVal.selectedDate && 
            stateVal.selectedDate.getDate() === d && 
            stateVal.selectedDate.getMonth() === stateVal.currentMonth && 
            stateVal.selectedDate.getFullYear() === stateVal.currentYear) {
            dayCell.classList.add('selected');
        }
        
        if (today.getDate() === d && 
            today.getMonth() === stateVal.currentMonth && 
            today.getFullYear() === stateVal.currentYear) {
            dayCell.classList.add('today');
        }
        
        dayCell.addEventListener('click', () => {
            stateVal.selectedDate = thisDate;
            const hiddenInput = document.getElementById(prefix === 'history' ? 'history-date-filter' : `${prefix}-date`);
            const displayVal = document.getElementById(`${prefix}-date-trigger`).querySelector('.selected-date');
            
            hiddenInput.value = formatDateISO(thisDate);
            displayVal.textContent = formatDateDisplay(thisDate);
            
            hiddenInput.dispatchEvent(new Event('change'));
            closeAllCustomCalendars();
        });
        
        daysGrid.appendChild(dayCell);
    }
}

function resetCustomDatepickers() {
    const today = new Date();
    const prefixes = ['expense', 'income'];
    
    prefixes.forEach(prefix => {
        const trigger = document.getElementById(`${prefix}-date-trigger`);
        const hiddenInput = document.getElementById(`${prefix}-date`);
        if (trigger && hiddenInput) {
            datepickerState[prefix] = {
                currentMonth: today.getMonth(),
                currentYear: today.getFullYear(),
                selectedDate: today
            };
            hiddenInput.value = formatDateISO(today);
            trigger.querySelector('.selected-date').textContent = formatDateDisplay(today);
        }
    });
}

function calculateIncomeGrossAmount(mode) {
    if (mode === 'hourly') {
        const hours = parseFloat(document.getElementById('income-hours').value) || 0;
        const wage = parseFloat(document.getElementById('income-wage').value) || 0;
        return hours * wage;
    } else {
        return parseFloat(document.getElementById('income-amount').value) || 0;
    }
}

function resetIncomeFormFields() {
    document.getElementById('btn-income-hourly').classList.add('active');
    document.getElementById('btn-income-salary').classList.remove('active');
    document.getElementById('income-mode').value = 'hourly';
    
    document.getElementById('wage-calc-fields').classList.remove('hidden');
    document.getElementById('income-amount-group').classList.add('hidden');
    
    const taxToggleBtn = document.getElementById('btn-income-toggle-tax');
    taxToggleBtn.classList.remove('active');
    taxToggleBtn.textContent = '+ Add Tax';
    document.getElementById('income-tax-group').classList.add('hidden');
    document.getElementById('income-tax-rate').value = '';
    
    document.getElementById('income-preview-gross').textContent = '$0.00';
    document.getElementById('income-preview-tax').textContent = '-$0.00';
    document.getElementById('income-preview-tax-row').classList.add('hidden');
    document.getElementById('income-preview-net').textContent = '$0.00';
}

// ==========================================================================
// CATEGORY TRANSACTIONS POPUP CONTROLLER
// ==========================================================================
const catTransactionsModal = document.getElementById('category-transactions-modal');
const closeCatTransactionsBtn = document.getElementById('btn-close-cat-transactions-modal');
const catTransactionsTbody = document.getElementById('cat-transactions-tbody');
const catTransactionsTitle = document.getElementById('cat-transactions-modal-title');

if (closeCatTransactionsBtn && catTransactionsModal) {
    closeCatTransactionsBtn.addEventListener('click', () => {
        catTransactionsModal.classList.remove('open');
    });
    
    catTransactionsModal.addEventListener('click', (e) => {
        if (e.target === catTransactionsModal) {
            catTransactionsModal.classList.remove('open');
        }
    });
}

function openCategoryTransactionsModal(catName) {
    if (!catTransactionsModal || !catTransactionsTbody || !catTransactionsTitle) return;
    
    catTransactionsTitle.textContent = `Transactions in Category: ${catName}`;
    
    const matched = state.transactions.filter(t => t.category_name === catName);
    
    if (matched.length === 0) {
        catTransactionsTbody.innerHTML = `
            <tr>
                <td colspan="5" class="no-data-msg">No transactions found in this category.</td>
            </tr>
        `;
    } else {
        // Sort by date descending
        matched.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        catTransactionsTbody.innerHTML = matched.map(t => {
            const displayAmount = (t.type === 'income' ? '+' : '-') + formatCurrency(t.amount);
            const amountClass = t.type === 'income' ? 'income' : 'expense';
            
            let details = '-';
            if (t.type === 'income') {
                let detailParts = [];
                if (t.hours_worked !== null && t.hourly_wage !== null) {
                    detailParts.push(`${t.hours_worked} hrs @ $${t.hourly_wage}/hr`);
                }
                if (t.gross_amount !== null && t.tax_rate !== null && t.tax_rate > 0) {
                    const taxVal = t.gross_amount * (t.tax_rate / 100);
                    detailParts.push(`Gross: $${t.gross_amount.toFixed(2)} (Tax: ${t.tax_rate}% / -$${taxVal.toFixed(2)})`);
                } else if (t.gross_amount !== null) {
                    detailParts.push(`Gross: $${t.gross_amount.toFixed(2)}`);
                }
                if (detailParts.length > 0) {
                    details = `<div style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px;">${detailParts.map(p => `<span>${p}</span>`).join('')}</div>`;
                }
            }
            
            const typeBadge = t.type === 'income' 
                ? `<span class="badge-category" style="background-color: var(--income-glow); color: var(--income-color);">Income</span>`
                : `<span class="badge-category" style="background-color: var(--expense-glow); color: var(--expense-color);">Expense</span>`;
                
            return `
                <tr>
                    <td>${t.date}</td>
                    <td>${typeBadge}</td>
                    <td>${t.description || '<span style="color: var(--text-muted); font-style: italic;">No description</span>'}</td>
                    <td class="table-amount ${amountClass}">${displayAmount}</td>
                    <td>${details}</td>
                </tr>
            `;
        }).join('');
    }
    
    catTransactionsModal.classList.add('open');
}

window.openCategoryTransactionsModal = openCategoryTransactionsModal;

// ==========================================================================
// AI QUICK LOGGER INTEGRATION
// ==========================================================================
function initAiLogger() {
    const btnProcess = document.getElementById('btn-ai-process');
    const promptInput = document.getElementById('ai-prompt-input');
    const resultCard = document.getElementById('ai-result-card');
    
    const previewTypeInput = document.getElementById('ai-preview-type');
    const previewAmountInput = document.getElementById('ai-preview-amount');
    const previewCategoryInput = document.getElementById('ai-preview-category');
    const previewDateInput = document.getElementById('ai-preview-date');
    const previewDescInput = document.getElementById('ai-preview-desc');
    
    const btnPreviewExpense = document.getElementById('btn-ai-preview-expense');
    const btnPreviewIncome = document.getElementById('btn-ai-preview-income');
    
    const hourlyFields = document.getElementById('ai-preview-hourly-fields');
    const hoursInput = document.getElementById('ai-preview-hours');
    const wageInput = document.getElementById('ai-preview-wage');
    
    const taxSection = document.getElementById('ai-preview-tax-section');
    const taxRateInput = document.getElementById('ai-preview-tax-rate');
    const grossAmountInput = document.getElementById('ai-preview-gross-amount');
    
    const btnClear = document.getElementById('btn-ai-clear');
    const previewForm = document.getElementById('ai-preview-form');

    if (!btnProcess) return;

    // Helper to switch preview type in UI
    const setPreviewType = (type) => {
        previewTypeInput.value = type;
        if (type === 'income') {
            btnPreviewIncome.classList.add('active');
            btnPreviewExpense.classList.remove('active');
            hourlyFields.classList.remove('hidden');
            taxSection.classList.remove('hidden');
        } else {
            btnPreviewExpense.classList.add('active');
            btnPreviewIncome.classList.remove('active');
            hourlyFields.classList.add('hidden');
            taxSection.classList.add('hidden');
        }
    };

    btnPreviewExpense.addEventListener('click', () => setPreviewType('expense'));
    btnPreviewIncome.addEventListener('click', () => setPreviewType('income'));

    // Process Natural Language Prompt
    btnProcess.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showToast('Please describe your transaction first.', 'error');
            return;
        }

        // Show spinner / loading state
        btnProcess.disabled = true;
        btnProcess.querySelector('.btn-text').textContent = 'Processing with AI...';
        btnProcess.querySelector('.btn-spinner').classList.remove('hidden');
        resultCard.classList.add('hidden');

        try {
            const response = await apiCall('/api/ai/parse-transaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to parse prompt');
            }

            // Populate form
            setPreviewType(result.type);
            previewAmountInput.value = result.amount || '';
            previewDescInput.value = result.description || '';

            // Handle temporary custom category suggestion if it doesn't exist yet
            const newCatName = result.category_name;
            if (newCatName) {
                const exists = state.categories.some(c => c.name.toLowerCase() === newCatName.toLowerCase());
                if (!exists) {
                    const tempCategory = {
                        name: newCatName,
                        icon: result.category_icon || (newCatName.toLowerCase() === 'income' ? '💵' : '📦'),
                        color: result.category_color || (newCatName.toLowerCase() === 'income' ? '#2B8A3E' : '#ADB5BD')
                    };
                    state.categories.push(tempCategory);
                    populateCategoryDropdowns();
                }
            }
            
            previewCategoryInput.value = result.category_name || '';
            
            // Set custom date picker value
            const parsedDate = result.date ? new Date(result.date + 'T00:00:00') : new Date();
            datepickerState['ai-preview'] = {
                currentMonth: parsedDate.getMonth(),
                currentYear: parsedDate.getFullYear(),
                selectedDate: parsedDate
            };
            previewDateInput.value = formatDateISO(parsedDate);
            document.querySelector('#ai-preview-date-trigger .selected-date').textContent = formatDateDisplay(parsedDate);

            // Populate custom dropdown option selection
            populateCustomDropdownOptions('ai-preview', result.category_name);

            // Hourly wage details
            if (result.type === 'income') {
                hoursInput.value = result.hours_worked || '';
                wageInput.value = result.hourly_wage || '';
                taxRateInput.value = result.tax_rate || '';
                grossAmountInput.value = result.gross_amount || '';
            } else {
                hoursInput.value = '';
                wageInput.value = '';
                taxRateInput.value = '';
                grossAmountInput.value = '';
            }

            // Show result card
            resultCard.classList.remove('hidden');
            resultCard.scrollIntoView({ behavior: 'smooth' });
            showToast('AI successfully parsed your description!', 'success');
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Error communicating with AI parser.', 'error');
        } finally {
            btnProcess.disabled = false;
            btnProcess.querySelector('.btn-text').textContent = 'Process Transaction';
            btnProcess.querySelector('.btn-spinner').classList.add('hidden');
        }
    });

    // Clear Preview
    btnClear.addEventListener('click', () => {
        previewForm.reset();
        resultCard.classList.add('hidden');
        promptInput.value = '';
        populateCustomDropdownOptions('ai-preview', '');
        const today = new Date();
        datepickerState['ai-preview'] = {
            currentMonth: today.getMonth(),
            currentYear: today.getFullYear(),
            selectedDate: today
        };
        previewDateInput.value = formatDateISO(today);
        document.querySelector('#ai-preview-date-trigger .selected-date').textContent = formatDateDisplay(today);
    });

    // Save Parsed Transaction
    previewForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = previewTypeInput.value;
        const catName = previewCategoryInput.value;
        const matchedCat = state.categories.find(c => c.name === catName);

        const data = {
            type,
            amount: parseFloat(previewAmountInput.value),
            category_name: catName,
            category_icon: matchedCat ? matchedCat.icon : '📦',
            category_color: matchedCat ? matchedCat.color : '#ADB5BD',
            date: previewDateInput.value,
            description: previewDescInput.value.trim()
        };

        if (type === 'income') {
            const hrs = parseFloat(hoursInput.value);
            const wg = parseFloat(wageInput.value);
            if (!isNaN(hrs) && !isNaN(wg)) {
                data.hours_worked = hrs;
                data.hourly_wage = wg;
            }
            const tr = parseFloat(taxRateInput.value);
            if (!isNaN(tr)) {
                data.tax_rate = tr;
            }
            const gr = parseFloat(grossAmountInput.value);
            if (!isNaN(gr)) {
                data.gross_amount = gr;
            }
        }

        try {
            const response = await apiCall('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (response.ok) {
                showToast('Transaction logged successfully!', 'success');
                previewForm.reset();
                resultCard.classList.add('hidden');
                promptInput.value = '';
                await fetchData();
                switchTab('dashboard');
            } else {
                showToast(result.error || 'Failed to save transaction', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Network error while saving transaction', 'error');
        }
    });
}
