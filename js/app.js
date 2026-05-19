/* ==========================================================================
   ASLA LARE Prep — Application Core
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

const API_BASE = '/api';

async function loadCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'same-origin' });
    if (!res.ok) return;
    const body = await res.json();
    currentUser = body.authenticated ? body.user : null;
  } catch (e) {
    currentUser = null;
  }
}

window.signOutASLA = function() {
  /* Cookie-based session — server clears it and redirects */
  window.location.href = '/api/auth/logout';
};

/* -- Router -------------------------------------------------------------- */
function parseHash() {
  const hash = location.hash.slice(1) || '';
  const parts = hash.split('/').filter(Boolean);
  return { section: parts[0] || 'home', sub: parts[1] || null, extra: parts[2] || null };
}

function navigate(path) {
  location.hash = '#' + path;
}

/* Keyboard activation for div[role=button] — Enter or Space fires the click handler */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target.closest('[role="button"]');
  if (!target || target.tagName === 'BUTTON' || target.tagName === 'A') return;
  e.preventDefault();
  target.click();
});

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  renderAuthArea();
  try {
    await loadData();
  } catch (err) {
    console.error('Failed to load study materials:', err);
    const app = document.getElementById('app');
    app.textContent = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:64px 24px;text-align:center;color:var(--dark-gray)';
    const h2 = document.createElement('h2');
    h2.textContent = 'Could not load study materials';
    const p = document.createElement('p');
    p.textContent = 'Please refresh the page. If this keeps happening, try again later.';
    wrap.append(h2, p);
    app.append(wrap);
    return;
  }
  setupDropdown();
  setupMobileMenu();
  syncProgressFromCloud();
  route();
});

async function loadData() {
  const resp = await fetch('js/content/data.json');
  if (!resp.ok) throw new Error('data.json fetch failed: ' + resp.status);
  DATA = await resp.json();
}

function route() {
  const r = parseHash();
  const app = document.getElementById('app');
  const oldView = currentView;
  currentView = r;

  /* Clear per-view state so stray handlers from the previous view no-op */
  window.__quizState = null;
  window.__flashState = null;

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
  } else if (r.section === 'books' || r.section === 'exams' || r.section === 'flashcards') {
    renderResourceLanding(app, r.section);
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
    const name = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || 'ASLA Member';
    area.innerHTML = `
      <span class="user-name">${escHtml(name)}</span>
      <button class="auth-btn auth-btn-signout" onclick="signOutASLA()">Sign out</button>
    `;
  } else {
    /* Server gates the app — we shouldn't normally render the SPA without a user */
    area.innerHTML = '';
  }
}

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
  syncProgressToCloud(progress);
}

function clearProgress() {
  localStorage.removeItem('lare-progress');
  fetch(`${API_BASE}/progress`, {
    method: 'DELETE',
    credentials: 'same-origin',
  }).catch(() => {});
}
window.clearProgress = clearProgress;

let pendingSyncTimer = null;
async function syncProgressToCloud(progress) {
  /* Coalesce rapid writes (e.g. multi-question lesson completion) into one PUT */
  clearTimeout(pendingSyncTimer);
  pendingSyncTimer = setTimeout(async () => {
    try {
      await fetch(`${API_BASE}/progress`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progress),
      });
    } catch (e) { /* offline-tolerant: localStorage is the source of truth */ }
  }, 250);
}

async function syncProgressFromCloud() {
  try {
    const res = await fetch(`${API_BASE}/progress`, { credentials: 'same-origin' });
    if (!res.ok) return;
    const cloud = await res.json();
    const local = getProgress();
    if (!cloud || Object.keys(cloud).length === 0) {
      if (Object.keys(local).length) syncProgressToCloud(local);
      return;
    }
    const merged = mergeProgress(local, cloud);
    localStorage.setItem('lare-progress', JSON.stringify(merged));
    if (currentView?.section === 'dashboard') renderDashboard(document.getElementById('app'));
  } catch (e) { /* offline-tolerant */ }
}

function mergeProgress(a, b) {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    if (!result[key]) { result[key] = b[key]; continue; }
    /* Microlearning completion is stored as an array of lesson indices */
    if (Array.isArray(result[key]) || Array.isArray(b[key])) {
      const set = new Set([...(result[key] || []), ...(b[key] || [])]);
      result[key] = Array.from(set);
      continue;
    }
    result[key] = {
      examAttempts: (result[key].examAttempts || 0) + (b[key].examAttempts || 0),
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
            <h2 style="font-size:36px;font-weight:600;color:var(--asla-teal);letter-spacing:-.015em;margin:0">Four exams to licensure</h2>
          </div>
        </div>
        <div class="sections-grid">
          ${SECTIONS.map(s => {
            const p = progress['s' + s.id] || {};
            const examPct = p.examBest != null ? p.examBest + '%' : '--';
            return `
            <div class="section-card" role="button" tabindex="0" aria-label="Open ${escHtml(s.short)}: ${escHtml(s.title)}" onclick="navigate('s${s.id}/book')">
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
        <button class="content-tab ${tab === 'learn' ? 'active' : ''}" onclick="navigate('${key}/learn')">Microlearning</button>
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
  } else if (tab === 'learn') {
    renderMicrolearning(container, secNum);
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
      return '<a data-scroll="' + id + '-' + j + '" class="sub">' + truncate(sub.title, 40) + '</a>';
    }).join('');
    return '<a data-scroll="' + id + '">' + truncate(s.title, 45) + '</a>' + subs;
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
  setupTocClicks();
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
        const link = document.querySelector('.toc a[data-scroll="' + entry.target.id + '"]');
        if (link) link.classList.add('active');
      }
    });
  }, { rootMargin: '-120px 0px -60% 0px', threshold: 0 });

  document.querySelectorAll('.content-area h2[id], .content-area h3[id], .content-area h4[id]').forEach(el => {
    observer.observe(el);
  });
}

function setupTocClicks() {
  document.querySelectorAll('.toc a[data-scroll]').forEach(link => {
    link.style.cursor = 'pointer';
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.getElementById(link.dataset.scroll);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

/* -- Microlearning ------------------------------------------------------- */
function buildLessons(secNum) {
  const bookData = DATA[`s${secNum}_book`];
  if (!bookData) return [];
  const lessons = [];
  let currentLesson = null;

  for (const section of bookData) {
    if (section.level === 'h1' && /^Chapter \d+:/.test(section.title) && !/Review|Exam Strategy/i.test(section.title)) {
      if (currentLesson && currentLesson.slides.length > 0) lessons.push(currentLesson);
      currentLesson = { title: section.title, intro: section.content, slides: [] };
    } else if (section.level === 'h2' && currentLesson && !/Review Questions/i.test(section.title)) {
      currentLesson.slides.push({ title: section.title, content: section.content });
    }
  }
  if (currentLesson && currentLesson.slides.length > 0) lessons.push(currentLesson);
  return lessons;
}

function renderMicrolearning(container, secNum) {
  const lessons = buildLessons(secNum);
  if (!lessons.length) { container.innerHTML = '<p class="container" style="padding:48px 24px">No lessons available yet.</p>'; return; }

  const progress = getProgress();
  const mlKey = `s${secNum}_microlearn`;
  const completed = progress[mlKey] || [];

  container.innerHTML = `
    <div class="container" style="padding:48px 24px 96px">
      <div class="ml-header">
        <h2>Microlearning Modules</h2>
        <p class="text-muted">Bite-sized interactive lessons — work through each chapter one slide at a time.</p>
        <div class="ml-overall-progress">
          <div class="ml-progress-text">${completed.length} of ${lessons.length} lessons completed</div>
          <div class="ml-progress-bar-bg"><div class="ml-progress-bar-fill" style="width:${Math.round(completed.length/lessons.length*100)}%"></div></div>
        </div>
      </div>
      <div class="ml-lessons-grid">
        ${lessons.map((lesson, i) => {
          const done = completed.includes(i);
          const slideCount = lesson.slides.length;
          return `
            <div class="ml-lesson-card ${done ? 'ml-completed' : ''}" role="button" tabindex="0" aria-label="Start lesson: ${escHtml(lesson.title)}" onclick="startLesson(${secNum}, ${i})">
              <div class="ml-lesson-number">${String(i + 1).padStart(2, '0')}</div>
              <div class="ml-lesson-info">
                <h3>${escHtml(lesson.title)}</h3>
                <div class="ml-lesson-meta">${slideCount} slides · ~${Math.max(2, Math.round(slideCount * 1.5))} min</div>
              </div>
              <div class="ml-lesson-status">${done ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--asla-green)" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--dark-gray)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="10 8 16 12 10 16"/></svg>'}</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

window.startLesson = function(secNum, lessonIdx) {
  const lessons = buildLessons(secNum);
  const lesson = lessons[lessonIdx];
  if (!lesson) return;

  const state = { secNum, lessonIdx, slideIdx: 0, lesson, totalSlides: lesson.slides.length };
  renderSlide(state);
};

function renderSlide(state) {
  const container = document.getElementById('section-content');
  const { lesson, slideIdx, totalSlides, secNum, lessonIdx } = state;
  const slide = lesson.slides[slideIdx];
  const pct = Math.round(((slideIdx + 1) / totalSlides) * 100);

  let contentHtml = '';
  const contentArr = Array.isArray(slide.content) ? slide.content : [];

  for (const block of contentArr) {
    if (block.type === 'p') {
      const cls = block.bold ? ' class="ml-bold-point"' : '';
      contentHtml += `<div${cls}>${escHtml(block.text)}</div>`;
    } else if (block.type === 'bullet') {
      contentHtml += `<div class="ml-bullet">${escHtml(block.text)}</div>`;
    } else if (block.type === 'table') {
      contentHtml += renderTable(block);
    } else if (block.type === 'tip') {
      contentHtml += `<div class="ml-callout ml-tip"><strong>💡 Exam Tip</strong><p>${escHtml(block.text.replace(/^EXAM TIP:\s*/i, ''))}</p></div>`;
    } else if (block.type === 'memory') {
      contentHtml += `<div class="ml-callout ml-memory"><strong>🧠 Memory Aid</strong><p>${escHtml(block.text.replace(/^MEMORY AID:\s*/i, ''))}</p></div>`;
    } else if (block.type === 'example') {
      contentHtml += `<div class="ml-callout ml-example"><strong>📋 Real-World Example</strong><p>${escHtml(block.text.replace(/^REAL-WORLD EXAMPLE:\s*/i, ''))}</p></div>`;
    }
  }

  if (!contentHtml) {
    contentHtml = '<p class="text-muted">This topic is covered in the study book — open the Study Book tab for the full text.</p>';
  }

  container.innerHTML = `
    <div class="ml-player">
      <div class="ml-player-header">
        <button class="ml-back-btn" onclick="location.hash='#s${secNum}/learn';route()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          All Lessons
        </button>
        <div class="ml-lesson-title">${escHtml(lesson.title)}</div>
      </div>
      <div class="ml-progress-row">
        <div class="ml-progress-bar-bg"><div class="ml-progress-bar-fill" style="width:${pct}%"></div></div>
        <span class="ml-progress-label">${slideIdx + 1} / ${totalSlides}</span>
      </div>
      <div class="ml-slide fade-in" id="ml-current-slide">
        <h2 class="ml-slide-title">${escHtml(slide.title)}</h2>
        <div class="ml-slide-content">${contentHtml}</div>
      </div>
      <div class="ml-nav">
        <button class="btn btn-secondary" ${slideIdx === 0 ? 'disabled' : ''} onclick="mlNav(${secNum},${lessonIdx},${slideIdx - 1})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="15 18 9 12 15 6"/></svg> Previous
        </button>
        ${slideIdx === totalSlides - 1
          ? `<button class="btn btn-primary" onclick="completeLesson(${secNum},${lessonIdx})">Complete Lesson ✓</button>`
          : `<button class="btn btn-primary" onclick="mlNav(${secNum},${lessonIdx},${slideIdx + 1})">Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><polyline points="9 18 15 12 9 6"/></svg></button>`
        }
      </div>
    </div>`;
}

window.mlNav = function(secNum, lessonIdx, newSlideIdx) {
  const lessons = buildLessons(secNum);
  const lesson = lessons[lessonIdx];
  if (!lesson || newSlideIdx < 0 || newSlideIdx >= lesson.slides.length) return;
  renderSlide({ secNum, lessonIdx, slideIdx: newSlideIdx, lesson, totalSlides: lesson.slides.length });
  document.getElementById('ml-current-slide')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.completeLesson = function(secNum, lessonIdx) {
  const progress = getProgress();
  const mlKey = `s${secNum}_microlearn`;
  if (!progress[mlKey]) progress[mlKey] = [];
  if (!progress[mlKey].includes(lessonIdx)) {
    progress[mlKey].push(lessonIdx);
    localStorage.setItem('lare-progress', JSON.stringify(progress));
    syncProgressToCloud(progress);
  }
  location.hash = `#s${secNum}/learn`;
  route();
};

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
          <button class="btn btn-sm btn-secondary" onclick="printFlashcards()">Print all</button>
        </div>
      </div>

      <div class="flashcard-wrapper" role="button" tabindex="0" aria-label="Flip flashcard" onclick="flipCard()">
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
  if (!state) return;
  state.flipped = !state.flipped;
  renderFlashcard(document.getElementById('section-content'), state);
};

window.prevFlashcard = function() {
  const state = window.__flashState;
  if (!state || state.current <= 0) return;
  state.current--;
  state.flipped = false;
  renderFlashcard(document.getElementById('section-content'), state);
};

window.nextFlashcard = function() {
  const state = window.__flashState;
  if (!state || state.current >= state.cards.length - 1) return;
  state.current++;
  state.flipped = false;
  renderFlashcard(document.getElementById('section-content'), state);
};

window.shuffleFlashcards = function() {
  const state = window.__flashState;
  if (!state) return;
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

window.printFlashcards = function() {
  /* Print CSS (style.css ~1464) hides the interactive UI and reveals .flash-print-grid,
     which is rendered alongside the active card. No section arg needed. */
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
    const isDisabled = isRevealed;
    const tabAttr = isDisabled ? 'tabindex="-1" aria-disabled="true"' : 'tabindex="0"';
    return '<div class="' + cls + '" role="button" ' + tabAttr + ' onclick="selectChoice(\'' + c.letter + '\')">' +
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
  if (!state || state.revealed[state.current] || state.submitted) return;
  state.answers[state.current] = letter;
  renderQuestion(document.getElementById('section-content'), state);
};

window.checkAnswer = function() {
  const state = window.__quizState;
  if (!state) return;
  state.revealed[state.current] = true;
  renderQuestion(document.getElementById('section-content'), state);
};

window.goToQuestion = function(i) {
  const state = window.__quizState;
  if (!state) return;
  state.current = i;
  if (state.submitted) state.revealed[i] = true;
  renderQuestion(document.getElementById('section-content'), state);
};

window.prevQuestion = function() {
  const state = window.__quizState;
  if (!state || state.current <= 0) return;
  state.current--;
  renderQuestion(document.getElementById('section-content'), state);
};

window.nextQuestion = function() {
  const state = window.__quizState;
  if (!state || state.current >= state.questions.length - 1) return;
  state.current++;
  renderQuestion(document.getElementById('section-content'), state);
};

window.submitExam = function() {
  const state = window.__quizState;
  if (!state) return;
  state.submitted = true;
  state.revealed = state.revealed.map(() => true);
  renderResults(document.getElementById('section-content'), state);
};

window.reviewExam = function() {
  const state = window.__quizState;
  if (!state) return;
  state.current = 0;
  state.revealed = state.revealed.map(() => true);
  renderQuestion(document.getElementById('section-content'), state);
};

window.retakeExam = function() {
  const state = window.__quizState;
  if (!state) return;
  state.current = 0;
  state.answers = new Array(state.questions.length).fill(null);
  state.revealed = new Array(state.questions.length).fill(false);
  state.submitted = false;
  renderQuestion(document.getElementById('section-content'), state);
};

window.setExamMode = function(mode) {
  const state = window.__quizState;
  if (!state) return;
  if (mode === 'review') {
    state.submitted = true;
    state.revealed = state.revealed.map(() => true);
    renderResults(document.getElementById('section-content'), state);
  } else {
    state.current = 0;
    renderQuestion(document.getElementById('section-content'), state);
  }
};

/* -- Resource Landing Pages ----------------------------------------------- */
function renderResourceLanding(app, type) {
  const config = {
    books: {
      title: 'Study Books',
      subtitle: 'In-depth textbook coverage for every LARE section',
      tab: 'book',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
      description: 'Each study book provides comprehensive, chapter-by-chapter coverage with teaching narratives, memory aids, real-world examples, and review questions.',
    },
    exams: {
      title: 'Practice Exams',
      subtitle: '160 multiple-choice questions across all four sections',
      tab: 'exam',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      description: '40 questions per section with instant scoring, detailed explanations, and progress tracking. Practice mode lets you check answers one at a time.',
    },
    flashcards: {
      title: 'Flashcards',
      subtitle: '220+ interactive cards for quick review',
      tab: 'flash',
      icon: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
      description: 'Flip cards generated from exam questions, exam tips, memory aids, and key term definitions. Study online with shuffle mode or print for on-the-go review.',
    },
  };

  const c = config[type];
  const progress = getProgress();

  const cardsHtml = SECTIONS.map(s => {
    const p = progress['s' + s.id] || {};
    const examPct = p.examBest != null ? p.examBest + '%' : '--';
    const flashCount = DATA['s' + s.id + '_flash']?.length || 0;
    const examCount = DATA['s' + s.id + '_exam']?.length || 0;
    const bookCount = DATA['s' + s.id + '_book']?.length || 0;

    let meta = '';
    if (type === 'books') meta = bookCount + ' chapters';
    else if (type === 'exams') meta = examCount + ' questions · Best: ' + examPct;
    else meta = flashCount + ' cards';

    return `
      <div class="section-card" role="button" tabindex="0" aria-label="Open Section ${s.id}: ${escHtml(s.title)}" onclick="navigate('s${s.id}/${c.tab}')">
        <div class="card-num">Section ${s.id}</div>
        <h3>${escHtml(s.title)}</h3>
        <p>${s.items} scored items on the LARE</p>
        <div class="card-meta">
          <span>${meta}</span>
        </div>
      </div>`;
  }).join('');

  /* c.icon is intentional raw SVG from the hardcoded config — all other fields escaped */
  app.innerHTML = `
    <div class="page-header">
      <div class="container">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;color:var(--asla-green)">${c.icon}</div>
        <h1><strong>${escHtml(c.title)}</strong></h1>
        <div class="subtitle">${escHtml(c.subtitle)}</div>
      </div>
    </div>
    <div class="container" style="padding-top:48px;padding-bottom:96px">
      <p style="max-width:680px;margin-bottom:40px;color:var(--dark-gray);line-height:1.7">${escHtml(c.description)}</p>
      <div class="sections-grid">${cardsHtml}</div>
    </div>
  `;
}

/* -- Dashboard ----------------------------------------------------------- */
function renderDashboard(app) {
  const progress = getProgress();

  const cardsHtml = SECTIONS.map(s => {
    const key = 's' + s.id;
    const p = progress[key] || {};
    const bestPct = p.examBest != null ? p.examBest : null;
    const attempts = p.examAttempts || 0;
    const lastDate = p.lastAttempt ? new Date(p.lastAttempt).toLocaleDateString() : '--';

    const mlCompleted = progress[`s${s.id}_microlearn`] || [];
    const mlTotal = buildLessons(s.id).length;
    const mlPct = mlTotal > 0 ? Math.round(mlCompleted.length / mlTotal * 100) : 0;

    return `
      <div class="progress-card">
        <h4>Section ${s.id}</h4>
        <p style="font-size:13px;color:var(--dark-gray);margin:4px 0 12px">${s.title}</p>
        <div class="pct">${bestPct != null ? bestPct + '%' : '--'}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${bestPct || 0}%"></div></div>
        <div style="font-size:12px;color:var(--placeholder-gray);margin-top:8px">${attempts} attempt${attempts !== 1 ? 's' : ''} · Last: ${lastDate}</div>
        <div style="margin-top:12px;font-size:12px;color:var(--dark-gray)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span>Microlearning: ${mlCompleted.length}/${mlTotal} lessons</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${mlPct}%;background:var(--asla-green)"></div></div>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" onclick="navigate('${key}/exam')">Take exam</button>
          <button class="btn btn-sm btn-secondary" onclick="navigate('${key}/learn')">Lessons</button>
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

  const totalLessonsCompleted = SECTIONS.reduce((sum, s) => sum + (progress[`s${s.id}_microlearn`] || []).length, 0);
  const totalLessons = SECTIONS.reduce((sum, s) => sum + buildLessons(s.id).length, 0);

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
        <div style="background:var(--white);padding:24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle);text-align:center">
          <div style="font-size:36px;font-weight:600;color:var(--asla-green)">${totalLessonsCompleted}/${totalLessons}</div>
          <div style="font-size:13px;color:var(--dark-gray)">Lessons Completed</div>
        </div>
      </div>
      <div class="progress-grid">${cardsHtml}</div>
      <div style="margin-top:40px;text-align:center;display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        ${''}
        <button class="btn btn-secondary" onclick="if(confirm('Clear all progress data?')){clearProgress();route();}">Reset all progress</button>
      </div>
    </div>
  `;
}

/* -- PDF Generation ------------------------------------------------------ */
let jspdfLoadPromise = null;
function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve();
  if (jspdfLoadPromise) return jspdfLoadPromise;
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
  jspdfLoadPromise = load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js')
    .then(() => load('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js'));
  return jspdfLoadPromise;
}

window.generateStudyGuidePDF = async function(secNum) {
  const key = `s${secNum}_guide`;
  const sections = DATA[key];
  const sec = SECTIONS[secNum - 1];

  if (!sections || !sections.length) {
    alert('Study guide content not available.');
    return;
  }

  try {
    await loadJsPdf();
  } catch (e) {
    alert('Could not load PDF library. Please check your connection and try again.');
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
    doc.text('ASLA LARE Prep — Section ' + secNum + ' Study Guide', margin, pageH - 10);
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
