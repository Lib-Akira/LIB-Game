// ==========================================================================
// Library Quest — โหมดแข่งเวลา (ปฐมนิเทศ)
// กติกา: หัวใจเริ่มต้น 3 ดวง / ตอบผิดหรือหมดเวลา -1 ดวง / หัวใจหมด = จบภารกิจ (เริ่มใหม่ได้ไม่จำกัด)
// ตอบครบทุกข้อโดยหัวใจไม่หมด = ผ่านภารกิจ ระบบจับเวลารวมไว้เพื่อตัดสินผู้ชนะ (มาก่อนได้ก่อน)
// ==========================================================================

// ---- ตั้งค่ากิจกรรม ----
const CONFIG = {
  MAX_LIVES: 3,
  TIME_PER_QUESTION: 10,        // วินาทีต่อข้อ
  RANDOMIZE_QUESTIONS: false,   // false = ทุกคนเจอคำถามลำดับเดียวกัน (ยุติธรรมสำหรับแข่งเวลา)
  // วาง Web App URL จาก Google Apps Script ตรงนี้เพื่อบันทึกผลลง Google Sheet อัตโนมัติ
  // ถ้าปล่อยว่างไว้ ระบบจะยังเล่นได้ปกติ แค่ไม่ส่งข้อมูลไปที่ไหน (ดูวิธีตั้งค่าใน README.md)
  SHEET_ENDPOINT: 'https://script.google.com/a/macros/slc.ac.th/s/AKfycbwHHxUqPkjQmNGb9b4IFqDRXsogsz68mUYQt-dB2ybzSIy16V2G5SttGKHkVtLZFuQQrA/exec'
};

const MAX_LIVES = CONFIG.MAX_LIVES;

const screens = {
  start: document.getElementById('screen-start'),
  player: document.getElementById('screen-player'),
  quiz: document.getElementById('screen-quiz'),
  over: document.getElementById('screen-over'),
  complete: document.getElementById('screen-complete'),
};

let state = {
  order: [],
  index: 0,
  lives: MAX_LIVES,
  correctCount: 0,
  locked: false,
  playerName: '',
  studentId: '',
  faculty: '',
  quizStartTime: 0,
  timeLeft: CONFIG.TIME_PER_QUESTION,
};

let timerId = null;

function showScreen(name){
  Object.values(screens).forEach(s => s.hidden = true);
  screens[name].hidden = false;
}

function shuffledIndices(n){
  const arr = Array.from({length: n}, (_, i) => i);
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sequentialIndices(n){
  return Array.from({length: n}, (_, i) => i);
}

// ---- หน้าลงทะเบียนผู้เล่น ----
document.getElementById('btn-start').addEventListener('click', () => {
  showScreen('player');
});

document.getElementById('btn-player-continue').addEventListener('click', () => {
  const nameInput = document.getElementById('player-name');
  const idInput = document.getElementById('player-id');
  const facultyInput = document.getElementById('player-faculty');
  const errorEl = document.getElementById('player-form-error');
  const name = nameInput.value.trim();
  const id = idInput.value.trim();
  const faculty = facultyInput.value.trim();

  if(!name || !id || !faculty){
    errorEl.hidden = false;
    if(!name) nameInput.focus();
    else if(!id) idInput.focus();
    else facultyInput.focus();
    return;
  }
  errorEl.hidden = true;
  state.playerName = name;
  state.studentId = id;
  state.faculty = faculty;
  startQuest();
});

// ---- เริ่ม/ดำเนินเกม ----
function startQuest(){
  state.order = CONFIG.RANDOMIZE_QUESTIONS ? shuffledIndices(QUESTIONS.length) : sequentialIndices(QUESTIONS.length);
  state.index = 0;
  state.lives = MAX_LIVES;
  state.correctCount = 0;
  state.locked = false;
  state.quizStartTime = Date.now();

  document.getElementById('save-status').hidden = true;
  renderHearts();
  showScreen('quiz');
  renderQuestion();
}

function renderHearts(){
  const el = document.getElementById('hearts');
  el.innerHTML = '';
  for(let i = 0; i < MAX_LIVES; i++){
    const span = document.createElement('span');
    span.className = 'heart' + (i >= state.lives ? ' heart--lost' : '');
    span.textContent = '\u2764\uFE0F';
    span.setAttribute('aria-hidden', 'true');
    el.appendChild(span);
  }
}

function renderHeartsInto(containerId, livesRemaining){
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = '';
  for(let i = 0; i < MAX_LIVES; i++){
    const span = document.createElement('span');
    span.className = 'heart-icon';
    span.textContent = i < livesRemaining ? '\u2764\uFE0F' : '\u{1F90D}';
    el.appendChild(span);
  }
}

function loseHeart(){
  state.lives--;
  const hearts = document.querySelectorAll('#hearts .heart');
  const target = hearts[state.lives];
  if(target){
    target.classList.add('heart--breaking');
    setTimeout(() => renderHearts(), 420);
  } else {
    renderHearts();
  }
}

// ---- ตัวจับเวลาต่อข้อ ----
function startTimer(){
  stopTimer();
  state.timeLeft = CONFIG.TIME_PER_QUESTION;
  updateTimerUI();
  timerId = setInterval(() => {
    state.timeLeft--;
    updateTimerUI();
    if(state.timeLeft <= 0){
      stopTimer();
      handleTimeout();
    }
  }, 1000);
}

function stopTimer(){
  if(timerId){
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerUI(){
  const fill = document.getElementById('timer-fill');
  const num = document.getElementById('timer-num');
  const pct = Math.max(0, (state.timeLeft / CONFIG.TIME_PER_QUESTION) * 100);
  fill.style.width = pct + '%';
  num.textContent = Math.max(0, state.timeLeft);

  fill.classList.remove('timer-fill--warn', 'timer-fill--danger');
  num.classList.remove('timer-num--danger');
  if(state.timeLeft <= 3){
    fill.classList.add('timer-fill--danger');
    num.classList.add('timer-num--danger');
  } else if(state.timeLeft <= 6){
    fill.classList.add('timer-fill--warn');
  }
}

function renderQuestion(){
  state.locked = false;
  const total = state.order.length;
  const qIndex = state.order[state.index];
  const q = QUESTIONS[qIndex];

  document.getElementById('progress-label').textContent = `Progress: ${state.index + 1}/${total}`;
  document.getElementById('progress-fill').style.width = `${(state.index / total) * 100}%`;
  document.getElementById('question-num').textContent = `ข้อที่ ${state.index + 1}`;
  document.getElementById('question-text').textContent = q.text;

  const letters = ['A', 'B', 'C', 'D'];
  const answersEl = document.getElementById('answers');
  answersEl.innerHTML = '';
  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'answer';
    btn.innerHTML = `<span class="answer__letter">${letters[i]}</span><span>${choice}</span>`;
    btn.addEventListener('click', () => handleAnswer(i, q.answer));
    answersEl.appendChild(btn);
  });

  const feedback = document.getElementById('feedback');
  feedback.hidden = true;
  feedback.className = 'feedback';

  startTimer();
}

function handleTimeout(){
  if(state.locked) return;
  state.locked = true;

  const buttons = document.querySelectorAll('#answers .answer');
  const quizCard = document.getElementById('screen-quiz');
  buttons.forEach(b => { b.disabled = true; b.classList.add('answer--dim'); });

  const feedback = document.getElementById('feedback');
  const feedbackText = document.getElementById('feedback-text');
  feedback.hidden = false;
  feedback.classList.add('feedback--wrong');
  feedbackText.textContent = 'หมดเวลา! เสียหัวใจไป 1 ดวง';

  quizCard.classList.remove('flash-correct', 'flash-wrong', 'shake');
  void quizCard.offsetWidth;
  quizCard.classList.add('flash-wrong', 'shake');
  loseHeart();

  advanceAfterAnswer();
}

function handleAnswer(chosenIndex, correctIndex){
  if(state.locked) return;
  state.locked = true;
  stopTimer();

  const buttons = document.querySelectorAll('#answers .answer');
  const isCorrect = chosenIndex === correctIndex;
  const quizCard = document.getElementById('screen-quiz');

  buttons.forEach((b, i) => {
    b.disabled = true;
    if(i === chosenIndex){
      if(isCorrect){
        b.classList.add('answer--correct', 'answer--pop');
        const mark = document.createElement('span');
        mark.className = 'answer__mark answer__mark--correct';
        mark.textContent = '\u2713';
        b.appendChild(mark);
      } else {
        b.classList.add('answer--wrong');
        const mark = document.createElement('span');
        mark.className = 'answer__mark answer__mark--wrong';
        mark.textContent = '\u2717';
        b.appendChild(mark);
      }
    } else {
      b.classList.add('answer--dim');
    }
  });

  const feedback = document.getElementById('feedback');
  const feedbackText = document.getElementById('feedback-text');
  feedback.hidden = false;

  quizCard.classList.remove('flash-correct', 'flash-wrong', 'shake');
  void quizCard.offsetWidth; // restart animation

  if(isCorrect){
    state.correctCount++;
    feedback.classList.add('feedback--correct');
    feedbackText.textContent = 'ถูกต้อง! เยี่ยมมาก';
    quizCard.classList.add('flash-correct');
    showScoreFloat();
  } else {
    feedback.classList.add('feedback--wrong');
    feedbackText.textContent = 'ตอบผิด เสียหัวใจไป 1 ดวง';
    quizCard.classList.add('flash-wrong', 'shake');
    loseHeart();
  }

  advanceAfterAnswer();
}

function advanceAfterAnswer(){
  setTimeout(() => {
    if(state.lives <= 0){
      endQuest(false);
      return;
    }
    state.index++;
    if(state.index >= state.order.length){
      endQuest(true);
    } else {
      renderQuestion();
    }
  }, 1100);
}

function showScoreFloat(){
  const holder = document.querySelector('.hud__progress');
  const el = document.createElement('span');
  el.className = 'score-float';
  el.textContent = '+1';
  holder.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function launchConfetti(){
  const colors = ['#F0973B', '#3E8EDE', '#4FA97A', '#F5C24C', '#E2604F'];
  const wrap = document.querySelector('.badge-wrap');
  for(let i = 0; i < 18; i++){
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 200)}px`);
    piece.style.setProperty('--rot', `${Math.round(Math.random() * 360 + 180)}deg`);
    piece.style.left = `${45 + Math.random() * 10}%`;
    piece.style.animationDelay = `${(Math.random() * 0.3).toFixed(2)}s`;
    wrap.appendChild(piece);
    setTimeout(() => piece.remove(), 1800);
  }
}

function formatElapsed(ms){
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function endQuest(success){
  stopTimer();
  if(success){
    const elapsedMs = Date.now() - state.quizStartTime;
    document.getElementById('progress-fill').style.width = '100%';
    document.getElementById('complete-score').textContent = state.correctCount;
    document.getElementById('complete-total').textContent = state.order.length;
    document.getElementById('complete-time').textContent = formatElapsed(elapsedMs);
    renderHeartsInto('complete-hearts', state.lives);
    showScreen('complete');
    launchConfetti();
    submitResult(elapsedMs);
  } else {
    document.getElementById('over-score').textContent = state.correctCount;
    document.getElementById('over-total').textContent = state.order.length;
    renderHeartsInto('over-hearts', 0);
    showScreen('over');
  }
}

// ---- ส่งผลไปยัง Google Sheet (ถ้าตั้งค่า SHEET_ENDPOINT ไว้) ----
function submitResult(elapsedMs){
  const statusEl = document.getElementById('save-status');

  if(!CONFIG.SHEET_ENDPOINT){
    console.info('ยังไม่ได้ตั้งค่า SHEET_ENDPOINT — ผลนี้จะไม่ถูกส่งไปบันทึกที่ไหน (ดู README.md)');
    return;
  }

  statusEl.hidden = false;
  statusEl.className = 'save-status';
  statusEl.textContent = 'กำลังบันทึกผล...';

  const payload = {
    name: state.playerName,
    studentId: state.studentId,
    faculty: state.faculty,
    correctCount: state.correctCount,
    heartsRemaining: state.lives,
    elapsedMs: elapsedMs
  };

  // ใช้ mode: 'no-cors' เพราะ Google Apps Script Web App ไม่รองรับ CORS preflight ตามปกติ
  // ข้อจำกัด: อ่านผลลัพธ์ตอบกลับไม่ได้ (จึงยืนยัน "สำเร็จจริง" ฝั่ง client ไม่ได้ 100%)
  // ให้ยึดข้อมูลใน Google Sheet เป็นหลักในการตัดสินผู้ชนะ
  fetch(CONFIG.SHEET_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(() => {
    statusEl.textContent = 'บันทึกผลเรียบร้อย ✓';
    statusEl.classList.add('save-status--ok');
  }).catch(() => {
    statusEl.textContent = 'ส่งข้อมูลไม่สำเร็จ (เช็คอินเทอร์เน็ต) — ผลของคุณยังนับได้ กรุณาแจ้งเจ้าหน้าที่';
    statusEl.classList.add('save-status--error');
  });
}

document.getElementById('btn-retry').addEventListener('click', startQuest);
document.getElementById('btn-home').addEventListener('click', () => {
  stopTimer();
  document.getElementById('player-name').value = '';
  document.getElementById('player-id').value = '';
  document.getElementById('player-faculty').value = '';
  showScreen('start');
});

document.getElementById('btn-save').addEventListener('click', () => {
  const btn = document.getElementById('btn-save');
  const target = document.getElementById('screen-complete');

  function waitForHtml2Canvas(retriesLeft){
    if(typeof html2canvas !== 'undefined'){
      captureAndDownload();
      return;
    }
    if(retriesLeft <= 0){
      alert('ไม่สามารถโหลดตัวช่วยบันทึกภาพได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }
    setTimeout(() => waitForHtml2Canvas(retriesLeft - 1), 200);
  }

  function captureAndDownload(){
    html2canvas(target, {
      backgroundColor: '#EAF3FB',
      scale: 2,
      useCORS: true
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = 'library-quest-mission-complete.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(() => {
      alert('บันทึกภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }).finally(() => {
      btn.disabled = false;
      btn.textContent = originalLabel;
    });
  }

  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';
  waitForHtml2Canvas(15); // retry for up to ~3 seconds
});
