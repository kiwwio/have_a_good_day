/* 好日子行事曆 v3.0 — 主程式（網頁 App 與 iOS／Android App 共用）
   網頁版：可加到手機桌面、離線可開；提醒在打開 App 時跳出。
   手機 App 版（Capacitor）：用手機本機排程通知，App 關著也會準時提醒（見「手機本機通知」一節）。 */
(function(){
'use strict';
const APP_VERSION = 'v3.0';
// 在 iOS／Android App 裡執行時為 true（Capacitor 原生殼）
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const LN = NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins.LocalNotifications : null;
const WD = ['日','一','二','三','四','五','六'];
const TYPES = {
  book:  {name:'讀書會', icon:'📖', color:'c-blue'},
  dance: {name:'跳舞',   icon:'💃', color:'c-red'},
  sing:  {name:'唱歌',   icon:'🎤', color:'c-orange'},
  doctor:{name:'看醫生', icon:'🏥', color:'c-green'},
  family:{name:'家人聚會',icon:'👨‍👩‍👧', color:'c-pink'},
  other: {name:'其他',   icon:'📌', color:'c-gray'}
};
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfWeek = d => { const x = new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate() - (x.getDay()+6)%7); return x; };
const md = d => (d.getMonth()+1)+'/'+d.getDate();
const parseYmd = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
function fmtTime(t){
  const [h,m] = t.split(':').map(Number);
  const part = h < 12 ? '上午' : h < 18 ? '下午' : '晚上';
  const hh = h > 12 ? h-12 : (h===0?12:h);
  return part+' '+hh+(m ? ':'+pad(m) : ' 點');
}

// ---------- 資料 ----------
const STORE_KEY = 'elder-cal-v1', SHOWN_KEY = 'elder-cal-shown', INSTALL_KEY = 'elder-cal-install-hint';
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
function seed(){
  const nextWeek = startOfWeek(addDays(TODAY,7));
  return [
    {id:1, type:'book',  repeat:true, weekday:3, time:'09:30', place:'社區活動中心 2 樓'},
    {id:2, type:'dance', repeat:true, weekday:4, time:'19:00', place:'河濱公園'},
    {id:3, type:'sing',  repeat:true, weekday:5, time:'14:00', place:'里民卡拉OK教室'},
    {id:4, type:'dance', repeat:true, weekday:0, time:'07:00', place:'河濱公園'},
    {id:5, type:'doctor',repeat:false, date:ymd(addDays(nextWeek,1)), time:'10:00', place:'家醫科回診（帶健保卡）'},
    {id:6, type:'family',repeat:false, date:ymd(addDays(nextWeek,5)), time:'18:00', place:'孫子生日聚餐'}
  ];
}
const FONT_LEVELS = [{name:'標準', fs:'1.25rem'}, {name:'大', fs:'1.5rem'}, {name:'特大', fs:'1.75rem'}];
const mq = q => { try { return matchMedia(q).matches; } catch(e){ return false; } };
const load = (k, def) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : def; } catch(e){ return def; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };

// 第一次打開時跟隨手機設定：系統要求高對比 → 預設開高對比
let S = { events: seed(), sample:true, settings:{sunday:true, sundayHour:20, dayBefore:true, hourBefore:true, fontLevel:0, highContrast: mq('(prefers-contrast: more)')} };
const saved = load(STORE_KEY, null);
if (saved) { S = Object.assign(S, saved); S.settings = Object.assign({}, S.settings, saved.settings||{}); }
if (S.settings.fontLevel == null) S.settings.fontLevel = S.settings.bigFont ? 1 : 0;
const save = () => { store(STORE_KEY, S); scheduleNative(); };

let view = 'week', weekOffset = 0, monthCursor = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), selDay = new Date(TODAY);
let draft = null;

const titleOf = e => e.type==='other' && e.title ? e.title : TYPES[e.type].name;
function eventsOn(d){
  // 預設不含「這次不去」的活動；畫面列表傳 true 以便顯示並可恢復
  return eventsAll(d).filter(e => !isSkipped(e, d));
}
function eventsAll(d){
  const key = ymd(d), wd = d.getDay();
  return S.events.filter(e => e.repeat ? e.weekday===wd : e.date===key).sort((a,b)=>a.time.localeCompare(b.time));
}
const isSkipped = (e, d) => !!(e.repeat && e.skip && e.skip.includes(ymd(d)));
// 今天已經結束的活動（開始後超過 2 小時）
function isDoneToday(e, d){
  if (+d !== +TODAY) return false;
  const [h,m] = e.time.split(':').map(Number);
  return new Date() - new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m) > 2*3600e3;
}
// 下一次發生的日期（從今天算起）
function nextOccurrence(e){
  if (!e.repeat) return parseYmd(e.date);
  for (let i=0;i<14;i++){ const d = addDays(TODAY,i); if (d.getDay()===e.weekday && !isSkipped(e,d)) return d; }
  return null;
}

// ---------- 安裝到手機桌面 ----------
let installPrompt = null;
const isStandalone = () => NATIVE || mq('(display-mode: standalone)') || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (view==='week'||view==='settings') render(); });
window.addEventListener('appinstalled', () => { installPrompt = null; toast('已放到手機桌面！'); render(); });
async function doInstall(){
  if (installPrompt){ installPrompt.prompt(); try { await installPrompt.userChoice; } catch(e){} installPrompt = null; render(); }
  else location.href = './install.html' + (isIOS() ? '#iphone' : '#android');
}

// ---------- 畫面 ----------
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function evHTML(e, d){
  const t = TYPES[e.type], skipped = isSkipped(e, d), done = !skipped && isDoneToday(e, d);
  const state = skipped ? '<span class="state">這次不去</span>' : done ? '<span class="state">已結束</span>' : '';
  return `<button class="ev ${t.color} ${skipped?'is-skipped':''} ${done?'is-done':''}" data-ev="${e.id}" data-date="${ymd(d)}">
    <span class="ic" aria-hidden="true">${t.icon}</span>
    <span class="tx"><span class="tt">${esc(titleOf(e))}</span>${e.repeat?'<span class="rep">每週</span>':''}${state}
    <span class="meta">${fmtTime(e.time)}${e.place?' · '+esc(e.place):''}</span></span></button>`;
}
function weekHTML(offset){
  const start = startOfWeek(addDays(TODAY, offset*7));
  let h = '<div class="daylist">';
  for (let i=0;i<7;i++){
    const d = addDays(start,i), evs = eventsAll(d);
    const isToday = +d === +TODAY, past = d < TODAY;
    h += `<div class="day ${isToday?'is-today':''} ${past?'is-past':''} ${(d.getDay()%6===0)?'weekend':''}">
      <div class="wd"><b>週${WD[d.getDay()]}</b><span>${md(d)}</span>${isToday?'<span class="tag">今天</span>':past?'<span class="tag past">已過</span>':''}</div>
      <div class="evs">${evs.length ? evs.map(e=>evHTML(e,d)).join('') : '<div class="none">沒有活動，好好休息</div>'}</div></div>`;
  }
  return h + '</div>';
}

function render(){
  document.documentElement.style.setProperty('--fs', FONT_LEVELS[S.settings.fontLevel].fs);
  if (S.settings.highContrast) document.documentElement.dataset.contrast = 'high'; else delete document.documentElement.dataset.contrast;
  document.querySelectorAll('.nav button').forEach(b => { if (b.dataset.view===view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  const sc = $('#screen');
  if (view==='week') sc.innerHTML = renderWeek();
  else if (view==='month') sc.innerHTML = renderMonth();
  else if (view==='add') sc.innerHTML = renderAdd();
  else sc.innerHTML = renderSettings();
  window.scrollTo(0,0);
}

function installHintHTML(){
  // 一次只顯示一個提示：範例行程提示優先
  if (S.sample || isStandalone() || load(INSTALL_KEY, false)) return '';
  return `<div class="notice"><b>📲 把好日子放到手機桌面</b><p>以後在桌面點一下就能打開，不用再找網址。</p>
    <div class="row"><button class="secondary" id="install">怎麼放？</button><button class="secondary" id="install-later">先不用</button></div></div>`;
}
function sampleHintHTML(){
  if (!S.sample) return '';
  return `<div class="notice warn"><b>現在看到的是範例行程</b><p>可以先試著點點看。要開始記自己的行程時，按「清空重來」。</p>
    <div class="row"><button class="secondary" id="clear-ask">清空重來</button><button class="secondary" id="keep-sample">保留範例</button></div></div>`;
}

function renderWeek(){
  const todays = eventsOn(TODAY);
  const start = startOfWeek(addDays(TODAY, weekOffset*7));
  const todaysAll = eventsAll(TODAY);
  return `
  <div class="today-head">
    <div class="tearsheet"><div class="m">${TODAY.getMonth()+1} 月</div><div class="d">${TODAY.getDate()}</div><div class="w">星期${WD[TODAY.getDay()]}</div></div>
    <div><h1>${todays.length ? '今天有 '+todays.length+' 個活動' : '今天沒有活動'}</h1>
    <p>${todays.length ? (todays.every(e=>isDoneToday(e,TODAY)) ? '今天的活動都結束了，辛苦了' : '別忘了出門時間喔') : '可以在家休息，或按「新增」記下行程'}</p></div>
  </div>
  ${todaysAll.length ? '<div class="todaycard">'+todaysAll.map(e=>evHTML(e,TODAY)).join('')+'</div>' : ''}
  ${sampleHintHTML()}${installHintHTML()}
  <h2 class="sec"><span>${weekOffset===0?'這一週':'下一週'} <small style="font-weight:400;color:var(--muted);font-size:.75em">${md(start)}–${md(addDays(start,6))}</small></span>
    <span class="seg" role="group" aria-label="切換週次"><button id="wk0" aria-pressed="${weekOffset===0}">本週</button><button id="wk1" aria-pressed="${weekOffset===1}">下週</button></span></h2>
  ${weekHTML(weekOffset)}
  <div class="btnrow two">
    <button class="secondary" id="share-week">📤 分享${weekOffset===0?'這週':'下週'}行程</button>
    <button class="secondary" data-view="add" style="border-color:var(--red);color:var(--red)">＋ 新增活動</button>
  </div>`;
}

function renderMonth(){
  const y = monthCursor.getFullYear(), m = monthCursor.getMonth();
  const first = new Date(y,m,1), gridStart = addDays(first, -first.getDay());
  let h = `<div class="month"><div class="month-top"><button class="iconbtn" id="mprev" aria-label="上個月">‹</button><b>${y} 年 ${m+1} 月</b><button class="iconbtn" id="mnext" aria-label="下個月">›</button></div><div class="mgrid">`;
  WD.forEach((w,i)=> h += `<div class="h ${i===0?'sun':i===6?'sat':''}">${w}</div>`);
  for (let i=0;i<42;i++){
    const d = addDays(gridStart,i); if (i>=35 && d.getMonth()!==m) break;
    const evs = eventsOn(d);
    const cls = [d.getMonth()!==m?'out':'', d.getDay()===0?'sun':d.getDay()===6?'sat':'', +d===+TODAY?'today':'', +d===+selDay?'sel':''].join(' ');
    h += `<button class="cell ${cls}" data-day="${ymd(d)}" aria-label="${d.getMonth()+1}月${d.getDate()}日，${evs.length}個活動"><span class="n">${d.getDate()}</span><span class="dots" aria-hidden="true">${evs.slice(0,2).map(e=>TYPES[e.type].icon).join('')}${evs.length>2?'<span class="more">+'+(evs.length-2)+'</span>':''}</span></button>`;
  }
  h += '</div></div>';
  const evs = eventsAll(selDay);
  h += `<div class="pickday"><h2 class="sec">${selDay.getMonth()+1} 月 ${selDay.getDate()} 日（週${WD[selDay.getDay()]}）</h2>
    <div class="todaycard">${evs.length ? evs.map(e=>evHTML(e,selDay)).join('') : '<div class="none">這天沒有活動</div>'}
    <button class="secondary" id="add-this-day">＋ 在這天新增活動</button></div></div>`;
  return h;
}

function newDraft(d){ const day = d || TODAY; return {editId:null, type:null, title:'', repeat:true, weekday:day.getDay(), date:ymd(day), hour:9, min:0, place:''}; }
// 修改既有活動：把資料帶進表單（時間不在半小時格上時，取最近的半小時）
function draftFrom(e, d){
  const [h,m] = e.time.split(':').map(Number); const mins = Math.round((h*60+m)/30)*30;
  return {editId:e.id, type:e.type, title:e.title||'', repeat:e.repeat, weekday:e.repeat?e.weekday:d.getDay(),
    date:e.repeat?ymd(d):e.date, hour:Math.floor(mins/60), min:mins%60, place:e.place||''};
}
const timeLabel = (hh, mm) => (hh<12?'上午':hh<18?'下午':'晚上')+' '+(hh>12?hh-12:hh)+(mm?':30':' 點');
function renderAdd(){
  if (!draft) draft = newDraft();
  const D = draft;
  return `
  <h2 class="sec">${D.editId ? '修改活動' : '新增一個活動'}</h2>
  <div class="step"><h3>1. 是什麼活動？</h3><div class="choices">
    ${Object.entries(TYPES).map(([k,t])=>`<button class="choice" data-type="${k}" aria-pressed="${D.type===k}"><span class="big" aria-hidden="true">${t.icon}</span>${t.name}</button>`).join('')}
  </div>${D.type==='other'?`<input class="field" id="f-title" style="margin-top:10px" placeholder="活動名稱，例如：拿藥" value="${esc(D.title)}">`:''}</div>
  <div class="step"><h3>2. 每週都有，還是只有一次？</h3><div class="choices w2">
    <button class="choice" id="rep-yes" aria-pressed="${D.repeat}"><span class="big" aria-hidden="true">🔁</span>每週固定</button>
    <button class="choice" id="rep-no" aria-pressed="${!D.repeat}"><span class="big" aria-hidden="true">1️⃣</span>只有一次</button></div></div>
  <div class="step"><h3>3. ${D.repeat?'每週的星期幾？':'哪一天？'}</h3>
    ${D.repeat ? `<div class="choices w7">${[1,2,3,4,5,6,0].map(w=>`<button class="choice" data-wd="${w}" aria-pressed="${D.weekday===w}" aria-label="星期${WD[w]}">${WD[w]}</button>`).join('')}</div>`
      : `<input type="date" class="field" id="f-date" value="${D.date}">`}</div>
  <div class="step"><h3>4. 幾點開始？</h3>
    <div class="stepper"><output id="f-time">${timeLabel(D.hour, D.min)}</output>
      <button class="choice" id="h-minus" aria-label="提早半小時">－ 早一點</button><button class="choice" id="h-plus" aria-label="延後半小時">＋ 晚一點</button></div></div>
  <div class="step"><h3>5. 在哪裡？ <small>（可以不填）</small></h3><input class="field" id="f-place" placeholder="例如：活動中心" value="${esc(D.place)}"></div>
  <button class="primary" id="save">${D.editId ? '儲存修改' : '儲存這個活動'}</button>
  ${D.editId ? '<div class="btnrow"><button class="secondary" id="edit-cancel">不改了</button></div>' : ''}`;
}

function renderSettings(){
  const s = S.settings;
  const sw = (id,on) => `<button class="switch" role="switch" id="${id}" aria-checked="${on}"><span>${on?'開':'關'}</span></button>`;
  const hourName = h => h<12?'上午 '+h:h===12?'中午 12':'晚上 '+(h-12);
  return `
  <h2 class="sec">提醒設定</h2>
  ${NATIVE ? permNoticeHTML() : `<div class="notice warn"><b>目前是網頁版</b><p>提醒會在你<b style="display:inline;color:inherit">打開 App 時</b>出現。手機 App 版本，App 關著也會自動跳出提醒。</p></div>`}
  <div class="setrow"><div class="lbl"><b>週日預告下週行程</b><span>${NATIVE ? `每週日 ${hourName(s.sundayHour)} 點，手機會跳出下週活動` : `每週日 ${hourName(s.sundayHour)} 點以後，打開就看到下週活動`}</span></div>${sw('s-sunday',s.sunday)}</div>
  ${s.sunday?`<div class="step"><h3>預告時間（週日）</h3><div class="choices">${[18,19,20,21,9,12].map(h=>`<button class="choice" data-sh="${h}" aria-pressed="${s.sundayHour===h}">${hourName(h)} 點</button>`).join('')}</div></div>`:''}
  <div class="setrow"><div class="lbl"><b>活動前一天提醒</b><span>${NATIVE ? '前一天晚上 8 點，提醒明天要做什麼' : '前一天晚上 6 點以後，提醒明天要做什麼'}</span></div>${sw('s-daybefore',s.dayBefore)}</div>
  <div class="setrow"><div class="lbl"><b>出門前提醒</b><span>${NATIVE ? '活動開始前 1 小時，提醒準備出門' : '活動開始前 1 個半小時內，提醒準備出門'}</span></div>${sw('s-hour',s.hourBefore)}</div>
  <h2 class="sec">看得清楚</h2>
  <div class="step"><h3>字的大小</h3><div class="choices">${FONT_LEVELS.map((f,i)=>`<button class="choice" data-fl="${i}" aria-pressed="${s.fontLevel===i}"><span style="font-size:${1+i*.25}em;line-height:1.1" aria-hidden="true">字</span>${f.name}</button>`).join('')}</div></div>
  <div class="setrow"><div class="lbl"><b>高對比顏色</b><span>白底黑字、粗黑框，看不清楚時打開</span></div>${sw('s-contrast',!!s.highContrast)}</div>
  ${isStandalone() ? '' : `<h2 class="sec">放到手機桌面</h2><button class="primary" id="install">📲 把好日子放到手機桌面</button>`}
  <h2 class="sec">試試看提醒長怎樣</h2>
  <div class="btnrow"><button class="secondary" id="try-sunday">🔔 週日的「下週預告」</button><button class="secondary" id="try-day">🔔 前一天的提醒</button></div>
  <h2 class="sec">資料</h2>
  <div class="btnrow"><button class="secondary" id="clear-ask">清空所有行程</button><button class="secondary" id="reset-ask">換回範例行程</button></div>
  <p class="about">好日子行事曆 ${APP_VERSION}${NATIVE ? '（手機 App）' : ''}・行程只存在這支手機裡</p>`;
}

// ---------- 彈出視窗與提示 ----------
// 提示訊息；可附一個動作按鈕（例如「復原」），有按鈕時停留較久，長輩來得及按
let toastAction = null, toastTimer = null;
function toast(msg, actLabel, actFn){
  const t = document.createElement('div'); t.className='toast'; t.setAttribute('role','status');
  const span = document.createElement('span'); span.textContent = msg; t.append(span);
  if (actLabel){ const bt = document.createElement('button'); bt.id='toast-act'; bt.textContent=actLabel; t.append(bt); }
  toastAction = actFn || null;
  $('#toast-host').replaceChildren(t); clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.remove(); if (toastAction===actFn) toastAction=null; }, actLabel ? 8000 : 2600);
}
function sheet(html){ $('#overlay-host').innerHTML = `<div class="overlay" id="ov"><div class="sheetbox" role="dialog" aria-modal="true">${html}</div></div>`; const f = $('#overlay-host .sheetbox button, #overlay-host .sheetbox a'); if (f) f.focus(); }
function closeSheet(){ $('#overlay-host').innerHTML=''; }
function confirmSheet(title, body, yesId, yesLabel){
  sheet(`<h3>${title}</h3><p class="sub">${body}</p><div class="btnrow two"><button class="secondary" id="sheet-close">不要</button><button class="primary" id="${yesId}">${yesLabel}</button></div>`);
}

const canSpeak = 'speechSynthesis' in window;
let speechText = '';
function speak(text){ try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang='zh-TW'; u.rate=.85; speechSynthesis.speak(u); } catch(e){ toast('這支手機不能朗讀'); } }

// ---------- 分享（直接開 LINE；電腦上可複製） ----------
const lineURL = text => 'https://line.me/R/share?text=' + encodeURIComponent(text);
function shareSheet(text){
  sheet(`<h3>分享給朋友</h3><p class="sub">下面這段話會傳給你選的 LINE 朋友或群組</p>
    <div class="todaycard" style="white-space:pre-line;font-size:1em" id="share-text">${esc(text)}</div>
    <div class="btnrow">
      <a class="primary line" href="${lineURL(text)}" target="_blank" rel="noopener">用 LINE 傳送</a>
      ${navigator.share ? '<button class="secondary" id="share-other">用其他方式傳送</button>' : ''}
      <button class="secondary" id="copy-share">📋 複製這段話</button>
      <button class="secondary" id="sheet-close">先不要</button></div>`);
}
function weekShareText(offset){
  const start = startOfWeek(addDays(TODAY, offset*7)); const lines=[];
  for (let i=0;i<7;i++){ const d=addDays(start,i); eventsOn(d).forEach(e=>lines.push(`週${WD[d.getDay()]}（${md(d)}）${fmtTime(e.time)} ${titleOf(e)}${e.place?'，'+e.place:''}`)); }
  return `我${offset===0?'這週':'下週'}的行程：\n`+(lines.length?lines.join('\n'):'沒有活動')+'\n要不要一起來？';
}
function eventShareText(e, d){
  const diff = Math.round((d-TODAY)/864e5);
  const when = diff===0?'今天':diff===1?'明天':(startOfWeek(d).getTime()===startOfWeek(TODAY).getTime()?'這禮拜':'下禮拜')+WD[d.getDay()];
  return `${when}（${md(d)}）${fmtTime(e.time)}，我們一起去${titleOf(e)}！${e.place?'\n地點：'+e.place:''}`;
}

// ---------- 提醒 ----------
function nextWeekPreview(){
  const start = startOfWeek(addDays(TODAY,7)); const days = []; let total=0; const speech=[];
  for (let i=0;i<7;i++){ const d=addDays(start,i), evs=eventsOn(d); if(evs.length){ days.push([d,evs]); total+=evs.length;
    speech.push('週'+WD[d.getDay()]+'，'+evs.map(e=>fmtTime(e.time)+titleOf(e)).join('，')); } }
  return {start, days, total, speech:'下週行程預告。'+(speech.length?speech.join('。'):'下週沒有活動')+'。'};
}
function showWeekPreview(){
  const p = nextWeekPreview();
  sheet(`<h3>下週行程預告</h3><p class="sub">${md(p.start)}（一）到 ${md(addDays(p.start,6))}（日），共 ${p.total} 個活動</p>
    ${p.days.map(([d,evs])=>`<div class="preview-day"><b>週${WD[d.getDay()]}　${md(d)}</b><div class="todaycard">${evs.map(e=>evHTML(e,d)).join('')}</div></div>`).join('') || '<div class="none">下週沒有活動</div>'}
    <div class="btnrow">${canSpeak?'<button class="secondary" id="speak-week">🔊 唸給我聽</button>':''}<button class="primary" id="sheet-close">知道了</button></div>`);
  speechText = p.speech;
}
function nextEventDay(from){
  for (let i=from;i<14;i++){ const d = addDays(TODAY,i), evs = eventsOn(d); if (evs.length) return [d,evs]; }
  return null;
}
function notify(kind, extra){
  const bn = $('#banner');
  if (kind==='sunday'){
    const p = nextWeekPreview();
    $('#bn-title').textContent = '下週行程預告';
    $('#bn-body').textContent = p.total ? `下週有 ${p.total} 個活動：` + p.days.map(([d,evs])=>'週'+WD[d.getDay()]+evs.map(e=>titleOf(e)).join('、')).join('，') : '下週沒有活動，好好休息。';
    bn.dataset.kind='sunday';
  } else if (kind==='soon'){
    const e = extra, [h,m] = e.time.split(':').map(Number);
    const mins = Math.round((new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate(),h,m) - new Date())/60000);
    $('#bn-title').textContent = `再過 ${mins} 分鐘要去${titleOf(e)}`;
    $('#bn-body').textContent = `${fmtTime(e.time)}${e.place?'，在'+e.place:''}，記得準備出門喔。`;
    bn.dataset.kind='day'; bn.dataset.date = ymd(TODAY);
  } else {
    const n = nextEventDay(1); if (!n){ toast('最近兩週沒有活動'); return; }
    const [d,evs] = n, e = evs[0], diff = Math.round((d-TODAY)/864e5);
    const when = diff===1 ? '明天' : diff+' 天後';
    $('#bn-title').textContent = `${when}（週${WD[d.getDay()]}）要${titleOf(e)}`;
    $('#bn-body').textContent = `${fmtTime(e.time)}${e.place?'，在'+e.place:''}${evs.length>1?`，另外還有 ${evs.length-1} 個活動`:''}`;
    bn.dataset.kind='day'; bn.dataset.date = ymd(d);
  }
  bn.classList.add('show');
}
// 打開 App 時，依時間自動跳出提醒（每種提醒每天最多一次）
function autoRemind(){
  const now = new Date(), today = ymd(TODAY), shown = load(SHOWN_KEY, {}), s = S.settings;
  const mark = k => { shown[k] = today; store(SHOWN_KEY, shown); };
  if (s.hourBefore){
    const soon = eventsOn(TODAY).find(e => { const [h,m] = e.time.split(':').map(Number); const diff = (new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate(),h,m) - now)/60000; return diff > 0 && diff <= 90; });
    if (soon && shown['soon-'+soon.id] !== today){ mark('soon-'+soon.id); return notify('soon', soon); }
  }
  if (s.sunday && now.getDay()===0 && now.getHours() >= s.sundayHour && shown.sunday !== today){ mark('sunday'); return notify('sunday'); }
  if (s.dayBefore && now.getHours() >= 18 && eventsOn(addDays(TODAY,1)).length && shown.day !== today){ mark('day'); return notify('day'); }
}

// ---------- 手機本機通知（只在 iOS／Android App 裡運作） ----------
// 規則（手機版發布規劃 v1.0 §2.1）：每次改行程或改設定就全部清掉重排。
// 不用「每週重複」通知，而是展開成未來 21 天的每一次，才能正確略過「這次不去」；
// 每次打開 App 也會重排，讓排程一直往後滾動。iOS 同時最多 64 則，只排最近的 60 則。
const NOTIF_DAYS = 21, NOTIF_MAX = 60;
let notifPerm = 'unknown';   // granted / denied / prompt / unknown
let exactOK = false;         // Android 能否排準時鬧鐘（App 已宣告 USE_EXACT_ALARM，通常為 true）
function buildNotifications(){
  const s = S.settings, now = Date.now(), list = [];
  const at = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m || 0);
  const add = (when, title, body, extra) => { if (+when > now + 30000) list.push({when, title, body, extra}); };
  for (let i = 0; i <= NOTIF_DAYS; i++){
    const d = addDays(TODAY, i), evs = eventsOn(d);
    if (s.hourBefore) evs.forEach(e => {
      const [h, m] = e.time.split(':').map(Number);
      add(new Date(+at(d, h, m) - 3600e3), `再過 1 小時要去${titleOf(e)}`,
        `${fmtTime(e.time)}${e.place ? '，在' + e.place : ''}，記得準備出門喔。`, {kind:'day', date:ymd(d)});
    });
    if (s.dayBefore && evs.length){
      const e = evs[0];
      add(at(addDays(d, -1), 20), `明天（週${WD[d.getDay()]}）要${titleOf(e)}`,
        `${fmtTime(e.time)}${e.place ? '，在' + e.place : ''}${evs.length > 1 ? `，另外還有 ${evs.length - 1} 個活動` : ''}`, {kind:'day', date:ymd(d)});
    }
    if (s.sunday && d.getDay() === 0){
      const start = addDays(d, 1); let total = 0; const parts = [];
      for (let k = 0; k < 7; k++){
        const x = addDays(start, k), ev2 = eventsOn(x);
        if (ev2.length){ total += ev2.length; parts.push('週' + WD[x.getDay()] + ev2.map(titleOf).join('、')); }
      }
      add(at(d, s.sundayHour), '下週行程預告', total ? `下週有 ${total} 個活動：${parts.join('，')}` : '下週沒有活動，好好休息。', {kind:'sunday', date:ymd(d)});
    }
  }
  return list.sort((a, b) => a.when - b.when).slice(0, NOTIF_MAX)
    .map((n, i) => ({id: i + 1, title: n.title, body: n.body, largeBody: n.body,
      schedule: {at: n.when, allowWhileIdle: true}, extra: n.extra,
      // 能準時才要求準時；不能準時就用一般排程（可能晚到），避免外掛跳出英文的系統設定頁
      isExactNotification: exactOK}));
}
let schedTimer = null;
function scheduleNative(){
  if (!LN) return;
  clearTimeout(schedTimer);   // 連續修改時只排最後一次
  schedTimer = setTimeout(async () => {
    try {
      const pend = await LN.getPending();
      if (pend.notifications && pend.notifications.length) await LN.cancel({notifications: pend.notifications.map(n => ({id: n.id}))});
      if (notifPerm !== 'granted') return;
      try { const ex = await LN.checkExactNotificationSetting(); exactOK = ex.exact_alarm === 'granted'; } catch(e){ exactOK = true; /* iOS 沒有這項限制 */ }
      const list = buildNotifications();
      if (list.length) await LN.schedule({notifications: list});
    } catch(e){ console.warn('排通知失敗', e); }
  }, 300);
}
function permNoticeHTML(){
  if (notifPerm === 'granted') return `<div class="notice"><b>✅ 提醒已開啟</b><p>App 關著也會準時跳出提醒。</p></div>`;
  if (notifPerm === 'denied') return `<div class="notice warn"><b>⚠️ 手機的通知被關掉了</b><p>好日子沒辦法提醒你。請到手機的「設定」→「應用程式」→「好日子行事曆」→「通知」，把它打開。</p><button class="secondary" id="perm-recheck">我打開了，再檢查一次</button></div>`;
  return `<div class="notice warn"><b>還沒開啟提醒</b><p>要讓手機在活動前提醒你，需要你同意。</p><button class="primary" id="perm-ask">開啟提醒</button></div>`;
}
// 第一次：先用大字說明為什麼要通知，再跳出系統的詢問
function permExplain(){
  sheet(`<h3>讓好日子提醒你</h3><p class="sub">活動前一天晚上、出門前 1 小時，手機會「叮」一聲跳出提醒，App 關著也會。</p>
    <p class="sub">等一下手機會問你「是否允許通知」，請按 <b>允許</b>。</p>
    <div class="btnrow"><button class="primary" id="perm-go">好，開啟提醒</button><button class="secondary" id="sheet-close">以後再說</button></div>`);
}
async function refreshPerm(){
  if (!LN) return;
  try { const r = await LN.checkPermissions(); notifPerm = r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'prompt'; }
  catch(e){ notifPerm = 'unknown'; }
}
async function askPerm(){
  try { const r = await LN.requestPermissions(); notifPerm = r.display === 'granted' ? 'granted' : 'denied'; } catch(e){}
  closeSheet(); scheduleNative(); render();
  toast(notifPerm === 'granted' ? '提醒開好了！' : '沒有開啟提醒，之後可以在「提醒」頁再開');
}
// 試試看：5 秒後跳出一則真的系統通知，家人可以用來確認長輩手機收得到
async function testNotify(kind){
  if (notifPerm !== 'granted'){ permExplain(); return; }
  let title, body, extra;
  if (kind === 'sunday'){ const p = nextWeekPreview(); title = '下週行程預告（試試看）';
    body = p.total ? `下週有 ${p.total} 個活動` : '下週沒有活動，好好休息。'; extra = {kind:'sunday'}; }
  else { const n = nextEventDay(1); const d = n ? n[0] : addDays(TODAY,1), e = n && n[1][0];
    title = e ? `明天要${titleOf(e)}（試試看）` : '好日子提醒（試試看）';
    body = e ? `${fmtTime(e.time)}${e.place ? '，在' + e.place : ''}` : '這是測試提醒'; extra = {kind:'day', date: ymd(d)}; }
  try { await LN.schedule({notifications: [{id: 900, title, body, largeBody: body, extra,
    schedule: {at: new Date(Date.now() + 5000), allowWhileIdle: true}, isExactNotification: exactOK}]});
    toast('5 秒後手機會跳出提醒，可以先回到手機桌面看看');
  } catch(e){ toast('提醒沒有排成功，請檢查通知是否打開'); }
}
async function initNative(){
  if (!LN) return;
  await refreshPerm();
  if (notifPerm === 'prompt' && !load('elder-cal-perm-asked', false)){ store('elder-cal-perm-asked', true); permExplain(); }
  scheduleNative();
  if (view === 'settings') render();
  // 點通知：預告 → 下週清單；其他 → 那一天
  LN.addListener('localNotificationActionPerformed', a => {
    const x = (a && a.notification && a.notification.extra) || {};
    if (x.kind === 'sunday'){ weekOffset = 1; view = 'week'; render(); showWeekPreview(); }
    else if (x.date){ selDay = parseYmd(x.date); monthCursor = new Date(selDay.getFullYear(), selDay.getMonth(), 1); view = 'month'; closeSheet(); render(); }
  });
  // 從背景回來時重新檢查權限（長輩可能剛去設定打開）
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const before = notifPerm; await refreshPerm();
    if (before !== notifPerm){ scheduleNative(); render(); }
  });
}

// ---------- 操作 ----------
document.addEventListener('click', ev => {
  const t = ev.target;
  if (t.id==='ov') { closeSheet(); return; }
  const b = t.closest('button'); if (!b) return;
  const id = b.id;
  if (b.dataset.view){ view = b.dataset.view; if (view==='add') draft = newDraft(); closeSheet(); render(); return; }
  if (id==='wk0'||id==='wk1'){ weekOffset = id==='wk1'?1:0; render(); return; }
  if (id==='mprev'||id==='mnext'){ monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth()+(id==='mnext'?1:-1), 1); render(); return; }
  if (b.dataset.day){ selDay = parseYmd(b.dataset.day); render(); return; }
  if (id==='add-this-day'){ draft = newDraft(selDay); draft.repeat=false; view='add'; render(); return; }
  // 新增表單
  if (b.dataset.type){ draft.type = b.dataset.type; render(); return; }
  if (id==='rep-yes'||id==='rep-no'){ draft.repeat = id==='rep-yes'; render(); return; }
  if (b.dataset.wd){ draft.weekday = +b.dataset.wd; render(); return; }
  if (id==='h-minus'||id==='h-plus'){
    let mins = draft.hour*60+draft.min + (id==='h-plus'?30:-30); mins = Math.max(300, Math.min(1350, mins));
    draft.hour = Math.floor(mins/60); draft.min = mins%60; $('#f-time').textContent = timeLabel(draft.hour, draft.min); return;
  }
  if (id==='save'){
    if (!draft.type){ toast('請先選「是什麼活動」'); return; }
    if (draft.type==='other' && !draft.title.trim()){ toast('請填寫活動名稱'); return; }
    const old = draft.editId ? S.events.find(x=>x.id===draft.editId) : null;
    const e = {id: old ? old.id : Date.now(), type:draft.type, title:draft.type==='other'?draft.title.trim():'', repeat:draft.repeat, time:pad(draft.hour)+':'+pad(draft.min), place:draft.place.trim()};
    if (draft.repeat){ e.weekday = draft.weekday; if (old && old.repeat && old.weekday===e.weekday && old.skip) e.skip = old.skip; }
    else e.date = draft.date;
    if (old) S.events = S.events.map(x => x.id===old.id ? e : x); else S.events.push(e);
    save();
    const when = draft.repeat ? '每週'+WD[draft.weekday] : draft.date.slice(5).replace('-','/');
    view='week'; weekOffset=0; draft=null; render(); toast(`${old?'已修改':'已加入'}：${when} ${titleOf(e)}`); return;
  }
  if (id==='edit-cancel'){ draft=null; view='week'; render(); return; }
  // 活動詳細
  if (b.dataset.ev){
    const e = S.events.find(x=>x.id==b.dataset.ev); if (!e) return;
    const dd = parseYmd(b.dataset.date);
    const say = (e.repeat?'每週'+WD[e.weekday]:'週'+WD[dd.getDay()])+'，'+fmtTime(e.time)+'，'+titleOf(e)+(e.place?'，在'+e.place:'');
    const skipped = isSkipped(e, dd), past = dd < TODAY, nx = e.repeat ? nextOccurrence(e) : null;
    const thisDay = `${dd.getMonth()+1}/${dd.getDate()}（週${WD[dd.getDay()]}）`;
    sheet(`<h3>${TYPES[e.type].icon} ${esc(titleOf(e))}</h3>
      <p class="sub">${e.repeat?'每週'+WD[e.weekday]:(dd.getMonth()+1)+' 月 '+dd.getDate()+' 日（週'+WD[dd.getDay()]+'）'}　${fmtTime(e.time)}${nx?`<br>下一次：${nx.getMonth()+1}/${nx.getDate()}（週${WD[nx.getDay()]}）`:''}</p>
      ${e.place?`<div class="todaycard" style="margin-bottom:12px">📍 ${esc(e.place)}</div>`:''}
      ${skipped ? `<div class="confirm" style="margin-bottom:10px"><p>${thisDay}這次不去</p><button class="secondary" id="unskip" data-id="${e.id}" data-date="${b.dataset.date}">恢復，這次要去</button></div>`
        : `<button class="primary line" id="share-one" data-id="${e.id}" data-date="${b.dataset.date}" style="margin-bottom:10px">📤 分享給朋友，約一起去</button>`}
      <div class="btnrow two" style="margin:0 0 10px">
        <button class="secondary" id="edit-one" data-id="${e.id}" data-date="${b.dataset.date}">✏️ 修改</button>
        ${e.repeat && !skipped && !past && !isDoneToday(e, dd) ? `<button class="secondary" id="skip-one" data-id="${e.id}" data-date="${b.dataset.date}">🚫 ${thisDay}不去</button>` : ''}
      </div>
      <div id="del-area"><button class="secondary" id="del-ask" data-id="${e.id}">刪除這個活動</button></div>
      <div class="btnrow">${canSpeak?`<button class="secondary" id="speak-one" data-say="${esc(say)}">🔊 唸給我聽</button>`:''}<button class="primary" id="sheet-close">關閉</button></div>`);
    return;
  }
  if (id==='edit-one'){ const e=S.events.find(x=>x.id==b.dataset.id); if (!e) return; draft = draftFrom(e, parseYmd(b.dataset.date)); closeSheet(); view='add'; render(); return; }
  if (id==='skip-one'){ const e=S.events.find(x=>x.id==b.dataset.id); if (!e) return;
    // 只保留今天以後的取消紀錄，避免越存越多
    e.skip = (e.skip||[]).filter(s => s >= ymd(TODAY)).concat(b.dataset.date); S.sample=false; save(); closeSheet(); render();
    toast(`${b.dataset.date.slice(5).replace('-','/')} ${titleOf(e)}：這次不去`); return; }
  if (id==='unskip'){ const e=S.events.find(x=>x.id==b.dataset.id); if (!e) return; e.skip=(e.skip||[]).filter(s=>s!==b.dataset.date); save(); closeSheet(); render(); toast('已恢復，這次要去'); return; }
  if (id==='del-ask'){ $('#del-area').innerHTML = `<div class="confirm"><p>確定要刪除嗎？${S.events.find(x=>x.id==b.dataset.id)?.repeat?'每週的這個活動都會一起刪掉。':''}</p><div class="choices w2"><button class="choice" id="sheet-close">不要刪</button><button class="choice" id="del-yes" data-id="${b.dataset.id}" style="background:var(--red);color:var(--on-color);border-color:var(--red)">確定刪除</button></div></div>`; return; }
  if (id==='del-yes'){
    const idx = S.events.findIndex(x=>x.id==b.dataset.id); if (idx<0) return;
    const [gone] = S.events.splice(idx,1); const wasSample = S.sample; S.sample=false; save(); closeSheet(); render();
    toast(`已刪除「${titleOf(gone)}」`, '復原', () => { S.events.splice(idx,0,gone); S.sample=wasSample; save(); render(); toast('已復原'); });
    return; }
  if (id==='toast-act'){ const fn = toastAction; toastAction = null; $('#toast-host').replaceChildren(); if (fn) fn(); return; }
  if (id==='sheet-close'){ closeSheet(); return; }
  // 分享
  if (id==='share-week'){ shareSheet(weekShareText(weekOffset)); return; }
  if (id==='share-one'){ const e=S.events.find(x=>x.id==b.dataset.id); shareSheet(eventShareText(e, parseYmd(b.dataset.date))); return; }
  if (id==='share-other'){ navigator.share({text:$('#share-text').textContent}).catch(()=>{}); return; }
  if (id==='copy-share'){ const txt=$('#share-text').textContent;
    const fallback=()=>{ const r=document.createRange(); r.selectNodeContents($('#share-text')); const s=getSelection(); s.removeAllRanges(); s.addRange(r); toast('已選取文字，請長按複製'); };
    try { navigator.clipboard.writeText(txt).then(()=>toast('已複製！打開 LINE 貼上就可以'), fallback); } catch(err){ fallback(); } return; }
  if (id==='speak-week'){ speak(speechText); return; }
  if (id==='speak-one'){ speak(b.dataset.say); return; }
  // 安裝
  if (id==='install'){ doInstall(); return; }
  if (id==='install-later'){ store(INSTALL_KEY, true); render(); return; }
  // 範例資料
  if (id==='keep-sample'){ S.sample=false; save(); render(); return; }
  if (id==='clear-ask'){ confirmSheet('清空所有行程？', '所有活動都會刪掉，刪掉後不能復原。', 'clear-yes', '確定清空'); return; }
  if (id==='clear-yes'){ S.events=[]; S.sample=false; save(); closeSheet(); view='week'; render(); toast('已清空，按「新增」記下第一個活動'); return; }
  if (id==='reset-ask'){ confirmSheet('換回範例行程？', '你現在的行程會被範例取代，不能復原。', 'reset-yes', '確定換回'); return; }
  if (id==='reset-yes'){ S.events=seed(); S.sample=true; save(); closeSheet(); view='week'; render(); toast('已換回範例行程'); return; }
  // 設定
  const map = {'s-sunday':'sunday','s-daybefore':'dayBefore','s-hour':'hourBefore','s-contrast':'highContrast'};
  if (b.dataset.fl){ S.settings.fontLevel = +b.dataset.fl; save(); render(); return; }
  if (map[id]){ S.settings[map[id]] = !S.settings[map[id]]; save(); render(); return; }
  if (b.dataset.sh){ S.settings.sundayHour = +b.dataset.sh; save(); render(); return; }
  if (id==='perm-ask'||id==='perm-go'){ askPerm(); return; }
  if (id==='perm-recheck'){ refreshPerm().then(() => { scheduleNative(); render(); toast(notifPerm==='granted' ? '提醒開好了！' : '通知還是關著的'); }); return; }
  if (id==='try-sunday'){ if (LN) testNotify('sunday'); else notify('sunday'); return; }
  if (id==='try-day'){ if (LN) testNotify('day'); else notify('day'); return; }
  // 提醒橫幅
  if (id==='bn-close'){ $('#banner').classList.remove('show'); return; }
  if (id==='bn-open'){ const bn=$('#banner'); bn.classList.remove('show');
    if (bn.dataset.kind==='sunday') showWeekPreview();
    else { selDay=parseYmd(bn.dataset.date); monthCursor=new Date(selDay.getFullYear(),selDay.getMonth(),1); view='month'; render(); }
    return; }
});
document.addEventListener('input', ev => {
  if (!draft) return;
  if (ev.target.id==='f-place') draft.place = ev.target.value;
  if (ev.target.id==='f-title') draft.title = ev.target.value;
  if (ev.target.id==='f-date' && ev.target.value) draft.date = ev.target.value;
});
document.addEventListener('keydown', e => { if (e.key==='Escape') { closeSheet(); $('#banner').classList.remove('show'); } });
// 跨日：App 放著過了午夜，回到畫面時重新整理日期
document.addEventListener('visibilitychange', () => { if (document.visibilityState==='visible'){ const n=new Date(); n.setHours(0,0,0,0); if (+n !== +TODAY) location.reload(); } });

render();
// 手機 App 版：提醒交給手機本機通知，打開時不再跳出網頁版的提醒橫幅
if (NATIVE) initNative(); else setTimeout(autoRemind, 800);

// 離線快取
if (!NATIVE && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(()=>{}); });
}
})();
