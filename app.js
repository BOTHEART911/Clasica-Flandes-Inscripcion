/* ================= CLÁSICA 2026 — App Participante ================= */
/* Pega aquí la URL /exec de tu Web App de Apps Script tras desplegar. */
const API_BASE = 'https://script.google.com/macros/s/AKfycbxnc3ajRaV6-v9TSfBnVEdYUyWSKcTkbJlHsjpUV6UHJ--I9euyVdRIJrvpStGA-FBR/exec';

/* ---------- estado ---------- */
const S = { boot: null, cfg: {}, cats: [], textos: {}, doc: '', inscrito: null, form: {}, fechaNac: '' };

/* ---------- API (POST text/plain para evitar preflight CORS) ---------- */
async function api(action, payload = {}) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action }, payload))
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error del servidor');
  return json.data;
}

const $ = (id) => document.getElementById(id);
const show = (v) => { document.querySelectorAll('.view').forEach(s => s.classList.remove('active')); $('view-' + v).classList.add('active'); window.scrollTo(0, 0); };
const toast = (t, i = 'info') => Swal.fire({ text: t, icon: i, confirmButtonColor: '#14231c' });
const textoDe = (clave) => (S.textos[clave] || {}).CUERPO || '';

/* ================= ARRANQUE ================= */
(async function init() {
  $('footVersion').textContent = 'v' + (window.APP_VERSION || '1.0.0');
  try {
    S.boot = await api('bootstrap');
    S.cfg = S.boot.config || {};
    S.cats = S.boot.categorias || [];
    (S.boot.textos || []).forEach(t => S.textos[t.CLAVE] = t);
    if (S.cfg.BANNER_APP) $('appBanner').src = S.cfg.BANNER_APP;
    if (S.cfg.ICONO_APP) $('appIcon').src = S.cfg.ICONO_APP;
  } catch (e) {
    toast('No se pudo conectar con el servidor. Revisa API_BASE.', 'error');
  }
  wire();
})();

function wire() {
  $('btnLogin').onclick = doLogin;
  $('loginDoc').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('btnVerResumen').onclick = irAResumen;
  $('btnEditarResumen').onclick = () => show('form');
  $('btnConfirmar').onclick = confirmar;
  $('btnSalir').onclick = () => location.reload();
  $('btnEditarRegistro').onclick = editarRegistro;
  $('btnMencion').onclick = generarMencion;
  $('btnComunicados').onclick = abrirComunicados;
  $('btnVolverInicio').onclick = () => show('inicio');
}

/* ================= LOGIN ================= */
async function doLogin() {
  const doc = ($('loginDoc').value || '').replace(/\D/g, '');
  if (!/^\d{6,10}$/.test(doc)) return toast('El documento debe tener entre 6 y 10 dígitos.', 'warning');
  S.doc = doc;
  Swal.showLoading && Swal.fire({ title: 'Consultando…', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  try {
    const r = await api('loginParticipante', { documento: doc });
    Swal.close();
    if (r.existe) { S.inscrito = r.inscrito; entrarInicio(); }
    else { await flujoInscripcion(); }
  } catch (e) { Swal.close(); toast(e.message, 'error'); }
}

/* ================= 3 MODALES ================= */
async function flujoInscripcion() {
  // Modal 1 — Tratamiento de datos
  const m1 = await Swal.fire({
    title: (S.textos.MODAL_TRATAMIENTO_DATOS || {}).TITULO || 'Tratamiento de datos',
    html: `<p style="text-align:left">${textoDe('MODAL_TRATAMIENTO_DATOS')}</p>`,
    showCancelButton: true, confirmButtonText: 'Acepto', cancelButtonText: 'No acepto',
    confirmButtonColor: '#14231c', cancelButtonColor: '#7c2b2b', allowOutsideClick: false
  });
  if (!m1.isConfirmed) return;
  S.form.ACEPTO_DATOS_TS = new Date().toISOString();

  // Modal 2 — Reglamento (HTML del Doc)
  let htmlRegl = '<p>Cargando reglamento…</p>';
  try { htmlRegl = (await api('docHtmlModal', { plantilla: 'REGLAMENTO' })).html; } catch (e) { htmlRegl = '<p>' + e.message + '</p>'; }
  const m2 = await Swal.fire({
    title: 'Reglamento Oficial',
    html: `<div style="max-height:52vh;overflow:auto;text-align:left;font-size:14px">${htmlRegl}</div>`,
    width: 720, showCancelButton: true, confirmButtonText: 'Continuar con el registro',
    cancelButtonText: 'Salir', confirmButtonColor: '#14231c', allowOutsideClick: false
  });
  if (!m2.isConfirmed) return;
  S.form.ACEPTO_REGLAMENTO_TS = new Date().toISOString();

  // Modal 3 — Consentimiento (HTML del Doc) + 3 checks
  let htmlCons = '<p>Cargando consentimiento…</p>';
  try { htmlCons = (await api('docHtmlModal', { plantilla: 'CONSENTIMIENTO' })).html; } catch (e) { htmlCons = '<p>' + e.message + '</p>'; }
  const checks = `
    <label style="display:flex;gap:8px;text-align:left;margin:8px 0"><input type="checkbox" id="ck1"><span>${textoDe('CHECK_1')}</span></label>
    <label style="display:flex;gap:8px;text-align:left;margin:8px 0"><input type="checkbox" id="ck2"><span>${textoDe('CHECK_2')}</span></label>
    <label style="display:flex;gap:8px;text-align:left;margin:8px 0"><input type="checkbox" id="ck3"><span>${textoDe('CHECK_3')}</span></label>`;
  const m3 = await Swal.fire({
    title: 'Consentimiento Informado',
    html: `<div style="max-height:44vh;overflow:auto;text-align:left;font-size:14px">${htmlCons}</div><hr>${checks}`,
    width: 720, showCancelButton: true, confirmButtonText: 'Completar registro',
    cancelButtonText: 'Salir', confirmButtonColor: '#14231c', allowOutsideClick: false,
    preConfirm: () => {
      if (!$('ck1').checked || !$('ck2').checked || !$('ck3').checked) {
        Swal.showValidationMessage('Debes aceptar los tres recuadros.'); return false;
      }
      return true;
    }
  });
  if (!m3.isConfirmed) return;
  const ts = new Date().toISOString();
  S.form.ACEPTO_CHECK1 = ts; S.form.ACEPTO_CHECK2 = ts; S.form.ACEPTO_CHECK3 = ts; S.form.FIRMA_TS = ts;

  construirFormulario();
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
  const html = `
    <label class="field"><span>Nombres</span><input id="f_NOMBRES" value="${pre.NOMBRES || ''}"></label>
    <label class="field"><span>Apellidos</span><input id="f_APELLIDOS" value="${pre.APELLIDOS || ''}"></label>
    <label class="field"><span>Género</span><select id="f_GENERO"><option value="">—</option>${opciones([{ value: 'Masculino', label: 'Masculino' }, { value: 'Femenino', label: 'Femenino' }], g)}</select></label>
    <label class="field"><span>RH</span><select id="f_RH"><option value="">—</option>${opciones(rhOpts, pre.RH)}</select></label>
    <label class="field"><span>Celular (10 dígitos)</span><input id="f_CELULAR" inputmode="numeric" maxlength="10" value="${pre.CELULAR || ''}"></label>
    <label class="field"><span>EPS</span><select id="f_EPS"><option value="">—</option>${opciones(S.boot.eps || [], pre.EPS)}</select></label>
    <label class="field full"><span>Correo</span><input id="f_CORREO" type="email" value="${pre.CORREO || ''}"></label>
    <label class="field"><span>Departamento</span><select id="f_DEPARTAMENTO"><option value="">—</option>${opciones(deptos, pre.DEPARTAMENTO)}</select></label>
    <label class="field"><span>Municipio</span><select id="f_MUNICIPIO"><option value="">—</option></select></label>
    <label class="field"><span>Contacto de emergencia</span><input id="f_CONTACTO_EMERGENCIA" value="${pre.CONTACTO_EMERGENCIA || ''}"></label>
    <label class="field"><span>Tel. emergencia (10 dígitos)</span><input id="f_TEL_EMERGENCIA" inputmode="numeric" maxlength="10" value="${pre.TEL_EMERGENCIA || ''}"></label>
    <label class="field full"><span>Categoría</span><select id="f_CATEGORIA"><option value="">Selecciona tu género primero</option></select></label>
    <div id="catInfo" class="datos-grid full" style="margin:6px 0"></div>
    <div class="field full"><span>Fecha de nacimiento</span><button id="btnFecha" class="ghost" style="border-color:#b08d3f;color:#14231c">${pre.FECHA_NACIMIENTO || 'Seleccionar fecha'}</button></div>
    <div id="autorizacionSlot" class="field full hidden"><span>Autorización del acudiente (PDF/imagen) — obligatoria para menores</span><input id="f_AUTORIZACION" type="file" accept="application/pdf,image/*"></div>
    <label class="field full"><span>Foto de perfil (opcional)</span><input id="f_FOTO" type="file" accept="image/*"></label>
  `;
  $('formFields').innerHTML = html;
  if (pre.FECHA_NACIMIENTO) S.fechaNac = pre.FECHA_NACIMIENTO;

  $('f_GENERO').onchange = refrescarCategorias;
  $('f_DEPARTAMENTO').onchange = refrescarMunicipios;
  $('f_CATEGORIA').onchange = mostrarInfoCategoria;
  $('btnFecha').onclick = abrirRuedaFecha;
  if (g) refrescarCategorias();
  if (pre.DEPARTAMENTO) refrescarMunicipios(pre.MUNICIPIO);
  if (pre.CATEGORIA) { $('f_CATEGORIA').value = pre.CATEGORIA; mostrarInfoCategoria(); }
}

function refrescarCategorias() {
  const g = $('f_GENERO').value.charAt(0).toUpperCase();
  const permit = S.cats.filter(c => (g === 'F') ? (c.PREFIJO === 'DM' || c.PREFIJO === 'BF') : (g === 'M') ? (c.PREFIJO !== 'DM' && c.PREFIJO !== 'BF') : false);
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
  const menor = (pref === 'PJ' || pref === 'JU');
  $('autorizacionSlot').classList.toggle('hidden', !menor);
  if (!c) { $('catInfo').innerHTML = ''; return; }
  $('catInfo').innerHTML = `
    <div class="item"><div class="k">Vueltas</div><div class="v">${c.VUELTAS}</div></div>
    <div class="item"><div class="k">Distancia</div><div class="v">${c.KM} km</div></div>
    <div class="item"><div class="k">1° / 2° / 3°</div><div class="v" style="font-size:14px">$${(+c.PREMIO_1).toLocaleString('es-CO')} · $${(+c.PREMIO_2).toLocaleString('es-CO')} · $${(+c.PREMIO_3).toLocaleString('es-CO')}</div></div>
    <div class="item" style="display:flex;align-items:center;gap:8px"><img src="${c.ICONO_URL}" style="height:40px"><div class="v" style="font-size:14px">${c.NOMBRE}</div></div>`;
}

/* ---------- rueda iOS de fecha ---------- */
function abrirRuedaFecha() {
  const pref = $('f_CATEGORIA').value;
  const c = S.cats.find(x => x.PREFIJO === pref);
  const yMax = c ? +c.ANIO_MAX : 2012, yMin = c ? +c.ANIO_MIN : 1936;
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const anios = []; for (let y = yMax; y >= yMin; y--) anios.push(y);
  const wheel = (arr, id) => `<div><div class="wheel-lbl">${id}</div><div class="wheel" id="w_${id}">${arr.map(v => `<div class="opt" data-v="${v}">${v}</div>`).join('')}</div></div>`;
  Swal.fire({
    title: 'Fecha de nacimiento',
    html: `<div class="wheel-wrap">${wheel(dias, 'Día')}${wheel(meses, 'Mes')}${wheel(anios, 'Año')}</div>`,
    confirmButtonText: 'Listo', confirmButtonColor: '#14231c',
    didOpen: () => { ['Día', 'Mes', 'Año'].forEach(id => setupWheel($('w_' + id))); },
    preConfirm: () => {
      const d = selWheel($('w_Día')), mTxt = selWheel($('w_Mes')), y = selWheel($('w_Año'));
      const mi = meses.indexOf(mTxt) + 1;
      if (!d || !mi || !y) { Swal.showValidationMessage('Selecciona día, mes y año.'); return false; }
      const iso = `${y}-${String(mi).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      S.fechaNac = iso; $('btnFecha').textContent = iso; return iso;
    }
  });
}
function setupWheel(el) {
  const opts = el.querySelectorAll('.opt');
  const mark = () => {
    const mid = el.scrollTop + el.clientHeight / 2;
    let best, bd = 1e9;
    opts.forEach(o => { const c = o.offsetTop + o.offsetHeight / 2; const dd = Math.abs(c - mid); if (dd < bd) { bd = dd; best = o; } });
    opts.forEach(o => o.classList.remove('sel')); if (best) best.classList.add('sel');
  };
  el.addEventListener('scroll', () => { clearTimeout(el._t); el._t = setTimeout(mark, 60); });
  mark();
}
function selWheel(el) { const s = el.querySelector('.opt.sel'); return s ? s.dataset.v : ''; }

/* ---------- ir a resumen ---------- */
function fileToB64(input) {
  return new Promise(res => {
    const f = input.files[0]; if (!f) return res(null);
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
  const menor = (f.CATEGORIA === 'PJ' || f.CATEGORIA === 'JU');
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
  if ((f.CATEGORIA === 'PJ' || f.CATEGORIA === 'JU') && !f.AUTORIZACION_B64) e.push('Autorización del acudiente');
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
    ['Nacimiento', f.FECHA_NACIMIENTO]
  ];
  $('resumenBox').innerHTML = filas.map(r => `<div><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('');
  show('resumen');
}

async function confirmar() {
  Swal.fire({ title: 'Registrando…', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  try {
    const r = await api('crearInscrito', { inscrito: S.form });
    S.inscrito = r;
    Swal.close();
    await Swal.fire({ title: '¡Inscripción confirmada!', html: `Tu dorsal es <b>${r.CODIGO}</b>.<br>Revisa tu correo.`, icon: 'success', confirmButtonColor: '#14231c' });
    entrarInicio();
  } catch (e) { Swal.close(); toast(e.message, 'error'); }
}

/* ================= INICIO (sesión) ================= */
function entrarInicio() {
  $('btnSalir').classList.remove('hidden');
  const r = S.inscrito;
  $('inicioIcono').src = r.ICONO_CATEGORIA || S.cfg.ICONO_USUARIO_DEFAULT;
  $('inicioFoto').src = r.FOTO || S.cfg.ICONO_USUARIO_DEFAULT;
  $('inicioNombre').textContent = (r.NOMBRES + ' ' + r.APELLIDOS).trim();
  $('inicioEstado').textContent = r.ESTADO;
  $('inicioDatos').innerHTML = [
    ['Dorsal', r.CODIGO], ['Categoría', r.CAT_NOMBRE || r.CATEGORIA], ['Vueltas', r.VUELTAS],
    ['Distancia', (r.KM || '') + ' km'], ['RH', r.RH_CORTO], ['1° premio', '$' + (+r.PREMIO_1 || 0).toLocaleString('es-CO')]
  ].map(x => `<div class="item"><div class="k">${x[0]}</div><div class="v">${x[1]}</div></div>`).join('');
  iniciarContador();
  show('inicio');
}

let _cdTimer = null;
function iniciarContador() {
  clearInterval(_cdTimer);
  const iso = S.cfg.EVENTO_FECHA_ISO;
  const target = iso ? new Date(iso).getTime() : 0;
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000),
      m = Math.floor(diff % 3600000 / 60000), s = Math.floor(diff % 60000 / 1000);
    $('countdown').innerHTML = [['Días', d], ['Horas', h], ['Min', m], ['Seg', s]]
      .map(x => `<div class="box"><div class="n">${String(x[1]).padStart(2, '0')}</div><div class="l">${x[0]}</div></div>`).join('');
  };
  tick(); _cdTimer = setInterval(tick, 1000);
}

async function editarRegistro() {
  const limite = S.cfg.EDICION_LIMITE;
  if (limite && new Date() > new Date(limite + 'T23:59:59')) return toast('El periodo de edición terminó el ' + limite + '.', 'info');
  construirFormulario(S.inscrito);
  $('btnVerResumen').textContent = 'Guardar cambios';
  $('btnVerResumen').onclick = guardarEdicion;
  show('form');
}

async function guardarEdicion() {
  const f = await recolectarForm();
  const errs = validarClienteForm(f);
  if (errs.length) return toast('Faltan o son inválidos: ' + errs.join(', '), 'warning');
  Swal.fire({ title: 'Guardando…', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  try {
    const r = await api('editarInscrito', { inscrito: f });
    S.inscrito = r; Swal.close();
    $('btnVerResumen').textContent = 'Ver resumen'; $('btnVerResumen').onclick = irAResumen;
    toast('Datos actualizados. Dorsal ' + r.CODIGO, 'success');
    entrarInicio();
  } catch (e) { Swal.close(); toast(e.message, 'error'); }
}

async function generarMencion() {
  if (S.inscrito.ESTADO !== 'FINALIZADO') return toast('Tu mención se genera al finalizar la competencia.', 'info');
  Swal.fire({ title: 'Generando mención…', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
  try {
    const r = await api('generarMencion', { documento: S.doc });
    Swal.close();
    const a = document.createElement('a');
    a.href = 'data:' + r.mime + ';base64,' + r.base64; a.download = r.filename; a.click();
  } catch (e) { Swal.close(); toast(e.message, 'error'); }
}

async function abrirComunicados() {
  show('comunicados');
  $('comunicadosList').innerHTML = '<p class="muted">Cargando…</p>';
  try {
    const coms = await api('listarComunicados');
    $('comunicadosList').innerHTML = coms.length ? coms.map(c => `
      <div class="com ${String(c.DESTACADO).toUpperCase() === 'SI' ? 'dest' : ''}">
        <div class="fecha">${String(c.FECHA).replace('T', ' ').slice(0, 16)}</div>
        <h4>${c.TITULO}</h4>
        <div>${(c.CUERPO || '').replace(/\n/g, '<br>')}</div>
        ${c.IMAGEN_URL ? `<img src="${c.IMAGEN_URL}">` : ''}
      </div>`).join('') : '<p class="muted">Aún no hay comunicados.</p>';
  } catch (e) { $('comunicadosList').innerHTML = '<p class="muted">' + e.message + '</p>'; }
}
