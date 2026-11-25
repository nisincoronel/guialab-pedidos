# GuiaLab Pedidos 2.0.2

PWA educativa de Espacio Guía para practicar lectura e interpretación preanalítica de pedidos de laboratorio. Conserva la biblioteca fotográfica, cuentas, comisiones, evaluaciones, créditos y gestión docente de la versión 1.6; incorpora el catálogo de determinaciones y un generador de pedidos simulados aleatorios.

## Funciones 2.0.2

- Biblioteca de pedidos fotográficos manuscritos, impresos y mixtos.
- Gestión docente de casos, claves de corrección, comisiones, alumnos, evaluaciones, entregas y créditos.
- Catálogo local con 1,619 registros de origen; 189 determinaciones completas habilitadas para práctica. Las 1,430 entradas identificadas como NBU incompleto se excluyen del catálogo y del generador.
- Nueva pestaña **Generador** en la navegación.
- El docente puede generar pedidos con 2 a 40 determinaciones únicas seleccionadas aleatoriamente, indicar dificultad, título, consigna y vencimiento opcional.
- Se conservan dos modalidades: pedido compartido y enlace de comisión con pedido aleatorio individual por alumno.
- Registro general exportable de todas las calificaciones de pedidos compartidos e individuales, con nombre del alumno, actividad, fecha, estado, nota del pedido, nota presencial, código de seguimiento y devolución docente.
- Campo independiente para cargar una calificación presencial (0 a 100) por alumno, sin modificar la nota obtenida en el pedido virtual. Puede dejarse vacío o limpiarse si todavía no se evaluó presencialmente.
- El docente puede eliminar un pedido individual/compartido o una comisión completa. La eliminación de una comisión elimina también sus pedidos individuales y entregas; la eliminación de un pedido elimina sus entregas y correcciones asociadas. La interfaz pide confirmación antes de borrar.
- El sistema genera un enlace único con token. El docente puede copiar enlace o token, abrir la vista del alumno, consultar los pedidos generados y cerrar/reabrir enlaces.
- El alumno abre el enlace sin tener que crear una cuenta, ve la orden simulada y completa área, muestra, tubo/aditivo, preparación y observaciones.
- La entrega queda guardada en Supabase. El docente puede abrir cada entrega, comparar respuesta y clave esperada, asignar puntaje por determinación y publicar una nota promedio y devolución general.

## Instalación desde cero en GitHub

1. Reemplazá los archivos del repositorio por **todo el contenido** de esta carpeta.
2. Conservá `config.js` con la URL y la clave pública publishable/anon del proyecto Supabase.
3. En Supabase SQL Editor, ejecutá las migraciones históricas solo si todavía no están aplicadas, en orden 1.2, 1.3, 1.4, 1.5 y 1.6.
4. Ejecutá `migration_1_7.sql` después de 1.6 para crear el generador. Luego ejecutá `migration_1_8.sql` para habilitar la corrección docente, `migration_1_9.sql` para los códigos de seguimiento, `migration_1_10.sql` para las comisiones individuales y `migration_1_11.sql` para habilitar la eliminación de pedidos y comisiones. Finalmente ejecutá `migration_1_12.sql` para agregar el registro general de calificaciones y la nota presencial.
5. En Supabase Authentication > Providers, mantené habilitado Email para el acceso docente. No hace falta habilitar cuentas anónimas para abrir pedidos generados por enlace.
6. Publicá GitHub Pages y recargá el sitio con Ctrl+Shift+R.

**Importante:** si ya ejecutaste `migration_1_7.sql` en tu proyecto, no la repitas: ejecutá únicamente `migration_1_8.sql`. Si todavía no aplicaste la 1.7, ejecutá primero la 1.7 y después la 1.8. No repitas las migraciones históricas ni ninguna migración que ya hayas aplicado.

## Registro de calificaciones y nota presencial

- En el panel Generador, el botón **Descargar todas las calificaciones (CSV)** exporta todas las entregas de pedidos compartidos e individuales del docente. Incluye nombre, actividad, modalidad, fecha, estado, nota del pedido, nota presencial, código y devolución.
- Al abrir una entrega para corregirla, aparece un campo independiente **Calificación presencial (0 a 100)**. Se guarda junto con la corrección, pero no altera la nota del pedido. Si todavía no se realizó la evaluación presencial, dejalo vacío.

## Eliminación de pedidos y comisiones

- En **Pedidos generados**, el botón **Eliminar pedido** borra el pedido seleccionado y todas sus entregas, respuestas, correcciones y códigos.
- En **Actividades por comisión**, **Eliminar comisión** borra el enlace de comisión, todos los pedidos individuales generados desde ese enlace y todas sus entregas.
- La eliminación es permanente e irreversible. Exportá los códigos o guardá las notas antes de eliminar si necesitás conservar un registro.

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


## Novedades 1.9.1

- Se agregó la revisión docente de las entregas de pedidos aleatorios. Desde cada pedido, el docente puede abrir las respuestas, compararlas con la clave esperada, asignar un puntaje de 0 a 100 por determinación y publicar una devolución general. La nota final es el promedio de los puntajes por determinación.
- La nota ya no se calcula automáticamente por encontrar el nombre de la determinación, porque ese nombre ya aparece en el enunciado y podía producir falsos positivos. La calificación queda pendiente hasta la revisión docente.
- Se excluyen del catálogo de práctica y del generador aleatorio las filas identificadas como `Nomenclador NBU` o con la observación de incorporación al NBU sin datos preanalíticos.

### Actualización de Supabase

Si ya aplicaste `migration_1_7.sql`, ejecutá **una sola vez** `migration_1_8.sql` en Supabase SQL Editor. No vuelvas a ejecutar las migraciones anteriores.

## Novedades 1.9.1: consulta individual de correcciones

- Al enviar una actividad, cada alumno recibe un código privado de seguimiento de 10 caracteres.
- El código identifica una entrega concreta, aunque toda la comisión utilice el mismo enlace del pedido.
- El alumno puede consultar el estado y, cuando el docente publique la corrección, ver la nota final, puntaje por determinación, sus respuestas, la clave esperada y la devolución docente.
- La consulta se realiza sin crear una cuenta mediante `?devolucion=CODIGO` o ingresando el código en el formulario de consulta.
- El código se genera y valida en Supabase. La clave esperada no se entrega hasta que la corrección esté publicada.

### Actualización de Supabase 1.9.1

Después de haber aplicado `migration_1_7.sql` y `migration_1_8.sql`, ejecutá **una sola vez** `migration_1_9.sql`. No repitas las migraciones anteriores.


## Versión 2.0.0 — pedidos aleatorios individuales por comisión

Esta versión conserva el modo de pedido compartido y agrega una segunda modalidad: un enlace único de comisión desde el cual cada alumno ingresa su nombre y recibe un pedido aleatorio individual. El pedido queda asociado al navegador del alumno para recuperarlo al recargar, y admite una sola entrega. El docente puede consultar cada pedido y entrega por separado, copiar el código de seguimiento de cada alumno y cerrar/reabrir el enlace de comisión.

También se incorpora en la pantalla de Inicio el comprobador de calificaciones por código individual.

### Actualización de base de datos

Si ya aplicaste las migraciones hasta `migration_1_9.sql`, ejecutá **una sola vez** `migration_1_10.sql` en Supabase SQL Editor. No vuelvas a ejecutar las migraciones anteriores.

### Publicación

Reemplazá los archivos del repositorio con el contenido de este ZIP y publicá GitHub Pages. Luego recargá con `Ctrl + Shift + R`. El service worker cambia de caché a `v2.0.0`.

### Comportamiento de la modalidad por comisión

- El docente genera un enlace común y lo comparte con toda la comisión.
- Cada alumno escribe su nombre; el navegador conserva un identificador local de esa sesión.
- El sistema genera una combinación aleatoria distinta desde el catálogo de determinaciones habilitadas (las entradas NBU excluidas continúan filtradas).
- Al recargar el mismo navegador, el enlace recupera el mismo pedido.
- Cada pedido individual admite una sola entrega. El alumno recibe su código corto al enviar.
- El docente ve el nombre, las entregas y el código de seguimiento en el panel; puede copiar el código o exportar un CSV con alumnos, códigos y estados.
- La consulta pública por código muestra la devolución únicamente después de que el docente la publica.

**Nota:** la recuperación de asignaciones se intenta primero con el identificador local del navegador y, como alternativa, con el nombre normalizado ingresado por el alumno. Como no hay cuentas obligatorias para esta actividad, dos alumnos que compartan exactamente el mismo nombre podrían recuperar la misma asignación; conviene pedir nombre y apellido completos.


## GuiaLab Pedidos 2.1.0

Esta versión consolida mejoras de seguridad, confiabilidad y gestión académica.

### Cambios
- Las claves esperadas de pedidos compartidos e individuales se resuelven en funciones SQL del servidor; la respuesta pública del pedido solo incluye determinación y número.
- Los pedidos de comisión se seleccionan aleatoriamente en Supabase desde el catálogo habilitado.
- Los alumnos de pedidos individuales no pueden editar el nombre asignado al pedido; el servidor intenta recuperar la asignación por clave de navegador y por nombre para permitir reingreso desde otro dispositivo.
- Se impide una segunda entrega en pedidos individuales mediante bloqueo transaccional del pedido y comprobación en base de datos.
- Se agrega el campo de orden de llenado Vacutainer, visible para el docente y en la devolución publicada.
- Se agrega registro académico filtrable, impresión de acta (Guardar como PDF) e historial de modificaciones de notas.
- Se mantiene el código de seguimiento de 10 caracteres. No se incorpora limitación de intentos de consulta, según la decisión del usuario.

### Instalación
1. Reemplazar los archivos del sitio con el contenido de este ZIP.
2. En Supabase, ejecutar `migration_1_13.sql` una sola vez, después de `migration_1_12.sql`.
3. No repetir migraciones anteriores.
4. Publicar GitHub Pages y recargar con Ctrl+Shift+R.

La migración crea y carga el catálogo privado de determinaciones habilitadas. Verificar la cantidad de registros insertados con:

```sql
select count(*) from public.glp_determination_catalog where enabled;
```

La cantidad esperada al construir esta versión es 187 determinaciones habilitadas.


## Selector de examen práctico (2.1.1)

Se agregó `selector-examen.html`, accesible desde la navegación **Examen práctico**. Incluye 31 alumnos cargados inicialmente a partir de la nómina proporcionada por el docente (se omitieron los DNI), sorteo de extraccionista, paciente y material, registro de prácticas, deshacer, reinicio y exportación CSV. La lista puede editarse desde la propia página.

Los datos del selector se guardan localmente en el navegador (`localStorage`); no se sincronizan con Supabase ni con las cuentas de alumnos. Para proyectar, abrir la sección desde la navegación y usar **Pantalla completa**.


## Versión 2.1.2
- Se incorpora el selector de examen práctico con la primera nómina de 31 alumnos (sin DNI).
- Para compartir una evaluación con toda la comisión, crear el enlace desde **Enlace grupal · pedido aleatorio por alumno**. El alumno ingresa su nombre y luego recibe un pedido aleatorio individual.
- Los enlaces directos `?pedido=` abren primero una pantalla de identificación.
- Los pedidos generados muestran una plantilla educativa con identificación de material didáctico y advertencia de no validez como pedido real.
- No requiere migraciones SQL nuevas.
