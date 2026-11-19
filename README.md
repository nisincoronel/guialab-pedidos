# GuiaLab Pedidos 1.8.0 beta

PWA educativa de Espacio Guía para practicar lectura e interpretación preanalítica de pedidos de laboratorio. Conserva la biblioteca fotográfica, cuentas, comisiones, evaluaciones, créditos y gestión docente de la versión 1.6; incorpora el catálogo de determinaciones y un generador de pedidos simulados aleatorios.

## Funciones 1.8.0

- Biblioteca de pedidos fotográficos manuscritos, impresos y mixtos.
- Gestión docente de casos, claves de corrección, comisiones, alumnos, evaluaciones, entregas y créditos.
- Catálogo local integrado con 1,619 determinaciones, búsqueda y sugerencias.
- Nueva pestaña **Generador** en la navegación.
- El docente puede generar pedidos con 2 a 40 determinaciones únicas seleccionadas aleatoriamente, indicar dificultad, título, consigna y vencimiento opcional.
- El sistema genera un enlace único con token. El docente puede copiar enlace o token, abrir la vista del alumno, consultar los pedidos generados y cerrar/reabrir enlaces.
- El alumno abre el enlace sin tener que crear una cuenta, ve la orden simulada y completa área, muestra, tubo/aditivo, preparación y observaciones.
- La entrega queda guardada en Supabase y devuelve un reconocimiento automático básico de las determinaciones. La revisión de área, muestra, tubo y fase preanalítica sigue siendo responsabilidad docente.

## Instalación desde cero en GitHub

1. Reemplazá los archivos del repositorio por **todo el contenido** de esta carpeta.
2. Conservá `config.js` con la URL y la clave pública publishable/anon del proyecto Supabase.
3. En Supabase SQL Editor, ejecutá las migraciones históricas solo si todavía no están aplicadas, en orden 1.2, 1.3, 1.4, 1.5 y 1.6.
4. Ejecutá **una sola vez** la nueva `migration_1_7.sql` después de 1.6. Esta crea las tablas y funciones seguras del generador.
5. En Supabase Authentication > Providers, mantené habilitado Email para el acceso docente. No hace falta habilitar cuentas anónimas para abrir pedidos generados por enlace.
6. Publicá GitHub Pages y recargá el sitio con Ctrl+Shift+R.

**Importante:** si ya ejecutaste las migraciones 1.2 a 1.6 en tu proyecto Supabase, no las repitas. Ejecutá únicamente `migration_1_7.sql`.

## Uso del generador

1. Iniciá sesión como docente autorizado en **Gestión educativa**.
2. Abrí la pestaña **Generador**.
3. Elegí cantidad, dificultad, consigna y vencimiento opcional.
4. Presioná **Generar pedido y enlace**.
5. Copiá el enlace o el token y compartilo con los alumnos.
6. El alumno completa la actividad y envía la resolución desde el enlace.
7. En el panel Generador podés cerrar o reabrir cada enlace.

## Seguridad y limitaciones

- La creación y administración de pedidos está protegida por `public.is_glp_admin()` en PostgreSQL; no depende de ocultar botones en el navegador.
- El alumno solo obtiene los datos visibles del pedido mediante RPC por token. La clave de respuestas no se entrega en la consulta.
- Los tokens son aleatorios y no secuenciales. Un enlace activo funciona como credencial de acceso: compartilo solo con el grupo destinatario.
- El reconocimiento automático actual evalúa presencia de denominaciones; no certifica la corrección técnica de áreas, muestras, tubos, ayuno ni transporte. El docente debe revisar esos criterios.
- La base de determinaciones es material de referencia educativa, no protocolo clínico universal. Verificá los datos según el método y procedimiento de cada laboratorio.
- No cargues ni compartas datos identificatorios reales de pacientes.
- Mercado Pago no procesa pagos reales en esta beta.

## Archivos

- `index.html`, `styles.css`, `app.js`: interfaz y lógica.
- `determinaciones.json`: catálogo integrado.
- `migration_1_7.sql`: generador, tokens, entregas y funciones RPC.
- `migration_1_2.sql` a `migration_1_6.sql`: migraciones anteriores.
- `config.js`: configuración pública Supabase; nunca incluir service_role.
- `sw.js`: caché PWA versionada 1.8.
