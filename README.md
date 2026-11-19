# GuiaLab Pedidos 1.7.0 beta

Aplicación educativa PWA para GitHub Pages + Supabase. Esta versión integra la base local `determinaciones.json` en la interfaz de resolución de pedidos.

## Novedades 1.7.0

- Catálogo local integrado con **1,619 determinaciones**.
- Búsqueda por denominación, abreviatura/sinónimo, grupo, sector y código NBU.
- Posibilidad de agregar una determinación encontrada directamente a la planilla de resolución.
- Al seleccionar una determinación desde las sugerencias del campo, se completan automáticamente los campos vacíos de área, muestra y tubo/aditivo.
- El catálogo muestra, cuando están disponibles, ayuno/preparación, toma, procesamiento, condiciones especiales, observaciones y código NBU.
- `determinaciones.json` se incluye en la precarga del Service Worker.

## Publicación

1. Reemplazá todos los archivos del repositorio con el contenido de este ZIP.
2. Conservá `config.js` con la URL y clave pública actuales de Supabase.
3. Esperá el despliegue de GitHub Pages y recargá con `Ctrl + Shift + R`.
4. Abrí un pedido desde Biblioteca. En la planilla de resolución encontrarás el buscador **Consultar catálogo de determinaciones**.

## Supabase y migraciones

Esta integración funciona del lado del navegador y **no requiere una migración SQL nueva**. Si ya aplicaste las migraciones 1.2 a 1.6, no las vuelvas a ejecutar. Biblioteca, cuentas, comisiones, evaluaciones y créditos siguen dependiendo de Supabase.

Mercado Pago todavía no procesa pagos reales en esta beta.

## Uso responsable del catálogo

La base se incorpora como referencia educativa y de búsqueda, no como protocolo clínico universal ni fuente validada para todos los laboratorios. La disponibilidad de muestra, tubo, ayuno, conservación y procesamiento puede variar según método, plataforma analítica y procedimiento institucional. Verificá esos datos con el procedimiento vigente del laboratorio.

## Archivos principales

- `index.html`, `styles.css`, `app.js`: interfaz y lógica.
- `determinaciones.json`: catálogo local integrado.
- `config.js`: configuración pública de Supabase (conservar).
- `sw.js`: caché de la aplicación y del catálogo.
- `migration_1_2.sql` a `migration_1_6.sql`: migraciones históricas ya aplicadas; no ejecutar nuevamente.
