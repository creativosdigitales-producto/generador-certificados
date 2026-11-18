# Generador de Certificados

App web estática (HTML + CSS + JS, sin frameworks ni compilación) que genera
certificados en PDF para alumnos y docentes a partir de las plantillas PNG.
Todo se procesa en el navegador: ningún dato sale de la PC.

## Estructura

```
index.html                 Interfaz
css/style.css              Estilos (neumorfismo, misma línea que CredencialesApp)
js/config.js               ⭐ CONFIGURACIÓN: posiciones, tamaños, colores, código
js/app.js                  Lógica (no hace falta tocarlo para ajustes)
certificados/
  alumnos/programacion/    "07-Coder 1.png"  → aparece como "Coder 1"
  alumnos/robotica/
  alumnos/capsulas/        "Genially.png" → sin número: orden alfabético (solo alumnos)
  docentes/programacion/
  docentes/robotica/
  genericos/               Plantillas de los certificados "Especial"
  catalogo.json            Lista de cursos (se genera sola, no editar a mano)
fonts/                     Montserrat (licencia OFL) incrustada en los PDF
tools/                     Scripts auxiliares (catálogo, código, servidor local)
```

## Probar en tu PC

Requiere [Node.js](https://nodejs.org). Desde la carpeta del proyecto:

```bash
node tools/servidor.js
```

y abrir <http://localhost:5500>. (Con doble clic en `index.html` no funciona,
porque el navegador bloquea la lectura de las plantillas.)

## Ajustar posiciones del texto

Todo está en **`js/config.js` → `campos`**, separado en `alumnos`, `docentes` y `capsulas`
(las cápsulas tienen una plantilla con otro diseño, así que llevan posiciones propias).
Cada campo tiene:

| Valor | Qué hace |
|---|---|
| `x` | Posición horizontal en px (más grande = más a la derecha). Con `align: 'center'` es el centro del texto; con `'left'`, el borde izquierdo. |
| `y` | Línea base del texto en px (más grande = más abajo). |
| `anchoMax` | Ancho máximo; si el texto es más largo, se achica la letra. |
| `tamMax` / `tamMin` / `tam` | Tamaño de letra en puntos de Canva. |
| `interlineado`, `lineasMax` | Solo para la descripción. |

Guarda, recarga la página y mira la vista previa: el PDF sale idéntico.

## Año de emisión

El certificado muestra "Año de emisión: 2026" (abajo a la izquierda). El texto previo y
cuántos años anteriores ofrece el menú se cambian en `js/config.js → fecha`.

## Agregar o cambiar un certificado

1. Exportar la plantilla en PNG a 2000 × 1414 px.
2. Ponerla en la carpeta que corresponda, con número de orden: `19-Senior 4.png`.
   En `capsulas/` no hace falta el número: se listan en orden alfabético.
3. Subir el cambio a GitHub. Una GitHub Action regenera `certificados/catalogo.json`
   automáticamente (ver `.github/workflows/catalogo.yml`).

Para probarlo antes en tu PC: `node tools/generar-catalogo.js`.

## Cambiar el código de acceso

```bash
node tools/generar-codigo.js 4821
```

Pegar el hash que devuelve en `js/config.js → codigoAcceso.hash`.
El campo del código está siempre visible y se verifica en cada descarga. Una vez validado
queda completado (con borde verde) mientras la pestaña esté abierta, para no reescribirlo.

> Es una barrera contra el uso casual, no seguridad fuerte: alguien con
> conocimientos técnicos puede saltarla, y en GitHub Pages gratuito el
> repositorio (con las plantillas) es público.

## Publicar en GitHub Pages

1. Crear el repositorio y subir el proyecto (la carpeta `contexto/` queda fuera por `.gitignore`).
2. *Settings → Pages → Deploy from a branch → main / (root)*.
3. *Settings → Actions → General → Workflow permissions → Read and write* (para que la Action pueda actualizar el catálogo).
