/* ================================================================
   Generador de Certificados — CONFIGURACIÓN
   ================================================================
   Este es el ÚNICO archivo que necesitas tocar para afinar
   posiciones, tamaños, colores, límites o el código de acceso.

   ¿Cómo leer las posiciones?
   - Todas las coordenadas (x, y, anchoMax, interlineado) están en
     PÍXELES de la plantilla (2000 × 1414). El punto (0, 0) es la
     esquina superior izquierda.
       · x  → más grande = más a la DERECHA
       · y  → más grande = más ABAJO
   - "y" es la LÍNEA BASE del texto (la línea imaginaria donde
     "apoyan" las letras, sin contar las colitas de g, p, y).
   - Los tamaños de letra (tamMax, tamMin, tam) están en las mismas
     unidades que usas en Canva (puntos), así puedes comparar
     directo con el diseño original.

   Después de cambiar algo, guarda y recarga la página: la vista
   previa muestra el resultado al instante.
   ================================================================ */

const CONFIG = {

  /* ── Tamaño de las plantillas (px) ── */
  imagen: { ancho: 2000, alto: 1414 },

  /* Conversión de "puntos de Canva" a píxeles de la plantilla.
     Las plantillas son A4 apaisado (841.89 pt de ancho) exportadas a 2000 px. */
  pxPorPunto: 2000 / 841.89,

  /* ── Colores ── */
  colores: {
    // Nombre, descripción y fecha
    texto: {
      alumnos:  { programacion: '#00647c', robotica: '#005580' },
      docentes: { programacion: '#006987', robotica: '#006987' },
    },
    // Título de los certificados especiales (solo alumnos)
    tituloEspecial: { programacion: '#fea123', robotica: '#09baed' },
  },

  /* ── Posición y tamaño de cada campo ──
     align: 'center' → x es el CENTRO del texto
            'left'   → x es el BORDE IZQUIERDO del texto            */
  campos: {

    alumnos: {
      // Nombre: centrado sobre el recuadro celeste (x 310–1689, y 677–792)
      nombre: {
        x: 1000, y: 754, align: 'center',
        anchoMax: 1290,          // si el nombre es más largo, se achica la letra
        tamMax: 23, tamMin: 12,  // puntos (Canva)
      },
      // Fecha: abajo a la izquierda, sobre la línea decorativa
      fecha: {
        x: 505, y: 1214, align: 'center',
        tam: 12,
      },
      // Título (solo certificados especiales): donde va el nombre del curso
      titulo: {
        x: 1000, y: 537, align: 'center',
        anchoMax: 1150,
        tamMax: 21, tamMin: 14,
      },
      // Descripción (solo certificados especiales): debajo del recuadro
      descripcion: {
        x: 310, y: 856, align: 'left',
        anchoMax: 1378,
        tam: 14, tamMin: 11,     // si no entra en lineasMax, se achica
        interlineado: 40,        // distancia entre líneas (px) con tam 14
        lineasMax: 4,
      },
    },

    docentes: {
      // Nombre: centrado sobre el recuadro celeste (x 310–1689, y 698–814)
      nombre: {
        x: 1000, y: 775, align: 'center',
        anchoMax: 1290,
        tamMax: 23, tamMin: 12,
      },
      // Fecha: abajo a la izquierda, alineada con el margen del texto
      fecha: {
        x: 310, y: 1210, align: 'left',
        tam: 12,
      },
      descripcion: {
        x: 310, y: 879, align: 'left',
        anchoMax: 1378,
        tam: 14, tamMin: 11,
        interlineado: 43,
        lineasMax: 4,
      },
    },
  },

  /* ── Límites de caracteres (incluyendo espacios) ──
     nombre: se aplica a los nombres escritos a mano (por línea).
     Los nombres de la planilla no se cortan: si alguno fuera muy
     largo, se achica la letra lo necesario para que entre igual.    */
  limites: {
    nombre: 50,
    titulo: 20,
    descripcion: 220,
  },

  /* El título especial se escribe en MAYÚSCULAS, como en las plantillas de los cursos */
  tituloEnMayusculas: true,

  /* ── Plantillas de los certificados especiales ── */
  especiales: {
    alumnos: {
      programacion: 'certificados/genericos/plantilla-programacion-alumno.png',
      robotica:     'certificados/genericos/plantilla-robotica-alumno.png',
    },
    docentes: {
      // Docentes usa la misma plantilla para las dos áreas
      programacion: 'certificados/genericos/plantilla-generica-docente.png',
      robotica:     'certificados/genericos/plantilla-generica-docente.png',
    },
  },

  /* ── Fecha ── */
  fecha: {
    idioma: 'es-AR',                                   // → "3 de noviembre de 2026"
    formato: { day: 'numeric', month: 'long', year: 'numeric' },
    prefijo: '',                                       // ej: 'Fecha: ' (vacío = solo la fecha)
  },

  /* ── Planilla del colegio ── */
  planilla: {
    // Se usa la primera pestaña VISIBLE cuyo nombre empiece con este texto
    // (sirve para "Listado Alumnos 2026", "Listado Alumnos 2027", etc.)
    hoja: 'Listado Alumnos',
    columnas: { nombre: 'nombre', apellido: 'apellido', grupo: 'grupo' },
  },

  /* ── Código de acceso ──
     Para cambiarlo:  node tools/generar-codigo.js <nuevo-código>
     y pega aquí el "hash" que te devuelve.
     Código actual: 2026  (¡cámbialo antes de publicar!)              */
  codigoAcceso: {
    activo: true,
    hash: '158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab',
  },

  /* ── Archivos ── */
  catalogo: 'certificados/catalogo.json',
  fuentes: {
    extraNegrita: 'fonts/Montserrat-ExtraBold.ttf',
    normal:       'fonts/Montserrat-Regular.ttf',
  },

  /* Presentación "¿Cómo usar?" (dejar vacío para ocultar el botón) */
  guiaUrl: '',
};
