// ==========================================
// PataLost Production App Logic
// ==========================================

const SUPABASE_URL = 'https://YOUR_ACTUAL_PROJECT_ID.supabase.co';
const SUPABASE_KEY = 'sb_publishable_amKPeKhl1DQPlAtdFUdVfQ_TtgyPk_9';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State management
let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    router('home');
});

async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        currentProfile = data;
        loadNotificationsCount();
    }
}

// Simple Router
async function router(view, param = null) {
    const container = document.getElementById('app-container');
    container.innerHTML = `<div class="empty-state"><span>⌛</span>Loading...</div>`;
    
    // Update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-target') === view);
    });

    window.scrollTo(0, 0);

    try {
        if (view === 'home') await renderHome(container);
        else if (view === 'search') await renderSearch(container, param);
        else if (view === 'report') renderReportForm(container);
        else if (view === 'messages') await renderMessages(container);
        else if (view === 'safety') renderSafety(container);
        else if (view === 'profile') await renderProfile(container);
        else if (view === 'item-detail') await renderItemDetail(container, param);
        else if (view === 'admin') await renderAdmin(container);
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="empty-state"><span>⚠️</span>Failed to load content. Please check your connection.</div>`;
    }
}

// ==========================================
// 1. HOME VIEW
// ==========================================
async function renderHome(container) {
    const { data: items } = await supabase
        .from('items')
        .select('*, profiles(full_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10);

    const categories = [
        { name: 'IDs', icon: '🪪' },
        { name: 'Phones', icon: '📱' },
        { name: 'Passports', icon: '📘' },
        { name: 'Wallets', icon: '👛' },
        { name: 'Documents', icon: '📄' },
        { name: 'Keys', icon: '🔑' },
        { name: 'Bags', icon: '🎒' },
        { name: 'Other', icon: '📦' }
    ];

    container.innerHTML = `
        <div class="hero-card">
            <h2>Find What You Lost in Kenya</h2>
            <p>Secure nationwide recovery platform for IDs, phones, documents & valuables.</p>
            <div class="hero-actions">
                <button onclick="router('report')" class="btn btn-light">I Lost Something</button>
                <button onclick="router('report')" class="btn btn-primary" style="background:#0F172A;">I Found Something</button>
            </div>
        </div>

        <div class="search-box-home">
            <input type="text" id="quick-search" placeholder="Search item, county, or ID number..." class="input-field" style="margin:0;">
            <button onclick="performQuickSearch()" class="btn btn-primary">🔍</button>
        </div>

        <h3 class="section-title">Categories</h3>
        <div class="categories-grid">
            ${categories.map(c => `
                <div class="cat-card" onclick="router('search', {category: '${c.name}'})">
                    <span>${c.icon}</span>
                    ${c.name}
                </div>
            `).join('')}
        </div>

        <h3 class="section-title">Recent Reports</h3>
        <div id="recent-feed">
            ${items && items.length > 0 ? items.map(item => renderItemCard(item)).join('') : '<div class="empty-state"><span>📭</span>No reports found yet. Be the first to add one!</div>'}
        </div>
    `;
}

function performQuickSearch() {
    const query = document.getElementById('quick-search').value;
    router('search', { keyword: query });
}

// ==========================================
// 2. SEARCH VIEW
// ==========================================
async function renderSearch(container, initialFilters = {}) {
    const counties = ["All Counties", "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Uasin Gishu", "Machakos", "Meru", "Kilifi", "Kajiado", "Kakamega", "Nyeri"];
    
    container.innerHTML = `
        <h2 style="margin-bottom:12px;">Search Lost & Found</h2>
        <div style="background:var(--card-bg); padding:16px; border-radius:var(--radius); border:1px solid var(--border); margin-bottom:16px;">
            <input type="text" id="search-keyword" placeholder="Keywords (e.g. iPhone, ID, Kimani)..." value="${initialFilters.keyword || ''}" class="input-field">
            <select id="search-type" class="input-field">
                <option value="All">All Types (Lost & Found)</option>
                <option value="lost" ${initialFilters.reportType === 'lost' ? 'selected' : ''}>Lost Items</option>
                <option value="found" ${initialFilters.reportType === 'found' ? 'selected' : ''}>Found Items</option>
            </select>
            <select id="search-category" class="input-field">
                <option value="All">All Categories</option>
                <option value="National ID" ${initialFilters.category === 'IDs' ? 'selected' : ''}>National ID</option>
                <option value="Passport">Passport</option>
                <option value="Certificate">Certificate</option>
                <option value="Phone">Phone</option>
                <option value="Wallet">Wallet</option>
                <option value="Keys">Keys</option>
                <option value="Bag">Bag</option>
                <option value="Documents">Documents</option>
                <option value="Pet">Pet</option>
                <option value="Electronics">Electronics</option>
                <option value="Other">Other</option>
            </select>
            <select id="search-county" class="input-field">
                ${counties.map(c => `<option value="${c === 'All Counties' ? 'All' : c}">${c}</option>`).join('')}
            </select>
            <button onclick="executeSearchQuery()" class="btn btn-primary btn-block">Search Reports</button>
        </div>
        <div id="search-results">
            <div class="empty-state"><span>🔍</span>Enter filters above to search reports.</div>
        </div>
    `;

    if (initialFilters.keyword || initialFilters.category) {
        executeSearchQuery();
    }
}

async function executeSearchQuery() {
    const keyword = document.getElementById('search-keyword').value;
    const reportType = document.getElementById('search-type').value;
    const category = document.getElementById('search-category').value;
    const county = document.getElementById('search-county').value;
    const resultsContainer = document.getElementById('search-results');

    resultsContainer.innerHTML = `<div class="empty-state"><span>⌛</span>Searching...</div>`;

    let query = supabase.from('items').select('*, profiles(full_name)').eq('status', 'active');

    if (keyword) query = query.ilike('description', `%${keyword}%`);
    if (reportType !== 'All') query = query.eq('report_type', reportType);
    if (category !== 'All') query = query.eq('category', category);
    if (county !== 'All') query = query.eq('county', county);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        resultsContainer.innerHTML = `<div class="empty-state"><span>⚠️</span>Error loading results.</div>`;
        return;
    }

    if (!data || data.length === 0) {
        resultsContainer.innerHTML = `<div class="empty-state"><span>📭</span>No matching reports found. Try relaxing your filters.</div>`;
        return;
    }

    resultsContainer.innerHTML = data.map(item => renderItemCard(item)).join('');
}

// ==========================================
// 3. REPORTING VIEW
// ==========================================
function renderReportForm(container) {
    if (!currentUser) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🔒</span>
                <h3>Login Required</h3>
                <p>Please log in or sign up to report lost or found items.</p>
                <button onclick="renderAuthModal(container)" class="btn btn-primary" style="margin-top:12px;">Login / Sign Up</button>
            </div>
        `;
        return;
    }

    const counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Uasin Gishu", "Machakos", "Meru", "Kilifi", "Kajiado", "Kakamega", "Nyeri"];

    container.innerHTML = `
        <h2 style="margin-bottom:12px;">Report Lost or Found Item</h2>
        <div class="warning-box">
            🛡️ <strong>Privacy Warning:</strong> Do NOT publish full National ID numbers, PINs, bank details, passwords, or exact home addresses. Keep descriptions general to protect your security.
        </div>
        <form id="report-form" onsubmit="submitReport(event)" style="background:var(--card-bg); padding:16px; border-radius:var(--radius); border:1px solid var(--border);">
            <label>Report Type</label>
            <select id="rep-type" class="input-field" required>
                <option value="lost">I Lost This Item</option>
                <option value="found">I Found This Item</option>
            </select>

            <label>Category</label>
            <select id="rep-category" class="input-field" required>
                <option value="National ID">National ID</option>
                <option value="Passport">Passport</option>
                <option value="Certificate">Certificate</option>
                <option value="Phone">Phone</option>
                <option value="Wallet">Wallet</option>
                <option value="Keys">Keys</option>
                <option value="Bag">Bag</option>
                <option value="Documents">Documents</option>
                <option value="Pet">Pet</option>
                <option value="Electronics">Electronics</option>
                <option value="Other">Other</option>
            </select>

            <label>Description (General details, color, brand)</label>
            <textarea id="rep-description" placeholder="e.g. Black leather wallet containing driving license..." rows="3" class="input-field" required></textarea>

            <label>County</label>
            <select id="rep-county" class="input-field" required>
                ${counties.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>

            <label>Approximate Location</label>
            <input type="text" id="rep-location" placeholder="e.g. CBD near Ambassador bus stop" class="input-field" required>

            <label>Date Lost / Found</label>
            <input type="date" id="rep-date" class="input-field" required>

            <label>Photo (Optional)</label>
            <input type="file" id="rep-photo" accept="image/*" class="input-field">

            <button type="submit" class="btn btn-primary btn-block">Publish Report</button>
        </form>
    `;
}

async function submitReport(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const reportData = {
        reportType: document.getElementById('rep-type').value,
        category: document.getElementById('rep-category').value,
        description: document.getElementById('rep-description').value,
        county: document.getElementById('rep-county').value,
        location: document.getElementById('rep-location').value,
        date: document.getElementById('rep-date').value
    };

    const photoFile = document.getElementById('rep-photo').files[0];
    let photoUrl = null;

    try {
        if (photoFile) {
            const fileExt = photoFile.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${currentUser.id}/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('item-photos').upload(filePath, photoFile);
            if (uploadError) throw uploadError;
            const { data: pubData } = supabase.storage.from('item-photos').getPublicUrl(filePath);
            photoUrl = pubData.publicUrl;
        }

        const { data, error } = await supabase.from('items').insert([{
            user_id: currentUser.id,
            report_type: reportData.reportType,
            category: reportData.category,
            description: reportData.description,
            county: reportData.county,
            location: reportData.location,
            item_date: reportData.date,
            photo_url: photoUrl,
            status: 'active'
        }]).select();

        if (error) throw error;

        alert("Report successfully published!");
        router('home');
    } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        btn.textContent = 'Publish Report';
    }
}

// ==========================================
// 4. ITEM CARDS & DETAILS VIEW
// ==========================================
function renderItemCard(item) {
    const isLost = item.report_type === 'lost';
    return `
        <div class="item-card" onclick="router('item-detail', '${item.id}')" style="cursor:pointer;">
            <img src="${item.photo_url || 'https://via.placeholder.com/80?text=No+Photo'}" alt="Item photo" class="item-thumb">
            <div style="flex:1;">
                <span class="tag-status ${isLost ? 'tag-lost' : 'tag-found'}">${item.report_type}</span>
                <h3>${item.category}</h3>
                <p style="font-size:0.85rem; color:var(--text); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${item.description}</p>
                <div class="item-meta">📍 ${item.county}, ${item.location} • 📅 ${item.item_date}</div>
            </div>
        </div>
    `;
}

async function renderItemDetail(container, itemId) {
    const { data: item, error } = await supabase.from('items').select('*, profiles(full_name)').eq('id', itemId).single();
    if (error || !item) {
        container.innerHTML = `<div class="empty-state"><span>❌</span>Item not found.</div>`;
        return;
    }

    const isOwner = currentUser && currentUser.id === item.user_id;

    container.innerHTML = `
        <button onclick="router('home')" style="background:none; border:none; color:var(--primary); font-weight:bold; cursor:pointer; margin-bottom:12px;">← Back to Feed</button>
        <div style="background:var(--card-bg); padding:16px; border-radius:var(--radius); border:1px solid var(--border);">
            ${item.photo_url ? `<img src="${item.photo_url}" style="width:100%; height:250px; object-fit:cover; border-radius:8px; margin-bottom:12px;">` : ''}
            <span class="tag-status ${item.report_type === 'lost' ? 'tag-lost' : 'tag-found'}">${item.report_type}</span>
            <h2 style="margin:8px 0;">${item.category}</h2>
            <p style="margin-bottom:12px; line-height:1.5;">${item.description}</p>
            <div style="font-size:0.9rem; color:var(--text-light); margin-bottom:16px;">
                <p>📍 <strong>County/Location:</strong> ${item.county}, ${item.location}</p>
                <p>📅 <strong>Date:</strong> ${item.item_date}</p>
                <p>👤 <strong>Reported by:</strong> ${item.profiles?.full_name || 'Anonymous User'}</p>
            </div>

            ${isOwner ? `
                <div style="display:flex; gap:8px; border-top:1px solid var(--border); padding-top:12px;">
                    <button onclick="markItemRecovered('${item.id}')" class="btn btn-primary" style="flex:1; background:var(--success);">Mark Recovered</button>
                    <button onclick="deleteItem('${item.id}')" class="btn btn-danger" style="flex:1;">Delete</button>
                </div>
            ` : (currentUser ? `
                <button onclick="startChat('${item.id}', '${item.user_id}')" class="btn btn-primary btn-block">💬 Send Private Message</button>
            ` : `
                <p style="text-align:center; font-size:0.85rem; color:var(--text-light);">Log in to contact the reporter securely.</p>
            `)}
            
            <button onclick="reportAbuse('${item.id}')" style="background:none; border:none; color:var(--danger); font-size:0.75rem; margin-top:16px; cursor:pointer; width:100%; text-align:center;">🚩 Report Abuse or Fraudulent Listing</button>
        </div>
    `;
}

// ==========================================
// 5. MESSAGING & NOTIFICATIONS
// ==========================================
async function renderMessages(container) {
    if (!currentUser) {
        container.innerHTML = `<div class="empty-state"><span>🔒</span><p>Please log in to view messages.</p></div>`;
        return;
    }

    const { data: messages } = await supabase
        .from('messages')
        .select('*, items(category)')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

    container.innerHTML = `
        <h2 style="margin-bottom:12px;">My Conversations</h2>
        <div id="chat-list">
            ${messages && messages.length > 0 ? messages.map(m => `
                <div class="item-card" style="display:block;">
                    <div style="font-size:0.75rem; color:var(--primary); font-weight:700;">Re: ${m.items?.category || 'Item'}</div>
                    <p style="margin:4px 0; font-size:0.9rem;">${m.content}</p>
                    <div style="font-size:0.7rem; color:var(--text-light);">${new Date(m.created_at).toLocaleString()}</div>
                </div>
            `).join('') : '<div class="empty-state"><span>💬</span>No messages yet.</div>'}
        </div>
    `;
}

async function startChat(itemId, ownerId) {
    const message = prompt("Type your secure message regarding this item:");
    if (!message) return;

    const { error } = await supabase.from('messages').insert([{
        item_id: itemId,
        sender_id: currentUser.id,
        receiver_id: ownerId,
        content: message
    }]);

    if (error) alert("Failed to send message: " + error.message);
    else {
        alert("Message sent successfully!");
        router('messages');
    }
}

async function loadNotificationsCount() {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('is_read', false);
    const badge = document.getElementById('notif-badge');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
    }
}

// ==========================================
// 6. SAFETY & PROFILE & ADMIN
// ==========================================
function renderSafety(container) {
    container.innerHTML = `
        <h2 style="margin-bottom:12px;">Safety & Security Guidelines</h2>
        <div style="background:var(--card-bg); padding:16px; border-radius:var(--radius); border:1px solid var(--border); line-height:1.6; font-size:0.95rem;">
            <p style="margin-bottom:12px;">🛡️ <strong>Meet in Safe Places:</strong> Always meet in public, well-lit locations such as police stations, shopping mall security desks, or busy offices when recovering property.</p>
            <p style="margin-bottom:12px;">⚠️ <strong>Never Send Money First:</strong> Do not send M-Pesa money to anyone claiming they have your lost property before physically inspecting and verifying it.</p>
            <p style="margin-bottom:12px;">🔒 <strong>Protect Private Data:</strong> Never share your passwords, PINs, or banking information with anyone.</p>
            <p style="margin-bottom:12px;">👮 <strong>Verify Ownership:</strong> If returning valuable property or IDs, verify official ownership documents before handover.</p>
        </div>
    `;
}

async function renderProfile(container) {
    if (!currentUser) {
        renderAuthModal(container);
        return;
    }

    const { data: myItems } = await supabase.from('items').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });

    container.innerHTML = `
        <h2 style="margin-bottom:12px;">My Profile</h2>
        <div style="background:var(--card-bg); padding:16px; border-radius:var(--radius); border:1px solid var(--border); margin-bottom:16px;">
            <p><strong>Email:</strong> ${currentUser.email}</p>
            <p><strong>Name:</strong> ${currentProfile?.full_name || 'User'}</p>
            <button onclick="handleLogout()" class="btn btn-danger" style="margin-top:12px;">Log Out</button>
        </div>
        <h3 class="section-title">My Reports</h3>
        <div>
            ${myItems && myItems.length > 0 ? myItems.map(item => renderItemCard(item)).join('') : '<div class="empty-state"><span>📄</span>You have not posted any reports yet.</div>'}
        </div>
    `;
}

function renderAuthModal(container) {
    container.innerHTML = `
        <h2 style="margin-bottom:12px; text-align:center;">Welcome to PataLost</h2>
        <div style="background:var(--card-bg); padding:20px; border-radius:var(--radius); border:1px solid var(--border);">
            <div style="display:flex; gap:8px; margin-bottom:16px;">
                <button onclick="toggleAuthMode('login')" id="tab-login" class="btn btn-primary" style="flex:1;">Login</button>
                <button onclick="toggleAuthMode('signup')" id="tab-signup" class="btn btn-light" style="flex:1;">Sign Up</button>
            </div>
            <form id="auth-form" onsubmit="handleAuthSubmit(event)">
                <div id="signup-fields" style="display:none;">
                    <label>Full Name</label>
                    <input type="text" id="auth-name" class="input-field" placeholder="John Doe">
                    <label>Phone Number (Optional)</label>
                    <input type="text" id="auth-phone" class="input-field" placeholder="0712345678">
                </div>
                <label>Email Address</label>
                <input type="email" id="auth-email" class="input-field" required placeholder="you@example.com">
                <label>Password</label>
                <input type="password" id="auth-password" class="input-field" required placeholder="••••••••">
                <button type="submit" id="auth-submit-btn" class="btn btn-primary btn-block">Login</button>
            </form>
        </div>
    `;
}

let isSignUpMode = false;
function toggleAuthMode(mode) {
    isSignUpMode = mode === 'signup';
    document.getElementById('signup-fields').style.display = isSignUpMode ? 'block' : 'none';
    document.getElementById('tab-login').className = isSignUpMode ? 'btn btn-light' : 'btn btn-primary';
    document.getElementById('tab-signup').className = isSignUpMode ? 'btn btn-primary' : 'btn btn-light';
    document.getElementById('auth-submit-btn').textContent = isSignUpMode ? 'Create Account' : 'Login';
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (isSignUpMode) {
        const fullName = document.getElementById('auth-name').value;
        const phone = document.getElementById('auth-phone').value;
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) { alert(error.message); return; }
        if (data.user) {
            await supabase.from('profiles').insert([{ id: data.user.id, full_name: fullName, phone }]);
        }
        alert("Account created successfully!");
    } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { alert(error.message); return; }
        alert("Logged in successfully!");
    }
    await checkAuth();
    router('home');
}

async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    router('home');
}

async function markItemRecovered(itemId) {
    if (!confirm("Mark this item as recovered/closed?")) return;
    await supabase.from('items').update({ status: 'recovered' }).eq('id', itemId);
    alert("Item status updated.");
    router('home');
}

async function deleteItem(itemId) {
    if (!confirm("Are you sure you want to delete this report?")) return;
    await supabase.from('items').delete().eq('id', itemId);
    alert("Report deleted.");
    router('home');
}

async function reportAbuse(itemId) {
    const reason = prompt("Please state the reason for reporting this listing:");
    if (!reason || !currentUser) return;
    await supabase.from('abuse_reports').insert([{ reporter_id: currentUser.id, item_id: itemId, reason }]);
    alert("Abuse report submitted. Thank you for keeping PataLost safe.");
}
