// ==========================================================================
// TRACKIFY APPLICATION STATE & INITIALIZATION
// ==========================================================================

const state = {
    transactions: [],
    categories: [],
    activeTab: 'dashboard',
    chartFilter: 'all', // 'all', 'month', 'week'
    dashboardRange: 'all', // 'all', 'week', 'month', '6months', 'ytd', 'year'
    currentUser: null,
    profile: null, // onboarding profile from /api/profile, or null
    authMode: 'login' // 'login' or 'register'
};

// DOM Elements
const elements = {
    // Auth Containers
    coverContainer: document.getElementById('cover-container'),
    authContainer: document.getElementById('auth-container'),
    appContainer: document.getElementById('app-container'),
    weeklyEmailToggle: document.getElementById('weekly-email-toggle'),

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
    dashboardRangeTrigger: document.getElementById('dashboard-range-trigger'),
    dashboardRangeTriggerText: document.querySelector('.dashboard-range-trigger-text'),
    dashboardRangeOptions: document.getElementById('dashboard-range-options'),
    
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

    // Initialize Advisor Events
    initAdvisorEvents();

    // Initialize dashboard card spotlight-hover effect
    initSpotlightCards();

    // Wire up the dashboard's "Showing" time-range dropdown
    initDashboardRangeDropdown();

    // Wire up the marketing cover page (About scroll-reveal, CTA hand-off)
    initCoverPage();

    // First-login welcome popup and the Settings "Your profile" card
    initOnboarding();
    initProfileSettings();

    // Check authentication and initialize app data
    initAuth();
});

// Tracks the cursor over every card in the app to drive the CSS
// spotlight-hover glow (--spot-x/--spot-y, see style.css). Delegated on
// document so it keeps working after any tab's cards are re-rendered -
// nothing here depends on specific DOM node identity.
function initSpotlightCards() {
    const SPOTLIGHT_SELECTOR = '.stats-grid-unified, .card.glass';
    document.addEventListener('mousemove', (e) => {
        const card = e.target.closest(SPOTLIGHT_SELECTOR);
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
    });
}

// ==========================================================================
// COVER / MARKETING PAGE
// Shown to logged-out visitors before the login form. initAuth() decides
// whether the cover or the app is visible on load; this just wires up its
// own interactions (About scroll, hero entrance, CTA hand-off to login).
// ==========================================================================
function initCoverPage() {
    const btnCoverCta = document.getElementById('btn-cover-cta');
    const btnCoverAboutCta = document.getElementById('btn-cover-about-cta');
    const btnCoverAbout = document.getElementById('btn-cover-about');
    const coverAbout = document.getElementById('cover-about');
    const coverHeadline = document.getElementById('cover-headline');

    // Hero entrance: mask each word of the headline behind overflow:hidden
    // and slide it up into place, staggered - a lightweight, dependency-free
    // version of a text-mask reveal (no need for a SplitText-style library
    // for a single headline). The subtext/CTA fade in just behind it.
    if (coverHeadline) {
        const words = coverHeadline.textContent.trim().split(/\s+/);
        coverHeadline.textContent = '';
        words.forEach((word, i) => {
            const mask = document.createElement('span');
            mask.className = 'word-mask';
            const inner = document.createElement('span');
            inner.className = 'word-inner';
            inner.textContent = word;
            inner.style.transitionDelay = `${i * 0.05}s`;
            mask.appendChild(inner);
            coverHeadline.appendChild(mask);
            coverHeadline.appendChild(document.createTextNode(' '));
        });
        // Double rAF so the initial (unrevealed) state actually paints
        // before the class flips - otherwise the browser can coalesce
        // both states into one frame and skip the transition entirely.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                coverHeadline.classList.add('headline-revealed');
            });
        });
    }

    document.querySelectorAll('.cover-fade-item').forEach((el, i) => {
        el.style.transitionDelay = `${0.35 + i * 0.1}s`;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.classList.add('revealed');
            });
        });
    });

    // Hand off from the cover to the login form. Plays a brief exit
    // transition on the cover, then swaps visibility once it finishes.
    function goToAuth() {
        if (!elements.coverContainer) return;
        elements.coverContainer.classList.add('cover-exit');
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(fallbackTimer);
            elements.coverContainer.removeEventListener('transitionend', finish);
            elements.coverContainer.classList.add('hidden');
            elements.coverContainer.classList.remove('cover-exit');
            elements.authContainer.classList.remove('hidden');
            const authCard = document.querySelector('.auth-card');
            if (authCard) {
                authCard.classList.remove('auth-enter-animate');
                void authCard.offsetWidth;
                authCard.classList.add('auth-enter-animate');
            }
        };
        elements.coverContainer.addEventListener('transitionend', finish);
        // transitionend can be skipped (e.g. tab backgrounded mid-transition),
        // which would leave the visitor stuck on the cover - so also finish on a timer.
        const fallbackTimer = setTimeout(finish, 600);
    }

    // Reverse hand-off: back out of the login form to the cover. Forces
    // the cover's exit state first, then releases it next frame so the
    // existing opacity/transform transition plays as a fade-IN instead.
    function goToCover() {
        if (!elements.coverContainer) return;
        elements.authContainer.classList.add('hidden');
        elements.coverContainer.classList.remove('hidden');
        elements.coverContainer.classList.add('cover-exit');
        void elements.coverContainer.offsetWidth;
        requestAnimationFrame(() => {
            elements.coverContainer.classList.remove('cover-exit');
        });
    }

    const btnAuthBack = document.getElementById('btn-auth-back');
    if (btnAuthBack) btnAuthBack.addEventListener('click', goToCover);

    if (btnCoverCta) btnCoverCta.addEventListener('click', goToAuth);
    if (btnCoverAboutCta) btnCoverAboutCta.addEventListener('click', goToAuth);

    if (btnCoverAbout && coverAbout) {
        btnCoverAbout.addEventListener('click', () => {
            coverAbout.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // Scroll-reveal for the About section's feature blocks: one-shot,
    // staggered by each item's index within its row.
    const revealItems = document.querySelectorAll('#cover-about .reveal-item');
    if (revealItems.length && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const group = Array.from(entry.target.parentElement.children);
                const index = group.indexOf(entry.target);
                entry.target.style.transitionDelay = `${index * 0.08}s`;
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.2 });
        revealItems.forEach(item => observer.observe(item));
    } else {
        revealItems.forEach(item => item.classList.add('revealed'));
    }
}

// ==========================================================================
// FIXED-POSITION DROPDOWN HELPER
// ==========================================================================
// position:fixed is normally relative to the viewport - but per spec, any
// ancestor with a non-"none" transform/perspective/filter (or
// will-change:transform) becomes its containing block instead. Every
// .tab-content keeps animation-fill-mode:forwards on tabFadeIn, so even
// long after the entrance animation finishes it still computes to
// `transform: matrix(1,0,0,1,0,0)` - the identity matrix, visually a
// no-op, but NOT the literal value "none". That silently turns every tab
// into exactly such a containing block, so a fixed-position dropdown
// positioned with plain getBoundingClientRect() math renders dozens of
// pixels away from where it was told to go (off by whatever the tab
// content's own offset from the viewport happens to be).
// This finds that real containing block's viewport offset, if any, so it
// can be subtracted back out when setting style.top/left.
function getFixedPositioningOffset(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        if (cs.transform !== 'none' || cs.perspective !== 'none' ||
            (cs.filter && cs.filter !== 'none') ||
            (cs.willChange && cs.willChange.includes('transform'))) {
            const rect = node.getBoundingClientRect();
            return { top: rect.top, left: rect.left };
        }
        node = node.parentElement;
    }
    return { top: 0, left: 0 };
}

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
            elements.coverContainer.classList.add('hidden');
            elements.authContainer.classList.add('hidden');
            elements.appContainer.classList.remove('hidden');
            // The floating advisor button is a fixed-position element outside
            // both #cover-container and #app-container, so it needs its own
            // explicit show/hide here - it must only exist once actually
            // logged into the app, never on the cover or login screen.
            document.getElementById('btn-advisor-float').classList.remove('hidden');
            // Wires up the sidebar Log Out button (among other auth listeners).
            // Without this, a user who loads the page already logged in (the
            // normal case) gets a dead Log Out button - the listener was only
            // ever attached from the "no session" branch below.
            setupAuthEventListeners();
            fetchData();
            loadProfileAndOnboard(session.user);
            // Dashboard starts marked active in the server-rendered HTML
            // (never goes through switchTab() on first load), so it needs
            // its own stagger trigger here.
            applyTabStagger(document.getElementById('dashboard'));
        } else {
            state.currentUser = null;
            elements.appContainer.classList.add('hidden');
            elements.authContainer.classList.add('hidden');
            elements.coverContainer.classList.remove('hidden');
            document.getElementById('btn-advisor-float').classList.add('hidden');
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
                // Straight back to the login form, not the marketing cover -
                // a logout is a returning user, not a first-time visitor.
                state.currentUser = null;
                resetProfileState();
                elements.appContainer.classList.add('hidden');
                elements.coverContainer.classList.add('hidden');
                elements.authContainer.classList.remove('hidden');
                document.getElementById('btn-advisor-float').classList.add('hidden');
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
    resetProfileState();
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
// ONBOARDING & PROFILE (first-login welcome popup, greetings, Settings card)
// ==========================================================================

// Accounts created before the welcome popup shipped never see it - they can
// still fill in their profile from Settings. Compared against Supabase's
// user.created_at.
const ONBOARDING_CUTOFF = '2026-10-03T00:00:00Z';

const LIFE_STAGE_OPTIONS = [
    { value: 'student', label: 'Student' },
    { value: 'adult', label: 'Adult' },
    { value: 'retired', label: 'Retired' }
];

const PROFILE_NAME_MAX = 50;
const PROFILE_GOAL_MAX = 500;
const ONBOARDING_SUCCESS_HOLD_MS = 1700;

// Life-stage dropdown instances, created in initOnboarding/initProfileSettings
let onboardingStageSelect = null;
let settingsStageSelect = null;

function isNewSignup(user) {
    return !!(user && user.created_at && new Date(user.created_at) >= new Date(ONBOARDING_CUTOFF));
}

async function fetchProfile() {
    const response = await apiCall('/api/profile');
    if (!response.ok) throw new Error('Failed to load profile');
    const data = await response.json();
    state.profile = data.profile || null;
}

// Runs after login: loads the profile, personalizes the UI, and opens the
// welcome popup for brand-new accounts that haven't filled it in yet.
async function loadProfileAndOnboard(user) {
    try {
        await fetchProfile();
    } catch (err) {
        console.error('Error fetching profile:', err);
        return;
    }
    applyProfileGreeting();
    populateProfileSettings();
    renderAdvisorHistory();
    if (!state.profile && isNewSignup(user)) {
        openOnboarding();
    }
}

function applyProfileGreeting() {
    const greetingEl = document.getElementById('dashboard-greeting');
    const profile = state.profile;
    if (greetingEl) {
        greetingEl.textContent = profile ? `Hi ${profile.first_name}` : 'Financial Overview';
    }
    if (profile) {
        elements.sidebarUserWelcome.textContent = `${profile.first_name} ${profile.last_name}`;
    } else {
        elements.sidebarUserWelcome.textContent = state.currentUser ? `Logged in as ${state.currentUser}` : 'Welcome!';
    }
}

// Called on logout / session expiry so the next account starts clean.
function resetProfileState() {
    state.profile = null;
    closeOnboarding(true);
    applyProfileGreeting();
    populateProfileSettings();
}

// Same rules as helpers.parse_profile_payload on the backend. Returns an
// error message, or null when the payload is valid.
function validateProfilePayload(payload) {
    if (!payload.first_name) return 'Please enter your first name.';
    if (!payload.last_name) return 'Please enter your last name.';
    if (payload.first_name.length > PROFILE_NAME_MAX || payload.last_name.length > PROFILE_NAME_MAX) {
        return `Names must be ${PROFILE_NAME_MAX} characters or fewer.`;
    }
    if (!payload.life_stage) return 'Please choose whether you are a student, adult or retired.';
    if (!payload.savings_goal) return 'Please tell us a little about your goals and finances.';
    if (payload.savings_goal.length > PROFILE_GOAL_MAX) {
        return `This must be ${PROFILE_GOAL_MAX} characters or fewer.`;
    }
    return null;
}

async function saveProfile(payload) {
    const response = await apiCall('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Could not save your profile. Please try again.');
    }
    state.profile = data.profile;
    applyProfileGreeting();
    populateProfileSettings();
    renderAdvisorHistory();
}

function showProfileError(el, message) {
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
}

function wireGoalCounter(textarea, counter) {
    const update = () => {
        const len = textarea.value.length;
        counter.textContent = `${len}/${PROFILE_GOAL_MAX}`;
        counter.classList.toggle('near-limit', len > PROFILE_GOAL_MAX - 50);
    };
    textarea.addEventListener('input', update);
    update();
    return update;
}

// Builds an accessible custom dropdown (listbox) inside `container`, styled
// like the dashboard "Showing" dropdown. Returns { getValue, setValue }.
function createLifeStageSelect(container) {
    const labelId = container.dataset.labelledby;
    const listId = `${container.id}-list`;
    container.innerHTML = `
        <button type="button" class="life-stage-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="${listId}" ${labelId ? `aria-labelledby="${labelId} ${container.id}-value"` : ''}>
            <span class="life-stage-value is-placeholder" id="${container.id}-value">Choose one</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="life-stage-chevron" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="life-stage-options hidden" role="listbox" id="${listId}" ${labelId ? `aria-labelledby="${labelId}"` : ''}>
            ${LIFE_STAGE_OPTIONS.map(o => `<div class="life-stage-option" role="option" tabindex="-1" aria-selected="false" data-value="${o.value}">${o.label}</div>`).join('')}
        </div>
    `;

    const trigger = container.querySelector('.life-stage-trigger');
    const valueEl = container.querySelector('.life-stage-value');
    const list = container.querySelector('.life-stage-options');
    const options = Array.from(container.querySelectorAll('.life-stage-option'));
    let value = '';

    const isOpen = () => !list.classList.contains('hidden');

    const open = () => {
        list.classList.remove('hidden');
        trigger.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        const selected = options.find(o => o.dataset.value === value) || options[0];
        selected.focus();
    };

    const close = (refocus) => {
        if (!isOpen()) return;
        list.classList.add('hidden');
        trigger.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        if (refocus) trigger.focus();
    };

    const setValue = (newValue) => {
        const match = LIFE_STAGE_OPTIONS.find(o => o.value === newValue);
        value = match ? match.value : '';
        valueEl.textContent = match ? match.label : 'Choose one';
        valueEl.classList.toggle('is-placeholder', !match);
        options.forEach(o => {
            const selected = o.dataset.value === value;
            o.classList.toggle('active', selected);
            o.setAttribute('aria-selected', String(selected));
        });
    };

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen() ? close(false) : open();
    });

    trigger.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            open();
        }
    });

    options.forEach((opt, i) => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            setValue(opt.dataset.value);
            close(true);
        });
        opt.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                options[(i + 1) % options.length].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                options[(i - 1 + options.length) % options.length].focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setValue(opt.dataset.value);
                close(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close(true);
            } else if (e.key === 'Tab') {
                close(false);
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) close(false);
    });

    return { getValue: () => value, setValue };
}

function readProfileForm(prefix, stageSelect) {
    return {
        first_name: document.getElementById(`${prefix}-first-name`).value.trim(),
        last_name: document.getElementById(`${prefix}-last-name`).value.trim(),
        life_stage: stageSelect ? stageSelect.getValue() : '',
        savings_goal: document.getElementById(`${prefix}-goal`).value.trim()
    };
}

// ---- Welcome popup ----

function getOnboardingFocusables() {
    const modal = document.getElementById('onboarding-modal');
    return Array.from(modal.querySelectorAll('button, input, textarea, [tabindex="0"]'))
        .filter(el => !el.disabled && el.offsetParent !== null);
}

function setAppInert(inert) {
    ['app-container', 'btn-advisor-float', 'advisor-drawer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.inert = inert;
    });
}

function openOnboarding() {
    const modal = document.getElementById('onboarding-modal');
    if (!modal || modal.classList.contains('open')) return;

    document.getElementById('onboarding-form').reset();
    if (onboardingStageSelect) onboardingStageSelect.setValue('');
    document.getElementById('onboarding-goal').dispatchEvent(new Event('input'));
    showProfileError(document.getElementById('onboarding-error'), '');
    document.getElementById('onboarding-form-step').classList.remove('hidden', 'is-leaving');
    document.getElementById('onboarding-success-step').classList.add('hidden');

    modal.classList.remove('hidden', 'is-closing');
    setAppInert(true);
    document.body.classList.add('onboarding-active');
    // Reflow so the .open transition runs from the hidden state
    void modal.offsetWidth;
    modal.classList.add('open');

    setTimeout(() => document.getElementById('onboarding-first-name').focus({ preventScroll: true }), 700);
}

function closeOnboarding(immediate = false) {
    const modal = document.getElementById('onboarding-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    const finish = () => {
        modal.classList.add('hidden');
        modal.classList.remove('open', 'is-closing');
        setAppInert(false);
        document.body.classList.remove('onboarding-active');
    };

    if (immediate) {
        finish();
        return;
    }
    modal.classList.add('is-closing');
    modal.classList.remove('open');
    setTimeout(finish, 550);
}

function initOnboarding() {
    const modal = document.getElementById('onboarding-modal');
    if (!modal) return;

    onboardingStageSelect = createLifeStageSelect(document.getElementById('onboarding-stage-select'));
    modal.querySelectorAll('.onboarding-reveal').forEach((el, i) => el.style.setProperty('--i', i));
    wireGoalCounter(document.getElementById('onboarding-goal'), document.getElementById('onboarding-goal-count'));

    // Required popup: Escape does nothing, and Tab stays inside the card.
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            return;
        }
        if (e.key !== 'Tab') return;
        const focusables = getOnboardingFocusables();
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });

    const form = document.getElementById('onboarding-form');
    const submitBtn = document.getElementById('btn-onboarding-submit');
    const errorEl = document.getElementById('onboarding-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = readProfileForm('onboarding', onboardingStageSelect);
        const validationError = validateProfilePayload(payload);
        showProfileError(errorEl, validationError);
        if (validationError) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
        try {
            await saveProfile(payload);
            document.getElementById('onboarding-success-title').textContent = `You're all set, ${state.profile.first_name}`;
            const formStep = document.getElementById('onboarding-form-step');
            const successStep = document.getElementById('onboarding-success-step');
            formStep.classList.add('is-leaving');
            setTimeout(() => {
                formStep.classList.add('hidden');
                successStep.classList.remove('hidden');
            }, 260);
            setTimeout(() => closeOnboarding(), 260 + ONBOARDING_SUCCESS_HOLD_MS);
        } catch (err) {
            if (err.message !== 'Unauthorized') showProfileError(errorEl, err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Get started';
        }
    });
}

// ---- Settings "Your profile" card ----

let refreshSettingsGoalCounter = null;

function populateProfileSettings() {
    const profile = state.profile;
    const first = document.getElementById('profile-first-name');
    if (!first) return;
    first.value = profile ? profile.first_name : '';
    document.getElementById('profile-last-name').value = profile ? profile.last_name : '';
    document.getElementById('profile-goal').value = profile ? profile.savings_goal : '';
    if (settingsStageSelect) settingsStageSelect.setValue(profile ? profile.life_stage : '');
    if (refreshSettingsGoalCounter) refreshSettingsGoalCounter();
    showProfileError(document.getElementById('profile-settings-error'), '');
}

function initProfileSettings() {
    const form = document.getElementById('profile-settings-form');
    if (!form) return;

    settingsStageSelect = createLifeStageSelect(document.getElementById('profile-stage-select'));
    refreshSettingsGoalCounter = wireGoalCounter(document.getElementById('profile-goal'), document.getElementById('profile-goal-count'));

    const saveBtn = document.getElementById('btn-profile-save');
    const errorEl = document.getElementById('profile-settings-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = readProfileForm('profile', settingsStageSelect);
        const validationError = validateProfilePayload(payload);
        showProfileError(errorEl, validationError);
        if (validationError) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            await saveProfile(payload);
            showToast('Profile saved.', 'success');
        } catch (err) {
            if (err.message !== 'Unauthorized') showProfileError(errorEl, err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save profile';
        }
    });
}

// ==========================================================================
// DATA FETCHING & STATE MANAGEMENT
// ==========================================================================
async function fetchData() {
    // Runs the four independently - one failing fetch/render no longer
    // blocks the others from populating.
    const names = ['categories', 'transactions', 'settings', 'advisorHistory'];
    const results = await Promise.allSettled([
        fetchCategories(),
        fetchTransactions(),
        fetchUserSettings(),
        fetchAdvisorHistory()
    ]);

    let hasNetworkError = false;
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            const err = r.reason;
            console.error(`Error fetching ${names[i]}:`, err);
            const isNetworkError = err instanceof TypeError ||
                                   err.message.includes('Failed to fetch') ||
                                   err.message.includes('NetworkError') ||
                                   err.message.includes('Network request failed');
            if (isNetworkError) hasNetworkError = true;
        }
    });

    if (hasNetworkError) {
        showToast('Failed to connect to Flask API server. Make sure server is running.', 'error');
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// ==========================================================================
// USER SETTINGS
// ==========================================================================
async function fetchUserSettings() {
    const response = await apiCall('/api/settings');
    if (!response.ok) throw new Error('Failed to load settings');
    const settings = await response.json();
    if (elements.weeklyEmailToggle) {
        elements.weeklyEmailToggle.checked = !!settings.weekly_email_enabled;
    }
}

async function saveUserSettings() {
    if (!elements.weeklyEmailToggle) return;
    try {
        const response = await apiCall('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekly_email_enabled: elements.weeklyEmailToggle.checked })
        });
        if (response.ok) {
            showToast(
                elements.weeklyEmailToggle.checked ? 'Weekly recap emails turned on.' : 'Weekly recap emails turned off.',
                'success'
            );
        } else {
            const errRes = await response.json();
            showToast(errRes.error || 'Failed to update settings', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error connecting to server', 'error');
    }
}

// ==========================================================================
// AI ADVISOR CHAT SYSTEM — MULTI-SESSION
// ==========================================================================
let chatHistory = [];
let currentSessionId = null;
let sessions = [];

// ---- Session Management ----

async function fetchSessions() {
    try {
        const response = await apiCall('/api/advisor/sessions');
        if (response.ok) {
            sessions = await response.json();
            renderSessionsList();
            renderDrawerSessionSelector();
        }
    } catch (err) {
        console.error('Failed to load sessions:', err);
    }
}

async function createSession() {
    try {
        const response = await apiCall('/api/advisor/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'New Chat' })
        });
        if (response.ok) {
            const session = await response.json();
            sessions.unshift(session);
            renderSessionsList();
            renderDrawerSessionSelector();
            await switchSession(session.id);
        }
    } catch (err) {
        console.error('Failed to create session:', err);
        showToast('Could not create a new chat.', 'error');
    }
}

async function deleteSession(sessionId, e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    try {
        const response = await apiCall(`/api/advisor/sessions/${sessionId}`, { method: 'DELETE' });
        if (response.ok) {
            sessions = sessions.filter(s => s.id !== sessionId);
            if (currentSessionId === sessionId) {
                // Switch to next session or clear
                if (sessions.length > 0) {
                    await switchSession(sessions[0].id);
                } else {
                    currentSessionId = null;
                    chatHistory = [];
                    renderAdvisorHistory();
                    updateSessionTitle('New Chat');
                }
            }
            renderSessionsList();
            renderDrawerSessionSelector();
            showToast('Conversation deleted.', 'success');
        } else {
            const errRes = await response.json().catch(() => ({}));
            showToast(errRes.error || 'Could not delete conversation.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Could not delete conversation.', 'error');
    }
}

async function switchSession(sessionId) {
    currentSessionId = sessionId;
    renderSessionsList(); // update active highlight immediately
    renderDrawerSessionSelector();
    await fetchAdvisorHistory();
    // Update header title
    const session = sessions.find(s => s.id === sessionId);
    updateSessionTitle(session ? session.title : 'New Chat');
}

function updateSessionTitle(title) {
    const titleEl = document.getElementById('advisor-fs-session-title');
    if (titleEl) titleEl.textContent = title;
}

function renderDrawerSessionSelector() {
    const select = document.getElementById('advisor-drawer-session-select');
    if (!select) return;

    if (sessions.length === 0) {
        select.innerHTML = '<option value="">No conversations</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = sessions.map(s => {
        const isSelected = s.id === currentSessionId ? 'selected' : '';
        const shortTitle = s.title.length > 25 ? s.title.slice(0, 25) + '…' : s.title;
        return `<option value="${s.id}" ${isSelected}>${escapeHtml(shortTitle)}</option>`;
    }).join('');
}

function renderSessionsList() {
    const list = document.getElementById('advisor-sessions-list');
    if (!list) return;

    if (sessions.length === 0) {
        list.innerHTML = `<div class="advisor-sessions-empty">No conversations yet.<br>Click "New Chat" to start.</div>`;
        return;
    }

    list.innerHTML = sessions.map(s => {
        const isActive = s.id === currentSessionId;
        const date = new Date(s.updated_at || s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `
            <div class="advisor-session-item ${isActive ? 'active' : ''}" data-session-id="${s.id}">
                <div class="advisor-session-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div class="advisor-session-info">
                    <div class="advisor-session-title">${escapeHtml(s.title)}</div>
                    <div class="advisor-session-date">${date}</div>
                </div>
                <button type="button" class="advisor-session-delete" data-session-id="${s.id}" title="Delete conversation">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');

    // Bind click events
    list.querySelectorAll('.advisor-session-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Prevent switching if the delete button was clicked
            if (e.target.closest('.advisor-session-delete')) return;
            const id = parseInt(item.getAttribute('data-session-id'));
            if (id && id !== currentSessionId) switchSession(id);
        });
    });
    list.querySelectorAll('.advisor-session-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const id = parseInt(btn.getAttribute('data-session-id'));
            if (id) deleteSession(id, e);
        });
    });
}

// ---- History & Rendering ----

async function fetchAdvisorHistory() {
    try {
        const url = currentSessionId ? `/api/advisor/history?session_id=${currentSessionId}` : '/api/advisor/history';
        const response = await apiCall(url);
        if (response.ok) {
            chatHistory = await response.json();
            renderAdvisorHistory();
        }
    } catch (err) {
        console.error('Failed to load chat history:', err);
    }
}

// Returns the currently visible chat area (full-screen tab takes priority)
function getActiveChatArea() {
    const fsArea = document.getElementById('advisor-fs-chat-area');
    const drawerArea = document.getElementById('advisor-chat-area');
    if (fsArea && document.getElementById('advisor-tab')?.classList.contains('active')) {
        return fsArea;
    }
    return drawerArea;
}

function renderAdvisorHistory() {
    const firstName = state.profile ? escapeHtml(state.profile.first_name) : '';
    const welcomeHtml = `
        <div class="advisor-fs-welcome">
            <span class="advisor-fs-eyebrow">AI Advisor</span>
            <h3>${firstName ? `Hi ${firstName}, I'm your Trackify financial coach.` : "Hi, I'm your Trackify financial coach."}</h3>
            <p>I can see your real spending and budget categories. Ask me anything, from cutting costs to hitting your targets faster.</p>
        </div>
    `;
    const drawerWelcomeHtml = `
        <div class="advisor-welcome-msg">
            <div class="advisor-avatar">🤖</div>
            <p>Hi ${firstName || 'there'}! I am your <strong>Trackify Financial Coach</strong>. I can analyze your MTD spending and help you build healthy budget habits. How can I help you today?</p>
        </div>
    `;

    let msgHtml = '';
    chatHistory.forEach(msg => {
        const isUser = msg.role === 'user';
        msgHtml += `
            <div class="chat-bubble ${isUser ? 'user' : 'model'}">
                ${escapeHtml(msg.content)}
            </div>
        `;
    });

    // Update drawer
    const drawerArea = document.getElementById('advisor-chat-area');
    if (drawerArea) {
        drawerArea.innerHTML = drawerWelcomeHtml + msgHtml;
        scrollToBottom(drawerArea);
    }

    // Update full-screen tab
    const fsArea = document.getElementById('advisor-fs-chat-area');
    if (fsArea) {
        fsArea.innerHTML = welcomeHtml + msgHtml;
        scrollToBottom(fsArea);
    }
}

function scrollToBottom(element) {
    setTimeout(() => {
        element.scrollTop = element.scrollHeight;
    }, 50);
}

function showTypingIndicator() {
    const chatArea = getActiveChatArea();
    if (!chatArea) return;
    const existing = document.getElementById('advisor-typing-indicator');
    if (existing) existing.remove();
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator-container';
    indicator.id = 'advisor-typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatArea.appendChild(indicator);
    scrollToBottom(chatArea);
}

function hideTypingIndicator() {
    const indicator = document.getElementById('advisor-typing-indicator');
    if (indicator) indicator.remove();
}

// ---- Event Wiring ----

function initAdvisorEvents() {
    // Drawer elements
    const btnFloat = document.getElementById('btn-advisor-float');
    const btnClose = document.getElementById('btn-close-drawer');
    const backdrop = document.getElementById('advisor-drawer-backdrop');
    const drawer = document.getElementById('advisor-drawer');

    const chatForm = document.getElementById('advisor-chat-form');
    const chatInput = document.getElementById('advisor-chat-input');
    const btnClear = document.getElementById('btn-clear-chat');
    const btnMic = document.getElementById('btn-advisor-mic');
    const btnDrawerNewChat = document.getElementById('btn-drawer-new-chat');
    const drawerSessionSelect = document.getElementById('advisor-drawer-session-select');

    // Full-screen elements
    const fsForm = document.getElementById('advisor-fs-form');
    const fsInput = document.getElementById('advisor-fs-input');
    const btnFsClear = document.getElementById('btn-fs-clear-chat');
    const btnFsMic = document.getElementById('btn-fs-mic');
    const btnNewChat = document.getElementById('btn-new-chat');

    // ---- Drawer ----
    const openDrawer = async () => {
        if (drawer && backdrop) {
            drawer.classList.add('active');
            backdrop.classList.add('active');
            await fetchSessions();
            if (sessions.length > 0) {
                if (!currentSessionId) {
                    await switchSession(sessions[0].id);
                } else {
                    renderDrawerSessionSelector();
                    fetchAdvisorHistory();
                }
            } else {
                renderDrawerSessionSelector();
                chatHistory = [];
                renderAdvisorHistory();
            }
        }
    };
    const closeDrawer = () => {
        if (drawer && backdrop) {
            drawer.classList.remove('active');
            backdrop.classList.remove('active');
        }
    };
    if (btnFloat) btnFloat.addEventListener('click', openDrawer);
    if (btnClose) btnClose.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // ---- Drawer Session Selector ----
    if (drawerSessionSelect) {
        drawerSessionSelect.addEventListener('change', async (e) => {
            const val = parseInt(e.target.value);
            if (val && val !== currentSessionId) {
                await switchSession(val);
            }
        });
    }

    // ---- Drawer "New Chat" -> redirects to Full-Screen AI Advisor tab ----
    if (btnDrawerNewChat) {
        btnDrawerNewChat.addEventListener('click', async () => {
            closeDrawer();
            switchTab('advisor-tab');
            await createSession();
            const input = document.getElementById('advisor-fs-input');
            if (input) input.focus();
        });
    }

    // ---- Full-Screen New Chat ----
    if (btnNewChat) btnNewChat.addEventListener('click', createSession);

    // ---- Shared send logic ----
    const sendMessage = async (message, inputEl) => {
        if (!message) return;

        // Auto-create session if none selected
        if (!currentSessionId) {
            await createSession();
            if (!currentSessionId) return; // bail if creation failed
        }

        inputEl.value = '';
        chatHistory.push({ role: 'user', content: message });
        renderAdvisorHistory();
        showTypingIndicator();

        try {
            const response = await apiCall('/api/advisor/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, session_id: currentSessionId })
            });
            hideTypingIndicator();
            if (response.ok) {
                const result = await response.json();
                chatHistory.push({ role: 'model', content: result.reply });
                renderAdvisorHistory();
                // Refresh sessions list so auto-renamed title shows
                await fetchSessions();
                const updated = sessions.find(s => s.id === currentSessionId);
                if (updated) updateSessionTitle(updated.title);
            } else {
                const errRes = await response.json();
                showToast(errRes.error || 'Rate limit exceeded or error occurred.', 'error');
            }
        } catch (err) {
            hideTypingIndicator();
            console.error(err);
            showToast('Connection error to financial advisor service', 'error');
        }
    };

    // ---- Shared clear logic (clears messages in current session) ----
    const clearMemory = async () => {
        if (!currentSessionId) return;
        if (confirm('Clear all messages in this conversation? This cannot be undone.')) {
            try {
                const response = await apiCall(`/api/advisor/history?session_id=${currentSessionId}`, { method: 'DELETE' });
                if (response.ok) {
                    showToast('Conversation cleared!', 'success');
                    chatHistory = [];
                    renderAdvisorHistory();
                } else {
                    showToast('Failed to clear messages', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Connection error', 'error');
            }
        }
    };

    // ---- Drawer form ----
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage(chatInput.value.trim(), chatInput);
        });
    }
    if (btnClear) btnClear.addEventListener('click', clearMemory);

    // ---- Full-screen form ----
    if (fsForm) {
        fsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage(fsInput.value.trim(), fsInput);
        });
    }
    if (btnFsClear) btnFsClear.addEventListener('click', clearMemory);

    // ---- Voice mic factory ----
    const setupMic = (btn, inputEl) => {
        if (!btn || !inputEl) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { btn.style.display = 'none'; return; }
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.classList.contains('recording')) { recognition.stop(); }
            else { try { recognition.start(); } catch (ex) { console.error(ex); } }
        });
        recognition.onstart = () => { btn.classList.add('recording'); inputEl.placeholder = 'Listening...'; };
        recognition.onerror = () => { btn.classList.remove('recording'); inputEl.placeholder = ''; };
        recognition.onend = () => { btn.classList.remove('recording'); inputEl.placeholder = ''; };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) { inputEl.value = transcript; inputEl.focus(); }
        };
    };
    setupMic(btnMic, chatInput);
    setupMic(btnFsMic, fsInput);
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
    if (!displayVal) return;
    
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

// Counts a stat value up (or down) from 0 to its real total instead of just
// snapping the text in - the classic "the numbers are alive" fintech touch.
// Keyed per-element so a fast re-render (e.g. adding a transaction right
// after switching tabs) cancels the in-flight count instead of racing it.
const _countUpFrames = new WeakMap();

function animateCountUp(el, target, duration = 900) {
    if (!el) return;
    const existing = _countUpFrames.get(el);
    if (existing) cancelAnimationFrame(existing);

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.textContent = formatCurrency(target);
        return;
    }

    const start = performance.now();
    const from = 0;

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease-out cubic: fast start, gentle settle - reads as "counting up
        // energetically" rather than a linear odometer.
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (target - from) * eased;
        el.textContent = formatCurrency(current);

        if (progress < 1) {
            _countUpFrames.set(el, requestAnimationFrame(tick));
        } else {
            el.textContent = formatCurrency(target);
            _countUpFrames.delete(el);
        }
    }

    _countUpFrames.set(el, requestAnimationFrame(tick));
}

// Returns the [start, end] window for the selected dashboard range, plus the
// equivalent immediately-prior window for the "vs previous period" compare.
// 'all' has no prior window (there's nothing before "all time").
function getStatsRangeBounds(rangeKey, now) {
    const oneDay = 24 * 60 * 60 * 1000;
    if (rangeKey === 'ytd') {
        const jan1 = new Date(now.getFullYear(), 0, 1);
        const daysSoFar = Math.round((now - jan1) / oneDay);
        return {
            currentStart: jan1,
            prevStart: new Date(now.getFullYear() - 1, 0, 1),
            prevEnd: new Date(now.getFullYear() - 1, 0, 1 + daysSoFar)
        };
    }
    const spanDays = { week: 7, month: 30, '6months': 182, year: 365 }[rangeKey];
    if (!spanDays) return { currentStart: null, prevStart: null, prevEnd: null };
    const currentStart = new Date(now - spanDays * oneDay);
    return {
        currentStart,
        prevStart: new Date(currentStart - spanDays * oneDay),
        prevEnd: currentStart
    };
}

function sumTransactionsInRange(transactions, start, end) {
    let income = 0, expense = 0;
    transactions.forEach(t => {
        if (start) {
            const td = new Date(t.date);
            if (td < start || (end && td >= end)) return;
        }
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
    });
    return { income, expense };
}

// Updates one stat card's "vs previous period" sub-label with a real
// percentage change, colored by whether that change is favorable (more
// income is good, more expense is bad).
function updateCompareSubLabel(el, current, previous, higherIsGood) {
    if (!el) return;
    if (previous === 0) {
        el.textContent = current === 0 ? 'No activity yet' : 'New activity this period';
        el.style.color = 'var(--text-muted)';
        return;
    }
    const pct = ((current - previous) / previous) * 100;
    const sign = pct > 0 ? '+' : '';
    const favorable = higherIsGood ? pct >= 0 : pct <= 0;
    el.textContent = `${sign}${pct.toFixed(1)}% vs previous period`;
    el.style.color = favorable ? 'var(--color-emerald)' : 'var(--color-rose)';
}

function updateDashboardMetrics(animate = false) {
    // Replay a quick staggered "refresh" on the three stat cards when this
    // is a user-triggered range change (not the initial page load, which
    // already gets its own entrance stagger from applyTabStagger).
    if (animate) {
        const columns = document.querySelectorAll('.stats-grid-unified .stat-column');
        columns.forEach((col, i) => {
            col.classList.remove('refreshing');
            void col.offsetWidth;
            col.style.animationDelay = `${i * 0.06}s`;
            col.classList.add('refreshing');
        });
    }

    const now = new Date();
    const rangeKey = state.dashboardRange;
    const { currentStart, prevStart, prevEnd } = getStatsRangeBounds(rangeKey, now);

    const { income: incomeTotal, expense: expenseTotal } = sumTransactionsInRange(state.transactions, currentStart, null);
    const netSavings = incomeTotal - expenseTotal;

    // Update labels (count up rather than snapping the text in)
    animateCountUp(elements.dashboardTotalIncome, incomeTotal);
    animateCountUp(elements.dashboardTotalExpenses, expenseTotal);
    animateCountUp(elements.dashboardNetSavings, netSavings);

    const incomeSubEl = document.getElementById('dashboard-total-income-sub');
    const expensesSubEl = document.getElementById('dashboard-total-expenses-sub');
    const savingsRateEl = document.getElementById('dashboard-savings-rate');

    if (prevStart) {
        const prev = sumTransactionsInRange(state.transactions, prevStart, prevEnd);
        updateCompareSubLabel(incomeSubEl, incomeTotal, prev.income, true);
        updateCompareSubLabel(expensesSubEl, expenseTotal, prev.expense, false);
    } else {
        if (incomeSubEl) { incomeSubEl.textContent = 'All-time total'; incomeSubEl.style.color = 'var(--text-muted)'; }
        if (expensesSubEl) { expensesSubEl.textContent = 'All-time total'; expensesSubEl.style.color = 'var(--text-muted)'; }
    }
    if (savingsRateEl) {
        const savingsRate = incomeTotal > 0 ? Math.round((netSavings / incomeTotal) * 100) : 0;
        savingsRateEl.textContent = `Savings rate ${savingsRate}%`;
    }

    // The Net Balance card's color follows the selected period (it has to
    // match the number it's actually showing).
    elements.dashboardNetSavings.style.color = netSavings < 0 ? 'var(--color-rose)'
        : netSavings > 0 ? 'var(--color-emerald)' : 'var(--text-primary)';

    // Sidebar always reflects the true all-time balance, independent of
    // whatever range is selected on the dashboard - it's shown on every
    // tab, not just this one, so it shouldn't shift under the user when
    // they change the dashboard's own filter.
    const allTime = sumTransactionsInRange(state.transactions, null, null);
    const allTimeNet = allTime.income - allTime.expense;
    elements.sidebarNetBalance.textContent = formatCurrency(allTimeNet);

    if (allTimeNet < 0) {
        elements.sidebarNetBalance.style.color = 'var(--color-rose)';
        if (elements.sidebarStatusMsg) {
            elements.sidebarStatusMsg.innerHTML = 'Spending more than earning!';
            elements.sidebarStatusMsg.style.color = 'var(--color-rose)';
        }
    } else if (allTimeNet > 0) {
        elements.sidebarNetBalance.style.color = 'var(--color-emerald)';
        if (elements.sidebarStatusMsg) {
            elements.sidebarStatusMsg.innerHTML = 'Healthy savings progress!';
            elements.sidebarStatusMsg.style.color = 'var(--text-muted)';
        }
    } else {
        elements.sidebarNetBalance.style.color = 'var(--text-primary)';
        if (elements.sidebarStatusMsg) {
            elements.sidebarStatusMsg.innerHTML = 'Balance is perfectly neutral.';
            elements.sidebarStatusMsg.style.color = 'var(--text-muted)';
        }
    }
}

// ==========================================================================
// NAVIGATION CONTROLS
// ==========================================================================
function initNavigation() {
    const weeklyToggle = document.getElementById('weekly-email-toggle');
    if (weeklyToggle) {
        weeklyToggle.addEventListener('change', () => {
            saveUserSettings();
        });
    }

    elements.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            // The Log Out button shares the .nav-btn class (for styling) but
            // isn't a tab - it has no data-tab and has its own click handler.
            if (!tabName) return;
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

const DASHBOARD_RANGE_LABELS = {
    all: 'All time',
    week: 'Past week',
    month: 'Past month',
    '6months': 'Past 6 months',
    ytd: 'Year to date',
    year: 'Past year'
};

function closeDashboardRangeDropdown() {
    if (elements.dashboardRangeOptions) elements.dashboardRangeOptions.classList.add('hidden');
    if (elements.dashboardRangeTrigger) elements.dashboardRangeTrigger.classList.remove('open');
}
document.addEventListener('click', closeDashboardRangeDropdown);

function initDashboardRangeDropdown() {
    const trigger = elements.dashboardRangeTrigger;
    const options = elements.dashboardRangeOptions;
    if (!trigger || !options) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasHidden = options.classList.contains('hidden');
        closeAllCustomDropdowns();
        closeAllCustomCalendars();
        closeAllActionMenus();
        if (wasHidden) {
            // position:fixed with coordinates computed from the trigger,
            // same reasoning as the datepicker calendar fix elsewhere in
            // this file: a position:absolute dropdown can get clipped by
            // an ancestor's overflow:hidden (used here for card hover
            // glows), so this one is placed in viewport coordinates.
            const rect = trigger.getBoundingClientRect();
            const offset = getFixedPositioningOffset(trigger);
            options.classList.remove('hidden');
            const optionsWidth = options.offsetWidth;
            let left = rect.right - optionsWidth;
            left = Math.max(8, Math.min(left, window.innerWidth - optionsWidth - 8));
            options.style.left = `${left - offset.left}px`;
            options.style.top = `${rect.bottom + 8 - offset.top}px`;
            trigger.classList.add('open');
        }
    });

    options.addEventListener('click', (e) => e.stopPropagation());

    options.querySelectorAll('.dashboard-range-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const value = opt.getAttribute('data-value');
            if (value === state.dashboardRange) {
                closeDashboardRangeDropdown();
                return;
            }
            state.dashboardRange = value;
            options.querySelectorAll('.dashboard-range-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            if (elements.dashboardRangeTriggerText) {
                elements.dashboardRangeTriggerText.textContent = DASHBOARD_RANGE_LABELS[value] || value;
            }
            closeDashboardRangeDropdown();
            updateDashboardMetrics(true);
        });
    });
}

function switchTab(tabId) {
    state.activeTab = tabId;

    // Toggle body class so the float button hides on the advisor tab
    if (tabId === 'advisor-tab') {
        document.body.classList.add('advisor-tab-active');
        // Load sessions then auto-select (or create) the first one
        fetchSessions().then(async () => {
            if (sessions.length > 0) {
                if (!currentSessionId) await switchSession(sessions[0].id);
                else renderSessionsList(); // re-highlight active
            }
            // No auto-create on load — let user click "New Chat"
        });
    } else {
        document.body.classList.remove('advisor-tab-active');
    }

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

    // Re-render charts when switching to dashboard
    if (tabId === 'dashboard') {
        renderCharts();
    }

    // AI Advisor is a chat UI with its own message/session animations -
    // a generic card cascade doesn't fit it, so it's the one tab skipped.
    if (tabId !== 'advisor-tab') {
        const tabEl = document.getElementById(tabId);
        if (tabEl) applyTabStagger(tabEl);
    }
}

// Cascades a newly-active tab's top-level content blocks in with a
// staggered delay, instead of the whole tab mounting as one flat block.
// Deliberately JS-indexed rather than an nth-child/nth-of-type CSS
// selector - see the .stagger-item comment in style.css for why.
// "Grid wrapper" containers (multiple cards side by side) are expanded one
// level so each card in the row staggers individually; everything else
// (including list-like containers such as .category-grid, which can hold
// an unbounded number of items) is staggered as a single block so the
// total cascade stays short regardless of how much data a user has.
const STAGGER_GRID_WRAPPERS = ['dashboard-grid', 'log-grid', 'category-settings-container'];
const STAGGER_STEP_SECONDS = 0.06;
const STAGGER_MAX_STEPS = 7; // caps the delay for tabs with many top-level blocks

function applyTabStagger(tabEl) {
    const items = [];
    Array.from(tabEl.children).forEach(child => {
        if (STAGGER_GRID_WRAPPERS.some(cls => child.classList.contains(cls))) {
            items.push(...Array.from(child.children));
        } else {
            items.push(child);
        }
    });

    items.forEach((el, i) => {
        // Force the animation to restart even if this exact element was
        // already staggered once before (e.g. switching tabs and back
        // without a full display:none reset in some edge case) -
        // re-triggering a CSS animation requires a reflow between removing
        // and re-adding it.
        el.classList.remove('stagger-item');
        void el.offsetWidth;
        el.style.animationDelay = `${Math.min(i, STAGGER_MAX_STEPS) * STAGGER_STEP_SECONDS + 0.03}s`;
        el.classList.add('stagger-item');
    });
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
        
        // There's no icon picker in this form - the backend defaults icon
        // to '📦' when omitted, which is exactly what we want here.
        const data = {
            name: elements.newCatName.value,
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
        // .action-dropdown is position:fixed (see style.css comment for
        // why) so it has to be placed in viewport coordinates here rather
        // than relying on a CSS "top: 100%" of its container.
        const btnRect = btnElement.getBoundingClientRect();
        const offset = getFixedPositioningOffset(btnElement);
        dropdown.classList.remove('hidden');
        const dropdownWidth = dropdown.offsetWidth;
        let left = btnRect.right - dropdownWidth;
        left = Math.max(8, Math.min(left, window.innerWidth - dropdownWidth - 8));
        dropdown.style.left = `${left - offset.left}px`;
        dropdown.style.top = `${btnRect.bottom + 4 - offset.top}px`;
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
            // .custom-datepicker-calendar is position:fixed (a short
            // ancestor .card.glass clips it via overflow:hidden otherwise -
            // that's the "calendar gets hidden" bug on the History tab's
            // date filter), so it's placed in viewport coordinates here
            // rather than relying on a CSS "top: 100%" of its container.
            const triggerRect = trigger.getBoundingClientRect();
            const offset = getFixedPositioningOffset(trigger);
            calendar.classList.remove('hidden');
            renderCalendarGrid(prefix, isOptional);
            const calendarWidth = calendar.offsetWidth;
            let left = triggerRect.left;
            left = Math.max(8, Math.min(left, window.innerWidth - calendarWidth - 8));
            let top = triggerRect.bottom + 8;
            if (top + calendar.offsetHeight > window.innerHeight - 8) {
                top = triggerRect.top - calendar.offsetHeight - 8;
            }
            top = Math.max(8, Math.min(top, window.innerHeight - calendar.offsetHeight - 8));
            calendar.style.left = `${left - offset.left}px`;
            calendar.style.top = `${top - offset.top}px`;
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
    const textareaWrap = document.querySelector('.ai-textarea-wrap');
    const exampleChips = document.getElementById('ai-example-chips');

    if (!btnProcess) return;

    // Example chips: one click drops a ready-made description in and
    // focuses the textarea - no typing required to see the feature work.
    if (exampleChips) {
        exampleChips.addEventListener('click', (e) => {
            const chip = e.target.closest('.ai-chip');
            if (!chip) return;
            promptInput.value = chip.dataset.example;
            promptInput.focus();
            promptInput.setSelectionRange(promptInput.value.length, promptInput.value.length);
        });
    }

    // Cycles the button's status text while the AI call is in flight, so a
    // ~2-4s wait reads as active progress instead of one static label.
    const PROCESSING_PHRASES = ['Reading your message...', 'Identifying the category...', 'Calculating the amount...', 'Almost done...'];
    let processingInterval = null;

    function startProcessingUI() {
        const btnTextEl = btnProcess.querySelector('.btn-text');
        let i = 0;
        btnTextEl.textContent = PROCESSING_PHRASES[0];
        processingInterval = setInterval(() => {
            i = (i + 1) % PROCESSING_PHRASES.length;
            btnTextEl.textContent = PROCESSING_PHRASES[i];
        }, 1100);
        if (textareaWrap) textareaWrap.classList.add('processing');
    }

    function stopProcessingUI() {
        clearInterval(processingInterval);
        if (textareaWrap) textareaWrap.classList.remove('processing');
    }

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
        startProcessingUI();
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
            stopProcessingUI();
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
