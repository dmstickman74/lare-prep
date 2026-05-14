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

  if (r.section === 'home' || r.section === '') {
    renderHome(app);
  } else if (r.section.match(/^s[1-4]$/)) {
    const secNum = parseInt(r.section[1]);
    const tab = r.sub || 'guide';
    renderSection(app, secNum, tab);
  } else if (r.section === 'progress') {
    renderProgress(app);
  } else {
    renderHome(app);
  }

  updateNav(r);
  window.scrollTo({ top: 0, behavior: oldView?.section !== r.section ? 'auto' : 'smooth' });
}

function updateNav(r) {
  document.querySelectorAll('.header-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === r.section);
  });
  document.querySelectorAll('.section-tab').forEach(t => {
    const s = t.dataset.section;
    t.classList.toggle('active', s === r.section);
  });
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
          <p>Comprehensive study guides, in-depth textbooks, and interactive practice exams for all four LARE sections. Prepare with confidence.</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="navigate('s1/guide')">Start studying</button>
            <button class="btn btn-secondary" onclick="navigate('progress')">View progress</button>
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
            const p = progress[`s${s.id}`] || {};
            const examPct = p.examBest != null ? p.examBest + '%' : '--';
            return `
            <div class="section-card" onclick="navigate('s${s.id}/guide')">
              <div class="card-num">Section ${s.id}</div>
              <h3>${s.title}</h3>
              <p>${s.items} scored items on the exam. Study guide, full textbook, and 40-question practice exam.</p>
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
        <div class="stat"><div class="stat-num">12</div><div class="stat-label">Study Documents</div></div>
        <div class="stat"><div class="stat-num">320</div><div class="stat-label">Scored Exam Items</div></div>
      </div>
    </section>

    <section style="background:var(--warm-cream);padding:72px 24px">
      <div class="container" style="max-width:800px;text-align:center">
        <div class="hero-eyebrow" style="margin-bottom:16px">How It Works</div>
        <h2 style="font-size:32px;font-weight:600;color:var(--asla-teal);margin-bottom:40px;letter-spacing:-.01em">A structured approach to exam preparation</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:left">
          <div style="background:var(--white);padding:28px 24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle)">
            <div style="font-size:36px;font-weight:300;color:var(--asla-green);margin-bottom:12px">01</div>
            <h4 style="font-size:17px;font-weight:600;color:var(--asla-teal);margin-bottom:8px">Study Guide</h4>
            <p style="font-size:14px;color:var(--dark-gray);line-height:1.55">Concise outlines covering key concepts, reference tables, and exam strategies for each domain.</p>
          </div>
          <div style="background:var(--white);padding:28px 24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle)">
            <div style="font-size:36px;font-weight:300;color:var(--asla-green);margin-bottom:12px">02</div>
            <h4 style="font-size:17px;font-weight:600;color:var(--asla-teal);margin-bottom:8px">Study Book</h4>
            <p style="font-size:14px;color:var(--dark-gray);line-height:1.55">In-depth textbook coverage with teaching narratives, memory aids, real-world examples, and review questions.</p>
          </div>
          <div style="background:var(--white);padding:28px 24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-subtle)">
            <div style="font-size:36px;font-weight:300;color:var(--asla-green);margin-bottom:12px">03</div>
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
        <button class="content-tab ${tab === 'guide' ? 'active' : ''}" onclick="navigate('${key}/guide')">Study Guide</button>
        <button class="content-tab ${tab === 'book' ? 'active' : ''}" onclick="navigate('${key}/book')">Study Book</button>
        <button class="content-tab ${tab === 'exam' ? 'active' : ''}" onclick="navigate('${key}/exam')">Practice Exam</button>
      </div>
    </div>
    <div id="section-content" class="fade-in"></div>
  `;

  const container = document.getElementById('section-content');

  if (tab === 'exam') {
    renderExam(container, secNum);
  } else {
    renderStudyContent(container, secNum, tab);
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
    const id = `sec-${i}`;
    const subs = (s.subsections || []).map((sub, j) => {
      return `<a href="#${id}-${j}" class="sub">${truncate(sub.title, 40)}</a>`;
    }).join('');
    return `<a href="#${id}">${truncate(s.title, 45)}</a>${subs}`;
  }).join('');

  const contentHtml = sections.map((s, i) => {
    const id = `sec-${i}`;
    let html = `<h2 id="${id}">${escHtml(s.title)}</h2>`;
    html += renderContentItems(s.content || []);

    (s.subsections || []).forEach((sub, j) => {
      const subId = `${id}-${j}`;
      const tag = sub.level === 'h4' ? 'h4' : 'h3';
      html += `<${tag} id="${subId}">${escHtml(sub.title)}</${tag}>`;
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
      html += `<li${cls}>${escHtml(item.text)}</li>`;
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
        html += `<p${bold}>${escHtml(item.text)}</p>`;
      }
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function renderTable(item) {
  const headers = (item.headers || []).map(h => `<th>${escHtml(h)}</th>`).join('');
  const rows = (item.rows || []).map(row =>
    `<tr>${row.map(c => `<td>${escHtml(c)}</td>`).join('')}</tr>`
  ).join('');
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderCallout(type, title, text) {
  const icons = {
    tip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    memory: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    example: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    summary: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  };
  return `<div class="callout ${type}">
    <div class="callout-title">${icons[type] || ''}${title}</div>
    ${escHtml(text)}
  </div>`;
}

/* -- Scroll Spy ---------------------------------------------------------- */
function setupScrollSpy() {
  const tocLinks = document.querySelectorAll('.toc a');
  if (!tocLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocLinks.forEach(l => l.classList.remove('active'));
        const link = document.querySelector(`.toc a[href="#${entry.target.id}"]`);
        if (link) link.classList.add('active');
      }
    });
  }, { rootMargin: '-120px 0px -60% 0px', threshold: 0 });

  document.querySelectorAll('.content-area h2[id], .content-area h3[id], .content-area h4[id]').forEach(el => {
    observer.observe(el);
  });
}

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
    return `<button class="${cls}" onclick="goToQuestion(${i})">${i + 1}</button>`;
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
    return `
      <div class="${cls}" onclick="selectChoice('${c.letter}')">
        <div class="choice-letter">${c.letter}</div>
        <div>${escHtml(c.text)}</div>
      </div>`;
  }).join('');

  const explanationHtml = isRevealed && q.explanation
    ? `<div class="explanation"><strong>Explanation:</strong> ${escHtml(q.explanation)}</div>`
    : '';

  const checkBtnHtml = selected !== null && !isRevealed
    ? `<button class="btn btn-green" onclick="checkAnswer()">Check answer</button>`
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
          ${!submitted && totalAnswered === questions.length ? `<button class="btn btn-primary" onclick="submitExam()">Submit exam</button>` : ''}
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
    const cls = `q-dot ${isCorrect ? 'correct-dot' : 'incorrect-dot'}`;
    return `<button class="${cls}" onclick="goToQuestion(${i})">${i + 1}</button>`;
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
    renderQuestion(container, state);
  } else {
    renderQuestion(container, state);
  }
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

/* -- Progress Page ------------------------------------------------------- */
function renderProgress(app) {
  const progress = getProgress();

  const cardsHtml = SECTIONS.map(s => {
    const key = `s${s.id}`;
    const p = progress[key] || {};
    const bestPct = p.examBest != null ? p.examBest : null;
    const attempts = p.examAttempts || 0;

    return `
      <div class="progress-card">
        <h4>Section ${s.id}</h4>
        <p style="font-size:13px;color:var(--dark-gray);margin:4px 0 12px">${s.title}</p>
        <div class="pct">${bestPct != null ? bestPct + '%' : '--'}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${bestPct || 0}%"></div></div>
        <div style="font-size:12px;color:var(--placeholder-gray);margin-top:8px">${attempts} attempt${attempts !== 1 ? 's' : ''}</div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" onclick="navigate('${key}/exam')">Take exam</button>
          <button class="btn btn-sm btn-secondary" onclick="navigate('${key}/guide')">Study</button>
        </div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="page-header">
      <div class="container">
        <h1><strong>Your Progress</strong></h1>
        <div class="subtitle">Track your exam preparation across all four sections</div>
      </div>
    </div>
    <div class="container" style="padding-top:48px;padding-bottom:96px">
      <div class="progress-grid">${cardsHtml}</div>
      <div style="margin-top:40px;text-align:center">
        <button class="btn btn-secondary" onclick="if(confirm('Clear all progress data?')){clearProgress();route();}">Reset all progress</button>
      </div>
    </div>
  `;
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
}

function clearProgress() {
  localStorage.removeItem('lare-progress');
}
window.clearProgress = clearProgress;

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
