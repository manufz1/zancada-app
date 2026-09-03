/* Se actualiza a mano cada vez que se sube una versión nueva — se usa para detectar
   si hay una versión más nueva del index.html publicada y recargar sola la app. */
const APP_VERSION = '2026-09-03T05:00:00Z';
/* I18N ahora vive en /locales/*.js (cargados antes que este archivo, ver index.html) — window.I18N ya está armado para cuando llegamos acá. */
/* Cuando la app corre empaquetada nativa (Capacitor, iOS), el HTML/JS vive adentro del
   binario -- no hay un servidor propio sirviendo /api/* como pasa en la PWA web, así que
   hay que pegarle directo al dominio real. window.Capacitor lo inyecta solo el runtime
   nativo al arrancar; en el navegador/PWA no existe, y ahí seguimos usando rutas relativas
   como siempre (mismo origen, sin necesidad de CORS). Envolver cada fetch a /api/ con
   apiUrl(...) es lo único que hace falta para que el mismo app.js sirva a los dos casos. */
function apiUrl(path){
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  return native ? ('https://zancada.org' + path) : path;
}
const LANG_NAMES={es:"español",en:"English",pt:"português",fr:"français",it:"italiano",de:"Deutsch"};
const LOCALE_MAP={es:"es-AR",en:"en-US",pt:"pt-BR",fr:"fr-FR",it:"it-IT",de:"de-DE"};
function detectInitialLang(){
  const supported = ['es','en','pt','fr','it','de'];
  const nav = ((navigator.language || navigator.userLanguage || 'es')+'').slice(0,2).toLowerCase();
  return supported.includes(nav) ? nav : 'es';
}
let lang = detectInitialLang();
function t(key, vars){
  let s = (I18N[lang]&&I18N[lang][key]) || I18N.es[key] || key;
  if(vars) Object.keys(vars).forEach(k=>{ s = s.replace('{'+k+'}', vars[k]); });
  return s;
}
function applyStaticTranslations(){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{ el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>{ el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('a[href^="/privacy.html"]').forEach(el=>{ el.href = apiUrl('/privacy.html?lang=' + lang); });
  document.querySelectorAll('a[href^="/terms.html"]').forEach(el=>{ el.href = apiUrl('/terms.html?lang=' + lang); });
  document.getElementById('pauseBtn').textContent = tracker.running ? t('run_pause') : t('run_resume');
  [...document.getElementById('perfil-lang-choice').children].forEach(c=>c.classList.toggle('active', c.dataset.v===lang));
}
function setLang(code){
  lang = code; state.lang = code;
  applyStaticTranslations();
  populateOnboardDays();
  if(state.onboarded){ renderAll(); renderHistory(); renderZones(); renderPerfilDays(); persist(); }
}
document.getElementById('perfil-lang-choice').addEventListener('click', e=>{
  const c = e.target.closest('.choice'); if(!c) return;
  setLang(c.dataset.v);
});

/* ================= TEMA CLARO / OSCURO =================
   Vive en state.profile.theme ('dark' por default, o 'light') y se guarda junto
   con el resto del perfil, así que sigue al usuario entre dispositivos igual que
   el idioma o las unidades. Además se cachea en localStorage nada más que para
   poder aplicarlo antes de que la sesión termine de cargar (ver el script chiquito
   al principio del <head> de index.html) y evitar el parpadeo del tema equivocado
   al abrir la app. */
function applyTheme(theme){
  const isLight = theme === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
  try{ localStorage.setItem('zancada_theme', isLight ? 'light' : 'dark'); }catch(e){}
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if(metaTheme) metaTheme.content = isLight ? '#F7F6F2' : '#121415';
  const toggle = document.getElementById('theme-toggle');
  if(toggle) toggle.checked = isLight;
  const status = document.getElementById('theme-status');
  if(status) status.textContent = t(isLight ? 'perfil_theme_light' : 'perfil_theme_dark');
}
function handleThemeToggle(checked){
  const theme = checked ? 'light' : 'dark';
  state.profile.theme = theme;
  applyTheme(theme);
  persist();
}

/* ================= ICONS ================= */
const ICONS = {
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.45 1 1.2 1 2.1h5c0-.9.4-1.65 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  coach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5h16v11H8l-4 4v-4H4z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  faceBad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9.5"/><path d="M8.5 15.5c1-1.3 2.2-2 3.5-2s2.5.7 3.5 2"/><circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none"/></svg>',
  faceGood: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9.5"/><path d="M8 14c1.2 1.3 2.6 2 4 2s2.8-.7 4-2"/><circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1" fill="currentColor" stroke="none"/></svg>',
  faceGreat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9.5"/><path d="M7.5 13.5c1.4 2 2.9 3 4.5 3s3.1-1 4.5-3"/><path d="M7.7 9.2a2 2 0 0 1 2.6 0M13.7 9.2a2 2 0 0 1 2.6 0"/></svg>',
  shoe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 17c0-1.2.7-2.3 1.8-2.8l5-2.3c.6-.3 1.3-.3 1.9 0l2.6 1.3c1.6.8 3.4 1.2 5.2 1.2h1.5v3.6H2.5V17z"/><path d="M9.3 11.9l.9-3.4M4.3 14.2c1.3.5 2.7.8 4.1.8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12a8 8 0 1 0 3-6.3"/><path d="M4 5v4h4"/><path d="M12 8v4l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6.5 9 17.5l-5-5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.5 2 20.5h20L12 3.5z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 5 8 12 15 19"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5 4.5 6.3V11c0 5 3.2 8.6 7.5 10.2 4.3-1.6 7.5-5.2 7.5-10.2V6.3L12 3.5z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4.5s2-1.3 4.5-1.3 3.5 1.5 6 1.5 3.5-1 3.5-1v9s-1.5 1-3.5 1-3.5-1.5-6-1.5-4.5 1.3-4.5 1.3z"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><line x1="12" y1="11" x2="12" y2="16.5"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.8 21.8 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 2.5 10.5 8M15.5 2.5 13.5 8"/><circle cx="12" cy="14.5" r="6.5"/><path d="M12 11.2l1.1 2.2 2.4.35-1.75 1.7.4 2.4-2.15-1.15-2.15 1.15.4-2.4-1.75-1.7 2.4-.35z" fill="currentColor" stroke="none"/></svg>'
};

/* ================= FEEDBACK: toast / confirm / haptics ================= */
function haptic(pattern){
  // En la app nativa (Capacitor) usamos el plugin Haptics -- iOS nunca soportó la
  // Vibration API del navegador, así que sin esto no vibraba nunca ahí. El plugin
  // se registra solo como Capacitor.Plugins.Haptics apenas corre nativo, sin
  // necesitar import ni bundler (ver mobile/README para el detalle).
  try{
    const Haptics = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if(Haptics){ Haptics.impact({ style: 'MEDIUM' }); return; }
  }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
}
// Escapa texto libre (nombres, mensajes de chat, etc.) antes de insertarlo
// en el HTML. Sin esto, alguien podía poner algo como <img onerror=...> como
// nombre de perfil, de evento, o incluso como nombre de una actividad de
// Strava, y ese código se ejecutaba cada vez que se mostraba en la app.
function escapeHtml(str){
  if(str===null || str===undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function sysMsgWithIcon(icon, text){
  return `<span class="icon-sq" style="width:12px; height:12px; vertical-align:-1px; margin-right:4px;">${icon}</span>${text}`;
}
// El coach a veces usa **negrita** al estilo markdown para resaltar algo, y a veces
// arma listas con líneas que arrancan en "- ". Escapamos el texto primero (por
// seguridad) y recién ahí convertimos ambas cosas, para no abrir la puerta a que
// texto manipulado inyecte HTML.
function formatCoachText(text){
  const withBold = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = withBold.split('\n');
  const parts = [];
  let listBuf = [];
  const flushList = () => { if(listBuf.length){ parts.push('<ul class="msg-list">'+listBuf.map(li=>`<li>${li}</li>`).join('')+'</ul>'); listBuf = []; } };
  lines.forEach(line=>{
    const m = line.match(/^-\s+(.+)$/);
    if(m){ listBuf.push(m[1]); }
    else { flushList(); parts.push(line); }
  });
  flushList();
  return parts.join('\n');
}
const countUpTimers = new WeakMap();
function animateCountUp(el, target, decimals, duration){
  if(!el) return;
  decimals = decimals || 0;
  duration = duration || 650;
  const prevTimer = countUpTimers.get(el);
  if(prevTimer) cancelAnimationFrame(prevTimer);
  if(!(target > 0)){ el.textContent = (0).toFixed(decimals); return; }
  const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now-start)/duration);
    const eased = 1 - Math.pow(1-p, 3);
    el.textContent = (target*eased).toFixed(decimals);
    if(p < 1){ countUpTimers.set(el, requestAnimationFrame(tick)); }
    else { el.textContent = target.toFixed(decimals); countUpTimers.delete(el); }
  }
  countUpTimers.set(el, requestAnimationFrame(tick));
}
let toastHideTimer = null;
function showToast(message, type){
  type = type || 'info';
  let wrap = document.getElementById('toast-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap'; wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const icon = type==='error' ? ICONS.warn : type==='success' ? ICONS.check : '';
  // escapeHtml() acá porque el mensaje puede traer texto libre del usuario
  // interpolado (por ejemplo el nombre de una zapatilla, vía
  // t('shoe_wear_alert_msg', {name:...})). Ningún llamado a showToast()
  // necesita insertar HTML de verdad, así que escapar siempre acá adentro
  // es más seguro que confiar en que cada call-site se acuerde de escapar
  // los datos del usuario que le pasa.
  wrap.innerHTML = `<div class="toast ${type}" id="toast-el">${icon?`<span class="icon-sq" style="width:16px; height:16px; flex-shrink:0;">${icon}</span>`:''}<span>${escapeHtml(message)}</span></div>`;
  const el = document.getElementById('toast-el');
  requestAnimationFrame(()=>el.classList.add('show'));
  if(type==='error') haptic(35);
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(()=>{
    el.classList.remove('show');
    setTimeout(()=>{ if(wrap) wrap.innerHTML = ''; }, 250);
  }, 3200);
}
function showConfirm(message, opts){
  opts = opts || {};
  return new Promise(resolve=>{
    let backdrop = document.getElementById('confirm-backdrop');
    if(!backdrop){
      backdrop = document.createElement('div');
      backdrop.id = 'confirm-backdrop'; backdrop.className = 'confirm-backdrop';
      document.body.appendChild(backdrop);
    }
    const confirmText = opts.confirmText || t('confirm_yes');
    const cancelText = opts.cancelText || t('cancel_word');
    const danger = !!opts.danger;
    backdrop.innerHTML = `<div class="confirm-card"><p>${message}</p><div class="confirm-actions">
      <button class="btn btn-outline" id="confirm-cancel-btn">${cancelText}</button>
      <button class="btn ${danger?'btn-danger':'btn-primary'}" id="confirm-ok-btn">${confirmText}</button>
    </div></div>`;
    backdrop.classList.add('show');
    haptic(15);
    const cleanup = (result)=>{
      backdrop.classList.remove('show');
      setTimeout(()=>{ if(backdrop) backdrop.innerHTML = ''; }, 180);
      resolve(result);
    };
    document.getElementById('confirm-cancel-btn').onclick = ()=>cleanup(false);
    document.getElementById('confirm-ok-btn').onclick = ()=>{ haptic(20); cleanup(true); };
    backdrop.onclick = (e)=>{ if(e.target===backdrop) cleanup(false); };
  });
}

/* ================= STATE ================= */
let state = {onboarded:false, profile:{}, plan:[], runs:[], shoes:[], event:null, chat:[], lang:lang, painLog:[], readinessLog:[]};
let pendingEmail = '';
let currentUserId = null;
/* ---- pantalla de "confirmá tu mail", con reintento automático de login mientras se espera ---- */
let confirmEmailAddr = '';
let confirmEmailPw = '';
let confirmEmailPollTimer = null;
let confirmEmailResendCooldown = false;
const DAY_KEYS = ['mon','tue','wed','thu','fri','sat','sun'];
const ZONE_COLORS = {1:'#5B9BFF',2:'#4ADE80',3:'#FACC15',4:'#FB923C',5:'#FF6B5D'};
const MI_PER_KM = 0.621371, KM_PER_MI = 1.609344;
function isImperial(){ return state.profile && state.profile.units === 'imperial'; }
function distUnit(){ return isImperial() ? 'mi' : 'km'; }
function fmtDist(km, decimals=2){
  const val = isImperial() ? km * MI_PER_KM : km;
  return val.toFixed(decimals);
}
function fmtPace(minPerKm){
  if(!minPerKm || minPerKm<=0) return '—';
  const val = isImperial() ? minPerKm * KM_PER_MI : minPerKm;
  return `${Math.floor(val)}:${String(Math.round((val%1)*60)).padStart(2,'0')}`;
}

/* ---- Supabase: cuentas y datos reales, sincronizados entre dispositivos ---- */
const SUPABASE_URL = 'https://smcicgaraqlvalxvdriz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__JlJqs3dTRRxBcR0QhkUpA_sSPPOW6j';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---- Notificaciones push ---- */
const VAPID_PUBLIC_KEY = 'BLBsiej6FgDHLt2S5DvrDfYU9_jf1_qfIzRswRgjcvLvMTPT1lDnVo9NUu8lRfYSVobM_zI80R9KWDbfb-tZXfU';
// El service worker es para la PWA web (offline + detectar versión nueva). Adentro del
// wrapper nativo (Capacitor) no tiene sentido -- ahí las actualizaciones llegan por la
// tienda, no por la red, y registrar un SW sobre los archivos empaquetados solo suma
// riesgo de comportamiento raro de caché sin ningún beneficio real.
if('serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())){
  navigator.serviceWorker.register('/sw.js').catch(e=>console.error('SW registration failed', e));
}
function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for(let i=0; i<rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
async function updatePushStatusDisplay(){
  const el = document.getElementById('push-status');
  const toggle = document.getElementById('push-toggle');
  if(!el) return;
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){ el.textContent = t('push_not_supported'); if(toggle) toggle.disabled = true; return; }
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    el.textContent = sub ? t('push_enabled') : t('push_disabled');
    if(toggle) toggle.checked = !!sub;
  }catch(e){ el.textContent = t('push_disabled'); if(toggle) toggle.checked = false; }
}
async function handlePushToggle(checked){
  if(checked) await enablePushNotifications();
  else await disablePushNotifications();
}
async function enablePushNotifications(){
  try{
    if(!('serviceWorker' in navigator) || !('PushManager' in window)){ showToast(t('push_not_supported'),'error'); await updatePushStatusDisplay(); return; }
    if(Notification.permission === 'default'){
      const proceed = await showConfirm(t('push_soft_ask'), { confirmText: t('push_soft_ask_confirm'), cancelText: t('push_soft_ask_cancel') });
      if(!proceed){ await updatePushStatusDisplay(); return; }
    }
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if(permission !== 'granted'){ showToast(t('push_denied'),'error'); await updatePushStatusDisplay(); return; }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    await supabaseClient.from('push_subscriptions').upsert({ user_id: currentUserId, subscription: sub.toJSON() });
    await updatePushStatusDisplay();
  }catch(e){ console.error(e); showToast(t('push_error'),'error'); await updatePushStatusDisplay(); }
}
async function disablePushNotifications(){
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if(sub) await sub.unsubscribe();
    if(currentUserId) await supabaseClient.from('push_subscriptions').delete().eq('user_id', currentUserId);
    await updatePushStatusDisplay();
  }catch(e){ console.error(e); }
}

/* ---- Respaldo local (para no perder una carrera si se guarda sin conexión) ---- */
function pendingBackupKey(uid){ return 'zancada_pending_'+uid; }
function savePendingBackup(){
  if(!currentUserId) return;
  try{ localStorage.setItem(pendingBackupKey(currentUserId), JSON.stringify({data:state, ts:Date.now()})); }catch(e){}
}
function clearPendingBackup(){
  if(!currentUserId) return;
  try{ localStorage.removeItem(pendingBackupKey(currentUserId)); }catch(e){}
}
function readPendingBackup(uid){
  try{ const raw = localStorage.getItem(pendingBackupKey(uid)); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
function hasPendingBackup(){
  if(!currentUserId) return false;
  return !!readPendingBackup(currentUserId);
}
function updateSyncBadge(){
  const badge = document.getElementById('sync-pending-badge');
  if(!badge) return;
  if(hasPendingBackup()){ badge.style.display = 'inline-flex'; }
  else { badge.style.display = 'none'; }
}
let loadedStateVersion = null;
async function persist(){
  if(!currentUserId) return;
  try{
    const nowIso = new Date().toISOString();
    await supabaseClient.from('app_state').upsert({ user_id: currentUserId, data: state, updated_at: nowIso });
    loadedStateVersion = nowIso; // este guardado ya es la versión más nueva que conocemos
    clearPendingBackup();
  }catch(e){
    console.error('persist error', e);
    savePendingBackup(); // sin conexión: lo guardamos en el teléfono y reintentamos más tarde
  }
  updateSyncBadge();
}
/* ---- aviso de conflicto entre dispositivos -----
   Antes, el "último que guarda gana" a ciegas: si abrís la app en el celu y la tablet
   casi al mismo tiempo, el segundo guardado pisaba al primero sin avisar nada, aunque
   tuviera cambios reales adentro (una carrera cargada, una molestia, lo que sea).
   Esto no arma un merge real (sería un cambio mucho más grande) pero al menos detecta
   la situación y le avisa al corredor ANTES de que pierda algo, dándole la opción de
   recargar los datos más nuevos en vez de seguir de largo con lo que tiene en pantalla. */
let checkingRemoteConflict = false;
async function checkForRemoteConflict(){
  if(!currentUserId || checkingRemoteConflict || document.visibilityState !== 'visible') return;
  checkingRemoteConflict = true;
  try{
    const { data, error } = await supabaseClient.from('app_state').select('updated_at').eq('user_id', currentUserId).maybeSingle();
    if(error || !data || !data.updated_at) return;
    if(loadedStateVersion && new Date(data.updated_at).getTime() > new Date(loadedStateVersion).getTime()){
      const reload = await showConfirm(t('sync_conflict_text'), {confirmText:t('sync_conflict_reload'), cancelText:t('sync_conflict_dismiss')});
      if(reload){ location.reload(); return; }
      // si el corredor prefiere seguir acá, no le repetimos el mismo aviso mil veces --
      // adoptamos la versión remota como "conocida" para no comparar contra algo viejo,
      // aunque el contenido en pantalla siga siendo el local hasta que guarde de nuevo.
      loadedStateVersion = data.updated_at;
    }
  }catch(e){ console.error('conflict check error', e); }
  finally{ checkingRemoteConflict = false; }
}
if(typeof document !== 'undefined'){
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') checkForRemoteConflict(); });
  window.addEventListener('focus', checkForRemoteConflict);
}
function flushPendingBackup(){
  if(!currentUserId || (typeof navigator!=='undefined' && navigator.onLine===false)) return;
  if(hasPendingBackup()) persist();
}
if(typeof window !== 'undefined'){
  window.addEventListener('online', flushPendingBackup);
  setInterval(flushPendingBackup, 25000);
}
/* ---- offline banner ---- */
function updateOfflineBanner(){
  const el = document.getElementById('offline-banner');
  if(!el) return;
  el.classList.toggle('show', typeof navigator!=='undefined' && navigator.onLine===false);
}
if(typeof window !== 'undefined'){
  window.addEventListener('online', updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);
  document.addEventListener('DOMContentLoaded', updateOfflineBanner);
}
async function loadUserAndEnter(user, isRetry){
  currentUserId = user.id;
  try{
    const { data, error } = await supabaseClient.from('app_state').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if(error) throw error;
    if(data && data.data && Object.keys(data.data).length){
      state = data.data; lang = state.lang || 'es';
      loadedStateVersion = data.updated_at || null;
      const pending = readPendingBackup(user.id);
      if(pending && pending.data && (pending.data.runs||[]).length > (state.runs||[]).length){
        // había una carrera guardada en el teléfono que no llegó a subirse la última vez -> la recuperamos
        state = pending.data; lang = state.lang || lang;
        persist();
      }
      // Al mantener profile.tz al día en cada apertura (no solo en el onboarding)
      // cubrimos tanto a corredores que ya venían usando la app antes de que
      // existiera este campo (lo tienen undefined) como a alguien que viaja y abre
      // la app desde otro huso horario -- así el recordatorio diario del servidor
      // siempre le llega a la hora local de donde esté HOY, no de donde se registró.
      const deviceTz = detectDeviceTz();
      if(deviceTz && state.profile && state.profile.tz !== deviceTz){
        state.profile.tz = deviceTz;
        persist();
      }
      if(!state.chat || !state.chat.length) seedCoachGreeting(); else renderChat();
      enterApp();
      return;
    }
    // la consulta funcionó y confirmó que no hay datos guardados -> recién registrado, onboarding real
    pendingEmail = user.email;
    document.getElementById('splash').style.display='none';
    document.getElementById('login').style.display='none';
    document.getElementById('onboard').style.display='block';
    resetOnboardSteps();
  }catch(e){
    console.error('load error', e);
    // OJO: nunca caemos al onboarding por un error de red/consulta — si lo hiciéramos, un usuario
    // con historial real podría terminar viendo la pantalla de "usuario nuevo" y, al completarla,
    // pisar sus datos guardados. Reintentamos una vez y, si sigue fallando, mostramos un error real.
    if(!isRetry){ setTimeout(()=>loadUserAndEnter(user, true), 1500); return; }
    const retry = await showConfirm(t('load_error_text'), {confirmText:t('load_error_retry'), cancelText:t('perfil_logout')});
    if(retry) loadUserAndEnter(user);
    else { await supabaseClient.auth.signOut(); location.reload(); }
  }
}
function translateAuthError(error){
  const msg = (error && error.message) || '';
  if(msg.includes('Invalid login')) return t('login_err_wrong_password');
  if(msg.includes('already registered') || msg.includes('User already registered')) return t('login_err_exists');
  if(msg.includes('Password should be')) return t('login_err_password');
  return msg || t('login_err');
}
function togglePasswordVisibility(inputId, btn){
  const input = document.getElementById(inputId);
  if(!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.innerHTML = `<span class="icon-sq" style="width:18px; height:18px;">${showing ? ICONS.eye : ICONS.eyeOff}</span>`;
  btn.setAttribute('aria-label', t(showing ? 'aria_show_password' : 'aria_hide_password'));
}
function setBtnBusy(btnId, busy, loadingLabel){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  if(busy){
    if(btn.disabled) return;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = '.65';
    btn.innerHTML = `<span class="icon-sq spin-icon" style="width:14px; height:14px; margin-right:6px; vertical-align:-2px;">${ICONS.refresh}</span>${loadingLabel}`;
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    if(btn.dataset.originalHtml){ btn.innerHTML = btn.dataset.originalHtml; delete btn.dataset.originalHtml; }
  }
}

/* ================= LOGIN / ONBOARD ================= */
function goLogin(){ document.getElementById('splash').style.display='none'; document.getElementById('login').style.display='block'; }
function goSignup(){ document.getElementById('login').style.display='none'; document.getElementById('signup').style.display='block'; }
function goBackToLogin(){ document.getElementById('signup').style.display='none'; document.getElementById('login').style.display='block'; }
function goToLoginFromSignup(){
  // Le pasamos el email ya tipeado a la pantalla de login para que no tenga que
  // volver a escribirlo -- viene del cartel de "ya existe una cuenta con ese email".
  document.getElementById('login-email').value = document.getElementById('signup-email').value;
  goBackToLogin();
}
async function handleGoogleSignIn(btnId){
  setBtnBusy(btnId, true, t('google_loading'));
  try{
    const { error } = await supabaseClient.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin } });
    if(error){ console.error(error); showToast(t('login_err'),'error'); }
  }finally{ setBtnBusy(btnId, false); }
}
// "Sign in with Apple" -- solo se usa en la app nativa de iOS (ver toggle de visibilidad
// de los botones en init(), más abajo). Usa el plugin @capawesome/capacitor-apple-sign-in,
// que se registra solo como Capacitor.Plugins.AppleSignIn apenas corre nativo, sin
// necesitar import ni bundler (mismo patrón que haptic() más arriba). TODO: falta probar
// este flujo en un dispositivo real una vez armado el proyecto Xcode -- ver mobile/README.md.
async function handleAppleSignIn(btnId){
  setBtnBusy(btnId, true, t('google_loading'));
  try{
    const AppleSignIn = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppleSignIn;
    if(!AppleSignIn){ showToast(t('login_err'),'error'); return; }
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const result = await AppleSignIn.signIn({ scopes: ['email', 'fullName'], nonce });
    const idToken = result && result.idToken;
    if(!idToken) throw new Error('Apple sign-in: no idToken en la respuesta');
    const { error } = await supabaseClient.auth.signInWithIdToken({ provider:'apple', token: idToken, nonce });
    if(error){ console.error(error); showToast(t('login_err'),'error'); }
  }catch(e){
    console.error(e);
    showToast(t('login_err'),'error');
  }finally{ setBtnBusy(btnId, false); }
}

/* ---- Strava ---- */
const STRAVA_CLIENT_ID = '275082';
async function connectStrava(){
  // Pedimos un "state" firmado por el backend antes de mandar al usuario a
  // Strava, en vez de mandar el user_id suelto — así el callback puede
  // verificar que la conexión realmente corresponde a quien inició sesión,
  // y no a un link armado a mano con el user_id de otra persona.
  try{
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(!session){ showToast(t('strava_connect_error'),'error'); return; }
    const res = await fetch(apiUrl('/api/strava-init'), {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}`}
    });
    if(!res.ok) throw new Error('strava-init failed');
    const { state } = await res.json();
    const redirectUri = `${window.location.origin}/api/strava-auth`;
    const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=activity:read_all&state=${encodeURIComponent(state)}&approval_prompt=force`;
    window.location.href = url;
  }catch(e){
    console.error(e);
    showToast(t('strava_connect_error'),'error');
  }
}
async function updateStravaStatusDisplay(){
  const el = document.getElementById('strava-status');
  const btn = document.getElementById('strava-connect-btn');
  if(!el || !currentUserId) return;
  try{
    const { data } = await supabaseClient.from('strava_connections').select('athlete_id').eq('user_id', currentUserId).maybeSingle();
    if(data){
      el.textContent = t('perfil_strava_connected'); el.className = 'tag tag-mixto';
      if(btn){ btn.textContent = t('perfil_strava_disconnect'); btn.onclick = disconnectStrava; }
    } else {
      el.textContent = t('perfil_native'); el.className = 'tag tag-soon';
      if(btn){ btn.textContent = t('perfil_strava_connect'); btn.onclick = connectStrava; }
    }
  }catch(e){}
}
async function disconnectStrava(){
  if(!currentUserId) return;
  try{
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(session){
      // le pedimos al backend que revoque el permiso del lado de Strava, no solo
      // que borre la conexión de nuestra base (si esto falla, borramos igual la
      // fila local desde acá para no dejar al usuario con el botón trabado).
      const res = await fetch(apiUrl('/api/strava-disconnect'), {
        method:'POST',
        headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}`}
      });
      if(!res.ok) throw new Error('strava-disconnect failed');
    } else {
      await supabaseClient.from('strava_connections').delete().eq('user_id', currentUserId);
    }
  }catch(e){
    console.error(e);
    try{ await supabaseClient.from('strava_connections').delete().eq('user_id', currentUserId); }catch(e2){}
  }
  // El backend ya borró las carreras importadas de Strava de app_state.data.runs --
  // pero acá en memoria seguían estando. Si no las sacamos también de state.runs,
  // el próximo persist() (por cualquier otra acción del usuario) las manda de
  // vuelta al servidor y deshace el borrado. Recalculamos el km de las zapatillas
  // igual que hace el backend, sumando solo las carreras que quedan.
  if(state.runs && state.runs.some(r=>r.source==='strava')){
    state.runs = state.runs.filter(r=>r.source!=='strava');
    if(state.shoes){
      state.shoes.forEach(shoe=>{
        shoe.km = state.runs.filter(r=>String(r.shoeId)===String(shoe.id)).reduce((a,r)=>a+(r.distanceKm||0),0);
      });
    }
    renderHistory(); renderHome(); renderPerfil(); persist();
  }
  await updateStravaStatusDisplay();
}
async function handleSignIn(){
  if(document.getElementById('login-submit-btn')?.disabled) return;
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-err');
  err.style.display='none';
  if(!email || !email.includes('@')){ err.textContent = t('login_err'); err.style.display='block'; return; }
  if(!password){ err.textContent = t('login_err_password'); err.style.display='block'; return; }
  setBtnBusy('login-submit-btn', true, t('login_loading'));
  try{
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error){ err.textContent = translateAuthError(error); err.style.display='block'; return; }
    await loadUserAndEnter(data.user);
  }finally{ setBtnBusy('login-submit-btn', false); }
}
async function handleSignUp(){
  if(document.getElementById('signup-submit-btn')?.disabled) return;
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const err = document.getElementById('signup-err');
  err.style.display='none';
  if(!email || !email.includes('@')){ err.textContent = t('login_err'); err.style.display='block'; return; }
  if(!password || password.length < 6){ err.textContent = t('login_err_password'); err.style.display='block'; return; }
  setBtnBusy('signup-submit-btn', true, t('signup_loading'));
  try{
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if(error){ err.textContent = translateAuthError(error); err.style.display='block'; return; }
    // Supabase, por diseño, no devuelve un error cuando el email ya tiene una cuenta
    // confirmada -- para no dejar que cualquiera use el formulario de registro para
    // "probar" qué emails existen (email enumeration), responde como si el alta
    // hubiera sido exitosa y necesitara confirmación, sin mandar ningún mail real.
    // Lo detectamos igual revisando identities: viene vacío solo en este caso puntual
    // (cuenta ya existente Y ya confirmada); para una cuenta recién creada, o una
    // todavía sin confirmar, identities trae al menos un elemento.
    if(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0){
      err.innerHTML = `${t('login_err_exists')} <button type="button" class="small-link" style="padding:0; font-size:inherit; vertical-align:baseline;" onclick="goToLoginFromSignup()">${t('login_go_signin_short')}</button>`;
      err.style.display='block'; return;
    }
    if(!data.session){ showConfirmEmailScreen(email, password); return; }
    pendingEmail = email;
    currentUserId = data.user.id;
    document.getElementById('signup').style.display='none';
    document.getElementById('onboard').style.display='block';
    resetOnboardSteps();
  }finally{ setBtnBusy('signup-submit-btn', false); }
}
function showConfirmEmailScreen(email, password){
  confirmEmailAddr = email;
  confirmEmailPw = password;
  document.getElementById('signup').style.display = 'none';
  document.getElementById('confirm-email').style.display = 'block';
  // Resaltamos el email en negrita/color dentro de la frase, en vez de mostrarlo como texto plano.
  // Escapamos el email vía textContent->innerHTML (truco seguro) por si contuviera caracteres especiales.
  const marker = '';
  const escapeHtml = (str)=>{ const d = document.createElement('span'); d.textContent = str; return d.innerHTML; };
  const template = t('confirm_email_lead', {email: marker});
  document.getElementById('confirm-email-lead').innerHTML = template.split(marker)
    .map(escapeHtml)
    .join(`<strong>${escapeHtml(email)}</strong>`);
  startConfirmEmailPolling();
}
function stopConfirmEmailPolling(){
  if(confirmEmailPollTimer){ clearInterval(confirmEmailPollTimer); confirmEmailPollTimer = null; }
}
function startConfirmEmailPolling(){
  stopConfirmEmailPolling();
  /* Mientras el usuario tiene esta pantalla abierta, probamos loguearlo cada pocos segundos.
     El login solo va a funcionar una vez que confirme el mail (Supabase rechaza el login con
     "Email not confirmed" hasta ese momento) — así detectamos la confirmación sin importar si
     abrió el link de otra pestaña, del celular, o de otra compu, sin depender de que el link de
     confirmación vuelva a esta misma pestaña. */
  confirmEmailPollTimer = setInterval(async ()=>{
    if(document.visibilityState !== 'visible') return;
    try{
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email: confirmEmailAddr, password: confirmEmailPw });
      if(!error && data.session){
        stopConfirmEmailPolling();
        const user = data.user;
        confirmEmailPw = '';
        document.getElementById('confirm-email').style.display = 'none';
        await loadUserAndEnter(user);
      }
    }catch(e){ /* todavía no confirmó, seguimos esperando */ }
  }, 4000);
}
function goBackFromConfirmEmail(){
  stopConfirmEmailPolling();
  confirmEmailPw = '';
  document.getElementById('confirm-email').style.display = 'none';
  document.getElementById('signup').style.display = 'block';
}
async function handleResendConfirmation(){
  if(confirmEmailResendCooldown) return;
  confirmEmailResendCooldown = true;
  setBtnBusy('confirm-email-resend-btn', true, t('signup_loading'));
  try{
    const { error } = await supabaseClient.auth.resend({ type:'signup', email: confirmEmailAddr });
    if(error){ showToast(translateAuthError(error), 'error'); return; }
    showToast(t('confirm_email_resent_toast'), 'success');
  } finally {
    setBtnBusy('confirm-email-resend-btn', false);
    setTimeout(()=>{ confirmEmailResendCooldown = false; }, 30000);
  }
}
async function handleForgotPassword(){
  if(document.getElementById('login-forgot-btn')?.disabled) return;
  const email = document.getElementById('login-email').value.trim();
  const err = document.getElementById('login-err');
  err.style.display='none';
  if(!email || !email.includes('@')){ err.textContent = t('login_err'); err.style.display='block'; return; }
  setBtnBusy('login-forgot-btn', true, t('forgot_loading'));
  try{
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
    if(error){ err.textContent = translateAuthError(error); err.style.display='block'; return; }
    err.style.color = 'var(--hivis)';
    err.textContent = t('login_recovery_sent'); err.style.display='block';
  }finally{ setBtnBusy('login-forgot-btn', false); }
}
supabaseClient.auth.onAuthStateChange((event, session)=>{
  if(event === 'PASSWORD_RECOVERY'){
    document.getElementById('splash').style.display='none';
    document.getElementById('login').style.display='none';
    document.getElementById('onboard').style.display='none';
    document.getElementById('recovery-set-password').style.display='block';
  }
});
async function submitNewPassword(){
  if(document.getElementById('recovery-submit-btn')?.disabled) return;
  const newPw = document.getElementById('recovery-new-pw').value;
  const err = document.getElementById('recovery-new-pw-err');
  err.style.display='none';
  if(!newPw || newPw.length < 6){ err.textContent = t('login_err_password'); err.style.display='block'; return; }
  setBtnBusy('recovery-submit-btn', true, t('login_loading'));
  try{
    const { error } = await supabaseClient.auth.updateUser({ password: newPw });
    if(error){ err.textContent = translateAuthError(error); err.style.display='block'; return; }
    const { data: { user } } = await supabaseClient.auth.getUser();
    document.getElementById('recovery-set-password').style.display='none';
    await loadUserAndEnter(user);
  }finally{ setBtnBusy('recovery-submit-btn', false); }
}
document.getElementById('ob-terrain').addEventListener('click', e=>{
  const c=e.target.closest('.choice'); if(!c) return;
  [...document.getElementById('ob-terrain').children].forEach(x=>x.classList.remove('active')); c.classList.add('active');
});
document.getElementById('ob-runnertype').addEventListener('click', e=>{
  const c=e.target.closest('.choice'); if(!c) return;
  [...document.getElementById('ob-runnertype').children].forEach(x=>x.classList.remove('active')); c.classList.add('active');
  const isActive = c.dataset.v==='active';
  document.getElementById('ob-currentkm-wrap').style.display = isActive?'block':'none';
  document.getElementById('ob-newrunner-note').style.display = isActive?'none':'block';
});
document.getElementById('voice-toggle').addEventListener('click', e=>{
  const c=e.target.closest('.choice'); if(!c) return;
  [...document.getElementById('voice-toggle').children].forEach(x=>x.classList.remove('active')); c.classList.add('active');
  state.voiceEnabled = c.dataset.v === 'on';
  persist();
});
document.getElementById('units-toggle').addEventListener('click', e=>{
  const c=e.target.closest('.choice'); if(!c) return;
  [...document.getElementById('units-toggle').children].forEach(x=>x.classList.remove('active')); c.classList.add('active');
  state.profile.units = c.dataset.v;
  renderAll(); renderHistory(); persist();
});
document.getElementById('ob-days').addEventListener('click', e=>{
  const c=e.target.closest('.day-pill'); if(!c) return;
  c.classList.toggle('active');
});
document.getElementById('perfil-days').addEventListener('click', e=>{
  const c=e.target.closest('.day-pill'); if(!c) return;
  c.classList.toggle('active');
});
function populateOnboardDays(){
  document.querySelectorAll('#ob-days .day-pill').forEach(el=>{ el.textContent = t('day_'+el.dataset.v).slice(0,3); });
}
function renderPerfilDays(){
  const selected = state.profile.trainingDays || [];
  document.getElementById('perfil-days').innerHTML = DAY_KEYS.map(d=>
    `<div class="day-pill${selected.includes(d)?' active':''}" data-v="${d}">${t('day_'+d).slice(0,3)}</div>`).join('');
}
function preserveLivedDays(oldPlan, newPlan){
  if(!oldPlan || !oldPlan.length) return newPlan;
  const todayIdx = (new Date().getDay()+6)%7;
  // Ojo: antes esto preservaba TODOS los días hasta hoy del plan viejo, sin
  // chequear si ese día realmente se "vivió" (hecho o salteado). Eso hacía
  // que, al cambiar los días de entrenamiento (o el evento, o el perfil),
  // un día que pasó a ser descanso en el plan nuevo se pisara con la
  // versión vieja -- que todavía tenía terreno/zona/distancia de cuando
  // era día de entrenamiento -- y apareciera con el cartel de zona
  // colgado en un día de descanso. Ahora solo preservamos los días que de
  // verdad se marcaron como hechos o salteados; el resto toma el plan
  // nuevo, que es el que refleja el cambio que acaba de hacer el usuario.
  return newPlan.map((newDay,i)=>{
    const old = oldPlan[i];
    if(i<=todayIdx && old && (old.status==='done'||old.status==='skipped')) return old;
    // Un día que ya pasó (antes de hoy) y que NO se vivió (ni se hizo ni se marcó
    // salteado todavía) no puede recibir, encima, un entrenamiento nuevo del plan
    // recién generado -- sería asignarle retroactivamente un ejercicio a un día
    // de la semana que ya terminó, lo cual no tiene sentido (reportado por el
    // usuario: "hoy miércoles, no me puede aparecer un ejercicio el martes").
    // Lo dejamos como descanso, que es lo que de hecho pasó ese día.
    if(i<todayIdx) return {day:newDay.day, typeKey:'rest', dist:0, terrain:null, zone:null, beginner:newDay.beginner};
    return newDay;
  });
}
// Un día queda "cerrado" (no editable, ni por el usuario ni por el coach en el chat)
// apenas ya pasó cronológicamente dentro de la semana actual, o ya se vivió (hecho o
// salteado) -- no tiene sentido que se le asigne ahora, retroactivamente, un
// entrenamiento distinto a un día de esta semana que ya terminó.
function isDayLocked(dayKey){
  const idx = DAY_KEYS.indexOf(dayKey);
  if(idx === -1) return false;
  const todayIdx = (new Date().getDay()+6)%7;
  if(idx < todayIdx) return true;
  const d = state.plan.find(x=>x.day===dayKey);
  return !!(d && (d.status==='done' || d.status==='skipped'));
}
function relinkTodayRun(){
  const todayIdx = (new Date().getDay()+6)%7;
  const today = state.plan[todayIdx];
  if(!today) return false;
  const alreadyLinked = today.linkedRunId && state.runs.some(r=>r.id===today.linkedRunId);
  if(alreadyLinked) return false;
  const now = new Date();
  const todayRun = (state.runs||[]).find(r=>{
    const d = new Date(r.date);
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  });
  if(todayRun){ today.status = 'done'; today.linkedRunId = todayRun.id; return true; }
  return false;
}
function saveTrainingDays(){
  const selected = [...document.querySelectorAll('#perfil-days .day-pill.active')].map(el=>el.dataset.v);
  if(selected.length===0){ showToast(t('perfil_days_empty_err'),'error'); return; }
  state.profile.trainingDays = DAY_KEYS.filter(d=>selected.includes(d));
  state.plan = preserveLivedDays(state.plan, generatePlan(state.profile, state.weekNumber||1));
  renderAll(); renderZones(); persist();
  flashSaved('save-days-btn');
}
function flashSaved(btnId){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  if(btn.dataset.flashing) return; // evita solapar si tocan varias veces seguidas
  btn.dataset.flashing = '1';
  const original = btn.innerHTML;
  btn.innerHTML = `<span class="icon-sq" style="width:14px; height:14px; margin-right:5px; vertical-align:-2px;">${ICONS.check}</span>${t('save_confirmed')}`;
  btn.classList.add('btn-saved-flash');
  setTimeout(()=>{
    btn.innerHTML = original;
    btn.classList.remove('btn-saved-flash');
    delete btn.dataset.flashing;
  }, 1400);
}
function handleGoalChange(newGoal){
  const wrap = document.getElementById('perfil-goal-km-check');
  if(newGoal !== state.profile.goal){
    wrap.style.display = 'block';
    document.getElementById('perfil-current-km-check').value = state.profile.weeklyKm || '';
  } else {
    wrap.style.display = 'none';
  }
}
/* ---- cuándo aplicar un cambio de perfil/objetivo que afecta el plan ----
   Editar datos personales o el objetivo semanal puede cambiar el plan de la semana
   ACTUAL de golpe -- lo cual no siempre es lo que el corredor quiere si, por ejemplo,
   ya viene cumpliendo los primeros días de esta semana con el plan viejo y prefiere
   arrancar el ajuste recién el lunes que viene. Por eso, en vez de regenerar el plan
   directo al guardar, primero preguntamos y dejamos el guardado pendiente de esa
   respuesta -- cada opción vive en su propia función (aplicar ahora / aplicar desde
   la semana que viene) en vez de una única función con un if genérico adentro. */
let pendingPlanChangeContext = null; // 'personal' | 'goals'
function openPlanChangeTimingModal(ctx){
  pendingPlanChangeContext = ctx;
  document.getElementById('plan-change-timing-modal').style.display = 'block';
}
function resolvePlanChangeTiming(choice){
  document.getElementById('plan-change-timing-modal').style.display = 'none';
  const ctx = pendingPlanChangeContext;
  pendingPlanChangeContext = null;
  if(ctx === 'personal'){
    if(choice === 'now') applyPersonalDataChangeNow(); else applyPersonalDataChangeNextWeek();
    finishPersonalDataSave();
  } else if(ctx === 'goals'){
    if(choice === 'now') applyGoalsChangeNow(); else applyGoalsChangeNextWeek();
    finishGoalsSave();
  }
}
// --- Datos personales: apartado "a partir de ahora" ---
function applyPersonalDataChangeNow(){
  state.plan = preserveLivedDays(state.plan, generatePlan(state.profile, state.weekNumber||1));
  state.nextWeekOverrides = {}; // el perfil cambió de base -> los cambios puntuales que hubiera para la semana que viene ya no aplican sobre el plan nuevo
}
// --- Datos personales: apartado "desde la semana que viene" ---
function applyPersonalDataChangeNextWeek(){
  // No tocamos state.plan: el plan de ESTA semana queda exactamente como estaba. Las
  // semanas futuras (getNextWeekPlan()/getWeekData() para offset>=1) ya se calculan
  // en el momento a partir de state.profile -- como el perfil ya quedó actualizado
  // arriba, esas semanas van a reflejar el cambio solas a partir del lunes que viene,
  // sin necesidad de guardar nada "pendiente" aparte.
  state.nextWeekOverrides = {}; // esos ajustes puntuales se calcularon sobre el perfil viejo -> ya no aplican
}
function finishPersonalDataSave(){
  renderAll(); renderPerfil(); persist();
  flashSaved('save-personal-btn');
}
function savePersonalData(){
  const weight = parseFloat(document.getElementById('perfil-weight').value);
  const height = parseFloat(document.getElementById('perfil-height').value);
  const terrainChoice = document.querySelector('#perfil-terrain-choice .choice.active');
  const goal = document.getElementById('perfil-goal').value;
  const raceDate = document.getElementById('perfil-racedate').value || null;
  const kmCheckWrap = document.getElementById('perfil-goal-km-check');
  const currentKmInput = document.getElementById('perfil-current-km-check');
  if(weight>0) state.profile.weight = weight;
  if(height>0) state.profile.height = height;
  if(terrainChoice) state.profile.terrain = terrainChoice.dataset.v;
  if(goal) state.profile.goal = goal;
  state.profile.raceDate = raceDate;
  if(kmCheckWrap.style.display==='block' && currentKmInput.value){
    state.profile.currentWeeklyKm = parseFloat(currentKmInput.value) || 0;
    state.profile.runnerType = 'active';
  }
  state.profile.weeklyKm = calcWeeklyKm(state.profile);
  kmCheckWrap.style.display = 'none';
  openPlanChangeTimingModal('personal');
}
// --- Objetivo/meta semanal: apartado "a partir de ahora" ---
function applyGoalsChangeNow(){
  // la meta semanal ahora es un input real del plan (acotado por seguridad en generatePlan),
  // no solo un número decorativo para la barra de progreso -- así que hay que regenerar
  // el plan de la semana y avisarle al coach para que quede todo conectado
  state.plan = preserveLivedDays(state.plan, generatePlan(state.profile, state.weekNumber||1));
  if(state.profile.weeklyGoalKm > 0){
    state.chat.push({role:'coach', text: t('coach_weekly_goal_updated', {km: state.profile.weeklyGoalKm}), ts:Date.now()});
    renderChat();
  }
}
// --- Objetivo/meta semanal: apartado "desde la semana que viene" ---
function applyGoalsChangeNextWeek(){
  // Igual que en datos personales: no tocamos el plan de esta semana, la que viene ya
  // se calcula sola con el perfil actualizado.
  if(state.profile.weeklyGoalKm > 0){
    state.chat.push({role:'coach', text: t('coach_weekly_goal_updated_next_week', {km: state.profile.weeklyGoalKm}), ts:Date.now()});
    renderChat();
  }
}
function finishGoalsSave(){
  renderAll(); persist();
  flashSaved('save-goals-btn');
}
function saveGoals(){
  const weeklyGoal = parseFloat(document.getElementById('perfil-weekly-goal').value) || 0;
  const goalNote = document.getElementById('perfil-goal-note').value.trim();
  const goalChanged = (state.profile.weeklyGoalKm||0) !== weeklyGoal;
  state.profile.weeklyGoalKm = weeklyGoal;
  state.profile.goalNote = goalNote;
  if(goalChanged){
    openPlanChangeTimingModal('goals');
  } else {
    // la meta no cambió de verdad (guardaron solo la nota, por ejemplo) -- no hay nada
    // que el timing pueda afectar, así que no tiene sentido preguntar
    finishGoalsSave();
  }
}
document.getElementById('perfil-terrain-choice').addEventListener('click', e=>{
  const c=e.target.closest('.choice'); if(!c) return;
  [...document.getElementById('perfil-terrain-choice').children].forEach(x=>x.classList.remove('active')); c.classList.add('active');
});
function ageFromBirth(dateStr){ const b=new Date(dateStr); return Math.max(10, Math.floor((Date.now()-b.getTime())/(365.25*24*3600*1000))); }
const dateBoxUpdaters = {};
function setupDateBox(inputId, textId, placeholderKey){
  const input = document.getElementById(inputId);
  const text = document.getElementById(textId);
  if(!input || !text) return;
  const update = ()=>{
    if(input.value){
      const d = new Date(input.value+'T00:00:00');
      text.textContent = d.toLocaleDateString(LOCALE_MAP[lang], {day:'numeric', month:'short', year:'numeric'});
      text.classList.remove('placeholder');
    } else {
      text.textContent = placeholderKey ? t(placeholderKey) : '';
      text.classList.add('placeholder');
    }
  };
  update();
  dateBoxUpdaters[inputId] = update;
}
let calTargetInputId = null, calViewDate = new Date(), calSelectedDate = null;
let calViewMode = 'days', calYearsRangeStart = 1995;
function openCalendar(inputId){
  calTargetInputId = inputId;
  const input = document.getElementById(inputId);
  calSelectedDate = input.value ? new Date(input.value+'T00:00:00') : null;
  calViewDate = calSelectedDate ? new Date(calSelectedDate) : new Date();
  renderCalendar();
  document.getElementById('calendar-modal').style.display = 'block';
}
function closeCalendar(){
  document.getElementById('calendar-modal').style.display = 'none';
}
function calNavigate(delta){
  /* El significado de las flechas cambia según qué grilla se esté mostrando: un mes a la
     vez en la vista de días, un año a la vez en la de meses, y un bloque de 16 años en la
     de años — así no hay que ir de a un paso para saltos grandes (ver calShowYears). */
  if(calViewMode === 'years'){ calYearsRangeStart += delta*16; renderCalYears(); return; }
  if(calViewMode === 'months'){ calViewDate.setFullYear(calViewDate.getFullYear() + delta); renderCalMonths(); return; }
  calViewDate.setMonth(calViewDate.getMonth() + delta);
  renderCalendar();
}
function calShowYears(){
  calYearsRangeStart = Math.floor(calViewDate.getFullYear() / 16) * 16;
  renderCalYears();
}
function calShowMonths(year){
  calViewDate.setFullYear(year);
  renderCalMonths();
}
function calSelectMonth(monthIndex){
  calViewDate.setMonth(monthIndex);
  renderCalendar();
}
function renderCalMonths(){
  calViewMode = 'months';
  document.getElementById('cal-grid').style.display = 'none';
  document.getElementById('cal-weekdays').style.display = 'none';
  document.getElementById('cal-years-grid').style.display = 'none';
  document.getElementById('cal-months-grid').style.display = 'grid';
  const y = calViewDate.getFullYear();
  document.getElementById('cal-month-label').textContent = y;
  const today = new Date();
  const selMonth = (calSelectedDate && calSelectedDate.getFullYear()===y) ? calSelectedDate.getMonth() : null;
  document.getElementById('cal-months-grid').innerHTML = Array.from({length:12}, (_,m)=>{
    const label = new Date(y,m,1).toLocaleDateString(LOCALE_MAP[lang], {month:'short'});
    const isCurrent = today.getFullYear()===y && today.getMonth()===m;
    const isSelected = selMonth===m;
    return `<div class="cal-cell ${isCurrent?'current':''} ${isSelected?'selected':''}" onclick="calSelectMonth(${m})">${label}</div>`;
  }).join('');
}
function renderCalYears(){
  calViewMode = 'years';
  document.getElementById('cal-grid').style.display = 'none';
  document.getElementById('cal-weekdays').style.display = 'none';
  document.getElementById('cal-months-grid').style.display = 'none';
  document.getElementById('cal-years-grid').style.display = 'grid';
  document.getElementById('cal-month-label').textContent = `${calYearsRangeStart}–${calYearsRangeStart+15}`;
  const curYear = new Date().getFullYear();
  const selYear = calSelectedDate ? calSelectedDate.getFullYear() : null;
  document.getElementById('cal-years-grid').innerHTML = Array.from({length:16}, (_,i)=>{
    const yr = calYearsRangeStart + i;
    const isCurrent = yr===curYear;
    const isSelected = yr===selYear;
    return `<div class="cal-cell ${isCurrent?'current':''} ${isSelected?'selected':''}" onclick="calShowMonths(${yr})">${yr}</div>`;
  }).join('');
}
function renderCalendar(){
  calViewMode = 'days';
  document.getElementById('cal-grid').style.display = 'grid';
  document.getElementById('cal-weekdays').style.display = 'grid';
  document.getElementById('cal-months-grid').style.display = 'none';
  document.getElementById('cal-years-grid').style.display = 'none';
  const y = calViewDate.getFullYear(), m = calViewDate.getMonth();
  document.getElementById('cal-month-label').textContent = new Date(y,m,1).toLocaleDateString(LOCALE_MAP[lang], {month:'long', year:'numeric'});

  const weekdayBase = new Date(2024,0,1); // lunes
  const weekdayLabels = [];
  for(let i=0;i<7;i++){ const d = new Date(weekdayBase); d.setDate(weekdayBase.getDate()+i); weekdayLabels.push(d.toLocaleDateString(LOCALE_MAP[lang], {weekday:'short'}).slice(0,2)); }
  document.getElementById('cal-weekdays').innerHTML = weekdayLabels.map(w=>`<div>${w}</div>`).join('');

  let startOffset = new Date(y,m,1).getDay() - 1; if(startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const selectedTime = calSelectedDate ? new Date(calSelectedDate.getFullYear(), calSelectedDate.getMonth(), calSelectedDate.getDate()).getTime() : null;

  let cells = [];
  for(let i=startOffset; i>0; i--) cells.push({day: daysInPrevMonth-i+1, other:true});
  for(let d=1; d<=daysInMonth; d++) cells.push({day:d, other:false});
  while(cells.length % 7 !== 0) cells.push({day: cells.length, other:true});

  document.getElementById('cal-grid').innerHTML = cells.map(c=>{
    if(c.other) return `<div class="cal-day other-month">${c.day}</div>`;
    const cellDate = new Date(y,m,c.day);
    const isToday = cellDate.getTime()===today.getTime();
    const isSelected = selectedTime!==null && cellDate.getTime()===selectedTime;
    return `<div class="cal-day ${isToday?'today':''} ${isSelected?'selected':''}" onclick="calSelectDay(${c.day})">${c.day}</div>`;
  }).join('');
}
function calSelectDay(day){
  const y = calViewDate.getFullYear(), m = calViewDate.getMonth();
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const input = document.getElementById(calTargetInputId);
  input.value = dateStr;
  dateBoxUpdaters[calTargetInputId] && dateBoxUpdaters[calTargetInputId]();
  closeCalendar();
}
setupDateBox('ob-birth','ob-birth-text');
setupDateBox('ob-racedate','ob-racedate-text','date_placeholder');
setupDateBox('perfil-racedate','perfil-racedate-text','date_placeholder');
setupDateBox('man-date','man-date-text');
setupDateBox('edit-run-date','edit-run-date-text');
setupDateBox('ev-date','ev-date-text','date_placeholder');
/* Fórmula de Tanaka (208 - 0.7*edad) en vez de la clásica 220-edad: la de Tanaka viene de un
   metaanálisis con miles de personas y tiene bastante menos error, sobre todo a medida que
   sube la edad -- 220-edad tiende a subestimar la FC máxima real de gente mayor. Sigue siendo
   una estimación (no reemplaza un test real), pero es la mejor estimación posible sin
   necesidad de ningún test ni equipamiento. */
function estimateHrMax(age){ return Math.round(208 - 0.7*age); }
function computeZones(hrmax){
  return {1:{min:Math.round(hrmax*0.50),max:Math.round(hrmax*0.60)},2:{min:Math.round(hrmax*0.60)+1,max:Math.round(hrmax*0.70)},
    3:{min:Math.round(hrmax*0.70)+1,max:Math.round(hrmax*0.80)},4:{min:Math.round(hrmax*0.80)+1,max:Math.round(hrmax*0.90)},
    5:{min:Math.round(hrmax*0.90)+1,max:hrmax}};
}
const OB_STEP_COUNT = 5;
let obCurrentStep = 1;
function resetOnboardSteps(){
  obCurrentStep = 1;
  obGotoStep(1);
}
function obGotoStep(n){
  obCurrentStep = n;
  document.querySelectorAll('.ob-step').forEach(el=>el.classList.toggle('active', parseInt(el.dataset.step,10)===n));
  document.getElementById('ob-progress-fill').style.width = ((n/OB_STEP_COUNT)*100)+'%';
  document.getElementById('ob-back-btn').style.display = n>1 ? 'flex' : 'none';
  document.getElementById('onboard').scrollTop = 0;
}
function obNextStep(){
  haptic(10);
  if(obCurrentStep < OB_STEP_COUNT) obGotoStep(obCurrentStep+1);
}
function obPrevStep(){
  haptic(10);
  if(obCurrentStep > 1) obGotoStep(obCurrentStep-1);
}
async function finishOnboard(){
  const name = document.getElementById('ob-name').value.trim() || 'Runner';
  const weight = parseFloat(document.getElementById('ob-weight').value) || 70;
  const height = parseFloat(document.getElementById('ob-height').value) || 170;
  const birth = document.getElementById('ob-birth').value;
  const runnerType = document.querySelector('#ob-runnertype .choice.active').dataset.v;
  const currentWeeklyKm = runnerType==='active' ? (parseFloat(document.getElementById('ob-currentkm').value) || 0) : 0;
  const terrain = document.querySelector('#ob-terrain .choice.active').dataset.v;
  const trainingDays = DAY_KEYS.filter(d => document.querySelector(`#ob-days .day-pill[data-v="${d}"]`).classList.contains('active'));
  const goal = document.getElementById('ob-goal').value;
  const raceDate = document.getElementById('ob-racedate').value || null;
  const age = ageFromBirth(birth);
  const hrMax = estimateHrMax(age);
  const hrKnown = false;

  // profile.tz guarda el huso horario del CELULAR del corredor (ej. "America/New_York"
  // para un amigo en Estados Unidos, distinto al nuestro en Argentina) -- lo usa el
  // recordatorio diario del lado del servidor (api/send-reminders.js) para mandar el
  // aviso a la hora local de cada uno, no a una sola hora fija para todo el mundo.
  // detectDeviceTz() está definida más abajo, junto al resto de fecha/hora.
  state.profile = {email:pendingEmail, name, weight, height, birth, terrain, trainingDays: trainingDays.length?trainingDays:['tue','thu','sun'], goal, raceDate, runnerType, currentWeeklyKm, hrMax, hrKnown, hrZones:computeZones(hrMax), tz:detectDeviceTz()};
  state.profile.weeklyKm = calcWeeklyKm(state.profile);
  state.weekNumber = 1;
  state.weekStart = getMondayISO(new Date());
  state.plan = generatePlan(state.profile, state.weekNumber);
  state.onboarded = true;
  state.lang = lang;
  state.voiceEnabled = true;
  state.nextWeekOverrides = {};
  document.getElementById('onboard').style.display='none';
  document.getElementById('perfil-name').value = name;
  seedCoachGreeting();
  await persist();
  enterApp();
}
function syncTabbarHeight(){
  const bar = document.getElementById('tabbar');
  if(!bar) return;
  const h = bar.offsetHeight;
  if(h>0) document.documentElement.style.setProperty('--tabbar-h', h+'px');
}
window.addEventListener('resize', syncTabbarHeight);
function enterApp(){
  applyTheme(state.profile.theme === 'light' ? 'light' : 'dark');
  document.getElementById('splash').style.display='none';
  document.getElementById('login').style.display='none';
  document.getElementById('onboard').style.display='none';
  document.getElementById('mainHeader').style.display='flex';
  document.getElementById('tabbar').style.display='flex';
  syncTabbarHeight();
  applyStaticTranslations();
  document.getElementById('perfil-name').value = state.profile.name;
  checkWeekRollover();
  autoSkipPastDays();
  autoClearPastEvent();
  repairCorruptedCustomDays();
  checkProactiveCoachNudge();
  checkPainCheckins();
  refreshEstimatedHrMax();
  checkHrMaxFromRuns();
  updateChatBadge(); // por si algún mensaje del coach se agregó recién arriba (ajuste automático, aviso proactivo) sin pasar por renderChat
  if(relinkTodayRun()) persist();
  [...document.getElementById('voice-toggle').children].forEach(c=>c.classList.toggle('active', c.dataset.v === (state.voiceEnabled===false?'off':'on')));
  [...document.getElementById('units-toggle').children].forEach(c=>c.classList.toggle('active', c.dataset.v === (state.profile.units==='imperial'?'imperial':'metric')));
  renderPerfilDays();
  renderAll(); renderHistory(); renderZones();
  showView('inicio');
  setTimeout(checkPendingRating, 600);
  setTimeout(maybeShowInstallBanner, 1200);
}
async function logout(){ await supabaseClient.auth.signOut(); location.reload(); }
async function resetApp(){
  if(!(await showConfirm(t('reset_confirm_text'), {danger:true, confirmText:t('delete_word')}))) return;
  if(currentUserId){
    try{ await supabaseClient.from('app_state').delete().eq('user_id', currentUserId); }catch(e){}
  }
  await supabaseClient.auth.signOut();
  location.reload();
}
async function deleteAccount(){
  if(!(await showConfirm(t('delete_account_confirm_text'), {danger:true, confirmText:t('delete_account_confirm_btn')}))) return;
  try{
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(!session){ showToast(t('delete_account_error'),'error'); return; }
    const res = await fetch(apiUrl('/api/delete-account'), {
      method:'POST',
      headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}`}
    });
    if(!res.ok) throw new Error('delete-account failed');
    await supabaseClient.auth.signOut();
    location.reload();
  }catch(e){
    showToast(t('delete_account_error'),'error');
  }
}
(async function init(){
  // "Sign in with Apple" solo tiene sentido en la app nativa de iOS (Apple lo exige ahí
  // porque ya ofrecemos login con Google) -- en la web/PWA y en Android el botón queda oculto.
  if(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios'){
    ['login-apple-btn','signup-apple-btn'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.style.display = '';
    });
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(session && session.user){ await loadUserAndEnter(session.user); }
})();

/* ================= PLAN GENERATION (con progresión semana a semana) ================= */
function getMondayISO(d){
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day===0 ? -6 : 1-day));
  dt.setHours(0,0,0,0);
  return dt.toISOString().slice(0,10);
}
function isCutbackWeek(n){ return n % 4 === 0; }
const GOAL_PEAK_KM = {start:18, '5k':25, '10k':35, '15k':42, '21k':50, '42k':65, ultra:75, lifestyle:15};
function calcWeeklyKm(profile){
  const peak = GOAL_PEAK_KM[profile.goal] || 20;
  if(profile.runnerType==='active' && profile.currentWeeklyKm>0){
    return Math.round(profile.currentWeeklyKm); // arranca desde su realidad actual, no de una fórmula genérica
  }
  const base = peak / 1.8; // punto de partida que, con la progresión normal, llega al pico
  if(profile.raceDate){
    const weeksLeft = Math.round((new Date(profile.raceDate) - new Date()) / (7*86400000));
    if(weeksLeft > 0 && weeksLeft < 12){
      // poco tiempo hasta la carrera: arrancar más cerca del pico, sin margen para una progresión larga
      const urgency = Math.min(1, Math.max(0, (12-weeksLeft)/12));
      return Math.round(base + (peak-base)*urgency);
    }
  }
  return Math.round(base);
}
function weekMultiplier(n, caution){
  n = n || 1;
  const growthSteps = n - Math.floor(n/4) - 1;
  // corredores con más cautela (mayor edad y/o contextura) progresan más despacio
  // semana a semana y con un techo de volumen más bajo, en vez de la misma curva para todos
  const growthRate = caution && caution.level>=2 ? 1.04 : caution && caution.level>=1 ? 1.05 : 1.06;
  const cap = caution && caution.level>=2 ? 1.5 : caution && caution.level>=1 ? 1.65 : 1.8;
  let mult = Math.pow(growthRate, Math.max(0, growthSteps));
  if(isCutbackWeek(n)) mult *= 0.75;
  return Math.min(mult, cap);
}
function taperMultiplier(p, weekStartDate){
  // baja el volumen a propósito en las semanas justo antes de una carrera (puesta a punto / taper).
  // Considera tanto la carrera objetivo del perfil (profile.raceDate) como cualquier carrera
  // cargada en "Próximos eventos" (state.event) -- la que esté más cerca es la que manda.
  if(!weekStartDate) return 1;
  const start = new Date(weekStartDate+'T00:00:00');
  if(isNaN(start.getTime())) return 1;
  const candidateDates = [];
  if(p && p.raceDate) candidateDates.push(p.raceDate);
  if(state.event && state.event.date) candidateDates.push(state.event.date);
  if(!candidateDates.length) return 1;
  let mult = 1;
  candidateDates.forEach(dateStr=>{
    const raceDate = new Date(dateStr+'T00:00:00');
    if(isNaN(raceDate.getTime())) return;
    const daysToRace = Math.round((raceDate - start) / 86400000);
    if(daysToRace < 0) return; // esa carrera ya pasó
    const weeksToRace = daysToRace / 7;
    let m = 1;
    if(weeksToRace < 1) m = 0.55;
    else if(weeksToRace < 2) m = 0.7;
    else if(weeksToRace < 3) m = 0.85;
    mult = Math.min(mult, m);
  });
  return mult;
}
function isRecoveryWeek(weekStartDate){
  // La semana de recuperación es la que arranca el lunes siguiente a una carrera cargada
  // en "Próximos eventos", pero SOLO cuando esa carrera cayó en domingo -- así nos
  // aseguramos de que sea de verdad "la semana entera después de correrla" (lunes a
  // domingo) y no una carrera entre semana, donde "la semana que sigue" ya arranca con
  // días de por medio y el criterio sería más ambiguo. Usamos state.lastEventDate además
  // de state.event.date porque autoClearPastEvent() borra state.event apenas pasó la
  // fecha -- sin este respaldo, perderíamos el dato justo cuando más lo necesitamos (el
  // lunes después de la carrera, la propia recarga de la app dispara ese borrado antes
  // de que el resto de la semana pueda seguir mostrando la recuperación).
  if(!weekStartDate) return false;
  const eventDateStr = (state.event && state.event.date) || state.lastEventDate;
  if(!eventDateStr) return false;
  const start = new Date(weekStartDate+'T00:00:00');
  const raceDate = new Date(eventDateStr+'T00:00:00');
  if(isNaN(start.getTime()) || isNaN(raceDate.getTime())) return false;
  if(raceDate.getDay() !== 0) return false; // 0 = domingo
  const daysSinceRace = Math.round((start - raceDate) / 86400000);
  return daysSinceRace === 1;
}
function recoveryMultiplier(weekStartDate){
  return isRecoveryWeek(weekStartDate) ? 0.6 : 1;
}
function eventTerrainOverride(weekStartDate){
  // El "Tipo" de carrera cargado en Próximos eventos (ruta/trail/obstáculos) no cambiaba
  // nada del plan -- era un dato puramente decorativo (solo se mostraba como tag y se
  // le pasaba de forma pasiva al chat). Ahora, en las semanas cercanas a esa carrera, el
  // rodaje largo se practica en el terreno de la carrera (no en el terreno habitual del
  // corredor), que es cuando más importa acostumbrarse a ese terreno específico.
  if(!state.event || !state.event.date || !state.event.type || !weekStartDate) return null;
  const start = new Date(weekStartDate+'T00:00:00');
  const raceDate = new Date(state.event.date+'T00:00:00');
  if(isNaN(start.getTime()) || isNaN(raceDate.getTime())) return null;
  const weeksToRace = (raceDate - start) / (7*86400000);
  if(weeksToRace < 0 || weeksToRace > 5) return null;
  const map = {ruta:'asfalto', trail:'trail', obstaculos:'mixto'};
  return map[state.event.type] || null;
}
function eventDayIndexInWeek(weekStartDate){
  // en qué posición (0=lunes...6=domingo) de la semana que arranca en weekStartDate cae la
  // fecha del evento cargado en "Próximos eventos", o -1 si esa semana no lo incluye
  if(!state.event || !state.event.date || !weekStartDate) return -1;
  const start = new Date(weekStartDate+'T00:00:00');
  if(isNaN(start.getTime())) return -1;
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(d.getDate()+i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if(iso === state.event.date) return i;
  }
  return -1;
}
function autoSkipPastDays(){
  if(!state.onboarded || !state.weekStart) return;
  const todayIdx = (new Date().getDay()+6)%7;
  let changed = false;
  state.plan.forEach((d,i)=>{
    if(i < todayIdx && d.dist>0 && !d.status){ d.status = 'skipped'; changed = true; }
  });
  if(changed) persist();
}
function autoClearPastEvent(){
  // el evento cargado en "Próximos eventos" es justamente eso, PRÓXIMO -> una vez que pasó
  // el día de la carrera, se saca solo de esa tarjeta (no tiene sentido seguir mostrando una
  // cuenta regresiva negativa de algo que ya corriste)
  if(!state.event || !state.event.date) return;
  const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
  const eventDate = new Date(state.event.date+'T00:00:00');
  if(!isNaN(eventDate.getTime()) && eventDate.getTime() < todayMidnight.getTime()){
    // Guardamos la fecha antes de borrar el evento -- isRecoveryWeek() la sigue
    // necesitando toda la semana de recuperación, después de que esta limpieza ya corrió.
    state.lastEventDate = state.event.date;
    state.event = null;
    persist();
  }
}
function repairCorruptedCustomDays(){
  if(!state.plan) return;
  let changed = false;
  state.plan.forEach(d=>{
    if(d.custom && !d.type){ d.custom = false; changed = true; }
  });
  if(changed) persist();
}
async function syncTodayNow(){
  const btn = document.getElementById('sync-today-btn');
  if(btn){ btn.disabled = true; btn.innerHTML = `<span class="icon-sq spin-icon" style="width:14px; height:14px;">${ICONS.refresh}</span> ${t('plan_syncing')}`; }
  let syncResult = null;
  try{
    const { data: { session } } = await supabaseClient.auth.getSession();
    if(session && session.access_token){
      const controller = new AbortController();
      const timeoutId = setTimeout(()=>controller.abort(), 12000);
      const res = await fetch(apiUrl('/api/strava-sync-now'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      syncResult = await res.json().catch(()=>null);
    }
  }catch(e){ console.error('sync-now error', e); syncResult = {error: e.message}; }
  await refreshStateFromServer();
  if(relinkTodayRun()) persist();
  renderPlan(); renderHome(); renderHistory();
  if(syncResult && !syncResult.synced){
    const reasonMsg = syncResult.error ? `Error: ${syncResult.error}` : syncResult.reason==='not_connected' ? 'Tu cuenta no está conectada a Strava.' : syncResult.reason==='no_new_activity' ? 'No encontramos actividades nuevas en las últimas 24 horas en tu Strava.' : 'No se encontró nada nuevo.';
    showToast(reasonMsg,'error');
  }
  if(btn){ btn.disabled = false; btn.innerHTML = `<span class="icon-sq" style="width:14px; height:14px;">${ICONS.refresh}</span> ${t('plan_sync_button')}`; }
  setTimeout(checkPendingRating, 300);
}
function computeWeekAdjustment(plan){
  // Mismo criterio de siempre (antes vivía adentro de checkWeekRollover): si calificaste mal
  // o saltaste 2+ sesiones, baja un poco el volumen; si calificaste excelente sin ningún "mal",
  // lo sube un poco. Separado en su propia función para poder usarlo también al PREVISUALIZAR
  // la semana que sigue (getNextWeekPlan), no solo en el momento exacto del cambio de semana
  // -> así lo que ves antes del lunes ya es lo que vas a tener el lunes, sin sorpresas.
  if(!plan || !plan.length) return {factor:1, note:null};
  const rated = plan.filter(d=>d.rating);
  const badCount = rated.filter(d=>d.rating==='mal').length;
  const excellentCount = rated.filter(d=>d.rating==='excelente').length;
  const skippedCount = plan.filter(d=>d.status==='skipped').length;
  if(badCount>=2 || skippedCount>=2) return {factor:0.9, note:t('coach_week_adjusted_down')};
  if(excellentCount>=3 && badCount===0 && skippedCount===0) return {factor:1.05, note:t('coach_week_adjusted_up')};
  return {factor:1, note:null};
}
function getNextWeekPlan(){
  // La semana que sigue a la actual: se calcula con el mismo ajuste automático que se aplicaría
  // si la semana actual terminara ahora mismo (según lo que ya calificaste/salteaste), y respeta
  // cualquier cambio puntual que el coach haya hecho por chat (state.nextWeekOverrides). Es una
  // función pura de estado ya guardado -> se puede llamar tantas veces como haga falta (para
  // mostrarla en Plan, dársela de contexto al coach, o promoverla al cambiar de semana) y da
  // siempre el mismo resultado mientras no cambien tus calificaciones o tu perfil.
  const wn = (state.weekNumber||1) + 1;
  const nextStart = new Date(state.weekStart || getMondayISO(new Date()));
  nextStart.setDate(nextStart.getDate() + 7);
  const nextStartIso = nextStart.toISOString().slice(0,10);
  const adj = computeWeekAdjustment(state.plan);
  const previewProfile = Object.assign({}, state.profile, {weeklyKm: Math.max(5, (state.profile.weeklyKm||0) * adj.factor)});
  const base = generatePlan(previewProfile, wn, nextStartIso);
  const overrides = state.nextWeekOverrides || {};
  const plan = base.map(d => overrides[d.day] ? Object.assign({}, d, overrides[d.day], {custom:true}) : d);
  return { plan, weekNumber: wn, weekStart: nextStartIso };
}
function buildWeeklyRecapMessage(weekPlan, weekStartIso){
  // Resumen factual de la semana que se cierra, sin juicio de valor (eso ya lo cubren
  // el ajuste automático y el aviso proactivo) -- así el corredor tiene noticias del
  // coach todas las semanas, no solo cuando algo anda mal.
  const doneCount = weekPlan.filter(d=>d.status==='done').length;
  const plannedCount = weekPlan.filter(d=>d.dist>0).length;
  const weekRuns = (state.runs||[]).filter(r => getMondayISO(new Date(r.date)) === weekStartIso);
  const km = weekRuns.reduce((s,r)=>s+r.distanceKm, 0);
  let msg = t('coach_weekly_recap', {km: km.toFixed(1), done:doneCount, planned:plannedCount});
  // Racha de constancia: cuenta semanas seguidas cumpliendo (al menos 70%) lo planeado.
  // Se corta apenas una semana no llega a ese umbral. Solo la mencionamos a partir de
  // la segunda semana seguida, para no sonar como un contador vacío en la primera.
  const metGoal = plannedCount>0 && (doneCount/plannedCount) >= 0.7;
  state.streakWeeks = metGoal ? (state.streakWeeks||0)+1 : 0;
  if(state.streakWeeks >= 2){
    msg += ' ' + t('coach_streak_line', {n: state.streakWeeks});
  }
  return msg;
}
function checkGoalUpsell(){
  // Si el objetivo es "empezar a correr desde cero" y ya lleva varias semanas seguidas
  // cumpliendo el plan (misma racha que usamos en el recap), el coach sugiere pasar a
  // un objetivo concreto -- una sola vez, no en cada rollover, para no ser repetitivo.
  // Si el corredor acepta, se lo cuenta al coach por el chat y ese flujo ya sabe
  // actualizar state.profile.goal (igual que cualquier otro cambio de objetivo hablado).
  if(state.goalUpsellShown) return null;
  if(state.profile.goal !== 'start') return null;
  if((state.streakWeeks||0) < 4) return null;
  state.goalUpsellShown = true;
  return t('coach_goal_upsell');
}
function detectTrainingGapWeeks(){
  // Hace cuántas semanas fue la última carrera REGISTRADA -- a diferencia de diffWeeks
  // (que solo mide cuánto tiempo de calendario pasó desde que se abrió la app la última
  // vez), esto mide si el corredor realmente dejó de entrenar. Alguien puede entrenar
  // puntual sin abrir la app todos los días -> eso no es una pausa real.
  if(!state.runs || !state.runs.length) return 0;
  let lastRunMs = 0;
  state.runs.forEach(r=>{ const d = new Date(r.date).getTime(); if(!isNaN(d) && d>lastRunMs) lastRunMs = d; });
  if(!lastRunMs) return 0;
  return Math.max(0, Math.floor((Date.now() - lastRunMs) / (7*86400000)));
}
function computeReturnFromBreakAdjustment(gapWeeks){
  // Volver de una pausa real (viaje, lesión, lo que sea) retomando el plan justo donde
  // había quedado significa saltar de golpe a un volumen que el cuerpo ya no sostiene.
  // Antes eso pasaba tal cual: el plan avanzaba "semanas de calendario" sin fijarse si
  // esas semanas tuvieron carreras de verdad, así que alguien que volvía después de un
  // mes sin correr se encontraba con el plan más avanzado que cuando se fue. Acá se
  // retoma más abajo y se vuelve a subir de a poco, en vez de fingir que la pausa no pasó.
  if(gapWeeks < 2) return null;
  if(gapWeeks < 4) return { gapWeeks, kmFactor: 0.8, weekNumberReset: null };
  if(gapWeeks < 7) return { gapWeeks, kmFactor: 0.65, weekNumberReset: 2 };
  return { gapWeeks, kmFactor: 0.5, weekNumberReset: 1 };
}
function checkWeekRollover(){
  if(!state.onboarded) return;
  const currentMonday = getMondayISO(new Date());
  if(state.weekStart !== currentMonday){
    if(!state.planHistory) state.planHistory = [];
    const prevMonday = new Date(state.weekStart || currentMonday);
    const diffWeeks = Math.max(1, Math.round((new Date(currentMonday) - prevMonday)/(7*86400000)));
    let adjustNote = null, recapMsg = null, goalUpsellMsg = null, breakMsg = null;
    let promotedPlan = null, promotedWeekNumber = (state.weekNumber||1) + diffWeeks, promotedWeekStart = currentMonday;
    const breakAdj = computeReturnFromBreakAdjustment(detectTrainingGapWeeks());
    if(state.weekStart && state.plan && state.plan.length){
      state.planHistory.push({weekNumber: state.weekNumber||1, weekStart: state.weekStart, plan: state.plan});
      recapMsg = buildWeeklyRecapMessage(state.plan, state.weekStart);
      goalUpsellMsg = checkGoalUpsell();
      if(diffWeeks === 1 && !breakAdj){
        // exactamente la semana que ya veníamos mostrando como "la que sigue" (con el ajuste
        // automático y los cambios del coach ya adentro) -> pasa a ser la actual tal cual
        // (si hay una pausa real detectada, esa semana "ya armada" no sirve -- se recalcula
        // desde cero más abajo, con el volumen reducido)
        const nw = getNextWeekPlan();
        promotedPlan = nw.plan; promotedWeekNumber = nw.weekNumber; promotedWeekStart = nw.weekStart;
      }
      if(breakAdj){
        state.profile.weeklyKm = Math.max(5, Math.round(state.profile.weeklyKm * breakAdj.kmFactor));
        if(breakAdj.weekNumberReset) promotedWeekNumber = breakAdj.weekNumberReset;
        breakMsg = t('coach_return_from_break', {weeks: breakAdj.gapWeeks});
      } else {
        // el ajuste semanal de siempre (sesiones salteadas/mal calificadas) solo aplica
        // cuando NO hubo una pausa real -- si la hubo, ya está cubierto (y mejor explicado)
        // por el mensaje de arriba, y aplicar los dos juntos sería redundante
        const adj = computeWeekAdjustment(state.plan);
        if(adj.factor !== 1){
          state.profile.weeklyKm = Math.max(5, Math.round(state.profile.weeklyKm*adj.factor));
          adjustNote = adj.note;
        }
      }
    }
    state.weekNumber = promotedWeekNumber;
    state.weekStart = promotedWeekStart;
    state.plan = promotedPlan || generatePlan(state.profile, state.weekNumber);
    state.nextWeekOverrides = {};
    if(recapMsg) state.chat.push({role:'coach', text: recapMsg, ts:Date.now()});
    if(breakMsg) state.chat.push({role:'coach', text: breakMsg, ts:Date.now()});
    if(adjustNote) state.chat.push({role:'coach', text: adjustNote, ts:Date.now()});
    if(goalUpsellMsg) state.chat.push({role:'coach', text: goalUpsellMsg, ts:Date.now()});
    if(recapMsg || breakMsg || adjustNote || goalUpsellMsg) renderChat();
    persist();
  }
}
function hardSessionRotation(goal, caution){
  // Antes el "día fuerte" solo alternaba entre series y ritmo medio, semana tras
  // semana, sin importar el objetivo -> con el tiempo se volvía siempre el mismo
  // entrenamiento clonado. Ahora rotamos entre varios estímulos de calidad reales,
  // con más peso en velocidad para objetivos cortos (5k/10k) y más peso en
  // resistencia a la fatiga (progresivos, cuestas) para objetivos largos.
  const shortGoal = goal==='5k' || goal==='10k';
  let rotation = shortGoal
    ? ['intervals','fartlek','tempo','hills']
    : ['tempo','hills','progression','intervals'];
  if(caution && caution.level>=2){
    // para el perfil más conservador (edad/contextura), sacamos de la rotación los
    // estímulos de más impacto (series en llano y cuestas) y dejamos solo los de
    // esfuerzo controlado, sin volver todo siempre igual
    rotation = rotation.filter(t=>t!=='intervals' && t!=='hills');
    if(!rotation.length) rotation = ['tempo'];
  }
  return rotation;
}
function checkProactiveCoachNudge(){
  // El coach antes solo hablaba si le escribías. Acá lo hacemos un poco proactivo:
  // si la semana viene con varias sesiones salteadas o calificadas "mal" ANTES de
  // que termine (no hay que esperar al ajuste automático del lunes), le manda un
  // mensaje al corredor para que no tenga que darse cuenta solo. Se avisa una sola
  // vez por semana, para no ser pesado.
  if(!state.onboarded || !state.plan || !state.plan.length) return;
  if(state.proactiveNudgeFor === state.weekStart) return;
  const rated = state.plan.filter(d=>d.rating);
  const badCount = rated.filter(d=>d.rating==='mal').length;
  const skippedCount = state.plan.filter(d=>d.status==='skipped').length;
  let key = null;
  if(skippedCount>=2) key = 'coach_nudge_skipped';
  else if(badCount>=2) key = 'coach_nudge_bad_ratings';
  if(!key) return;
  state.proactiveNudgeFor = state.weekStart;
  state.chat.push({role:'coach', text: t(key), ts:Date.now()});
  renderChat();
  persist();
}
function pickSpacedDays(days, count){
  // Elige `count` días del array (ya en orden cronológico lunes->domingo) tratando
  // de separarlos lo más posible entre sí -- antes se tomaban siempre los primeros
  // `count` días de la lista, así que en un plan de 4 días las dos sesiones fuertes
  // podían caer en días seguidos (ej. series martes + tempo miércoles), sin un día
  // de por medio para absorber la carga.
  if(count>=days.length) return days.slice();
  if(count<=1) return days.slice(0,1);
  const idx = d => DAY_KEYS.indexOf(d);
  let best = null, bestScore = -1;
  const combo = (start, chosen) => {
    if(chosen.length===count){
      let minGap = Infinity;
      for(let i=1;i<chosen.length;i++) minGap = Math.min(minGap, idx(chosen[i])-idx(chosen[i-1]));
      if(minGap>bestScore){ bestScore = minGap; best = chosen.slice(); }
      return;
    }
    for(let i=start;i<days.length;i++){ chosen.push(days[i]); combo(i+1, chosen); chosen.pop(); }
  };
  combo(0, []);
  return best;
}
function distributeSessionTypes(trainingDays, beginner, weekNumber, caution, isCutback, goal){
  if(!trainingDays.length) return {};
  const pref = ['sun','sat','fri','thu','wed','tue','mon'];
  let longDay = trainingDays[trainingDays.length-1];
  for(const d of pref){ if(trainingDays.includes(d)){ longDay = d; break; } }
  const remaining = trainingDays.filter(d=>d!==longDay);
  const sessions = {}; sessions[longDay] = 'long';
  if(beginner || !remaining.length){
    remaining.forEach(d=>{ sessions[d]='easy'; });
    return sessions;
  }
  // Regla 80/20: cuántos días "fuertes" por semana tolera bien esta frecuencia de
  // entrenamiento. Con pocos días de running no hay volumen suave suficiente para
  // absorber dos sesiones duras Y la tirada larga en la misma semana -> antes esto
  // se hacía siempre igual sin importar cuántos días corría la persona, lo cual mete
  // demasiada intensidad a un plan de 3 días. Un perfil de más cautela (edad/
  // contextura) baja este límite todavía más, sin eliminar la calidad del todo.
  const wn = weekNumber || 1;
  const rotation = hardSessionRotation(goal, caution);
  let maxHardDays, hardOccurrence;
  if(remaining.length<=2){
    if(caution.level>=2){
      // el día fuerte aparece cada dos semanas en vez de todas para el perfil más
      // conservador -> se sigue sumando estímulo de calidad sin el impacto repetido
      // de un esfuerzo exigente semana tras semana. Contamos OCURRENCIAS de día
      // fuerte (1ra, 2da, 3ra...) y no el número de semana en sí para rotar el tipo
      // -- si usáramos la semana directamente, como el día fuerte cae siempre en
      // semana par, la rotación quedaría siempre en el mismo tipo.
      maxHardDays = wn % 2 === 0 ? 1 : 0;
      hardOccurrence = Math.ceil(wn/2);
    } else {
      maxHardDays = 1;
      hardOccurrence = wn;
    }
  } else {
    maxHardDays = caution.level>=2 ? 1 : Math.min(2, remaining.length-1);
    hardOccurrence = wn;
  }
  if(isCutback) maxHardDays = Math.max(0, maxHardDays-1); // semana de descarga: también baja la intensidad, no solo el volumen
  if(maxHardDays<=0){
    remaining.forEach(d=>{ sessions[d]='easy'; });
    return sessions;
  }
  // La rotación avanza una posición por cada ocurrencia de día fuerte, así que el
  // estímulo de calidad va variando en vez de repetir siempre el mismo tipo de sesión.
  if(maxHardDays===1){
    const hardType = rotation[(hardOccurrence-1) % rotation.length];
    remaining.forEach((d,i)=>{ sessions[d] = i===0 ? hardType : 'easy'; });
    return sessions;
  }
  const first = rotation[(hardOccurrence-1) % rotation.length];
  let second = rotation[hardOccurrence % rotation.length];
  if(second === first) second = 'tempo';
  const [dayA, dayB] = pickSpacedDays(remaining, 2);
  remaining.forEach(d=>{ sessions[d] = d===dayA ? first : d===dayB ? second : 'easy'; });
  return sessions;
}
function buildIntervalStructure(qualityKm, caution, weekNumber){
  // Antes había una única distancia de repetición fija por rango de km, así que si tu
  // volumen de series no cambiaba mucho de una semana a otra, te tocaba literalmente
  // la misma sesión clonada. Ahora hay un par de estructuras válidas por rango y se
  // rota según el número de semana, para variar el estímulo real.
  let options;
  if(qualityKm <= 3) options = [{repMeters:300, recoveryMin:1}, {repMeters:200, recoveryMin:1}];
  else if(qualityKm <= 5) options = [{repMeters:400, recoveryMin:2}, {repMeters:300, recoveryMin:1}];
  else if(qualityKm <= 7) options = [{repMeters:600, recoveryMin:2}, {repMeters:400, recoveryMin:2}];
  else options = [{repMeters:1000, recoveryMin:3}, {repMeters:800, recoveryMin:2}];
  const wn = weekNumber || 1;
  const { repMeters, recoveryMin } = options[(wn-1) % options.length];
  // con más edad o más masa corporal, el impacto de cada repetición pesa más sobre
  // articulaciones y tendones -> capamos la cantidad de repeticiones aunque el volumen
  // "en papel" pediría más, en vez de tratar a todos los corredores igual
  const maxReps = caution && caution.level>=2 ? 8 : caution && caution.level>=1 ? 10 : 12;
  const totalMeters = qualityKm * 1000;
  const reps = Math.max(4, Math.min(maxReps, Math.round(totalMeters / repMeters)));
  return { reps, repMeters, recoveryMin };
}
function buildHillStructure(qualityKm, caution){
  // Repeticiones en subida: esfuerzos más cortos que las series en llano (por el
  // impacto extra de la pendiente), con el mismo criterio de tope por edad/contextura.
  let effortSec, baseReps;
  if(qualityKm <= 4){ effortSec = 45; baseReps = 6; }
  else if(qualityKm <= 7){ effortSec = 60; baseReps = 8; }
  else { effortSec = 90; baseReps = 10; }
  const maxReps = caution && caution.level>=2 ? 5 : caution && caution.level>=1 ? 7 : 10;
  const reps = Math.max(4, Math.min(maxReps, baseReps));
  return { reps, effortSec };
}
function calcBmi(p){
  if(!p || !p.weight || !p.height) return null;
  const h = p.height/100;
  if(!(h>0)) return null;
  return p.weight / (h*h);
}
function trainingCaution(p){
  // Perfil de "cautela" del corredor: junta edad y contextura física para moderar
  // cuántas sesiones fuertes por semana tolera bien y qué tan rápido puede subir
  // volumen, en vez de armar el mismo plan para un chico de 20 años y 60kg que para
  // alguien de 60 años y 90kg. No es un diagnóstico médico, es sólo una heurística
  // conservadora de carga de entrenamiento (nunca se muestra al usuario).
  const age = ageFromBirth(p.birth);
  const bmi = calcBmi(p);
  let level = 0;
  if(age >= 60) level = Math.max(level, 2);
  else if(age >= 45) level = Math.max(level, 1);
  if(bmi !== null){
    if(bmi >= 30) level = Math.max(level, 2);
    else if(bmi >= 27) level = Math.max(level, 1);
  }
  // una molestia activa (registrada en los últimos 21 días y todavía sin marcar como
  // resuelta) también sube la cautela -- menos sesiones de impacto (series/cuestas, ver
  // hardSessionRotation) y una progresión de volumen más lenta (ver weekMultiplier),
  // hasta que el corredor la marque como resuelta desde Perfil.
  if(activePainEntries(21).length) level = Math.max(level, 1);
  return { age, bmi, level };
}
function generatePlan(p, weekNumber, weekStartDate){
  weekNumber = weekNumber || 1;
  weekStartDate = weekStartDate || state.weekStart;
  const caution = trainingCaution(p);
  const isRecovery = isRecoveryWeek(weekStartDate);
  const mult = weekMultiplier(weekNumber, caution) * taperMultiplier(p, weekStartDate) * recoveryMultiplier(weekStartDate);
  const beginner = p.weeklyKm === 0 || p.goal === 'start' || p.runnerType === 'new';
  // si el corredor puso una meta semanal propia, la usamos como referencia de volumen en vez
  // del cálculo genérico -- pero acotada para no saltar de golpe a algo que podría lesionarlo
  let effectiveWeeklyKm = p.weeklyKm;
  if(p.weeklyGoalKm > 0 && !beginner){
    const maxWk = Math.max(p.weeklyKm * 1.3, p.weeklyKm + 5);
    const minWk = p.weeklyKm * 0.7;
    effectiveWeeklyKm = Math.min(maxWk, Math.max(minWk, p.weeklyGoalKm));
  }
  const per = (beginner ? 2.5 : Math.max(3, effectiveWeeklyKm/3)) * mult;
  const easy = Math.round(per*0.9), quality = Math.round(per*1.15), tempo = Math.round(per*0.85), long = Math.round(per*(beginner?1.3:1.5));
  const distMap = {easy, intervals:quality, tempo, long, fartlek:Math.round(per*1.0), hills:Math.round(per*0.9), progression:Math.round(per*1.0)};
  const zoneMap = {easy:beginner?1:2, intervals:4, tempo:3, long:2, fartlek:3, hills:4, progression:3};
  const defaultDays = beginner ? ['tue','thu','sun'] : ['tue','wed','fri','sun'];
  const trainingDays = DAY_KEYS.filter(d => (p.trainingDays && p.trainingDays.length ? p.trainingDays : defaultDays).includes(d));
  const sessionMap = distributeSessionTypes(trainingDays, beginner, weekNumber, caution, isCutbackWeek(weekNumber), p.goal);
  if(isRecovery){
    // En la semana de recuperación evitamos series/tempo/cuestas/fartlek/progresivo/rodaje
    // largo -- todo eso suma carga justo cuando el cuerpo todavía está absorbiendo el
    // esfuerzo de la carrera. Se reemplaza por rodaje suave (o descanso, si ese día ya
    // no tenía sesión) hasta la semana siguiente, que retoma el plan normal.
    const heavyTypes = ['intervals','tempo','fartlek','hills','progression','long'];
    Object.keys(sessionMap).forEach(day=>{ if(heavyTypes.includes(sessionMap[day])) sessionMap[day] = 'easy'; });
  }
  const raceDayIdx = eventDayIndexInWeek(weekStartDate);
  const raceTerrain = eventTerrainOverride(weekStartDate);
  return DAY_KEYS.map((day,i)=>{
    if(i === raceDayIdx){
      // el día de la carrera cargada en "Próximos eventos" no lleva sesión de entrenamiento propia
      // -- ese día la carrera ES la sesión, no se le suma nada más encima
      return {day, typeKey:'rest', dist:0, terrain:null, zone:null, beginner, raceDay:true};
    }
    const typeKey = sessionMap[day];
    if(!typeKey) return {day, typeKey:'rest', dist:0, terrain:null, zone:null, beginner};
    const terrain = typeKey==='intervals' ? 'asfalto' : (typeKey==='long' && raceTerrain) ? raceTerrain : p.terrain;
    const dayObj = {day, typeKey, dist:distMap[typeKey], terrain, zone:zoneMap[typeKey], beginner};
    if(typeKey==='intervals' && !beginner) dayObj.interval = buildIntervalStructure(distMap[typeKey], caution, weekNumber);
    if(typeKey==='hills' && !beginner) dayObj.interval = buildHillStructure(distMap[typeKey], caution);
    return dayObj;
  });
}
function planLabel(d){
  if(d.raceDay) return {type: t('plan_race_day_type'), desc: t('plan_race_day_desc', {name: escapeHtml(state.event ? state.event.name : '')})};
  if(d.custom) return {type:d.type, desc:d.desc};
  const suf = d.beginner && (d.typeKey==='easy'||d.typeKey==='long'||d.typeKey==='rest') ? '_beginner' : '';
  let desc = t('desc_'+d.typeKey+suf);
  if(d.typeKey==='intervals' && d.interval){
    desc = t('desc_intervals_detail', {reps:d.interval.reps, meters:d.interval.repMeters, rest:d.interval.recoveryMin, zone:d.zone});
  } else if(d.typeKey==='hills' && d.interval){
    desc = t('desc_hills_detail', {reps:d.interval.reps, effort:d.interval.effortSec, zone:d.zone});
  } else if(d.typeKey==='progression' && d.dist>0){
    desc = t('desc_progression_detail', {third: Math.max(1, Math.round(d.dist/3))});
  } else if(d.zone && d.dist>0 && d.typeKey!=='intervals' && d.typeKey!=='fartlek'){
    // el fartlek ya es alternar ritmos por sensación -- decirle "mantenete en zona X
    // durante el tramo principal" encima se contradice con la sesión misma
    desc += t('desc_zone_suffix', {zone:d.zone});
  }
  // Entrada en calor y vuelta a la calma para toda sesión que implique correr (no en
  // días de descanso). Antes era una frase agregada al final ("...y sumale 5 a 15 min
  // de trote suave al principio y al final"); ahora el pedido es una ESTRUCTURA fija de
  // 3 partes -- entrada en calor, el detalle de la sesión, vuelta a la calma, cada una
  // en su propio párrafo -- con 10 minutos fijos en vez de un rango. El \n se ve como
  // salto de línea real en todos los lugares donde se muestra esto (home, plan, correr)
  // gracias a white-space:pre-line en .muted y .day-detail.
  if(d.dist>0) desc = `${t('desc_warmup_prefix')}\n${desc}\n${t('desc_cooldown_suffix')}`;
  return {type:t('type_'+d.typeKey), desc};
}

/* ---- exportar la semana como archivo .ics -----
   Para que el corredor vea sus sesiones en Google/Apple Calendar sin depender de abrir
   la app. Son eventos de día completo (sin hora fija, porque el plan no define una) --
   así evitamos meternos con huso horario y cada uno lo agenda a la hora que le sirva. */
function icsEscape(str){
  return String(str||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
}
function icsDateStamp(dateObj){
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth()+1).padStart(2,'0');
  const d = String(dateObj.getDate()).padStart(2,'0');
  return `${y}${m}${d}`;
}
function generateWeekICS(){
  const monday = new Date(state.weekStart+'T00:00:00');
  const nowStamp = icsDateStamp(new Date());
  const events = state.plan.filter(d=>d.dist>0).map(d=>{
    const idx = DAY_KEYS.indexOf(d.day);
    const date = new Date(monday); date.setDate(monday.getDate()+idx);
    const nextDate = new Date(date); nextDate.setDate(date.getDate()+1);
    const lbl = planLabel(d);
    const summary = `${lbl.type} · ${fmtDist(d.dist,1)}${distUnit()}`;
    const uid = `zancada-${state.weekStart}-${d.day}@zancada.app`;
    return ['BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowStamp}T000000Z`,
      `DTSTART;VALUE=DATE:${icsDateStamp(date)}`,
      `DTEND;VALUE=DATE:${icsDateStamp(nextDate)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(lbl.desc)}`,
      'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Zancada//Plan Semanal//ES','CALSCALE:GREGORIAN',
    ...events,'END:VCALENDAR'].join('\r\n');
}
function exportWeekToCalendar(){
  if(!state.plan.some(d=>d.dist>0)){ showToast(t('plan_export_ics_empty'),'error'); return; }
  const blob = new Blob([generateWeekICS()], {type:'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zancada-semana-${state.weekStart}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

/* ================= RENDER ================= */
function renderAll(){ renderHome(); renderPlan(); renderPerfil(); }

const DAILY_TIPS = {
  es: ["Cada kilómetro cuenta, aunque sea lento.","El descanso también es parte del entrenamiento.","Los días difíciles construyen corredores fuertes.","Correr suave hoy es correr mejor mañana.","Escuchá a tu cuerpo — el dolor no es lo mismo que la incomodidad.","La constancia le gana a la intensidad, casi siempre.","El mejor ritmo es el que podés sostener y disfrutar.","Un buen calentamiento evita una mala lesión.","Dormí bien: es el entrenamiento invisible.","La motivación te hace empezar, el hábito te hace terminar.","No compares tu progreso con el de otro corredor.","Tu peor día corriendo sigue siendo mejor que uno en el sillón.","No necesitás motivación todos los días, necesitás un hábito.","El cuerpo se adapta a lo que le pedís, dale tiempo.","Correr bajo la lluvia también cuenta — y te vas a acordar de ese día.","Cada carrera que terminás te hace un poco más fuerte que ayer.","La zapatilla más rápida es la que ya te pusiste.","No hace falta correr rápido todos los días, hace falta correr seguido.","El primer kilómetro siempre cuesta más que el último.","Progresar no es lineal: hay semanas de subida y semanas de meseta.","Nadie corrió un maratón sin antes correr un metro.","La disciplina te lleva a donde la motivación no llega sola.","Un mal entrenamiento no borra diez buenos.","Correr es la única carrera donde ganás simplemente por terminar.","Tu ritmo de hoy no tiene que ser el de ayer, ni el de mañana.","El aire frío de la mañana es gratis y funciona mejor que cualquier café.","A veces el logro más grande del día es haber salido a la calle.","Cada gota de sudor es una decisión que tomaste por vos mismo.","Correr no te cambia el cuerpo primero, te cambia la cabeza primero.","Nadie te va a aplaudir en el kilómetro 3 de un martes cualquiera, y está bien: es tuyo.","El descanso de hoy es la velocidad de mañana.","No corrés contra nadie, corrés con vos de antes.","Los kilómetros lentos de hoy son los que te bancan en el kilómetro 30.","Ponerte las zapatillas ya es el 50% del entrenamiento.","El clima no decide si salís a correr, vos decidís.","Cada semana que sumás kilómetros es una inversión en la versión futura de vos.","No es magia, es constancia disfrazada de kilómetros.","Cuando dudes si podés, acordate de todas las veces que ya pudiste.","El running no perdona la impaciencia, pero premia la paciencia siempre.","Tu peor excusa de hoy es más débil que tu peor entrenamiento.","Un rodaje suave bien hecho vale más que uno rápido mal hecho.","Correr te enseña a estar incómodo sin entrar en pánico — eso sirve para todo lo demás también.","No hay atajos para la resistencia, solo kilómetros acumulados.","Cada carrera empieza con la decisión de salir por la puerta.","El corredor de hoy agradece al corredor que decidió empezar.","La meta no es correr sin parar, es no dejar de intentarlo.","Los días que menos ganas tenés son los que más te enseñan.","Vas a tener entrenamientos malos — no son el final, son parte del camino.","Cuidar el cuerpo hoy es poder seguir corriendo mañana.","Cada corredor que ves en la calle también tuvo un primer día difícil."],
  en: ["Every kilometer counts, even a slow one.","Rest is part of training too.","Hard days build strong runners.","Running easy today means running better tomorrow.","Listen to your body — pain isn't the same as discomfort.","Consistency beats intensity, almost always.","The best pace is the one you can sustain and enjoy.","A good warm-up prevents a bad injury.","Sleep well: it's the invisible training.","Motivation gets you started, habit gets you finished.","Don't compare your progress to another runner's.","Your worst day running still beats a day on the couch.","You don't need motivation every day, you need a habit.","Your body adapts to what you ask of it — give it time.","Running in the rain counts too — and you'll remember that day.","Every run you finish makes you a little stronger than yesterday.","The fastest shoe is the one you already put on.","You don't need to run fast every day, you need to run often.","The first kilometer always feels harder than the last.","Progress isn't linear: there are weeks of climbing and weeks on a plateau.","No one ran a marathon without first running a single step.","Discipline takes you where motivation alone can't.","One bad workout doesn't erase ten good ones.","Running is the only race where you win just by finishing.","Today's pace doesn't have to be yesterday's, or tomorrow's.","Cold morning air is free and works better than any coffee.","Sometimes the biggest win of the day is just getting out the door.","Every drop of sweat is a decision you made for yourself.","Running doesn't change your body first — it changes your mind first.","No one's going to cheer for you at kilometer 3 on a random Tuesday, and that's fine: it's yours.","Today's rest is tomorrow's speed.","You're not racing anyone else, you're racing the you from before.","The slow kilometers today are what carry you at kilometer 30.","Putting on your shoes is already 50% of the workout.","The weather doesn't decide if you run — you do.","Every week you add kilometers is an investment in your future self.","It's not magic, it's consistency disguised as kilometers.","When you doubt you can, remember every time you already did.","Running never forgives impatience, but it always rewards patience.","Your worst excuse today is weaker than your worst workout.","A well-run easy day beats a badly-run fast one.","Running teaches you to be uncomfortable without panicking — that helps with everything else too.","There are no shortcuts to endurance, only accumulated kilometers.","Every run starts with the decision to walk out the door.","Today's runner is grateful to the runner who decided to start.","The goal isn't to never stop running, it's to never stop trying.","The days you feel like it least are the ones that teach you the most.","You'll have bad workouts — they're not the end, they're part of the journey.","Taking care of your body today means you get to keep running tomorrow.","Every runner you see on the street had a hard first day too."],
  pt: ["Cada quilômetro conta, mesmo que seja devagar.","O descanso também faz parte do treino.","Os dias difíceis constroem corredores fortes.","Correr leve hoje é correr melhor amanhã.","Escute seu corpo — dor não é o mesmo que desconforto.","A constância vence a intensidade, quase sempre.","O melhor ritmo é aquele que você consegue manter e curtir.","Um bom aquecimento evita uma lesão ruim.","Durma bem: é o treino invisível.","A motivação te faz começar, o hábito te faz terminar.","Não compare seu progresso com o de outro corredor.","Seu pior dia correndo ainda é melhor que um dia no sofá.","Você não precisa de motivação todo dia, precisa de um hábito.","O corpo se adapta ao que você pede dele — dê tempo a ele.","Correr na chuva também conta — e você vai lembrar desse dia.","Cada corrida que você termina te deixa um pouco mais forte que ontem.","O tênis mais rápido é o que você já calçou.","Não precisa correr rápido todo dia, precisa correr sempre.","O primeiro quilômetro sempre pesa mais que o último.","Progresso não é linear: tem semanas de subida e semanas de platô.","Ninguém correu uma maratona sem antes correr um metro.","A disciplina te leva aonde só a motivação não chega.","Um treino ruim não apaga dez bons.","Correr é a única prova em que você ganha só por terminar.","Seu ritmo de hoje não precisa ser o de ontem, nem o de amanhã.","O ar frio da manhã é de graça e funciona melhor que qualquer café.","Às vezes a maior conquista do dia é ter saído de casa.","Cada gota de suor é uma decisão que você tomou por si mesmo.","Correr não muda seu corpo primeiro, muda sua cabeça primeiro.","Ninguém vai te aplaudir no quilômetro 3 de uma terça qualquer, e tudo bem: é seu.","O descanso de hoje é a velocidade de amanhã.","Você não corre contra ninguém, corre contra quem você era antes.","Os quilômetros lentos de hoje são os que te sustentam no quilômetro 30.","Calçar o tênis já é 50% do treino.","O clima não decide se você corre, você decide.","Cada semana que você soma quilômetros é um investimento na sua versão futura.","Não é mágica, é constância disfarçada de quilômetros.","Quando duvidar que consegue, lembre de todas as vezes que já conseguiu.","O running não perdoa a impaciência, mas sempre recompensa a paciência.","Sua pior desculpa de hoje é mais fraca que seu pior treino.","Um rodagem leve bem feito vale mais que um rápido mal feito.","Correr te ensina a ficar desconfortável sem entrar em pânico — isso serve pra tudo o mais também.","Não existe atalho para a resistência, só quilômetros acumulados.","Toda corrida começa com a decisão de sair pela porta.","O corredor de hoje agradece ao corredor que decidiu começar.","A meta não é nunca parar de correr, é nunca parar de tentar.","Os dias em que você tem menos vontade são os que mais ensinam.","Você vai ter treinos ruins — eles não são o fim, são parte do caminho.","Cuidar do corpo hoje é poder continuar correndo amanhã.","Todo corredor que você vê na rua também teve um primeiro dia difícil."],
  fr: ["Chaque kilomètre compte, même lent.","Le repos fait aussi partie de l'entraînement.","Les jours difficiles forgent des coureurs solides.","Courir doucement aujourd'hui, c'est mieux courir demain.","Écoute ton corps — la douleur n'est pas l'inconfort.","La régularité bat l'intensité, presque toujours.","La meilleure allure est celle que tu peux tenir et apprécier.","Un bon échauffement évite une mauvaise blessure.","Dors bien : c'est l'entraînement invisible.","La motivation te fait démarrer, l'habitude te fait finir.","Ne compare pas ta progression à celle d'un autre coureur.","Ta pire journée de course vaut mieux qu'une journée sur le canapé.","Tu n'as pas besoin de motivation tous les jours, tu as besoin d'une habitude.","Le corps s'adapte à ce que tu lui demandes — laisse-lui le temps.","Courir sous la pluie compte aussi — et tu te souviendras de ce jour-là.","Chaque course terminée te rend un peu plus fort qu'hier.","La chaussure la plus rapide est celle que tu as déjà enfilée.","Pas besoin de courir vite tous les jours, il faut courir souvent.","Le premier kilomètre est toujours plus dur que le dernier.","Le progrès n'est pas linéaire : il y a des semaines de montée et des semaines de plateau.","Personne n'a couru un marathon sans avoir d'abord couru un mètre.","La discipline t'emmène là où la motivation seule n'arrive pas.","Un mauvais entraînement n'efface pas dix bons.","Courir est la seule course où tu gagnes juste en terminant.","Ton allure d'aujourd'hui n'a pas à être celle d'hier, ni celle de demain.","L'air frais du matin est gratuit et marche mieux que n'importe quel café.","Parfois, la plus grande victoire du jour, c'est juste d'être sorti.","Chaque goutte de sueur est une décision que tu as prise pour toi-même.","Courir ne change pas d'abord ton corps, ça change d'abord ta tête.","Personne ne t'applaudira au 3e kilomètre d'un mardi comme un autre, et c'est très bien : c'est le tien.","Le repos d'aujourd'hui, c'est la vitesse de demain.","Tu ne cours pas contre les autres, tu cours contre toi d'avant.","Les kilomètres lents d'aujourd'hui sont ceux qui te portent au 30e kilomètre.","Enfiler tes chaussures, c'est déjà 50 % de l'entraînement.","La météo ne décide pas si tu cours, c'est toi qui décides.","Chaque semaine où tu ajoutes des kilomètres est un investissement dans ta future version.","Ce n'est pas de la magie, c'est de la régularité déguisée en kilomètres.","Quand tu doutes de pouvoir, souviens-toi de toutes les fois où tu as déjà pu.","La course à pied ne pardonne pas l'impatience, mais elle récompense toujours la patience.","Ta pire excuse d'aujourd'hui est plus faible que ton pire entraînement.","Une sortie facile bien faite vaut mieux qu'une rapide mal faite.","Courir t'apprend à être inconfortable sans paniquer — ça sert pour tout le reste aussi.","Il n'y a pas de raccourci vers l'endurance, seulement des kilomètres accumulés.","Chaque course commence par la décision de sortir par la porte.","Le coureur d'aujourd'hui remercie celui qui a décidé de commencer.","L'objectif n'est pas de ne jamais s'arrêter de courir, c'est de ne jamais arrêter d'essayer.","Les jours où tu en as le moins envie sont ceux qui t'apprennent le plus.","Tu auras de mauvais entraînements — ce n'est pas la fin, ça fait partie du chemin.","Prendre soin de ton corps aujourd'hui, c'est pouvoir continuer à courir demain.","Chaque coureur que tu vois dans la rue a aussi eu un premier jour difficile."],
  it: ["Ogni chilometro conta, anche se lento.","Anche il riposo fa parte dell'allenamento.","I giorni difficili costruiscono corridori forti.","Correre piano oggi significa correre meglio domani.","Ascolta il tuo corpo — il dolore non è lo stesso del disagio.","La costanza batte l'intensità, quasi sempre.","Il ritmo migliore è quello che riesci a sostenere e goderti.","Un buon riscaldamento evita un brutto infortunio.","Dormi bene: è l'allenamento invisibile.","La motivazione ti fa iniziare, l'abitudine ti fa finire.","Non confrontare i tuoi progressi con quelli di un altro corridore.","La tua peggiore giornata di corsa batte comunque una sul divano.","Non serve motivazione ogni giorno, serve un'abitudine.","Il corpo si adatta a quello che gli chiedi — dagli tempo.","Correre sotto la pioggia conta anche — e ti ricorderai di quel giorno.","Ogni corsa che finisci ti rende un po' più forte di ieri.","La scarpa più veloce è quella che hai già indossato.","Non serve correre veloce ogni giorno, serve correre spesso.","Il primo chilometro pesa sempre più dell'ultimo.","Il progresso non è lineare: ci sono settimane in salita e settimane di stallo.","Nessuno ha corso una maratona senza prima aver corso un metro.","La disciplina ti porta dove la sola motivazione non arriva.","Un allenamento negativo non cancella dieci positivi.","Correre è l'unica gara in cui vinci semplicemente finendola.","Il tuo ritmo di oggi non deve essere quello di ieri, né quello di domani.","L'aria fresca del mattino è gratis e funziona meglio di qualsiasi caffè.","A volte il traguardo più grande della giornata è essere usciti di casa.","Ogni goccia di sudore è una decisione che hai preso per te stesso.","Correre non cambia prima il corpo, cambia prima la testa.","Nessuno ti applaudirà al terzo chilometro di un martedì qualunque, e va bene così: è tuo.","Il riposo di oggi è la velocità di domani.","Non stai correndo contro nessuno, stai correndo contro te stesso di prima.","I chilometri lenti di oggi sono quelli che ti reggono al trentesimo.","Allacciarti le scarpe è già il 50% dell'allenamento.","Il tempo non decide se corri, decidi tu.","Ogni settimana in cui aggiungi chilometri è un investimento nella tua versione futura.","Non è magia, è costanza travestita da chilometri.","Quando dubiti di potercela fare, ricorda tutte le volte in cui ce l'hai già fatta.","La corsa non perdona l'impazienza, ma premia sempre la pazienza.","La tua peggior scusa di oggi è più debole del tuo peggior allenamento.","Un rodaggio lento fatto bene vale più di uno veloce fatto male.","Correre ti insegna a stare scomodo senza andare nel panico — utile anche per tutto il resto.","Non ci sono scorciatoie per la resistenza, solo chilometri accumulati.","Ogni corsa comincia con la decisione di uscire dalla porta.","Il corridore di oggi ringrazia quello che ha deciso di iniziare.","L'obiettivo non è non fermarsi mai, è non smettere mai di provarci.","I giorni in cui hai meno voglia sono quelli che ti insegnano di più.","Avrai allenamenti negativi — non sono la fine, fanno parte del percorso.","Prenderti cura del corpo oggi ti permette di continuare a correre domani.","Ogni corridore che vedi per strada ha avuto anche lui un primo giorno difficile."],
  de: ["Jeder Kilometer zählt, auch ein langsamer.","Erholung ist auch Teil des Trainings.","Harte Tage machen starke Läufer.","Heute locker laufen heißt morgen besser laufen.","Hör auf deinen Körper — Schmerz ist nicht dasselbe wie Unbehagen.","Beständigkeit schlägt fast immer Intensität.","Das beste Tempo ist das, was du durchhalten und genießen kannst.","Ein gutes Aufwärmen verhindert eine schlechte Verletzung.","Schlaf gut: das ist das unsichtbare Training.","Motivation lässt dich anfangen, Gewohnheit lässt dich fertig werden.","Vergleiche deinen Fortschritt nicht mit dem anderer Läufer.","Dein schlechtester Lauftag schlägt immer noch einen Tag auf dem Sofa.","Du brauchst nicht jeden Tag Motivation, du brauchst eine Gewohnheit.","Der Körper passt sich an das an, was du von ihm verlangst — gib ihm Zeit.","Laufen im Regen zählt auch — und du wirst dich an diesen Tag erinnern.","Jeder Lauf, den du beendest, macht dich ein bisschen stärker als gestern.","Der schnellste Schuh ist der, den du schon anhast.","Du musst nicht jeden Tag schnell laufen, du musst regelmäßig laufen.","Der erste Kilometer fühlt sich immer schwerer an als der letzte.","Fortschritt verläuft nicht geradlinig: es gibt Wochen bergauf und Wochen auf der Stelle.","Niemand ist einen Marathon gelaufen, ohne vorher einen Meter gelaufen zu sein.","Disziplin bringt dich dorthin, wo Motivation allein nicht hinreicht.","Ein schlechtes Training löscht nicht zehn gute aus.","Laufen ist der einzige Wettkampf, bei dem du schon durchs Ankommen gewinnst.","Dein heutiges Tempo muss nicht das von gestern oder morgen sein.","Kalte Morgenluft ist gratis und wirkt besser als jeder Kaffee.","Manchmal ist der größte Erfolg des Tages einfach, rausgegangen zu sein.","Jeder Schweißtropfen ist eine Entscheidung, die du für dich selbst getroffen hast.","Laufen verändert nicht zuerst den Körper, es verändert zuerst den Kopf.","Niemand wird dich bei Kilometer 3 an einem x-beliebigen Dienstag anfeuern, und das ist okay: der gehört dir.","Die Erholung von heute ist die Geschwindigkeit von morgen.","Du läufst gegen niemanden, du läufst gegen dein früheres Ich.","Die langsamen Kilometer von heute tragen dich bei Kilometer 30.","Die Laufschuhe anzuziehen ist schon 50 % des Trainings.","Nicht das Wetter entscheidet, ob du läufst, sondern du.","Jede Woche, in der du Kilometer sammelst, ist eine Investition in dein zukünftiges Ich.","Das ist keine Magie, das ist Beständigkeit, verkleidet als Kilometer.","Wenn du zweifelst, ob du es schaffst, erinnere dich an jedes Mal, als du es schon geschafft hast.","Laufen verzeiht keine Ungeduld, belohnt aber immer Geduld.","Deine schlechteste Ausrede heute ist schwächer als dein schlechtestes Training.","Ein gut gelaufener lockerer Lauf ist mehr wert als ein schlecht gelaufener schneller.","Laufen lehrt dich, unangenehme Situationen ohne Panik auszuhalten — das hilft auch bei allem anderen.","Es gibt keine Abkürzung zur Ausdauer, nur angesammelte Kilometer.","Jeder Lauf beginnt mit der Entscheidung, aus der Tür zu gehen.","Der heutige Läufer ist dem Läufer dankbar, der sich entschieden hat anzufangen.","Das Ziel ist nicht, nie mit dem Laufen aufzuhören, sondern nie aufzuhören, es zu versuchen.","Die Tage, an denen du am wenigsten Lust hast, lehren dich am meisten.","Du wirst schlechte Trainings haben — sie sind nicht das Ende, sie gehören zum Weg dazu.","Dich heute um deinen Körper zu kümmern bedeutet, morgen weiterlaufen zu können.","Jeder Läufer, den du auf der Straße siehst, hatte auch einen schweren ersten Tag."]
};
function renderDailyTip(){
  const today = localDateISO();
  const pool = DAILY_TIPS[lang] || DAILY_TIPS.es;
  if(state.dailyTipDate !== today || typeof state.dailyTipIndex !== 'number'){
    state.dailyTipDate = today;
    state.dailyTipIndex = Math.floor(Math.random()*pool.length);
  }
  const el = document.getElementById('daily-tip-text');
  if(el) el.textContent = pool[state.dailyTipIndex % pool.length];
}
// Tips específicos del día de carrera (estrategia, nutrición, logística) -- a propósito
// separados de DAILY_TIPS (que son de entrenamiento en general), en la card que antes
// tenía el mensaje fijo de "hablar con tu coach".
const RACE_TIPS = {
  es: ["Probá la ropa y las zapatillas que vas a usar el día de la carrera en algún entrenamiento antes — nunca estrenes nada el día de la carrera.","Los 2-3 días previos a la carrera, bajá el volumen y priorizá dormir bien en vez de meter kilómetros de más.","Definí tu estrategia de ritmo antes de largar: es más fácil acelerar al final que recuperarte de haber salido demasiado rápido.","Si la carrera es de 10K o más, sumá un poco más de carbohidratos los dos días previos.","Hidratate bien los días antes de la carrera, no solo la mañana de la prueba.","En la salida, dejá que el grupo se vaya si arranca más rápido de lo que planeaste — el ritmo lo elegís vos, no la euforia del pelotón.","Practicá en los entrenamientos largos lo que vas a comer o tomar durante la carrera — el día de la prueba no es momento para probar algo nuevo.","Llegá con tiempo de sobra al lugar de largada — el apuro de último momento suma un estrés que no hace falta.","En las bajadas, aflojá el paso y dejate llevar — frenar de más cansa más que bajarlas relajado.","Guardate algo de energía para el último tramo: es mejor terminar acelerando que quedarte sin nada a dos kilómetros del final."],
  en: ["Try out the clothes and shoes you'll wear on race day during a training run first — never wear anything new on race day.","In the 2-3 days before the race, cut back on volume and prioritize sleep instead of squeezing in extra kilometers.","Decide your pacing strategy before the start — it's easier to speed up at the end than to recover from starting too fast.","If the race is 10K or longer, add a bit more carbs in the two days before it.","Stay well hydrated in the days before the race, not just the morning of.","At the start, let the pack go if it takes off faster than you planned — you choose the pace, not the crowd's excitement.","Practice during your long runs whatever you'll eat or drink during the race — race day is not the time to try something new.","Get to the start line with plenty of time to spare — last-minute rushing adds stress you don't need.","On downhills, relax your stride and let gravity help — braking too much tires you out more than running them loose.","Save some energy for the final stretch — it's better to finish accelerating than to run out of gas two kilometers from the end."],
  pt: ["Experimente a roupa e o tênis que vai usar no dia da prova em algum treino antes — nunca estreie nada no dia da corrida.","Nos 2-3 dias antes da prova, reduza o volume e priorize dormir bem em vez de acrescentar mais quilômetros.","Defina sua estratégia de ritmo antes da largada — é mais fácil acelerar no final do que se recuperar de ter saído rápido demais.","Se a prova for de 10K ou mais, aumente um pouco os carboidratos nos dois dias anteriores.","Hidrate-se bem nos dias antes da prova, não só na manhã da corrida.","Na largada, deixe o pelotão ir se sair mais rápido do que o planejado — o ritmo é seu, não da euforia do grupo.","Treine nos rodagens longos o que vai comer ou beber durante a prova — o dia da corrida não é hora de testar algo novo.","Chegue com tempo de sobra no local de largada — a pressa de última hora só soma um estresse desnecessário.","Nas descidas, relaxe a passada e deixe o corpo levar — frear demais cansa mais do que descer solto.","Guarde energia para o trecho final: é melhor terminar acelerando do que ficar sem nada a dois quilômetros do fim."],
  fr: ["Essaie pendant un entraînement les vêtements et les chaussures que tu porteras le jour de la course — ne porte jamais rien de neuf le jour J.","Les 2-3 jours avant la course, réduis le volume et privilégie le sommeil plutôt que d'ajouter des kilomètres.","Définis ta stratégie d'allure avant le départ — il est plus facile d'accélérer à la fin que de récupérer d'un départ trop rapide.","Si la course fait 10 km ou plus, augmente un peu les glucides les deux jours précédents.","Hydrate-toi bien dans les jours qui précèdent la course, pas seulement le matin même.","Au départ, laisse le peloton partir s'il va plus vite que prévu — c'est toi qui choisis l'allure, pas l'euphorie du groupe.","Entraîne-toi pendant tes sorties longues à manger ou boire ce que tu prendras pendant la course — le jour J n'est pas le moment d'essayer quelque chose de nouveau.","Arrive avec de la marge au point de départ — se précipiter au dernier moment ajoute un stress inutile.","Dans les descentes, détends ta foulée et laisse-toi porter — trop freiner fatigue plus que descendre relâché.","Garde de l'énergie pour la dernière ligne droite : mieux vaut finir en accélérant que se retrouver sans jus à deux kilomètres de l'arrivée."],
  it: ["Prova durante un allenamento i vestiti e le scarpe che userai il giorno della gara — non indossare mai nulla di nuovo il giorno della corsa.","Nei 2-3 giorni prima della gara, riduci il volume e dai priorità al sonno invece di aggiungere altri chilometri.","Definisci la tua strategia di ritmo prima della partenza — è più facile accelerare alla fine che recuperare da una partenza troppo veloce.","Se la gara è di 10K o più, aumenta leggermente i carboidrati nei due giorni precedenti.","Idratati bene nei giorni prima della gara, non solo la mattina stessa.","Alla partenza, lascia andare il gruppo se parte più veloce del previsto — il ritmo lo scegli tu, non l'euforia del gruppo.","Allenati nelle uscite lunghe a mangiare o bere quello che userai durante la gara — il giorno della corsa non è il momento di provare qualcosa di nuovo.","Arriva con largo anticipo al punto di partenza — la fretta dell'ultimo minuto aggiunge uno stress inutile.","In discesa, rilassa la falcata e lasciati andare — frenare troppo stanca più che scendere sciolti.","Conserva un po' di energia per il tratto finale: è meglio finire accelerando che restare senza forze a due chilometri dal traguardo."],
  de: ["Probiere die Kleidung und Schuhe, die du am Renntag tragen willst, vorher bei einem Training aus — trag am Renntag nie etwas Neues.","In den 2-3 Tagen vor dem Rennen: Volumen runterfahren und Schlaf priorisieren, statt noch mehr Kilometer reinzuquetschen.","Leg deine Pace-Strategie vor dem Start fest — am Ende schneller zu werden ist leichter, als sich von einem zu schnellen Start zu erholen.","Bei einem Rennen ab 10 km: in den zwei Tagen davor etwas mehr Kohlenhydrate essen.","Trink in den Tagen vor dem Rennen ausreichend, nicht nur am Morgen selbst.","Lass beim Start das Feld ziehen, wenn es schneller startet als geplant — du bestimmst dein Tempo, nicht die Euphorie der Gruppe.","Übe bei deinen langen Läufen, was du während des Rennens essen oder trinken wirst — der Renntag ist nicht der Moment, um etwas Neues auszuprobieren.","Komm mit reichlich Zeitpuffer zum Startbereich — Last-Minute-Hektik bringt unnötigen Stress.","Lauf Abfahrten locker und lass dich tragen — zu viel Bremsen ermüdet mehr als eine entspannte Abfahrt.","Heb dir Energie für die Schlussphase auf: lieber beschleunigend ins Ziel als zwei Kilometer vorher ohne Kraft dazustehen."]
};
function renderRaceTip(){
  const today = localDateISO();
  const pool = RACE_TIPS[lang] || RACE_TIPS.es;
  // Índice propio (raceTipDate/raceTipIndex), separado del de DAILY_TIPS, para que las
  // dos cards no muestren "el tip número 3 de cada pool" siempre en simultáneo -- se ven
  // como dos fuentes independientes de consejos aunque roten el mismo día.
  if(state.raceTipDate !== today || typeof state.raceTipIndex !== 'number'){
    state.raceTipDate = today;
    state.raceTipIndex = Math.floor(Math.random()*pool.length);
  }
  const el = document.getElementById('race-tip-text');
  if(el) el.textContent = pool[state.raceTipIndex % pool.length];
}
// Tocando el título de la card se ve la lista completa de tips de carrera, no solo el
// que rotó hoy -- reutiliza el mismo pool que renderRaceTip().
function openRaceTipsInfo(){
  const pool = RACE_TIPS[lang] || RACE_TIPS.es;
  document.getElementById('race-tips-info-body').innerHTML = pool.map(tip=>`
    <div style="display:flex; gap:10px; align-items:flex-start;">
      <span class="icon-sq" style="width:15px; height:15px; color:var(--hivis-text); flex-shrink:0; margin-top:3px;">${ICONS.check}</span>
      <p class="muted" style="margin:0; font-size:13.5px; line-height:1.5;">${tip}</p>
    </div>`).join('');
  document.getElementById('race-tips-info-modal').style.display = 'block';
}
function closeRaceTipsInfo(){ document.getElementById('race-tips-info-modal').style.display = 'none'; }
function renderHome(){
  renderDailyTip();
  renderRaceTip();
  document.getElementById('home-name').textContent = state.profile.name;
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString(LOCALE_MAP[lang],{weekday:'short',day:'numeric',month:'short'});

  // Carrera cargada en "Próximos eventos" (Perfil) -- se muestra también acá en Inicio
  // (no solo en Perfil) porque es justo el tipo de dato que el corredor quiere ver de
  // entrada al abrir la app, no algo que tenga que ir a buscar. Se recalcula entera en
  // cada render a partir de state.event, así que sigue apareciendo sin importar qué
  // otra cosa se haya editado (datos personales, objetivo, etc.) -- ninguno de esos
  // guardados toca state.event.
  const raceCard = document.getElementById('home-race-card');
  if(state.event){
    raceCard.style.display = 'block';
    document.getElementById('home-race-name').textContent = state.event.name;
    const raceTag = document.getElementById('home-race-type-tag');
    raceTag.className = 'tag tag-' + (state.event.type==='ruta' ? 'asfalto' : state.event.type==='trail' ? 'trail' : 'mixto');
    raceTag.textContent = t('ev_type_'+state.event.type);
    const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    const daysToRace = Math.round((new Date(state.event.date+'T00:00:00') - todayMidnight) / 86400000);
    document.getElementById('home-race-days').textContent = Math.max(0, daysToRace);
  } else {
    raceCard.style.display = 'none';
  }

  // Racha de semanas seguidas cumpliendo el plan (≥70%) -- ver buildWeeklyRecapMessage().
  // La mostramos acá recién a partir de la 2da semana seguida, igual que en el chat del
  // coach, para no mostrar un badge "1" que se sienta como un contador vacío recién
  // arrancado.
  const streakBadge = document.getElementById('home-streak-badge');
  if((state.streakWeeks||0) >= 2){
    streakBadge.style.display = 'inline-flex';
    streakBadge.textContent = t('home_streak_badge', {n: state.streakWeeks});
  } else {
    streakBadge.style.display = 'none';
  }
  const idx = (new Date().getDay()+6)%7;
  const today = state.plan[idx];
  const lbl = planLabel(today);
  document.getElementById('home-next-title').textContent = lbl.type;
  document.getElementById('home-next-desc').textContent = lbl.desc;
  document.getElementById('home-next-dist').textContent = today.dist>0 ? fmtDist(today.dist,1)+' '+distUnit() : '';
  document.getElementById('home-next-zone').innerHTML = (today.dist>0 && today.zone) ? `<span class="zone-chip zone-${today.zone}">${t('zone_word')} ${today.zone}</span>` : '';

  // Si ya corrimos hoy, mostramos el resumen de esa sesión en lugar del cartel de
  // "próxima sesión" -- ver getTodayRun().
  const todayRun = getTodayRun();
  const doneBlock = document.getElementById('home-session-done-block');
  const nextSessionBlock = document.getElementById('home-next-session');
  const cardTitleEl = document.getElementById('home-next-card-title');
  if(todayRun){
    cardTitleEl.textContent = t('home_session_done_title');
    nextSessionBlock.style.display = 'none';
    doneBlock.style.display = 'block';
    const paceMin = todayRun.distanceKm>0.02 ? (todayRun.durationSec/60)/todayRun.distanceKm : 0;
    document.getElementById('home-session-done-sub').textContent = t('home_session_done_sub');
    document.getElementById('home-done-dist').textContent = fmtDist(todayRun.distanceKm);
    document.getElementById('home-done-dist-label').textContent = distUnit();
    document.getElementById('home-done-time').textContent = fmtTime(todayRun.durationSec);
    document.getElementById('home-done-pace').textContent = fmtPace(paceMin);
    document.getElementById('home-done-pace-label').textContent = t('run_pace');
  } else {
    cardTitleEl.textContent = t('home_next');
    nextSessionBlock.style.display = '';
    doneBlock.style.display = 'none';
  }

  const weekRuns = (state.runs||[]).filter(r => getMondayISO(new Date(r.date)) === state.weekStart);
  const doneKm = weekRuns.reduce((a,r)=>a+r.distanceKm, 0);
  const weekKm = state.plan.reduce((a,d)=>a+d.dist,0);
  const doneKmDisplay = isImperial() ? doneKm * MI_PER_KM : doneKm;
  const weekKmDisplay = isImperial() ? weekKm * MI_PER_KM : weekKm;
  animateCountUp(document.getElementById('home-week-done-km'), doneKmDisplay, 1);
  animateCountUp(document.getElementById('home-week-km'), weekKmDisplay, 1);
  animateCountUp(document.getElementById('home-week-sessions'), state.plan.filter(d=>d.dist>0).length, 0);
  document.getElementById('home-runs-count').textContent = weekRuns.length;

  const goalWrap = document.getElementById('goal-progress-wrap');
  if(state.profile.weeklyGoalKm > 0){
    goalWrap.style.display = 'block';
    const rawPct = (doneKm / state.profile.weeklyGoalKm) * 100;
    const pct = Math.min(100, Math.round(rawPct));
    document.getElementById('goal-progress-pct').textContent = pct + '%';
    document.getElementById('goal-progress-bar').style.width = pct + '%';
    if(rawPct >= 100 && state.weekStart && state.lastGoalCelebratedWeek !== state.weekStart){
      state.lastGoalCelebratedWeek = state.weekStart;
      haptic([15,40,15,40,25]);
      showToast(t('goal_reached_msg'), 'success');
      persist();
    }
  } else {
    goalWrap.style.display = 'none';
  }

  const maxD = Math.max(...state.plan.map(d=>d.dist),1);
  const barsEl = document.getElementById('home-week-bars');
  barsEl.innerHTML = state.plan.map((d,i)=>{
    if(d.dist===0) return `<div class="bar-col"><div class="bar rest-day"></div><div class="lbl">${t('day_'+d.day).slice(0,2)}</div></div>`;
    const h = Math.max(14, Math.round((d.dist/maxD)*70));
    return `<div class="bar-col"><div class="bar hivis" data-h="${h}" style="height:0px; transition-delay:${i*35}ms;"></div><div class="lbl">${t('day_'+d.day).slice(0,2)}</div></div>`;
  }).join('');
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      barsEl.querySelectorAll('.bar[data-h]').forEach(el=>{ el.style.height = el.dataset.h+'px'; });
    });
  });


  renderReadinessCard();

  const loadCard = document.getElementById('load-card');
  const load = calcTrainingLoad();
  if(load){
    loadCard.style.display = 'block';
    const tagClassMap = {low:'tag-soon', optimal:'tag-mixto', caution:'tag-load-caution', risk:'tag-load-risk'};
    const tag = document.getElementById('load-tag');
    tag.className = 'tag ' + tagClassMap[load.level];
    tag.textContent = t('home_load_'+load.level);
    document.getElementById('load-hint').textContent = t('home_load_hint_'+load.level);
  } else {
    loadCard.style.display = 'none';
  }
  updateSyncBadge();
}
// Busca la carrera más reciente registrada HOY -- se usa para mostrar el resumen de
// "sesión completada" tanto en Inicio como en la pestaña Correr, en vez del cartel de
// "próxima sesión"/círculo de arrancar como si no hubiésemos corrido nada todavía.
function getTodayRun(){
  // r.date es un timestamp completo en UTC (new Date().toISOString(), con hora) -- cortar
  // los primeros 10 caracteres a mano daba la fecha calendario en UTC, no la fecha LOCAL
  // en la que el corredor realmente corrió (ver el comentario largo junto a localDateISO).
  const today = todayISO();
  const todays = (state.runs||[]).filter(r => r.date && localDateISO(r.date) === today);
  if(!todays.length) return null;
  return todays.reduce((a,b) => (a.id > b.id ? a : b));
}
function renderRunTodayCard(){
  const idx = (new Date().getDay()+6)%7;
  const today = state.plan[idx];
  const card = document.getElementById('run-today-card');
  const doneCard = document.getElementById('run-done-today-card');
  const todayRun = getTodayRun();
  if(todayRun){
    const paceMin = todayRun.distanceKm>0.02 ? (todayRun.durationSec/60)/todayRun.distanceKm : 0;
    document.getElementById('run-done-dist').textContent = fmtDist(todayRun.distanceKm);
    document.getElementById('run-done-dist-label').textContent = distUnit();
    document.getElementById('run-done-time').textContent = fmtTime(todayRun.durationSec);
    document.getElementById('run-done-pace').textContent = fmtPace(paceMin);
    document.getElementById('run-done-pace-label').textContent = t('run_pace');
    doneCard.style.display = 'block';
    // El cartel de "sesión completada" reemplaza al de "tu sesión de hoy" (no tiene
    // sentido mostrar los dos juntos, uno diciendo lo que tocaba y otro confirmando que
    // ya se hizo) -- antes esto solo se decía en el comentario de arriba, pero el código
    // nunca llegaba a ocultar `card`, así que quedaban las dos tarjetas apiladas.
    card.style.display = 'none';
    return;
  }
  doneCard.style.display = 'none';
  if(!today){ card.style.display = 'none'; return; }
  const lbl = planLabel(today);
  document.getElementById('run-today-title').textContent = lbl.type;
  document.getElementById('run-today-desc').textContent = lbl.desc;
  document.getElementById('run-today-dist').textContent = today.dist>0 ? fmtDist(today.dist,1)+' '+distUnit() : '';
  document.getElementById('run-today-zone').innerHTML = (today.dist>0 && today.zone) ? `<span class="zone-chip zone-${today.zone}">${t('zone_word')} ${today.zone}</span>` : '';
  card.style.display = 'block';
}
function getPlanStartDate(){
  // la fecha más vieja de weekStart que tengamos registrada (historial de semanas + la semana actual)
  // marca desde cuándo existe ESTE plan, sin importar si hay carreras de Strava de antes importadas.
  const starts = (state.planHistory||[]).map(w=>w.weekStart).filter(Boolean);
  if(state.weekStart) starts.push(state.weekStart);
  if(!starts.length) return null;
  return starts.reduce((min,s)=> (s < min ? s : min), starts[0]);
}
function calcTrainingLoad(){
  const runs = state.runs || [];
  if(!runs.length) return null;
  const planStart = getPlanStartDate();
  if(!planStart) return null;
  const now = Date.now();
  const daysSincePlan = (now - new Date(planStart).getTime()) / 86400000;
  if(daysSincePlan < 14) return null; // hace menos de 2 semanas que existe este plan: todavía no hay con qué comparar de forma confiable
  const kmWithin = days => runs.reduce((a,r)=>{
    const diff = now - new Date(r.date).getTime();
    return (diff >= 0 && diff <= days*86400000) ? a + r.distanceKm : a;
  }, 0);
  const acuteKm = kmWithin(7);
  // el promedio "crónico" se divide por las semanas que lleva este plan (hasta 4), no siempre por 4, y la ventana
  // nunca mira más atrás de cuándo arrancó el plan -> las carreras de Strava importadas de antes no lo distorsionan.
  const chronicWindowDays = Math.min(28, daysSincePlan);
  const chronicWeeks = chronicWindowDays / 7;
  const chronicWeeklyAvg = kmWithin(chronicWindowDays) / chronicWeeks;
  if(chronicWeeklyAvg < 1) return null; // todavía no hay suficiente volumen para comparar
  const ratio = acuteKm / chronicWeeklyAvg;
  let level;
  if(ratio < 0.8) level = 'low';
  else if(ratio <= 1.3) level = 'optimal';
  else if(ratio <= 1.5) level = 'caution';
  else level = 'risk';
  return { ratio, level, acuteKm, chronicWeeklyAvg };
}

let viewingWeekOffset = 0;
function navigateWeek(delta){
  viewingWeekOffset += delta;
  haptic(10);
  renderPlan();
  const list = document.getElementById('plan-list');
  list.classList.remove('plan-slide-left','plan-slide-right');
  void list.offsetWidth;
  list.classList.add(delta > 0 ? 'plan-slide-left' : 'plan-slide-right');
}
function getWeekData(offset){
  const wn = (state.weekNumber||1) + offset;
  if(offset === 0) return { plan: state.plan, weekNumber: wn, editable: true, exists: true, mode:'current', weekStart: state.weekStart };
  if(offset < 0){
    const found = (state.planHistory||[]).find(w => w.weekNumber === wn);
    if(found) return { plan: found.plan, weekNumber: wn, editable: false, exists: true, mode:'past', weekStart: found.weekStart };
    return { plan: [], weekNumber: wn, editable: false, exists: false, mode:'past', weekStart: null };
  }
  if(offset === 1){
    // la semana que sigue ya no es "una estimación más" como el resto de las semanas futuras:
    // se calcula igual que la va a recibir el lunes (con el ajuste automático ya adentro) y el
    // coach del chat la puede editar -> se muestra como un plan firme, sin la etiqueta de estimado
    const nw = getNextWeekPlan();
    return { plan: nw.plan, weekNumber: nw.weekNumber, editable: false, exists: true, mode:'next', weekStart: nw.weekStart };
  }
  const futureStart = new Date(state.weekStart);
  futureStart.setDate(futureStart.getDate() + offset*7);
  const futureStartIso = futureStart.toISOString().slice(0,10);
  if(offset > 12) return { plan: [], weekNumber: wn, editable: false, exists: false, mode:'future', weekStart: futureStartIso };
  return { plan: generatePlan(state.profile, wn, futureStartIso), weekNumber: wn, editable: false, exists: true, mode:'future', weekStart: futureStartIso };
}
function renderPlan(){
  const z = state.profile.hrZones;
  const wd = getWeekData(viewingWeekOffset);
  const wn = wd.weekNumber;

  document.getElementById('plan-prev-btn').disabled = !getWeekData(viewingWeekOffset-1).exists;
  document.getElementById('plan-next-btn').disabled = !(viewingWeekOffset < 12);

  let label = t('plan_week_label',{n:wn});
  if(wd.exists && isCutbackWeek(wn) && wd.mode!=='future') label += ` · <span class="tag tag-mixto">${t('plan_cutback')}</span>`;
  if(wd.mode==='future') label += ` · <span class="tag tag-soon">${t('plan_estimate')}</span>`;
  if(wd.mode==='past') label += ` · <span class="tag tag-soon">${t('plan_past')}</span>`;
  const taperMult = (wd.exists && wd.mode!=='past' && wd.weekStart) ? taperMultiplier(state.profile, wd.weekStart) : 1;
  const isTapering = taperMult < 1;
  // el aviso de taper (etiqueta + mensaje) solo se muestra en semanas "firmes" (actual y la que
  // sigue) -- en una semana "estimado, puede ajustarse" no tiene sentido afirmar algo puntual
  // como "acá empieza tu puesta a punto" sobre una proyección que todavía puede cambiar entera
  const showTaperUi = isTapering && wd.mode!=='future';
  if(showTaperUi) label += ` · <span class="tag tag-mixto">${t('plan_taper_tag')}</span>`;
  // La semana de recuperación se recalcula siempre en base a wd.weekStart -- no depende de
  // que state.event siga cargado (isRecoveryWeek() ya contempla que se haya limpiado solo
  // al pasar la fecha, ver autoClearPastEvent()), así que se puede mostrar toda la semana,
  // no solo el día del rollover.
  const showRecoveryUi = wd.exists && wd.mode!=='past' && wd.mode!=='future' && wd.weekStart && isRecoveryWeek(wd.weekStart);
  if(showRecoveryUi) label += ` · <span class="tag tag-mixto">${t('plan_recovery_tag')}</span>`;
  document.getElementById('plan-week-info').innerHTML = label;
  const taperNote = document.getElementById('plan-taper-note');
  if(showTaperUi){
    taperNote.style.display='block';
    taperNote.textContent = taperMult <= 0.55 ? t('plan_taper_note_final') : t('plan_taper_note_early');
  } else {
    taperNote.style.display='none';
  }
  const recoveryNote = document.getElementById('plan-recovery-note');
  if(showRecoveryUi){
    recoveryNote.style.display='block';
    recoveryNote.textContent = t('plan_recovery_note');
  } else {
    recoveryNote.style.display='none';
  }

  if(!wd.exists){
    document.getElementById('plan-list').innerHTML = `<p class="muted" style="padding:24px 0; text-align:center;">${t('plan_no_data')}</p>`;
    renderPastWeeks();
    return;
  }

  const todayIdx = (new Date().getDay()+6)%7;
  document.getElementById('plan-list').innerHTML = wd.plan.map((d,i)=>{
    const lbl = planLabel(d);
    // d.custom viene de texto libre que el coach (IA) escribió a partir de un pedido del
    // usuario (modificar_sesion / ajuste de volumen) -- a diferencia de las descripciones
    // fijas de las traducciones o el nombre del evento (que ya se escapa en planLabel), acá
    // nunca escapamos antes, así que hay que hacerlo recién en este punto, al insertarlo
    // como HTML, para no habilitar un XSS guardado en el plan.
    const lblType = d.custom ? escapeHtml(lbl.type) : lbl.type;
    const lblDesc = d.custom ? escapeHtml(lbl.desc) : lbl.desc;
    let dateLbl = '';
    if(wd.weekStart){
      const dt = new Date(wd.weekStart+'T00:00:00'); dt.setDate(dt.getDate()+i);
      dateLbl = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
    }
    const isToday = wd.mode==='current' && i===todayIdx;
    const isPastDay = wd.mode==='current' && i<todayIdx;
    const canEdit = wd.editable && !isPastDay;
    let meta = '';
    if(d.raceDay && state.event){
      meta = `<span class="tag tag-mixto">${escapeHtml(state.event.name)}</span>`;
    } else {
      // d.dist>0 acá es a propósito, no solo d.terrain/d.zone: un día de
      // descanso nunca debería mostrar cartel de terreno/zona, ni siquiera
      // si por algún dato viejo esos campos quedaran seteados -- así el
      // cartel de "Descanso" siempre gana en un día sin distancia.
      if(d.dist>0 && d.terrain) meta += `<span class="tag tag-${d.terrain}">${t('ob_terrain_'+d.terrain)}</span>`;
      if(d.dist>0 && d.zone) meta += `<span class="zone-chip zone-${d.zone}">${t('zone_word')} ${d.zone}</span>`;
      if(!meta) meta = t('type_rest');
    }
    const statusIcon = d.status==='done' ? `<div class="icon-sq" style="width:16px; height:16px; color:var(--hivis);">${ICONS.check}</div>` : d.status==='skipped' ? `<div class="icon-sq" style="width:16px; height:16px; color:var(--danger);">${ICONS.cross}</div>` : '';
    const zoneDetail = d.zone ? `<br><br><span class="zone-chip zone-${d.zone}">${t('zone_word')} ${d.zone}</span> <span class="mono muted">${z[d.zone].min}-${z[d.zone].max} bpm</span>` : '';
    let statusBlock = '';
    if(d.status==='done'){
      const run = d.linkedRunId ? state.runs.find(r=>r.id===d.linkedRunId) : null;
      let doneText = t('plan_status_done');
      if(run){
        const pMin = run.distanceKm>0.02 ? (run.durationSec/60)/run.distanceKm : 0;
        doneText += `: ${fmtDist(run.distanceKm)}${distUnit()} · ${fmtPace(pMin)}/${distUnit()}`;
      }
      statusBlock = canEdit ? `<p style="color:var(--hivis); font-weight:700; margin-top:12px;">${doneText} · <button class="small-link" onclick="markSession(${i},null)">${t('plan_undo')}</button></p>` : `<p style="color:var(--hivis); font-weight:700; margin-top:12px;">${doneText}${isPastDay?' · '+t('plan_locked'):''}</p>`;
    }
    else if(d.status==='skipped') statusBlock = canEdit ? `<p style="color:var(--danger); font-weight:700; margin-top:12px;">${t('plan_status_skipped')} · <button class="small-link" onclick="markSession(${i},null)">${t('plan_undo')}</button></p>` : `<p style="color:var(--danger); font-weight:700; margin-top:12px;">${t('plan_status_skipped')}${isPastDay?' · '+t('plan_locked'):''}</p>`;
    else if(d.dist>0 && canEdit){
      statusBlock = `<div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;"><button class="btn btn-outline btn-sm" onclick="markSession(${i},'done')"><span class="icon-sq" style="width:14px; height:14px;">${ICONS.check}</span> ${t('plan_mark_done')}</button><button class="btn btn-outline btn-sm" onclick="markSession(${i},'skipped')"><span class="icon-sq" style="width:14px; height:14px;">${ICONS.cross}</span> ${t('plan_mark_skipped')}</button>${isToday?`<button class="btn btn-outline btn-sm" id="sync-today-btn" onclick="syncTodayNow()"><span class="icon-sq" style="width:14px; height:14px;">${ICONS.refresh}</span> ${t('plan_sync_button')}</button>`:''}</div>`;
    }
    return `<div>
      <div class="day-row" onclick="toggleDay(${i})">
        <div class="day-badge"><div class="d">${t('day_'+d.day).slice(0,3)}</div>${dateLbl?`<div class="mono muted" style="font-size:10px; margin-top:2px;">${dateLbl}</div>`:''}</div>
        <div class="day-info"><div class="t">${lblType}</div><div class="m">${meta}</div></div>
        <div style="text-align:right;"><div class="day-dist">${d.dist>0? fmtDist(d.dist,1)+' '+distUnit():''}</div>${statusIcon}</div>
      </div>
      <div class="day-detail" id="detail-${i}">${lblDesc}${zoneDetail}${statusBlock}</div>
    </div>`;
  }).join('');
  renderPastWeeks();
}
function renderPastWeeks(){
  const card = document.getElementById('past-weeks-card');
  if(!state.planHistory || state.planHistory.length===0){ card.style.display='none'; return; }
  card.style.display='block';
  document.getElementById('past-weeks-list').innerHTML = state.planHistory.slice().reverse().map(w=>{
    const doneCount = w.plan.filter(d=>d.status==='done').length;
    const totalSessions = w.plan.filter(d=>d.dist>0).length;
    const plannedKm = w.plan.reduce((a,d)=>a+d.dist,0);
    const offset = w.weekNumber - (state.weekNumber||1);
    return `<div style="padding:10px 0; border-bottom:1px solid var(--asphalt-3); cursor:pointer;" onclick="viewingWeekOffset=${offset}; renderPlan();">
      <div style="display:flex; justify-content:space-between;"><span style="font-weight:700;">${t('plan_week_label',{n:w.weekNumber})}</span><span class="muted mono" style="font-size:11.5px;">${w.weekStart}</span></div>
      <p class="muted" style="margin-top:4px; font-size:12.5px;">${doneCount}/${totalSessions} ${t('home_sessions').toLowerCase()} · ${plannedKm}km ${t('home_km_planned').toLowerCase()}</p>
    </div>`;
  }).join('');
}
function toggleDay(i){ if(planSwipeSuppressClick) return; document.getElementById('detail-'+i).classList.toggle('open'); }
function markSession(i, status){
  state.plan[i].status = status;
  if(!status) state.plan[i].linkedRunId = null;
  renderPlan(); renderHome(); persist();
  if(status === 'done'){
    haptic([15,40,15]);
    showToast(t('session_done_msg'), 'success');
  }
}

const ZONE_PCT = {1:'50–60%', 2:'60–70%', 3:'70–80%', 4:'80–90%', 5:'90–100%'};
function renderZones(){
  const z = state.profile.hrZones;
  // hrKnown distingue si la FC máxima es una estimación por edad o si el corredor la
  // confirmó (por chat, con el coach) -- antes este flag no se usaba en ningún lado, y
  // el texto de acá siempre decía "se calcula según tu edad" aunque ya hubiera una FC
  // máxima real cargada. Las claves perfil_zones_estimated/perfil_zones_tested ya
  // existían traducidas a los 6 idiomas pero nunca se usaban.
  const statusEl = document.getElementById('zones-status');
  if(statusEl) statusEl.textContent = state.profile.hrKnown ? t('perfil_zones_tested') : t('perfil_zones_estimated');
  document.getElementById('zones-list').innerHTML = [1,2,3,4,5].map(n=>`
    <div class="zone-row">
      <div><span class="zone-chip zone-${n}">${t('zone_word')} ${n}</span><div class="zd">${t('zdesc_'+n)} · ${ZONE_PCT[n]}</div></div>
      <div style="display:flex; align-items:center; gap:6px;">
        <input type="number" id="zone-${n}-min" value="${z[n].min}" style="width:52px; background:var(--asphalt-3); border:1.5px solid var(--asphalt-4); color:var(--chalk); padding:6px 4px; border-radius:6px; text-align:center; font-size:13px;">
        <span class="muted">–</span>
        <input type="number" id="zone-${n}-max" value="${z[n].max}" style="width:52px; background:var(--asphalt-3); border:1.5px solid var(--asphalt-4); color:var(--chalk); padding:6px 4px; border-radius:6px; text-align:center; font-size:13px;">
      </div>
    </div>`).join('');
}
function saveCustomZones(){
  const newZones = {};
  for(let n=1;n<=5;n++){
    newZones[n] = {
      min: parseInt(document.getElementById(`zone-${n}-min`).value) || 0,
      max: parseInt(document.getElementById(`zone-${n}-max`).value) || 0
    };
  }
  state.profile.hrZones = newZones;
  renderZones(); renderPlan(); persist();
  flashSaved('save-zones-btn');
}

/* ---- registro de molestias/lesiones ----
   Antes, "Me duele algo" era un chip que solo mandaba un mensaje de chat que se perdía
   en la conversación -- no quedaba ningún registro, y una molestia mencionada hace tres
   semanas no tenía forma de seguir influyendo en el plan. Ahora queda guardada con fecha
   y zona del cuerpo, se puede ver y marcar como resuelta desde Perfil, y mientras esté
   activa (ver activePainEntries) sube la "cautela" del plan -- ver trainingCaution() --
   y se le avisa al coach en cada mensaje (ver buildContext). */
const PAIN_BODY_PARTS = ['rodilla','tobillo','pantorrilla','isquios','cadera','espalda','pie','cuadriceps','otro'];
document.getElementById('readiness-choice').addEventListener('click', e=>{
  const c=e.target.closest('.choice'); if(!c) return;
  haptic(15);
  logReadiness(c.dataset.v);
});
document.getElementById('pain-body-choice').addEventListener('click', e=>{
  const c=e.target.closest('.choice'); if(!c) return;
  [...document.getElementById('pain-body-choice').children].forEach(x=>x.classList.remove('active')); c.classList.add('active');
});
function openPainModal(){
  document.getElementById('pain-note').value = '';
  [...document.getElementById('pain-body-choice').children].forEach(c=>c.classList.remove('active'));
  document.getElementById('pain-modal').style.display = 'block';
}
function closePainModal(){ document.getElementById('pain-modal').style.display = 'none'; }
function openPainInfo(){ document.getElementById('pain-info-modal').style.display = 'block'; }
function closePainInfo(){ document.getElementById('pain-info-modal').style.display = 'none'; }
async function savePainLog(){
  const chosen = document.querySelector('#pain-body-choice .choice.active');
  if(!chosen){ showToast(t('pain_body_required_err'), 'error'); return; }
  const bodyPart = chosen.dataset.v;
  const note = document.getElementById('pain-note').value.trim().slice(0,200);
  if(!state.painLog) state.painLog = [];
  state.painLog.push({id:Date.now(), date:localDateISO(), bodyPart, note, active:true, checkinSent:false});
  closePainModal();
  renderPainLog();
  await persist();
  // le avisamos al coach en el momento -- arma el mensaje como si el corredor lo hubiera
  // escrito, así la respuesta que llega ya trae consejo específico para esa molestia, en
  // vez de quedar solo como un dato guardado que nadie comenta.
  const label = t('pain_body_'+bodyPart);
  const chatInput = document.getElementById('chatInput');
  chatInput.value = note ? `Me duele: ${label}. ${note}` : `Me duele: ${label}.`;
  sendChat();
  if(await showConfirm(t('rating_lower_intensity_confirm'))){
    lowerRemainingIntensity(-15);
    await persist();
  }
}
function resolvePainLog(id){
  const entry = (state.painLog||[]).find(p=>String(p.id)===String(id));
  if(!entry) return;
  entry.active = false;
  entry.resolvedDate = localDateISO();
  renderPainLog(); persist();
}
async function deletePainLog(id){
  if(!(await showConfirm(t('confirm_delete'), {danger:true, confirmText:t('delete_word')}))) return;
  state.painLog = (state.painLog||[]).filter(p=>String(p.id)!==String(id));
  renderPainLog(); persist();
}
function activePainEntries(withinDays){
  // molestias activas -- opcionalmente solo las de los últimos N días, que es lo que
  // importa para subir la cautela del plan (una molestia de hace 3 meses ya resuelta,
  // o vieja y nunca actualizada, no debería seguir bajando el volumen para siempre)
  const cutoff = withinDays ? Date.now() - withinDays*86400000 : 0;
  return (state.painLog||[]).filter(p => p.active && new Date(p.date+'T00:00:00').getTime() >= cutoff);
}
function checkPainCheckins(){
  // Una molestia cargada y nunca marcada como resuelta es una señal de que puede ser
  // algo más que una simple sobrecarga pasajera -- a las 2 semanas el coach pregunta
  // solo, en vez de depender de que el corredor se acuerde de volver a Perfil a
  // actualizarla. checkinSent evita mandar el mismo mensaje de nuevo en cada carga de
  // la app una vez que ya se avisó por esa molestia puntual.
  if(!state.painLog || !state.painLog.length) return;
  let sentAny = false;
  state.painLog.forEach(p=>{
    if(!p.active || p.checkinSent) return;
    const ageDays = (Date.now() - new Date(p.date+'T00:00:00').getTime()) / 86400000;
    if(ageDays < 14) return;
    p.checkinSent = true;
    sentAny = true;
    state.chat.push({role:'coach', text: t('coach_pain_checkin', {part: t('pain_body_'+p.bodyPart)}), ts:Date.now()});
  });
  if(sentAny){ renderChat(); persist(); }
}
function renderPainLog(){
  const el = document.getElementById('pain-log-list');
  if(!el) return;
  const entries = (state.painLog||[]).slice().reverse();
  if(!entries.length){ el.innerHTML = `<p class="muted" style="text-align:center; padding:8px 0;">${t('pain_list_empty')}</p>`; return; }
  el.innerHTML = entries.map(p=>{
    const dateStr = new Date(p.date+'T00:00:00').toLocaleDateString(LOCALE_MAP[lang], {day:'numeric', month:'short'});
    return `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:10px 0; border-bottom:1px solid var(--asphalt-3);">
      <div style="min-width:0;">
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <span style="font-weight:700; font-size:13.5px;">${t('pain_body_'+p.bodyPart)}</span>
          <span class="tag tag-${p.active?'load-caution':'mixto'}">${p.active ? t('pain_active_tag') : t('pain_resolved_tag')}</span>
        </div>
        <div class="muted" style="font-size:12px; margin-top:2px;">${dateStr}${p.note?' · '+escapeHtml(p.note):''}</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
        ${p.active ? `<button class="small-link" onclick="resolvePainLog(${p.id})" style="font-size:11.5px; padding:4px 2px;">${t('pain_resolve_btn')}</button>` : ''}
        <button onclick="deletePainLog(${p.id})" aria-label="${t('aria_delete')}" style="background:none; border:none; color:var(--mist-dim); cursor:pointer; padding:4px; display:flex;"><span class="icon-sq" style="width:16px; height:16px;">${ICONS.trash}</span></button>
      </div>
    </div>`;
  }).join('');
}

/* ---- check-in de sueño/energía ----
   Antes, "¿Cómo dormiste anoche?" era solo un mensaje decorativo que rotaba en la
   pantalla de Inicio -- aunque el corredor contestara en el chat, esa respuesta no
   quedaba guardada en ningún lado ni afectaba nada. Ahora es un check-in real: se
   responde con un toque (mal/regular/bien), queda guardado por día, se lo pasamos al
   coach en cada mensaje, y si la noche fue mala se le ofrece al corredor bajar un poco
   la sesión de HOY puntual (no toda la semana, que sería una sobrecorrección por una
   sola mala noche). */
// BUG REAL encontrado a partir de un reporte del usuario ("ya corrí hoy y la tarjeta de
// inicio sigue mostrando la próxima sesión, no lo que ya corrí"): todayISO() usaba
// new Date().toISOString().slice(0,10) -- eso da la fecha calendario en UTC, NO la
// fecha calendario local del corredor. Para un huso horario negativo como el de
// Argentina (UTC-3), el calendario en UTC ya pasó a "mañana" durante las últimas 3
// horas de cada día local (entre las 21:00 y las 23:59) -- si el corredor corre a la
// tarde/noche y después mira la app pasadas las 21:00, todayISO() devuelve la fecha de
// MAÑANA mientras que la carrera se guardó con la fecha (en UTC) de HOY, así que dejan
// de coincidir y la tarjeta "ya corriste hoy" nunca se activa. localDateISO() arma la
// fecha a mano con los componentes LOCALES de la fecha (año/mes/día), nunca se va para
// el otro lado del huso horario. todayISO() ahora es un caso particular de esto (hoy
// = "la fecha local de este instante").
// Devuelve el huso horario IANA del dispositivo (ej. "America/Argentina/Buenos_Aires",
// "America/New_York") tal como lo tiene configurado el sistema operativo -- no hace
// falta preguntarle nada al corredor, el navegador ya lo sabe. Se guarda en
// state.profile.tz para que el recordatorio diario del servidor (que no tiene forma de
// saber en qué huso horario está cada celular) le mande el aviso a la hora local de
// cada uno, sea cual sea el país. undefined en navegadores viejísimos que no soportan
// Intl -- ahí el servidor cae a un huso por default en vez de romperse.
function detectDeviceTz(){
  try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; }
  catch(e){ return undefined; }
}
function localDateISO(d){
  const dt = d ? new Date(d) : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const day = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayISO(){ return localDateISO(); }
function todayReadinessEntry(){
  return (state.readinessLog||[]).find(r=>r.date === todayISO());
}
function renderReadinessCard(){
  const card = document.getElementById('readiness-card');
  if(!card) return;
  card.style.display = (state.onboarded && !todayReadinessEntry()) ? 'block' : 'none';
}
function lowerTodaySession(pct){
  const idx = (new Date().getDay()+6)%7;
  const today = state.plan[idx];
  if(!today || today.dist<=0 || today.status) return false;
  const factor = 1 + (pct/100);
  today.dist = Math.max(1, Math.round(today.dist*factor));
  renderPlan(); renderHome();
  return true;
}
async function logReadiness(quality){
  if(!state.readinessLog) state.readinessLog = [];
  state.readinessLog = state.readinessLog.filter(r=>r.date !== todayISO());
  state.readinessLog.push({date: todayISO(), quality});
  // no hace falta guardar esto para siempre -- alcanza con una ventana razonable
  if(state.readinessLog.length > 60) state.readinessLog = state.readinessLog.slice(-60);
  renderReadinessCard();
  await persist();
  if(quality === 'mal'){
    const idx = (new Date().getDay()+6)%7;
    const today = state.plan[idx];
    const hasSessionToday = today && today.dist>0 && !today.status;
    if(hasSessionToday && await showConfirm(t('readiness_lower_confirm'))){
      lowerTodaySession(-15);
      await persist();
    }
    // le avisamos al coach en el momento, tenga o no sesión hoy -- así puede
    // tenerlo en cuenta si le preguntan algo en la charla.
    const chatInput = document.getElementById('chatInput');
    if(chatInput){ chatInput.value = t('readiness_chat_bad'); sendChat(); }
  }
}

let editingShoeId = null;
function renderPerfil(){
  const p = state.profile;
  document.getElementById('perfil-initial').textContent = (p.name[0]||'?').toUpperCase();
  document.getElementById('perfil-sub').textContent = `${p.weeklyKm}km/sem · ${t('ob_goal_'+p.goal)}`;
  const avatarImg = document.getElementById('perfil-avatar-img');
  const avatarInitial = document.getElementById('perfil-initial');
  const removeBtn = document.getElementById('perfil-remove-photo');
  if(p.avatarPhoto){
    avatarImg.src = p.avatarPhoto;
    avatarImg.style.display = 'block';
    avatarInitial.style.display = 'none';
    removeBtn.style.display = 'block';
  }else{
    avatarImg.style.display = 'none';
    avatarImg.removeAttribute('src');
    avatarInitial.style.display = '';
    removeBtn.style.display = 'none';
  }
  renderPainLog();

  const editingPersonal = ['perfil-weight','perfil-height','perfil-racedate'].includes(document.activeElement && document.activeElement.id);
  if(!editingPersonal){
    document.getElementById('perfil-weight').value = p.weight || '';
    document.getElementById('perfil-height').value = p.height || '';
    document.getElementById('perfil-goal').value = p.goal || 'start';
    document.getElementById('perfil-racedate').value = p.raceDate || '';
    dateBoxUpdaters['perfil-racedate'] && dateBoxUpdaters['perfil-racedate']();
    [...document.getElementById('perfil-terrain-choice').children].forEach(c=>c.classList.toggle('active', c.dataset.v===p.terrain));
  }
  const editingGoals = ['perfil-weekly-goal','perfil-goal-note'].includes(document.activeElement && document.activeElement.id);
  if(!editingGoals){
    document.getElementById('perfil-weekly-goal').value = p.weeklyGoalKm || '';
    document.getElementById('perfil-goal-note').value = p.goalNote || '';
  }

  const list = document.getElementById('shoe-list');
  list.innerHTML = state.shoes.length===0 ? `<div style="text-align:center; padding:18px 0;"><div class="icon-sq" style="width:26px; height:26px; margin:0 auto 8px; color:var(--mist-dim);">${ICONS.shoe}</div><p class="muted" style="margin:0; font-size:13px;">${t('perfil_no_shoes')}</p></div>` : state.shoes.map(s=>{
    if(s.id === editingShoeId){
      return `<div class="shoe-item">
        <div class="shoe-icon">${ICONS.shoe}</div>
        <div class="shoe-info" style="display:flex; flex-direction:column; gap:6px;">
          <input type="text" id="edit-shoe-name-${s.id}" value="${escapeHtml(s.name)}" style="background:var(--asphalt-3); border:1.5px solid var(--asphalt-4); color:var(--chalk); padding:9px; border-radius:8px; font-size:13.5px;">
          <select id="edit-shoe-terrain-${s.id}" style="background:var(--asphalt-3); border:1.5px solid var(--asphalt-4); color:var(--chalk); padding:9px; border-radius:8px; font-size:13.5px;">
            <option value="asfalto" ${s.terrain==='asfalto'?'selected':''}>${t('ob_terrain_asfalto')}</option>
            <option value="trail" ${s.terrain==='trail'?'selected':''}>${t('ob_terrain_trail')}</option>
            <option value="mixto" ${s.terrain==='mixto'?'selected':''}>${t('ob_terrain_mixto')}</option>
          </select>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-primary btn-sm" onclick="saveEditShoe(${s.id})">${t('save_word')}</button>
            <button class="btn btn-outline btn-sm" onclick="cancelEditShoe()">${t('cancel_word')}</button>
          </div>
        </div>
      </div>`;
    }
    const threshold = s.terrain==='trail'?400:s.terrain==='mixto'?500:600;
    const pct = Math.min(100,(s.km/threshold)*100);
    return `<div class="shoe-row">
      <div class="shoe-icon">${ICONS.shoe}</div>
      <div class="swipe-item">
        <div class="swipe-action-delete" role="button" tabindex="0" aria-label="${t('aria_delete')}" onclick="deleteShoe(${s.id})"><span class="icon-sq" style="width:20px; height:20px;">${ICONS.trash}</span></div>
        <div class="swipe-content"><div class="shoe-info">
          <div class="n">${escapeHtml(s.name)} <span class="tag tag-${s.terrain}" style="margin-left:4px;">${t('ob_terrain_'+s.terrain)}</span></div>
          <div class="muted mono" style="font-size:11.5px; margin-top:2px;">${s.km.toFixed(0)} / ${threshold} km</div>
          <div class="wearbar ${pct>80?'warn':''}"><div style="width:${pct}%;"></div></div></div>
          <button class="small-link" style="display:inline-flex;" aria-label="${t('aria_edit')}" onclick="startEditShoe(${s.id})"><span class="icon-sq" style="width:15px; height:15px;">${ICONS.edit}</span></button>
        </div>
      </div>
    </div>`;
  }).join('');

  const evBox = document.getElementById('event-box');
  if(state.event){
    const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    const days = Math.round((new Date(state.event.date+'T00:00:00')-todayMidnight)/86400000);
    // Ritmo objetivo estimado (fórmula de Riegel) a partir de la marca personal más cercana
    // en distancia a la meta -- preferimos la distancia puntual de este evento (si la cargó)
    // por sobre la distancia genérica del objetivo de entrenamiento, porque puede no coincidir
    // (ej: el objetivo del plan es "10k" pero esta carrera puntual es de 15km).
    const goalKm = (state.event.distanceKm > 0) ? state.event.distanceKm : getGoalRaceKm();
    const prediction = goalKm ? predictRaceTime(goalKm) : null;
    const paceBlock = prediction ? `<div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--asphalt-3);">
      <p class="muted" style="margin:0 0 6px; font-size:12px;">${t('perfil_predicted_pace_label')} · ${fmtDist(goalKm,1)} ${distUnit()}</p>
      <p class="mono" style="font-size:20px; font-weight:800; color:var(--hivis); margin:0;">${fmtPace((prediction.predictedSec/60)/goalKm)} /${distUnit()}</p>
      <p class="muted" style="margin:6px 0 0; font-size:11.5px;">${t('perfil_predicted_pace_note', {ref: fmtDist(prediction.refDistanceKm,1)+' '+distUnit(), time: fmtTime(Math.round(prediction.predictedSec))})}</p>
    </div>` : '';
    evBox.innerHTML = `<p style="font-size:14.5px; font-weight:700;">${escapeHtml(state.event.name)} <span class="tag tag-${state.event.type==='ruta'?'asfalto':state.event.type==='trail'?'trail':'mixto'}">${t('ev_type_'+state.event.type)}</span></p>
      <p class="display" style="font-size:34px; color:var(--hivis); margin-top:4px;">${Math.max(0,days)} <span style="font-size:13px; font-family:Inter; color:var(--mist);">${t('perfil_event_days')}</span></p>
      <button class="small-link" style="color:var(--danger); margin-top:6px;" onclick="deleteEvent()">${t('delete_event')}</button>
      ${paceBlock}`;
    document.getElementById('ev-name').value = state.event.name;
    document.getElementById('ev-distance').value = state.event.distanceKm || '';
    document.getElementById('ev-date').value = state.event.date;
    dateBoxUpdaters['ev-date'] && dateBoxUpdaters['ev-date']();
    document.getElementById('ev-type').value = state.event.type;
  } else { evBox.innerHTML = `<div style="text-align:center; padding:10px 0;"><div class="icon-sq" style="width:24px; height:24px; margin:0 auto 8px; color:var(--mist-dim);">${ICONS.flag}</div><p class="muted" style="margin:0; font-size:13px;">${t('perfil_no_event')}</p></div>`; }

  updateCredits();
}
// ---- Foto de perfil -----
// Se guarda como JPEG chico (200x200, recorte centrado tipo "cover") codificado en
// base64 dentro de state.profile.avatarPhoto -- así no hace falta un bucket de
// almacenamiento nuevo en Supabase, viaja con el resto del estado en app_state.
function handleAvatarPhotoChange(e){
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if(!file || !file.type || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    const img = new Image();
    img.onload = function(){
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size/img.width, size/img.height);
      const w = img.width*scale, h = img.height*scale;
      ctx.drawImage(img, (size-w)/2, (size-h)/2, w, h);
      state.profile.avatarPhoto = canvas.toDataURL('image/jpeg', 0.6);
      renderPerfil();
      persist();
    };
    img.onerror = function(){ showToast(t('perfil_photo_error'), 'error'); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
function removeAvatarPhoto(e){
  if(e) e.stopPropagation();
  delete state.profile.avatarPhoto;
  renderPerfil();
  persist();
}
function updateCredits(){
  document.getElementById('credits-text').textContent = t('perfil_credits');
  // Versión visible del build cargado -- sin esto, no había forma de que el usuario
  // (ni nosotros, por lo que nos cuenta) confirmara si ya estaba probando la versión
  // nueva o todavía una vieja cacheada, lo que hizo perder tiempo varias veces
  // diagnosticando bugs ya arreglados en una versión que el celular no había tomado.
  const versionEl = document.getElementById('app-version-text');
  if(versionEl) versionEl.textContent = 'v' + APP_VERSION;
}
document.getElementById('perfil-name').addEventListener('input', ()=>{ updateCredits(); });
document.getElementById('perfil-name').addEventListener('change', ()=>{
  state.profile.name = document.getElementById('perfil-name').value.trim() || state.profile.name;
  persist();
});

/* ================= NAV ================= */
async function refreshStateFromServer(){
  if(!currentUserId) return;
  try{
    const { data } = await supabaseClient.from('app_state').select('data').eq('user_id', currentUserId).maybeSingle();
    if(data && data.data && Object.keys(data.data).length){
      const incomingRuns = (data.data.runs||[]).length;
      const currentRuns = (state.runs||[]).length;
      if(incomingRuns < currentRuns){
        // el servidor tiene menos carreras que las que ya tenemos acá (por ejemplo, una que se guardó sin
        // conexión y todavía no se sincronizó) -> no pisamos lo que ya tenemos, reintentamos guardarlo
        persist();
      } else {
        const prevRunIds = new Set((state.runs||[]).map(r=>String(r.id)));
        state = data.data;
        checkShoeWearAlerts();
        checkHrMaxFromRuns();
        // Las carreras que llegan nuevas por la sincronización con Strava también pueden ser récord.
        const newRuns = (state.runs||[]).filter(r=>!prevRunIds.has(String(r.id)));
        if(newRuns.length){ newRuns.forEach(checkNewPR); persist(); }
      }
    }
  }catch(e){ console.error('refresh error', e); }
}
let pullStartY = 0, pullTriggered = false, pullActive = false;
document.addEventListener('touchstart', e=>{
  // El chat tiene su propio scroll interno (#chatLog) y la página en sí no se mueve
  // mientras esa vista está activa -- sin este chequeo, cualquier arrastre hacia
  // abajo dentro del chat se interpretaba como "pull to refresh" de toda la app.
  if(e.target.closest && e.target.closest('#coachChatWrap')){ pullActive = false; return; }
  const scroller = document.scrollingElement || document.documentElement;
  if(scroller.scrollTop <= 0 && document.getElementById('tabbar').style.display!=='none'){
    pullStartY = e.touches[0].clientY;
    pullTriggered = false;
    pullActive = true;
  } else { pullActive = false; }
}, {passive:true});
document.addEventListener('touchmove', e=>{
  if(!pullActive || pullTriggered) return;
  const scroller = document.scrollingElement || document.documentElement;
  if(scroller.scrollTop > 0) return;
  const delta = e.touches[0].clientY - pullStartY;
  if(delta > 90){
    pullTriggered = true;
    doPullRefresh();
  }
}, {passive:true});
document.addEventListener('touchend', ()=>{ pullActive = false; }, {passive:true});

/* ---- swipe-to-delete (history + shoes list) ---- */
let swipeStartX = 0, swipeStartY = 0, swipeContentEl = null, swipeDragging = false, swipeBaseX = 0, swipeLastX = 0, swipeSuppressClick = false;
let swipeRafPending = false;
const SWIPE_REVEAL = 78;
function swipeSetX(el, x){
  el.style.transform = `translate3d(${Math.round(x)}px,0,0)`;
}
function swipeCloseAll(except){
  document.querySelectorAll('.swipe-content.swipe-open').forEach(el=>{
    if(el === except) return;
    el.classList.add('swipe-anim');
    swipeSetX(el, 0);
    el.classList.remove('swipe-open');
  });
}
document.addEventListener('touchstart', e=>{
  const item = e.target.closest ? e.target.closest('.swipe-item') : null;
  if(!item){ swipeCloseAll(); swipeContentEl = null; return; }
  swipeContentEl = item.querySelector('.swipe-content');
  swipeCloseAll(swipeContentEl);
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeDragging = false;
  swipeBaseX = swipeContentEl.classList.contains('swipe-open') ? -SWIPE_REVEAL : 0;
  swipeLastX = swipeBaseX;
  swipeContentEl.classList.remove('swipe-anim');
}, {passive:true});
document.addEventListener('touchmove', e=>{
  if(!swipeContentEl) return;
  const dx = e.touches[0].clientX - swipeStartX;
  const dy = e.touches[0].clientY - swipeStartY;
  if(!swipeDragging){
    if(Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)){
      swipeDragging = true;
    } else if(Math.abs(dy) > 6){
      swipeContentEl = null;
      return;
    } else {
      return;
    }
  }
  let x = swipeBaseX + dx;
  x = Math.max(-SWIPE_REVEAL - 12, Math.min(0, x));
  swipeLastX = x;
  if(!swipeRafPending){
    swipeRafPending = true;
    requestAnimationFrame(()=>{
      swipeRafPending = false;
      if(swipeContentEl) swipeSetX(swipeContentEl, swipeLastX);
    });
  }
  e.preventDefault();
}, {passive:false});
document.addEventListener('touchend', ()=>{
  if(!swipeContentEl){ return; }
  if(swipeDragging){
    const el = swipeContentEl;
    el.classList.add('swipe-anim');
    if(swipeLastX < -SWIPE_REVEAL/2){
      swipeSetX(el, -SWIPE_REVEAL);
      el.classList.add('swipe-open');
      haptic(10);
    } else {
      swipeSetX(el, 0);
      el.classList.remove('swipe-open');
    }
    swipeSuppressClick = true;
    setTimeout(()=>{ swipeSuppressClick = false; }, 300);
  }
  swipeContentEl = null;
  swipeDragging = false;
}, {passive:true});

/* ---- deslizar el plan semanal para cambiar de semana (como las fotos de Instagram) ---- */
let planSwipeStartX = 0, planSwipeStartY = 0, planSwipeDragging = false, planSwipeActive = false;
let planSwipeSuppressClick = false;
const PLAN_SWIPE_THRESHOLD = 55;
document.addEventListener('touchstart', e=>{
  const list = e.target.closest ? e.target.closest('#plan-list') : null;
  planSwipeActive = !!list;
  if(!planSwipeActive) return;
  planSwipeStartX = e.touches[0].clientX;
  planSwipeStartY = e.touches[0].clientY;
  planSwipeDragging = false;
}, {passive:true});
document.addEventListener('touchmove', e=>{
  if(!planSwipeActive) return;
  const dx = e.touches[0].clientX - planSwipeStartX;
  const dy = e.touches[0].clientY - planSwipeStartY;
  if(!planSwipeDragging){
    if(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)*1.3){
      planSwipeDragging = true;
    } else if(Math.abs(dy) > 8){
      planSwipeActive = false;
      return;
    } else {
      return;
    }
  }
  e.preventDefault();
}, {passive:false});
document.addEventListener('touchend', e=>{
  if(!planSwipeActive){ return; }
  if(planSwipeDragging){
    const dx = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : planSwipeStartX) - planSwipeStartX;
    if(dx <= -PLAN_SWIPE_THRESHOLD){
      const nextBtn = document.getElementById('plan-next-btn');
      if(nextBtn && !nextBtn.disabled) navigateWeek(1);
    } else if(dx >= PLAN_SWIPE_THRESHOLD){
      const prevBtn = document.getElementById('plan-prev-btn');
      if(prevBtn && !prevBtn.disabled) navigateWeek(-1);
    }
    planSwipeSuppressClick = true;
    setTimeout(()=>{ planSwipeSuppressClick = false; }, 300);
  }
  planSwipeActive = false;
  planSwipeDragging = false;
}, {passive:true});

/* ---- alto y posición real de #coachChatWrap (fix para iOS Safari / PWA standalone) ----
   Intentos anteriores dejaban la barra de escribir con "position:fixed" independiente
   y le calculaban un "bottom" a mano (con CSS, o midiendo con getBoundingClientRect).
   Los dos fallaban en el iPhone real por el mismo motivo de fondo: en iOS, cuando
   aparece el teclado, el "layout viewport" (window.innerHeight, y todo lo que dependa
   de él) NO se achica -- sobre todo en modo standalone/agregado a inicio -- sigue
   midiendo la pantalla completa como si el teclado no existiera. Entonces cualquier
   "bottom:0" quedaba tapado por el teclado, dejando ver contenido del chat detrás.
   Además, escuchar el evento "scroll" del visualViewport para volver a calcular
   posición hacía que la barra se reacomodara (y por lo tanto pareciera "moverse")
   mientras el usuario scrolleaba los mensajes.
   La solución de fondo: en vez de una barra "fixed" flotando sola, todo el chat
   (título + mensajes + barra de escribir) vive DENTRO de #coachChatWrap, un único
   contenedor flex-column cuyo alto se fija explícitamente por JS usando
   window.visualViewport (la única fuente que sabe cuánta pantalla está realmente
   visible arriba del teclado en iOS). La barra de escribir es simplemente el último
   hijo del flex-column -- no tiene posición propia que calcular ni que se pueda
   desincronizar, así que no puede "flotar mal" ni moverse al hacer scroll interno
   del chat (ese scroll queda contenido en #chatLog, no en la página ni en el
   visualViewport). Solo se vuelve a medir cuando el teclado realmente abre/cierra
   (evento resize) o cuando la ventana cambia de tamaño -- nunca durante el scroll. */
// Alto del teclado nativo en píxeles, reportado por el plugin Keyboard de Capacitor
// (ver el IIFE más abajo) -- 0 cuando está cerrado. Solo tiene sentido en la app nativa.
let nativeKeyboardHeightPx = 0;
function syncCoachChatLayout(){
  const wrap = document.getElementById('coachChatWrap');
  const header = document.getElementById('mainHeader');
  const tabbar = document.getElementById('tabbar');
  const chatBar = document.getElementById('chatBar');
  const scrollBtnWrap = document.getElementById('chatScrollBtnWrap');
  if(!wrap) return;
  const kbOpen = document.body.classList.contains('chat-kb-open');
  const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  let viewportH, viewportOffsetTop;
  if(isNativeApp){
    // App nativa (Capacitor/WKWebView): NO usamos window.visualViewport acá. Dentro del
    // WKWebView de Capacitor, visualViewport es conocido por comportarse de forma poco
    // confiable (a veces no dispara resize al abrir/cerrar el teclado, a veces se queda
    // con un valor viejo pegado) -- exactamente los síntomas que veníamos persiguiendo
    // sin poder resolver del todo. En su lugar, el plugin nativo Keyboard nos avisa con
    // eventos reales (keyboardWillShow/Hide) y nos da el alto exacto del teclado, que
    // guardamos en nativeKeyboardHeightPx -- restamos eso de window.innerHeight, que en
    // la app nativa SÍ es estable y no se ve afectado por el teclado.
    viewportH = window.innerHeight - (kbOpen ? nativeKeyboardHeightPx : 0);
    viewportOffsetTop = 0;
  } else {
    // Versión web (Safari / PWA agregada a inicio): acá visualViewport sí es la fuente
    // correcta mientras el teclado está realmente abierto. Con el teclado cerrado (blur
    // ya disparado) usamos window.innerHeight -- en iOS standalone, visualViewport puede
    // quedar "pegado" en el valor con teclado abierto y no volver solo a su tamaño real.
    const vv = window.visualViewport;
    viewportH = (kbOpen && vv) ? vv.height : window.innerHeight;
    viewportOffsetTop = (kbOpen && vv) ? vv.offsetTop : 0;
  }
  const headerH = (header && header.style.display !== 'none') ? header.offsetHeight : 0;
  const bottomGap = kbOpen ? 0 : 8;
  const top = Math.round(viewportOffsetTop + headerH);
  // con el teclado cerrado, el chat termina justo arriba de la tabbar (con un pequeño
  // margen); con el teclado abierto, la tabbar ya está oculta y el chat baja pegado
  // directamente al borde del teclado, sin hueco. En vez de RECONSTRUIR a mano dónde
  // termina la tabbar (sumando alto + padding + el hueco que deja flotando, como se
  // hacía antes) medimos su posición real en pantalla con getBoundingClientRect() --
  // así, si el día de mañana cambia el CSS de la tabbar (padding, si vuelve a flotar,
  // etc.), esto se sigue ajustando solo, sin volver a romperse por quedar desincronizado
  // con constantes escritas a mano (que es justo lo que pasó más de una vez acá).
  const tabbarVisible = !kbOpen && tabbar && tabbar.style.display !== 'none';
  const bottomLimit = tabbarVisible
    ? Math.round(tabbar.getBoundingClientRect().top) - bottomGap
    : Math.round(viewportOffsetTop + viewportH) - bottomGap;
  const height = Math.max(0, bottomLimit - top);
  // OJO con el orden acá: chatBar.offsetHeight se lee ACÁ, ANTES de tocar wrap.style,
  // a propósito. Leerlo después (como estaba antes) fuerza un reflow síncrono EXTRA --
  // escribir wrap.style.top/height ensucia el layout, y la siguiente lectura de
  // offsetHeight obliga al navegador a recalcularlo todo de nuevo ahí mismo, en vez de
  // dejarlo para el próximo frame de pintado normal. Juntando todas las lecturas antes
  // que las escrituras evitamos ese "layout thrashing" -- que se nota especialmente
  // acá porque esta función se llama muchas veces seguidas durante la animación de
  // apertura/cierre del teclado (ver reapplyDuringAnimation), compitiendo por tiempo
  // de frame justo cuando más importa que no haya trabajo de más.
  const chatBarH = (scrollBtnWrap && chatBar) ? chatBar.offsetHeight : 0;
  wrap.style.top = top + 'px';
  wrap.style.height = height + 'px';
  if(scrollBtnWrap && chatBar) scrollBtnWrap.style.bottom = (chatBarH + 14) + 'px';
}
window.addEventListener('resize', syncCoachChatLayout);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', syncCoachChatLayout);
  // El scroll del visualViewport (que en iOS puede dispararse solo por tener el
  // teclado abierto, sin que el usuario haya tocado nada) se escucha con un
  // pequeño debounce -- corrige cualquier desvío real una vez que el gesto
  // terminó, pero nunca reposiciona nada MIENTRAS el usuario está scrolleando.
  let vvScrollDebounce = null;
  window.visualViewport.addEventListener('scroll', ()=>{
    clearTimeout(vvScrollDebounce);
    vvScrollDebounce = setTimeout(syncCoachChatLayout, 150);
  });
}
/* ---- hide tab bar while the chat keyboard is open (avoids the squished bottom bar) ---- */
(function(){
  const chatInputEl = document.getElementById('chatInput');
  const tabbarEl = document.getElementById('tabbar');
  if(!chatInputEl) return;
  const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const nativeKeyboard = isNativeApp && window.Capacitor.Plugins && window.Capacitor.Plugins.Keyboard;
  function openKeyboardUI(){
    if(tabbarEl) tabbarEl.style.display = 'none';
    document.body.classList.add('chat-kb-open');
  }
  function closeKeyboardUI(){
    if(tabbarEl && document.getElementById('view-coach').classList.contains('active')) tabbarEl.style.display = 'flex';
    document.body.classList.remove('chat-kb-open');
  }
  if(nativeKeyboard){
    // App nativa (Capacitor): acá sí tenemos una fuente confiable para saber cuándo
    // aparece y desaparece el teclado -- el plugin oficial @capacitor/keyboard, que
    // manda estos eventos directo desde el sistema operativo, con el alto exacto del
    // teclado en píxeles. Esto reemplaza por completo la vieja estrategia de "adivinar"
    // con window.visualViewport + reintentos, que dentro del WKWebView de Capacitor
    // resultó no ser confiable (de ahí que el hueco vacío pasara siempre, no a veces).
    //
    // IMPORTANTE: esto requiere que la app nativa tenga instalado @capacitor/keyboard
    // (ver mobile/package.json) y se haya vuelto a compilar con Xcode -- actualizar
    // solo estos archivos JS no alcanza para que este plugin exista en la app.
    nativeKeyboard.addListener('keyboardWillShow', (info) => {
      nativeKeyboardHeightPx = (info && typeof info.keyboardHeight === 'number') ? info.keyboardHeight : 0;
      openKeyboardUI();
      syncCoachChatLayout();
    });
    nativeKeyboard.addListener('keyboardDidShow', (info) => {
      nativeKeyboardHeightPx = (info && typeof info.keyboardHeight === 'number') ? info.keyboardHeight : nativeKeyboardHeightPx;
      syncCoachChatLayout();
    });
    nativeKeyboard.addListener('keyboardWillHide', () => {
      closeKeyboardUI();
      nativeKeyboardHeightPx = 0;
      syncCoachChatLayout();
    });
    nativeKeyboard.addListener('keyboardDidHide', () => {
      nativeKeyboardHeightPx = 0;
      syncCoachChatLayout();
      // WKWebView es motor WebKit igual que Safari, así que el mismo bug de "elementos
      // position:fixed que quedan congelados tras el teclado" podría darse acá también
      // -- este empujoncito de scroll es barato y no rompe nada, así que lo dejamos
      // como red de seguridad aunque ahora el tamaño/posición ya se calculen bien.
      forceFixedLayoutReflow();
    });
    return; // no hace falta nada de lo que sigue -- eso es solo para la versión web
  }
  // A partir de acá, todo lo que sigue es la estrategia para la versión WEB (Safari /
  // PWA agregada a inicio), donde sí corresponde usar window.visualViewport.
  //
  // El teclado de iOS tarda unos cientos de ms en aparecer/desaparecer y el evento
  // visualViewport.resize llega de forma asincrónica durante esa animación -- volvemos a
  // medir varias veces mientras se mueve, en vez de confiar en una sola lectura inmediata
  // que probablemente todavía esté midiendo el estado anterior (sin teclado).
  //
  // Antes esto era una lista fija de reintentos (50/120/220/350/500ms) que asumía que la
  // animación siempre dura menos de medio segundo. En un teléfono real, con el sistema
  // ocupado o la animación de cierre del teclado más lenta, el último reintento podía
  // disparar ANTES de que visualViewport.height terminara de volver a su tamaño real --
  // y como nada vuelve a medir después de eso, la barra de escribir quedaba con el alto
  // calculado para el teclado (ya cerrado), es decir "flotando" arriba, con un hueco
  // vacío debajo hasta la tabbar. Por eso ahora remedimos sin condición cada 80ms durante
  // una ventana de 2 segundos completos después de cada foco/blur -- no tratamos de
  // "detectar" cuándo terminó la animación (eso puede fallar si el navegador no dispara
  // ningún evento intermedio), simplemente insistimos el tiempo suficiente como para
  // cubrir cualquier animación real, por lenta que sea.
  //
  // Segunda causa del mismo síntoma, distinta a la anterior: cuando el input del chat
  // recibe foco, iOS Safari (más notorio todavía en modo standalone/PWA) puede scrollear
  // el DOCUMENTO ENTERO hacia arriba por su cuenta para "asegurarse" de que el input
  // quede visible arriba del teclado -- aunque #coachChatWrap ya es position:fixed y se
  // reacomoda solo, sin necesitar ese scroll. Ese scroll del documento no siempre se
  // deshace solo al cerrar el teclado, y como #app no ocupa más que 100dvh, quedar
  // scrolleado deja ver, debajo de la tabbar, el fondo vacío que hay más allá del final
  // de #app -- exactamente el hueco vacío "de más" que se ve en capturas reales. Por eso,
  // en cada re-medición forzamos también el scroll del documento de vuelta a 0.
  let animationPollId = null;
  function resetDocumentScroll(){
    const scroller = document.scrollingElement || document.documentElement;
    if(scroller.scrollTop !== 0) scroller.scrollTop = 0;
    if(window.scrollY) window.scrollTo(0, 0);
  }
  // resetScroll=true SOLO tiene que pasarse al cerrar el teclado (blur). Un video real
  // que mandó el usuario mostró un glitch nuevo, distinto al que esto venía resolviendo:
  // JUSTO AL ABRIRSE el teclado, toda la pantalla (encabezado incluido, no solo el
  // chat) se corre hacia abajo un instante dejando un hueco negro arriba, y se
  // acomoda sola en menos de medio segundo. Eso es exactamente la marca de dos cosas
  // peleándose por el scroll al mismo tiempo: iOS anima su propio scroll para
  // asegurarse de que el input quede visible arriba del teclado, y ACÁ, cada 80ms
  // durante esa misma animación, forzábamos el scroll de vuelta a 0 -- interrumpiendo
  // esa animación nativa a mitad de camino y produciendo el salto visible. Por eso
  // ahora resetDocumentScroll() solo se llama al CERRAR el teclado (que es cuando de
  // verdad puede quedar un scroll viejo pegado), nunca mientras se abre.
  // pinChatBottom=true (solo al ABRIR) además re-clava el scroll del #chatLog al
  // fondo en cada re-medición. Bug real encontrado repasando el código de nuevo:
  // #coachChatWrap es flex-column con #chatLog como único hijo flex:1 -- cuando el
  // teclado se abre, wrap.style.height se achica (ver syncCoachChatLayout) y por lo
  // tanto #chatLog TAMBIÉN se achica, pero su scrollTop (un valor absoluto en px) se
  // queda como estaba. Si justo antes el chat estaba scrolleado hasta el fondo (el
  // caso normal: leíste el último mensaje y tocás para escribir), ese mismo scrollTop
  // ya NO llega al fondo del #chatLog más chico -- queda un colchón vacío abajo y el
  // último mensaje visualmente "para arriba", justo el síntoma reportado ("el chat no
  // sube, queda abajo, tengo que bajar yo para ver lo último"). No es un bug de iOS,
  // es nuestro: nunca reacomodábamos el scroll interno del chat cuando el contenedor
  // cambiaba de tamaño. scrollChatToBottom() ya existe (se usa después de cada mensaje
  // nuevo); acá la reusamos en cada tick de la apertura para que seguir pegado al
  // fondo mientras el contenedor se va achicando.
  function reapplyDuringAnimation(resetScroll, pinChatBottom){
    // Antes esto remedía con setInterval cada 80ms durante 900ms -- un temporizador que
    // no tiene ninguna relación con el ritmo real al que el navegador pinta frames.
    // Eso significaba que buena parte de esas ~11 remediciones caían A MtAD DE un frame
    // que el propio SISTEMA estaba usando para animar el cierre del teclado -- justo el
    // trabajo de layout de más, en el momento menos oportuno, que se ve como "trabado".
    // requestAnimationFrame en cambio SIEMPRE corre justo ANTES de que el navegador
    // pinte el próximo frame, nunca compitiendo a mitad de uno -- así que hacemos la
    // misma cantidad de remediciones (cubriendo la misma ventana de ~900ms, de sobra
    // para los 250-300ms que tarda la animación real del teclado en iOS) pero cada una
    // cae en un momento en el que el navegador de cualquier forma iba a hacer trabajo
    // de layout/paint, en vez de forzarlo aparte.
    if(animationPollId) cancelAnimationFrame(animationPollId);
    const deadline = performance.now() + 900;
    function tick(){
      syncCoachChatLayout();
      if(pinChatBottom) scrollChatToBottom();
      if(resetScroll) resetDocumentScroll();
      if(performance.now() < deadline){
        animationPollId = requestAnimationFrame(tick);
      } else {
        animationPollId = null;
      }
    }
    tick();
  }
  chatInputEl.addEventListener('focus', ()=>{
    if(tabbarEl) tabbarEl.style.display = 'none';
    document.body.classList.add('chat-kb-open');
    reapplyDuringAnimation(false, true);
  });
  chatInputEl.addEventListener('blur', ()=>{
    if(tabbarEl && document.getElementById('view-coach').classList.contains('active')) tabbarEl.style.display = 'flex';
    document.body.classList.remove('chat-kb-open');
    reapplyDuringAnimation(true, false);
    forceFixedLayoutReflow();
  });
  // Tercera causa posible del mismo síntoma: en iOS hay un bug de WebKit bastante
  // conocido donde, después de que el teclado se abre y se cierra, los elementos
  // position:fixed (como la tabbar) se quedan "congelados" en la posición vieja a
  // nivel del motor de renderizado -- no es que el CSS o el JS estén mal, es que
  // WebKit directamente no vuelve a calcular dónde va el elemento fijo hasta que
  // pasa OTRA cosa que fuerce ese recálculo.
  //
  // El primer intento acá scrolleaba la página 1px y volvía a 0 -- pero en esta
  // pantalla #app medía justo lo que mide la pantalla (sin overflow), así que ese
  // scroll nunca tenía nada real para mover y por lo tanto nunca forzaba ningún
  // recálculo. Por eso el segundo intento lo reemplazó por completo con un truco de
  // reflow síncrono (esconder y volver a mostrar <body> con display:none/offsetHeight).
  // Ese cambio fue el error: investigando de nuevo el bug (que seguía intacto después
  // de OCHO intentos distintos) encontramos reportes públicos confirmados -- incluyendo
  // un bug abierto de WebKit y varios hilos del foro de Apple Developer -- de que en
  // iOS 26 específicamente, window.visualViewport.height/offsetTop no siempre vuelven
  // del todo a su valor real inmediatamente al cerrar el teclado (afecta incluso a
  // apple.com; Apple lo reconoció y lo mejoró parcialmente recién en beta de iOS 26.1).
  // La causa es a nivel de compositor: WebKit no vuelve a "anclar" los elementos
  // position:fixed contra el viewport visual hasta que ocurre un scroll DE VERDAD --
  // un reflow de layout (como el truco de display:none) no alcanza, porque no es un
  // problema de layout sino de dónde el compositor cree que está el viewport visual.
  // Por eso ahora volvemos al scroll de 1px real, pero arreglando la razón por la que
  // había fallado la primera vez: agregamos un spacer invisible al final de #app
  // (#scrollNudgeSpacer en index.html) que garantiza siempre unos pocos px de overflow
  // real en el documento, así este scroll SIEMPRE tiene algo para mover de verdad.
  //
  // El truco de esconder/mostrar <body> (display:none -> offsetHeight -> display
  // original) que estuvo acá antes SÍ conseguía la posición correcta, pero fuerza un
  // reflow + repaint + recomposición de TODA la página -- carísimo -- y al dispararse
  // varias veces en el primer segundo después de cerrar el teclado (justo cuando el
  // propio teclado todavía está animando su salida) le robaba frames a esa animación,
  // dando el efecto de "baja trabado". Como el scroll de 1px real (mucho más barato:
  // dos escrituras de una sola propiedad, nada de reflow de página completa) ya
  // soluciona el problema por sí solo, se saca el truco de display:none por completo.
  function forceFixedLayoutReflow(){
    const scroller = document.scrollingElement || document.documentElement;
    const restingTop = scroller.scrollTop; // normalmente 0
    scroller.scrollTop = restingTop + 2;
    scroller.scrollTop = restingTop;
    syncCoachChatLayout();
  }
  // Una sola pasada de más, 400ms después del blur (cubre teclados que tardan un poco
  // más en cerrarse en un teléfono real que en el simulador) -- ya no hace falta
  // insistir tanto como antes porque el scroll de 1px, al ser barato, no necesita
  // "varios intentos" para que alguno caiga en el momento justo: alcanza con no
  // dispararlo demasiado pronto.
  chatInputEl.addEventListener('blur', ()=> setTimeout(forceFixedLayoutReflow, 400));
  // Este bug de WebKit no es exclusivo del chat: CUALQUIER campo de texto de la app
  // (login, onboarding, Perfil -- peso, altura, fecha de nacimiento, km semanales,
  // nota del objetivo, etc.) abre el mismo teclado de iOS, y al cerrarse puede dejar
  // el mismo rastro en CUALQUIER elemento position:fixed que esté en pantalla en ese
  // momento -- no solo la tabbar. Por ejemplo, el botón "Comenzar" de la pantalla de
  // bienvenida vive dentro de #splash, que es position:fixed; inset:0; el modal de
  // "ahora vs. semana que viene" y el resto de los overlays (login, onboarding) son
  // igual de position:fixed. En vez de repetir el arreglo campo por campo, escuchamos
  // el cierre de teclado de forma genérica en toda la app: cualquier <input>/<textarea>
  // que pierde el foco dispara el mismo scroll de 1px real (foco genérico, no fixed a
  // #coachChatWrap, así que llamar a syncCoachChatLayout() de más acá no molesta -- esa
  // función ya se sale sola si el elemento no existe).
  document.addEventListener('focusout', (e)=>{
    const t = e.target;
    // chatInputEl ya tiene su propio manejo completo arriba (con reapplyDuringAnimation
    // y su propio forceFixedLayoutReflow a los 400ms) -- sumar esto de nuevo acá sería
    // trabajo repetido justo durante la misma ventana de animación, aportando al jank.
    if(t && t !== chatInputEl && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')){
      forceFixedLayoutReflow();
      setTimeout(forceFixedLayoutReflow, 400);
    }
  });
})();
/* ---- detectar version nueva y recargar la app sola (sin tener que cerrarla) ---- */
let appUpdateChecking = false;
async function checkForAppUpdate(){
  // Adentro del wrapper nativo no hay nada que "detectar" -- app.js viene empaquetado
  // en el binario y las actualizaciones llegan por la tienda, no recargando la página.
  if(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return false;
  if(appUpdateChecking) return false;
  appUpdateChecking = true;
  try{
    /* Antes esto pedía index.html y buscaba `const APP_VERSION` ahí adentro — funcionaba
       porque todo el JS vivía inline en index.html. Desde que se separó el código a
       app.js, index.html ya no contiene esa constante, así que el regex nunca matcheaba
       y el aviso de actualización dejó de aparecer (en cualquier plataforma, no solo
       en el celular — simplemente nadie lo notó en desktop todavía). Hay que pedir
       app.js, que es donde vive ahora. */
    const res = await fetch('/app.js?_v=' + Date.now(), { cache:'no-store' });
    if(!res.ok) return false;
    const text = await res.text();
    const m = text.match(/const APP_VERSION\s*=\s*'([^']+)'/);
    if(m && m[1] && m[1] !== APP_VERSION){
      haptic([10,30,10]);
      showToast(t('update_found_msg'), 'success');
      /* location.reload() puede volver a servir una copia vieja de la caché del navegador —
         navegar a una URL con un parámetro único fuerza a pedirla de nuevo al servidor. */
      setTimeout(()=>{ location.href = location.pathname + '?_r=' + Date.now(); }, 700);
      return true;
    }
    return false;
  }catch(e){ console.error('update check failed', e); return false; }
  finally{ appUpdateChecking = false; }
}
if(typeof document !== 'undefined'){
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible') checkForAppUpdate();
  });
}
async function doPullRefresh(){
  const indicator = document.getElementById('pull-refresh-indicator');
  if(indicator) indicator.style.display = 'flex';
  const updating = await checkForAppUpdate();
  if(updating) return;
  await refreshStateFromServer();
  autoSkipPastDays();
  autoClearPastEvent();
  renderAll(); renderHistory();
  if(indicator) setTimeout(()=>{ indicator.style.display='none'; }, 500);
  setTimeout(checkPendingRating, 400);
}
async function showView(v){
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  document.getElementById('chatBar').classList.toggle('active', v==='coach');
  (document.scrollingElement || document.documentElement).scrollTop = 0;
  if(v==='coach'){ syncCoachChatLayout(); scrollChatToBottom(); state.lastSeenChatTs = Date.now(); persist(); updateChatBadge(); } else { updateChatScrollBtn(); }
  if(v==='inicio'){ await refreshStateFromServer(); renderHome(); renderPlan(); }
  if(v==='history'){ await refreshStateFromServer(); renderHistory(); }
  if(v==='plan'){ await refreshStateFromServer(); viewingWeekOffset = 0; renderPlan(); }
  if(v==='perfil'){ renderPerfilDays(); updatePushStatusDisplay(); updateStravaStatusDisplay(); }
  if(v==='correr'){ renderRunTodayCard(); }
}
function goCoachWithPrompt(prefill){
  showView('coach');
  if(prefill){ document.getElementById('chatInput').value = prefill; }
  document.getElementById('chatInput').focus();
}

/* ================= SHOES / EVENT ================= */
function addShoe(){
  const name = document.getElementById('shoe-name').value.trim(); if(!name) return;
  state.shoes.push({id:Date.now(), name, terrain:document.getElementById('shoe-terrain').value, km:0});
  document.getElementById('shoe-name').value='';
  renderPerfil(); persist();
}
function startEditShoe(id){ editingShoeId = id; renderPerfil(); }
function cancelEditShoe(){ editingShoeId = null; renderPerfil(); }
function saveEditShoe(id){
  const name = document.getElementById('edit-shoe-name-'+id).value.trim();
  if(!name) return;
  const shoe = state.shoes.find(s=>s.id===id);
  shoe.name = name; shoe.terrain = document.getElementById('edit-shoe-terrain-'+id).value;
  editingShoeId = null;
  renderPerfil(); persist();
}
async function deleteShoe(id){
  if(!(await showConfirm(t('confirm_delete'), {danger:true, confirmText:t('delete_word')}))) return;
  state.shoes = state.shoes.filter(s=>s.id!==id);
  renderPerfil(); persist();
}
function checkShoeWearAlerts(){
  (state.shoes||[]).forEach(s=>{
    const threshold = s.terrain==='trail'?400:s.terrain==='mixto'?500:600;
    const pct = (s.km/threshold)*100;
    if(pct>80 && !s.wearAlerted){
      s.wearAlerted = true;
      haptic(20);
      showToast(t('shoe_wear_alert_msg', {name:s.name}), 'error');
    } else if(pct<=80 && s.wearAlerted){
      s.wearAlerted = false;
    }
  });
}
function refreshEstimatedHrMax(){
  /* Los perfiles armados antes de este cambio quedaron con la fórmula vieja (220-edad)
     guardada tal cual en hrMax -- cambiar estimateHrMax() no les recalcula nada solo,
     porque el valor ya está persistido. Para quien todavía no tiene una FC máxima real
     cargada (hrKnown=false), la recalculamos con la fórmula nueva (Tanaka) cada vez que
     entra a la app, así no quedan pegados para siempre a la estimación vieja por haberse
     registrado antes de este cambio. A quien ya tiene una FC real cargada no le tocamos
     nada -- un dato real siempre le gana a cualquier estimación por edad. */
  const p = state.profile;
  if(!p || p.hrKnown || !p.birth) return;
  const newEstimate = estimateHrMax(ageFromBirth(p.birth));
  if(newEstimate && newEstimate !== p.hrMax){
    p.hrMax = newEstimate;
    p.hrZones = computeZones(newEstimate);
    persist();
  }
}
function checkHrMaxFromRuns(){
  /* Un pico de FC real registrado en una carrera (reloj sincronizado por Strava) es más
     confiable que la estimación por edad -- si superó lo que tenemos guardado, lo tomamos
     como la nueva FC máxima real, sin esperar a que el corredor se lo cuente a mano al coach
     por chat (que hasta ahora era la única forma de que hrKnown pasara a true). Un tope de
     220 evita que un pico raro de sensor (glitch del reloj) rompa las zonas. */
  const observedMax = (state.runs||[]).reduce((max,r)=> (typeof r.maxHr==='number' && r.maxHr>max) ? r.maxHr : max, 0);
  if(observedMax && observedMax<=220 && observedMax > (state.profile.hrMax||0)){
    state.profile.hrMax = observedMax;
    state.profile.hrKnown = true;
    state.profile.hrZones = computeZones(observedMax);
    persist();
    if(document.getElementById('view-perfil') && document.getElementById('view-perfil').classList.contains('active')) renderZones();
    showToast(t('hrmax_auto_update_msg', {bpm: observedMax}), 'success');
  }
}
function setEvent(){
  const name = document.getElementById('ev-name').value.trim(); const date = document.getElementById('ev-date').value;
  if(!name || !date) return;
  const distanceKm = parseFloat(document.getElementById('ev-distance').value);
  state.event = {name, date, type:document.getElementById('ev-type').value, distanceKm: distanceKm>0 ? distanceKm : null};
  // el evento (fecha, tipo de terreno) influye en el plan (taper, día de descanso el día
  // de la carrera, terreno del rodaje largo) -- si no se regenera acá, esos efectos
  // quedaban "guardados" pero invisibles hasta el próximo cambio de semana natural.
  state.plan = preserveLivedDays(state.plan, generatePlan(state.profile, state.weekNumber||1));
  renderAll(); persist();
}
async function deleteEvent(){
  if(!(await showConfirm(t('confirm_delete'), {danger:true, confirmText:t('delete_word')}))) return;
  state.event = null;
  document.getElementById('ev-name').value=''; document.getElementById('ev-date').value=''; document.getElementById('ev-distance').value='';
  dateBoxUpdaters['ev-date'] && dateBoxUpdaters['ev-date']();
  state.plan = preserveLivedDays(state.plan, generatePlan(state.profile, state.weekNumber||1));
  renderAll(); persist();
}

/* ================= LIVE TRACKER + MAP ================= */
let tracker = {watchId:null, timerId:null, points:[], distanceKm:0, elapsedSec:0, running:false, hrLog:[], lastAnnouncedKm:0, startedAt:null, workout:null};
let liveMap, liveMarker, startMarker, livePolyline;
let wakeLockSentinel = null;

async function requestWakeLock(){ try{ if('wakeLock' in navigator) wakeLockSentinel = await navigator.wakeLock.request('screen'); }catch(e){} }
async function releaseWakeLock(){ try{ if(wakeLockSentinel){ await wakeLockSentinel.release(); wakeLockSentinel=null; } }catch(e){} }
document.addEventListener('visibilitychange', async ()=>{ if(document.visibilityState==='visible' && tracker.running && !wakeLockSentinel) await requestWakeLock(); });

/* ---- guardado automático de la carrera en curso ----
   Si el navegador se cierra solo (poca batería, la app se va a segundo plano
   y el sistema mata la pestaña, etc.) mientras estás corriendo, esto permite
   recuperar lo ya recorrido en vez de perder el entrenamiento entero. Se
   guarda en el almacenamiento local del teléfono, no en el servidor. */
const RUN_PROGRESS_KEY = 'zancada_run_in_progress';
function saveRunProgress(){
  if(!tracker || !tracker.startedAt) return;
  try{
    localStorage.setItem(RUN_PROGRESS_KEY, JSON.stringify({
      startedAt: tracker.startedAt,
      points: tracker.points,
      distanceKm: tracker.distanceKm,
      hrLog: tracker.hrLog,
      lastAnnouncedKm: tracker.lastAnnouncedKm
    }));
  }catch(e){}
}
function clearRunProgress(){ try{ localStorage.removeItem(RUN_PROGRESS_KEY); }catch(e){} }
function readRunProgress(){
  try{ const raw = localStorage.getItem(RUN_PROGRESS_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
function speak(text){
  if(state.voiceEnabled===false || !('speechSynthesis' in window)) return;
  try{ const u = new SpeechSynthesisUtterance(text); u.lang = LOCALE_MAP[lang]; window.speechSynthesis.speak(u); }catch(e){}
}
function maybeAnnounceKm(){
  const currentKm = Math.floor(tracker.distanceKm);
  if(currentKm>0 && currentKm>tracker.lastAnnouncedKm){
    tracker.lastAnnouncedKm = currentKm;
    const paceMin = (tracker.elapsedSec/60)/tracker.distanceKm;
    const paceStr = `${Math.floor(paceMin)}:${String(Math.round((paceMin%1)*60)).padStart(2,'0')}`;
    speak(t('voice_km',{km:currentKm, pace:paceStr}));
  }
}

/* ---- Guía en vivo de series/subidas ----
   Antes, el tracker en vivo era el mismo sin importar qué entrenamiento tocaba hoy --
   solo avisaba el km y el ritmo, ni idea de si era un día de series, subidas o rodaje
   fácil. Esto lo hace consciente del tipo de sesión: si hoy hay series (intervals) o
   subidas (hills) -- los dos únicos tipos que ya traen una estructura de repeticiones
   concreta en dayObj.interval (ver buildIntervalStructure/buildHillStructure) -- guía
   al corredor repetición por repetición por voz y con un cartel en pantalla, sin que
   tenga que mirar el reloj ni contar mentalmente.

   Por qué arranca en "pending" y no arranca solo: el dato que tenemos (today.dist) es
   la distancia TOTAL de la sesión (entrada en calor + series + vuelta a la calma), no
   dónde empiezan las series -- así que no hay forma automática y confiable de saber
   cuándo terminó de calentar. Se lo preguntamos con un botón en vez de adivinar mal.

   Las series (intervals) miden el esfuerzo por DISTANCIA (repMeters) porque así están
   pensadas -- "corré 400m fuerte" -- y la recuperación por TIEMPO (recoveryMin), tal
   cual la arma buildIntervalStructure(). Las subidas (hills) miden el esfuerzo por
   TIEMPO (effortSec) porque en una pendiente la distancia varía mucho según el
   terreno; buildHillStructure() no define una duración de recuperación (el texto
   dice solo "bajá trotando suave"), así que la estimamos como 1.6x el esfuerzo --
   una bajada trotando suave típicamente lleva más que la subida fuerte, pero no el
   doble. Es una heurística, no una medición real, y se lo explicamos así al usuario
   si pregunta por chat. */
function getTodayWorkoutStructure(){
  const idx = (new Date().getDay()+6)%7;
  const today = state.plan[idx];
  if(!today || !today.interval) return null;
  if(today.typeKey==='intervals') return {typeKey:'intervals', reps:today.interval.reps, repMeters:today.interval.repMeters, recoveryMin:today.interval.recoveryMin};
  if(today.typeKey==='hills') return {typeKey:'hills', reps:today.interval.reps, effortSec:today.interval.effortSec};
  return null;
}
function setupWorkoutGuide(){
  const structure = getTodayWorkoutStructure();
  tracker.workout = structure ? {structure, phase:'pending', currentRep:0, phaseStartDistanceKm:0, phaseStartElapsedSec:0} : null;
  renderWorkoutGuide();
}
function beginWorkoutReps(){
  if(!tracker.workout) return;
  const w = tracker.workout;
  w.phase = 'effort';
  w.currentRep = 1;
  w.phaseStartDistanceKm = tracker.distanceKm;
  w.phaseStartElapsedSec = tracker.elapsedSec;
  haptic([15,40,15]);
  announceWorkoutPhase();
  renderWorkoutGuide();
}
function announceWorkoutPhase(){
  const w = tracker.workout; if(!w) return;
  const s = w.structure;
  if(w.phase==='effort'){
    speak(s.typeKey==='intervals' ? t('voice_rep_start',{cur:w.currentRep, total:s.reps}) : t('voice_hill_start',{cur:w.currentRep, total:s.reps}));
  } else if(w.phase==='recovery'){
    speak(s.typeKey==='intervals' ? t('voice_rep_recovery',{cur:w.currentRep, min:s.recoveryMin}) : t('voice_hill_recovery',{cur:w.currentRep}));
  } else if(w.phase==='done'){
    speak(t('voice_workout_done'));
  }
}
function advanceWorkoutPhase(){
  const w = tracker.workout; const s = w.structure;
  if(w.phase==='effort'){
    if(w.currentRep >= s.reps){
      w.phase = 'done';
    } else {
      w.phase = 'recovery';
      w.phaseStartElapsedSec = tracker.elapsedSec;
    }
  } else if(w.phase==='recovery'){
    w.currentRep++;
    w.phase = 'effort';
    w.phaseStartDistanceKm = tracker.distanceKm;
    w.phaseStartElapsedSec = tracker.elapsedSec;
  }
  haptic([15,40,15]);
  announceWorkoutPhase();
}
function tickWorkoutGuide(){
  const w = tracker.workout;
  if(!w || w.phase==='pending' || w.phase==='done') return;
  const s = w.structure;
  let complete = false;
  if(s.typeKey==='intervals'){
    if(w.phase==='effort') complete = (tracker.distanceKm - w.phaseStartDistanceKm)*1000 >= s.repMeters;
    else complete = (tracker.elapsedSec - w.phaseStartElapsedSec) >= s.recoveryMin*60;
  } else {
    const target = w.phase==='effort' ? s.effortSec : Math.round(s.effortSec*1.6);
    complete = (tracker.elapsedSec - w.phaseStartElapsedSec) >= target;
  }
  if(complete) advanceWorkoutPhase();
  renderWorkoutGuide();
}
function renderWorkoutGuide(){
  const card = document.getElementById('workout-guide-card');
  if(!card) return;
  const w = tracker.workout;
  if(!w){ card.style.display = 'none'; return; }
  card.style.display = 'block';
  const pendingEl = document.getElementById('workout-guide-pending');
  const activeEl = document.getElementById('workout-guide-active');
  const doneEl = document.getElementById('workout-guide-done');
  pendingEl.style.display = w.phase==='pending' ? 'block' : 'none';
  activeEl.style.display = (w.phase==='effort' || w.phase==='recovery') ? 'block' : 'none';
  doneEl.style.display = w.phase==='done' ? 'block' : 'none';
  if(w.phase==='pending'){
    const idx = (new Date().getDay()+6)%7;
    const today = state.plan[idx];
    document.getElementById('workout-guide-desc').textContent = today ? planLabel(today).desc : '';
    document.getElementById('workout-guide-start-btn').textContent = t('run_guide_start_btn');
  } else if(w.phase==='effort' || w.phase==='recovery'){
    const s = w.structure;
    const tag = document.getElementById('workout-guide-phase-tag');
    const isEffort = w.phase==='effort';
    tag.textContent = isEffort ? t('run_guide_tag_effort') : t('run_guide_tag_recovery');
    tag.className = 'tag ' + (isEffort ? 'tag-load-risk' : 'tag-mixto');
    document.getElementById('workout-guide-rep-count').textContent = `${w.currentRep}/${s.reps}`;
    let pct;
    if(s.typeKey==='intervals'){
      pct = isEffort
        ? ((tracker.distanceKm - w.phaseStartDistanceKm)*1000 / s.repMeters)*100
        : ((tracker.elapsedSec - w.phaseStartElapsedSec) / (s.recoveryMin*60))*100;
    } else {
      const target = isEffort ? s.effortSec : Math.round(s.effortSec*1.6);
      pct = ((tracker.elapsedSec - w.phaseStartElapsedSec) / target)*100;
    }
    document.getElementById('workout-guide-progress-bar').style.width = Math.max(0,Math.min(100,pct)) + '%';
  } else if(w.phase==='done'){
    document.getElementById('workout-guide-done-text').textContent = t('voice_workout_done');
  }
}

function haversine(lat1,lon1,lat2,lon2){
  const R=6371, toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function fmtTime(sec){
  const h=String(Math.floor(sec/3600)).padStart(2,'0'), m=String(Math.floor((sec%3600)/60)).padStart(2,'0'), s=String(Math.floor(sec%60)).padStart(2,'0');
  return `${h}:${m}:${s}`;
}
function classifyHR(bpm){
  const z = state.profile.hrZones; if(!z) return 2;
  if(bpm<=z[1].max) return 1; if(bpm<=z[2].max) return 2; if(bpm<=z[3].max) return 3; if(bpm<=z[4].max) return 4; return 5;
}
function initLiveMap(){
  if(liveMap){ liveMap.remove(); liveMap=null; }
  liveMap = L.map('liveMap', {zoomControl:false, attributionControl:true}).setView([0,0], 15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_2i8k_1_882919874396f1a734cae151', {maxZoom:20, attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(liveMap);
  livePolyline = L.polyline([], {color:'#0B5D2E', weight:5, lineCap:'round', lineJoin:'round'}).addTo(liveMap);
  liveMarker = null; startMarker = null;
  setTimeout(()=>{ if(liveMap) liveMap.invalidateSize(); }, 250);
}
function updateLiveMap(lat, lon){
  if(!liveMap) return;
  livePolyline.addLatLng([lat,lon]);
  if(!startMarker){
    startMarker = L.circleMarker([lat,lon], {radius:6, color:'#fff', weight:2, fillColor:'#4ADE80', fillOpacity:1}).addTo(liveMap);
  }
  if(liveMarker) liveMap.removeLayer(liveMarker);
  liveMarker = L.circleMarker([lat,lon], {radius:8, color:'#121415', weight:3, fillColor:'#D6FF3F', fillOpacity:1}).addTo(liveMap);
  liveMap.setView([lat,lon], Math.max(liveMap.getZoom(),16));
}
function recenterMap(){
  if(liveMap && liveMarker) liveMap.setView(liveMarker.getLatLng(), 17);
}
function startRun(){
  if(!navigator.geolocation){ document.getElementById('geo-warning').style.display='block'; document.getElementById('geo-warning').textContent=t('geo_err_support'); return; }
  const saved = readRunProgress();
  if(saved && saved.startedAt && (Date.now()-saved.startedAt) < 6*3600*1000 && (saved.points||[]).length){
    // hay una carrera sin terminar de hace menos de 6 horas (por ejemplo, la app
    // se cerró sola a mitad de un entrenamiento) -> ofrecemos recuperarla en vez
    // de arrancar una nueva y perder lo ya corrido
    showConfirm(t('run_recover_text'), {confirmText:t('run_recover_confirm'), cancelText:t('run_recover_discard')}).then(resume=>{
      if(!resume) clearRunProgress();
      actuallyStartRun(resume ? saved : null);
    });
    return;
  }
  actuallyStartRun(null);
}
function actuallyStartRun(saved){
  tracker = saved
    ? {watchId:null, timerId:null, points:saved.points||[], distanceKm:saved.distanceKm||0, elapsedSec:Math.max(0,Math.floor((Date.now()-saved.startedAt)/1000)), running:true, hrLog:saved.hrLog||[], lastAnnouncedKm:saved.lastAnnouncedKm||0, startedAt:saved.startedAt}
    : {watchId:null, timerId:null, points:[], distanceKm:0, elapsedSec:0, running:true, hrLog:[], lastAnnouncedKm:0, startedAt:Date.now()};
  requestWakeLock();
  document.getElementById('runIdle').style.display='none';
  document.getElementById('runSummary').style.display='none';
  document.getElementById('runActive').style.display='block';
  // El botón arranca en "Pausar" -- sin esto quedaba con el texto que tenía la
  // última vez que se renderizó la pantalla (típicamente "Reanudar", puesto por
  // applyStaticTranslations() al cargar la app con tracker.running todavía en false).
  document.getElementById('pauseBtn').textContent = t('run_pause');
  initLiveMap();
  updateLiveStats();
  setupWorkoutGuide();
  saveRunProgress();
  tracker.watchId = navigator.geolocation.watchPosition(onPosition, onPosError, {enableHighAccuracy:true, maximumAge:1000, timeout:15000});
  tracker.timerId = setInterval(()=>{ if(tracker.running){ tracker.elapsedSec++; updateLiveStats(); tickWorkoutGuide(); if(tracker.elapsedSec % 15 === 0) saveRunProgress(); } }, 1000);
}
function onPosition(pos){
  const {latitude:lat, longitude:lon, accuracy} = pos.coords;
  if(accuracy && accuracy>50) return;
  const last = tracker.points[tracker.points.length-1];
  if(last){ const d=haversine(last.lat,last.lon,lat,lon); if(d>0.002) tracker.distanceKm+=d; }
  tracker.points.push({lat,lon});
  updateLiveMap(lat,lon);
  updateLiveStats();
  maybeAnnounceKm();
  tickWorkoutGuide();
  saveRunProgress();
}
function onPosError(){ document.getElementById('geo-warning').style.display='block'; document.getElementById('geo-warning').textContent=t('geo_err_permission'); }
function updateRunUnitLabels(){
  const distLbl = distUnit().toUpperCase();
  const paceLbl = `${t('run_pace_word')} /${distUnit()}`;
  ['track-dist-label','sum-dist-label'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent = distLbl; });
  ['track-pace-label','sum-pace-label'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent = paceLbl; });
}
function updateLiveStats(){
  document.getElementById('track-timer').textContent = fmtTime(tracker.elapsedSec);
  document.getElementById('track-dist').textContent = fmtDist(tracker.distanceKm);
  const paceMin = tracker.distanceKm>0.02 ? (tracker.elapsedSec/60)/tracker.distanceKm : 0;
  document.getElementById('track-pace').textContent = fmtPace(paceMin);
  updateRunUnitLabels();
}
function togglePause(){ tracker.running = !tracker.running; document.getElementById('pauseBtn').textContent = tracker.running? t('run_pause') : t('run_resume'); }
function stopRun(){
  clearInterval(tracker.timerId);
  if(tracker.watchId!==null) navigator.geolocation.clearWatch(tracker.watchId);
  releaseWakeLock();
  tracker.workout = null;
  document.getElementById('workout-guide-card').style.display = 'none';
  document.getElementById('runActive').style.display='none';
  document.getElementById('runSummary').style.display='block';
  const paceMin = tracker.distanceKm>0.02 ? (tracker.elapsedSec/60)/tracker.distanceKm : 0;
  document.getElementById('sum-dist').textContent = fmtDist(tracker.distanceKm);
  document.getElementById('sum-time').textContent = fmtTime(tracker.elapsedSec);
  document.getElementById('sum-pace').textContent = fmtPace(paceMin);
  document.getElementById('sum-cal').textContent = Math.round((state.profile.weight||70)*tracker.distanceKm*1.036);
  updateRunUnitLabels();
  const sel = document.getElementById('sum-shoe');
  sel.innerHTML = state.shoes.length ? state.shoes.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('') : `<option value="">${t('no_shoes')}</option>`;
}
let ratingTargetIdx = null;
function findUnratedDoneDay(){
  return state.plan.findIndex(d => d.status==='done' && !d.rating);
}
function checkPendingRating(){
  if(document.getElementById('login').style.display==='block' || document.getElementById('onboard').style.display==='block') return;
  const idx = findUnratedDoneDay();
  if(idx < 0) return;
  const d = state.plan[idx];
  const lbl = planLabel(d);
  document.getElementById('rating-session-desc').textContent = `${t('day_'+d.day)}: ${lbl.type}${d.dist>0?' · '+fmtDist(d.dist,1)+' '+distUnit():''}`;
  ratingTargetIdx = idx;
  document.getElementById('rating-modal').style.display = 'block';
}
async function submitRating(value){
  if(ratingTargetIdx===null) return;
  const idx = ratingTargetIdx;
  state.plan[idx].rating = value;
  document.getElementById('rating-modal').style.display = 'none';
  ratingTargetIdx = null;
  await persist();
  if(value === 'mal'){
    if(await showConfirm(t('rating_lower_intensity_confirm'))){
      lowerRemainingIntensity(-15);
      state.chat.push({role:'coach', text: t('rating_lowered_msg'), ts:Date.now()});
      await persist();
    }
  }
  setTimeout(checkPendingRating, 400);
}
function lowerRemainingIntensity(pct){
  const factor = 1 + (pct/100);
  state.plan.forEach(d=>{ if(d.dist>0 && !d.status){ d.dist = Math.max(1, Math.round(d.dist*factor)); } });
  renderPlan(); renderHome(); persist();
}
async function closeSummary(){
  const shoeId = parseInt(document.getElementById('sum-shoe').value);
  const shoe = state.shoes.find(s=>s.id===shoeId);
  if(shoe) shoe.km += tracker.distanceKm;
  checkShoeWearAlerts();
  const runDate = new Date().toISOString();
  const runId = Date.now();
  state.runs.push({id:runId, date:runDate, distanceKm:tracker.distanceKm, durationSec:tracker.elapsedSec, hrLog:tracker.hrLog, points:tracker.points, shoeId:shoeId||null});
  checkNewPR(state.runs[state.runs.length-1]);
  autoMarkSessionDone(runDate, runId);
  clearRunProgress();
  document.getElementById('runSummary').style.display='none';
  document.getElementById('runIdle').style.display='block';
  renderAll(); renderHistory(); renderRunTodayCard();
  await persist();
  showView('inicio');
  showToast(t('run_completed_toast'), 'success');
  haptic([15,40,15]);
  setTimeout(checkPendingRating, 500);
}
function autoMarkSessionDone(dateIso, runId){
  const monday = getMondayISO(new Date(dateIso));
  if(monday !== state.weekStart) return;
  const idx = (new Date(dateIso).getDay()+6)%7;
  if(state.plan[idx] && !state.plan[idx].status){ state.plan[idx].status = 'done'; state.plan[idx].linkedRunId = runId; }
}
function toggleManualForm(){
  const el = document.getElementById('manual-run-card');
  const show = el.style.display==='none';
  el.style.display = show?'block':'none';
  if(show){
    document.getElementById('man-date').value = localDateISO();
    dateBoxUpdaters['man-date'] && dateBoxUpdaters['man-date']();
    const sel = document.getElementById('man-shoe');
    sel.innerHTML = state.shoes.length ? state.shoes.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('') : `<option value="">${t('no_shoes')}</option>`;
  }
}
function saveManualRun(){
  const date = document.getElementById('man-date').value;
  const dist = parseFloat(document.getElementById('man-dist').value);
  const durMin = parseFloat(document.getElementById('man-dur').value);
  if(!date || !dist || !durMin) return;
  const hr = parseInt(document.getElementById('man-hr').value);
  const shoeId = parseInt(document.getElementById('man-shoe').value) || null;
  const isoDate = new Date(date+'T12:00:00').toISOString();
  const runId = Date.now();
  state.runs.push({id:runId, date:isoDate, distanceKm:dist, durationSec:Math.round(durMin*60), hrLog: hr?[{t:0,bpm:hr}]:[], points:[], shoeId, manual:true});
  checkNewPR(state.runs[state.runs.length-1]);
  const shoe = state.shoes.find(s=>s.id===shoeId);
  if(shoe) shoe.km += dist;
  checkShoeWearAlerts();
  autoMarkSessionDone(isoDate, runId);
  document.getElementById('man-dist').value=''; document.getElementById('man-dur').value=''; document.getElementById('man-hr').value='';
  toggleManualForm();
  renderAll(); renderHistory(); persist();
}

/* ================= HISTORY ================= */
function computeDailyTrend(days){
  const result = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const weekDayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
  for(let i=days-1; i>=0; i--){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const dateStr = d.toISOString().slice(0,10);
    // localDateISO(r.date), no r.date.slice(0,10): r.date es un timestamp UTC completo,
    // cortarlo a mano daba el día calendario en UTC en vez del día LOCAL real de la
    // carrera (ver el comentario junto a localDateISO/getTodayRun).
    const km = state.runs.filter(r => localDateISO(r.date) === dateStr).reduce((a,r)=>a+r.distanceKm,0);
    let planned = false;
    if(state.weekStart && dateStr >= state.weekStart){
      const planDay = state.plan.find(p=>p.day===weekDayKeys[d.getDay()]);
      if(planDay && planDay.dist>0) planned = true;
    }
    result.push({date:dateStr, km, planned, day:d.getDate()});
  }
  return result;
}
function computeWeeklyTrend(weeksCount){
  // Kilómetros REALMENTE corridos (no planeados) por semana calendario (lunes a
  // domingo), para las últimas `weeksCount` semanas incluyendo la actual (que va a
  // estar incompleta si todavía no terminó). Mira directo state.runs por fecha en
  // vez de depender de planHistory -- así sigue funcionando aunque falte algún
  // registro de semana cerrada, y es coherente con "corridas reales" en el resto
  // de Historial.
  const result = [];
  const currentMonday = new Date((state.weekStart || getMondayISO(new Date())) + 'T00:00:00');
  for(let i=weeksCount-1; i>=0; i--){
    const start = new Date(currentMonday); start.setDate(start.getDate() - i*7);
    const startIso = start.toISOString().slice(0,10);
    const end = new Date(start); end.setDate(end.getDate()+7);
    const endIso = end.toISOString().slice(0,10);
    const km = (state.runs||[]).filter(r => { const d=localDateISO(r.date); return d>=startIso && d<endIso; })
      .reduce((a,r)=>a+r.distanceKm, 0);
    result.push({weekStart: startIso, km, day: start.getDate(), isCurrent: i===0});
  }
  return result;
}
function computeTrends(){
  const totalKm = state.runs.reduce((a,r)=>a+r.distanceKm,0);
  return {totalKm, totalRuns: state.runs.length};
}
function getQualitySessionBreakdown(daysBack){
  // Cuenta las sesiones fuertes COMPLETADAS (series, tempo, fartlek, cuestas,
  // progresivo) de los últimos `daysBack` días, mirando tanto el plan actual como
  // el historial de semanas ya cerradas (planHistory). Sirve para que el corredor
  // vea si el coach le está dando variedad real o siempre lo mismo.
  daysBack = daysBack || 30;
  const cutoff = Date.now() - daysBack*86400000;
  const qualityTypes = ['intervals','tempo','fartlek','hills','progression'];
  const counts = {};
  const consider = (weekStart, plan) => {
    if(!weekStart || !plan || !plan.length) return;
    const start = new Date(weekStart+'T00:00:00');
    if(isNaN(start.getTime())) return;
    plan.forEach((d,i)=>{
      if(d.status!=='done') return;
      const dt = new Date(start); dt.setDate(dt.getDate()+i);
      if(dt.getTime() < cutoff) return;
      if(!qualityTypes.includes(d.typeKey)) return;
      counts[d.typeKey] = (counts[d.typeKey]||0) + 1;
    });
  };
  (state.planHistory||[]).forEach(h => consider(h.weekStart, h.plan));
  consider(state.weekStart, state.plan);
  return counts;
}

/* ---- Récords personales ---- */
// Distancias estándar contra las que medimos marcas. Un run cuenta para una de estas
// solo si su distancia real está a menos del 6% de la distancia estándar -- así no
// confundimos una tirada larga cualquiera de 15.8km con un intento real de 15K.
const PR_DISTANCES = [
  {key:'5k', km:5},
  {key:'10k', km:10},
  {key:'15k', km:15},
  {key:'half', km:21.0975},
  {key:'marathon', km:42.195},
];
function nearestPRBucket(km){
  let best = null, bestDiff = Infinity;
  PR_DISTANCES.forEach(b=>{
    const diff = Math.abs(km-b.km)/b.km;
    if(diff < bestDiff){ bestDiff = diff; best = b; }
  });
  return (best && bestDiff <= 0.06) ? best : null;
}
// Para la "devolución" que se muestra en cada tarjeta del historial (para qué sirvió esa
// sesión). Cuando la carrera está vinculada a un día real del plan usamos su tipo real;
// si no (carga manual, importada de Strava sin vincular, o de una semana ya vieja donde
// el plan de ese momento no se conserva), la clasificamos por distancia/ritmo relativos
// al resto del historial -- no es una ciencia exacta, pero da una devolución razonable.
function runBenefitKey(r){
  const linkedDay = (state.plan||[]).find(d => d.linkedRunId === r.id);
  if(linkedDay && linkedDay.typeKey && linkedDay.typeKey !== 'rest') return linkedDay.typeKey;
  if(nearestPRBucket(r.distanceKm)) return 'race';
  const others = (state.runs||[]).filter(x => x.id!==r.id && x.distanceKm>0 && x.durationSec>0);
  if(!others.length) return 'easy';
  const avgDist = others.reduce((a,x)=>a+x.distanceKm,0)/others.length;
  const paceOf = x => (x.durationSec/60)/x.distanceKm;
  const avgPace = others.reduce((a,x)=>a+paceOf(x),0)/others.length;
  const thisPace = r.distanceKm>0.02 ? paceOf(r) : avgPace;
  if(r.distanceKm >= avgDist*1.4) return 'long';
  if(thisPace <= avgPace*0.92) return 'tempo';
  return 'easy';
}
function getPersonalRecords(excludeRunId){
  // Mejor tiempo registrado por distancia estándar. excludeRunId sirve para comparar
  // una carrera recién agregada contra "lo que había antes" y saber si es récord nuevo.
  const records = {};
  (state.runs||[]).forEach(r=>{
    if(excludeRunId!=null && String(r.id)===String(excludeRunId)) return;
    if(!r.distanceKm || !r.durationSec) return;
    const bucket = nearestPRBucket(r.distanceKm);
    if(!bucket) return;
    const cur = records[bucket.key];
    if(!cur || r.durationSec < cur.durationSec){
      records[bucket.key] = {distanceKm:r.distanceKm, durationSec:r.durationSec, runId:r.id, date:r.date};
    }
  });
  return records;
}
function checkNewPR(run){
  // Avisa por el chat cuando una carrera recién agregada (del reloj vía Strava, cargada
  // a mano, o grabada con la app) resulta ser una marca personal nueva para su distancia.
  if(!run || !run.distanceKm || !run.durationSec) return;
  const bucket = nearestPRBucket(run.distanceKm);
  if(!bucket) return;
  const prev = getPersonalRecords(run.id)[bucket.key];
  if(prev && prev.durationSec <= run.durationSec) return;
  state.chat.push({role:'coach', text: t('coach_new_pr_'+bucket.key, {time: fmtTime(run.durationSec)}), ts:Date.now()});
  renderChat();
  showToast(t('pr_toast_new', {label: t('pr_label_'+bucket.key), time: fmtTime(run.durationSec)}), 'success');
  haptic(40);
}
function predictRaceTime(targetKm){
  // Estima el tiempo objetivo para `targetKm` con la fórmula de Riegel (T2 = T1 *
  // (D2/D1)^1.06), usando como referencia la marca personal más cercana en distancia
  // (cuanto más parecidas son las distancias, más confiable es la proyección).
  const records = Object.values(getPersonalRecords());
  if(!records.length) return null;
  let best = null, bestDiff = Infinity;
  records.forEach(rec=>{
    const diff = Math.abs(Math.log(rec.distanceKm/targetKm));
    if(diff < bestDiff){ bestDiff = diff; best = rec; }
  });
  if(!best) return null;
  const predictedSec = best.durationSec * Math.pow(targetKm/best.distanceKm, 1.06);
  return { predictedSec, refDistanceKm: best.distanceKm, refDurationSec: best.durationSec };
}
function getGoalRaceKm(){
  return {'5k':5, '10k':10, '15k':15, '21k':21.0975, '42k':42.195}[state.profile.goal] || null;
}
function renderHistory(){
  const el = document.getElementById('history-list');
  const weekRuns = (state.runs||[]).filter(r => getMondayISO(new Date(r.date)) === state.weekStart);
  document.getElementById('home-runs-count').textContent = weekRuns.length;
  const tr = computeTrends();
  const daily = computeDailyTrend(14);
  const maxKmDay = Math.max(...daily.map(x=>x.km), 1);
  const trendsCard = `<div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <h3 style="margin:0;" data-i18n="hist_trends">${t('hist_trends')}</h3>
      <button onclick="shareWeeklyRecapImage()" style="background:none; border:1.5px solid var(--asphalt-4); color:var(--hivis); font-size:12px; cursor:pointer; padding:5px 9px; border-radius:6px; display:flex; align-items:center; gap:5px; font-weight:700; flex-shrink:0;">${t('hist_share')}</button>
    </div>
    <div class="stat-row">
      <div class="stat-box"><div class="n mono">${fmtDist(tr.totalKm,0)}</div><div class="l">${t('hist_total_km')} (${distUnit()})</div></div>
      <div class="stat-box"><div class="n mono">${tr.totalRuns}</div><div class="l">${t('hist_total_runs')}</div></div>
    </div>
    <div class="week-bars" id="hist-trend-bars" style="margin-top:14px;">${daily.map((x,i)=>{
      const h = x.km>0 ? Math.max(6, Math.round((x.km/maxKmDay)*70)) : (x.planned ? 4 : 2);
      const cls = x.km>0 ? 'hivis' : (x.planned ? 'planned-day' : 'rest-day');
      return `<div class="bar-col"><div class="bar ${cls}" data-h="${h}" style="height:0px; transition-delay:${i*30}ms;"></div><div class="lbl">${x.day}</div></div>`;
    }).join('')}</div>
  </div>`;
  // Tendencia de forma física a largo plazo: km reales por semana en las últimas 12
  // semanas -- a diferencia del gráfico diario de arriba (14 días, para ver la semana
  // actual día a día), esto muestra si el volumen viene subiendo, estable o bajando
  // en el tiempo, algo que ni el gráfico diario ni ninguna otra vista mostraban antes.
  const weeklyTrend = computeWeeklyTrend(12);
  const maxWeekKm = Math.max(...weeklyTrend.map(w=>w.km), 1);
  const weeksWithRuns = weeklyTrend.filter(w=>w.km>0);
  const avgWeekKm = weeksWithRuns.length ? weeksWithRuns.reduce((a,w)=>a+w.km,0)/weeksWithRuns.length : 0;
  const bestWeekKm = Math.max(...weeklyTrend.map(w=>w.km), 0);
  const longTrendCard = `<div class="card">
    <h3 style="margin-bottom:2px;">${t('hist_long_trend_title')}</h3>
    <p class="muted" style="margin:0 0 10px; font-size:12px;">${t('hist_long_trend_subtitle')}</p>
    <div class="stat-row">
      <div class="stat-box"><div class="n mono">${fmtDist(avgWeekKm,1)}</div><div class="l">${t('hist_long_trend_avg')} (${distUnit()})</div></div>
      <div class="stat-box"><div class="n mono">${fmtDist(bestWeekKm,1)}</div><div class="l">${t('hist_long_trend_best')} (${distUnit()})</div></div>
    </div>
    <div class="week-bars" id="hist-longtrend-bars" style="margin-top:14px; gap:4px;">${weeklyTrend.map((w,i)=>{
      const h = w.km>0 ? Math.max(6, Math.round((w.km/maxWeekKm)*70)) : 2;
      const cls = w.km>0 ? 'hivis' : 'rest-day';
      return `<div class="bar-col"><div class="bar ${cls}" data-h="${h}" style="height:0px; transition-delay:${i*25}ms;"></div><div class="lbl">${w.day}</div></div>`;
    }).join('')}</div>
  </div>`;
  const qualityCounts = getQualitySessionBreakdown(30);
  const qualityEntries = Object.entries(qualityCounts).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]);
  const maxQualityCount = qualityEntries.length ? qualityEntries[0][1] : 0;
  const mixCard = qualityEntries.length ? `<div class="card">
    <h3>${t('hist_quality_mix_title')}</h3>
    <p class="muted" style="margin:0 0 12px; font-size:12px;">${t('hist_quality_mix_subtitle')}</p>
    <div class="type-breakdown-list">${qualityEntries.map(([key,count])=>`
      <div class="type-breakdown-row">
        <span class="type-breakdown-label">${t('type_'+key)}</span>
        <div class="type-breakdown-bar-wrap"><div class="type-breakdown-bar" style="width:${Math.round((count/maxQualityCount)*100)}%"></div></div>
        <span class="type-breakdown-count">${count}</span>
      </div>`).join('')}</div>
  </div>` : '';
  // Medallas de récords personales -- antes vivían en Perfil como una lista de tiempos;
  // ahora se muestran acá como medallas (una por distancia estándar, iluminada con el
  // tiempo si ya hay marca, apagada con candado si todavía no), siempre visibles.
  const prRecords = getPersonalRecords();
  const prCard = `<div class="card">
    <h3>${t('hist_pr_title')}</h3>
    <div class="pr-medal-grid">${PR_DISTANCES.map(b=>{
      const rec = prRecords[b.key];
      if(rec) return `<div class="pr-medal achieved"><span class="icon-sq">${ICONS.medal}</span><span class="pr-medal-label">${t('pr_label_'+b.key)}</span><span class="pr-medal-time">${fmtTime(rec.durationSec)}</span></div>`;
      return `<div class="pr-medal"><span class="icon-sq">${ICONS.medal}</span><span class="pr-medal-label">${t('pr_label_'+b.key)}</span><span class="pr-medal-locked">${t('pr_medal_locked')}</span></div>`;
    }).join('')}</div>
  </div>`;
  if(!state.runs || state.runs.length===0){ el.innerHTML = trendsCard + longTrendCard + mixCard + prCard + `<div class="card" style="text-align:center; padding:32px 18px;"><div class="icon-sq" style="width:34px; height:34px; margin:0 auto 12px; color:var(--mist-dim);">${ICONS.empty}</div><p class="muted" style="margin:0;">${t('hist_empty')}</p></div>`; animateHistTrendBars(); return; }
  // Buscador simple + encabezados de mes -- con varios meses de historial cargado, una
  // lista plana se vuelve incómoda de recorrer. El buscador filtra por lo que se ve en
  // cada tarjeta (fecha, zapatilla, "manual"/Strava); los encabezados de mes se insertan
  // solos al detectar un cambio de mes en la lista ya ordenada de más nueva a más vieja.
  const searchEl = document.getElementById('hist-search');
  const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const allRunsDesc = state.runs.slice().reverse();
  const filteredRuns = !query ? allRunsDesc : allRunsDesc.filter(r=>{
    const shoe = state.shoes.find(s=>String(s.id)===String(r.shoeId));
    const longDateStr = new Date(r.date).toLocaleDateString(LOCALE_MAP[lang], {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    const haystack = [longDateStr, shoe?shoe.name:'', r.manual?t('hist_manual_tag'):'', r.source==='strava'?'strava':''].join(' ').toLowerCase();
    return haystack.includes(query);
  });
  if(query && !filteredRuns.length){
    el.innerHTML = trendsCard + longTrendCard + mixCard + prCard + `<div class="card" style="text-align:center; padding:32px 18px;"><p class="muted" style="margin:0;">${t('hist_search_empty')}</p></div>`;
    animateHistTrendBars();
    return;
  }
  let lastMonthKey = null;
  el.innerHTML = trendsCard + longTrendCard + mixCard + prCard + filteredRuns.map(r=>{
    const shoe = state.shoes.find(s=>String(s.id)===String(r.shoeId));
    const paceMin = r.distanceKm>0.02 ? (r.durationSec/60)/r.distanceKm : 0;
    const avgHr = r.avgHr || (r.hrLog && r.hrLog.length ? Math.round(r.hrLog.reduce((a,h)=>a+h.bpm,0)/r.hrLog.length) : null);
    const cal = r.calories || Math.round((state.profile.weight||70)*r.distanceKm*1.036);
    const dateStr = new Date(r.date).toLocaleDateString(LOCALE_MAP[lang], {weekday:'short', day:'numeric', month:'short'});
    const monthKey = new Date(r.date).toLocaleDateString(LOCALE_MAP[lang], {month:'long', year:'numeric'});
    let monthHeader = '';
    if(monthKey !== lastMonthKey){
      monthHeader = `<div class="hist-month-header" style="margin:${lastMonthKey?'22px':'2px'} 2px 8px; font-size:12.5px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--mist-dim);">${monthKey}</div>`;
      lastMonthKey = monthKey;
    }
    return `${monthHeader}<div class="swipe-item" data-swipe-id="${r.id}">
      <div class="swipe-action-delete" role="button" tabindex="0" aria-label="${t('aria_delete')}" onclick="deleteRun('${r.id}')"><span class="icon-sq" style="width:20px; height:20px;">${ICONS.trash}</span></div>
      <div class="card hist-card swipe-content" onclick="openRunDetail('${r.id}')" style="cursor:pointer;">
        <div class="hist-top"><span style="font-weight:700;">${dateStr}</span><span class="hist-date">${r.manual? `<span class="tag tag-soon" style="margin-right:6px;">${t('hist_manual_tag')}</span>`:''}${r.source==='strava'? `<span class="tag tag-mixto" style="margin-right:6px;">Strava</span>`:''}${fmtTime(r.durationSec)}</span></div>
        ${r.points && r.points.length>1 ? `<div class="hist-map" id="hist-map-${r.id}"></div>` : ''}
        <div class="stat-row">
          <div class="stat-box"><div class="n mono">${fmtDist(r.distanceKm)}</div><div class="l">${distUnit()}</div></div>
          <div class="stat-box"><div class="n mono">${fmtPace(paceMin)}</div><div class="l">${t('run_pace_word')}</div></div>
          <div class="stat-box"><div class="n mono">${avgHr||'—'}</div><div class="l">${t('hist_avg_hr')}</div></div>
          <div class="stat-box"><div class="n mono">${cal}</div><div class="l">${t('run_calories')}</div></div>
        </div>
        <p class="muted" style="margin-top:10px; font-size:12.5px;">${t('hist_benefit_'+runBenefitKey(r))}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:8px;">
          <p class="muted" style="margin:0;">${t('hist_shoe')}: ${shoe? escapeHtml(shoe.name) : t('hist_no_shoe')}</p>
          <button onclick="event.stopPropagation(); shareRunImage('${r.id}')" style="background:none; border:1.5px solid var(--asphalt-4); color:var(--hivis); font-size:12px; cursor:pointer; padding:5px 9px; border-radius:6px; display:flex; align-items:center; gap:5px; font-weight:700; flex-shrink:0;">${t('hist_share')}</button>
        </div>
      </div>
    </div>`;
  }).join('');
  historyMaps.forEach(m=>m.remove());
  historyMaps = [];
  (state.runs||[]).filter(r=>r.points && r.points.length>1).forEach(r=>{
    const el = document.getElementById('hist-map-'+r.id);
    if(!el) return;
    const map = L.map(el, {zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, touchZoom:false, boxZoom:false, keyboard:false});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_2i8k_1_882919874396f1a734cae151', {maxZoom:20}).addTo(map);
    const latlngs = r.points.map(p=>[p.lat,p.lon]);
    const poly = L.polyline(latlngs, {color:'#0B5D2E', weight:3, lineCap:'round', lineJoin:'round'}).addTo(map);
    map.fitBounds(poly.getBounds(), {padding:[10,10]});
    historyMaps.push(map);
  });
  animateHistTrendBars();
}
function animateHistTrendBars(){
  ['hist-trend-bars','hist-longtrend-bars'].forEach(id=>{
    const barsEl = document.getElementById(id);
    if(!barsEl) return;
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        barsEl.querySelectorAll('.bar[data-h]').forEach(el=>{ el.style.height = el.dataset.h+'px'; });
      });
    });
  });
}

let detailMap = null;
let historyMaps = [];
function analyzeSplitPacing(splits){
  // Compara el ritmo promedio de la primera mitad de la carrera contra la segunda para
  // detectar si se corrió parejo, acelerando (negative split, buena señal) o
  // desacelerando (positive split -- salir muy rápido y pagarlo después). Solo tiene
  // sentido con unos cuantos parciales, así que lo salteamos en carreras muy cortas.
  if(!splits || splits.length < 4) return null;
  const mid = Math.floor(splits.length/2);
  const avg = arr => arr.reduce((s,x)=>s+x.paceMin,0)/arr.length;
  const p1 = avg(splits.slice(0, mid));
  const p2 = avg(splits.slice(mid));
  const diffPct = (p2 - p1) / p1; // positivo = mas lento en la segunda mitad
  let kind;
  if(diffPct <= -0.02) kind = 'negative';
  else if(diffPct >= 0.05) kind = 'positive_strong';
  else if(diffPct >= 0.02) kind = 'positive_mild';
  else kind = 'even';
  return { kind, diffPct };
}
function renderSplitsSection(splits){
  if(!splits || !splits.length) return '';
  const pacingAnalysis = analyzeSplitPacing(splits);
  const paces = splits.map(s=>s.paceMin);
  const maxPace = Math.max(...paces), minPace = Math.min(...paces);
  const range = (maxPace - minPace) || 1;
  const rows = splits.map(s=>{
    const pct = 22 + ((s.paceMin - minPace) / range) * 73;
    const paceStr = `${Math.floor(s.paceMin)}:${String(Math.round((s.paceMin%1)*60)).padStart(2,'0')}`;
    const elevStr = s.elevGain ? `+${s.elevGain}m` : '—';
    const hrStr = s.avgHr ? `${s.avgHr}bpm` : '—';
    return `<div style="display:flex; align-items:center; gap:9px; margin-bottom:9px;">
      <span class="mono" style="width:44px; font-size:12px; color:var(--mist); flex-shrink:0;">${s.km}km</span>
      <div style="flex:1; height:24px; background:var(--asphalt-3); border-radius:5px; overflow:hidden; position:relative;">
        <div style="height:100%; width:${pct}%; background:#4A9EFF; border-radius:5px;"></div>
        <span style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:11px; font-weight:700; color:#fff;">${paceStr}/km</span>
      </div>
      <span class="mono muted" style="font-size:10px; width:80px; text-align:right; flex-shrink:0;">${elevStr} · ${hrStr}</span>
    </div>`;
  }).join('');
  return `<div class="card" style="margin-top:10px;">
    ${pacingAnalysis ? `<p style="font-weight:700; margin-bottom:10px;">${t('hist_split_'+pacingAnalysis.kind)}</p>` : ''}
    <p class="muted" style="margin-bottom:14px; font-size:12px;">${t('hist_splits_hint')}</p>
    ${rows}
  </div>`;
}
function openRunDetail(runId){
  if(swipeSuppressClick) return;
  const r = state.runs.find(x => String(x.id) === String(runId));
  if(!r) return;
  const paceMin = r.distanceKm>0.02 ? (r.durationSec/60)/r.distanceKm : 0;
  const avgHr = r.avgHr || (r.hrLog && r.hrLog.length ? Math.round(r.hrLog.reduce((a,h)=>a+h.bpm,0)/r.hrLog.length) : null);
  const cal = r.calories || Math.round((state.profile.weight||70)*r.distanceKm*1.036);
  const dateStr = new Date(r.date).toLocaleDateString(LOCALE_MAP[lang], {weekday:'long', day:'numeric', month:'long', year:'numeric'});

  const rows = [];
  rows.push([t('run_km'), `${fmtDist(r.distanceKm)} ${distUnit()}`]);
  rows.push([t('run_time'), fmtTime(r.durationSec)]);
  rows.push([`${t('run_pace_word')} /${distUnit()}`, fmtPace(paceMin)]);
  if(avgHr) rows.push([t('hist_avg_hr'), avgHr+' bpm']);
  if(r.maxHr) rows.push([t('hist_max_hr'), r.maxHr+' bpm']);
  if(r.elevationGain) rows.push([t('hist_elevation'), isImperial() ? Math.round(r.elevationGain*3.28084)+' ft' : Math.round(r.elevationGain)+' m']);
  if(r.avgCadence) rows.push([t('hist_cadence'), Math.round(r.avgCadence*2)+' spm']);
  rows.push([t('run_calories'), cal]);

  const shoeSelect = `<select onchange="changeRunShoe('${r.id}', this.value)" style="background:var(--asphalt-3); border:1.5px solid var(--asphalt-4); color:var(--chalk); padding:6px 8px; border-radius:6px; font-family:inherit; font-size:13px; max-width:60%;">
    <option value="">${t('hist_no_shoe')}</option>
    ${state.shoes.map(s=>`<option value="${s.id}" ${String(s.id)===String(r.shoeId)?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}
  </select>`;

  document.getElementById('run-detail-content').innerHTML = `
    <h2 class="display" style="font-size:22px; margin-bottom:2px;">${escapeHtml(r.name) || dateStr}</h2>
    ${r.name ? `<p class="muted" style="margin-bottom:12px;">${dateStr}</p>` : ''}
    ${r.points && r.points.length>1 ? `<div class="map-wrap" style="height:220px;"><div id="run-detail-map" style="height:100%; width:100%;"></div></div>` : ''}
    <div class="card">
      ${rows.map(([label,val])=>`<div style="display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid var(--asphalt-3);"><span class="muted">${label}</span><span class="mono" style="font-weight:700;">${val}</span></div>`).join('')}
      <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 0; gap:8px; flex-wrap:wrap;"><span class="muted">${t('hist_shoe')}</span>${shoeSelect}</div>
    </div>
    ${r.hrLog && r.hrLog.length>1 ? `<div class="hist-hrlist" style="margin-top:12px;">${r.hrLog.map(h=>`<span class="zone-chip zone-${classifyHR(h.bpm)}">${h.bpm} bpm</span>`).join('')}</div>` : ''}
    ${r.splits && r.splits.length ? `<button class="btn" style="width:100%; margin-top:20px; background:#4A9EFF; color:#fff; border:none;" onclick="toggleSplitsPanel()">${t('hist_splits_title')}</button><div id="splits-panel" style="display:none;">${renderSplitsSection(r.splits)}</div>` : ''}
    <button class="btn btn-outline" style="width:100%; margin-top:20px;" onclick="openEditRun('${r.id}')">${t('edit_run_btn')}</button>
    <button class="btn btn-danger" style="width:100%; margin-top:12px;" onclick="deleteRun('${r.id}')">${t('hist_delete_run')}</button>
  `;
  document.getElementById('run-detail-modal').style.display='block';

  if(r.points && r.points.length>1){
    setTimeout(()=>{
      if(detailMap){ detailMap.remove(); detailMap=null; }
      detailMap = L.map('run-detail-map', {zoomControl:false, attributionControl:true});
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_2i8k_1_882919874396f1a734cae151', {maxZoom:20, attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(detailMap);
      const latlngs = r.points.map(p=>[p.lat,p.lon]);
      const poly = L.polyline(latlngs, {color:'#0B5D2E', weight:4, lineCap:'round', lineJoin:'round'}).addTo(detailMap);
      detailMap.fitBounds(poly.getBounds(), {padding:[16,16]});
    }, 60);
  }
}
function toggleSplitsPanel(){
  const panel = document.getElementById('splits-panel');
  if(panel) panel.style.display = panel.style.display==='none' ? 'block' : 'none';
}
async function deleteRun(runId){
  if(!(await showConfirm(t('hist_delete_confirm'), {danger:true, confirmText:t('delete_word')}))) return;
  const idx = state.runs.findIndex(r => String(r.id) === String(runId));
  if(idx<0) return;
  const run = state.runs[idx];
  const shoe = state.shoes.find(s => String(s.id) === String(run.shoeId));
  if(shoe) shoe.km = Math.max(0, shoe.km - run.distanceKm);
  checkShoeWearAlerts();
  const planDay = state.plan.find(d => d.linkedRunId === run.id);
  if(planDay){ planDay.status = null; planDay.linkedRunId = null; }
  state.runs.splice(idx,1);
  closeRunDetail();
  renderHistory(); renderHome(); renderPlan(); renderPerfil();
  persist();
}
function openHistInfo(){ document.getElementById('hist-info-modal').style.display = 'block'; }
function closeHistInfo(){ document.getElementById('hist-info-modal').style.display = 'none'; }
function openZonesInfo(){
  document.getElementById('zones-info-body').innerHTML = [1,2,3,4,5].map(n=>`
    <div>
      <span class="zone-chip zone-${n}">${t('zone_word')} ${n} · ${t('zone_info_title_'+n)}</span>
      <p class="muted" style="margin-top:6px;">${t('zone_info_desc_'+n)}</p>
    </div>`).join('');
  document.getElementById('zones-info-modal').style.display = 'block';
}
function closeZonesInfo(){ document.getElementById('zones-info-modal').style.display = 'none'; }

/* ================= INSTALL PROMPT (PWA) ================= */
let deferredInstallPrompt = null;
const INSTALL_DISMISS_KEY = 'zancada_install_dismissed';
function isRunningStandalone(){
  try{ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }catch(e){ return false; }
}
function isIOSDevice(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function installBannerDismissed(){
  try{ return localStorage.getItem(INSTALL_DISMISS_KEY) === '1'; }catch(e){ return false; }
}
function maybeShowInstallBanner(){
  if(isRunningStandalone() || installBannerDismissed()) return;
  const card = document.getElementById('install-banner');
  const btn = document.getElementById('install-banner-btn');
  const text = document.getElementById('install-banner-text');
  if(!card || !btn || !text) return;
  if(deferredInstallPrompt){
    text.textContent = t('install_banner_text');
    btn.textContent = t('install_banner_btn');
    btn.style.display = 'block';
    card.style.display = 'flex';
  } else if(isIOSDevice()){
    text.textContent = t('install_banner_ios_text');
    btn.style.display = 'none';
    card.style.display = 'flex';
  }
}
async function triggerInstallPrompt(){
  if(!deferredInstallPrompt) return;
  try{
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
  }catch(e){ /* usuario canceló o el navegador no soporta el prompt */ }
  deferredInstallPrompt = null;
  dismissInstallBanner();
}
function toggleInstallHelp(){
  const body = document.getElementById('install-help-body');
  const chevron = document.getElementById('install-help-chevron');
  const open = body.style.display === 'block';
  body.style.display = open ? 'none' : 'block';
  chevron.style.transform = open ? '' : 'rotate(180deg)';
}
function dismissInstallBanner(){
  const card = document.getElementById('install-banner');
  if(card) card.style.display = 'none';
  try{ localStorage.setItem(INSTALL_DISMISS_KEY, '1'); }catch(e){}
}
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  if(document.getElementById('mainHeader') && document.getElementById('mainHeader').style.display !== 'none') maybeShowInstallBanner();
});
window.addEventListener('appinstalled', ()=>{
  deferredInstallPrompt = null;
  dismissInstallBanner();
});
async function shareRunImage(runId){
  const r = state.runs.find(x => String(x.id) === String(runId));
  if(!r) return;

  const blob = await buildShareImageBlob(r);
  if(!blob) return;

  const file = new File([blob], 'zancada.png', {type:'image/png'});
  if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:'Zancada'}); }catch(e){ /* usuario canceló */ }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'zancada.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }
}
function buildShareImageBlob(r){
  return new Promise(async (resolve)=>{
    try{
      // aseguramos que las tipografías de la app (JetBrains Mono, Bebas Neue) ya estén cargadas
      // antes de dibujar; si no, el canvas dibuja con una fuente de reemplazo de menor calidad.
      try{
        await Promise.all([
          document.fonts.load('400 64px "Bebas Neue"'),
          document.fonts.load('700 92px "JetBrains Mono"'),
          document.fonts.load('700 28px "Inter"'),
        ]);
        await document.fonts.ready;
      }catch(e){}

      const W = 1080, H = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      // el canvas queda transparente a propósito, sin ningún fondo ni caja detrás del texto:
      // es un sticker para subir sobre una foto propia en Instagram.

      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 3;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#D6FF3F';
      ctx.font = '400 80px "Bebas Neue", Arial, sans-serif';
      ctx.fillText('ZANCADA', W/2, 500);

      const paceMin = r.distanceKm>0.02 ? (r.durationSec/60)/r.distanceKm : 0;
      const stats = [
        [fmtDist(r.distanceKm), distUnit().toUpperCase()],
        [`${fmtPace(paceMin)}/${distUnit()}`, t('run_pace_word').toUpperCase()],
        [fmtTime(r.durationSec), t('run_time').toUpperCase()],
      ];
      const rowTop = 610, rowHeight = 240; // apilados uno abajo del otro, con espacio entre cada uno
      stats.forEach((s,i)=>{
        const top = rowTop + i*rowHeight;
        ctx.fillStyle = '#EDEFEF';
        ctx.font = '700 92px "JetBrains Mono", monospace';
        ctx.fillText(s[0], W/2, top + 95);
        ctx.fillStyle = '#EDEFEF';
        ctx.font = '700 28px "Inter", Arial, sans-serif';
        ctx.fillText(s[1], W/2, top + 148);
      });

      if(r.points && r.points.length>1){
        drawRouteSilhouette(ctx, r.points, 140, 1360, W-280, 420);
      }

      canvas.toBlob((blob)=>resolve(blob||null), 'image/png');
    }catch(e){ resolve(null); }
  });
}
async function shareWeeklyRecapImage(){
  const blob = await buildWeeklyShareImageBlob();
  if(!blob) return;
  const file = new File([blob], 'zancada-semana.png', {type:'image/png'});
  if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:'Zancada'}); }catch(e){ /* usuario canceló */ }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'zancada-semana.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }
}
function buildWeeklyShareImageBlob(){
  // Mismo formato "sticker" que el resumen de una carrera individual (buildShareImageBlob),
  // pero con las cifras de la semana completa en vez de una sola corrida.
  return new Promise(async (resolve)=>{
    try{
      try{
        await Promise.all([
          document.fonts.load('400 64px "Bebas Neue"'),
          document.fonts.load('700 92px "JetBrains Mono"'),
          document.fonts.load('700 28px "Inter"'),
        ]);
        await document.fonts.ready;
      }catch(e){}

      const W = 1080, H = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');

      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 3;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#D6FF3F';
      ctx.font = '400 80px "Bebas Neue", Arial, sans-serif';
      ctx.fillText('ZANCADA', W/2, 480);
      ctx.fillStyle = '#EDEFEF';
      ctx.font = '700 42px "Inter", Arial, sans-serif';
      ctx.fillText(t('share_week_word').toUpperCase(), W/2, 555);

      const weekRuns = (state.runs||[]).filter(r => getMondayISO(new Date(r.date)) === state.weekStart);
      const km = weekRuns.reduce((s,r)=>s+r.distanceKm, 0);
      const totalSec = weekRuns.reduce((s,r)=>s+r.durationSec, 0);

      // Km total, arriba de todo.
      ctx.fillStyle = '#EDEFEF';
      ctx.font = '700 92px "JetBrains Mono", monospace';
      ctx.fillText(fmtDist(km), W/2, 745);
      ctx.font = '700 28px "Inter", Arial, sans-serif';
      ctx.fillText(distUnit().toUpperCase(), W/2, 798);

      // Trazos chiquitos de cada corrida de la semana, uno al lado del otro y
      // repartidos parejo -- en vez de un número de sesiones, se ve la semana entera.
      const traceRuns = weekRuns.filter(r => r.points && r.points.length>1);
      if(traceRuns.length){
        const rowY = 950, rowH = 280, gap = 24, marginX = 110;
        const contentW = W - marginX*2;
        const boxW = (contentW - gap*(traceRuns.length-1)) / traceRuns.length;
        traceRuns.forEach((r,i)=>{
          const boxX = marginX + i*(boxW+gap);
          drawRouteSilhouette(ctx, r.points, boxX, rowY, boxW, rowH, 5, 6);
        });
      }

      // Tiempo total, abajo.
      ctx.fillStyle = '#EDEFEF';
      ctx.font = '700 92px "JetBrains Mono", monospace';
      ctx.fillText(fmtTime(totalSec), W/2, 1475);
      ctx.font = '700 28px "Inter", Arial, sans-serif';
      ctx.fillText(t('run_time').toUpperCase(), W/2, 1528);

      canvas.toBlob((blob)=>resolve(blob||null), 'image/png');
    }catch(e){ resolve(null); }
  });
}
function drawRouteSilhouette(ctx, points, x, y, w, h, lineWidth, dotRadius){
  lineWidth = lineWidth || 11;
  dotRadius = dotRadius || 13;
  const lats = points.map(p=>p.lat), lons = points.map(p=>p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const latRange = (maxLat-minLat) || 0.001;
  const lonRange = (maxLon-minLon) || 0.001;
  const scale = Math.min(w/lonRange, h/latRange) * 0.85;
  const drawW = lonRange*scale, drawH = latRange*scale;
  const offsetX = x + (w-drawW)/2;
  const offsetY = y + (h-drawH)/2;

  ctx.beginPath();
  points.forEach((p,i)=>{
    const px = offsetX + (p.lon-minLon)*scale;
    const py = offsetY + (maxLat-p.lat)*scale;
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  });
  ctx.strokeStyle = '#D6FF3F';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  const startPx = offsetX + (points[0].lon-minLon)*scale;
  const startPy = offsetY + (maxLat-points[0].lat)*scale;
  ctx.beginPath();
  ctx.arc(startPx, startPy, dotRadius, 0, Math.PI*2);
  ctx.fillStyle = '#EDEFEF';
  ctx.fill();
}
function closeRunDetail(){
  document.getElementById('run-detail-modal').style.display='none';
  if(detailMap){ detailMap.remove(); detailMap=null; }
}
function changeRunShoe(runId, newShoeId){
  const r = state.runs.find(x => String(x.id) === String(runId));
  if(!r) return;
  const oldShoe = state.shoes.find(s => String(s.id) === String(r.shoeId));
  if(oldShoe) oldShoe.km = Math.max(0, oldShoe.km - r.distanceKm);
  r.shoeId = newShoeId || null;
  const newShoe = state.shoes.find(s => String(s.id) === String(r.shoeId));
  if(newShoe) newShoe.km += r.distanceKm;
  checkShoeWearAlerts();
  persist();
  renderHistory();
  renderPerfil();
}

/* ---- editar una carrera cargada -----
   Antes, la única forma de corregir una carrera con un dato mal cargado (una
   distancia mal importada de Strava, un error al cargarla a mano) era borrarla
   entera y perder el registro. Reutiliza los mismos campos que el alta manual. */
let editingRunId = null;
function openEditRun(runId){
  const r = state.runs.find(x => String(x.id) === String(runId));
  if(!r) return;
  editingRunId = runId;
  // localDateISO, no toISOString().slice(0,10): esto último muestra el día en UTC, que
  // para una carrera cargada a última hora de la noche puede ser el día SIGUIENTE al
  // real (ver el comentario junto a localDateISO/getTodayRun).
  document.getElementById('edit-run-date').value = localDateISO(r.date);
  dateBoxUpdaters['edit-run-date'] && dateBoxUpdaters['edit-run-date']();
  document.getElementById('edit-run-dist').value = r.distanceKm;
  document.getElementById('edit-run-dur').value = Math.round((r.durationSec/60)*10)/10;
  const avgHr = r.avgHr || (r.hrLog && r.hrLog.length ? Math.round(r.hrLog.reduce((a,h)=>a+h.bpm,0)/r.hrLog.length) : '');
  document.getElementById('edit-run-hr').value = avgHr || '';
  const sel = document.getElementById('edit-run-shoe');
  sel.innerHTML = `<option value="">${t('hist_no_shoe')}</option>` + state.shoes.map(s=>`<option value="${s.id}" ${String(s.id)===String(r.shoeId)?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('edit-run-modal').style.display = 'block';
}
function closeEditRun(){ document.getElementById('edit-run-modal').style.display = 'none'; editingRunId = null; }
async function saveEditRun(){
  const r = state.runs.find(x => String(x.id) === String(editingRunId));
  if(!r) return;
  const date = document.getElementById('edit-run-date').value;
  const dist = parseFloat(document.getElementById('edit-run-dist').value);
  const durMin = parseFloat(document.getElementById('edit-run-dur').value);
  if(!date || !(dist>0) || !(durMin>0)){ showToast(t('edit_run_invalid'),'error'); return; }
  const hr = parseInt(document.getElementById('edit-run-hr').value);
  const newShoeId = document.getElementById('edit-run-shoe').value || null;

  // reacomodamos el kilometraje acumulado de zapatillas: se lo restamos al par viejo
  // (con la distancia vieja) y se lo sumamos al par nuevo (con la distancia nueva) --
  // puede ser el mismo par, en cuyo caso el resultado neto es solo el ajuste de km.
  const oldShoe = state.shoes.find(s => String(s.id) === String(r.shoeId));
  if(oldShoe) oldShoe.km = Math.max(0, oldShoe.km - r.distanceKm);

  // conservamos la hora original de la carrera, solo cambiamos el día -- así no se
  // desordena si en algún lado se usa la hora para algo.
  const oldMoment = new Date(r.date);
  const newDate = new Date(date+'T00:00:00');
  newDate.setHours(oldMoment.getHours(), oldMoment.getMinutes(), oldMoment.getSeconds());
  r.date = newDate.toISOString();
  r.distanceKm = dist;
  r.durationSec = Math.round(durMin*60);
  if(hr>0){ r.avgHr = hr; if(!r.hrLog || r.hrLog.length<=1) r.hrLog = [{t:0,bpm:hr}]; }
  r.shoeId = newShoeId;

  const newShoe = state.shoes.find(s => String(s.id) === String(newShoeId));
  if(newShoe) newShoe.km += dist;
  checkShoeWearAlerts();

  const savedRunId = r.id;
  closeEditRun();
  renderHistory(); renderPerfil(); renderAll();
  openRunDetail(savedRunId); // refresca el detalle con los datos nuevos, por si vuelve a mirarlo
  await persist();
  showToast(t('save_confirmed'));
}

/* ================= COACH CHAT (con tool-use real para editar el plan) ================= */
function seedCoachGreeting(){
  state.chat = [{role:'coach', text: t('coach_greeting', {name:state.profile.name, km:state.profile.weeklyKm, goal:t('ob_goal_'+state.profile.goal)}), ts:Date.now()}];
  renderChat();
}
function renderChat(){
  const msgs = state.chat;
  let html = '';
  for(let i=0;i<msgs.length;i++){
    const m = msgs[i];
    const prev = msgs[i-1];
    const next = msgs[i+1];
    const GAP = 5*60000;
    const sameAsPrev = !!(prev && prev.role===m.role && m.role!=='system' && m.ts && prev.ts && (m.ts-prev.ts) < GAP);
    const sameAsNext = !!(next && next.role===m.role && m.role!=='system' && m.ts && next.ts && (next.ts-m.ts) < GAP);
    let groupCls = '';
    if(m.role!=='system'){
      groupCls = sameAsPrev && sameAsNext ? 'mid' : sameAsPrev ? 'last' : sameAsNext ? 'first' : '';
    }
    const safeText = m.role==='system' ? m.text : m.role==='coach' ? formatCoachText(m.text) : escapeHtml(m.text);
    html += `<div class="msg ${m.role} ${groupCls}">${safeText}</div>`;
    if(m.role!=='system' && m.ts && !sameAsNext){
      const d = new Date(m.ts);
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      html += `<div class="msg-time ${m.role==='user'?'right':'left'}">${hh}:${mm}</div>`;
    }
  }
  document.getElementById('chatLog').innerHTML = html;
  renderChatChips();
  scrollChatToBottom();
  updateChatBadge();
}
// Puntito en la pestaña del coach cuando hay un mensaje suyo (proactivo o de ajuste
// automático) que todavía no viste, para no depender de entrar "porque sí" a mirar.
function updateChatBadge(){
  const badge = document.getElementById('chat-tab-badge');
  if(!badge) return;
  const lastSeen = state.lastSeenChatTs || 0;
  const hasUnread = (state.chat||[]).some(m => m.role==='coach' && m.ts && m.ts > lastSeen);
  badge.style.display = hasUnread ? 'block' : 'none';
}
// Chips de respuesta rápida con las preguntas más típicas, para no tener que escribir
// todo siempre (sobre todo recién terminada una corrida). Se muestran una sola vez,
// pegadas debajo del último mensaje, y desaparecen mientras el coach está respondiendo.
const CHAT_CHIP_KEYS = ['coach_chip_progress','coach_chip_lower','coach_chip_next','coach_chip_pain'];
function renderChatChips(){
  const log = document.getElementById('chatLog');
  if(!log) return;
  const sendBtn = document.getElementById('chat-send-btn');
  if(sendBtn && sendBtn.dataset.busy==='1') return;
  const chipsHtml = `<div class="chat-chips">${CHAT_CHIP_KEYS.map(k=>`<button class="chat-chip" onclick="sendChatChip('${k}')">${escapeHtml(t(k))}</button>`).join('')}</div>`;
  log.insertAdjacentHTML('beforeend', chipsHtml);
}
function sendChatChip(key){
  // "Me duele algo" ya no manda un mensaje de texto que se pierde en la conversación --
  // abre el registro de molestias (openPainModal), que guarda la molestia con fecha y
  // zona del cuerpo, y desde ahí manda el mensaje al coach con ese detalle adentro.
  if(key === 'coach_chip_pain'){ openPainModal(); return; }
  const input = document.getElementById('chatInput');
  if(!input) return;
  input.value = t(key);
  handleChatSendClick();
}
function scrollChatToBottom(){
  // El chat ahora scrollea dentro de #chatLog (no la página entera) -- ver
  // syncCoachChatLayout() para el porqué del cambio de modelo.
  const scroller = document.getElementById('chatLog');
  if(!scroller) return;
  requestAnimationFrame(()=>{ scroller.scrollTop = scroller.scrollHeight; });
}
// Botón flotante para volver al último mensaje cuando el corredor scrolleó para
// arriba a leer algo viejo en una charla larga.
function updateChatScrollBtn(){
  const btn = document.getElementById('chat-scroll-bottom-btn');
  if(!btn) return;
  const coachActive = document.getElementById('view-coach')?.classList.contains('active');
  if(!coachActive){ btn.style.display='none'; return; }
  const scroller = document.getElementById('chatLog');
  if(!scroller) return;
  const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  btn.style.display = distanceFromBottom > 200 ? 'flex' : 'none';
}
document.getElementById('chatLog')?.addEventListener('scroll', updateChatScrollBtn, {passive:true});
function paceMinPerKmOf(r){
  if(!r || !r.distanceKm) return '—';
  const p = (r.durationSec/60)/r.distanceKm;
  return `${Math.floor(p)}:${String(Math.round((p%1)*60)).padStart(2,'0')}`;
}
function buildContext(){
  const p = state.profile;
  let ctx = `Nombre: ${p.name}. Edad aprox: ${ageFromBirth(p.birth)}. Peso: ${p.weight}kg. Altura: ${p.height}cm. Corre ${p.weeklyKm}km/semana (calculado automáticamente según objetivo y fecha de carrera). Terreno: ${p.terrain}. Objetivo: ${t('ob_goal_'+p.goal)}. Zonas de FC (bpm): ${JSON.stringify(p.hrZones)}.`;
  if(p.raceDate){
    const weeksLeft = Math.round((new Date(p.raceDate) - new Date()) / (7*86400000));
    ctx += ` Fecha de la carrera objetivo: ${p.raceDate} (${weeksLeft>0?`faltan ${weeksLeft} semanas`:'ya pasó'}).`;
  }
  if(p.weeklyGoalKm > 0) ctx += ` Meta de km que el corredor se puso para esta semana: ${p.weeklyGoalKm}km (esto ya se usó para ajustar el volumen del plan actual, dentro de márgenes seguros).`;
  if(p.goalNote) ctx += ` Objetivo personal, en sus propias palabras: "${p.goalNote}".`;
  const gapWeeks = detectTrainingGapWeeks();
  if(gapWeeks >= 2) ctx += ` Hace ${gapWeeks} semanas que no registra una carrera -- si el volumen del plan actual parece bajo, es porque ya se lo redujo automáticamente por esta pausa.`;
  if(p.coachNotes && p.coachNotes.length) ctx += ` Notas permanentes guardadas sobre el corredor (lesiones, preferencias u otros datos a tener en cuenta siempre): ${p.coachNotes.map(n=>`"${n}"`).join('; ')}.`;
  const activePains = activePainEntries();
  if(activePains.length) ctx += ` Molestias activas registradas por el corredor: ${activePains.map(pa=>`${t('pain_body_'+pa.bodyPart)} (desde ${pa.date}${pa.note?', nota: "'+pa.note+'"':''})`).join('; ')}. Tenelas en cuenta al sugerir ejercicios y preguntá cómo siguen si corresponde.`;
  const todayReadiness = todayReadinessEntry();
  if(todayReadiness) ctx += ` Check-in de hoy sobre cómo durmió/energía: ${todayReadiness.quality}.`;
  if(state.event) ctx += ` Evento objetivo: ${state.event.name} (${state.event.type}) el ${state.event.date}.`;
  if(state.runs.length){
    // En vez de solo la última carrera, le damos al coach una tendencia real: las
    // últimas corridas con ritmo y cuánto volumen acumulado hay en las últimas semanas.
    // Así puede responder con criterio si le preguntan "¿cómo vengo?" o "¿mejoré el ritmo?",
    // en vez de solo reaccionar a lo último que pasó.
    const recent = state.runs.slice(-5);
    const runsSummary = recent.map(r=>`${localDateISO(r.date)}: ${r.distanceKm.toFixed(2)}km en ${fmtTime(r.durationSec)} (ritmo ${paceMinPerKmOf(r)}/km)`).join('; ');
    const cutoff = Date.now() - 28*86400000;
    const last4wKm = state.runs.filter(r=>new Date(r.date).getTime() >= cutoff).reduce((s,r)=>s+r.distanceKm,0);
    ctx += ` Últimas carreras registradas (de más vieja a más nueva): ${runsSummary}. Total corrido en los últimos 28 días: ${last4wKm.toFixed(1)}km.`;
  }
  if(state.shoes.length) ctx += ` Zapatillas: ${state.shoes.map(s=>`${s.name} (${s.km.toFixed(0)}km, ${s.terrain})`).join(', ')}.`;
  // Le pasamos al coach el mismo indicador de carga (agudo:crónico) que ya ve el
  // corredor en la pantalla de Inicio -- antes lo calculábamos solo para mostrar el
  // tag ahí, y si preguntaban "¿cómo viene mi carga?" el coach no tenía ese dato y
  // podía contestar algo inconsistente con lo que el usuario ya está viendo en pantalla.
  const load = calcTrainingLoad();
  if(load) ctx += ` Indicador de carga de entrenamiento (semana actual vs. promedio reciente): ${load.level} (ratio ${load.ratio.toFixed(2)}, corrió ${load.acuteKm.toFixed(1)}km esta semana vs. promedio de ${load.chronicWeeklyAvg.toFixed(1)}km/semana). Este es el mismo indicador que ve en la pantalla de Inicio -- si te pregunta por su carga o riesgo de lesión por volumen, usá este dato en vez de estimarlo de nuevo.`;
  ctx += ` Plan actual: ${state.plan.map(d=>`${d.day}=${d.custom?d.type:d.typeKey}${d.zone?'/Z'+d.zone:''}/${d.dist}km${d.status?'/'+d.status:''}${d.rating?'/calificó:'+d.rating:''}`).join(', ')}.`;
  const nw = getNextWeekPlan();
  ctx += ` Plan de la semana que sigue (semana ${nw.weekNumber}, ya calculado y puede ajustarse un poco según cómo termine esta semana): ${nw.plan.map(d=>`${d.day}=${d.custom?d.type:d.typeKey}${d.zone?'/Z'+d.zone:''}/${d.dist}km`).join(', ')}.`;
  return ctx;
}
const TOOLS = [
  {
    name:"modificar_sesion",
    description:"Modifica UNA sesión puntual del plan semanal: tipo, distancia, zona de frecuencia cardíaca objetivo, terreno y descripción. Usala cuando el corredor pida un cambio en un día específico, de esta semana o de la que sigue. Si semana es 'actual' y el día pedido ya pasó (o ya se corrió/salteó), la herramienta va a rechazar el cambio -- avisale al corredor que ese día ya cerró y ofrecele ajustar desde hoy en adelante, o la semana que viene.",
    input_schema:{type:"object", properties:{
      semana:{type:"string", enum:["actual","siguiente"], description:"Si el cambio es para la semana en curso o para la que sigue. Por defecto 'actual'. Ya tenés el plan de ambas semanas en el contexto."},
      dia:{type:"string", enum:DAY_KEYS, description:"Código del día: mon,tue,wed,thu,fri,sat,sun (siempre en estos códigos, sin importar el idioma de la charla)"},
      tipo:{type:"string", description:"Nombre del tipo de sesión en el idioma de la conversación, ej. 'Rodaje suave', 'Easy run'"},
      distancia_km:{type:"number"},
      zona:{type:"integer", minimum:1, maximum:5},
      terreno:{type:"string", enum:["asfalto","trail","mixto"]},
      descripcion:{type:"string", description:"Instrucción breve para el corredor, en el idioma de la conversación"}
    }, required:["dia","tipo","descripcion"]}
  },
  {
    name:"ajustar_volumen_semana",
    description:"Sube o baja el volumen (distancia) de TODAS las sesiones de running de una semana, aplicando un mismo porcentaje. Usala para pedidos generales como 'quiero correr más', 'esta semana quiero sumar kilómetros' o 'bajale un poco', sin que el corredor especifique un día puntual. Por defecto aplica a la semana ACTUAL; si el corredor habla de la semana que sigue, usá semana:'siguiente'.",
    input_schema:{type:"object", properties:{
      semana:{type:"string", enum:["actual","siguiente"], description:"Por defecto 'actual'."},
      porcentaje:{type:"number", description:"Cambio porcentual a aplicar a la distancia de cada sesión. Ejemplo: 15 para +15%, -10 para -10%."}
    }, required:["porcentaje"]}
  },
  {
    name:"modificar_perfil",
    description:"Modifica datos personales del corredor que afectan cómo se generan sus PRÓXIMOS planes semanales: objetivo de entrenamiento, fecha de la carrera objetivo, terreno preferido o frecuencia cardíaca máxima. Los km semanales se recalculan solos según el objetivo y el tiempo hasta la carrera. Si el corredor está cambiando de objetivo (por ejemplo de 5K a 10K) y menciona cuántos km corre actualmente, pasalo en km_actuales para que el nuevo plan arranque desde su realidad real, no de una fórmula genérica — si cambia el objetivo y no te dice cuántos km corre, preguntáselo antes de aplicar el cambio. Usala para cambios permanentes o 'de ahora en adelante', no solo para esta semana.",
    input_schema:{type:"object", properties:{
      objetivo:{type:"string", enum:["start","5k","10k","15k","21k","42k","ultra","lifestyle"]},
      fecha_carrera:{type:"string", description:"Fecha de la carrera objetivo en formato YYYY-MM-DD, si el corredor la menciona."},
      terreno:{type:"string", enum:["asfalto","trail","mixto"]},
      fc_maxima:{type:"number"},
      km_actuales:{type:"number", description:"Km semanales que el corredor dice estar corriendo ahora mismo. Solo incluir si lo menciona explícitamente."}
    }}
  },
  {
    name:"guardar_nota_coach",
    description:"Guarda un dato permanente sobre el corredor para tenerlo en cuenta siempre de ahora en adelante, aunque no implique cambiar el plan en este momento: una lesión o molestia, una preferencia de entrenamiento, una restricción de horario, o cualquier otro dato relevante que el corredor comparta. Usala apenas el corredor mencione algo así, para no depender de que quede en el historial de la charla.",
    input_schema:{type:"object", properties:{
      nota:{type:"string", description:"El dato a recordar, resumido en una frase breve, en el idioma de la conversación."}
    }, required:["nota"]}
  }
];
function applyPlanChange(input){
  if(input.semana === 'siguiente'){
    // la semana que sigue no es un array persistido como state.plan, así que el cambio puntual
    // se guarda como "override" y se aplica encima de lo que genere getNextWeekPlan() cada vez
    // (que sigue reaccionando a cómo termine esta semana) hasta que se promueva a semana actual
    const nextDay = getNextWeekPlan().plan.find(x=>x.day===input.dia);
    if(nextDay && nextDay.raceDay) return `${input.dia} de la semana que viene es el día de tu carrera (cargada en Próximos Eventos) -- no le puedo asignar otra sesión encima.`;
    if(!state.nextWeekOverrides) state.nextWeekOverrides = {};
    const override = { type: input.tipo, desc: input.descripcion };
    if(typeof input.distancia_km==='number') override.dist = input.distancia_km;
    if(input.zona) override.zone = input.zona;
    if(input.terreno) override.terrain = input.terreno;
    state.nextWeekOverrides[input.dia] = override;
    renderPlan(); persist();
    state.chat.push({role:'system', text:sysMsgWithIcon(ICONS.edit, t('coach_plan_updated')+': '+t('day_'+input.dia)), ts:Date.now()});
    return `OK, actualicé ${input.dia} de la semana que viene: ${input.tipo}${typeof input.distancia_km==='number'?', '+input.distancia_km+'km':''}${input.zona?', zona '+input.zona:''}.`;
  }
  const d = state.plan.find(x=>x.day===input.dia);
  if(!d) return "Día no encontrado.";
  // El día ya pasó (o ya se corrió/salteó) -- no tiene sentido asignarle ahora un
  // entrenamiento distinto de forma retroactiva. Se lo explicamos al modelo para
  // que se lo cuente al corredor en vez de aplicar el cambio silenciosamente.
  if(isDayLocked(input.dia)) return `No puedo modificar ${input.dia}: ya pasó (o ya se corrió/salteó) esta semana. Puedo ajustar desde hoy en adelante, o la semana que viene.`;
  // Ese día es el día de la carrera cargada en Próximos Eventos -- no le pisamos
  // encima otra sesión (el usuario pidió explícitamente que la carrera se siga
  // viendo siempre como el "ejercicio" de ese día, pase lo que pase con el resto
  // del plan). Para cambiar la carrera en sí hay que editarla en Perfil.
  if(d.raceDay) return `${input.dia} es el día de tu carrera (cargada en Próximos Eventos) -- no le puedo asignar otra sesión encima. Si querés cambiar la carrera, se edita desde Perfil.`;
  d.custom = true;
  d.type = input.tipo; d.desc = input.descripcion;
  if(typeof input.distancia_km==='number') d.dist = input.distancia_km;
  if(input.zona) d.zone = input.zona;
  if(input.terreno) d.terrain = input.terreno;
  renderPlan(); renderHome(); persist();
  state.chat.push({role:'system', text:sysMsgWithIcon(ICONS.edit, t('coach_plan_updated')+': '+t('day_'+d.day)), ts:Date.now()});
  return `OK, actualizado ${d.day}: ${d.type}, ${d.dist}km${d.zone?', zona '+d.zone:''}.`;
}
function applyVolumeAdjust(input){
  const pct = input.porcentaje;
  if(typeof pct !== 'number') return 'Falta el porcentaje.';
  const factor = 1 + (pct/100);
  if(input.semana === 'siguiente'){
    const nw = getNextWeekPlan();
    if(!state.nextWeekOverrides) state.nextWeekOverrides = {};
    nw.plan.forEach(d=>{
      if(d.dist>0){
        const lbl = d.custom ? {type:d.type, desc:d.desc} : planLabel(d);
        state.nextWeekOverrides[d.day] = { type: lbl.type, desc: lbl.desc, dist: Math.max(1, Math.round(d.dist*factor)), zone: d.zone, terrain: d.terrain };
      }
    });
    renderPlan(); persist();
    state.chat.push({role:'system', text:sysMsgWithIcon(ICONS.edit, t('coach_plan_updated')), ts:Date.now()});
    return `OK, ajusté el volumen de la semana que viene ${pct>0?'+':''}${pct}%.`;
  }
  // Los días que ya pasaron (o que ya se corrieron/saltearon) quedan afuera del ajuste --
  // no tiene sentido subir o bajar retroactivamente el volumen de un día de esta semana
  // que ya terminó.
  state.plan.forEach(d=>{ if(d.dist>0 && !isDayLocked(d.day)){ d.dist = Math.max(1, Math.round(d.dist*factor)); d.custom = true; } });
  renderPlan(); renderHome(); persist();
  state.chat.push({role:'system', text:sysMsgWithIcon(ICONS.edit, t('coach_plan_updated')), ts:Date.now()});
  return `OK, ajusté el volumen de esta semana ${pct>0?'+':''}${pct}%.`;
}
function applyProfileChange(input){
  const changes = [];
  let recalc = false;
  if(input.objetivo){ state.profile.goal = input.objetivo; changes.push('objetivo'); recalc = true; }
  if(input.fecha_carrera){ state.profile.raceDate = input.fecha_carrera; changes.push('fecha de carrera'); recalc = true; }
  if(input.terreno){ state.profile.terrain = input.terreno; changes.push('terreno'); }
  if(typeof input.fc_maxima==='number'){ state.profile.hrMax = input.fc_maxima; state.profile.hrKnown = true; state.profile.hrZones = computeZones(input.fc_maxima); changes.push('FC máxima'); }
  if(typeof input.km_actuales==='number'){ state.profile.currentWeeklyKm = input.km_actuales; state.profile.runnerType = 'active'; changes.push('km actuales'); recalc = true; }
  if(!changes.length) return 'No hubo cambios para aplicar.';
  if(recalc){
    state.profile.weeklyKm = calcWeeklyKm(state.profile);
    state.plan = preserveLivedDays(state.plan, generatePlan(state.profile, state.weekNumber||1));
    state.nextWeekOverrides = {}; // cambió la base del plan -> los cambios puntuales de la semana que viene ya no aplican
  }
  renderAll(); renderZones(); persist();
  state.chat.push({role:'system', text:sysMsgWithIcon(ICONS.edit, t('coach_plan_updated')), ts:Date.now()});
  return `Perfil actualizado: ${changes.join(', ')}.`;
}
function applyCoachNote(input){
  // Guardamos el dato aparte del historial del chat (que a futuro se puede recortar
  // para no mandar una conversación gigante en cada request) para que una lesión o
  // preferencia mencionada hace meses no se pierda nunca.
  if(!input || !input.nota) return 'Falta la nota a guardar.';
  if(!state.profile.coachNotes) state.profile.coachNotes = [];
  state.profile.coachNotes.push(String(input.nota).slice(0,200));
  if(state.profile.coachNotes.length > 12) state.profile.coachNotes = state.profile.coachNotes.slice(-12);
  persist();
  return 'Nota guardada.';
}
let chatAbortController = null;
function handleChatSendClick(){
  const sendBtn = document.getElementById('chat-send-btn');
  if(sendBtn && sendBtn.dataset.busy==='1'){ cancelChatRequest(); }
  else { sendChat(); }
}
function cancelChatRequest(){
  if(chatAbortController){ chatAbortController.abort(); }
}
async function sendChat(){
  const input = document.getElementById('chatInput');
  const text = input.value.trim(); if(!text) return;
  const sendBtn = document.getElementById('chat-send-btn');
  if(sendBtn?.dataset.busy==='1') return; // ya hay un mensaje en camino
  if(sendBtn){
    sendBtn.dataset.originalHtml = sendBtn.innerHTML;
    sendBtn.dataset.busy = '1';
    sendBtn.innerHTML = `<span class="icon-sq" style="width:16px; height:16px;">${ICONS.stop}</span>`;
  }
  input.value='';
  state.chat.push({role:'user', text, ts:Date.now()});
  renderChat();
  document.getElementById('chatLog').insertAdjacentHTML('beforeend', `<div class="msg coach typing" id="typing"><span></span><span></span><span></span></div>`);
  scrollChatToBottom();

  // Mandamos como máximo los últimos CHAT_HISTORY_LIMIT mensajes: una charla de meses
  // mandaría el historial entero en cada request, cada vez más lento y más caro sin
  // necesidad. Los datos importantes de largo plazo (lesiones, preferencias) no dependen
  // de este historial: quedan guardados aparte con guardar_nota_coach.
  const CHAT_HISTORY_LIMIT = 40;
  let messages = state.chat.filter(m=>m.role==='user'||m.role==='coach').slice(0,-1).slice(-CHAT_HISTORY_LIMIT).map(m=>({role: m.role==='user'?'user':'assistant', content:m.text}));
  messages.push({role:'user', content:text});

  const system = `Sos "Coach Zancada", el entrenador virtual dentro de la app Zancada. Hablás con calidez y honestidad, como un entrenador real de running (no un chatbot genérico). Respondé siempre en ${LANG_NAMES[lang]}. Datos del corredor: ${buildContext()}. Ayudás a definir ejercicios, responder dudas de entrenamiento en calle y trail, y personalizar el plan según los gustos del corredor.

Si el corredor cargó una meta de km semanales o un objetivo personal en sus propias palabras, tenelos presentes: orientá tus sugerencias hacia ese objetivo, y si el plan actual no está bien encaminado para lograrlo, decilo con honestidad y proponé un ajuste concreto (usando las herramientas).

El plan actual incluye, para cada día ya corrido, cómo lo calificó el corredor ("mal", "bien" o "excelente"). Si te pregunta cómo le fue en la semana o pide un resumen, usá esa información para responder con criterio: varias calificaciones "mal" o sesiones salteadas son señal de que conviene bajar volumen o intensidad; varias "excelente" sin ninguna "mal" son señal de que puede sumar un poco más. El sistema ya ajusta el volumen base solo cada semana según este patrón — si te preguntan por qué cambió el plan, podés explicarlo así.

Basá tus recomendaciones en principios reales de entrenamiento, no solo en lo que el corredor pide textualmente:
- La mayoría del volumen semanal (cerca del 80%) debería correrse suave, en zona 1-2 — reservar las sesiones fuertes (series, ritmo, fartlek) para el resto. Es el error más común de corredores amateur: correr todo "medio fuerte" y no progresar.
- El volumen semanal no debería subir más de ~10% de una semana a la siguiente, con una semana de descarga cada 3-4 semanas.
- El entrenamiento es específico al objetivo: para 5k/10k pesa más la velocidad, para 21k/42k pesan más el volumen y la tirada larga.
- Antes de una carrera importante, el volumen baja gradualmente en las últimas semanas (tapering) sin perder del todo la intensidad. Esto ya se aplica automáticamente tanto para la fecha de carrera del perfil como para cualquier carrera cargada en "Próximos eventos" (la tenés en el contexto), y en la semana exacta de esa carrera el día de la carrera ya no lleva sesión propia en el plan (aparece como "Carrera"). Si te preguntan por qué bajó el volumen o por qué ese día no tiene entrenamiento, podés explicarlo así.
- La edad y la contextura física del corredor importan: el plan base ya modera solo la cantidad de sesiones fuertes por semana y la velocidad de progresión según esto (más conservador para corredores mayores o con más masa corporal). Si te preguntan por qué su plan tiene menos series que el de otra persona, o por qué sube el volumen despacio, podés explicarlo así — no lo trates como si fuera un plan genérico igual para cualquiera.
- Cuando hagas un cambio, explicá brevemente el porqué si ayuda a que el corredor entienda el criterio, no solo el qué.

Ya tenés en el contexto el plan de la semana actual Y el de la semana que sigue (todavía no empezó, pero ya está calculado). Si te preguntan qué toca la semana que viene, respondé con esos datos directamente — nunca digas que todavía no está definida.

Tenés cuatro herramientas para aplicar cambios reales en la app. Cuando el corredor pida un cambio, usá SIEMPRE la herramienta correspondiente en la misma respuesta — nunca digas que ya lo cambiaste sin haber llamado a la herramienta:
- modificar_sesion: para cambiar UN día puntual (tipo, distancia, zona, terreno), de esta semana o de la que sigue (parámetro semana).
- ajustar_volumen_semana: para pedidos generales de correr más o menos (ej. "quiero correr más km", "bajale un poco"), sin que especifiquen un día — de esta semana o de la que sigue (parámetro semana).
- modificar_perfil: para cambios permanentes de datos personales que afectan los PRÓXIMOS planes (km semanales base, objetivo, terreno, FC máxima).
- guardar_nota_coach: para guardar un dato permanente del corredor (una lesión o molestia, una preferencia, una restricción de horario, etc.) apenas lo mencione, aunque no implique cambiar el plan ahora mismo. El historial de la charla no es infinito, así que esto es lo único que te garantiza acordarte de algo importante más adelante.
Si el pedido es ambiguo entre "esta semana" y "de ahora en adelante", aplicá el cambio a esta semana con ajustar_volumen_semana para que se note ya, y preguntá si también querés que sea la nueva base con modificar_perfil.

Formato del texto: el chat solo interpreta **negrita** (usala con moderación, para resaltar un dato clave) y guiones "- " al inicio de línea para listas cortas. No uses encabezados (#), links, tablas ni bloques de código: no se muestran bien en el chat.

Sé breve (4-6 líneas salvo que pidan más detalle). Si mencionan dolor agudo, que empeora al correr, o que persiste más de unos días, recomendá frenar y consultar a un profesional de la salud antes de seguir entrenando — no intentes diagnosticar vos la causa.`;

  let finalText = '';
  let networkFailed = false;
  let cancelled = false;
  chatAbortController = new AbortController();
  try{
    // Mandamos el token de sesión igual que en los demás endpoints, para que
    // /api/chat solo le responda a usuarios logueados de verdad y no a
    // cualquiera que le pegue directo a la URL.
    const { data: { session } } = await supabaseClient.auth.getSession();
    for(let loop=0; loop<4; loop++){
      const res = await fetch(apiUrl('/api/chat'), {
        method:'POST', headers:{'Content-Type':'application/json', 'Authorization':`Bearer ${session?.access_token || ''}`},
        body: JSON.stringify({system, tools:TOOLS, messages, lang}),
        signal: chatAbortController.signal
      });
      const data = await res.json();
      if(data.error){ finalText = data.error.message || t('coach_connection_error'); break; }
      const blocks = data.content || [];
      const textPart = blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
      if(textPart) finalText += (finalText? '\n':'') + textPart;
      const toolUses = blocks.filter(b=>b.type==='tool_use');
      if(toolUses.length===0) break;
      const toolResults = toolUses.map(tu=>{
        let result;
        if(tu.name==='modificar_sesion') result = applyPlanChange(tu.input);
        else if(tu.name==='ajustar_volumen_semana') result = applyVolumeAdjust(tu.input);
        else if(tu.name==='modificar_perfil') result = applyProfileChange(tu.input);
        else if(tu.name==='guardar_nota_coach') result = applyCoachNote(tu.input);
        else result = 'Herramienta no reconocida.';
        return {type:'tool_result', tool_use_id:tu.id, content: result};
      });
      messages.push({role:'assistant', content: blocks});
      messages.push({role:'user', content: toolResults});
    }
  }catch(e){ if(e.name==='AbortError') cancelled = true; else networkFailed = true; }
  chatAbortController = null;

  document.getElementById('typing')?.remove();
  if(cancelled){
    // El corredor apretó "pausar": no mostramos error ni reintentamos, simplemente
    // dejamos el mensaje ya enviado en el historial y volvemos a dejar todo listo
    // para el próximo mensaje, igual que hace Gemini al cancelar una respuesta.
    persist();
    restoreSendBtn();
    renderChat(); // vuelve a mostrar los chips de respuesta rápida, ocultos mientras estaba "pausar"
    return;
  }
  if(networkFailed){
    /* No pudimos ni conectarnos — no ensuciamos el historial del chat con un mensaje
       falso del coach. Avisamos con un toast y devolvemos el texto para poder reintentar. */
    haptic(20);
    showToast(t('coach_connection_error'), 'error');
    input.value = text;
    persist();
    restoreSendBtn();
    renderChat();
    return;
  }
  state.chat.push({role:'coach', text: finalText || '...', ts:Date.now()});
  restoreSendBtn();
  renderChat();
  persist();
}
function restoreSendBtn(){
  const sendBtn = document.getElementById('chat-send-btn');
  if(sendBtn && sendBtn.dataset.originalHtml){
    sendBtn.innerHTML = sendBtn.dataset.originalHtml;
    delete sendBtn.dataset.originalHtml;
  }
  if(sendBtn) sendBtn.dataset.busy = '0';
}

/* Traducir todo lo estático apenas carga la página, sin esperar a que el usuario toque un idioma */
applyStaticTranslations();
populateOnboardDays();
