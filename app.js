/* ================= CLÁSICA 2026 — App Participante =================
   Reescritura con el design system de SEP-GROUP (loader global, login por
   pestañas, PIN local por dispositivo, selector iOS de fecha, driveImg_,
   modales propios e instalación PWA), conservando los contratos de la API.
   ================================================================= */

/* URL /exec del Web App de Apps Script. */
const API_BASE = 'https://script.google.com/macros/s/AKfycbxnc3ajRaV6-v9TSfBnVEdYUyWSKcTkbJlHsjpUV6UHJ--I9euyVdRIJrvpStGA-FBR/exec';

/* ---------- estado ---------- */
const S = { boot: null, cfg: {}, cats: [], textos: {}, doc: '', inscrito: null, form: {}, fechaNac: '', editando: false };

const $ = (id) => document.getElementById(id);
const $$ = (sel, c = document) => Array.from(c.querySelectorAll(sel));

/* ---------- íconos SVG inline ---------- */
const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
};

/* ================= LOADER GLOBAL ================= */
const loaderEl = $('loader');
let loadingCount = 0, loaderTimer = null;
function startLoading() { loadingCount++; if (loadingCount === 1) { loaderTimer = setTimeout(() => { loaderEl.classList.remove('hidden'); loaderTimer = null; }, 120); } }
function stopLoading() { if (loadingCount === 0) return; loadingCount--; if (loadingCount === 0) { if (loaderTimer) { clearTimeout(loaderTimer); loaderTimer = null; } loaderEl.classList.add('hidden'); } }

/* ================= API (POST text/plain evita preflight CORS) ================= */
async function api(action, payload = {}, opts = {}) {
  if (!opts.silent) startLoading();
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, payload))
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Error del servidor');
    return json.data;
  } finally {
    if (!opts.silent) stopLoading();
  }
}

const BANNER_VIEWS = ['instalar', 'login', 'inicio'];
const show = (v) => {
  $$('.view').forEach(s => s.classList.remove('active'));
  $('view-' + v).classList.add('active');
  const bb = $('brandBanner'), img = bb && bb.querySelector('img');
  if (bb) bb.classList.toggle('hidden', !(BANNER_VIEWS.includes(v) && img && img.getAttribute('src')));
  window.scrollTo(0, 0);
};
const toast = (t, i = 'info') => Swal.fire({ text: t, icon: i, confirmButtonColor: '#14231c' });
const textoDe = (clave) => (S.textos[clave] || {}).CUERPO || '';
/* Premio: si es numérico → moneda ($500.000); si es texto (ej. "Sorpresa") → tal cual. */
const fmtPremio = (v) => {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '—';
  if (/[^\d.,\s$]/.test(s)) return s;                 // contiene letras u otros → texto literal
  const n = Number(s.replace(/[^\d]/g, ''));
  return isNaN(n) ? s : '$' + n.toLocaleString('es-CO');
};

/* ================= UTILIDADES DE IMAGEN Y FECHA ================= */
/* Normaliza cualquier URL de foto a un formato renderizable en <img>.
   Drive → thumbnail?id=...&sz=w1000 ; otras (Cloudinary…) → tal cual ; vacío → default. */
function driveImg_(url) {
  const s = String(url || '');
  if (!s) return S.cfg.ICONO_USUARIO_DEFAULT || '';
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!m) return s;
  return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1000';
}

const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* Convierte "YYYY-MM-DD HH:mm:ss" (o Date/ISO) a Date sin sorpresas de zona. */
function parseFecha_(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s); return isNaN(d) ? null : d;
}

/* "Domingo, 5 de julio de 2026 - 12:04 PM" */
function fechaLargaEs_(v) {
  const d = parseFecha_(v); if (!d) return String(v || '');
  let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if (h === 0) h = 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${DIAS_ES[d.getDay()]}, ${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()} - ${h}:${mm} ${ap}`;
}
/* "16 de enero de 1989" (solo fecha) */
function fechaTextoDia_(iso) {
  const d = parseFecha_(iso); if (!d) return String(iso || '');
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;
}
/* Devuelve YYYY-MM-DD a partir de cualquier valor de fecha. */
function soloFechaISO_(v) {
  const d = parseFecha_(v); if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/* Fecha del evento en Safari/iOS sin "Invalid Date" (espacio→T, offset -05:00). */
function fechaEventoDate_() {
  let v = S.cfg.EVENTO_FECHA_ISO;
  if (!v) return null;
  if (v instanceof Date) return v;
  let s = String(v).trim().replace(' ', 'T');
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += '-05:00';
  const d = new Date(s); return isNaN(d) ? parseFecha_(v) : d;
}

/* ================= ARRANQUE ================= */
(async function init() {
  $('footVersion').textContent = 'v' + (window.APP_VERSION || '1.0.0');
  buildPinKeypad();
  wire();
  try {
    S.boot = await api('bootstrap');
    S.cfg = S.boot.config || {};
    S.cats = S.boot.categorias || [];
    (S.boot.textos || []).forEach(t => S.textos[t.CLAVE] = t);
    aplicarMarca_();
  } catch (e) {
    toast('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 'error');
  }
  rutaInicial_();
})();

/* Aplica ícono de app (favicon incluido) y banner de cabecera. */
function aplicarMarca_() {
  const icon = S.cfg.ICONO_APP || '';
  if (icon) {
    ['favicon', 'appleicon'].forEach(id => { const el = $(id); if (el) el.href = icon; });
    ['loaderIcon', 'loginIcono', 'instalarIcono'].forEach(id => { const el = $(id); if (el) el.src = icon; });
  }
  const banner = S.cfg.BANNER_APP || '';
  if (banner) { const b = $('headerBanner'); if (b) b.src = banner; }
}

/* ================= PWA: INSTALACIÓN ================= */
let deferredPrompt = null;
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: installed)').matches
    || window.navigator.standalone === true;
}
function isIOS() { return /(iphone|ipad|ipod)/i.test(navigator.userAgent || ''); }
function instaladaFlag() { try { return localStorage.getItem('clasica_pwa') === '1'; } catch (_) { return false; } }
function marcarInstalada() { try { localStorage.setItem('clasica_pwa', '1'); } catch (_) { } }

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; actualizarSeccionInstalar(); });
window.addEventListener('appinstalled', () => { marcarInstalada(); deferredPrompt = null; });

function actualizarSeccionInstalar() {
  $('install-android')?.classList.add('hidden');
  $('install-ios')?.classList.add('hidden');
  if (isIOS()) { $('install-ios')?.classList.remove('hidden'); }
  else {
    $('install-android')?.classList.remove('hidden');
    const btn = $('btn-install'); if (btn) btn.style.display = deferredPrompt ? '' : 'none';
  }
}

/* Decide primera vista: instalar (si no está instalada) o login. */
function rutaInicial_() {
  if (isStandalone() || instaladaFlag()) { show('login'); return; }
  actualizarSeccionInstalar();
  show('instalar');
}

/* ================= WIRE ================= */
function wire() {
  /* Instalación */
  $('btn-install')?.addEventListener('click', async () => {
    if (!deferredPrompt) { toast('La instalación aún no está disponible. Usa el menú del navegador.', 'info'); return; }
    const dp = deferredPrompt; dp.prompt();
    const choice = await dp.userChoice; deferredPrompt = null;
    if (choice.outcome === 'accepted') { marcarInstalada(); }
    show('login');
  });
  $('btn-cont-web')?.addEventListener('click', () => show('login'));
  $('btn-cont-web-ios')?.addEventListener('click', () => show('login'));

  /* Login: pestañas */
  $$('.login-tab').forEach(t => t.addEventListener('click', () => cambiarPane(t.dataset.pane)));

  /* Login: ojo mostrar/ocultar documento */
  const eye = $('eyeDoc'); eye.innerHTML = IC.eye;
  eye.addEventListener('click', () => {
    const inp = $('loginDoc');
    const oculto = inp.type === 'password';
    inp.type = oculto ? 'text' : 'password';
    eye.innerHTML = oculto ? IC.eyeOff : IC.eye;
  });

  /* Login por documento */
  $('btnLogin').onclick = doLogin;
  $('loginDoc').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  /* Botones de navegación (íconos SVG) */
  $('formBack').innerHTML = IC.back;
  $('resumenBack').innerHTML = IC.back;
  $('comBack').innerHTML = IC.back;
  $('btnSalir').innerHTML = IC.logout;

  $('formBack').onclick = () => S.editando ? entrarInicio() : (S.inscrito ? entrarInicio() : show('login'));
  $('resumenBack').onclick = () => show('form');
  $('comBack').onclick = () => entrarInicio();

  $('btnVerResumen').onclick = irAResumen;
  $('btnConfirmar').onclick = confirmar;
  $('btnSalir').onclick = () => location.reload();
  $('btnEditarRegistro').onclick = editarRegistro;
  $('btnMencion').onclick = generarMencion;
  $('btnComunicados').onclick = abrirComunicados;

  /* Picker iOS */
  $('iosp-cancel').addEventListener('click', () => $('ios-picker').classList.add('hidden'));
  $$('.iosp-arrow').forEach(b => b.addEventListener('click', () => iospNudge_(b.dataset.col, +b.dataset.d)));
  $('iosp-ok').addEventListener('click', iospConfirmar_);
}

/* ================= LOGIN: PESTAÑAS Y PIN ================= */
function cambiarPane(pane) {
  $$('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.pane === pane));
  $('pane-doc').classList.toggle('active', pane === 'doc');
  $('pane-pin').classList.toggle('active', pane === 'pin');
  if (pane === 'pin') prepararPin();
}

function docRecordado() { try { return localStorage.getItem('clasica_doc') || ''; } catch (_) { return ''; } }
function recordarDoc(doc) { try { localStorage.setItem('clasica_doc', doc); } catch (_) { } }

let pinBuffer = '';
function buildPinKeypad() {
  const pad = $('pinKeypad');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  pad.innerHTML = keys.map(k => k === '' ? '<div></div>'
    : `<button class="pin-key ${k === '⌫' ? 'action' : ''}" data-k="${k}">${k}</button>`).join('');
  $$('.pin-key', pad).forEach(b => b.addEventListener('click', () => pinTecla(b.dataset.k)));
}
function prepararPin() {
  pinBuffer = ''; pintarPinDots();
  const doc = docRecordado();
  if (!doc) {
    $('pinHint').textContent = 'Primero entra con tu documento en este dispositivo. Luego podrás usar tu PIN.';
    $('pinKeypad').style.opacity = '.35'; $('pinKeypad').style.pointerEvents = 'none';
  } else {
    $('pinHint').textContent = 'Dispositivo de ••••' + doc.slice(-4) + '. Ingresa tu PIN de 4 dígitos.';
    $('pinKeypad').style.opacity = '1'; $('pinKeypad').style.pointerEvents = 'auto';
  }
}
function pintarPinDots() {
  $$('#pinPad .pin-dot').forEach((d, i) => d.classList.toggle('filled', i < pinBuffer.length));
}
function pinTecla(k) {
  if (k === '⌫') { pinBuffer = pinBuffer.slice(0, -1); pintarPinDots(); return; }
  if (pinBuffer.length >= 4) return;
  pinBuffer += k; pintarPinDots();
  if (pinBuffer.length === 4) validarPin();
}
async function validarPin() {
  const doc = docRecordado();
  if (!doc) return;
  const pin = pinBuffer;
  try {
    const r = await api('loginParticipante', { documento: doc });
    if (!r.existe) { falloPin('No encontramos tu registro. Entra con tu documento.'); return; }
    const guardado = String(r.inscrito.PIN || '').replace(/\D/g, '').padStart(4, '0');
    const esperado = guardado || doc.slice(-4).padStart(4, '0');
    if (pin === esperado) { S.doc = doc; S.inscrito = r.inscrito; entrarInicio(); }
    else falloPin('PIN incorrecto. Inténtalo de nuevo.');
  } catch (e) { falloPin(e.message); }
}
function falloPin(msg) { pinBuffer = ''; pintarPinDots(); toast(msg, 'warning'); }

/* ================= LOGIN POR DOCUMENTO ================= */
async function doLogin() {
  const doc = ($('loginDoc').value || '').replace(/\D/g, '');
  if (!/^\d{6,10}$/.test(doc)) return toast('El documento debe tener entre 6 y 10 dígitos.', 'warning');
  S.doc = doc;
  try {
    const r = await api('loginParticipante', { documento: doc });
    recordarDoc(doc); // recuerda el dispositivo para el PIN rápido
    if (r.existe) { S.inscrito = r.inscrito; entrarInicio(); }
    else { await flujoInscripcion(); }
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= MODAL PROPIO REUTILIZABLE ================= */
/* Devuelve Promise<boolean>. onOk(host) puede validar (return false para bloquear). */
function abrirModal({ title, html, okText = 'Continuar', cancelText = 'Salir', onOk }) {
  return new Promise(resolve => {
    const root = $('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card">
          <div class="modal-head"><h2>${title}</h2></div>
          <div class="modal-body">${html}</div>
          <div class="modal-foot">
            <button class="btn btn-ghost" data-a="cancel">${cancelText}</button>
            <button class="btn btn-primary" data-a="ok">${okText}</button>
          </div>
        </div>
      </div>`;
    const host = root.querySelector('.modal-card');
    // Resalta la fila del check personalizado al marcarlo (si los hay).
    root.querySelectorAll('.check-line input').forEach(inp =>
      inp.addEventListener('change', () => inp.closest('.check-line').classList.toggle('on', inp.checked)));
    const cerrar = (val) => { root.innerHTML = ''; resolve(val); };
    root.querySelector('[data-a="cancel"]').onclick = () => cerrar(false);
    root.querySelector('[data-a="ok"]').onclick = () => {
      if (onOk && onOk(host) === false) return;
      cerrar(true);
    };
  });
}

/* ================= FLUJO DE 3 MODALES ================= */
async function flujoInscripcion() {
  // Modal 1 — Tratamiento de datos
  const t1 = (S.textos.MODAL_TRATAMIENTO_DATOS || {}).TITULO || 'Tratamiento de datos';
  const ok1 = await abrirModal({
    title: t1, okText: 'Acepto', cancelText: 'No acepto',
    html: `<div class="modal-doc">${textoDe('MODAL_TRATAMIENTO_DATOS')}</div>`
  });
  if (!ok1) return;

  // Modal 2 — Reglamento (HTML del Doc). Loader mientras carga.
  let htmlRegl = '';
  try { htmlRegl = (await api('docHtmlModal', { plantilla: 'REGLAMENTO' })).html; }
  catch (e) { htmlRegl = '<p>No se pudo cargar el reglamento.</p>'; }
  const ok2 = await abrirModal({
    title: 'Reglamento Oficial', okText: 'Continuar con el registro', cancelText: 'Salir',
    html: `<div class="modal-doc">${htmlRegl}</div>`
  });
  if (!ok2) return;

  // Modal 3 — Consentimiento (HTML del Doc) + 3 checks personalizados
  let htmlCons = '';
  try { htmlCons = (await api('docHtmlModal', { plantilla: 'CONSENTIMIENTO' })).html; }
  catch (e) { htmlCons = '<p>No se pudo cargar el consentimiento.</p>'; }
  const checkLine = (id, txt) => `
    <label class="check-line" data-ck="${id}">
      <input type="checkbox" id="${id}">
      <span class="check-box">${IC.check}</span>
      <span class="check-txt">${txt}</span>
    </label>`;
  const checksHtml = `
    <div class="modal-doc">${htmlCons}</div>
    <hr style="border:none;border-top:1px solid var(--linea);margin:16px 0">
    ${checkLine('ck1', textoDe('CHECK_1') || 'Acepto el reglamento oficial de la competencia.')}
    ${checkLine('ck2', textoDe('CHECK_2') || 'Declaro estar en condiciones físicas para participar.')}
    ${checkLine('ck3', textoDe('CHECK_3') || 'Autorizo el uso de mi imagen y el tratamiento de mis datos.')}`;
  const ok3 = await abrirModal({
    title: 'Consentimiento Informado', okText: 'Completar registro', cancelText: 'Salir',
    html: checksHtml,
    onOk: (host) => {
      const todos = ['ck1', 'ck2', 'ck3'].every(id => host.querySelector('#' + id).checked);
      if (!todos) { toast('Debes aceptar los tres recuadros para continuar.', 'warning'); return false; }
      return true;
    }
  });
  if (!ok3) return;

  // Los timestamps de aceptación los estampa el servidor (hora Bogotá).
  S.form = {};
  S.editando = false;
  construirFormulario();
  $('formTitle').textContent = 'Formulario de inscripción';
  $('btnVerResumen').textContent = 'Ver resumen';
  $('btnVerResumen').onclick = irAResumen;
  show('form');
}

/* ================= FORMULARIO ================= */
function opciones(arr, sel) {
  return arr.map(o => {
    const val = typeof o === 'object' ? o.value : o;
    const lbl = typeof o === 'object' ? o.label : o;
    return `<option value="${val}" ${val === sel ? 'selected' : ''}>${lbl}</option>`;
  }).join('');
}

function construirFormulario(pre) {
  pre = pre || {};
  const deptos = Object.keys(UBICACIONES).sort();
  const rhOpts = (S.boot.rh || []).map(r => ({ value: r.largo, label: r.largo }));
  const g = pre.GENERO || '';
  const fechaPre = pre.FECHA_NACIMIENTO ? soloFechaISO_(pre.FECHA_NACIMIENTO) : '';
  const fotoPrev = pre.FOTO_URL ? driveImg_(pre.FOTO_URL) : '';
  const html = `
    <div class="fld"><label>Nombres</label><input id="f_NOMBRES" value="${pre.NOMBRES || ''}"></div>
    <div class="fld"><label>Apellidos</label><input id="f_APELLIDOS" value="${pre.APELLIDOS || ''}"></div>
    <div class="fld"><label>Género</label><select id="f_GENERO"><option value="">—</option>${opciones([{ value: 'Masculino', label: 'Masculino' }, { value: 'Femenino', label: 'Femenino' }], g)}</select></div>
    <div class="fld"><label>RH</label><select id="f_RH"><option value="">—</option>${opciones(rhOpts, pre.RH)}</select></div>
    <div class="fld"><label>Celular (10 dígitos)</label><input id="f_CELULAR" inputmode="numeric" maxlength="10" value="${pre.CELULAR || ''}"></div>
    <div class="fld"><label>EPS</label><select id="f_EPS"><option value="">—</option>${opciones(S.boot.eps || [], pre.EPS)}</select></div>
    <div class="fld fld-full"><label>Correo</label><input id="f_CORREO" type="email" value="${pre.CORREO || ''}"></div>
    <div class="fld"><label>Departamento</label><select id="f_DEPARTAMENTO"><option value="">—</option>${opciones(deptos, pre.DEPARTAMENTO)}</select></div>
    <div class="fld"><label>Municipio</label><select id="f_MUNICIPIO"><option value="">—</option></select></div>
    <div class="fld"><label id="lbl_contacto">Contacto de emergencia</label><input id="f_CONTACTO_EMERGENCIA" value="${pre.CONTACTO_EMERGENCIA || ''}"></div>
    <div class="fld"><label id="lbl_tel_emerg">Tel. emergencia (10 dígitos)</label><input id="f_TEL_EMERGENCIA" inputmode="numeric" maxlength="10" value="${pre.TEL_EMERGENCIA || ''}"></div>
    <div class="fld fld-full"><label>Categoría</label><select id="f_CATEGORIA"><option value="">Selecciona tu género primero</option></select></div>
    <div id="notaMenor" class="nota-menor fld-full hidden">Estás inscribiendo a un menor: los datos personales son del niño o niña, y el contacto de emergencia es el de su padre, madre o acudiente.</div>
    <div id="catInfo" class="datos-grid fld-full" style="margin:2px 0"></div>
    <div class="fld fld-full">
      <label>Fecha de nacimiento</label>
      <button type="button" id="btnFecha" class="date-btn">${IC.cal}<span id="btnFechaTxt">${fechaPre ? fechaTextoDia_(fechaPre) : 'Seleccionar fecha'}</span></button>
    </div>
    <div id="autorizacionSlot" class="fld fld-full hidden"><label>Autorización del acudiente (PDF/imagen) — obligatoria para menores</label><input id="f_AUTORIZACION" type="file" accept="application/pdf,image/*"></div>
    <div class="fld fld-full">
      <label>Foto de perfil (opcional)</label>
      ${fotoPrev ? `<img src="${fotoPrev}" alt="Foto actual" style="width:84px;height:84px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);margin-bottom:8px">` : ''}
      <input id="f_FOTO" type="file" accept="image/*">
      ${fotoPrev ? '<div class="muted" style="margin-top:4px">Sube una nueva imagen solo si deseas reemplazarla.</div>' : ''}
    </div>`;
  $('formFields').innerHTML = html;
  S.fechaNac = fechaPre || '';

  $('f_GENERO').onchange = refrescarCategorias;
  $('f_DEPARTAMENTO').onchange = () => refrescarMunicipios();
  $('f_CATEGORIA').onchange = mostrarInfoCategoria;
  $('btnFecha').onclick = abrirRuedaFecha;
  if (g) refrescarCategorias();
  if (pre.DEPARTAMENTO) refrescarMunicipios(pre.MUNICIPIO);
  if (pre.CATEGORIA) { $('f_CATEGORIA').value = pre.CATEGORIA; mostrarInfoCategoria(); }
}

const CATS_MENOR = ['PJ', 'JU', 'PB'];                 // categorías de menores (requieren autorización)
const esMenorCat = (p) => CATS_MENOR.includes(p);
const esUnisexCat = (c) => {                            // categorías para ambos géneros (niños y niñas)
  const g = String(c.GENERO || '').trim().toUpperCase();
  return ['MIXTO', 'AMBOS', 'UNISEX', 'U', 'MF', 'FM'].includes(g) || c.PREFIJO === 'PB';
};

function refrescarCategorias() {
  const g = ($('f_GENERO').value || '').charAt(0).toUpperCase();
  const permit = S.cats.filter(c =>
    esUnisexCat(c) ? (g === 'M' || g === 'F')
      : (g === 'F') ? (c.PREFIJO === 'DM' || c.PREFIJO === 'BF')
        : (g === 'M') ? (c.PREFIJO !== 'DM' && c.PREFIJO !== 'BF')
          : false);
  $('f_CATEGORIA').innerHTML = '<option value="">—</option>' + permit.map(c => `<option value="${c.PREFIJO}">${c.NOMBRE}</option>`).join('');
  $('catInfo').innerHTML = '';
}

function refrescarMunicipios(sel) {
  const dep = $('f_DEPARTAMENTO').value;
  const muni = (UBICACIONES[dep] || []).slice().sort();
  $('f_MUNICIPIO').innerHTML = '<option value="">—</option>' + muni.map(m => `<option value="${m}" ${m === sel ? 'selected' : ''}>${m}</option>`).join('');
}

function mostrarInfoCategoria() {
  const pref = $('f_CATEGORIA').value;
  const c = S.cats.find(x => x.PREFIJO === pref);
  const menor = esMenorCat(pref);
  $('autorizacionSlot').classList.toggle('hidden', !menor);
  // Etiquetas del contacto de emergencia según sea menor (acudiente) o adulto
  const lc = $('lbl_contacto'), lt = $('lbl_tel_emerg'), nota = $('notaMenor');
  if (lc) lc.textContent = menor ? 'Nombre del padre, madre o acudiente' : 'Contacto de emergencia';
  if (lt) lt.textContent = menor ? 'Celular del acudiente (10 dígitos)' : 'Tel. emergencia (10 dígitos)';
  if (nota) nota.classList.toggle('hidden', !menor);
  if (!c) { $('catInfo').innerHTML = ''; return; }
  $('catInfo').innerHTML = `
    <div class="item"><div class="k">Vueltas</div><div class="v">${c.VUELTAS}</div></div>
    <div class="item"><div class="k">Distancia</div><div class="v">${c.KM} km</div></div>
    <div class="item"><div class="k">1° / 2° / 3°</div><div class="v" style="font-size:.9rem">${fmtPremio(c.PREMIO_1)} · ${fmtPremio(c.PREMIO_2)} · ${fmtPremio(c.PREMIO_3)}</div></div>
    <div class="item cat-hero"><img src="${driveImg_(c.ICONO_URL)}"><div class="v" style="font-size:.9rem">${c.NOMBRE}</div></div>`;
}

/* ================= SELECTOR DE FECHA iOS (nacimiento) ================= */
const IOSP_H = 42;
const IOSP = { dias: [], meses: [], anios: [] };

function selCol_(colEl) { return Math.max(0, Math.round(colEl.scrollTop / IOSP_H)); }
function marcarSel_(colEl) { const i = selCol_(colEl); colEl.querySelectorAll('.iosp-item').forEach(el => el.classList.toggle('sel', +el.dataset.i === i)); }

function buildCol_(colEl, items, initIdx, onSettle) {
  colEl.innerHTML = '<div class="iosp-pad"></div>' +
    items.map((t, i) => `<div class="iosp-item" data-i="${i}">${t}</div>`).join('') +
    '<div class="iosp-pad"></div>';
  colEl.scrollTop = Math.max(0, initIdx) * IOSP_H;   // requiere que el overlay ya sea visible
  marcarSel_(colEl);
  let to = null;
  colEl.onscroll = () => {
    marcarSel_(colEl); iospActualizarLive_();
    if (to) clearTimeout(to);
    to = setTimeout(() => { const i = selCol_(colEl); colEl.scrollTo({ top: i * IOSP_H, behavior: 'smooth' }); if (onSettle) onSettle(i); }, 90);
  };
  colEl.querySelectorAll('.iosp-item').forEach(el => {
    el.addEventListener('click', () => { const i = +el.dataset.i; colEl.scrollTop = i * IOSP_H; marcarSel_(colEl); iospActualizarLive_(); if (onSettle) onSettle(i); });
  });
}

function iospNudge_(colId, delta) {
  const colEl = $(colId); if (!colEl) return;
  const n = colEl.querySelectorAll('.iosp-item').length;
  const i = Math.min(Math.max(selCol_(colEl) + delta, 0), n - 1);
  colEl.scrollTop = i * IOSP_H; marcarSel_(colEl);
  if (colId === 'iosp-mes' || colId === 'iosp-anio') iospRebuildDias_();
  iospActualizarLive_();
}

function iospDiasEnMes_(mesIdx, anio) { return new Date(anio, mesIdx + 1, 0).getDate(); }
function iospRebuildDias_() {
  const mesIdx = IOSP.meses[Math.min(selCol_($('iosp-mes')), IOSP.meses.length - 1)];
  const anio = IOSP.anios[Math.min(selCol_($('iosp-anio')), IOSP.anios.length - 1)];
  const total = iospDiasEnMes_(mesIdx, anio);
  const curPos = Math.min(selCol_($('iosp-dia')), total - 1);
  IOSP.dias = []; for (let d = 1; d <= total; d++) IOSP.dias.push(d);
  buildCol_($('iosp-dia'), IOSP.dias.map(String), Math.max(0, curPos));
}
function iospLeer_() {
  const dia = IOSP.dias[Math.min(selCol_($('iosp-dia')), IOSP.dias.length - 1)];
  const mesIdx = IOSP.meses[Math.min(selCol_($('iosp-mes')), IOSP.meses.length - 1)];
  const anio = IOSP.anios[Math.min(selCol_($('iosp-anio')), IOSP.anios.length - 1)];
  return { dia, mesIdx, anio };
}
function iospActualizarLive_() {
  const { dia, mesIdx, anio } = iospLeer_();
  $('iosp-live').textContent = `${dia} de ${MESES_ES[mesIdx]} de ${anio}`;
}

function abrirRuedaFecha() {
  const pref = $('f_CATEGORIA').value;
  const c = S.cats.find(x => x.PREFIJO === pref);
  const yMax = c ? +c.ANIO_MAX : 2012, yMin = c ? +c.ANIO_MIN : 1936;

  IOSP.meses = []; for (let m = 0; m <= 11; m++) IOSP.meses.push(m);
  IOSP.anios = []; for (let y = yMax; y >= yMin; y--) IOSP.anios.push(y);

  // Valor inicial: el ya elegido, o punto medio del rango.
  let ref = parseFecha_(S.fechaNac);
  if (!ref || ref.getFullYear() > yMax || ref.getFullYear() < yMin) {
    ref = new Date(Math.round((yMax + yMin) / 2), 0, 15);
  }
  const anioPos = Math.max(0, IOSP.anios.indexOf(ref.getFullYear()));
  const mesPos = Math.max(0, ref.getMonth());
  const total = iospDiasEnMes_(ref.getMonth(), ref.getFullYear());
  IOSP.dias = []; for (let d = 1; d <= total; d++) IOSP.dias.push(d);
  const diaPos = Math.max(0, Math.min(ref.getDate() - 1, total - 1));

  // (Bug B) mostrar ANTES de construir columnas: con display:none, scrollTop no aplica.
  $('ios-picker').classList.remove('hidden');
  buildCol_($('iosp-dia'), IOSP.dias.map(String), diaPos);
  buildCol_($('iosp-mes'), IOSP.meses.map(m => MESES_ES[m].charAt(0).toUpperCase() + MESES_ES[m].slice(1)), mesPos, iospRebuildDias_);
  buildCol_($('iosp-anio'), IOSP.anios.map(String), anioPos, iospRebuildDias_);
  iospActualizarLive_();
}

function iospConfirmar_() {
  const { dia, mesIdx, anio } = iospLeer_();
  const iso = `${anio}-${String(mesIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  $('ios-picker').classList.add('hidden');
  S.fechaNac = iso;
  $('btnFechaTxt').textContent = fechaTextoDia_(iso);
}

/* ================= RECOLECCIÓN Y VALIDACIÓN ================= */
function fileToB64(input) {
  return new Promise(res => {
    const f = input && input.files[0]; if (!f) return res(null);
    const r = new FileReader(); r.onload = () => res({ b64: r.result, mime: f.type }); r.readAsDataURL(f);
  });
}

async function recolectarForm() {
  const g = (id) => ($(id) ? $(id).value.trim() : '');
  const f = {
    DOCUMENTO: S.doc,
    NOMBRES: g('f_NOMBRES'), APELLIDOS: g('f_APELLIDOS'), GENERO: g('f_GENERO'), RH: g('f_RH'),
    CELULAR: g('f_CELULAR').replace(/\D/g, ''), EPS: g('f_EPS'), CORREO: g('f_CORREO'),
    DEPARTAMENTO: g('f_DEPARTAMENTO'), MUNICIPIO: g('f_MUNICIPIO'),
    CONTACTO_EMERGENCIA: g('f_CONTACTO_EMERGENCIA'), TEL_EMERGENCIA: g('f_TEL_EMERGENCIA').replace(/\D/g, ''),
    CATEGORIA: g('f_CATEGORIA'), FECHA_NACIMIENTO: S.fechaNac
  };
  const foto = await fileToB64($('f_FOTO')); if (foto) { f.FOTO_B64 = foto.b64; f.FOTO_MIME = foto.mime; }
  const menor = esMenorCat(f.CATEGORIA);
  if (menor) { const a = await fileToB64($('f_AUTORIZACION')); if (a) { f.AUTORIZACION_B64 = a.b64; f.AUTORIZACION_MIME = a.mime; } }
  return f;
}

function validarClienteForm(f) {
  const e = [];
  if (!f.NOMBRES) e.push('Nombres');
  if (!f.APELLIDOS) e.push('Apellidos');
  if (!f.GENERO) e.push('Género');
  if (!f.RH) e.push('RH');
  if (!/^\d{10}$/.test(f.CELULAR)) e.push('Celular (10 dígitos)');
  if (!f.EPS) e.push('EPS');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.CORREO)) e.push('Correo válido');
  if (!f.DEPARTAMENTO) e.push('Departamento');
  if (!f.MUNICIPIO) e.push('Municipio');
  if (f.CONTACTO_EMERGENCIA.split(/\s+/).filter(Boolean).length < 2) e.push('Contacto emergencia (2 palabras)');
  if (!/^\d{10}$/.test(f.TEL_EMERGENCIA)) e.push('Tel. emergencia (10 dígitos)');
  if (!f.CATEGORIA) e.push('Categoría');
  if (!f.FECHA_NACIMIENTO) e.push('Fecha de nacimiento');
  if ((f.CATEGORIA === 'PJ' || f.CATEGORIA === 'JU') && !f.AUTORIZACION_B64 && !S.editando) e.push('Autorización del acudiente');
  return e;
}

async function irAResumen() {
  const f = await recolectarForm();
  const errs = validarClienteForm(f);
  if (errs.length) return toast('Faltan o son inválidos: ' + errs.join(', '), 'warning');
  S.form = Object.assign(S.form, f);
  const c = S.cats.find(x => x.PREFIJO === f.CATEGORIA) || {};
  const filas = [
    ['Documento', f.DOCUMENTO], ['Nombre', f.NOMBRES + ' ' + f.APELLIDOS], ['Género', f.GENERO],
    ['RH', f.RH], ['Celular', f.CELULAR], ['EPS', f.EPS], ['Correo', f.CORREO],
    ['Ubicación', f.MUNICIPIO + ', ' + f.DEPARTAMENTO], ['Emergencia', f.CONTACTO_EMERGENCIA + ' · ' + f.TEL_EMERGENCIA],
    ['Categoría', c.NOMBRE || f.CATEGORIA], ['Recorrido', (c.VUELTAS || '') + ' vueltas · ' + (c.KM || '') + ' km'],
    ['Nacimiento', fechaTextoDia_(f.FECHA_NACIMIENTO)]
  ];
  $('resumenBox').innerHTML = filas.map(r => `<div><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('');
  show('resumen');
}

async function confirmar() {
  try {
    const r = await api('crearInscrito', { inscrito: S.form });
    S.inscrito = r;
    await Swal.fire({ title: '¡Inscripción confirmada!', html: `Tu dorsal es <b>${r.CODIGO}</b>.<br>Revisa tu correo.`, icon: 'success', confirmButtonColor: '#14231c' });
    entrarInicio();
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= INICIO (sesión) ================= */
function entrarInicio() {
  S.editando = false;
  const r = S.inscrito;
  $('inicioFoto').src = driveImg_(r.FOTO || r.FOTO_URL);
  $('inicioNombre').textContent = (r.NOMBRES + ' ' + r.APELLIDOS).trim();
  $('inicioEstado').textContent = r.ESTADO;
  $('inicioDatos').innerHTML = [
    ['Dorsal', r.CODIGO], ['Categoría', r.CAT_NOMBRE || r.CATEGORIA], ['Vueltas', r.VUELTAS],
    ['Distancia', (r.KM || '') + ' km'], ['RH', r.RH_CORTO || r.RH], ['1° premio', fmtPremio(r.PREMIO_1)]
  ].map(x => `<div class="item"><div class="k">${x[0]}</div><div class="v">${x[1]}</div></div>`).join('');
  // Icono de la categoría en la cabecera de "Tu competencia"
  const cat = (S.cats || []).find(c => c.PREFIJO === (r.CATEGORIA || '')) || {};
  const icoCat = $('inicioCatIcono');
  const urlCat = r.CAT_ICONO || r.CAT_ICONO_URL || cat.ICONO_URL || '';
  if (urlCat) { icoCat.src = driveImg_(urlCat); icoCat.hidden = false; }
  else icoCat.hidden = true;
  iniciarContador();
  show('inicio');
}

let _cdTimer = null;
function iniciarContador() {
  clearInterval(_cdTimer);
  const target = fechaEventoDate_();
  const t = target ? target.getTime() : 0;
  const tick = () => {
    const diff = Math.max(0, t - Date.now());
    const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000),
      m = Math.floor(diff % 3600000 / 60000), s = Math.floor(diff % 60000 / 1000);
    $('countdown').innerHTML = [['Días', d], ['Horas', h], ['Min', m], ['Seg', s]]
      .map(x => `<div class="box"><div class="n">${String(x[1]).padStart(2, '0')}</div><div class="l">${x[0]}</div></div>`).join('');
  };
  tick(); _cdTimer = setInterval(tick, 1000);
}

/* ================= EDITAR REGISTRO ================= */
async function editarRegistro() {
  const limite = S.cfg.EDICION_LIMITE;
  const lim = limite ? parseFecha_(soloFechaISO_(limite) + ' 23:59:59') : null;
  if (lim && new Date() > lim) return toast('El periodo de edición terminó el ' + soloFechaISO_(limite) + '.', 'info');
  S.editando = true;
  construirFormulario(S.inscrito);
  $('formTitle').textContent = 'Editar registro';
  $('btnVerResumen').textContent = 'Guardar cambios';
  $('btnVerResumen').onclick = guardarEdicion;
  show('form');
}

async function guardarEdicion() {
  const f = await recolectarForm();
  const errs = validarClienteForm(f);
  if (errs.length) return toast('Faltan o son inválidos: ' + errs.join(', '), 'warning');
  try {
    const r = await api('editarInscrito', { inscrito: f });
    S.inscrito = r;
    $('btnVerResumen').textContent = 'Ver resumen'; $('btnVerResumen').onclick = irAResumen;
    toast('Datos actualizados. Dorsal ' + r.CODIGO, 'success');
    entrarInicio();
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= MENCIÓN ================= */
async function generarMencion() {
  if (S.inscrito.ESTADO !== 'FINALIZADO') return toast('Tu mención se genera al finalizar la competencia.', 'info');
  try {
    const r = await api('generarMencion', { documento: S.doc });
    const a = document.createElement('a');
    a.href = 'data:' + r.mime + ';base64,' + r.base64; a.download = r.filename; a.click();
  } catch (e) { toast(e.message, 'error'); }
}

/* ================= COMUNICADOS ================= */
async function abrirComunicados() {
  show('comunicados');
  $('comunicadosList').innerHTML = '<p class="muted">Cargando…</p>';
  try {
    const coms = await api('listarComunicados');
    $('comunicadosList').innerHTML = coms.length ? coms.map(c => `
      <div class="com ${String(c.DESTACADO).toUpperCase() === 'SI' ? 'dest' : ''}">
        <div class="fecha">${fechaLargaEs_(c.FECHA)}</div>
        <h4>${c.TITULO}</h4>
        <div>${(c.CUERPO || '').replace(/\n/g, '<br>')}</div>
        ${c.IMAGEN_URL ? `<img src="${driveImg_(c.IMAGEN_URL)}">` : ''}
      </div>`).join('') : '<p class="muted">Aún no hay comunicados.</p>';
  } catch (e) { $('comunicadosList').innerHTML = '<p class="muted">' + e.message + '</p>'; }
}
