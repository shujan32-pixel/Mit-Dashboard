// ── SUPABASE ──────────────────────────────────────────────────────
const SUPABASE_URL = 'https://tgtvloytglyxaenpfsus.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRndHZsb3l0Z2x5eGFlbnBmc3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTY2ODMsImV4cCI6MjA4ODgzMjY4M30.NsgDjbwqRzKV-OG-L74ycljtforovq9qYLxOBPiqb9s';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { redirectTo: 'https://mit-dashboard.vercel.app' } });

// ── BOOT ──────────────────────────────────────────────────────────
let currentUserId = null;

window.addEventListener('load', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) startApp(session.user);
  else { document.getElementById('loading-screen').style.display = 'none'; document.getElementById('login-screen').style.display = 'flex'; }
});

sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) startApp(session.user);
  else if (event === 'SIGNED_OUT') { document.getElementById('app').style.display = 'none'; document.getElementById('login-screen').style.display = 'flex'; }
});

// ── AUTH ──────────────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn'), err = document.getElementById('login-error');
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Logger ind...';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { err.textContent = 'Forkert e-mail eller adgangskode.'; btn.disabled = false; btn.textContent = 'Log ind →'; }
}
async function doRegister() {
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const btn = document.getElementById('reg-btn'), err = document.getElementById('reg-error');
  err.textContent = ''; btn.disabled = true; btn.textContent = 'Opretter...';
  const { error } = await sb.auth.signUp({ email, password });
  if (error) { err.textContent = error.message; btn.disabled = false; btn.textContent = 'Opret konto →'; }
  else { err.style.color = 'var(--accent2)'; err.textContent = 'Tjek din e-mail og bekræft!'; btn.disabled = false; btn.textContent = 'Opret konto →'; }
}
async function doLogout() { stopTimer(); await sb.auth.signOut(); }
function showRegister() { document.getElementById('form-login').style.display = 'none'; document.getElementById('form-register').style.display = 'block'; }
function showLogin() { document.getElementById('form-register').style.display = 'none'; document.getElementById('form-login').style.display = 'block'; }
document.addEventListener('keydown', e => { if (e.key === 'Enter') { const r = document.getElementById('form-register').style.display !== 'none'; r ? doRegister() : doLogin(); } });

// ── START APP ─────────────────────────────────────────────────────
function startApp(user) {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const email = user.email || '';
  document.getElementById('greeting-name').textContent = 'Shujan';
  document.getElementById('sidebar-name').textContent = 'Shujan';
  document.getElementById('sidebar-email').textContent = email;
  document.getElementById('sidebar-avatar').textContent = 'S';
  const now = new Date();
  const days = ['Søndag','Mandag','Tirsdag','Onsdag','Torsdag','Fredag','Lørdag'];
  const months = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
  document.getElementById('greeting-date').textContent = `${days[now.getDay()]} · ${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()}`;
  document.getElementById('vaner-date').textContent = `${days[now.getDay()]} · ${now.getDate()}. ${months[now.getMonth()]}`;
  document.getElementById('budget-month').textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;
  document.getElementById('tx-month-label').textContent = months[now.getMonth()];
  const dateInput = document.getElementById('tx-date');
  if (dateInput) dateInput.value = now.toISOString().split('T')[0];
  currentUserId = user.id;
  loadSessions(); loadHabits(); loadBudget(); requestNotifications();
  // Start morgen-siden som velkomst
  setTimeout(initMorgenPage, 200);
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────
async function requestNotifications() { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); }
function sendNotification(title, body) { if (Notification.permission === 'granted') new Notification(title, { body }); }

// ── NAVIGATION ────────────────────────────────────────────────────
function showPage(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'budget') setTimeout(renderBudgetChart, 100);
  if (id === 'morgen') initMorgenPage();
  if (id === 'nyheder') initNews();
  if (id === 'noter') loadNotes();
  if (id === 'review') { reviewWeekOffset = 0; loadReview(); }
}

// ── TIMER ─────────────────────────────────────────────────────────
const MODES = { focus:{label:'FOKUSTID',mins:25,color:'#7c6dfa'}, short:{label:'KORT PAUSE',mins:5,color:'#4ade80'}, long:{label:'LANG PAUSE',mins:15,color:'#f97316'} };
const CIRC = 722.6;
let currentMode='focus', totalSec=25*60, remSec=25*60, timerInt=null, isRunning=false, timerSessions=[];
document.getElementById('ring').style.stroke = MODES.focus.color;

function setMode(mode, btn) {
  if (isRunning) return;
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  totalSec = MODES[mode].mins*60; remSec = totalSec;
  document.getElementById('ring').style.stroke = MODES[mode].color;
  document.getElementById('mode-label').textContent = MODES[mode].label;
  updateDisplay(); updateRing();
}
function updateDisplay() { const m=Math.floor(remSec/60),s=remSec%60; document.getElementById('timer-display').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); }
function updateRing() { document.getElementById('ring').style.strokeDashoffset = CIRC*(1-remSec/totalSec); }

function toggleTimer() {
  if (isRunning) { clearInterval(timerInt); isRunning=false; document.getElementById('play-btn').textContent='▶'; }
  else {
    isRunning=true; document.getElementById('play-btn').textContent='⏸';
    timerInt = setInterval(() => {
      remSec--; updateDisplay(); updateRing();
      if (remSec <= 0) {
        clearInterval(timerInt); isRunning=false; document.getElementById('play-btn').textContent='▶';
        if (currentMode==='focus') { logSession(MODES.focus.mins); setTimeout(()=>sendNotification('Fokus-session færdig! 🎉',`${MODES.focus.mins} min klaret — tag en pause.`),300); }
        else if (currentMode==='short') { setTimeout(()=>sendNotification('Pause slut ⏰','Klar til fokus?'),300); }
        else { setTimeout(()=>sendNotification('Lang pause slut ⏰','Du er klar!'),300); }
        remSec=totalSec; updateDisplay(); updateRing();
      }
    }, 1000);
  }
}
function resetTimer() { stopTimer(); remSec=totalSec; updateDisplay(); updateRing(); }
function stopTimer() { clearInterval(timerInt); isRunning=false; document.getElementById('play-btn').textContent='▶'; }
function skipTimer() {
  stopTimer();
  const elapsed = Math.round((totalSec-remSec)/60);
  if (currentMode==='focus' && elapsed>=1) { logSession(elapsed); setTimeout(()=>sendNotification('Fokus-session gemt! ✅',`${elapsed} min registreret.`),300); }
  remSec=totalSec; updateDisplay(); updateRing();
}

async function loadSessions() {
  if (!currentUserId) return;
  const today = new Date().toISOString().split('T')[0];
  const { data } = await sb.from('focus_sessions').select('*').eq('user_id',currentUserId).gte('created_at',today+'T00:00:00').order('created_at',{ascending:false});
  if (data) { timerSessions=data; renderSessions(); updateHomeStats(); }
}
async function logSession(minutes) {
  if (!currentUserId) return;
  const { data } = await sb.from('focus_sessions').insert({user_id:currentUserId,duration:minutes,mode:currentMode}).select().single();
  if (data) { timerSessions.unshift(data); renderSessions(); updateHomeStats(); }
}
function renderSessions() {
  const list=document.getElementById('session-list'), none=document.getElementById('no-sessions');
  list.innerHTML='';
  const focus=timerSessions.filter(s=>s.mode==='focus');
  none.style.display=focus.length===0?'block':'none';
  timerSessions.forEach(s => {
    const t=new Date(s.created_at), ts=t.getHours()+':'+String(t.getMinutes()).padStart(2,'0');
    const el=document.createElement('div'); el.className='session-item';
    el.innerHTML=`<span class="session-date">${ts}</span><span class="session-dur">${s.duration} min</span><span class="session-mode">${s.mode==='focus'?'Fokus':s.mode==='short'?'Kort pause':'Lang pause'}</span>`;
    list.appendChild(el);
  });
}

// ── VANER ─────────────────────────────────────────────────────────
let habits=[], habitLogs=[];

document.getElementById('habit-type').addEventListener('change', function() {
  document.getElementById('habit-unit-field').style.display = this.value==='amount'?'block':'none';
});

// ── NOTIFIKATIONER ────────────────────────────────────────────────
let dailyReminderTimeout = null;

async function enableNotifications() {
  if (!('Notification' in window)) { alert('Din browser understøtter ikke notifikationer.'); return; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    document.getElementById('notif-enable-btn').style.display = 'none';
    document.getElementById('notif-banner').classList.add('visible');
    scheduleDailyReminder();
    sendNotification('Påmindelser aktiveret! 🔔', 'Du får nu daglige påmindelser om dine vaner.');
  }
}

function setDailyReminder() {
  const t = document.getElementById('notif-time').value;
  document.getElementById('notif-time-label').textContent = t;
  localStorage.setItem('habitReminderTime', t);
  scheduleDailyReminder();
  sendNotification('Påmindelse gemt ✅', `Du får besked dagligt kl. ${t}`);
}

function scheduleDailyReminder() {
  if (Notification.permission !== 'granted') return;
  if (dailyReminderTimeout) clearTimeout(dailyReminderTimeout);
  const saved = localStorage.getItem('habitReminderTime') || '07:00';
  document.getElementById('notif-time').value = saved;
  document.getElementById('notif-time-label').textContent = saved;
  const [h, m] = saved.split(':').map(Number);
  const now = new Date();
  const next = new Date(); next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  dailyReminderTimeout = setTimeout(() => {
    const done = habits.filter(hb => habitLogs.some(l => l.habit_id===hb.id && l.log_date===new Date().toISOString().split('T')[0])).length;
    const total = habits.length;
    sendNotification(`God morgen! 🌱 Dine vaner venter`, `${done}/${total} vaner klaret i dag — besøg din have!`);
    scheduleDailyReminder(); // Planlæg næste dag
  }, ms);
}

function initNotifications() {
  if (Notification.permission === 'granted') {
    document.getElementById('notif-enable-btn').style.display = 'none';
    document.getElementById('notif-banner').classList.add('visible');
    scheduleDailyReminder();
  }
}

// ── HAVE / GARDEN ─────────────────────────────────────────────────
// Vækststadier baseret på streak
// 0 dage = frø, 1-2 = spire, 3-6 = plante, 7-13 = blomst, 14-29 = træ, 30+ = fuldt blomstrende træ
function getPlantStage(streak) {
  if (streak === 0) return 0; // frø
  if (streak <= 2)  return 1; // spire
  if (streak <= 6)  return 2; // plante
  if (streak <= 13) return 3; // blomst
  if (streak <= 29) return 4; // træ
  return 5;                   // fuldt blomstre
}

function getPlantSVG(streak, isDoneToday, habitName) {
  const stage = getPlantStage(streak);
  // Farve baseret på vanenavn (konsistent farve per vane)
  const colors = ['#4ade80','#60a5fa','#f97316','#a78bfa','#f472b6','#34d399','#fb923c'];
  const ci = habitName.split('').reduce((a,c) => a+c.charCodeAt(0), 0) % colors.length;
  const color = isDoneToday ? colors[ci] : '#2e2e38';
  const stemColor = isDoneToday ? '#16a34a' : '#1e1e24';

  const svgs = [
    // Frø
    `<svg width="40" height="50" viewBox="0 0 40 50" class="plant-svg">
      <ellipse cx="20" cy="40" rx="8" ry="5" fill="${stemColor}" opacity="0.5"/>
      <ellipse cx="20" cy="35" rx="6" ry="7" fill="${color}" opacity="${isDoneToday?'0.9':'0.3'}"/>
    </svg>`,
    // Spire
    `<svg width="40" height="60" viewBox="0 0 40 60" class="plant-svg">
      <rect x="18" y="30" width="4" height="20" rx="2" fill="${stemColor}"/>
      <ellipse cx="20" cy="28" rx="9" ry="11" fill="${color}" opacity="${isDoneToday?'0.9':'0.4'}"/>
      <ellipse cx="12" cy="36" rx="7" ry="5" fill="${color}" opacity="${isDoneToday?'0.7':'0.3'}" transform="rotate(-20 12 36)"/>
    </svg>`,
    // Plante
    `<svg width="50" height="70" viewBox="0 0 50 70" class="plant-svg">
      <rect x="22" y="35" width="5" height="28" rx="2" fill="${stemColor}"/>
      <ellipse cx="25" cy="30" rx="13" ry="15" fill="${color}" opacity="${isDoneToday?'0.85':'0.35'}"/>
      <ellipse cx="12" cy="40" rx="10" ry="7" fill="${color}" opacity="${isDoneToday?'0.7':'0.25'}" transform="rotate(-25 12 40)"/>
      <ellipse cx="38" cy="40" rx="10" ry="7" fill="${color}" opacity="${isDoneToday?'0.7':'0.25'}" transform="rotate(25 38 40)"/>
    </svg>`,
    // Blomst
    `<svg width="55" height="80" viewBox="0 0 55 80" class="plant-svg">
      <rect x="24" y="42" width="5" height="32" rx="2" fill="${stemColor}"/>
      <ellipse cx="20" cy="52" rx="10" ry="6" fill="${stemColor}" opacity="0.6" transform="rotate(-30 20 52)"/>
      <circle cx="27" cy="22" r="10" fill="${isDoneToday?'#fbbf24':'#2e2e38'}" opacity="${isDoneToday?'1':'0.4'}"/>
      ${[0,60,120,180,240,300].map(a => `<ellipse cx="${27+14*Math.cos(a*Math.PI/180)}" cy="${22+14*Math.sin(a*Math.PI/180)}" rx="7" ry="5" fill="${color}" opacity="${isDoneToday?'0.9':'0.3'}" transform="rotate(${a} ${27+14*Math.cos(a*Math.PI/180)} ${22+14*Math.sin(a*Math.PI/180)})"/>`).join('')}
    </svg>`,
    // Træ
    `<svg width="65" height="90" viewBox="0 0 65 90" class="plant-svg">
      <rect x="28" y="52" width="8" height="34" rx="3" fill="${stemColor}"/>
      <ellipse cx="32" cy="38" rx="22" ry="24" fill="${color}" opacity="${isDoneToday?'0.8':'0.3'}"/>
      <ellipse cx="18" cy="52" rx="15" ry="12" fill="${color}" opacity="${isDoneToday?'0.7':'0.25'}"/>
      <ellipse cx="46" cy="52" rx="15" ry="12" fill="${color}" opacity="${isDoneToday?'0.7':'0.25'}"/>
      <ellipse cx="32" cy="22" rx="14" ry="12" fill="${color}" opacity="${isDoneToday?'0.75':'0.2'}"/>
    </svg>`,
    // Fuldt blomstrende (30+ streak)
    `<svg width="70" height="95" viewBox="0 0 70 95" class="plant-svg">
      <rect x="30" y="55" width="10" height="36" rx="4" fill="${stemColor}"/>
      <ellipse cx="35" cy="38" rx="26" ry="28" fill="${color}" opacity="${isDoneToday?'0.85':'0.3'}"/>
      <ellipse cx="18" cy="54" rx="17" ry="13" fill="${color}" opacity="${isDoneToday?'0.75':'0.25'}"/>
      <ellipse cx="52" cy="54" rx="17" ry="13" fill="${color}" opacity="${isDoneToday?'0.75':'0.25'}"/>
      <ellipse cx="35" cy="18" rx="16" ry="14" fill="${color}" opacity="${isDoneToday?'0.8':'0.2'}"/>
      ${isDoneToday ? [0,45,90,135,180,225,270,315].map(a => `<circle cx="${35+30*Math.cos(a*Math.PI/180)}" cy="${38+30*Math.sin(a*Math.PI/180)}" r="3" fill="#fbbf24" opacity="0.8"/>`).join('') : ''}
    </svg>`
  ];
  return svgs[stage];
}

function renderGarden() {
  const bed = document.getElementById('garden-bed');
  const sub = document.getElementById('garden-sub');
  if (!bed) return;
  if (habits.length === 0) {
    bed.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:0.75rem;color:var(--muted);padding:2rem 0">Tilføj din første vane for at plante et frø 🌱</div>';
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  const doneCount = habits.filter(h => habitLogs.some(l => l.habit_id===h.id && l.log_date===today)).length;

  // Opdater sub-tekst
  const msgs = [
    'Fuldfør dine vaner for at få din have til at blomstre 🌱',
    `${doneCount}/${habits.length} vaner klaret i dag — din have vokser! 🌿`,
    `Fantastisk! Alle ${habits.length} vaner klaret! Din have blomstrer 🌸`
  ];
  sub.textContent = doneCount === 0 ? msgs[0] : doneCount === habits.length ? msgs[2] : msgs[1];

  bed.innerHTML = '';
  habits.forEach(h => {
    const streak = getStreak(h.id);
    const isDone = habitLogs.some(l => l.habit_id===h.id && l.log_date===today);
    const stage = getPlantStage(streak);
    const stageNames = ['Frø','Spire','Plante','Blomst','Træ','Blomstrende træ'];
    const slot = document.createElement('div');
    slot.className = 'plant-slot' + (stage >= 3 && isDone ? ' blooming' : '');
    slot.title = `${h.name} — ${stageNames[stage]} (${streak} dages streak)`;
    slot.innerHTML = `
      <div class="plant-visual">${getPlantSVG(streak, isDone, h.name)}</div>
      <div class="plant-name">${h.name}</div>
      <div class="plant-streak-badge">${streak > 0 ? '🔥'+streak : '—'}</div>
    `;
    bed.appendChild(slot);
  });

  // Sæson
  const month = new Date().getMonth();
  const seasons = ['Vinter','Vinter','Forår','Forår','Forår','Sommer','Sommer','Sommer','Efterår','Efterår','Efterår','Vinter'];
  document.getElementById('garden-season').textContent = seasons[month];
}

// ── GOOGLE KALENDER INTEGRATION ───────────────────────────────────
async function addHabitToCalendar(habitName, reminderTime, rrule) {
  const statusEl = document.getElementById('gcal-status');
  try {
    statusEl.style.color = 'var(--muted)';
    statusEl.textContent = '⏳ Opretter kalenderbegivenhed...';

    const [h, m] = (reminderTime || '07:00').split(':').map(Number);
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0);
    const endDate = new Date(startDate.getTime() + 15 * 60000);
    const startISO = startDate.toISOString().replace('.000Z', '+01:00').slice(0,19) + '+01:00';
    const endISO = endDate.toISOString().replace('.000Z', '+01:00').slice(0,19) + '+01:00';
    const usedRrule = rrule || 'RRULE:FREQ=DAILY';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        mcp_servers: [{ type: 'url', url: 'https://gcal.mcp.claude.com/mcp', name: 'gcal' }],
        messages: [{
          role: 'user',
          content: `Opret en tilbagevendende kalenderbegivenhed for vanen "${habitName}". Start: ${startISO}, Slut: ${endISO}. Gentagelsesregel: ${usedRrule}. Tilføj popup-påmindelse 5 minutter før. Beskrivelse: "Daglig vane fra Mit Dashboard 🌱". Svar KUN med "OK".`
        }]
      })
    });
    const data = await res.json();
    statusEl.style.color = 'var(--accent2)';
    statusEl.textContent = `✓ "${habitName}" tilføjet til kalender`;
  } catch(e) {
    statusEl.style.color = 'var(--muted)';
    statusEl.textContent = '⚠ Kalender ikke tilgængelig';
  }
}

// ── HABIT CRUD ────────────────────────────────────────────────────
async function loadHabits() {
  if (!currentUserId) return;
  const { data: hData } = await sb.from('habits').select('*').eq('user_id',currentUserId).order('created_at');
  if (hData) habits=hData;
  const weekStart=getWeekStart();
  const { data: lData } = await sb.from('habit_logs').select('*').eq('user_id',currentUserId).gte('log_date',weekStart);
  if (lData) habitLogs=lData;
  renderHabits(); renderWeekGrid(); renderGarden(); updateHomeStats();
  initNotifications();
}

function updateFreqUI() {
  const freq = document.getElementById('habit-freq').value;
  document.getElementById('freq-days-field').style.display  = freq === 'custom_days' ? 'block' : 'none';
  document.getElementById('freq-count-field').style.display = freq === 'x_per_week'  ? 'block' : 'none';
}

function isHabitActiveToday(habit) {
  const freq = habit.frequency || 'daily';
  const dayOfWeek = new Date().getDay(); // 0=søn, 1=man...
  if (freq === 'daily') return true;
  if (freq === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (freq === 'custom_days') {
    const days = JSON.parse(habit.freq_days || '[]');
    return days.includes(dayOfWeek);
  }
  if (freq === 'x_per_week') {
    // Vis altid — men check om vi allerede har nok logs denne uge
    const count = habit.freq_count || 5;
    const weekStart = getWeekStart();
    const logsThisWeek = habitLogs.filter(l => l.habit_id === habit.id && l.log_date >= weekStart).length;
    return logsThisWeek < count;
  }
  return true;
}

function getFreqLabel(habit) {
  const freq = habit.frequency || 'daily';
  if (freq === 'daily') return 'Hver dag';
  if (freq === 'weekdays') return 'Hverdage';
  if (freq === 'x_per_week') {
    const count = habit.freq_count || 5;
    const weekStart = getWeekStart();
    const done = habitLogs.filter(l => l.habit_id === habit.id && l.log_date >= weekStart).length;
    return `${done}/${count} denne uge`;
  }
  if (freq === 'custom_days') {
    const days = JSON.parse(habit.freq_days || '[]');
    const names = ['Søn','Man','Tir','Ons','Tor','Fre','Lør'];
    return days.map(d => names[d]).join(', ');
  }
  return '';
}

async function addHabit() {
  const name=document.getElementById('habit-name').value.trim();
  const type=document.getElementById('habit-type').value;
  const unit=document.getElementById('habit-unit').value.trim();
  const reminder=document.getElementById('habit-reminder').value || '07:00';
  const freq=document.getElementById('habit-freq').value;
  const err=document.getElementById('habit-error');
  if (!name) { err.textContent='Skriv et navn til vanen.'; return; }
  err.textContent='';

  // Byg frekvens-data
  let freqDays = null, freqCount = null;
  if (freq === 'custom_days') {
    const checked = [...document.querySelectorAll('#freq-days-field input:checked')].map(el => parseInt(el.value));
    if (checked.length === 0) { err.textContent='Vælg mindst én dag.'; return; }
    freqDays = JSON.stringify(checked);
  }
  if (freq === 'x_per_week') {
    freqCount = parseInt(document.getElementById('habit-freq-count').value) || 5;
  }

  // Byg RRULE til kalender
  const rruleMap = {
    daily: 'RRULE:FREQ=DAILY',
    weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    x_per_week: `RRULE:FREQ=WEEKLY;INTERVAL=1`,
    custom_days: null // bygges nedenfor
  };
  let rrule = rruleMap[freq];
  if (freq === 'custom_days' && freqDays) {
    const dayMap = {0:'SU',1:'MO',2:'TU',3:'WE',4:'TH',5:'FR',6:'SA'};
    const days = JSON.parse(freqDays).map(d => dayMap[d]).join(',');
    rrule = `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
  }

  const { data } = await sb.from('habits').insert({
    user_id:currentUserId, name, type,
    unit: type==='amount' ? unit : null,
    frequency: freq,
    freq_days: freqDays,
    freq_count: freqCount
  }).select().single();

  if (data) {
    habits.push(data);
    document.getElementById('habit-name').value='';
    document.getElementById('habit-unit').value='';
    renderHabits(); renderWeekGrid(); renderGarden();
    addHabitToCalendar(name, reminder, rrule);
  }
}

async function toggleHabit(habitId, done, amtId) {
  const today=new Date().toISOString().split('T')[0];
  const existing=habitLogs.find(l=>l.habit_id===habitId&&l.log_date===today);
  if (existing) {
    await sb.from('habit_logs').delete().eq('id',existing.id);
    habitLogs=habitLogs.filter(l=>l.id!==existing.id);
  } else {
    const amt = amtId ? (parseFloat(document.getElementById(amtId)?.value)||1) : 1;
    const { data, error } = await sb.from('habit_logs').insert({
      user_id:currentUserId,
      habit_id:habitId,
      log_date:today,
      amount:amt
    }).select().single();
    if (data) {
      habitLogs.push(data);
      const streak = getStreak(habitId) + 1;
      if ([7, 14, 30, 60, 100].includes(streak)) {
        setTimeout(() => sendNotification(`🎉 ${streak} dages streak!`, `Din plante blomstrer! Hold det gående 🌸`), 300);
      }
    }
  }
  renderHabits(); renderWeekGrid(); renderGarden(); updateHomeStats();
}

async function deleteHabit(habitId) {
  await sb.from('habit_logs').delete().eq('habit_id',habitId);
  await sb.from('habits').delete().eq('id',habitId);
  habits=habits.filter(h=>h.id!==habitId);
  habitLogs=habitLogs.filter(l=>l.habit_id!==habitId);
  renderHabits(); renderWeekGrid(); renderGarden(); updateHomeStats();
}

function getStreak(habitId) {
  let streak=0, d=new Date(); d.setHours(0,0,0,0);
  while(true) {
    const ds=d.toISOString().split('T')[0];
    if (habitLogs.some(l=>l.habit_id===habitId&&l.log_date===ds)) { streak++; d.setDate(d.getDate()-1); } else break;
  }
  return streak;
}

function getWeekStart() {
  const d=new Date(); d.setHours(0,0,0,0);
  const day=d.getDay(), diff=day===0?-6:1-day;
  d.setDate(d.getDate()+diff);
  return d.toISOString().split('T')[0];
}

function getWeekDates() {
  const start=new Date(getWeekStart());
  return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(d.getDate()+i); return d.toISOString().split('T')[0]; });
}

function renderHabits() {
  const list=document.getElementById('habits-list');
  const today=new Date().toISOString().split('T')[0];
  if (habits.length===0) { list.innerHTML='<div class="no-data">Ingen vaner endnu — tilføj en!</div>'; return; }
  list.innerHTML='';
  habits.forEach(h => {
    const log=habitLogs.find(l=>l.habit_id===h.id&&l.log_date===today);
    const done=!!log, streak=getStreak(h.id);
    const activeToday=isHabitActiveToday(h);
    const stage=getPlantStage(streak);
    const stageNames=['🌰 Frø','🌱 Spire','🪴 Plante','🌸 Blomst','🌳 Træ','🌺 Blomstrende'];
    const freqLabel=getFreqLabel(h);
    const el=document.createElement('div');
    el.className='habit-card'+(done?' done':'')+(activeToday?'':' inactive-day');
    if (!activeToday) el.style.opacity='0.45';
    const amtId='amt-'+h.id;
    const metaHtml=`
      <span style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted)">${stageNames[stage]}</span>
      <span class="freq-badge">${freqLabel}</span>
      ${!activeToday ? '<span style="font-family:\'DM Mono\',monospace;font-size:0.62rem;color:var(--muted);margin-left:0.3rem">· fri dag</span>' : ''}
    `;
    if (h.type==='amount') {
      el.innerHTML=`
        <button class="habit-check ${done?'done':''}" onclick="toggleHabit('${h.id}',${done},'${amtId}')">${done?'✓':''}</button>
        <div class="habit-info"><div class="habit-name ${done?'done':''}">${h.name}</div><div class="habit-meta">${h.unit||'enheder'} ${metaHtml}</div></div>
        <input class="habit-amount-input" id="${amtId}" type="number" value="${log?log.amount:''}" placeholder="0" min="0">
        <span class="habit-streak">${streak>0?'🔥 '+streak:''}</span>
        <button class="habit-delete" onclick="deleteHabit('${h.id}')">✕</button>`;
    } else {
      el.innerHTML=`
        <button class="habit-check ${done?'done':''}" onclick="toggleHabit('${h.id}',${done},null)">${done?'✓':''}</button>
        <div class="habit-info"><div class="habit-name ${done?'done':''}">${h.name}</div><div class="habit-meta">${metaHtml}</div></div>
        <span class="habit-streak">${streak>0?'🔥 '+streak:''}</span>
        <button class="habit-delete" onclick="deleteHabit('${h.id}')">✕</button>`;
    }
    list.appendChild(el);
  });
}

function renderWeekGrid() {
  const rows=document.getElementById('week-grid-rows');
  const weekDates=getWeekDates();
  if (habits.length===0) { rows.innerHTML='<div class="no-data">Ingen vaner</div>'; return; }
  rows.innerHTML='';
  habits.forEach(h => {
    const row=document.createElement('div'); row.className='week-row';
    const lbl=document.createElement('div'); lbl.className='week-label'; lbl.textContent=h.name;
    const dots=document.createElement('div'); dots.className='week-dots';
    weekDates.forEach(d => {
      const done=habitLogs.some(l=>l.habit_id===h.id&&l.log_date===d);
      const dot=document.createElement('div'); dot.className='week-dot'+(done?' done':'');
      dot.textContent=done?'✓':'';
      dots.appendChild(dot);
    });
    row.appendChild(lbl); row.appendChild(dots); rows.appendChild(row);
  });
}


// ── BUDGET ────────────────────────────────────────────────────────
let transactions=[], fixedExpenses=[], budgetChartInst=null;

async function loadBudget() {
  if (!currentUserId) return;
  const now=new Date();
  const monthStart=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const { data: txData } = await sb.from('transactions').select('*').eq('user_id',currentUserId).gte('tx_date',monthStart).order('tx_date',{ascending:false});
  if (txData) transactions=txData;
  const { data: fixData } = await sb.from('fixed_expenses').select('*').eq('user_id',currentUserId).order('created_at');
  if (fixData) fixedExpenses=fixData;
  renderBudget(); updateHomeStats();
  loadGoals();
}

function renderBudget() {
  const income=transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const fixed=fixedExpenses.reduce((s,f)=>s+f.amount,0);
  const total=expense+fixed, balance=income-total;
  document.getElementById('budget-income').textContent=income.toLocaleString('da-DK')+' kr';
  document.getElementById('budget-expense').textContent=total.toLocaleString('da-DK')+' kr';
  const bEl=document.getElementById('budget-balance');
  bEl.textContent=balance.toLocaleString('da-DK')+' kr';
  bEl.style.color=balance>=0?'var(--accent2)':'var(--danger)';
  renderTxList(); renderFixedList(); renderCategoryBars(); updateHomeStats();
}

function renderTxList() {
  const list=document.getElementById('tx-list');
  if (transactions.length===0) { list.innerHTML='<div class="no-data">Ingen transaktioner endnu</div>'; return; }
  list.innerHTML='';
  transactions.forEach(t => {
    const el=document.createElement('div'); el.className='tx-item';
    el.innerHTML=`<div class="tx-dot ${t.type}"></div><div class="tx-info"><div class="tx-name">${t.name}</div><div class="tx-cat">${t.category} · ${t.tx_date}</div></div><span class="tx-amount ${t.type}">${t.type==='income'?'+':'-'}${t.amount.toLocaleString('da-DK')} kr</span><button class="tx-del" onclick="deleteTx('${t.id}')">✕</button>`;
    list.appendChild(el);
  });
}

function renderFixedList() {
  const list=document.getElementById('fixed-list');
  if (fixedExpenses.length===0) { list.innerHTML='<div class="no-data">Ingen faste udgifter endnu</div>'; return; }
  list.innerHTML='';
  fixedExpenses.forEach(f => {
    const el=document.createElement('div'); el.className='tx-item';
    el.innerHTML=`<div class="tx-dot fixed"></div><div class="tx-info"><div class="tx-name">${f.name}</div><div class="tx-cat">${f.category} · månedligt</div></div><span class="tx-amount fixed">${f.amount.toLocaleString('da-DK')} kr/md</span><button class="tx-del" onclick="deleteFixed('${f.id}')">✕</button>`;
    list.appendChild(el);
  });
}

function renderCategoryBars() {
  const container=document.getElementById('category-bars'), catMap={};
  transactions.filter(t=>t.type==='expense').forEach(t=>{ catMap[t.category]=(catMap[t.category]||0)+t.amount; });
  fixedExpenses.forEach(f=>{ catMap[f.category]=(catMap[f.category]||0)+f.amount; });
  const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  if (cats.length===0) { container.innerHTML='<div class="no-data">Ingen udgifter endnu</div>'; return; }
  const max=cats[0][1]; container.innerHTML='';
  cats.forEach(([cat,amt]) => {
    const pct=max>0?(amt/max*100):0;
    const div=document.createElement('div'); div.className='cat-bar';
    div.innerHTML=`<div class="cat-head"><span class="cat-name-lbl">${cat}</span><span class="cat-amt">${amt.toLocaleString('da-DK')} kr</span></div><div class="cat-track"><div class="cat-fill" style="width:${pct}%"></div></div>`;
    container.appendChild(div);
  });
}

function renderBudgetChart() {
  const ctx=document.getElementById('budget-chart'); if (!ctx) return;
  const monthNames=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  const now=new Date(); const labels=[], incD=[], expD=[];
  for (let i=5;i>=0;i--) {
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    labels.push(monthNames[d.getMonth()]);
    const ms=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    incD.push(transactions.filter(t=>t.type==='income'&&t.tx_date.startsWith(ms)).reduce((s,t)=>s+t.amount,0));
    expD.push(transactions.filter(t=>t.type==='expense'&&t.tx_date.startsWith(ms)).reduce((s,t)=>s+t.amount,0));
  }
  if (budgetChartInst) budgetChartInst.destroy();
  budgetChartInst=new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[
      {label:'Indtægter',data:incD,backgroundColor:'rgba(74,222,128,0.7)',borderRadius:4},
      {label:'Udgifter',data:expD,backgroundColor:'rgba(239,68,68,0.7)',borderRadius:4}
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#5a5a6e', font:{family:'DM Mono',size:11} } } },
      scales:{ x:{ ticks:{color:'#5a5a6e',font:{family:'DM Mono',size:10}}, grid:{color:'#222228'} }, y:{ ticks:{color:'#5a5a6e',font:{family:'DM Mono',size:10}}, grid:{color:'#222228'} } }
    }
  });
}

async function addTransaction() {
  const type=document.getElementById('tx-type').value;
  const amount=parseFloat(document.getElementById('tx-amount').value);
  const name=document.getElementById('tx-name').value.trim();
  const category=document.getElementById('tx-category').value;
  const date=document.getElementById('tx-date').value;
  const err=document.getElementById('tx-error');
  if (!name||!amount||!date) { err.textContent='Udfyld alle felter.'; return; }
  err.textContent='';
  const { data } = await sb.from('transactions').insert({user_id:currentUserId,type,amount,name,category,tx_date:date}).select().single();
  if (data) { transactions.unshift(data); document.getElementById('tx-amount').value=''; document.getElementById('tx-name').value=''; renderBudget(); renderBudgetChart(); }
}

async function addFixedExpense() {
  const name=document.getElementById('fixed-name').value.trim();
  const amount=parseFloat(document.getElementById('fixed-amount').value);
  const category=document.getElementById('fixed-category').value;
  const err=document.getElementById('fixed-error');
  if (!name||!amount) { err.textContent='Udfyld navn og beløb.'; return; }
  err.textContent='';
  const { data } = await sb.from('fixed_expenses').insert({user_id:currentUserId,name,amount,category}).select().single();
  if (data) { fixedExpenses.push(data); document.getElementById('fixed-name').value=''; document.getElementById('fixed-amount').value=''; renderBudget(); }
}

async function deleteTx(id) {
  await sb.from('transactions').delete().eq('id',id);
  transactions=transactions.filter(t=>t.id!==id);
  renderBudget(); renderBudgetChart();
}

async function deleteFixed(id) {
  await sb.from('fixed_expenses').delete().eq('id',id);
  fixedExpenses=fixedExpenses.filter(f=>f.id!==id);
  renderBudget();
}

// ── CSV IMPORT ────────────────────────────────────────────────────
const CAT_RULES = [
  { pattern: /netto|føtex|bilka|rema|aldi|lidl|irma|superbrugsen|meny|fakta|spar|kiwi|dagligvarer|mad|bager|bakery|restaurant|cafe|mcdonalds|burger|pizza|sushi|takeaway|delivery|wolt|just.eat/i, cat: 'Mad & drikke' },
  { pattern: /easypark|parking|parkering|dsb|rejsekort|taxa|uber|7-eleven|q8|shell|circle.k|tankstation|bil|benzin|biludlejning|avis|hertz/i, cat: 'Transport' },
  { pattern: /netflix|spotify|hbo|disney|viaplay|youtube|tv2|apple|google|adobe|dropbox|github|real.debrid|abonnement|subscription/i, cat: 'Abonnement' },
  { pattern: /læge|apotek|tandlæge|hospital|medicin|fitness|sport|træning|swim|løb/i, cat: 'Sundhed' },
  { pattern: /tøj|sko|zara|h&m|hm|jack|selected|pieces|vila|vero.moda|mango|weekday/i, cat: 'Tøj & sko' },
  { pattern: /bolig|husleje|el|varme|vand|internet|tdc|yousee|telenor|telia|norlys|forsikring|tryg|codan/i, cat: 'Bolig' },
  { pattern: /løn|salary|overførsel|betaling|ferie|feriepenge|skat|refusion/i, cat: 'Løn & overførsler' },
  { pattern: /bio|kino|bowlin|spillested|koncert|teater|museum|underholdning/i, cat: 'Underholdning' },
];

function guessCategory(description) {
  for (const rule of CAT_RULES) {
    if (rule.pattern.test(description)) return rule.cat;
  }
  return 'Andet';
}

function parseSparkassenCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const result = [];
  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 3) continue;
    const rawDate = parts[0].trim();   // dd-mm-yyyy
    const rawDesc = parts[1].trim();
    const rawAmt  = parts[2].trim().replace('.','').replace(',','.');
    const amount  = parseFloat(rawAmt);
    if (isNaN(amount)) continue;

    // Convert date from dd-mm-yyyy to yyyy-mm-dd
    const [d, m, y] = rawDate.split('-');
    if (!d || !m || !y) continue;
    const isoDate = `${y}-${m}-${d}`;

    const type = amount >= 0 ? 'income' : 'expense';
    const absAmount = Math.abs(amount);
    const category = type === 'income' ? guessIncomeCategory(rawDesc) : guessCategory(rawDesc);

    result.push({ date: isoDate, name: rawDesc, amount: absAmount, type, category, rawLine: line });
  }
  return result;
}

function guessIncomeCategory(desc) {
  if (/løn|salary/i.test(desc)) return 'Løn & overførsler';
  if (/ferie|feriepenge/i.test(desc)) return 'Løn & overførsler';
  if (/skat|refusion/i.test(desc)) return 'Løn & overførsler';
  return 'Løn & overførsler';
}

let csvParsed = [];

function handleCSVFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    // Try UTF-8 first, fallback handled by FileReader
    const text = e.target.result;
    csvParsed = parseSparkassenCSV(text);

    // Check for duplicates against existing transactions
    const existingKeys = new Set(transactions.map(t => `${t.tx_date}_${t.name}_${t.amount}`));
    const newOnly = csvParsed.filter(r => !existingKeys.has(`${r.date}_${r.name}_${r.amount}`));
    const skipped = csvParsed.length - newOnly.length;
    csvParsed = newOnly;

    document.getElementById('csv-count').textContent = `${csvParsed.length} nye transaktioner fundet`;
    document.getElementById('csv-skip-info').textContent = skipped > 0 ? `(${skipped} allerede importeret)` : '';
    renderCSVPreview();
    document.getElementById('csv-preview').style.display = 'block';
  };
  reader.readAsText(file, 'windows-1252');
}

function renderCSVPreview() {
  const list = document.getElementById('csv-preview-list');
  list.innerHTML = '';
  if (csvParsed.length === 0) {
    list.innerHTML = '<div class="no-data">Ingen nye transaktioner at importere</div>';
    document.getElementById('csv-import-btn').disabled = true;
    return;
  }
  csvParsed.forEach((tx, i) => {
    const el = document.createElement('div');
    el.className = 'tx-item';
    el.style.alignItems = 'center';
    el.innerHTML = `
      <div class="tx-dot ${tx.type}"></div>
      <div class="tx-info">
        <div class="tx-name" style="font-size:0.78rem">${tx.name}</div>
        <div class="tx-cat">${tx.date}</div>
      </div>
      <select onchange="csvParsed[${i}].category=this.value" style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'DM Mono',monospace;font-size:0.65rem;padding:0.2rem 0.4rem;margin-right:0.5rem">
        ${['Mad & drikke','Transport','Bolig','Abonnement','Underholdning','Tøj & sko','Sundhed','Løn & overførsler','Andet'].map(c =>
          `<option ${c===tx.category?'selected':''}>${c}</option>`
        ).join('')}
      </select>
      <span class="tx-amount ${tx.type}" style="min-width:80px;text-align:right">${tx.type==='income'?'+':'−'}${tx.amount.toLocaleString('da-DK')} kr</span>
    `;
    list.appendChild(el);
  });
}

async function importCSV() {
  const btn = document.getElementById('csv-import-btn');
  const err = document.getElementById('csv-error');
  if (csvParsed.length === 0) return;
  btn.disabled = true; btn.textContent = 'Importerer...';
  err.textContent = '';

  const rows = csvParsed.map(tx => ({
    user_id: currentUserId,
    type: tx.type,
    amount: tx.amount,
    name: tx.name,
    category: tx.category,
    tx_date: tx.date
  }));

  const { data, error } = await sb.from('transactions').insert(rows).select();
  if (error) {
    err.textContent = 'Fejl ved import: ' + error.message;
    btn.disabled = false; btn.textContent = 'Importer alle →';
    return;
  }

  transactions = [...data, ...transactions];
  csvParsed = [];
  renderBudget(); renderBudgetChart();
  btn.textContent = '✓ Importeret!';
  setTimeout(() => {
    document.getElementById('csv-preview').style.display = 'none';
    document.getElementById('csv-file-input').value = '';
    btn.disabled = false; btn.textContent = 'Importer alle →';
  }, 2000);
}

// ── GOALS ─────────────────────────────────────────────────────────
let goals = [];

async function loadGoals() {
  const { data } = await sb.from('goals').select('*').eq('user_id', currentUserId).order('priority');
  if (data) { goals = data; renderGoals(); renderSplit(); }
}

async function addGoal() {
  const name     = document.getElementById('goal-name').value.trim();
  const emoji    = document.getElementById('goal-emoji').value;
  const target   = parseFloat(document.getElementById('goal-target').value);
  const saved    = parseFloat(document.getElementById('goal-saved').value) || 0;
  const monthly  = parseFloat(document.getElementById('goal-monthly').value) || 0;
  const priority = parseInt(document.getElementById('goal-priority').value);
  const err      = document.getElementById('goal-error');
  if (!name || !target) { err.textContent = 'Udfyld navn og målbeløb.'; return; }
  err.textContent = '';
  const { data } = await sb.from('goals').insert({ user_id:currentUserId, name, emoji, target_amount:target, saved_amount:saved, monthly_saving:monthly, priority }).select().single();
  if (data) {
    goals.push(data);
    goals.sort((a,b) => a.priority - b.priority);
    document.getElementById('goal-name').value = '';
    document.getElementById('goal-target').value = '';
    document.getElementById('goal-saved').value = '0';
    document.getElementById('goal-monthly').value = '';
    renderGoals(); renderSplit();
  }
}

async function deleteGoal(id) {
  await sb.from('goals').delete().eq('id', id);
  goals = goals.filter(g => g.id !== id);
  renderGoals(); renderSplit();
}

function renderGoals() {
  const list = document.getElementById('goals-list');
  if (goals.length === 0) { list.innerHTML = '<div class="no-data">Ingen mål endnu — tilføj dit første mål!</div>'; return; }
  const PRIORITY = ['','⭐ Primær','★ Sekundær','☆ Lavere prioritet'];
  list.innerHTML = '';
  goals.forEach(g => {
    const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
    const remaining = g.target_amount - g.saved_amount;
    const months = g.monthly_saving > 0 ? Math.ceil(remaining / g.monthly_saving) : null;
    const eta = months ? etaText(months) : 'Ingen månedlig opsparing sat';
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.innerHTML = `
      <div class="goal-header">
        <span class="goal-emoji">${g.emoji}</span>
        <div style="flex:1">
          <div class="goal-title">${g.name}</div>
          <div class="goal-priority">${PRIORITY[g.priority] || ''}</div>
        </div>
        <button class="goal-del" onclick="deleteGoal('${g.id}')">✕</button>
      </div>
      <div class="goal-progress-track"><div class="goal-progress-fill" style="width:${pct}%;background:${pct>=100?'var(--accent2)':'var(--accent)'}"></div></div>
      <div class="goal-stats">
        <div>
          <div class="goal-pct" style="color:${pct>=100?'var(--accent2)':'var(--accent)'}">${pct}%</div>
          <div class="goal-amounts">${g.saved_amount.toLocaleString('da-DK')} / ${g.target_amount.toLocaleString('da-DK')} kr</div>
        </div>
        <div class="goal-eta">
          <div style="color:var(--text);font-weight:700">${months ? eta : '—'}</div>
          <div>${months ? 'til målet er nået' : eta}</div>
          ${g.monthly_saving > 0 ? `<div style="margin-top:2px">${g.monthly_saving.toLocaleString('da-DK')} kr/md sat af</div>` : ''}
        </div>
      </div>`;
    list.appendChild(card);
  });
}

function etaText(months) {
  if (months <= 0) return 'Mål nået! 🎉';
  if (months < 12) return `${months} måned${months>1?'er':''}`;
  const y = Math.floor(months/12), m = months%12;
  return `${y} år${m>0?' '+m+' md':''}`;
}

// ── SPLIT / FORDELING ─────────────────────────────────────────────
function renderSplit() {
  const salary    = parseFloat(document.getElementById('split-salary')?.value) || 0;
  const freelance = parseFloat(document.getElementById('split-freelance')?.value) || 0;
  const total     = salary + freelance;
  const res       = document.getElementById('split-result');
  const goalsDiv  = document.getElementById('split-goals');
  if (!res) return;
  if (total === 0) { res.innerHTML = '<div class="no-data">Indtast din indkomst ovenfor</div>'; return; }

  const fixed     = fixedExpenses.reduce((s,f) => s+f.amount, 0);
  const needs     = Math.round(total * 0.50);
  const lifestyle = Math.round(total * 0.30);
  const savings   = Math.round(total * 0.20);
  const freeAfterFixed = Math.max(0, total - fixed);
  const actualSavings  = Math.max(0, freeAfterFixed - lifestyle);

  res.innerHTML = `
    <div class="split-row"><div><div class="split-label">💳 Nødvendige udgifter</div><div class="split-sub">Husleje, mad, transport, regninger</div></div><div class="split-amount">${needs.toLocaleString('da-DK')} kr</div></div>
    <div class="split-row"><div><div class="split-label">🎉 Livsstil & fornøjelser</div><div class="split-sub">Shopping, underholdning, spisning ude</div></div><div class="split-amount">${lifestyle.toLocaleString('da-DK')} kr</div></div>
    <div class="split-row"><div><div class="split-label">💰 Opsparing & mål</div><div class="split-sub">Fordeles på dine mål nedenfor</div></div><div class="split-amount">${savings.toLocaleString('da-DK')} kr</div></div>
    <div class="split-row" style="margin-top:0.5rem;padding-top:1rem;border-top:2px solid var(--border2)"><div><div class="split-label">📊 Faste udgifter i alt</div><div class="split-sub">Baseret på dine registrerede faste udgifter</div></div><div class="split-amount ${fixed>needs?'warn':''}">${fixed.toLocaleString('da-DK')} kr</div></div>
    <div class="split-row"><div><div class="split-label">✅ Til rådighed efter faste</div><div class="split-sub">Hvad du faktisk har at gøre godt med</div></div><div class="split-amount">${freeAfterFixed.toLocaleString('da-DK')} kr</div></div>
  `;

  if (!goalsDiv) return;
  if (goals.length === 0) { goalsDiv.innerHTML = '<div class="no-data">Tilføj mål under 🎯 Mål-fanen</div>'; return; }
  const totalPriority = goals.reduce((s,g) => s + (4 - g.priority), 0);
  goalsDiv.innerHTML = '';
  goals.forEach(g => {
    const weight  = (4 - g.priority) / totalPriority;
    const alloc   = Math.round(savings * weight);
    const rem     = Math.max(0, g.target_amount - g.saved_amount);
    const months  = alloc > 0 ? Math.ceil(rem / alloc) : null;
    const row     = document.createElement('div');
    row.className = 'split-row';
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;flex:1">
        <span style="font-size:1.2rem">${g.emoji}</span>
        <div><div class="split-label">${g.name}</div><div class="split-sub">${months ? etaText(months)+' til målet' : 'Sæt månedlig opsparing'}</div></div>
      </div>
      <div class="split-amount">${alloc.toLocaleString('da-DK')} kr/md</div>`;
    goalsDiv.appendChild(row);
  });
}

// ── ØKONOMICOACH ──────────────────────────────────────────────────
async function runCoach(type) {
  const panel    = document.getElementById('coach-response-panel');
  const loading  = document.getElementById('coach-loading');
  const response = document.getElementById('coach-response');
  panel.style.display  = 'block';
  loading.style.display = 'block';
  response.textContent  = '';

  const salary    = document.getElementById('split-salary')?.value || '?';
  const freelance = document.getElementById('split-freelance')?.value || '0';
  const totalIncome = (parseFloat(salary)||0) + (parseFloat(freelance)||0);
  const totalExp  = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const totalInc  = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const fixedTotal= fixedExpenses.reduce((s,f)=>s+f.amount,0);

  const catMap = {};
  transactions.filter(t=>t.type==='expense').forEach(t => { catMap[t.category] = (catMap[t.category]||0)+t.amount; });

  const goalsSummary = goals.map(g =>
    `${g.emoji} ${g.name}: mål ${g.target_amount.toLocaleString('da-DK')} kr, opsparet ${g.saved_amount.toLocaleString('da-DK')} kr, månedlig opsparing ${g.monthly_saving.toLocaleString('da-DK')} kr`
  ).join('\n');

  const catSummary = Object.entries(catMap).map(([c,a]) => `${c}: ${a.toLocaleString('da-DK')} kr`).join(', ');

  const context = `
Brugerens økonomi:
- Månedlig indkomst (løn): ${salary} kr
- Variabel indkomst (freelance): ${freelance} kr
- Total registreret indkomst: ${totalInc.toLocaleString('da-DK')} kr
- Total registrerede udgifter: ${totalExp.toLocaleString('da-DK')} kr
- Faste månedlige udgifter: ${fixedTotal.toLocaleString('da-DK')} kr
- Udgifter per kategori: ${catSummary || 'ingen data endnu'}
- Sparemål:
${goalsSummary || 'ingen mål sat endnu'}
  `.trim();

  const prompts = {
    analyse: `Du er en venlig dansk økonomicoach. Analysér denne persons økonomi og giv en klar, konkret oversigt med styrker og forbedringsmuligheder. Brug dansk og vær specifik med tal.\n\n${context}`,
    spare:   `Du er en venlig dansk økonomicoach. Kig på udgiftskategorierne og giv 3-5 konkrete, realistiske sparetips baseret på de faktiske udgifter. Vær specifik og brug tallene.\n\n${context}`,
    maal:    `Du er en venlig dansk økonomicoach. Beregn hvornår denne person realistisk når hvert af sine mål baseret på nuværende opsparing og indkomst. Giv konkrete tidsperspektiver og råd til at nå dem hurtigere.\n\n${context}`,
    fordel:  `Du er en venlig dansk økonomicoach. Lav en konkret månedlig budget-plan der viser præcis hvordan denne person bør fordele sin indkomst for at nå sine mål hurtigst muligt. Brug 50/30/20-reglen som udgangspunkt men tilpas til personens situation.\n\n${context}`,
    custom:  `Du er en venlig dansk økonomicoach. Svar på dette spørgsmål baseret på personens økonomidata:\n\nSpørgsmål: ${document.getElementById('coach-custom').value}\n\n${context}`
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompts[type] }]
      })
    });
    const data = await res.json();
    loading.style.display = 'none';
    response.textContent = data.content?.[0]?.text || 'Kunne ikke hente svar — prøv igen.';
  } catch(e) {
    loading.style.display = 'none';
    response.textContent = 'Fejl: ' + e.message;
  }
}

// ── ENGANGSBELØB ──────────────────────────────────────────────────
function renderLumpSplit() {
  const amount   = parseFloat(document.getElementById('lump-amount')?.value) || 0;
  const strategy = document.getElementById('lump-strategy')?.value || 'prioritet';
  const type     = document.getElementById('lump-type')?.value || 'bonus';
  const res      = document.getElementById('lump-result');
  const askBtn   = document.getElementById('lump-ask-coach');
  if (!res) return;

  if (amount <= 0) {
    res.innerHTML = '<div class="no-data">Indtast et beløb til venstre</div>';
    if (askBtn) askBtn.style.display = 'none';
    return;
  }

  if (goals.length === 0) {
    res.innerHTML = '<div class="no-data">Tilføj mål under 🎯 Mål-fanen for at få en fordeling</div>';
    if (askBtn) askBtn.style.display = 'none';
    return;
  }

  // Filtrer mål der ikke er nået endnu
  const activeGoals = goals.filter(g => g.saved_amount < g.target_amount);
  if (activeGoals.length === 0) {
    res.innerHTML = '<div class="no-data" style="color:var(--accent2)">🎉 Alle dine mål er nået!</div>';
    return;
  }

  let allocations = [];

  if (strategy === 'prioritet') {
    const totalWeight = activeGoals.reduce((s, g) => s + (4 - g.priority), 0);
    allocations = activeGoals.map(g => ({
      goal: g,
      amount: Math.round(amount * ((4 - g.priority) / totalWeight))
    }));

  } else if (strategy === 'lige') {
    const each = Math.round(amount / activeGoals.length);
    allocations = activeGoals.map(g => ({ goal: g, amount: each }));

  } else if (strategy === 'hast') {
    // Find det mål der er tættest på at være nået
    const sorted = [...activeGoals].sort((a, b) => {
      const remA = a.target_amount - a.saved_amount;
      const remB = b.target_amount - b.saved_amount;
      return remA - remB;
    });
    const nearest = sorted[0];
    const needed = nearest.target_amount - nearest.saved_amount;
    const toNearest = Math.min(amount, needed);
    const leftover = amount - toNearest;
    allocations = [{ goal: nearest, amount: toNearest }];
    if (leftover > 0 && sorted.length > 1) {
      const rest = sorted.slice(1);
      const eachRest = Math.round(leftover / rest.length);
      rest.forEach(g => allocations.push({ goal: g, amount: eachRest }));
    }

  } else if (strategy === 'noedfond') {
    const noedfond = activeGoals.find(g => g.emoji === '🛡️' || g.name.toLowerCase().includes('nød'));
    if (noedfond) {
      const needed = noedfond.target_amount - noedfond.saved_amount;
      const toFond = Math.min(amount, needed);
      const leftover = amount - toFond;
      allocations = [{ goal: noedfond, amount: toFond }];
      const rest = activeGoals.filter(g => g.id !== noedfond.id);
      if (leftover > 0 && rest.length > 0) {
        const totalWeight = rest.reduce((s, g) => s + (4 - g.priority), 0);
        rest.forEach(g => allocations.push({
          goal: g,
          amount: Math.round(leftover * ((4 - g.priority) / totalWeight))
        }));
      }
    } else {
      // Ingen nødfond fundet — brug prioritet
      const totalWeight = activeGoals.reduce((s, g) => s + (4 - g.priority), 0);
      allocations = activeGoals.map(g => ({
        goal: g,
        amount: Math.round(amount * ((4 - g.priority) / totalWeight))
      }));
    }
  }

  // Cap allokering ved resterende beløb til hvert mål
  allocations = allocations.map(a => ({
    ...a,
    amount: Math.min(a.amount, Math.round(a.goal.target_amount - a.goal.saved_amount)),
    capped: a.amount > (a.goal.target_amount - a.goal.saved_amount)
  }));

  const totalAllocated = allocations.reduce((s, a) => s + a.amount, 0);
  const leftover = amount - totalAllocated;

  const typeLabels = { bonus:'bonus', ferie:'feriepenge', freelance:'freelance-betaling', gave:'gave/arv', salg:'salg', andet:'beløb' };

  res.innerHTML = `
    <p style="font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--muted);margin-bottom:1.25rem;line-height:1.6">
      Sådan anbefaler jeg du fordeler din <strong style="color:var(--text)">${typeLabels[type] || 'betaling'}</strong> på <strong style="color:var(--accent)">${amount.toLocaleString('da-DK')} kr</strong>:
    </p>
    ${allocations.map(a => {
      const newPct = Math.min(100, Math.round(((a.goal.saved_amount + a.amount) / a.goal.target_amount) * 100));
      const rem = a.goal.target_amount - a.goal.saved_amount - a.amount;
      return `
        <div class="split-row">
          <div style="display:flex;align-items:center;gap:0.6rem;flex:1">
            <span style="font-size:1.1rem">${a.goal.emoji}</span>
            <div>
              <div class="split-label">${a.goal.name}</div>
              <div class="split-sub">
                ${newPct >= 100 ? '🎉 Mål nået med dette beløb!' : `Op til ${newPct}% · ${rem > 0 ? rem.toLocaleString('da-DK')+' kr tilbage' : 'færdig!'}`}
              </div>
            </div>
          </div>
          <div class="split-amount">${a.amount.toLocaleString('da-DK')} kr</div>
        </div>`;
    }).join('')}
    ${leftover > 0 ? `
      <div class="split-row" style="border-top:2px solid var(--border2);margin-top:0.5rem;padding-top:1rem">
        <div><div class="split-label">💸 Til overs</div><div class="split-sub">Alle mål dækket — sæt resten i fri opsparing</div></div>
        <div class="split-amount" style="color:var(--accent3)">${leftover.toLocaleString('da-DK')} kr</div>
      </div>` : ''}
    <div style="margin-top:1.25rem;padding:0.75rem 1rem;background:var(--surface2);border-radius:6px;font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--muted);display:flex;justify-content:space-between">
      <span>Total fordelt</span>
      <strong style="color:var(--text)">${Math.min(amount, totalAllocated).toLocaleString('da-DK')} / ${amount.toLocaleString('da-DK')} kr</strong>
    </div>
  `;

  if (askBtn) askBtn.style.display = 'block';
}

function lumpAskCoach() {
  const amount   = document.getElementById('lump-amount')?.value || '?';
  const type     = document.getElementById('lump-type')?.value || 'bonus';
  const typeLabels = { bonus:'bonus', ferie:'feriepenge', freelance:'freelance-betaling', gave:'gave/arv', salg:'salg', andet:'engangsbeløb' };
  document.getElementById('coach-custom').value =
    `Jeg har fået ${parseFloat(amount).toLocaleString('da-DK')} kr i ${typeLabels[type] || 'engangsbeløb'}. Hvordan fordeler jeg dem bedst på mine mål, og hvad giver mest mening at prioritere?`;
  setBudgetTab('coach', document.querySelector('[onclick*="coach"]'));
  setTimeout(() => runCoach('custom'), 200);
}


function setBudgetTab(tab, btn) {
  ['oversigt','maal','fordeling','coach','transaktioner','faste','tilfoej','import'].forEach(t => {
    const el = document.getElementById('btab-'+t);
    if (el) el.style.display = t===tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'oversigt') setTimeout(renderBudgetChart, 100);
  if (tab === 'fordeling') setTimeout(renderSplit, 50);
}

// ── GOD MORGEN ────────────────────────────────────────────────────
const QUOTES = [
  'Små skridt hver dag bygger store resultater.',
  'Konsistens slår motivation hver gang.',
  'Du behøver ikke være perfekt — du skal bare starte.',
  'Vaner er renten på selvforbedring.',
  'Det, du gør i dag, er investering i din fremtid.',
  'Fremskridt, ikke perfektion.',
  'Én god dag bygger på den næste.',
  'Disciplin er at vælge, hvad du vil have på lang sigt over, hvad du vil have nu.',
  'Din have vokser én dag ad gangen.',
  'Den bedste tid at starte var i går. Den næste bedste er nu.',
];

let morgenClockInterval = null;

function initMorgenPage() {
  updateMorgenClock();
  if (morgenClockInterval) clearInterval(morgenClockInterval);
  morgenClockInterval = setInterval(updateMorgenClock, 1000);
  updateMorgenGreeting();
  updateMorgenHabits();
  updateMorgenStats();
  updateMorgenBalance();
  loadMorgenIntention();
  refreshMorgenCalendar();
  renderMorgenTodos();
  loadWeather();

  // Tilfældig quote, skifter dagligt
  const qi = new Date().getDate() % QUOTES.length;
  document.getElementById('morgen-quote').textContent = '"' + QUOTES[qi] + '"';
}

function updateMorgenClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const clockEl = document.getElementById('morgen-clock');
  const ampmEl  = document.getElementById('morgen-ampm');
  if (clockEl) clockEl.textContent = `${h}:${m}`;
  if (ampmEl)  ampmEl.textContent  = now.getHours() < 12 ? 'AM' : 'PM';
}

function updateMorgenGreeting() {
  const now = new Date();
  const h = now.getHours();
  let hilsen;
  if      (h >= 5  && h < 10) hilsen = 'God morgen,';
  else if (h >= 10 && h < 12) hilsen = 'Godmorgen,';
  else if (h >= 12 && h < 14) hilsen = 'God middag,';
  else if (h >= 14 && h < 18) hilsen = 'God eftermiddag,';
  else if (h >= 18 && h < 22) hilsen = 'God aften,';
  else                          hilsen = 'God nat,';

  const dage    = ['søndag','mandag','tirsdag','onsdag','torsdag','fredag','lørdag'];
  const måneder = ['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
  const datoStr = `${dage[now.getDay()]} d. ${now.getDate()}. ${måneder[now.getMonth()]} ${now.getFullYear()}`;

  const grEl = document.getElementById('morgen-greeting');
  const dtEl = document.getElementById('morgen-date');
  if (grEl) grEl.textContent = hilsen;
  if (dtEl) dtEl.textContent = datoStr;
}

function updateMorgenHabits() {
  const today = new Date().toISOString().split('T')[0];
  const activeToday = habits.filter(h => isHabitActiveToday(h));
  const doneToday  = activeToday.filter(h => habitLogs.some(l => l.habit_id === h.id && l.log_date === today));
  const total = activeToday.length;
  const done  = doneToday.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  const pctEl = document.getElementById('morgen-habit-pct');
  const barEl = document.getElementById('morgen-habit-bar');
  const listEl = document.getElementById('morgen-habits-list');
  if (pctEl) pctEl.textContent = `${done} / ${total}`;
  if (barEl) barEl.style.width = pct + '%';

  if (!listEl) return;
  if (activeToday.length === 0) {
    listEl.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:var(--muted)">Ingen vaner i dag</div>';
    return;
  }
  listEl.innerHTML = '';
  activeToday.forEach(h => {
    const isDone = habitLogs.some(l => l.habit_id === h.id && l.log_date === today);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--border)';
    row.innerHTML = `
      <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${isDone ? 'var(--accent2)' : 'var(--border2)'};background:${isDone ? 'var(--accent2)' : 'none'};display:flex;align-items:center;justify-content:center;font-size:0.75rem;flex-shrink:0;color:#000">${isDone ? '✓' : ''}</div>
      <span style="font-size:0.85rem;font-weight:600;${isDone ? 'text-decoration:line-through;color:var(--muted)' : ''}">${h.name}</span>
      ${isDone ? '' : `<button onclick="quickCheckHabit('${h.id}')" style="margin-left:auto;background:rgba(74,222,128,0.1);border:1px solid var(--accent2);border-radius:4px;color:var(--accent2);cursor:pointer;font-family:'DM Mono',monospace;font-size:0.65rem;padding:0.2rem 0.5rem">Klaret ✓</button>`}
    `;
    listEl.appendChild(row);
  });
}

async function quickCheckHabit(habitId) {
  const today = new Date().toISOString().split('T')[0];
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;
  const already = habitLogs.find(l => l.habit_id === habitId && l.log_date === today);
  if (already) return;
  const { data } = await sb.from('habit_logs').insert({ user_id: currentUserId, habit_id: habitId, log_date: today, amount: 1 }).select().single();
  if (data) {
    habitLogs.push(data);
    updateMorgenHabits();
    updateMorgenStats();
    renderHabits();
    updateHomeStats();
  }
}

function updateMorgenStats() {
  const focusSessions = timerSessions.filter(s => s.mode === 'focus').length;
  const focusMins     = timerSessions.filter(s => s.mode === 'focus').reduce((sum, s) => sum + (s.duration || 0), 0);
  const sEl = document.getElementById('morgen-sessions');
  const mEl = document.getElementById('morgen-focus-mins');
  if (sEl) sEl.textContent = focusSessions;
  if (mEl) mEl.textContent = focusMins;
}

function updateMorgenBalance() {
  const inc = transactions.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const exp = transactions.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  const fix = fixedExpenses.reduce((s,f) => s+f.amount, 0);
  const bal = inc - exp - fix;
  const bEl   = document.getElementById('morgen-balance');
  const subEl = document.getElementById('morgen-balance-sub');
  if (bEl) {
    bEl.textContent = bal.toLocaleString('da-DK') + ' kr';
    bEl.style.color = bal >= 0 ? 'var(--accent2)' : 'var(--danger)';
  }
  if (subEl) subEl.textContent = bal >= 0 ? 'Du er i plus denne måned 👍' : 'Du er i minus denne måned';
}

async function refreshMorgenCalendar() {
  const listEl = document.getElementById('morgen-calendar-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:var(--muted)">Henter kalender...</div>';
  try {
    const now   = new Date();
    const today = now.toISOString().split('T')[0];
    const end   = today + 'T23:59:59';
    const start = today + 'T00:00:00';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        mcp_servers: [{ type: 'url', url: 'https://gcal.mcp.claude.com/mcp', name: 'gcal' }],
        messages: [{
          role: 'user',
          content: `Hent kalenderbegivenheder for i dag (${today}) fra primær kalender. TimeMin: ${start}, TimeMax: ${end}, timeZone: Europe/Copenhagen. Svar KUN med JSON-array (ingen markdown, ingen forklaring), format: [{"summary":"navn","start":"HH:MM","end":"HH:MM","allDay":false}]. Hvis ingen begivenheder, svar med [].`
        }]
      })
    });
    const data = await res.json();
    const raw = data.content?.find(c => c.type === 'text')?.text || '[]';
    const clean = raw.replace(/```json|```/g, '').trim();
    let events = [];
    try { events = JSON.parse(clean); } catch(e) { events = []; }

    if (!Array.isArray(events) || events.length === 0) {
      listEl.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:var(--muted);padding:0.5rem 0">Ingen begivenheder i dag 🎉</div>';
      return;
    }
    listEl.innerHTML = '';
    events.forEach(ev => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--border)';
      const timeStr = ev.allDay ? 'Heldagsbegivenhed' : `${ev.start || ''}${ev.end ? '–' + ev.end : ''}`;
      row.innerHTML = `
        <div style="width:3px;height:36px;background:var(--accent);border-radius:2px;flex-shrink:0"></div>
        <div>
          <div style="font-size:0.85rem;font-weight:600">${ev.summary || 'Unavngivet'}</div>
          <div style="font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--muted)">${timeStr}</div>
        </div>`;
      listEl.appendChild(row);
    });
  } catch(e) {
    listEl.innerHTML = '<div style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:var(--muted)">Kunne ikke hente kalender</div>';
  }
}

function saveMorgenIntention() {
  const val = document.getElementById('morgen-intention')?.value || '';
  const today = new Date().toISOString().split('T')[0];
  try { localStorage.setItem('morgen-intention-' + today, val); } catch(e) {}
}

function loadMorgenIntention() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const saved = localStorage.getItem('morgen-intention-' + today) || '';
    const el = document.getElementById('morgen-intention');
    if (el) el.value = saved;
  } catch(e) {}
}


function updateHomeStats() {
  document.getElementById('stat-sessions').textContent=timerSessions.filter(s=>s.mode==='focus').length;
  const today=new Date().toISOString().split('T')[0];
  const done=habits.filter(h=>habitLogs.some(l=>l.habit_id===h.id&&l.log_date===today)).length;
  document.getElementById('stat-habits').textContent=done;
  document.getElementById('stat-habits-total').textContent=habits.length;
  const inc=transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp=transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const fix=fixedExpenses.reduce((s,f)=>s+f.amount,0);
  const bal=inc-exp-fix;
  const balEl=document.getElementById('stat-balance');
  balEl.textContent=bal.toLocaleString('da-DK');
  balEl.style.color=bal>=0?'var(--accent2)':'var(--danger)';
}
// ── NYHEDER ───────────────────────────────────────────────────────
// RSS feeds via rss2json.com — ingen API-nøgle nødvendig
const NEWS_FEEDS = {
  breaking:   {
    feeds: ['https://www.dr.dk/nyheder/service/feeds/allenyheder', 'https://feeds.tv2.dk/nyheder/rss'],
    label: 'Breaking nyheder', emoji: '🔴'
  },
  technology: {
    feeds: ['https://techcrunch.com/feed/', 'https://www.theverge.com/rss/index.xml'],
    label: 'Teknologi', emoji: '💻'
  },
  denmark:    {
    feeds: ['https://www.dr.dk/nyheder/service/feeds/politik', 'https://www.dr.dk/nyheder/service/feeds/indland'],
    label: 'Danmark', emoji: '🇩🇰'
  },
  business:   {
    feeds: ['https://www.dr.dk/nyheder/service/feeds/penge', 'https://feeds.tv2.dk/nyheder/rss'],
    label: 'Erhverv', emoji: '📈'
  },
  biler:      {
    feeds: ['https://www.autoblog.com/rss.xml', 'https://www.caranddriver.com/rss/all.xml/'],
    label: 'Biler', emoji: '🚗'
  },
  hacks:      {
    feeds: ['https://lifehacker.com/rss', 'https://www.makeuseof.com/feed/'],
    label: 'Daily Hacks', emoji: '💡'
  }
};

let currentNewsTopic = 'breaking';
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

function initNews() {
  // Skjul API-nøgle panel — behøves ikke længere
  const missingEl = document.getElementById('news-api-missing');
  const contentEl = document.getElementById('news-content');
  if (missingEl) missingEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
  fetchNews(currentNewsTopic);
}

function setNewsTopic(topic, btn) {
  currentNewsTopic = topic;
  document.querySelectorAll('#news-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  fetchNews(topic);
}

function refreshNews() { fetchNews(currentNewsTopic); }

async function fetchNews(topic) {
  const grid    = document.getElementById('news-grid');
  const loading = document.getElementById('news-loading');
  const empty   = document.getElementById('news-empty');
  const updated = document.getElementById('news-updated');
  if (!grid) return;

  grid.style.display    = 'none';
  empty.style.display   = 'none';
  loading.style.display = 'block';

  const { feeds } = NEWS_FEEDS[topic] || NEWS_FEEDS.breaking;

  try {
    // Hent begge feeds parallelt
    const results = await Promise.allSettled(
      feeds.map(rss => fetch(RSS2JSON + encodeURIComponent(rss)).then(r => r.json()))
    );

    // Saml artikler fra alle feeds der lykkedes
    let articles = [];
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value.items) {
        articles = articles.concat(r.value.items);
      }
    });

    loading.style.display = 'none';

    if (articles.length === 0) {
      empty.style.display   = 'block';
      empty.textContent     = 'Ingen nyheder fundet — prøv igen om lidt';
      return;
    }

    // Sortér efter dato, nyeste først, max 9
    articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    articles = articles.slice(0, 9);

    grid.style.display = 'grid';
    grid.innerHTML = '';

    articles.forEach((article, i) => {
      const card = document.createElement('a');
      card.className = 'news-card';
      card.href      = article.link;
      card.target    = '_blank';
      card.rel       = 'noopener noreferrer';

      const timeAgo    = getTimeAgo(article.pubDate);
      const isBreaking = topic === 'breaking' && i < 2;

      // Prøv thumbnail fra feed, ellers placeholder
      const img = article.thumbnail || article.enclosure?.link || '';
      const imgHtml = img
        ? `<img class="news-img" src="${img}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          + `<div class="news-img-placeholder" style="display:none">📰</div>`
        : `<div class="news-img-placeholder">📰</div>`;

      // Rens beskrivelse for HTML-tags
      const desc = (article.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 160);

      card.innerHTML = `
        ${imgHtml}
        <div class="news-body">
          ${isBreaking ? '<span class="news-breaking-badge">Breaking</span>' : ''}
          <div class="news-source">${article.author || new URL(article.link).hostname.replace('www.','')}</div>
          <div class="news-title">${article.title}</div>
          <div class="news-desc">${desc}</div>
          <div class="news-footer">
            <span class="news-time">${timeAgo}</span>
            <span class="news-link">Læs mere →</span>
          </div>
        </div>`;

      grid.appendChild(card);
    });

    const now = new Date();
    if (updated) updated.textContent = `Opdateret ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

  } catch(e) {
    loading.style.display = 'none';
    empty.style.display   = 'block';
    empty.textContent     = 'Kunne ikke hente nyheder — tjek din internetforbindelse';
  }
}

function getTimeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 1)  return 'Lige nu';
  if (diff < 60) return `${diff} min siden`;
  const h = Math.floor(diff / 60);
  if (h < 24)    return `${h} time${h > 1 ? 'r' : ''} siden`;
  const d = Math.floor(h / 24);
  return `${d} dag${d > 1 ? 'e' : ''} siden`;
}

// ── NOTER ─────────────────────────────────────────────────────────
let notes = [];
let currentNoteId = null;
let notesFilter = 'all';
let noteSaveTimeout = null;

async function loadNotes() {
  if (!currentUserId) return;
  const { data } = await sb.from('notes').select('*').eq('user_id', currentUserId).order('updated_at', { ascending: false });
  if (data) { notes = data; renderNotesList(); }
}

function setNotesFilter(filter, btn) {
  notesFilter = filter;
  document.querySelectorAll('.notes-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNotesList();
}

function filterNotes() { renderNotesList(); }

function renderNotesList() {
  const list    = document.getElementById('notes-list');
  const search  = (document.getElementById('notes-search')?.value || '').toLowerCase();
  if (!list) return;

  let filtered = notes.filter(n => {
    if (notesFilter !== 'all' && n.type !== notesFilter) return false;
    if (search && !n.title.toLowerCase().includes(search) && !(n.body||'').toLowerCase().includes(search)) return false;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="no-data">Ingen noter fundet</div>';
    return;
  }

  list.innerHTML = '';
  filtered.forEach(n => {
    const el = document.createElement('div');
    el.className = `note-item ${n.color !== 'default' ? 'color-' + n.color : ''} ${n.id === currentNoteId ? 'active' : ''}`;
    const preview = n.type === 'todo'
      ? (JSON.parse(n.body || '[]').map(i => (i.done ? '✓ ' : '○ ') + i.text).join(' · ').slice(0, 60) || 'Tom to-do liste')
      : (n.body || '').slice(0, 60) || 'Tom note';
    const date = new Date(n.updated_at).toLocaleDateString('da-DK', { day:'numeric', month:'short' });
    el.innerHTML = `
      <div class="note-item-title">${n.title || 'Unavngivet'}</div>
      <div class="note-item-preview">${preview}</div>
      <div class="note-item-meta">
        <span class="note-item-date">${date}</span>
        <span class="note-item-type">${n.type === 'todo' ? '☑ to-do' : '📝 note'}</span>
      </div>`;
    el.onclick = () => openNote(n.id);
    list.appendChild(el);
  });
}

function openNote(id) {
  currentNoteId = id;
  const n = notes.find(n => n.id === id);
  if (!n) return;

  document.getElementById('note-empty-state').style.display = 'none';
  document.getElementById('note-edit-area').style.display   = 'flex';
  document.getElementById('note-title-input').value         = n.title || '';
  document.getElementById('note-color-select').value        = n.color || 'default';

  if (n.type === 'todo') {
    document.getElementById('note-content-area').style.display = 'none';
    document.getElementById('todo-content-area').style.display = 'block';
    renderTodoItems(JSON.parse(n.body || '[]'));
  } else {
    document.getElementById('note-content-area').style.display = 'block';
    document.getElementById('todo-content-area').style.display = 'none';
    document.getElementById('note-body-input').value = n.body || '';
  }

  document.getElementById('note-saved-status').textContent = 'Sidst gemt: ' + new Date(n.updated_at).toLocaleTimeString('da-DK', { hour:'2-digit', minute:'2-digit' });
  renderNotesList();

  // Auto-gem ved tastning
  document.getElementById('note-title-input').oninput = () => scheduleSave();
  document.getElementById('note-body-input').oninput  = () => scheduleSave();
}

function scheduleSave() {
  clearTimeout(noteSaveTimeout);
  noteSaveTimeout = setTimeout(saveCurrentNote, 1200);
  document.getElementById('note-saved-status').textContent = 'Gemmer...';
}

async function newNote() {
  const { data } = await sb.from('notes').insert({ user_id: currentUserId, type: 'note', title: 'Ny note', body: '', color: 'default' }).select().single();
  if (data) { notes.unshift(data); renderNotesList(); openNote(data.id); }
}

async function newTodo() {
  const { data } = await sb.from('notes').insert({ user_id: currentUserId, type: 'todo', title: 'Ny to-do liste', body: '[]', color: 'default' }).select().single();
  if (data) { notes.unshift(data); renderNotesList(); openNote(data.id); }
}

async function deleteCurrentNote() {
  if (!currentNoteId) return;
  if (!confirm('Slet denne note?')) return;
  await sb.from('notes').delete().eq('id', currentNoteId);
  notes = notes.filter(n => n.id !== currentNoteId);
  currentNoteId = null;
  document.getElementById('note-empty-state').style.display = 'flex';
  document.getElementById('note-edit-area').style.display   = 'none';
  renderNotesList();
}

function updateNoteColor() { scheduleSave(); }

// ── TODO ITEMS ─────────────────────────────────────────────────────
function renderTodoItems(items) {
  const list = document.getElementById('todo-items-list');
  list.innerHTML = '';
  items.forEach((item) => {
    list.appendChild(buildTodoEl(item));
  });
}

function buildTodoEl(item = {}) {
  const el = document.createElement('div');
  el.className = 'todo-item';
  el.dataset.calEventId = item.calEventId || '';
  const hasCalEvent = !!item.calEventId;
  el.innerHTML = `
    <button class="todo-check ${item.done ? 'done' : ''}" onclick="toggleTodoItem(this)">${item.done ? '✓' : ''}</button>
    <input class="todo-text ${item.done ? 'done' : ''}" value="${(item.text||'').replace(/"/g,'&quot;')}" oninput="scheduleSave()" onkeydown="if(event.key==='Enter'){document.getElementById('todo-new-item').focus()}">
    <button class="todo-cal-btn ${hasCalEvent ? 'active' : ''}" title="${hasCalEvent ? 'Begivenhed oprettet ✓' : 'Send til kalender'}" onclick="toggleTodoCalendar(this)">
      ${hasCalEvent ? '📅✓' : '📅'}
    </button>
    <button class="todo-del" onclick="removeTodoItem(this)">✕</button>
    <div class="todo-cal-picker" style="display:none">
      <input type="date" class="todo-cal-date" value="${item.calDate || getTodayStr()}">
      <input type="time" class="todo-cal-time" value="${item.calTime || '09:00'}">
      <button class="todo-cal-confirm action-btn" style="padding:0.3rem 0.7rem;font-size:0.72rem" onclick="sendTodoToCalendar(this)">
        ${hasCalEvent ? 'Opdatér' : 'Opret begivenhed →'}
      </button>
      ${hasCalEvent ? `<button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.72rem;font-family:'DM Mono',monospace" onclick="removeTodoCalEvent(this)">Fjern fra kalender</button>` : ''}
    </div>`;
  return el;
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function toggleTodoItem(btn) {
  btn.classList.toggle('done');
  btn.textContent = btn.classList.contains('done') ? '✓' : '';
  btn.nextElementSibling.classList.toggle('done', btn.classList.contains('done'));
  scheduleSave();
}

function removeTodoItem(btn) {
  btn.parentElement.remove();
  scheduleSave();
}

function toggleTodoCalendar(btn) {
  const picker = btn.parentElement.querySelector('.todo-cal-picker');
  const isOpen = picker.style.display === 'block';
  // Luk alle andre pickere
  document.querySelectorAll('.todo-cal-picker').forEach(p => p.style.display = 'none');
  picker.style.display = isOpen ? 'none' : 'block';
}

async function sendTodoToCalendar(btn) {
  const item    = btn.closest('.todo-item');
  const text    = item.querySelector('.todo-text').value.trim();
  const date    = item.querySelector('.todo-cal-date').value;
  const time    = item.querySelector('.todo-cal-time').value;
  if (!text || !date || !time) return;

  btn.textContent = '⏳ Opretter...';
  btn.disabled    = true;

  const [h, m]    = time.split(':').map(Number);
  const startISO  = `${date}T${time}:00`;
  const endH      = String(h + 1).padStart(2, '0');
  const endISO    = `${date}T${endH}:${String(m).padStart(2,'0')}:00`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        mcp_servers: [{ type: 'url', url: 'https://gcal.mcp.claude.com/mcp', name: 'gcal' }],
        messages: [{
          role: 'user',
          content: `Opret en kalenderbegivenhed med titel "☑ ${text}". Start: ${startISO}+01:00, Slut: ${endISO}+01:00, tidszone: Europe/Copenhagen. Tilføj popup-påmindelse 30 minutter før og e-mail påmindelse 60 minutter før. Beskrivelse: "To-do fra Mit Dashboard". Svar KUN med begivenhedens ID i formatet: EVENT_ID:xxxxxxx`
        }]
      })
    });
    const data  = await res.json();
    const reply = data.content?.find(c => c.type === 'text')?.text || '';
    const match = reply.match(/EVENT_ID:(\S+)/);
    const eventId = match ? match[1] : 'ok';

    // Gem event ID på elementet
    item.dataset.calEventId = eventId;
    const calBtn = item.querySelector('.todo-cal-btn');
    calBtn.textContent = '📅✓';
    calBtn.classList.add('active');
    calBtn.title = 'Begivenhed oprettet ✓';

    // Opdatér confirm knap og tilføj fjern-knap
    btn.textContent = 'Opdatér';
    btn.disabled    = false;
    const picker    = item.querySelector('.todo-cal-picker');
    if (!picker.querySelector('.todo-cal-remove')) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'todo-cal-remove';
      removeBtn.style.cssText = "background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.72rem;font-family:'DM Mono',monospace";
      removeBtn.textContent = 'Fjern fra kalender';
      removeBtn.onclick = function() { removeTodoCalEvent(this); };
      picker.appendChild(removeBtn);
    }

    scheduleSave();
  } catch(e) {
    btn.textContent = 'Fejl — prøv igen';
    btn.disabled    = false;
  }
}

async function removeTodoCalEvent(btn) {
  const item    = btn.closest('.todo-item');
  const eventId = item.dataset.calEventId;
  if (!eventId || eventId === 'ok') {
    item.dataset.calEventId = '';
    resetTodoCalBtn(item);
    scheduleSave();
    return;
  }
  btn.textContent = '⏳ Fjerner...';
  try {
    await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        mcp_servers: [{ type: 'url', url: 'https://gcal.mcp.claude.com/mcp', name: 'gcal' }],
        messages: [{ role: 'user', content: `Slet kalenderbegivenhed med ID: ${eventId}. Svar kun med "OK".` }]
      })
    });
  } catch(e) {}
  item.dataset.calEventId = '';
  resetTodoCalBtn(item);
  scheduleSave();
}

function resetTodoCalBtn(item) {
  const calBtn    = item.querySelector('.todo-cal-btn');
  calBtn.textContent = '📅';
  calBtn.classList.remove('active');
  calBtn.title    = 'Send til kalender';
  const picker    = item.querySelector('.todo-cal-picker');
  const confirmBtn = picker.querySelector('.todo-cal-confirm');
  if (confirmBtn) confirmBtn.textContent = 'Opret begivenhed →';
  const removeBtn = picker.querySelector('.todo-cal-remove');
  if (removeBtn) removeBtn.remove();
  picker.style.display = 'none';
}

function addTodoItem() {
  const input = document.getElementById('todo-new-item');
  const text  = input.value.trim();
  if (!text) return;
  const list = document.getElementById('todo-items-list');
  list.appendChild(buildTodoEl({ text, done: false }));
  input.value = '';
  input.focus();
  scheduleSave();
}

async function saveCurrentNote() {
  if (!currentNoteId) return;
  const n = notes.find(n => n.id === currentNoteId);
  if (!n) return;
  const title = document.getElementById('note-title-input').value;
  const color = document.getElementById('note-color-select').value;
  let body = n.body;
  if (n.type === 'note') {
    body = document.getElementById('note-body-input').value;
  } else {
    const items = [...document.querySelectorAll('.todo-item')].map(el => ({
      text:       el.querySelector('.todo-text').value,
      done:       el.querySelector('.todo-check').classList.contains('done'),
      calEventId: el.dataset.calEventId || '',
      calDate:    el.querySelector('.todo-cal-date')?.value || '',
      calTime:    el.querySelector('.todo-cal-time')?.value || '09:00',
    }));
    body = JSON.stringify(items);
  }
  const { data } = await sb.from('notes').update({ title, body, color, updated_at: new Date().toISOString() }).eq('id', currentNoteId).select().single();
  if (data) {
    const idx = notes.findIndex(n => n.id === currentNoteId);
    if (idx !== -1) notes[idx] = data;
    notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    document.getElementById('note-saved-status').textContent = 'Gemt ' + new Date().toLocaleTimeString('da-DK', { hour:'2-digit', minute:'2-digit' });
    renderNotesList();
  }
}

// ── MORGEN TO-DOS ──────────────────────────────────────────────────
async function renderMorgenTodos() {
  const el = document.getElementById('morgen-todo-list');
  if (!el) return;

  // Brug allerede indlæste noter hvis muligt, ellers hent fra Supabase
  let todoNotes = notes.filter(n => n.type === 'todo');
  if (todoNotes.length === 0 && currentUserId) {
    const { data } = await sb.from('notes').select('*').eq('user_id', currentUserId).eq('type', 'todo').order('updated_at', { ascending: false });
    if (data) todoNotes = data;
  }

  if (todoNotes.length === 0) {
    el.innerHTML = '<div class="mg-empty">Ingen to-do lister endnu — <span style="color:var(--accent);cursor:pointer" onclick="showPage(\'noter\',document.querySelectorAll(\'.nav-item\')[5])">opret en →</span></div>';
    return;
  }

  // Saml ALLE items på tværs af alle to-do lister
  let allItems = [];
  todoNotes.forEach(note => {
    const items = JSON.parse(note.body || '[]');
    items.forEach(item => allItems.push({ ...item, noteTitle: note.title, noteId: note.id }));
  });

  const pending = allItems.filter(i => !i.done);
  const done    = allItems.filter(i => i.done);

  if (allItems.length === 0) {
    el.innerHTML = '<div class="mg-empty">Ingen punkter i dine to-do lister</div>';
    return;
  }

  el.innerHTML = '';

  // Viser maks 8 pending + antal done som summary
  const toShow = pending.slice(0, 8);
  toShow.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.35rem 0;border-bottom:1px solid var(--border)';
    row.innerHTML = `
      <button onclick="toggleMorgenTodo(this,'${item.noteId}','${(item.text||'').replace(/'/g,"\\'")}',false)" style="width:18px;height:18px;border-radius:4px;border:2px solid var(--border2);background:none;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.65rem;transition:all 0.15s"></button>
      <span style="font-family:'DM Mono',monospace;font-size:0.8rem;flex:1">${item.text}</span>
      <span style="font-family:'DM Mono',monospace;font-size:0.62rem;color:var(--muted)">${item.noteTitle}</span>`;
    el.appendChild(row);
  });

  if (pending.length > 8) {
    const more = document.createElement('div');
    more.style.cssText = "font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--muted);padding:0.4rem 0;cursor:pointer";
    more.textContent = `+ ${pending.length - 8} flere punkter`;
    more.onclick = () => showPage('noter', document.querySelectorAll('.nav-item')[5]);
    el.appendChild(more);
  }

  if (done.length > 0) {
    const summary = document.createElement('div');
    summary.style.cssText = "font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--accent2);padding:0.4rem 0;margin-top:0.2rem";
    summary.textContent = `✓ ${done.length} punkt${done.length !== 1 ? 'er' : ''} klaret`;
    el.appendChild(summary);
  }
}

async function toggleMorgenTodo(btn, noteId, text, currentDone) {
  // Sæt visuelt done med det samme
  btn.style.background = 'var(--accent2)';
  btn.style.borderColor = 'var(--accent2)';
  btn.textContent = '✓';
  btn.nextElementSibling.style.textDecoration = 'line-through';
  btn.nextElementSibling.style.color = 'var(--muted)';

  // Opdatér i notes array og Supabase
  const note = notes.find(n => n.id === noteId);
  let items = [];
  if (note) {
    items = JSON.parse(note.body || '[]');
  } else {
    const { data } = await sb.from('notes').select('body').eq('id', noteId).single();
    if (data) items = JSON.parse(data.body || '[]');
  }

  const idx = items.findIndex(i => i.text === text && !i.done);
  if (idx !== -1) items[idx].done = true;

  await sb.from('notes').update({ body: JSON.stringify(items), updated_at: new Date().toISOString() }).eq('id', noteId);
  if (note) note.body = JSON.stringify(items);

  // Opdatér tæller
  setTimeout(renderMorgenTodos, 400);
}

// ── VEJR (Open-Meteo, Hobro) ───────────────────────────────────────
const WEATHER_LAT  = 56.6437;
const WEATHER_LNG  = 9.7948;
let weatherCache   = null;
let weatherLastFetch = 0;

const WMO_CODES = {
  0:  ['☀️','Klart'],
  1:  ['🌤️','Mest klart'],  2: ['⛅','Delvist skyet'], 3: ['☁️','Overskyet'],
  45: ['🌫️','Tåget'],       48:['🌫️','Rimtåge'],
  51: ['🌦️','Let støvregn'],53:['🌦️','Støvregn'],     55:['🌧️','Kraftig støvregn'],
  61: ['🌧️','Let regn'],    63:['🌧️','Regn'],          65:['🌧️','Kraftig regn'],
  71: ['🌨️','Let sne'],     73:['🌨️','Sne'],           75:['❄️','Kraftig sne'],
  80: ['🌦️','Regnbyger'],   81:['🌧️','Kraftige byger'],82:['⛈️','Voldsomme byger'],
  95: ['⛈️','Tordenvejr'],  96:['⛈️','Torden + hagl'],99:['⛈️','Kraftig torden+hagl'],
};

function getWMO(code) {
  return WMO_CODES[code] || ['🌡️','Ukendt'];
}

async function loadWeather(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && weatherCache && (now - weatherLastFetch < 30 * 60 * 1000)) {
    renderWeather(weatherCache);
    return;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LNG}` +
      `&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,precipitation,cloudcover` +
      `&hourly=temperature_2m,weathercode,precipitation_probability` +
      `&wind_speed_unit=ms&timezone=Europe%2FCopenhagen&forecast_days=1`;

    const res  = await fetch(url);
    const data = await res.json();
    weatherCache    = data;
    weatherLastFetch = now;
    renderWeather(data);
  } catch(e) {
    const desc = document.getElementById('weather-desc');
    if (desc) desc.textContent = 'Kunne ikke hente vejr';
  }
}

function renderWeather(data) {
  const c = data.current;
  if (!c) return;

  const [icon, desc] = getWMO(c.weathercode);
  const temp    = Math.round(c.temperature_2m);
  const feels   = Math.round(c.apparent_temperature);
  const wind    = Math.round(c.windspeed_10m * 3.6); // m/s → km/t
  const precip  = c.precipitation.toFixed(1);
  const cloud   = c.cloudcover;

  // Hero badge
  const heroIcon = document.getElementById('weather-hero-icon');
  const heroTemp = document.getElementById('weather-hero-temp');
  if (heroIcon) heroIcon.textContent = icon;
  if (heroTemp) heroTemp.textContent = temp + '°';

  // Stor visning
  const iconBig = document.getElementById('weather-icon-big');
  const tempBig = document.getElementById('weather-temp-big');
  const descEl  = document.getElementById('weather-desc');
  if (iconBig) iconBig.textContent = icon;
  if (tempBig) tempBig.textContent = temp + '°C';
  if (descEl)  descEl.textContent  = desc;

  // Detaljer
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('weather-wind',   wind + ' km/t');
  set('weather-precip', precip + ' mm');
  set('weather-feels',  feels + '°C');
  set('weather-cloud',  cloud + '%');

  // Timeoversigt — næste 12 timer
  const forecastEl = document.getElementById('weather-forecast');
  if (!forecastEl || !data.hourly) return;

  forecastEl.innerHTML = '';
  const hours = data.hourly.time;
  const temps = data.hourly.temperature_2m;
  const codes = data.hourly.weathercode;
  const rains = data.hourly.precipitation_probability;
  const nowH  = new Date().getHours();

  let shown = 0;
  for (let i = 0; i < hours.length && shown < 12; i++) {
    const h = new Date(hours[i]).getHours();
    if (h < nowH) continue;
    const [ic] = getWMO(codes[i]);
    const col  = document.createElement('div');
    col.className = 'weather-hour';
    col.innerHTML = `
      <span class="weather-hour-time">${String(h).padStart(2,'0')}:00</span>
      <span class="weather-hour-icon">${ic}</span>
      <span class="weather-hour-temp">${Math.round(temps[i])}°</span>
      <span class="weather-hour-rain">${rains[i]}%</span>`;
    forecastEl.appendChild(col);
    shown++;
  }
}

// ── UGENTLIG REVIEW ───────────────────────────────────────────────
let reviewWeekOffset = 0; // 0 = indeværende uge, -1 = forrige uge osv.

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=søn, 1=man...
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function dateToISO(d) { return d.toISOString().split('T')[0]; }

function reviewChangeWeek(dir) {
  reviewWeekOffset += dir;
  const nextBtn = document.getElementById('review-next-btn');
  if (nextBtn) nextBtn.disabled = reviewWeekOffset >= 0;
  loadReview();
}

async function loadReview() {
  const { monday, sunday } = getWeekRange(reviewWeekOffset);
  const monStr = dateToISO(monday);
  const sunStr = dateToISO(sunday);

  // Uge-label
  const opts = { day:'numeric', month:'long' };
  const lbl = monday.toLocaleDateString('da-DK', opts) + ' – ' + sunday.toLocaleDateString('da-DK', opts);
  document.getElementById('review-week-label').textContent = 'Uge ' + getWeekNumber(monday) + ' · ' + lbl;

  // Spær næste-knap hvis indeværende uge
  const nextBtn = document.getElementById('review-next-btn');
  if (nextBtn) nextBtn.disabled = reviewWeekOffset >= 0;

  await Promise.all([
    renderReviewHabits(monStr, sunStr, monday),
    renderReviewFocus(monStr, sunStr, monday),
    renderReviewBudget(monStr, sunStr),
    renderReviewGoals(),
    renderReviewCalendar(monday, sunday),
    renderReviewTodos(),
  ]);

  computeReviewScore();
  document.getElementById('review-ai-btn').textContent = '✨ Analysér min uge';
  document.getElementById('review-ai-text').innerHTML = '<span style="color:var(--muted)">Tryk på knappen for at få en personlig AI-analyse af din uge →</span>';
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// ── VANER ──
let reviewHabitData = {};
async function renderReviewHabits(monStr, sunStr, monday) {
  const barsEl = document.getElementById('review-habits-bars');
  const daysEl = document.getElementById('review-habit-days');
  if (!barsEl || !daysEl) return;

  const days = ['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
  const today = dateToISO(new Date());

  // Lav dag-søjler
  daysEl.innerHTML = '';
  const dayDates = days.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return dateToISO(d);
  });

  // Brug allerede loadede logs
  const weekLogs = habitLogs.filter(l => l.log_date >= monStr && l.log_date <= sunStr);
  const activeHabits = habits.filter(h => isHabitActiveToday(h));

  // Per-dag completion
  const dayCompletions = dayDates.map(dateStr => {
    if (dateStr > today) return 'future';
    const activeOnDay = habits.filter(h => {
      if (h.frequency === 'daily') return true;
      if (h.frequency === 'weekdays') { const d = new Date(dateStr); return d.getDay() >= 1 && d.getDay() <= 5; }
      if (h.frequency === 'specific' && h.freq_days) return h.freq_days.includes(new Date(dateStr).getDay().toString());
      return true;
    });
    if (activeOnDay.length === 0) return 'none';
    const done = activeOnDay.filter(h => weekLogs.some(l => l.habit_id === h.id && l.log_date === dateStr)).length;
    const pct = done / activeOnDay.length;
    return pct >= 1 ? 'full' : pct > 0 ? 'part' : 'none';
  });

  days.forEach((name, i) => {
    const col = document.createElement('div');
    col.className = 'review-day-col';
    const status = dayCompletions[i];
    const dot = status === 'future' ? '·' : status === 'full' ? '✓' : status === 'part' ? '~' : '○';
    col.innerHTML = `<div class="review-day-name">${name}</div><div class="review-day-dot ${status}">${dot}</div>`;
    daysEl.appendChild(col);
  });

  // Per-vane bars
  barsEl.innerHTML = '';
  activeHabits.forEach(h => {
    const total = dayDates.filter(d => d <= today).length;
    const done  = weekLogs.filter(l => l.habit_id === h.id).length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    const color = pct >= 80 ? 'var(--accent2)' : pct >= 50 ? 'var(--accent3)' : 'var(--danger)';
    const row = document.createElement('div');
    row.className = 'review-habit-bar-row';
    row.innerHTML = `
      <div class="review-habit-bar-name" title="${h.name}">${h.name}</div>
      <div class="review-habit-bar-track"><div class="review-habit-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="review-habit-bar-pct">${done}/${total}</div>`;
    barsEl.appendChild(row);
  });

  // Gem til score
  const totalPossible = activeHabits.length * dayDates.filter(d => d <= today).length;
  const totalDone = weekLogs.length;
  reviewHabitData = { pct: totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0 };
  document.getElementById('rpil-vaner').textContent = reviewHabitData.pct + '%';
}

// ── FOKUS ──
let reviewFocusData = {};
async function renderReviewFocus(monStr, sunStr, monday) {
  const { data: sessions } = await sb.from('focus_sessions')
    .select('*').eq('user_id', currentUserId)
    .gte('created_at', monStr).lte('created_at', sunStr + 'T23:59:59');

  const sessionsArr = sessions || [];
  const totalMins   = sessionsArr.reduce((s, r) => s + (r.duration || 0), 0);
  const today       = dateToISO(new Date());
  const daysElapsed = Math.max(1, ['Man','Tir','Ons','Tor','Fre','Lør','Søn']
    .map((_, i) => { const d = new Date(monday); d.setDate(monday.getDate()+i); return dateToISO(d); })
    .filter(d => d <= today).length);

  document.getElementById('review-focus-sessions').textContent = sessionsArr.length;
  document.getElementById('review-focus-mins').textContent     = totalMins;
  document.getElementById('review-focus-avg').textContent      = Math.round(totalMins / daysElapsed);

  // Dag-søjler
  const daysEl  = document.getElementById('review-focus-days');
  const dayNames = ['Man','Tir','Ons','Tor','Fre','Lør','Søn'];
  daysEl.innerHTML = '';
  dayNames.forEach((name, i) => {
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    const ds = dateToISO(d);
    const mins = sessionsArr.filter(s => s.created_at.startsWith(ds)).reduce((a,s) => a+(s.duration||0), 0);
    const status = ds > today ? 'future' : mins >= 50 ? 'full' : mins > 0 ? 'part' : 'none';
    const label  = ds > today ? '·' : mins > 0 ? mins+'m' : '○';
    const col    = document.createElement('div');
    col.className = 'review-day-col';
    col.innerHTML = `<div class="review-day-name">${name}</div><div class="review-day-dot ${status}" style="font-size:0.55rem">${label}</div>`;
    daysEl.appendChild(col);
  });

  const msg = totalMins === 0 ? 'Ingen fokussessioner denne uge.' :
    totalMins >= 300 ? `Stærk uge! ${totalMins} min samlet fokustid 💪` :
    `${totalMins} min fokus — prøv at nå 300 min/uge`;
  document.getElementById('review-focus-msg').textContent = msg;

  reviewFocusData = { sessions: sessionsArr.length, mins: totalMins };
  const focusScore = Math.min(100, Math.round((totalMins / 300) * 100));
  document.getElementById('rpil-fokus').textContent = focusScore + '%';
}

// ── BUDGET ──
let reviewBudgetData = {};
async function renderReviewBudget(monStr, sunStr) {
  const { data: txs } = await sb.from('transactions')
    .select('*').eq('user_id', currentUserId)
    .gte('tx_date', monStr).lte('tx_date', sunStr);

  const arr     = txs || [];
  const income  = arr.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0);
  const expense = arr.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0);
  const net     = income - expense;

  document.getElementById('review-income').textContent  = income.toLocaleString('da-DK');
  document.getElementById('review-expense').textContent = expense.toLocaleString('da-DK');
  const netEl = document.getElementById('review-net');
  netEl.textContent = (net >= 0 ? '+' : '') + net.toLocaleString('da-DK');
  netEl.style.color = net >= 0 ? 'var(--accent2)' : 'var(--danger)';

  // Kategori-oversigt
  const cats = {};
  arr.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + Number(t.amount);
  });
  const catsEl = document.getElementById('review-budget-cats');
  catsEl.innerHTML = '';
  Object.entries(cats).sort((a,b) => b[1]-a[1]).slice(0,5).forEach(([cat, amt]) => {
    const pct = expense > 0 ? Math.round((amt/expense)*100) : 0;
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:0.3rem;font-family:"DM Mono",monospace;font-size:0.72rem;align-items:center';
    row.innerHTML = `<div>${cat}</div><div style="color:var(--muted)">${amt.toLocaleString('da-DK')} kr · ${pct}%</div>`;
    catsEl.appendChild(row);
  });
  if (arr.length === 0) catsEl.innerHTML = '<div class="mg-empty">Ingen transaktioner denne uge</div>';

  reviewBudgetData = { income, expense, net, txCount: arr.length };
  const budgetScore = net >= 0 ? 100 : Math.max(0, 100 + Math.round((net / Math.max(1, expense)) * 100));
  document.getElementById('rpil-budget').textContent = net >= 0 ? '✓' : '–';
}

// ── MÅL ──
async function renderReviewGoals() {
  const { data: goalsData } = await sb.from('goals').select('*').eq('user_id', currentUserId);
  const listEl = document.getElementById('review-goals-list');
  if (!listEl) return;
  const arr = goalsData || [];
  if (arr.length === 0) { listEl.innerHTML = '<div class="mg-empty">Ingen sparemål oprettet endnu</div>'; return; }
  listEl.innerHTML = '';
  arr.sort((a,b) => a.priority - b.priority).forEach(g => {
    const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
    const eta = g.monthly_saving > 0 ? Math.ceil((g.target_amount - g.saved_amount) / g.monthly_saving) : null;
    const row = document.createElement('div');
    row.className = 'review-goal-row';
    row.innerHTML = `
      <div class="review-goal-name">${g.emoji} ${g.name}</div>
      <div class="review-goal-track"><div class="review-goal-fill" style="width:${pct}%"></div></div>
      <div class="review-goal-meta">
        <span>${g.saved_amount.toLocaleString('da-DK')} / ${g.target_amount.toLocaleString('da-DK')} kr</span>
        <span>${pct}% ${eta ? '· ~'+eta+' mdr' : ''}</span>
      </div>`;
    listEl.appendChild(row);
  });
}

// ── KALENDER ──
async function renderReviewCalendar(monday, sunday) {
  const listEl = document.getElementById('review-calendar-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="mg-empty">Henter...</div>';

  const monStr = monday.toISOString().split('T')[0];
  const sunStr = sunday.toISOString().split('T')[0];

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        mcp_servers: [{ type: 'url', url: 'https://gcal.mcp.claude.com/mcp', name: 'gcal' }],
        messages: [{ role: 'user', content:
          `Hent kalenderbegivenheder fra primær kalender. TimeMin: ${monStr}T00:00:00, TimeMax: ${sunStr}T23:59:59, timeZone: Europe/Copenhagen. ` +
          `Svar KUN med JSON-array (ingen markdown, ingen forklaring), format: [{"summary":"navn","date":"DD/MM","start":"HH:MM","allDay":false}]. ` +
          `Maks 15 begivenheder. Ekskluder begivenheder med "Vane-påmindelse" i titlen. Hvis ingen begivenheder, svar med [].`
        }]
      })
    });
    const data  = await res.json();
    const raw   = data.content?.find(c => c.type === 'text')?.text || '[]';
    const clean = raw.replace(/```json|```/g, '').trim();
    let events  = [];
    try { events = JSON.parse(clean); } catch(e) { events = []; }

    listEl.innerHTML = '';
    if (!Array.isArray(events) || events.length === 0) {
      listEl.innerHTML = '<div class="mg-empty">Ingen begivenheder denne uge 🎉</div>';
      return;
    }
    events.forEach(ev => {
      const row = document.createElement('div');
      row.className = 'review-cal-item';
      const timeStr = ev.allDay ? 'Heldagsbegivenhed' : (ev.start || '');
      row.innerHTML = `
        <span class="review-cal-time">${ev.date || ''} ${timeStr}</span>
        <span>${ev.summary || 'Unavngivet'}</span>`;
      listEl.appendChild(row);
    });
  } catch(e) {
    listEl.innerHTML = '<div class="mg-empty">Kunne ikke hente kalender</div>';
  }
}

// ── TO-DOS ──
let reviewTodoData = {};
async function renderReviewTodos() {
  let todoNotes = notes.filter(n => n.type === 'todo');
  if (todoNotes.length === 0 && currentUserId) {
    const { data } = await sb.from('notes').select('*').eq('user_id', currentUserId).eq('type', 'todo');
    if (data) todoNotes = data;
  }
  let done = 0, pending = 0;
  const listEl = document.getElementById('review-todos-list');
  if (listEl) listEl.innerHTML = '';
  todoNotes.forEach(n => {
    const items = JSON.parse(n.body || '[]');
    items.forEach(item => {
      if (item.done) done++; else pending++;
    });
    if (listEl && items.length > 0) {
      const row = document.createElement('div');
      row.style.cssText = 'font-family:"DM Mono",monospace;font-size:0.72rem;display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid var(--border)';
      const doneCount = items.filter(i=>i.done).length;
      row.innerHTML = `<span>${n.title}</span><span style="color:var(--muted)">${doneCount}/${items.length}</span>`;
      listEl.appendChild(row);
    }
  });
  document.getElementById('review-todos-done').textContent    = done;
  document.getElementById('review-todos-pending').textContent = pending;
  const total = done + pending;
  const pct   = total > 0 ? Math.round((done/total)*100) : 0;
  reviewTodoData = { done, pending, pct };
  document.getElementById('rpil-todos').textContent = done + '/' + total;
}

// ── SCORE ──
function computeReviewScore() {
  const habitPct  = reviewHabitData.pct  || 0;
  const focusMins = reviewFocusData.mins || 0;
  const net       = reviewBudgetData.net;
  const todoPct   = reviewTodoData.pct   || 0;

  const habitScore  = habitPct;
  const focusScore  = Math.min(100, Math.round((focusMins / 300) * 100));
  const budgetScore = net === undefined ? 50 : net >= 0 ? 100 : Math.max(0, 50 + net / 100);
  const todoScore   = todoPct;

  const total = Math.round((habitScore * 0.35) + (focusScore * 0.30) + (budgetScore * 0.20) + (todoScore * 0.15));

  const ring = document.getElementById('review-ring');
  const circumference = 326.7;
  if (ring) ring.style.strokeDashoffset = circumference - (circumference * total / 100);

  document.getElementById('review-score').textContent = total;
  const title = total >= 85 ? '🏆 Fantastisk uge! Du er i topform.' :
                total >= 70 ? '💪 Rigtig god uge — hold momentum.' :
                total >= 50 ? '📈 Okay uge — et par ting kan forbedres.' :
                              '🌱 Hård uge — ny chance næste uge.';
  document.getElementById('review-score-title').textContent = title;

  if (ring) ring.style.stroke = total >= 75 ? 'var(--accent2)' : total >= 50 ? 'var(--accent3)' : 'var(--danger)';
}

// ── AI REFLEKSION ──
async function generateReviewAI() {
  const btn = document.getElementById('review-ai-btn');
  const txt = document.getElementById('review-ai-text');
  btn.textContent = '⏳ Analyserer...';
  btn.disabled = true;
  txt.innerHTML = '<span style="color:var(--muted)">Henter AI-analyse...</span>';

  const { monday, sunday } = getWeekRange(reviewWeekOffset);
  const weekLabel = `uge ${getWeekNumber(monday)}`;

  const prompt = `Du er en venlig personlig coach. Analyser denne brugers ${weekLabel}:
- Vaner: ${reviewHabitData.pct || 0}% gennemført
- Fokus: ${reviewFocusData.sessions || 0} sessioner, ${reviewFocusData.mins || 0} minutter total
- Budget: ${reviewBudgetData.net >= 0 ? '+' : ''}${reviewBudgetData.net || 0} kr netto (${reviewBudgetData.txCount || 0} transaktioner)
- To-dos: ${reviewTodoData.done || 0} klaret, ${reviewTodoData.pending || 0} mangler

Giv en kort, ærlig og motiverende refleksion på dansk (maks 5 sætninger). Vær konkret. Fremhæv ét positivt og ét område til forbedring. Brug ikke bullet points.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data   = await res.json();
    const result = data.content?.find(c => c.type === 'text')?.text || 'Ingen analyse tilgængelig.';
    txt.style.color = 'var(--text)';
    txt.textContent = result;
    btn.textContent = '↺ Analysér igen';
  } catch(e) {
    txt.textContent = 'Kunne ikke hente AI-analyse. Prøv igen.';
    btn.textContent = '✨ Analysér min uge';
  }
  btn.disabled = false;
}
