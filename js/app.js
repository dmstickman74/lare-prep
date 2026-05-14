/* ==========================================================================
   LARE Prep — Application Core
   ========================================================================== */

const SECTIONS = [
  { id: 1, title: 'Project Management and Professional Practice', items: 75, short: 'Section 1' },
  { id: 2, title: 'Planning and Design', items: 85, short: 'Section 2' },
  { id: 3, title: 'Construction Documentation and Administration', items: 90, short: 'Section 3' },
  { id: 4, title: 'Grading, Drainage, and Stormwater Management', items: 70, short: 'Section 4' },
];

let DATA = null;
let currentView = null;
let currentUser = null;

/* -- Firebase ------------------------------------------------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyDemoKeyReplaceMeWithReal",
  authDomain: "lare-prep.firebaseapp.com",
  projectId: "lare-prep",
  storageBucket: "lare-prep.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(user => {
  currentUser = user;
  renderAuthArea();
  if (user) syncProgressFromCloud();
});

/* -- Router -------------------------------------------------------------- */
function parseHash() {
  const hash = location.hash.slice(1) || '';
  const parts = hash.split('/').filter(Boolean);
  return { section: parts[0] || 'home', sub: parts[1] || null, extra: parts[2] || null };
}

function navigate(path) {
  location.hash = '#' + path;
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupDropdown();
  setupMobileMenu();
  route();
});

async function loadData() {
  const resp = await fetch('js/content/data.json');
  DATA = await resp.json();
}

function route() {
  const r = parseHash();
  const app = document.getElementById('app');
  const oldView = currentView;
  currentView = r;

  closeDropdown();
  closeMobileMenu();

  if (r.section === 'home' || r.section === '') {
    renderHome(app);
  } else if (r.section.match(/^s[1-4]$/)) {
    const secNum = parseInt(r.section[1]);
    const tab = r.sub || 'book';
    renderSection(app, secNum, tab);
  } else if (r.section === 'dashboard') {
    renderDashboard(app);
  } else {
    renderHome(app);
  }

  updateNav(r);
  window.scrollTo({ top: 0, behavior: oldView?.section !== r.section ? 'auto' : 'smooth' });
}

function updateNav(r) {
  document.querySelectorAll('.header-nav > a, .header-nav [data-route]').forEach(a => {
    const route = a.dataset.route;
    if (!route) return;
    if (route === r.section) a.classList.add('active');
    else if (route.match(/^s[1-4]$/) && r.section.match(/^s[1-4]$/)) {
      a.classList.remove('active');
    } else {
      a.classList.remove('active');
    }
  });
  const trigger = document.getElementById('sections-trigger');
  if (trigger) {
    trigger.classList.toggle('active', r.section.match(/^s[1-4]$/) != null);
  }
}

/* -- Sections dropdown --------------------------------------------------- */
function setupDropdown() {
  const trigger = document.getElementById('sections-trigger');
  const dropdown = trigger?.closest('.nav-dropdown');
  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    if (!dropdown.contains(e.target)) closeDropdown();
  });
}

function closeDropdown() {
  document.querySelector('.nav-dropdown')?.classList.remove('open');
}

/* -- Mobile menu --------------------------------------------------------- */
function setupMobileMenu() {
  const btn = document.getElementById('mobile-menu-btn');
  const nav = document.getElementById('header-nav');
  if (!btn || !nav) return;

  const overlay = document.createElement('div');
  overlay.className = 'mobile-nav-overlay';
  document.querySelector('.site-header').appendChild(overlay);

  btn.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    overlay.classList.toggle('open', isOpen);
    btn.innerHTML = isOpen
      ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  });

  overlay.addEventListener('click', closeMobileMenu);
}

function closeMobileMenu() {
  const nav = document.getElementById('header-nav');
  const btn = document.getElementById('mobile-menu-btn');
  const overlay = document.querySelector('.mobile-nav-overlay');
  if (nav) nav.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  if (btn) btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
}

/* -- Auth ---------------------------------------------------------------- */
function renderAuthArea() {
  const area = document.getElementById('auth-area');
  if (!area) return;

  if (currentUser) {
    const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    area.innerHTML = `
      <span class="user-name">${escHtml(name)}</span>
      <button class="auth-btn auth-btn-signout" onclick="signOutUser()">Sign out</button>
    `;
  } else {
    area.innerHTML = `
      <button class="auth-btn auth-btn-signin" onclick="openAuthModal()">Sign in</button>
    `;
  }
}

window.openAuthModal = function() {
  const modal = document.getElementById('auth-modal');
  modal.classList.remove('hidden');
  renderAuthForm('signin');
};

window.closeAuthModal = function() {
  document.getElementById('auth-modal').classList.add('hidden');
};

function renderAuthForm(mode) {
  const title = document.getElementById('auth-modal-title');
  const body = document.getElementById('auth-modal-body');
  const isSignIn = mode === 'signin';

  title.textContent = isSignIn ? 'Sign In' : 'Create Account';

  body.innerHTML = `
    <button class="google-btn" onclick="signInWithGoogle()">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Continue with Google
    </button>
    <div class="auth-divider"><span>or</span></div>
    <form class="auth-form" onsubmit="handleEmailAuth(event, '${mode}')">
      <input type="email" id="auth-email" placeholder="Email address" required>
      <input type="password" id="auth-password" placeholder="Password" required minlength="6">
      <div class="auth-error hidden" id="auth-error"></div>
      <button type="submit" class="btn btn-primary" style="width:100%">${isSignIn ? 'Sign in' : 'Create account'}</button>
    </form>
    <div class="auth-toggle">
      ${isSignIn
        ? 'No account? <a href="#" onclick="event.preventDefault();renderAuthForm(\'signup\')">Create one</a>'
        : 'Have an account? <a href="#" onclick="event.preventDefault();renderAuthForm(\'signin\')">Sign in</a>'
      }
    </div>
  `;
}
window.renderAuthForm = renderAuthForm;

window.handleEmailAuth = async function(e, mode) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.classList.add('hidden');

  try {
    if (mode === 'signin') {
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      await auth.createUserWithEmailAndPassword(email, password);
    }
    closeAuthModal();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
};

window.signInWithGoogle = async function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    closeAuthModal();
  } catch (err) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  }
};

window.signOutUser = async function() {
  await auth.signOut();
};

/* -- Progress persistence ------------------------------------------------ */
function getProgress() {
  try { return JSON.parse(localStorage.getItem('lare-progress') || '{}'); }
  catch { return {}; }
}

function saveExamResult(secNum, pct) {
  const progress = getProgress();
  const key = `s${secNum}`;
  if (!progress[key]) progress[key] = {};
  progress[key].examAttempts = (progress[key].examAttempts || 0) + 1;
  if (progress[key].examBest == null || pct > progress[key].examBest) {
    progress[key].examBest = pct;
  }
  progress[key].lastAttempt = new Date().toISOString();
  localStorage.setItem('lare-progress', JSON.stringify(progress));
  if (currentUser) syncProgressToCloud(progress);
}

function clearProgress() {
  localStorage.removeItem('lare-progress');
  if (currentUser) {
    db.collection('progress').doc(currentUser.uid).delete().catch(() => {});
  }
}
window.clearProgress = clearProgress;

async function syncProgressToCloud(progress) {
  if (!currentUser) return;
  try {
    await db.collection('progress').doc(currentUser.uid).set(progress, { merge: true });
  } catch (e) { /* silent */ }
}

async function syncProgressFromCloud() {
  if (!currentUser) return;
  try {
    const doc = await db.collection('progress').doc(currentUser.uid).get();
    if (doc.exists) {
      const cloud = doc.data();
      const local = getProgress();
      const merged = mergeProgress(local, cloud);
      localStorage.setItem('lare-progress', JSON.stringify(merged));
      if (currentView?.section === 'dashboard') renderDashboard(document.getElementById('app'));
    } else {
      const local = getProgress();
      if (Object.keys(local).length) syncProgressToCloud(local);
    }
  } catch (e) { /* silent */ }
}

function mergeProgress(a, b) {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    if (!result[key]) { result[key] = b[key]; continue; }
    result[key] = {
      examAttempts: Math.max(result[key].examAttempts || 0, b[key].examAttempts || 0),
      examBest: Math.max(result[key].examBest || 0, b[key].examBest || 0),
      lastAttempt: (result[key].lastAttempt || '') > (b[key].lastAttempt || '') ? result[key].lastAttempt : b[key].lastAttempt,
    };
  }
  return result;
}

/* -- Home Page ----------------------------------------------------------- */
function renderHome(app) {
  const progress = getProgress();

  app.innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <div>
          <div class="hero-eyebrow">LARE Exam Preparation</div>
          <h1>Master the <strong>Landscape Architect Registration Examination</strong></h1>
          <p>Comprehensive study books, interactive practice exams, flashcards, and downloadable study guides for all four LARE sections. Prepare with confidence.</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="navigate('s1/book')">Start studying</button>
            <button class="btn btn-secondary" onclick="navigate('dashboard')">View progress</button>
          </div>
        </div>
        <div class="hero-mosaic">
          <div class="mosaic-tile teal-grad big"></div>
          <div class="mosaic-tile sage-grad small1"></div>
          <div class="mosaic-tile green-grad small2"></div>
        </div>
      </div>
    </section>

    <section style="background:#fff;padding:72px 24px">
      <div class="container">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:32px;flex-wrap:wrap;gap:16px">
          <div>
            <div class="hero-eyebrow" style="margin-bottom:10px">Exam Sections</div>
            <h2 style="font-size:36px;font-weight:600;color:var(--asla-teal);letter-spacing:-.015em;margin:0">Four paths to licensure</h2>
          </div>
        </div>
        <div class="sections-grid">
          ${SECTIONS.map(s => {
            const p = progress['s' + s.id] || {};
            const examPct = p.examBest != null ? p.examBest + '%' : '--';
            return `
            <div class="section-card" onclick="navigate('s${s.id}/book')">
              <div class="card-num">Section ${s.id}</div>
              <h3>${s.title}</h3>
              <p>${s.items} scored items on the exam. Study book, practice exam, and flashcards.</p>
              <div class="card-meta">
                <span>Best score: ${examPct}</span>
                <span>${s.items} exam items</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>

    <section class="stats-band">
      <div class="stats-grid">
        <div class="stat"><div class="stat-num">4</div><div class="stat-label">Exam Sections</div></div>
        <div class="stat"><div class="stat-num">160</div><div class="stat-label">Practice Questions</div></div>
        <div class="stat"><div class="stat-num">220+</div><div class="stat-label">Flashcards</div></div>
        <div class="stat"><div class="stat-num">320</div><div class="stat-label">Scored Exam Items</div></div>
      </div>
    </section>

    <section style="background:var(--warm-cream);padding:72px 24px">
      <div class="container" style="max-width:800px;text-align:center">
        <div class="hero-eyebrow" style="margin-bottom:16px">How It Works</div>
        <h2 style="font-size:32px;font-weight:600;color:var(--asla-teal);margin-bottom:40px;letter-spacing:-.01em">A structured approach to exam preparation</h2>
        <div class="how-it-works-grid">
          <div style="background:var(--white);padding:28px 24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle)">
            <div style="font-size:36px;font-weight:300;color:var(--asla-green);margin-bottom:12px">01</div>
            <h4 style="font-size:17px;font-weight:600;color:var(--asla-teal);margin-bottom:8px">Study Guide</h4>
            <p style="font-size:14px;color:var(--dark-gray);line-height:1.55">Downloadable PDF outlines covering key concepts, reference tables, and exam strategies.</p>
          </div>
          <div style="background:var(--white);padding:28px 24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle)">
            <div style="font-size:36px;font-weight:300;color:var(--asla-green);margin-bottom:12px">02</div>
            <h4 style="font-size:17px;font-weight:600;color:var(--asla-teal);margin-bottom:8px">Study Book</h4>
            <p style="font-size:14px;color:var(--dark-gray);line-height:1.55">In-depth textbook coverage with teaching narratives, memory aids, real-world examples, and review questions.</p>
          </div>
          <div style="background:var(--white);padding:28px 24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle)">
            <div style="font-size:36px;font-weight:300;color:var(--asla-green);margin-bottom:12px">03</div>
            <h4 style="font-size:17px;font-weight:600;color:var(--asla-teal);margin-bottom:8px">Flashcards</h4>
            <p style="font-size:14px;color:var(--dark-gray);line-height:1.55">Interactive flip cards for quick review. Study online or print for on-the-go practice.</p>
          </div>
          <div style="background:var(--white);padding:28px 24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle)">
            <div style="font-size:36px;font-weight:300;color:var(--asla-green);margin-bottom:12px">04</div>
            <h4 style="font-size:17px;font-weight:600;color:var(--asla-teal);margin-bottom:8px">Practice Exam</h4>
            <p style="font-size:14px;color:var(--dark-gray);line-height:1.55">40 multiple-choice questions per section with instant scoring, detailed explanations, and progress tracking.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

/* -- Section Page -------------------------------------------------------- */
function renderSection(app, secNum, tab) {
  const sec = SECTIONS[secNum - 1];
  const key = `s${secNum}`;

  app.innerHTML = `
    <div class="page-header">
      <div class="container">
        <h1><strong>Section ${secNum}:</strong> ${sec.title}</h1>
        <div class="subtitle">${sec.items} scored items on the LARE</div>
      </div>
    </div>
    <div class="content-tabs">
      <div class="content-tabs-inner">
        <button class="content-tab ${tab === 'book' ? 'active' : ''}" onclick="navigate('${key}/book')">Study Book</button>
        <button class="content-tab ${tab === 'exam' ? 'active' : ''}" onclick="navigate('${key}/exam')">Practice Exam</button>
        <button class="content-tab ${tab === 'flash' ? 'active' : ''}" onclick="navigate('${key}/flash')">Flashcards</button>
      </div>
    </div>
    <div class="download-row">
      <button class="btn btn-secondary btn-sm" onclick="generateStudyGuidePDF(${secNum})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Study Guide PDF
      </button>
    </div>
    <div id="section-content" class="fade-in"></div>
  `;

  const container = document.getElementById('section-content');

  if (tab === 'exam') {
    renderExam(container, secNum);
  } else if (tab === 'flash') {
    renderFlashcards(container, secNum);
  } else {
    renderStudyContent(container, secNum, 'book');
  }
}

/* -- Study Content Renderer ---------------------------------------------- */
function renderStudyContent(container, secNum, type) {
  const key = `s${secNum}_${type}`;
  const sections = DATA[key];

  if (!sections || !sections.length) {
    container.innerHTML = '<div class="content-area"><p>Content not available.</p></div>';
    return;
  }

  const tocItems = sections.map((s, i) => {
    const id = 'sec-' + i;
    const subs = (s.subsections || []).map((sub, j) => {
      return '<a href="#' + id + '-' + j + '" class="sub">' + truncate(sub.title, 40) + '</a>';
    }).join('');
    return '<a href="#' + id + '">' + truncate(s.title, 45) + '</a>' + subs;
  }).join('');

  const contentHtml = sections.map((s, i) => {
    const id = 'sec-' + i;
    let html = '<h2 id="' + id + '">' + escHtml(s.title) + '</h2>';
    html += renderContentItems(s.content || []);

    (s.subsections || []).forEach((sub, j) => {
      const subId = id + '-' + j;
      const tag = sub.level === 'h4' ? 'h4' : 'h3';
      html += '<' + tag + ' id="' + subId + '">' + escHtml(sub.title) + '</' + tag + '>';
      html += renderContentItems(sub.content || []);
    });

    return html;
  }).join('');

  container.innerHTML = `
    <div class="study-layout">
      <nav class="toc">
        <h4>Contents</h4>
        ${tocItems}
      </nav>
      <div class="content-area">
        ${contentHtml}
      </div>
    </div>
  `;

  setupScrollSpy();
}

function renderContentItems(items) {
  let html = '';
  let inList = false;

  for (const item of items) {
    if (item.type === 'bullet' || item.type === 'sub_bullet') {
      if (!inList) { html += '<ul>'; inList = true; }
      const cls = item.type === 'sub_bullet' ? ' class="sub"' : '';
      html += '<li' + cls + '>' + escHtml(item.text) + '</li>';
    } else {
      if (inList) { html += '</ul>'; inList = false; }

      if (item.type === 'table') {
        html += renderTable(item);
      } else if (item.type === 'tip') {
        html += renderCallout('tip', 'Exam Tip', item.text);
      } else if (item.type === 'memory') {
        html += renderCallout('memory', 'Memory Aid', item.text);
      } else if (item.type === 'example') {
        html += renderCallout('example', 'Real-World Example', item.text);
      } else if (item.type === 'summary') {
        html += renderCallout('summary', 'Chapter Summary', item.text);
      } else if (item.type === 'callout') {
        html += renderCallout('tip', 'Note', item.text);
      } else {
        const bold = item.bold ? ' style="font-weight:600"' : '';
        html += '<p' + bold + '>' + escHtml(item.text) + '</p>';
      }
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function renderTable(item) {
  const headers = (item.headers || []).map(h => '<th>' + escHtml(h) + '</th>').join('');
  const rows = (item.rows || []).map(row =>
    '<tr>' + row.map(c => '<td>' + escHtml(c) + '</td>').join('') + '</tr>'
  ).join('');
  return '<div class="table-wrap"><table class="data-table"><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function renderCallout(type, title, text) {
  const icons = {
    tip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    memory: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    example: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    summary: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  };
  return '<div class="callout ' + type + '"><div class="callout-title">' + (icons[type] || '') + title + '</div>' + escHtml(text) + '</div>';
}

/* -- Scroll Spy ---------------------------------------------------------- */
function setupScrollSpy() {
  const tocLinks = document.querySelectorAll('.toc a');
  if (!tocLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocLinks.forEach(l => l.classList.remove('active'));
        const link = document.querySelector('.toc a[href="#' + entry.target.id + '"]');
        if (link) link.classList.add('active');
      }
    });
  }, { rootMargin: '-120px 0px -60% 0px', threshold: 0 });

  document.querySelectorAll('.content-area h2[id], .content-area h3[id], .content-area h4[id]').forEach(el => {
    observer.observe(el);
  });
}

/* -- Flashcards ---------------------------------------------------------- */
function renderFlashcards(container, secNum) {
  const key = `s${secNum}_flash`;
  const cards = DATA[key];

  if (!cards || !cards.length) {
    container.innerHTML = '<div class="content-area"><p>No flashcards available.</p></div>';
    return;
  }

  const state = { secNum, cards, current: 0, flipped: false, shuffled: false };
  window.__flashState = state;
  renderFlashcard(container, state);
}

function renderFlashcard(container, state) {
  const { cards, current, flipped } = state;
  const card = cards[current];

  const sourceLabel = { exam: 'Practice Exam', tip: 'Exam Tip', memory: 'Memory Aid', definition: 'Key Term' };

  container.innerHTML = `
    <div class="flash-container" style="max-width:720px;margin:0 auto;padding:40px 24px 80px">
      <div class="flash-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div style="font-size:14px;color:var(--dark-gray)">
          Card <strong>${current + 1}</strong> of <strong>${cards.length}</strong>
          <span style="margin-left:12px;padding:3px 10px;background:var(--soft-sage);border-radius:12px;font-size:12px">${sourceLabel[card.source] || card.source}</span>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-secondary" onclick="shuffleFlashcards()">${state.shuffled ? 'Unshuffle' : 'Shuffle'}</button>
          <button class="btn btn-sm btn-secondary" onclick="printFlashcards(${state.secNum})">Print all</button>
        </div>
      </div>

      <div class="flashcard-wrapper" onclick="flipCard()">
        <div class="flashcard ${flipped ? 'flipped' : ''}">
          <div class="flashcard-face flashcard-front">
            <div class="flashcard-label">Question</div>
            <div class="flashcard-text">${escHtml(card.front)}</div>
          </div>
          <div class="flashcard-face flashcard-back">
            <div class="flashcard-label">Answer</div>
            <div class="flashcard-text">${escHtml(card.back)}</div>
            ${card.detail ? '<div class="flashcard-detail">' + escHtml(card.detail) + '</div>' : ''}
          </div>
        </div>
      </div>

      <div class="flash-hint" style="text-align:center;margin-top:12px;font-size:13px;color:var(--placeholder-gray)">Click the card to flip</div>

      <div class="flash-nav" style="display:flex;justify-content:center;gap:12px;margin-top:24px">
        <button class="btn btn-secondary btn-sm" onclick="prevFlashcard()" ${current === 0 ? 'disabled' : ''}>Previous</button>
        <button class="btn btn-primary btn-sm" onclick="nextFlashcard()" ${current === cards.length - 1 ? 'disabled' : ''}>Next</button>
      </div>
    </div>

    <div class="flash-print-grid" id="flash-print-grid">
      ${cards.map((c, i) => `
        <div class="flash-print-card">
          <div class="fp-label">#${i + 1}</div>
          <div class="fp-front">${escHtml(c.front)}</div>
          <div class="fp-back">${escHtml(c.back)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

window.flipCard = function() {
  const state = window.__flashState;
  state.flipped = !state.flipped;
  renderFlashcard(document.getElementById('section-content'), state);
};

window.prevFlashcard = function() {
  const state = window.__flashState;
  if (state.current > 0) {
    state.current--;
    state.flipped = false;
    renderFlashcard(document.getElementById('section-content'), state);
  }
};

window.nextFlashcard = function() {
  const state = window.__flashState;
  if (state.current < state.cards.length - 1) {
    state.current++;
    state.flipped = false;
    renderFlashcard(document.getElementById('section-content'), state);
  }
};

window.shuffleFlashcards = function() {
  const state = window.__flashState;
  const key = `s${state.secNum}_flash`;
  if (state.shuffled) {
    state.cards = [...DATA[key]];
    state.shuffled = false;
  } else {
    state.cards = [...DATA[key]];
    for (let i = state.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.cards[i], state.cards[j]] = [state.cards[j], state.cards[i]];
    }
    state.shuffled = true;
  }
  state.current = 0;
  state.flipped = false;
  renderFlashcard(document.getElementById('section-content'), state);
};

window.printFlashcards = function(secNum) {
  window.print();
};

/* -- Practice Exam ------------------------------------------------------- */
function renderExam(container, secNum) {
  const key = `s${secNum}_exam`;
  const questions = DATA[key];

  if (!questions || !questions.length) {
    container.innerHTML = '<div class="quiz-container"><p>No questions available.</p></div>';
    return;
  }

  const state = {
    secNum,
    questions,
    current: 0,
    answers: new Array(questions.length).fill(null),
    revealed: new Array(questions.length).fill(false),
    submitted: false,
  };

  window.__quizState = state;
  renderQuestion(container, state);
}

function renderQuestion(container, state) {
  const { questions, current, answers, revealed, submitted } = state;
  const q = questions[current];
  const selected = answers[current];
  const isRevealed = revealed[current];
  const totalAnswered = answers.filter(a => a !== null).length;

  const dotsHtml = questions.map((_, i) => {
    let cls = 'q-dot';
    if (i === current) cls += ' current';
    else if (submitted && answers[i] !== null) {
      cls += questions[i].answer === answers[i] ? ' correct-dot' : ' incorrect-dot';
    } else if (answers[i] !== null) cls += ' answered';
    return '<button class="' + cls + '" onclick="goToQuestion(' + i + ')">' + (i + 1) + '</button>';
  }).join('');

  const choicesHtml = (q.choices || []).map(c => {
    let cls = 'choice';
    if (isRevealed) {
      cls += ' disabled';
      if (c.letter === q.answer) cls += ' correct';
      if (c.letter === selected && c.letter !== q.answer) cls += ' incorrect';
      if (c.letter === q.answer && selected !== q.answer) cls += ' show-correct';
    } else {
      if (c.letter === selected) cls += ' selected';
    }
    return '<div class="' + cls + '" onclick="selectChoice(\'' + c.letter + '\')">' +
      '<div class="choice-letter">' + c.letter + '</div>' +
      '<div>' + escHtml(c.text) + '</div></div>';
  }).join('');

  const explanationHtml = isRevealed && q.explanation
    ? '<div class="explanation"><strong>Explanation:</strong> ' + escHtml(q.explanation) + '</div>'
    : '';

  const checkBtnHtml = selected !== null && !isRevealed
    ? '<button class="btn btn-green" onclick="checkAnswer()">Check answer</button>'
    : '';

  container.innerHTML = `
    <div class="quiz-container">
      <div class="quiz-header">
        <div class="quiz-progress-text">${totalAnswered} of ${questions.length} answered</div>
        <div class="mode-toggle">
          <button class="${!submitted ? 'active' : ''}" onclick="setExamMode('practice')">Practice</button>
          <button class="${submitted ? 'active' : ''}" onclick="setExamMode('review')" ${!submitted && totalAnswered < questions.length ? 'disabled' : ''}>Review</button>
        </div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${(totalAnswered / questions.length) * 100}%"></div></div>
      <div class="question-dots">${dotsHtml}</div>

      <div class="question-card fade-in">
        <div class="question-num">Question ${current + 1} of ${questions.length}</div>
        <div class="question-text">${escHtml(q.question)}</div>
        <div class="choices">${choicesHtml}</div>
        ${explanationHtml}
      </div>

      <div class="quiz-nav">
        <button class="btn btn-secondary btn-sm" onclick="prevQuestion()" ${current === 0 ? 'disabled' : ''}>Previous</button>
        <div style="display:flex;gap:10px">
          ${checkBtnHtml}
          ${!submitted && totalAnswered === questions.length ? '<button class="btn btn-primary" onclick="submitExam()">Submit exam</button>' : ''}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="nextQuestion()" ${current === questions.length - 1 ? 'disabled' : ''}>Next</button>
      </div>
    </div>
  `;
}

function renderResults(container, state) {
  const { questions, answers, secNum } = state;
  let correct = 0;
  questions.forEach((q, i) => { if (q.answer === answers[i]) correct++; });
  const pct = Math.round((correct / questions.length) * 100);

  saveExamResult(secNum, pct);

  const dotsHtml = questions.map((q, i) => {
    const isCorrect = q.answer === answers[i];
    const cls = 'q-dot ' + (isCorrect ? 'correct-dot' : 'incorrect-dot');
    return '<button class="' + cls + '" onclick="goToQuestion(' + i + ')">' + (i + 1) + '</button>';
  }).join('');

  container.innerHTML = `
    <div class="quiz-container">
      <div class="results-card fade-in">
        <div class="hero-eyebrow" style="margin-bottom:20px">Section ${secNum} Practice Exam</div>
        <div class="results-score">${pct}%</div>
        <div class="results-label">${correct} of ${questions.length} correct</div>
        <div class="progress-bar" style="max-width:300px;margin:0 auto"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="results-breakdown">
          <div class="results-stat"><div class="num">${correct}</div><div class="lab">Correct</div></div>
          <div class="results-stat"><div class="num">${questions.length - correct}</div><div class="lab">Incorrect</div></div>
          <div class="results-stat"><div class="num">${pct >= 70 ? 'Pass' : 'Needs work'}</div><div class="lab">Status</div></div>
        </div>
        <div style="margin-top:24px">
          <div class="question-dots">${dotsHtml}</div>
          <p style="font-size:13px;color:var(--dark-gray);margin-top:12px">Click a dot to review that question</p>
        </div>
        <div style="margin-top:32px;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="reviewExam()">Review answers</button>
          <button class="btn btn-secondary" onclick="retakeExam()">Retake exam</button>
        </div>
      </div>
    </div>
  `;
}

/* -- Quiz interaction functions ------------------------------------------ */
window.selectChoice = function(letter) {
  const state = window.__quizState;
  if (state.revealed[state.current] || state.submitted) return;
  state.answers[state.current] = letter;
  renderQuestion(document.getElementById('section-content'), state);
};

window.checkAnswer = function() {
  const state = window.__quizState;
  state.revealed[state.current] = true;
  renderQuestion(document.getElementById('section-content'), state);
};

window.goToQuestion = function(i) {
  const state = window.__quizState;
  state.current = i;
  const container = document.getElementById('section-content');
  if (state.submitted) {
    state.revealed[i] = true;
  }
  renderQuestion(container, state);
};

window.prevQuestion = function() {
  const state = window.__quizState;
  if (state.current > 0) {
    state.current--;
    renderQuestion(document.getElementById('section-content'), state);
  }
};

window.nextQuestion = function() {
  const state = window.__quizState;
  if (state.current < state.questions.length - 1) {
    state.current++;
    renderQuestion(document.getElementById('section-content'), state);
  }
};

window.submitExam = function() {
  const state = window.__quizState;
  state.submitted = true;
  state.revealed = state.revealed.map(() => true);
  renderResults(document.getElementById('section-content'), state);
};

window.reviewExam = function() {
  const state = window.__quizState;
  state.current = 0;
  state.revealed = state.revealed.map(() => true);
  renderQuestion(document.getElementById('section-content'), state);
};

window.retakeExam = function() {
  const state = window.__quizState;
  state.current = 0;
  state.answers = new Array(state.questions.length).fill(null);
  state.revealed = new Array(state.questions.length).fill(false);
  state.submitted = false;
  renderQuestion(document.getElementById('section-content'), state);
};

window.setExamMode = function(mode) {
  const state = window.__quizState;
  if (mode === 'review') {
    state.submitted = true;
    state.revealed = state.revealed.map(() => true);
    renderResults(document.getElementById('section-content'), state);
  } else {
    state.current = 0;
    renderQuestion(document.getElementById('section-content'), state);
  }
};

/* -- Dashboard ----------------------------------------------------------- */
function renderDashboard(app) {
  const progress = getProgress();

  const cardsHtml = SECTIONS.map(s => {
    const key = 's' + s.id;
    const p = progress[key] || {};
    const bestPct = p.examBest != null ? p.examBest : null;
    const attempts = p.examAttempts || 0;
    const lastDate = p.lastAttempt ? new Date(p.lastAttempt).toLocaleDateString() : '--';

    return `
      <div class="progress-card">
        <h4>Section ${s.id}</h4>
        <p style="font-size:13px;color:var(--dark-gray);margin:4px 0 12px">${s.title}</p>
        <div class="pct">${bestPct != null ? bestPct + '%' : '--'}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${bestPct || 0}%"></div></div>
        <div style="font-size:12px;color:var(--placeholder-gray);margin-top:8px">${attempts} attempt${attempts !== 1 ? 's' : ''} · Last: ${lastDate}</div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" onclick="navigate('${key}/exam')">Take exam</button>
          <button class="btn btn-sm btn-secondary" onclick="navigate('${key}/book')">Study</button>
          <button class="btn btn-sm btn-secondary" onclick="navigate('${key}/flash')">Flashcards</button>
        </div>
      </div>`;
  }).join('');

  const totalAttempts = SECTIONS.reduce((sum, s) => sum + ((progress['s' + s.id] || {}).examAttempts || 0), 0);
  const avgBest = SECTIONS.reduce((sum, s) => {
    const b = (progress['s' + s.id] || {}).examBest;
    return sum + (b != null ? b : 0);
  }, 0);
  const sectionsAttempted = SECTIONS.filter(s => (progress['s' + s.id] || {}).examBest != null).length;
  const avgDisplay = sectionsAttempted > 0 ? Math.round(avgBest / sectionsAttempted) + '%' : '--';

  app.innerHTML = `
    <div class="page-header">
      <div class="container">
        <h1><strong>Dashboard</strong></h1>
        <div class="subtitle">Track your exam preparation across all four sections${currentUser ? ' — synced to your account' : ''}</div>
      </div>
    </div>
    <div class="container" style="padding-top:48px;padding-bottom:96px">
      <div class="dashboard-stats-grid">
        <div style="background:var(--white);padding:24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle);text-align:center">
          <div style="font-size:36px;font-weight:600;color:var(--asla-teal)">${totalAttempts}</div>
          <div style="font-size:13px;color:var(--dark-gray)">Total Attempts</div>
        </div>
        <div style="background:var(--white);padding:24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle);text-align:center">
          <div style="font-size:36px;font-weight:600;color:var(--asla-teal)">${avgDisplay}</div>
          <div style="font-size:13px;color:var(--dark-gray)">Average Best Score</div>
        </div>
        <div style="background:var(--white);padding:24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle);text-align:center">
          <div style="font-size:36px;font-weight:600;color:var(--asla-teal)">${sectionsAttempted}/4</div>
          <div style="font-size:13px;color:var(--dark-gray)">Sections Attempted</div>
        </div>
      </div>
      <div class="progress-grid">${cardsHtml}</div>
      <div style="margin-top:40px;text-align:center;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        ${!currentUser ? '<button class="btn btn-primary" onclick="openAuthModal()">Sign in to sync progress</button>' : ''}
        <button class="btn btn-secondary" onclick="if(confirm('Clear all progress data?')){clearProgress();route();}">Reset all progress</button>
      </div>
    </div>
  `;
}

/* -- PDF Generation ------------------------------------------------------ */
window.generateStudyGuidePDF = function(secNum) {
  const key = `s${secNum}_guide`;
  const sections = DATA[key];
  const sec = SECTIONS[secNum - 1];

  if (!sections || !sections.length) {
    alert('Study guide content not available.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;

  function checkPage(needed) {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  doc.setFillColor(0, 58, 73);
  doc.rect(0, 0, pageW, 50, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text('LARE Study Guide', margin, 28);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Section ' + secNum + ': ' + sec.title, margin, 40);

  y = 60;
  doc.setTextColor(0, 0, 0);

  for (const section of sections) {
    checkPage(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 58, 73);
    const titleLines = doc.splitTextToSize(section.title, contentW);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7 + 4;

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    function renderItems(items) {
      for (const item of items) {
        if (item.type === 'table') {
          checkPage(20);
          try {
            doc.autoTable({
              startY: y,
              margin: { left: margin, right: margin },
              head: [item.headers || []],
              body: item.rows || [],
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [0, 58, 73], textColor: 255 },
              theme: 'grid',
            });
            y = doc.lastAutoTable.finalY + 6;
          } catch (e) { /* skip table on error */ }
        } else if (item.type === 'bullet' || item.type === 'sub_bullet') {
          checkPage(8);
          const indent = item.type === 'sub_bullet' ? margin + 8 : margin + 4;
          const bullet = item.type === 'sub_bullet' ? '–' : '•';
          const bw = contentW - (indent - margin) - 4;
          const lines = doc.splitTextToSize(bullet + '  ' + (item.text || ''), bw);
          doc.text(lines, indent, y);
          y += lines.length * 4.5 + 1.5;
        } else if (item.type === 'tip' || item.type === 'memory' || item.type === 'example' || item.type === 'summary' || item.type === 'callout') {
          checkPage(12);
          const labels = { tip: 'Exam Tip', memory: 'Memory Aid', example: 'Example', summary: 'Summary', callout: 'Note' };
          doc.setFillColor(231, 237, 218);
          const boxLines = doc.splitTextToSize((item.text || ''), contentW - 8);
          const boxH = boxLines.length * 4.5 + 12;
          checkPage(boxH);
          doc.roundedRect(margin, y - 2, contentW, boxH, 2, 2, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 58, 73);
          doc.text(labels[item.type] || 'Note', margin + 4, y + 4);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(50, 50, 50);
          doc.text(boxLines, margin + 4, y + 10);
          y += boxH + 4;
          doc.setFontSize(10);
        } else if (item.text) {
          checkPage(8);
          const lines = doc.splitTextToSize(item.text, contentW);
          if (item.bold) doc.setFont('helvetica', 'bold');
          doc.text(lines, margin, y);
          if (item.bold) doc.setFont('helvetica', 'normal');
          y += lines.length * 4.5 + 2;
        }
      }
    }

    renderItems(section.content || []);

    (section.subsections || []).forEach(sub => {
      checkPage(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 58, 73);
      const subLines = doc.splitTextToSize(sub.title, contentW);
      doc.text(subLines, margin, y);
      y += subLines.length * 6 + 3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      renderItems(sub.content || []);
    });

    y += 6;
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('LARE Prep — Section ' + secNum + ' Study Guide', margin, pageH - 10);
    doc.text('Page ' + i + ' of ' + totalPages, pageW - margin, pageH - 10, { align: 'right' });
  }

  doc.save('LARE_Section' + secNum + '_Study_Guide.pdf');
};

/* -- Helpers ------------------------------------------------------------- */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

/* -- Global nav helpers -------------------------------------------------- */
window.navigate = navigate;
