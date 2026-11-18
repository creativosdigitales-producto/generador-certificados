/* ================================================================
   Generador de Certificados — app.js
   ================================================================
   Lógica de la app. Para ajustar posiciones, tamaños, colores o el
   código de acceso NO hace falta tocar este archivo: todo está en
   js/config.js.

   Cómo se arma cada certificado:
   1. Se calcula dónde y con qué tamaño va cada texto (una sola
      función, `armarTextos`, compartida por la vista previa y el PDF).
   2. Vista previa → se dibuja en un <canvas>.
   3. PDF → se inserta la plantilla PNG original (sin recomprimir,
      una sola vez aunque haya 30 páginas) y se escribe el texto
      como texto real con la fuente Montserrat incrustada.
      Resultado: calidad máxima y archivos livianos.
   ================================================================ */

(() => {
'use strict';

/* ── Constantes derivadas de la configuración ── */
const W = CONFIG.imagen.ancho;
const H = CONFIG.imagen.alto;
const PT = CONFIG.pxPorPunto;                 // px por punto de Canva
const FAMILIA = {                             // nombres internos de las fuentes
  extraNegrita: 'CertMontserratExtraBold',
  normal:       'CertMontserratRegular',
};
const PAGINA_PDF = { ancho: 841.89, alto: 841.89 * H / W };   // A4 apaisado, en puntos
const ESCALA_PDF = PAGINA_PDF.ancho / W;                      // px de plantilla → pt de PDF
const SESION_CODIGO = 'certificados.codigo';   // código recordado durante la sesión del navegador

/* ── Estado ── */
const estado = {
  destinatario: 'alumnos',   // 'alumnos' | 'docentes'
  origen:       'planilla',  // 'planilla' | 'manual'  (docentes: siempre manual)
  area:         'programacion',
  catalogo:     null,
  filas:        null,        // alumnos leídos de la planilla
  grupos:       [],          // [{ clave, etiqueta, corto, cantidad }]
  nombreArchivoPlanilla: '',
  ocupado:      false,
};

/* ── DOM ── */
const $ = id => document.getElementById(id);
const el = {
  segDestinatario: $('seg-destinatario'),
  segOrigen:       $('seg-origen'),
  segArea:         $('seg-area'),
  tituloNombres:   $('titulo-nombres'),

  zonaPlanilla:    $('zona-planilla'),
  planillaCarga:   $('planilla-carga'),
  btnModoEnlace:   $('btn-modo-enlace'),
  dropZone:        $('drop-zone'),
  fileInput:       $('file-input'),
  zoneLink:        $('zone-link'),
  inputLink:       $('input-link'),
  btnLoadLink:     $('btn-load-link'),
  badge:           $('source-loaded-badge'),
  badgeNombre:     $('source-loaded-name'),
  btnClear:        $('btn-clear-source'),
  campoGrupo:      $('campo-grupo'),
  selectGrupo:     $('select-grupo'),

  zonaManual:      $('zona-manual'),
  inputNombres:    $('input-nombres'),
  contNombres:     $('contador-nombres'),

  selectCurso:     $('select-curso'),
  zonaEspecial:    $('zona-especial'),
  campoTitulo:     $('campo-titulo'),
  inputTitulo:     $('input-titulo'),
  inputDesc:       $('input-descripcion'),
  contTitulo:      $('contador-titulo'),
  contDesc:        $('contador-descripcion'),

  inputAnio:       $('input-anio'),

  previewFrame:    $('preview-frame'),
  previewCanvas:   $('preview-canvas'),
  previewMeta:     $('preview-meta'),
  previewEmpty:    $('preview-empty'),

  inputCodigo:     $('input-codigo'),
  btnGenerar:      $('btn-generate'),
  btnTexto:        $('btn-text'),
  btnCount:        $('btn-count'),
  spinner:         $('spinner'),
  privacy:         $('privacy-badge'),
  mensaje:         $('message-box'),
  progreso:        $('progress-section'),
  progresoBarra:   $('progress-bar'),
  progresoTexto:   $('progress-text'),
  progresoLabel:   $('progress-label-text'),
  btnTutorial:     $('btn-tutorial'),
};

/* ================================================================
   Inicio (se llama al final del archivo)
   ================================================================ */
async function init() {
  // Límites de caracteres
  el.inputTitulo.maxLength  = CONFIG.limites.titulo;
  el.inputDesc.maxLength    = CONFIG.limites.descripcion;
  el.inputNombres.maxLength = (CONFIG.limites.nombre + 1) * 60;
  actualizarContadores();
  actualizarContadorNombres();

  // Íconos (Lucide)
  if (window.lucide) lucide.createIcons();

  // Fecha de hoy por defecto
  // Año de emisión: el actual y algunos anteriores
  const anioActual = new Date().getFullYear();
  for (let a = anioActual; a >= anioActual - CONFIG.fecha.aniosAnteriores; a--) {
    agregarOpcion(el.inputAnio, String(a), String(a), { selected: a === anioActual });
  }

  // Guía "¿Cómo usar?"
  if (CONFIG.guiaUrl) {
    el.btnTutorial.href = CONFIG.guiaUrl;
    el.btnTutorial.hidden = false;
  }

  // Código de acceso
  // Código de acceso: siempre visible; si ya se validó en esta sesión, aparece completado
  el.inputCodigo.hidden = !CONFIG.codigoAcceso.activo;
  try {
    const guardado = sessionStorage.getItem(SESION_CODIGO);
    if (guardado) { el.inputCodigo.value = guardado; el.inputCodigo.classList.add('ok'); }
  } catch { /* sin almacenamiento */ }

  conectarEventos();
  aplicarVisibilidad();

  // Fuentes (para la vista previa) y catálogo de cursos
  cargarFuentesNavegador().then(programarPreview).catch(err => console.error(err));

  try {
    const res = await fetch(CONFIG.catalogo, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    estado.catalogo = await res.json();
  } catch (err) {
    console.error(err);
    mostrarMensaje(
      'No se pudo cargar la lista de cursos (certificados/catalogo.json).\n' +
      'Si estás probando en tu PC, abre la app con "node tools/servidor.js" en lugar de hacer doble clic en index.html.',
      'error'
    );
  }
  poblarCursos();
}

/* ================================================================
   Eventos
   ================================================================ */
let segArea = null;   // control de áreas (se ajusta al cambiar de destinatario)

function conectarEventos() {
  segmentado(el.segDestinatario, v => {
    estado.destinatario = v;
    ajustarAreas();
    aplicarVisibilidad();
    poblarCursos();
  });

  segmentado(el.segOrigen, v => {
    estado.origen = v;
    aplicarVisibilidad();
  });

  segArea = segmentado(el.segArea, v => {
    estado.area = v;
    poblarCursos();
  });
  ajustarAreas();

  // Planilla: alternar entre subir archivo y pegar enlace de Google Sheets
  el.btnModoEnlace.addEventListener('click', () => {
    cambiarModoPlanilla(el.zoneLink.hidden ? 'enlace' : 'archivo');
  });

  // Drag & drop
  el.dropZone.addEventListener('dragover', e => { e.preventDefault(); el.dropZone.classList.add('drag-over'); });
  el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('drag-over'));
  el.dropZone.addEventListener('drop', e => {
    e.preventDefault();
    el.dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) cargarArchivoLocal(f);
  });
  el.fileInput.addEventListener('change', () => {
    if (el.fileInput.files[0]) cargarArchivoLocal(el.fileInput.files[0]);
  });

  el.btnLoadLink.addEventListener('click', cargarDesdeEnlace);
  el.inputLink.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); cargarDesdeEnlace(); }
  });
  el.btnClear.addEventListener('click', limpiarPlanilla);
  el.selectGrupo.addEventListener('change', alCambiarDatos);

  // Nombres manuales, curso, especial, fecha
  el.inputNombres.addEventListener('input', () => { limitarLineasNombres(); alCambiarDatos(); });
  el.inputNombres.addEventListener('keyup', actualizarContadorNombres);
  el.inputNombres.addEventListener('click', actualizarContadorNombres);
  el.selectCurso.addEventListener('change', () => {
    const c = certificadoElegido();
    el.selectCurso.dataset.nombre = c && !c.especial ? c.nombre : '';
    aplicarVisibilidad();
    alCambiarDatos();
  });
  el.inputTitulo.addEventListener('input', () => { actualizarContadores(); alCambiarDatos(); });
  el.inputDesc.addEventListener('input',   () => { actualizarContadores(); alCambiarDatos(); });
  el.inputAnio.addEventListener('change',  alCambiarDatos);

  // Código
  el.inputCodigo.addEventListener('input', () => el.inputCodigo.classList.remove('error', 'ok'));
  el.inputCodigo.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); generar(); }
  });

  el.btnGenerar.addEventListener('click', generar);
}

/**
 * Conecta un control segmentado (uno activo a la vez).
 * La "pastilla" de color se desliza hasta la opción elegida
 * mediante la variable CSS --i (índice de la opción activa)
 * y --n (cantidad de opciones visibles).
 *
 * Devuelve { refrescar, marcar } para cuando se ocultan opciones
 * desde afuera (ej. "Cápsulas", que es solo para alumnos).
 */
function segmentado(contenedor, alCambiar) {
  const botones = [...contenedor.querySelectorAll('.seg-btn')];
  const visibles = () => botones.filter(b => !b.hidden);

  const refrescar = () => {
    const vis = visibles();
    const i = Math.max(0, vis.findIndex(b => b.classList.contains('active')));
    contenedor.style.setProperty('--i', i);
    contenedor.style.setProperty('--n', vis.length);
  };

  /** Marca una opción como activa (sin avisar el cambio). */
  const marcar = valor => {
    botones.forEach(x => {
      const activo = x.dataset.value === valor;
      x.classList.toggle('active', activo);
      x.setAttribute('aria-checked', String(activo));
    });
    refrescar();
  };
  refrescar();

  botones.forEach(b => b.addEventListener('click', () => {
    if (b.classList.contains('active')) return;
    marcar(b.dataset.value);
    ocultarMensaje();
    alCambiar(b.dataset.value);
  }));

  // Flechas izquierda/derecha para moverse con el teclado
  contenedor.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const vis = visibles();
    const i = vis.findIndex(b => b.classList.contains('active'));
    const sig = vis[(i + (e.key === 'ArrowRight' ? 1 : -1) + vis.length) % vis.length];
    e.preventDefault();
    sig.focus();
    sig.click();
  });

  return { refrescar, marcar };
}

/**
 * Muestra solo las áreas que corresponden al destinatario
 * (botones con data-solo="alumnos"). Si el área elegida queda
 * oculta, se vuelve a Programación.
 */
function ajustarAreas() {
  let elegidaOculta = false;
  el.segArea.querySelectorAll('.seg-btn[data-solo]').forEach(b => {
    b.hidden = b.dataset.solo !== estado.destinatario;
    if (b.hidden && b.dataset.value === estado.area) elegidaOculta = true;
  });
  if (elegidaOculta) {
    estado.area = 'programacion';
    segArea.marcar(estado.area);
  } else {
    segArea.refrescar();
  }
}

function alCambiarDatos() {
  ocultarMensaje();
  el.progreso.classList.remove('visible', 'completed');
  actualizarBoton();
  programarPreview();
}

/* ================================================================
   Visibilidad de secciones
   ================================================================ */
function aplicarVisibilidad() {
  const esDocente = estado.destinatario === 'docentes';
  const usaPlanilla = !esDocente && estado.origen === 'planilla';
  const especial = el.selectCurso.value === 'especial';

  el.segOrigen.hidden    = esDocente;
  el.zonaPlanilla.hidden = !usaPlanilla;
  el.zonaManual.hidden   = usaPlanilla;
  el.tituloNombres.textContent = esDocente ? 'Nombre del docente' : 'Nombres';
  el.inputNombres.placeholder  = esDocente ? 'Ej: Claudia Mercedes Torti' : 'Ej: Gianella Paz Aguirre';

  el.zonaEspecial.hidden = !especial;
  el.campoTitulo.hidden  = esDocente;   // los docentes no llevan título

  actualizarBoton();
  programarPreview();
}

/* ================================================================
   Cursos
   ================================================================ */
function poblarCursos() {
  const anterior = el.selectCurso.value;
  const lista = cursosActuales();

  el.selectCurso.innerHTML = '';
  agregarOpcion(el.selectCurso, '', 'Elige un curso…', { disabled: true, selected: true });

  lista.forEach((c, i) => agregarOpcion(el.selectCurso, String(i), c.nombre));

  agregarOpcion(el.selectCurso, '', '──────────', { disabled: true });
  agregarOpcion(
    el.selectCurso, 'especial',
    estado.destinatario === 'alumnos' ? 'Especial — título y descripción a medida' : 'Especial — descripción a medida'
  );

  // Conservar la selección si el mismo curso existe en la nueva lista
  // (ej. "Coder 1" al pasar de Alumnos a Docentes)
  const nombreAnterior = el.selectCurso.dataset.nombre || '';
  if (anterior === 'especial') {
    el.selectCurso.value = 'especial';
  } else if (nombreAnterior) {
    const idx = lista.findIndex(c => c.nombre === nombreAnterior);
    if (idx >= 0) el.selectCurso.value = String(idx);
  }

  aplicarVisibilidad();
}

function cursosActuales() {
  if (!estado.catalogo) return [];
  return (estado.catalogo[estado.destinatario] || {})[estado.area] || [];
}

/** Devuelve { nombre, archivo, especial } del certificado elegido, o null. */
function certificadoElegido() {
  const v = el.selectCurso.value;
  if (v === 'especial') {
    return {
      especial: true,
      nombre:   'Especial',
      archivo:  CONFIG.especiales[estado.destinatario][estado.area],
    };
  }
  if (v === '') return null;
  const c = cursosActuales()[Number(v)];
  return c ? { especial: false, nombre: c.nombre, archivo: c.archivo } : null;
}


/* ================================================================
   Nombres
   ================================================================ */
/** Lista final de nombres a imprimir, ya corregidos. */
function obtenerNombres() {
  const usaPlanilla = estado.destinatario === 'alumnos' && estado.origen === 'planilla';

  if (usaPlanilla) {
    if (!estado.filas) return [];
    const grupo = el.selectGrupo.value;
    return estado.filas
      .filter(f => f.grupo === grupo)
      .map(f => corregirMayusculas(`${f.nombre} ${f.apellido}`));
  }

  return el.inputNombres.value
    .split(/\r?\n/)
    .map(n => corregirMayusculas(n))
    .filter(Boolean);
}

/**
 * Corrige solo las palabras escritas TODO en mayúsculas o TODO en minúsculas:
 *   "GIANELLA paz"        → "Gianella Paz"
 *   "maría DEL luján"     → "María del Luján"
 *   "McDonald"            → se respeta tal cual
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'van', 'von']);
function corregirMayusculas(texto) {
  const palabras = String(texto || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return palabras.map((p, i) => {
    const mayus = p.toLocaleUpperCase('es');
    const minus = p.toLocaleLowerCase('es');
    if (p !== mayus && p !== minus) return p;            // mezcla: se respeta
    if (i > 0 && PARTICULAS.has(minus)) return minus;    // "de", "del"...
    return minus.replace(/(^|[-'’])(\p{L})/gu, (_, sep, letra) => sep + letra.toLocaleUpperCase('es'));
  }).join(' ');
}

/* ================================================================
   Planilla del colegio
   ================================================================ */
/** 'archivo' → zona para arrastrar el .xlsx · 'enlace' → campo para pegar el link de Google Sheets */
function cambiarModoPlanilla(modo) {
  const enlace = modo === 'enlace';
  el.dropZone.hidden = enlace;
  el.zoneLink.hidden = !enlace;
  el.btnModoEnlace.querySelector('span').textContent = enlace
    ? 'Prefiero subir el archivo'
    : '¿Está en Google Sheets? Pegar enlace';
  refrescarIcono(el.btnModoEnlace, enlace ? 'upload' : 'link');
  if (enlace) el.inputLink.focus();
  ocultarMensaje();
}

/** Cambia el ícono Lucide dentro de un elemento. */
function refrescarIcono(contenedor, nombre) {
  if (!window.lucide) return;
  const viejo = contenedor.querySelector('svg.lucide, i[data-lucide]');
  if (!viejo) return;
  const nuevo = document.createElement('i');
  nuevo.setAttribute('data-lucide', nombre);
  nuevo.className = 'ico';
  viejo.replaceWith(nuevo);
  lucide.createIcons();   // solo reemplaza los <i data-lucide> pendientes
}

async function cargarArchivoLocal(f) {
  if (!/\.xlsx$/i.test(f.name)) {
    mostrarMensaje('Solo se admiten archivos .xlsx exportados desde Excel o Google Sheets.', 'error');
    el.fileInput.value = '';
    return;
  }
  await procesarPlanilla(async () => {
    const buffer = await f.arrayBuffer();
    return { datos: new Uint8Array(buffer), nombre: f.name };
  });
}

async function cargarDesdeEnlace() {
  const url = el.inputLink.value.trim();
  if (!url) return;
  await procesarPlanilla(async () => {
    const datos = await descargarGoogleSheet(url);
    return { datos, nombre: 'Planilla de Google Sheets' };
  });
}

async function procesarPlanilla(obtener) {
  ocultarMensaje();
  setOcupado(true, 'Leyendo planilla…');
  try {
    const { datos, nombre } = await obtener();
    const { filas, hoja } = leerPlanilla(datos);
    const grupos = armarGrupos(filas);
    if (!grupos.length) throw new Error(`La pestaña "${hoja}" no tiene alumnos con grupo asignado.`);

    estado.filas = filas;
    estado.grupos = grupos;
    estado.nombreArchivoPlanilla = nombre;

    // Selector de grupos
    el.selectGrupo.innerHTML = '';
    agregarOpcion(el.selectGrupo, '', 'Elige un grupo…', { disabled: true, selected: true });
    grupos.forEach(g => agregarOpcion(el.selectGrupo, g.clave, `${g.etiqueta}  ·  ${g.cantidad} alumno${g.cantidad === 1 ? '' : 's'}`));

    el.badgeNombre.textContent = `${nombre} — ${filas.length} alumnos`;
    el.badge.hidden = false;
    el.planillaCarga.hidden = true;
    el.campoGrupo.hidden = false;
    alCambiarDatos();
  } catch (err) {
    console.error(err);
    mostrarMensaje(err.message, 'error');
    el.fileInput.value = '';
  }
  setOcupado(false);
}

function limpiarPlanilla() {
  estado.filas = null;
  estado.grupos = [];
  estado.nombreArchivoPlanilla = '';
  el.fileInput.value = '';
  el.inputLink.value = '';
  el.badge.hidden = true;
  el.planillaCarga.hidden = false;
  el.campoGrupo.hidden = true;
  el.selectGrupo.innerHTML = '';
  alCambiarDatos();
}

/** Lee el .xlsx y devuelve los alumnos de la pestaña "Listado Alumnos…". */
function leerPlanilla(datos) {
  const libro = XLSX.read(datos, { type: 'array' });
  const prefijo = CONFIG.planilla.hoja.trim().toLowerCase();
  const infoHojas = (libro.Workbook && libro.Workbook.Sheets) || [];

  const candidatas = libro.SheetNames
    .map((n, i) => ({ nombre: n, visible: !(infoHojas[i] && infoHojas[i].Hidden) }))
    .filter(h => h.nombre.trim().toLowerCase().startsWith(prefijo));

  let hoja;
  if (libro.SheetNames.length === 1) hoja = libro.SheetNames[0];
  else hoja = (candidatas.find(h => h.visible) || candidatas[0] || {}).nombre;

  if (!hoja) {
    throw new Error(
      `No se encontró ninguna pestaña que empiece con "${CONFIG.planilla.hoja}".\n` +
      'Verifica que la pestaña del listado de alumnos tenga ese nombre.'
    );
  }

  const crudas = XLSX.utils.sheet_to_json(libro.Sheets[hoja], { defval: '' });
  const col = CONFIG.planilla.columnas;
  const filas = [];
  let columnasOk = false;

  for (const r of crudas) {
    const n = {};
    for (const k of Object.keys(r)) n[k.trim().toLowerCase()] = r[k];
    if (col.nombre in n && col.grupo in n) columnasOk = true;

    const fila = {
      nombre:   limpiar(n[col.nombre]),
      apellido: limpiar(n[col.apellido]),
      grupo:    limpiar(n[col.grupo]),
    };
    // Se ignoran las filas sin grupo (ej. usuarios "Genérico") o sin nombre
    if (fila.grupo && (fila.nombre || fila.apellido)) filas.push(fila);
  }

  if (!columnasOk) {
    throw new Error(
      `La pestaña "${hoja}" no tiene las columnas esperadas: ${Object.values(col).join(', ')}.`
    );
  }
  return { filas, hoja };
}

/**
 * Agrupa por la columna "Grupo", respetando el orden de la planilla.
 * "C.E. José Manuel Estrada - Primario - 4°A - 2026" → "4°A · Primario"
 */
function armarGrupos(filas) {
  const mapa = new Map();
  for (const f of filas) {
    if (!mapa.has(f.grupo)) {
      const partes = f.grupo.split(/\s+-\s+/);
      let etiqueta = f.grupo, corto = f.grupo;
      if (partes.length >= 4) {
        const nivel = partes[partes.length - 3];
        corto = partes[partes.length - 2];
        etiqueta = `${corto} · ${nivel}`;
      }
      mapa.set(f.grupo, { clave: f.grupo, etiqueta, corto, cantidad: 0 });
    }
    mapa.get(f.grupo).cantidad++;
  }
  return [...mapa.values()];
}

async function descargarGoogleSheet(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error('El enlace de Google Sheets no es válido.');

  const exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
  const msgPrivada = 'No se pudo acceder a la planilla porque su acceso está restringido. ' +
    'En Google Sheets ve a "Compartir" → "Acceso general" y elige "Cualquier persona con el enlace" (Lector). Luego vuelve a cargar el enlace.';

  let res;
  try {
    res = await fetch(exportUrl);
  } catch {
    if (!navigator.onLine) throw new Error('Sin conexión a internet. Revisa tu conexión e inténtalo de nuevo.');
    throw new Error(msgPrivada);
  }
  if (!res.ok) {
    throw new Error(res.status === 404
      ? 'No se encontró esa planilla. Revisa que el enlace esté completo y correcto.'
      : msgPrivada);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/* ================================================================
   Armado de textos (compartido por vista previa y PDF)
   ================================================================ */
let ctxMedicion = null;
function contextoMedicion() {
  if (!ctxMedicion) {
    ctxMedicion = document.createElement('canvas').getContext('2d');
    prepararContexto(ctxMedicion);
  }
  return ctxMedicion;
}

function prepararContexto(ctx) {
  ctx.textBaseline = 'alphabetic';
  // El PDF no aplica kerning: lo desactivamos también aquí para que
  // la vista previa y el PDF midan exactamente igual.
  if ('fontKerning' in ctx) ctx.fontKerning = 'none';
}

function fuenteCanvas(peso, px) {
  return `${px}px "${FAMILIA[peso]}"`;
}

function medir(texto, peso, px) {
  const ctx = contextoMedicion();
  ctx.font = fuenteCanvas(peso, px);
  return ctx.measureText(texto).width;
}

/**
 * Achica la letra (de a 0.25 pt) hasta que el texto entre en anchoMax.
 * Si ni con tamMin entra, se achica lo justo para que entre igual:
 * el texto NUNCA se sale del ancho permitido.
 */
function ajustarUnaLinea(texto, peso, campo) {
  let pt = campo.tamMax;
  while (pt > campo.tamMin && medir(texto, peso, pt * PT) > campo.anchoMax) pt -= 0.25;
  const px = pt * PT;
  const ancho = medir(texto, peso, px);
  return ancho > campo.anchoMax ? px * campo.anchoMax / ancho : px;
}

function partirEnLineas(texto, peso, px, anchoMax) {
  const lineas = [];
  for (const parrafo of texto.split(/\r?\n/)) {
    let actual = '';
    for (const palabra of trocearPalabra(parrafo.split(/\s+/).filter(Boolean), peso, px, anchoMax)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (actual && medir(prueba, peso, px) > anchoMax) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    if (actual) lineas.push(actual);
  }
  return lineas;
}

/** Corta en pedazos las palabras que por sí solas no entran en una línea (ej. "bbbbbbbb…" sin espacios). */
function trocearPalabra(palabras, peso, px, anchoMax) {
  const out = [];
  for (const p of palabras) {
    if (medir(p, peso, px) <= anchoMax) { out.push(p); continue; }
    let trozo = '';
    for (const letra of p) {
      if (trozo && medir(trozo + letra, peso, px) > anchoMax) { out.push(trozo); trozo = ''; }
      trozo += letra;
    }
    if (trozo) out.push(trozo);
  }
  return out;
}

/**
 * Devuelve la lista de textos a dibujar:
 * [{ texto, x, y, px, peso, color, align }]
 */
function armarTextos({ destinatario, area, especial, nombre, titulo, descripcion, fecha, borrador }) {
  // Las cápsulas tienen su propia plantilla, con los campos en otro lugar
  const campos = CONFIG.campos[area === 'capsulas' ? 'capsulas' : destinatario];
  const color  = CONFIG.colores.texto[destinatario][area];
  const out = [];

  // Nombre
  if (nombre) {
    const c = campos.nombre;
    out.push({ texto: nombre, x: c.x, y: c.y, align: c.align, peso: 'extraNegrita', color,
               px: ajustarUnaLinea(nombre, 'extraNegrita', c), borrador });
  }

  // Título (solo especiales de alumnos)
  if (especial && titulo && campos.titulo) {
    const c = campos.titulo;
    const t = CONFIG.tituloEnMayusculas ? titulo.toLocaleUpperCase('es') : titulo;
    out.push({ texto: t, x: c.x, y: c.y, align: c.align, peso: 'extraNegrita',
               color: CONFIG.colores.tituloEspecial[area], px: ajustarUnaLinea(t, 'extraNegrita', c) });
  }

  // Descripción (solo especiales)
  if (especial && descripcion && campos.descripcion) {
    const c = campos.descripcion;
    let pt = c.tam;
    let lineas = partirEnLineas(descripcion, 'normal', pt * PT, c.anchoMax);
    while (lineas.length > c.lineasMax && pt - 0.25 >= c.tamMin) {
      pt -= 0.25;
      lineas = partirEnLineas(descripcion, 'normal', pt * PT, c.anchoMax);
    }
    const px = pt * PT;
    const interlineado = c.interlineado * (pt / c.tam);
    lineas.forEach((l, i) => out.push({
      texto: l, x: c.x, y: c.y + i * interlineado, align: c.align, peso: 'normal', color, px,
    }));
  }

  // Fecha
  if (fecha) {
    const c = campos.fecha;
    out.push({ texto: fecha, x: c.x, y: c.y, align: c.align, peso: 'normal', color, px: c.tam * PT });
  }

  return out;
}

/* ================================================================
   Vista previa
   ================================================================ */
const cacheImagenes = new Map();
function cargarImagen(src) {
  if (!cacheImagenes.has(src)) {
    cacheImagenes.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => { cacheImagenes.delete(src); reject(new Error('No se pudo cargar la plantilla: ' + src)); };
      img.src = encodeURI(src);
    }));
  }
  return cacheImagenes.get(src);
}

let fuentesNavegador = null;
function cargarFuentesNavegador() {
  if (!fuentesNavegador) {
    fuentesNavegador = Promise.all(Object.entries(FAMILIA).map(async ([peso, familia]) => {
      const fuente = new FontFace(familia, `url("${CONFIG.fuentes[peso]}")`);
      await fuente.load();
      document.fonts.add(fuente);
    }));
  }
  return fuentesNavegador;
}

let previewPendiente = false;
let previewTurno = 0;
function programarPreview() {
  if (previewPendiente) return;
  previewPendiente = true;
  setTimeout(() => { previewPendiente = false; dibujarPreview(); }, 16);
}

async function dibujarPreview() {
  const turno = ++previewTurno;
  const cert = certificadoElegido();

  if (!cert) {
    el.previewFrame.classList.remove('ready');
    el.previewMeta.textContent = '';
    return;
  }

  let img;
  try {
    [img] = await Promise.all([cargarImagen(cert.archivo), cargarFuentesNavegador()]);
  } catch (err) {
    console.error(err);
    if (turno === previewTurno) mostrarMensaje(err.message, 'error');
    return;
  }
  if (turno !== previewTurno) return;   // llegó un cambio más nuevo

  const nombres = obtenerNombres();
  const datos = datosCertificado(cert, nombres[0]);
  if (!nombres.length) {
    datos.nombre = estado.destinatario === 'docentes' ? 'Nombre del docente' : 'Nombre del alumno';
    datos.borrador = true;
  }
  if (cert.especial) {
    if (!datos.titulo && estado.destinatario === 'alumnos') { datos.titulo = 'Título'; }
    if (!datos.descripcion) datos.descripcion = 'Aquí va la descripción del certificado.';
  }

  const ctx = el.previewCanvas.getContext('2d');
  prepararContexto(ctx);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  for (const t of armarTextos(datos)) {
    ctx.globalAlpha = t.borrador ? 0.35 : 1;
    ctx.font = fuenteCanvas(t.peso, t.px);
    ctx.fillStyle = t.color;
    ctx.textAlign = t.align;
    ctx.fillText(t.texto, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  el.previewFrame.classList.add('ready');

  // Texto de ayuda sobre la vista previa
  const n = nombres.length;
  el.previewMeta.textContent = n > 1
    ? `${cert.nombre} · página 1 de ${n}`
    : cert.nombre;
}

function datosCertificado(cert, nombre) {
  return {
    destinatario: estado.destinatario,
    area:         estado.area,
    especial:     cert.especial,
    nombre:       nombre || '',
    titulo:       el.inputTitulo.value.trim(),
    descripcion:  el.inputDesc.value.trim().replace(/\s+/g, ' '),
    fecha:        textoFecha(),
  };
}

/* ================================================================
   Generación del PDF
   ================================================================ */
async function generar() {
  if (estado.ocupado) return;
  ocultarMensaje();

  // 1. Validaciones
  const cert = certificadoElegido();
  const nombres = obtenerNombres();
  const usaPlanilla = estado.destinatario === 'alumnos' && estado.origen === 'planilla';

  if (usaPlanilla && !estado.filas)            return mostrarMensaje('Primero carga la planilla del colegio.', 'error');
  if (usaPlanilla && !el.selectGrupo.value)    return mostrarMensaje('Elige el grupo de alumnos.', 'error');
  if (!nombres.length)                         return mostrarMensaje(estado.destinatario === 'docentes' ? 'Escribe el nombre del docente.' : 'Escribe al menos un nombre.', 'error');
  const largo = !usaPlanilla && nombres.find(n => n.length > CONFIG.limites.nombre);
  if (largo)                                   return mostrarMensaje(`Este nombre supera los ${CONFIG.limites.nombre} caracteres:\n"${largo}"`, 'error');
  if (!cert)                                   return mostrarMensaje('Elige el curso del certificado.', 'error');
  if (cert.especial && estado.destinatario === 'alumnos' && !el.inputTitulo.value.trim())
                                               return mostrarMensaje('Escribe el título del certificado especial.', 'error');
  if (cert.especial && !el.inputDesc.value.trim())
                                               return mostrarMensaje('Escribe la descripción del certificado especial.', 'error');
  if (!el.inputAnio.value)                     return mostrarMensaje('Elige el año de emisión.', 'error');

  // 2. Código de acceso
  if (!(await verificarCodigo())) return;

  // 3. Generar
  setOcupado(true, 'Generando…');
  const total = nombres.length;
  mostrarProgreso(0, total);

  try {
    const [plantilla, fuentes] = await Promise.all([
      descargarBytes(cert.archivo),
      cargarFuentesPdf(),
      cargarFuentesNavegador(),
    ]);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [PAGINA_PDF.ancho, PAGINA_PDF.alto], compress: true });
    pdf.setProperties({ title: nombreArchivo(cert, nombres).replace(/\.pdf$/, ''), creator: 'Generador de Certificados' });

    for (const [peso, base64] of Object.entries(fuentes)) {
      const archivo = `${FAMILIA[peso]}.ttf`;
      pdf.addFileToVFS(archivo, base64);
      pdf.addFont(archivo, FAMILIA[peso], 'normal');
    }

    for (let i = 0; i < total; i++) {
      if (i > 0) pdf.addPage([PAGINA_PDF.ancho, PAGINA_PDF.alto], 'landscape');

      // La plantilla se incrusta una sola vez (alias) y se reutiliza en todas las páginas.
      // 'FAST' = compresión sin pérdida: misma calidad que el PNG original, archivo liviano.
      pdf.addImage(plantilla, 'PNG', 0, 0, PAGINA_PDF.ancho, PAGINA_PDF.alto, 'plantilla', 'FAST');

      for (const t of armarTextos(datosCertificado(cert, nombres[i]))) {
        pdf.setFont(FAMILIA[t.peso], 'normal');
        pdf.setFontSize(t.px * ESCALA_PDF);
        pdf.setTextColor(t.color);
        pdf.text(t.texto, t.x * ESCALA_PDF, t.y * ESCALA_PDF, { align: t.align, baseline: 'alphabetic' });
      }

      if ((i + 1) % 5 === 0 || i === total - 1) {
        mostrarProgreso(i + 1, total);
        // Pausa breve para que se actualice la barra de progreso.
        // (setTimeout y no requestAnimationFrame: este último se congela
        //  si el usuario cambia de pestaña mientras se genera el lote)
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const archivo = nombreArchivo(cert, nombres);
    pdf.save(archivo);

    // Un solo aviso compacto: nombre del archivo + cantidad de páginas
    el.progresoLabel.textContent = `Descargado: ${archivo}`;
    el.progresoLabel.title = archivo;
    el.progresoTexto.textContent = `${total} página${total === 1 ? '' : 's'}`;
    el.progreso.classList.add('completed');
  } catch (err) {
    console.error(err);
    el.progreso.classList.remove('visible', 'completed');
    mostrarMensaje('Ocurrió un error al generar el PDF: ' + err.message, 'error');
  }
  setOcupado(false);
}

async function descargarBytes(src) {
  const res = await fetch(encodeURI(src));
  if (!res.ok) throw new Error('No se pudo cargar la plantilla: ' + src);
  return new Uint8Array(await res.arrayBuffer());
}

let fuentesPdf = null;
function cargarFuentesPdf() {
  if (!fuentesPdf) {
    fuentesPdf = (async () => {
      const out = {};
      for (const peso of Object.keys(FAMILIA)) {
        out[peso] = aBase64(await descargarBytes(CONFIG.fuentes[peso]));
      }
      return out;
    })().catch(err => { fuentesPdf = null; throw err; });
  }
  return fuentesPdf;
}

function aBase64(bytes) {
  let bin = '';
  const BLOQUE = 0x8000;
  for (let i = 0; i < bytes.length; i += BLOQUE) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + BLOQUE));
  }
  return btoa(bin);
}

function nombreArchivo(cert, nombres) {
  const curso = cert.especial
    ? (el.inputTitulo.value.trim() || 'Especial')
    : cert.nombre;
  let detalle;
  const usaPlanilla = estado.destinatario === 'alumnos' && estado.origen === 'planilla';
  if (usaPlanilla) {
    const g = estado.grupos.find(x => x.clave === el.selectGrupo.value);
    detalle = g ? g.corto : 'Grupo';
  } else {
    detalle = nombres.length === 1 ? nombres[0] : `${nombres.length} ${estado.destinatario}`;
  }
  const base = `${nombres.length === 1 ? 'Certificado' : 'Certificados'} ${curso} - ${detalle}`;
  return base.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() + '.pdf';
}

/* ================================================================
   Código de acceso
   ================================================================ */
/**
 * El campo del código está siempre visible y se verifica en CADA descarga.
 * Una vez validado, queda completado (con borde verde) durante la sesión
 * del navegador, para no tener que escribirlo cada vez. Si alguien lo
 * borra o lo cambia, se vuelve a pedir.
 */
async function verificarCodigo() {
  if (!CONFIG.codigoAcceso.activo) return true;

  const codigo = el.inputCodigo.value.trim();
  if (!codigo) {
    el.inputCodigo.classList.add('error');
    el.inputCodigo.focus();
    mostrarMensaje('Ingresa el código de acceso para descargar.', 'error');
    return false;
  }

  const hash = await sha256(codigo);
  if (hash !== CONFIG.codigoAcceso.hash) {
    el.inputCodigo.classList.add('error');
    el.inputCodigo.select();
    mostrarMensaje('El código de acceso no es correcto.', 'error');
    return false;
  }

  try { sessionStorage.setItem(SESION_CODIGO, codigo); } catch { /* sin almacenamiento: se pedirá de nuevo */ }
  el.inputCodigo.classList.add('ok');
  return true;
}

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ================================================================
   Helpers de interfaz
   ================================================================ */
function actualizarBoton() {
  const n = obtenerNombres().length;
  el.btnTexto.textContent = 'Generar PDF';
  el.btnCount.hidden = n < 2;
  el.btnCount.textContent = n;
  el.btnGenerar.title = n > 1 ? `Genera un PDF con ${n} certificados` : '';
}

/**
 * Límite de caracteres POR LÍNEA en el cuadro de nombres
 * (cada línea es una persona). Corta lo que sobra, como un maxlength.
 */
function limitarLineasNombres() {
  const max = CONFIG.limites.nombre;
  const ta = el.inputNombres;
  const lineas = ta.value.split('\n');
  if (lineas.some(l => l.length > max)) {
    const cursor = ta.selectionStart;
    const antes = ta.value.length;
    ta.value = lineas.map(l => l.slice(0, max)).join('\n');
    const pos = Math.max(0, cursor - (antes - ta.value.length));
    ta.setSelectionRange(pos, pos);
  }
  actualizarContadorNombres();
}

/** Muestra el largo de la línea donde está el cursor (o la más larga). */
function actualizarContadorNombres() {
  const max = CONFIG.limites.nombre;
  const ta = el.inputNombres;
  const inicio = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  let fin = ta.value.indexOf('\n', ta.selectionStart);
  if (fin < 0) fin = ta.value.length;
  const n = ta.value.slice(inicio, fin).length;
  el.contNombres.textContent = `${n}/${max}`;
  el.contNombres.classList.toggle('limit', n >= max);
}

function actualizarContadores() {
  const t = el.inputTitulo.value.length, d = el.inputDesc.value.length;
  el.contTitulo.textContent = `${t}/${CONFIG.limites.titulo}`;
  el.contDesc.textContent   = `${d}/${CONFIG.limites.descripcion}`;
  el.contTitulo.classList.toggle('limit', t >= CONFIG.limites.titulo);
  el.contDesc.classList.toggle('limit',   d >= CONFIG.limites.descripcion);
}

/** Texto que se imprime en el certificado, ej. "Año de emisión: 2026". */
function textoFecha() {
  const anio = el.inputAnio.value;
  return anio ? CONFIG.fecha.prefijo + anio : '';
}

function setOcupado(ocupado, texto) {
  estado.ocupado = ocupado;
  el.btnGenerar.disabled = ocupado;
  el.btnLoadLink.disabled = ocupado;
  el.spinner.classList.toggle('visible', ocupado);
  if (ocupado && texto) { el.btnTexto.textContent = texto; el.btnCount.hidden = true; }
  if (!ocupado) actualizarBoton();
}

function mostrarProgreso(actual, total) {
  const pct = total ? Math.round(actual / total * 100) : 0;
  el.progresoBarra.style.width = pct + '%';
  el.progresoTexto.textContent = `${actual} de ${total}`;
  el.progresoLabel.textContent = 'Generando certificados…';
  el.progreso.classList.remove('completed');
  el.progreso.classList.add('visible');
  el.privacy.hidden = true;   // el progreso ocupa su lugar
}

function mostrarMensaje(msg, tipo) {
  el.mensaje.textContent = msg;
  el.mensaje.className = `message-box ${tipo} visible`;
  el.privacy.hidden = true;
}

function ocultarMensaje() {
  el.mensaje.className = 'message-box';
  el.privacy.hidden = false;
}

function agregarOpcion(select, value, texto, { disabled = false, selected = false } = {}) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = texto;
  o.disabled = disabled;
  o.selected = selected;
  select.appendChild(o);
}

function limpiar(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

init();

})();
