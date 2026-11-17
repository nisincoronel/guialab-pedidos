# GuiaLab Pedidos 1.3.1 beta

Aplicación educativa PWA para GitHub Pages + Supabase. Estructura plana: todos los archivos en la raíz.

## Novedades de esta beta
- Registro de cuenta gratuita con Supabase Auth y confirmación de correo (según configuración Auth del proyecto).
- Inicio de sesión, recuperación de contraseña y cierre de sesión para alumnos.
- Perfil básico y nivel gratuito.
- Inscripción a una comisión mediante código generado por el docente.
- Consulta de evaluaciones publicadas vinculadas a las comisiones del alumno.
- Resolución y entrega de evaluación con exactamente cinco pedidos; las respuestas quedan guardadas en Supabase.
- Gestión educativa existente para administradores docentes, sin cambiar la biblioteca ni el catálogo externo.

## Archivos y despliegue
1. Reemplazá los archivos de la raíz del repositorio con el contenido del ZIP.
2. Conservá `config.js` con tu URL y clave pública publishable de Supabase. Nunca uses service_role en el navegador.
3. En Supabase ejecutá **una sola vez** `migration_1_3.sql`, después de haber ejecutado `migration_1_2.sql` y el esquema inicial.
4. En Supabase Auth habilitá Email y configurá Site URL y Redirect URLs para `https://pedidos.guialab.net.ar`.
5. En GitHub Pages mantené branch `main`, carpeta `/ (root)`.

## Pruebas de esta beta
- Crear una cuenta con correo válido y confirmar el correo si Supabase lo solicita.
- Iniciar sesión, cerrar sesión y probar recuperación de contraseña.
- Crear una comisión con código de acceso desde el módulo de gestión (la interfaz de creación de comisiones todavía debe completarse).
- Para probar inscripción, crear la comisión en Supabase con `access_code` y estado `active`; luego ingresar ese código desde Mi cuenta.
- Para probar examen, crear una evaluación publicada asociada a esa comisión y asignarle cinco casos en `glp_exam_cases` con posiciones 1 a 5.

## Limitaciones conocidas (no ocultas)
- El panel docente todavía no incluye el constructor visual de comisiones/evaluaciones ni la bandeja de corrección. La estructura SQL ya existe, pero la administración completa es trabajo pendiente.
- La rúbrica de 100 puntos (20 reconocimiento, 15 áreas, 25 muestras/tubos, 20 preanalítica, 20 criterio) y el circuito de devolución/reenvío requieren la siguiente integración de interfaz. La entrega actual guarda las cinco respuestas, pero no califica automáticamente.
- La cuota de visitantes no se aplica aún: para que sea resistente a manipulación requiere Edge Function y controles antiabuso.
- La política de consulta de GuiaLab está almacenada en la evaluación; esta beta todavía no bloquea ni habilita el enlace según esa preferencia.
- No hay pagos ni emisión de constancias.

## Seguridad
- Los usuarios nuevos se crean como `free`. El navegador no puede asignar nivel `teacher`, `institution` o `admin`; el trigger de migración bloquea cambios de nivel por usuarios comunes.
- No subir pedidos con datos identificatorios reales.
- Storage de imágenes se mantiene privado y usa enlaces temporales.

Pedidos anonimizados o ficticios para uso didáctico.


## Corrección 1.3.1
- Los botones de crear cuenta e iniciar sesión ejecutan acciones explícitas por click y submit.
- Se muestran errores de Supabase y excepciones inesperadas en el formulario.
- Se actualizó la caché del Service Worker para forzar la descarga de los archivos de esta versión.
- Se mantiene la misma estructura de tablas y migraciones: no ejecutar SQL adicional para esta corrección.
