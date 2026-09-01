/* Se actualiza a mano cada vez que se sube una versión nueva — se usa para detectar
   si hay una versión más nueva del index.html publicada y recargar sola la app. */
const APP_VERSION = '2026-09-01T01:59:43Z';
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
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.8 21.8 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
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
  return newPlan.map((newDay,i)=>
    (i<=todayIdx && oldPlan[i] && (oldPlan[i].status==='done'||oldPlan[i].status==='skipped')) ? oldPlan[i] : newDay);
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
  state.plan = preserveLivedDays(state.plan, generatePlan(state.profile, state.weekNumber||1));
  state.nextWeekOverrides = {}; // el perfil cambió de base -> los cambios puntuales que hubiera para la semana que viene ya no aplican sobre el plan nuevo
  kmCheckWrap.style.display = 'none';
  renderAll(); renderPerfil(); persist();
  flashSaved('save-personal-btn');
}
function saveGoals(){
  const weeklyGoal = parseFloat(document.getElementById('perfil-weekly-goal').value) || 0;
  const goalNote = document.getElementById('perfil-goal-note').value.trim();
  const goalChanged = (state.profile.weeklyGoalKm||0) !== weeklyGoal;
  state.profile.weeklyGoalKm = weeklyGoal;
  state.profile.goalNote = goalNote;
  if(goalChanged){
    // la meta semanal ahora es un input real del plan (acotado por seguridad en generatePlan),
    // no solo un número decorativo para la barra de progreso -- así que hay que regenerar
    // el plan de la semana y avisarle al coach para que quede todo conectado
    state.plan = preserveLivedDays(state.plan, generatePlan(state.profile, state.weekNumber||1));
    if(weeklyGoal > 0){
      state.chat.push({role:'coach', text: t('coach_weekly_goal_updated', {km: weeklyGoal}), ts:Date.now()});
      renderChat();
    }
  }
  renderAll(); persist();
  flashSaved('save-goals-btn');
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

  state.profile = {email:pendingEmail, name, weight, height, birth, terrain, trainingDays: trainingDays.length?trainingDays:['tue','thu','sun'], goal, raceDate, runnerType, currentWeeklyKm, hrMax, hrKnown, hrZones:computeZones(hrMax)};
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
  const mult = weekMultiplier(weekNumber, caution) * taperMultiplier(p, weekStartDate);
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
  // días de descanso). Antes cada tipo de sesión mencionaba (o no) esto con números
  // fijos distintos entre sí (10 min acá, 5-10 allá, 10-15 más allá) -- ahora es un
  // solo rango consistente (5 a 15 min) agregado acá una sola vez, en vez de repetido
  // a mano en cada desc_* de los 6 idiomas.
  if(d.dist>0) desc += t('desc_warmup_cooldown');
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
  es: ["Cada kilómetro cuenta, aunque sea lento.","El descanso también es parte del entrenamiento.","Los días difíciles construyen corredores fuertes.","Correr suave hoy es correr mejor mañana.","Escuchá a tu cuerpo — el dolor no es lo mismo que la incomodidad.","La constancia le gana a la intensidad, casi siempre.","El mejor ritmo es el que podés sostener y disfrutar.","Un buen calentamiento evita una mala lesión.","Dormí bien: es el entrenamiento invisible.","La motivación te hace empezar, el hábito te hace terminar.","No compares tu progreso con el de otro corredor.","Tu peor día corriendo sigue siendo mejor que uno en el sillón."],
  en: ["Every kilometer counts, even a slow one.","Rest is part of training too.","Hard days build strong runners.","Running easy today means running better tomorrow.","Listen to your body — pain isn't the same as discomfort.","Consistency beats intensity, almost always.","The best pace is the one you can sustain and enjoy.","A good warm-up prevents a bad injury.","Sleep well: it's the invisible training.","Motivation gets you started, habit gets you finished.","Don't compare your progress to another runner's.","Your worst day running still beats a day on the couch."],
  pt: ["Cada quilômetro conta, mesmo que seja devagar.","O descanso também faz parte do treino.","Os dias difíceis constroem corredores fortes.","Correr leve hoje é correr melhor amanhã.","Escute seu corpo — dor não é o mesmo que desconforto.","A constância vence a intensidade, quase sempre.","O melhor ritmo é aquele que você consegue manter e curtir.","Um bom aquecimento evita uma lesão ruim.","Durma bem: é o treino invisível.","A motivação te faz começar, o hábito te faz terminar.","Não compare seu progresso com o de outro corredor.","Seu pior dia correndo ainda é melhor que um dia no sofá."],
  fr: ["Chaque kilomètre compte, même lent.","Le repos fait aussi partie de l'entraînement.","Les jours difficiles forgent des coureurs solides.","Courir doucement aujourd'hui, c'est mieux courir demain.","Écoute ton corps — la douleur n'est pas l'inconfort.","La régularité bat l'intensité, presque toujours.","La meilleure allure est celle que tu peux tenir et apprécier.","Un bon échauffement évite une mauvaise blessure.","Dors bien : c'est l'entraînement invisible.","La motivation te fait démarrer, l'habitude te fait finir.","Ne compare pas ta progression à celle d'un autre coureur.","Ta pire journée de course vaut mieux qu'une journée sur le canapé."],
  it: ["Ogni chilometro conta, anche se lento.","Anche il riposo fa parte dell'allenamento.","I giorni difficili costruiscono corridori forti.","Correre piano oggi significa correre meglio domani.","Ascolta il tuo corpo — il dolore non è lo stesso del disagio.","La costanza batte l'intensità, quasi sempre.","Il ritmo migliore è quello che riesci a sostenere e goderti.","Un buon riscaldamento evita un brutto infortunio.","Dormi bene: è l'allenamento invisibile.","La motivazione ti fa iniziare, l'abitudine ti fa finire.","Non confrontare i tuoi progressi con quelli di un altro corridore.","La tua peggiore giornata di corsa batte comunque una sul divano."],
  de: ["Jeder Kilometer zählt, auch ein langsamer.","Erholung ist auch Teil des Trainings.","Harte Tage machen starke Läufer.","Heute locker laufen heißt morgen besser laufen.","Hör auf deinen Körper — Schmerz ist nicht dasselbe wie Unbehagen.","Beständigkeit schlägt fast immer Intensität.","Das beste Tempo ist das, was du durchhalten und genießen kannst.","Ein gutes Aufwärmen verhindert eine schlechte Verletzung.","Schlaf gut: das ist das unsichtbare Training.","Motivation lässt dich anfangen, Gewohnheit lässt dich fertig werden.","Vergleiche deinen Fortschritt nicht mit dem anderer Läufer.","Dein schlechtester Lauftag schlägt immer noch einen Tag auf dem Sofa."]
};
function renderDailyTip(){
  const today = new Date().toISOString().slice(0,10);
  const pool = DAILY_TIPS[lang] || DAILY_TIPS.es;
  if(state.dailyTipDate !== today || typeof state.dailyTipIndex !== 'number'){
    state.dailyTipDate = today;
    state.dailyTipIndex = Math.floor(Math.random()*pool.length);
  }
  const el = document.getElementById('daily-tip-text');
  if(el) el.textContent = pool[state.dailyTipIndex % pool.length];
}
function renderHome(){
  renderDailyTip();
  document.getElementById('home-name').textContent = state.profile.name;
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString(LOCALE_MAP[lang],{weekday:'short',day:'numeric',month:'short'});
  const idx = (new Date().getDay()+6)%7;
  const today = state.plan[idx];
  const lbl = planLabel(today);
  document.getElementById('home-next-title').textContent = lbl.type;
  document.getElementById('home-next-desc').textContent = lbl.desc;
  document.getElementById('home-next-dist').textContent = today.dist>0 ? fmtDist(today.dist,1)+' '+distUnit() : '';
  document.getElementById('home-next-zone').innerHTML = (today.dist>0 && today.zone) ? `<span class="zone-chip zone-${today.zone}">${t('zone_word')} ${today.zone}</span>` : '';

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

  const msgs = [t('home_msg_new'), t('home_msg_going'), t('home_msg_pain')];
  document.getElementById('home-coach-msg').textContent = msgs[state.runs.length % msgs.length];

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
function renderRunTodayCard(){
  const idx = (new Date().getDay()+6)%7;
  const today = state.plan[idx];
  const card = document.getElementById('run-today-card');
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
  document.getElementById('plan-week-info').innerHTML = label;
  const taperNote = document.getElementById('plan-taper-note');
  if(showTaperUi){
    taperNote.style.display='block';
    taperNote.textContent = taperMult <= 0.55 ? t('plan_taper_note_final') : t('plan_taper_note_early');
  } else {
    taperNote.style.display='none';
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
  state.painLog.push({id:Date.now(), date:new Date().toISOString().slice(0,10), bodyPart, note, active:true, checkinSent:false});
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
  entry.resolvedDate = new Date().toISOString().slice(0,10);
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
function todayISO(){ return new Date().toISOString().slice(0,10); }
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
function updateCredits(){
  document.getElementById('credits-text').textContent = t('perfil_credits');
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
function syncCoachChatLayout(){
  const wrap = document.getElementById('coachChatWrap');
  const header = document.getElementById('mainHeader');
  const tabbar = document.getElementById('tabbar');
  const chatBar = document.getElementById('chatBar');
  const scrollBtnWrap = document.getElementById('chatScrollBtnWrap');
  if(!wrap) return;
  const vv = window.visualViewport;
  const viewportH = vv ? vv.height : window.innerHeight;
  const viewportOffsetTop = vv ? vv.offsetTop : 0;
  const headerH = (header && header.style.display !== 'none') ? header.offsetHeight : 0;
  const kbOpen = document.body.classList.contains('chat-kb-open');
  // con el teclado cerrado, el chat termina justo arriba de la tabbar (con un
  // pequeño margen); con el teclado abierto, la tabbar ya está oculta y el chat
  // baja pegado directamente al borde del teclado, sin hueco.
  const tabbarH = (!kbOpen && tabbar && tabbar.style.display !== 'none') ? tabbar.offsetHeight : 0;
  const bottomGap = kbOpen ? 0 : 8;
  const top = Math.round(viewportOffsetTop + headerH);
  const height = Math.max(0, Math.round(viewportH - headerH - tabbarH - bottomGap));
  wrap.style.top = top + 'px';
  wrap.style.height = height + 'px';
  if(scrollBtnWrap && chatBar) scrollBtnWrap.style.bottom = (chatBar.offsetHeight + 14) + 'px';
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
  // El teclado de iOS tarda unos cientos de ms en aparecer/desaparecer y el evento
  // visualViewport.resize llega de forma asincrónica durante esa animación -- volvemos a
  // medir varias veces mientras se mueve, en vez de confiar en una sola lectura inmediata
  // que probablemente todavía esté midiendo el estado anterior (sin teclado).
  function reapplyDuringAnimation(){
    syncCoachChatLayout();
    [50, 120, 220, 350, 500].forEach(ms => setTimeout(syncCoachChatLayout, ms));
  }
  chatInputEl.addEventListener('focus', ()=>{
    if(tabbarEl) tabbarEl.style.display = 'none';
    document.body.classList.add('chat-kb-open');
    reapplyDuringAnimation();
  });
  chatInputEl.addEventListener('blur', ()=>{
    if(tabbarEl && document.getElementById('view-coach').classList.contains('active')) tabbarEl.style.display = 'flex';
    document.body.classList.remove('chat-kb-open');
    reapplyDuringAnimation();
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
let tracker = {watchId:null, timerId:null, points:[], distanceKm:0, elapsedSec:0, running:false, hrLog:[], lastAnnouncedKm:0, startedAt:null};
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
  initLiveMap();
  updateLiveStats();
  saveRunProgress();
  tracker.watchId = navigator.geolocation.watchPosition(onPosition, onPosError, {enableHighAccuracy:true, maximumAge:1000, timeout:15000});
  tracker.timerId = setInterval(()=>{ if(tracker.running){ tracker.elapsedSec++; updateLiveStats(); if(tracker.elapsedSec % 15 === 0) saveRunProgress(); } }, 1000);
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
  renderAll(); renderHistory();
  await persist();
  showView('inicio');
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
    document.getElementById('man-date').value = new Date().toISOString().slice(0,10);
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
function miniRouteSvg(points){
  if(!points || points.length<2) return `<div class="hist-route" style="display:flex;align-items:center;justify-content:center; color:var(--mist-dim); font-size:12px;">—</div>`;
  const lats=points.map(p=>p.lat), lons=points.map(p=>p.lon);
  const minLat=Math.min(...lats), maxLat=Math.max(...lats), minLon=Math.min(...lons), maxLon=Math.max(...lons);
  const w=300,h=104,pad=14, sx=(maxLon-minLon)||0.0002, sy=(maxLat-minLat)||0.0002;
  const pts = points.map(p=>`${(pad+((p.lon-minLon)/sx)*(w-2*pad)).toFixed(1)},${(h-pad-((p.lat-minLat)/sy)*(h-2*pad)).toFixed(1)}`).join(' ');
  return `<svg class="hist-route" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="#D6FF3F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function computeDailyTrend(days){
  const result = [];
  const today = new Date(); today.setHours(0,0,0,0);
  const weekDayKeys = ['sun','mon','tue','wed','thu','fri','sat'];
  for(let i=days-1; i>=0; i--){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const dateStr = d.toISOString().slice(0,10);
    const km = state.runs.filter(r => r.date.slice(0,10) === dateStr).reduce((a,r)=>a+r.distanceKm,0);
    let planned = false;
    if(state.weekStart && dateStr >= state.weekStart){
      const planDay = state.plan.find(p=>p.day===weekDayKeys[d.getDay()]);
      if(planDay && planDay.dist>0) planned = true;
    }
    result.push({date:dateStr, km, planned, day:d.getDate()});
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
  const prRecords = getPersonalRecords();
  const prEntries = PR_DISTANCES.map(b=>({key:b.key, rec:prRecords[b.key]})).filter(e=>e.rec);
  const prCard = prEntries.length ? `<div class="card">
    <h3>${t('hist_pr_title')}</h3>
    ${prEntries.map(e=>`<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--asphalt-3);"><span class="muted">${t('pr_label_'+e.key)}</span><span class="mono" style="font-weight:700;">${fmtTime(e.rec.durationSec)}</span></div>`).join('')}
  </div>` : '';
  if(!state.runs || state.runs.length===0){ el.innerHTML = trendsCard + mixCard + prCard + `<div class="card" style="text-align:center; padding:32px 18px;"><div class="icon-sq" style="width:34px; height:34px; margin:0 auto 12px; color:var(--mist-dim);">${ICONS.empty}</div><p class="muted" style="margin:0;">${t('hist_empty')}</p></div>`; animateHistTrendBars(); return; }
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
    el.innerHTML = trendsCard + mixCard + prCard + `<div class="card" style="text-align:center; padding:32px 18px;"><p class="muted" style="margin:0;">${t('hist_search_empty')}</p></div>`;
    animateHistTrendBars();
    return;
  }
  let lastMonthKey = null;
  el.innerHTML = trendsCard + mixCard + prCard + filteredRuns.map(r=>{
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
  const barsEl = document.getElementById('hist-trend-bars');
  if(!barsEl) return;
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      barsEl.querySelectorAll('.bar[data-h]').forEach(el=>{ el.style.height = el.dataset.h+'px'; });
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
  document.getElementById('edit-run-date').value = new Date(r.date).toISOString().slice(0,10);
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
    const runsSummary = recent.map(r=>`${new Date(r.date).toISOString().slice(0,10)}: ${r.distanceKm.toFixed(2)}km en ${fmtTime(r.durationSec)} (ritmo ${paceMinPerKmOf(r)}/km)`).join('; ');
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
    description:"Modifica UNA sesión puntual del plan semanal: tipo, distancia, zona de frecuencia cardíaca objetivo, terreno y descripción. Usala cuando el corredor pida un cambio en un día específico, de esta semana o de la que sigue.",
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
  state.plan.forEach(d=>{ if(d.dist>0){ d.dist = Math.max(1, Math.round(d.dist*factor)); d.custom = true; } });
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
