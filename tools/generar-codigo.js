#!/usr/bin/env node
/* ================================================
   generar-codigo.js — cambia el código de acceso
   ================================================
   La app no guarda el código "a la vista": guarda su
   huella (hash SHA-256). Para cambiar el código:

     node tools/generar-codigo.js 4821

   y pega el resultado en js/config.js → codigoAcceso.hash
   ================================================ */

const crypto = require('crypto');

const codigo = (process.argv[2] || '').trim();
if (!codigo) {
  console.log('Uso: node tools/generar-codigo.js <nuevo-código>');
  process.exit(1);
}

const hash = crypto.createHash('sha256').update(codigo, 'utf8').digest('hex');
console.log(`\nCódigo: ${codigo}\nHash:   ${hash}\n\nPega el hash en js/config.js → codigoAcceso.hash\n`);
