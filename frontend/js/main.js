/* ============================================
   RoadAssist — main.js
   Shared utilities: theme, nav, toasts, socket
   ============================================ */

const API_BASE = 'http://localhost:5000/api';
const ML_BASE  = 'http://localhost:8000';
let socket;

/* ── TOKEN HELPER ── */
const Auth = {
  getToken: () => localStorage.getItem('ra_token'),
  setToken: (t) => localStorage.setItem('ra_token', t),
  getUser:  () => JSON.parse(localStorage.getItem('ra_user') || 'null'),
  setUser:  (u) => localStorage.setItem('ra_user', JSON.stringify(u)),
  clear:    () => { localStorage.removeItem('ra_token'); localStorage.removeItem('ra_user'); }
};

/* ── API HELPER ── */
async function apiCall(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(Auth.getToken() && { 'Authorization': `Bearer ${Auth.getToken()}` })
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'API error');
  return data;
}

/* ── TOAST ── */
function showToast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 300); }, duration);
}

/* ── THEME ── */
function initTheme() {
  const saved = localStorage.getItem('ra_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ra_theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

/* ── NAV ── */
function initNav() {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', toggleTheme);
  const ham = document.getElementById('hamburger');
  const links = document.querySelector('.nav-links');
  if (ham && links) ham.addEventListener('click', () => links.classList.toggle('open'));
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

/* ── COUNTER ANIMATION ── */
function animateCounters() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = +el.getAttribute('data-target');
    let current = 0;
    const step = target / 60;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.floor(current).toLocaleString();
      if (current >= target) clearInterval(timer);
    }, 20);
  });
}

/* ── SOCKET INIT ── */
function initSocket() {
  socket = io('http://localhost:5000', {
    auth: { token: Auth.getToken() },
    transports: ['websocket']
  });
  socket.on('connect', () => console.log('Socket connected:', socket.id));
  socket.on('disconnect', () => console.log('Socket disconnected'));
  socket.on('notification', ({ message, type }) => showToast(message, type));
  socket.on('request:update', (data) => {
    console.log('Request update:', data);
    window.dispatchEvent(new CustomEvent('requestUpdate', { detail: data }));
  });
  socket.on('provider:location', (data) => {
    window.dispatchEvent(new CustomEvent('providerLocation', { detail: data }));
  });
  return socket;
}

/* ── REQUEST SERVICE ── */
function requestService(type) {
  const token = Auth.getToken();
  if (!token) {
    showToast('Please log in to request a service', 'error');
    setTimeout(() => window.location.href = 'profile.html', 1500);
    return;
  }
  localStorage.setItem('selectedService', type);
  window.location.href = 'emergency.html';
}

/* ── DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  if (document.querySelector('.stat-num')) animateCounters();
  initSocket();
});
