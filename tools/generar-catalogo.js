#!/usr/bin/env node
/* ================================================
   generar-catalogo.js
   ================================================
   Lee las carpetas de certificados y arma el archivo
   certificados/catalogo.json, que es la lista de cursos
   que muestra la app en los menús desplegables.

   ¿Por qué hace falta? Una página publicada (GitHub Pages)
   no puede "mirar" qué archivos hay dentro de una carpeta,
   así que necesita una lista escrita de antemano.

   Cuándo se ejecuta:
   - Automáticamente en GitHub cada vez que se sube un cambio
     dentro de /certificados (ver .github/workflows/catalogo.yml).
   - A mano, para probar en tu PC:   node tools/generar-catalogo.js

   Reglas para los nombres de archivo:
     "07-Coder 1.png"  →  orden 7, nombre "Coder 1"
     "Genially.png"    →  sin número: va después de los numerados,
                          en orden alfabético (así están las cápsulas)
   El número de adelante solo sirve para ordenar la lista
   y no se muestra en la app.
   ================================================ */

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const CERT_DIR    = path.join(ROOT, 'certificados');
const OUTPUT_FILE = path.join(CERT_DIR, 'catalogo.json');

const DESTINATARIOS = ['alumnos', 'docentes'];
const AREAS         = ['programacion', 'robotica', 'capsulas'];   // cápsulas: solo alumnos
const EXTENSIONES   = ['.png', '.jpg', '.jpeg'];

function leerCursos(destinatario, area) {
  const dir = path.join(CERT_DIR, destinatario, area);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => EXTENSIONES.includes(path.extname(f).toLowerCase()))
    .map(archivo => {
      const base  = path.basename(archivo, path.extname(archivo)).normalize('NFC');
      const match = base.match(/^\s*(\d+)\s*[-_.]?\s*(.+)$/);
      return {
        orden:   match ? parseInt(match[1], 10) : 9999,
        nombre:  (match ? match[2] : base).trim(),
        archivo: ['certificados', destinatario, area, archivo.normalize('NFC')].join('/'),
      };
    })
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
}

const catalogo = {};
for (const d of DESTINATARIOS) {
  catalogo[d] = {};
  for (const a of AREAS) catalogo[d][a] = leerCursos(d, a);
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');

const total = DESTINATARIOS.reduce((n, d) => n + AREAS.reduce((m, a) => m + catalogo[d][a].length, 0), 0);
console.log(`catalogo.json actualizado: ${total} certificados.`);
for (const d of DESTINATARIOS) {
  for (const a of AREAS) console.log(`  ${d}/${a}: ${catalogo[d][a].length}`);
}
