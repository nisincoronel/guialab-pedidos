# GuiaLab Pedidos 1.9.0 beta

PWA educativa de Espacio Guía para practicar lectura e interpretación preanalítica de pedidos de laboratorio. Conserva la biblioteca fotográfica, cuentas, comisiones, evaluaciones, créditos y gestión docente de la versión 1.6; incorpora el catálogo de determinaciones y un generador de pedidos simulados aleatorios.

## Funciones 1.9.0

- Biblioteca de pedidos fotográficos manuscritos, impresos y mixtos.
- Gestión docente de casos, claves de corrección, comisiones, alumnos, evaluaciones, entregas y créditos.
- Catálogo local con 1,619 registros de origen; 189 determinaciones completas habilitadas para práctica. Las 1,430 entradas identificadas como NBU incompleto se excluyen del catálogo y del generador.
- Nueva pestaña **Generador** en la navegación.
- El docente puede generar pedidos con 2 a 40 determinaciones únicas seleccionadas aleatoriamente, indicar dificultad, título, consigna y vencimiento opcional.
- El sistema genera un enlace único con token. El docente puede copiar enlace o token, abrir la vista del alumno, consultar los pedidos generados y cerrar/reabrir enlaces.
- El alumno abre el enlace sin tener que crear una cuenta, ve la orden simulada y completa área, muestra, tubo/aditivo, preparación y observaciones.
- La entrega queda guardada en Supabase. El docente puede abrir cada entrega, comparar respuesta y clave esperada, asignar puntaje por determinación y publicar una nota promedio y devolución general.

## Instalación desde cero en GitHub

1. Reemplazá los archivos del repositorio por **todo el contenido** de esta carpeta.
2. Conservá `config.js` con la URL y la clave pública publishable/anon del proyecto Supabase.
3. En Supabase SQL Editor, ejecutá las migraciones históricas solo si todavía no están aplicadas, en orden 1.2, 1.3, 1.4, 1.5 y 1.6.
4. Ejecutá `migration_1_7.sql` después de 1.6 para crear el generador. Luego ejecutá `migration_1_8.sql` para habilitar la corrección docente.
5. En Supabase Authentication > Providers, mantené habilitado Email para el acceso docente. No hace falta habilitar cuentas anónimas para abrir pedidos generados por enlace.
6. Publicá GitHub Pages y recargá el sitio con Ctrl+Shift+R.

**Importante:** si ya ejecutaste `migration_1_7.sql` en tu proyecto, no la repitas: ejecutá únicamente `migration_1_8.sql`. Si todavía no aplicaste la 1.7, ejecutá primero la 1.7 y después la 1.8. No repitas las migraciones históricas.

## Uso del generador

1. Iniciá sesión como docente autorizado en **Gestión educativa**.
2. Abrí la pestaña **Generador**.
3. Elegí cantidad, dificultad, consigna y vencimiento opcional.
4. Presioná **Generar pedido y enlace**.
5. Copiá el enlace o el token y compartilo con los alumnos.
6. El alumno completa la actividad y envía la resolución desde el enlace.
7. En el panel Generador podés cerrar o reabrir cada enlace y usar **Ver entregas** para corregir las respuestas.

## Seguridad y limitaciones

- La creación y administración de pedidos está protegida por `public.is_glp_admin()` en PostgreSQL; no depende de ocultar botones en el navegador.
- El alumno solo obtiene los datos visibles del pedido mediante RPC por token. La clave de respuestas no se entrega en la consulta.
- Los tokens son aleatorios y no secuenciales. Un enlace activo funciona como credencial de acceso: compartilo solo con el grupo destinatario.
- La calificación es manual: el docente asigna un puntaje de 0 a 100 a cada determinación. La nota final es el promedio. La aplicación no certifica automáticamente la corrección técnica.
- La base de determinaciones es material de referencia educativa, no protocolo clínico universal. Verificá los datos según el método y procedimiento de cada laboratorio.
- No cargues ni compartas datos identificatorios reales de pacientes.
- Mercado Pago no procesa pagos reales en esta beta.

## Archivos

- `index.html`, `styles.css`, `app.js`: interfaz y lógica.
- `determinaciones.json`: catálogo integrado.
- `migration_1_7.sql`: generador, tokens, entregas y funciones RPC.
- `migration_1_8.sql`: panel de entregas, corrección docente y calificación.
- `migration_1_2.sql` a `migration_1_6.sql`: migraciones anteriores.
- `config.js`: configuración pública Supabase; nunca incluir service_role.
- `sw.js`: caché PWA versionada 1.9.


## Novedades 1.9.0

- Se agregó la revisión docente de las entregas de pedidos aleatorios. Desde cada pedido, el docente puede abrir las respuestas, compararlas con la clave esperada, asignar un puntaje de 0 a 100 por determinación y publicar una devolución general. La nota final es el promedio de los puntajes por determinación.
- La nota ya no se calcula automáticamente por encontrar el nombre de la determinación, porque ese nombre ya aparece en el enunciado y podía producir falsos positivos. La calificación queda pendiente hasta la revisión docente.
- Se excluyen del catálogo de práctica y del generador aleatorio las filas identificadas como `Nomenclador NBU` o con la observación de incorporación al NBU sin datos preanalíticos.

### Actualización de Supabase

Si ya aplicaste `migration_1_7.sql`, ejecutá **una sola vez** `migration_1_8.sql` en Supabase SQL Editor. No vuelvas a ejecutar las migraciones anteriores.
