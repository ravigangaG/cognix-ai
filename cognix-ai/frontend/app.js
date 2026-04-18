// State
let user = null;
let currentChatId = null;
let currentAttachments = [];

// DOM
const appView = document.getElementById('app-view');
const authView = document.getElementById('auth-view');
const messagesList = document.getElementById('messages-list');
const chatInput = document.getElementById('chat-input-field');
const sendBtn = document.getElementById('send-trigger');
const sidebar = document.getElementById('main-sidebar');

// --- APP INIT ---
window.onload = () => {
    const savedAuth = localStorage.getItem('cognix_auth');
    if (savedAuth) {
        user = JSON.parse(savedAuth);
        toggleAuthUI(true);
    } else {
        toggleAuthUI(false);
    }
    appView.classList.remove('hidden');
    renderHistoryList();
    resetChat();
};

function toggleAuthUI(isLoggedIn) {
    const profile = document.getElementById('user-profile');
    const prompt = document.getElementById('guest-prompt');
    const headerAuth = document.getElementById('header-auth-tools');
    
    if (isLoggedIn && user) {
        profile.classList.remove('hidden');
        prompt.classList.add('hidden');
        headerAuth.classList.add('hidden');
        document.getElementById('user-name-label').textContent = user.name;
        document.getElementById('user-email-label').textContent = user.email;
        document.getElementById('avatar-char').textContent = user.name.charAt(0).toUpperCase();
    } else {
        profile.classList.add('hidden');
        prompt.classList.remove('hidden');
        headerAuth.classList.remove('hidden');
    }
}

// --- NAVIGATION ---
document.getElementById('sidebar-toggle-btn').onclick = () => {
    sidebar.classList.toggle('collapsed');
};

function openAuthPanel(mode) {
    authView.classList.remove('hidden');
    const loginSec = document.getElementById('login-form-content');
    const signupSec = document.getElementById('signup-form-content');
    if (mode === 'signup') {
        loginSec.classList.add('hidden');
        signupSec.classList.remove('hidden');
    } else {
        signupSec.classList.add('hidden');
        loginSec.classList.remove('hidden');
    }
}

document.getElementById('login-trigger-btn').onclick = () => openAuthPanel('login');
document.getElementById('header-login').onclick = () => openAuthPanel('login');
document.getElementById('header-signup').onclick = () => openAuthPanel('signup');
document.getElementById('auth-back-btn').onclick = () => authView.classList.add('hidden');
document.getElementById('to-signup').onclick = (e) => { e.preventDefault(); openAuthPanel('signup'); };
document.getElementById('to-login').onclick = (e) => { e.preventDefault(); openAuthPanel('login'); };

// Auth Forms
document.getElementById('form-signin').onsubmit = (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    handleAuthSuccess({ name: email.split('@')[0], email, userId: "u_" + Date.now() });
};
document.getElementById('form-signup').onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    handleAuthSuccess({ name, email, userId: "u_" + Date.now() });
};
function handleAuthSuccess(data) {
    user = data;
    localStorage.setItem('cognix_auth', JSON.stringify(user));
    toggleAuthUI(true);
    authView.classList.add('hidden');
    showToast(`Welcome, ${user.name}!`);
}

// --- TOOLS ---
document.getElementById('tool-attach').onclick = () => document.getElementById('hidden-file-picker').click();
document.getElementById('tool-image').onclick = () => document.getElementById('hidden-image-picker').click();
document.getElementById('tool-screen').onclick = async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        showToast("Screen captured!");
        stream.getTracks().forEach(t => t.stop());
    } catch (e) { showToast("Capture cancelled."); }
};
document.getElementById('tool-voice').onclick = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return showToast("Voice not supported.");
    const rec = new Recognition(); rec.start(); showToast("Listening...");
    rec.onresult = (e) => {
        chatInput.value = e.results[0][0].transcript;
        updateInputHeight();
    };
};
document.getElementById('tool-emoji').onclick = () => {
    const emojis = ["😊","✨","🧠","🔥","🚀"];
    chatInput.value += emojis[Math.floor(Math.random() * emojis.length)];
    updateInputHeight();
};

// --- CHAT LOGIC ---
async function send() {
    const txt = chatInput.value.trim();
    if (!txt) return;

    if (document.getElementById('welcome-msg')) document.getElementById('welcome-msg').remove();

    addMsg('user', txt);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    const typing = addTyping();
    try {
        const res = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user ? user.userId : "guest", message: txt })
        });
        const data = await res.json();
        typing.remove();
        addMsg('bot', data.reply);
        if (data.memoriesUsed > 0) {
            updateBadge(data.memoriesUsed);
            showToast(`🧠 Recalled ${data.memoriesUsed} memories`);
        }
        if (user) saveToHistory(txt, data.reply);
    } catch (e) {
        typing.remove();
        addMsg('bot', "⚠️ Service error.");
    }
}

function addMsg(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `<div class="bubble">${text.replace(/\n/g, '<br>')}</div>`;
    messagesList.appendChild(div);
    messagesList.scrollTo({ top: messagesList.scrollHeight, behavior: 'smooth' });
}

function addTyping() {
    const div = document.createElement('div');
    div.className = 'message bot typing';
    div.innerHTML = `<div class="bubble">...</div>`;
    messagesList.appendChild(div);
    return div;
}

function resetChat() {
    currentChatId = "chat_" + Date.now();
    messagesList.innerHTML = `
        <div id="welcome-msg" style="text-align:center; padding-top: 15vh;">
            <div style="font-size: 3.5rem; margin-bottom: 20px;">🧠</div>
            <h1 style="font-size: 2.2rem; font-weight: 800;">Cognix AI</h1>
            <p style="color: #94a3b8;">Adaptive reasoning with memory bank.</p>
        </div>
    `;
}

function saveToHistory(q, a) {
    let hist = JSON.parse(localStorage.getItem('cognix_history') || '[]');
    let chat = hist.find(c => c.id === currentChatId);
    if (!chat) {
        chat = { id: currentChatId, title: q.substring(0, 30), msgs: [] };
        hist.unshift(chat);
    }
    chat.msgs.push({ role: 'user', text: q }, { role: 'bot', text: a });
    localStorage.setItem('cognix_history', JSON.stringify(hist));
    renderHistoryList();
}

function renderHistoryList() {
    const container = document.getElementById('history-container');
    const hist = JSON.parse(localStorage.getItem('cognix_history') || '[]');
    container.innerHTML = hist.length ? hist.map(c => `
        <div class="hist-item ${c.id === currentChatId ? 'active' : ''}" onclick="loadChatHistory('${c.id}')" 
             style="padding:10px; border-radius:8px; cursor:pointer; color:#94a3b8; font-size:0.9rem; margin-bottom:4px;">
            ${c.title}
        </div>
    `).join('') : '<p style="color:#64748b; font-size:0.8rem; padding:10px;">History is empty.</p>';
}

window.loadChatHistory = (id) => {
    const hist = JSON.parse(localStorage.getItem('cognix_history') || '[]');
    const chat = hist.find(c => c.id === id);
    if (!chat) return;
    currentChatId = id;
    messagesList.innerHTML = '';
    chat.msgs.forEach(m => addMsg(m.role, m.text));
    renderHistoryList();
};

function updateInputHeight() {
    chatInput.style.height = 'auto'; chatInput.style.height = chatInput.scrollHeight + 'px';
    sendBtn.disabled = chatInput.value.trim() === '';
}

chatInput.oninput = updateInputHeight;
chatInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
sendBtn.onclick = send;
document.getElementById('new-chat-btn').onclick = resetChat;
document.getElementById('logout-trigger').onclick = () => { localStorage.removeItem('cognix_auth'); location.reload(); };
document.getElementById('settings-trigger').onclick = () => document.getElementById('settings-modal').classList.remove('hidden');
document.getElementById('settings-close').onclick = () => document.getElementById('settings-modal').classList.add('hidden');

document.getElementById('delete-chat-trigger').onclick = () => {
    if (confirm("Are you sure? This will delete all your chats forever.")) {
        localStorage.removeItem('cognix_history');
        resetChat();
        renderHistoryList();
        showToast("History deleted.");
        document.getElementById('settings-modal').classList.add('hidden');
    }
};

function showToast(m) {
    const t = document.getElementById('toast');
    t.textContent = m; t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

function updateBadge(c) {
    const b = document.getElementById('mem-count-badge');
    const tot = (parseInt(b.textContent) || 0) + c;
    b.textContent = tot;
}
