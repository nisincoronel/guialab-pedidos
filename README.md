# GuiaLab Pedidos 1.6.0 beta

Aplicación educativa PWA para GitHub Pages + Supabase. Mantiene la estructura de archivos web en la raíz del repositorio y conserva la biblioteca, comisiones y evaluaciones de la versión 1.5.0.

## Novedades 1.6.0

- Un intento diario para visitantes con sesión anónima de Supabase.
- Tres intentos gratuitos diarios para cuentas registradas.
- Después del cupo gratuito, cada nueva práctica consume un crédito.
- Alumnos con membresía activa en una comisión vigente: prácticas ilimitadas sin consumir créditos.
- Al finalizar la comisión (fecha `ends_on` alcanzada), el alumno vuelve automáticamente al régimen gratuito. Si la comisión se archiva o se deshabilita la membresía, también deja de tener acceso ilimitado.
- Los créditos comprados u otorgados se conservan aunque termine la comisión.
- Saldo, contador diario e historial de movimientos en Mi cuenta.
- Herramienta docente para otorgar créditos manualmente por UUID.
- Tablas de paquetes y compras preparadas para integrar Mercado Pago.

## IMPORTANTE: migración

Esta versión requiere que las migraciones anteriores estén aplicadas. No vuelvas a ejecutar los esquemas iniciales ni las migraciones anteriores.

1. Conservá `config.js` tal como está. No reemplaces la URL ni la clave pública de Supabase.
2. En Supabase SQL Editor ejecutá **una sola vez** `migration_1_6.sql`, después de `migration_1_5.sql`.
3. En Supabase Authentication habilitá **Anonymous sign-ins** para permitir una práctica de visitante sin registro. La cuenta anónima se usa para identificar el intento diario.
4. Reemplazá los archivos web del repositorio con los del ZIP, manteniendo el contenido de `config.js`.
5. Esperá el despliegue de GitHub Pages y recargá con `Ctrl + Shift + R`.

## Reglas de acceso

| Perfil | Intentos gratuitos | Créditos |
|---|---:|---:|
| Visitante anónimo | 1 por día | No puede comprar; puede registrarse |
| Cuenta gratuita | 3 por día | Se usan al agotar el cupo diario |
| Alumno de comisión vigente | Ilimitados | No se descuentan |
| Docente administrador | Ilimitados | No se descuentan |

El día se calcula con la zona horaria `America/Argentina/Buenos_Aires`. El intento se consume al iniciar el caso, no al enviar la respuesta. Los créditos no vencen.

## Cómo termina el acceso de alumno

La autorización ilimitada se calcula en el servidor consultando la membresía y la comisión. Requiere que la membresía esté `active`, la comisión esté `active`, que la fecha de inicio haya llegado (si está definida) y que la fecha de finalización no haya pasado (si está definida). No se modifica manualmente el nivel del perfil para conseguirlo.

Al vencer o archivarse la comisión, el usuario pasa a la regla gratuita. El saldo de créditos no se borra.

## Créditos manuales

En Gestión educativa > Créditos de usuarios, ingresá el UUID del usuario, cantidad y motivo. La operación se valida en Supabase y queda en el historial. El docente debe obtener el UUID desde Authentication > Users.

## Mercado Pago: estado de esta versión

**Mercado Pago todavía no procesa pagos reales en esta beta.** Esta versión incorpora las tablas `glp_credit_packages` y `glp_purchases`, pero no activa Checkout Pro ni Webhooks. Para habilitar cobros reales falta desplegar Edge Functions de servidor, configurar Access Token y secreto de Webhook como secretos privados en Supabase, definir precios reales de los paquetes y probar pagos aprobados, rechazados, pendientes, devoluciones y notificaciones duplicadas.

No pegues el Access Token ni el secreto de Webhook en `config.js`, GitHub ni en archivos JavaScript públicos. La acreditación de créditos debe ocurrir exclusivamente después de verificar el pago en el servidor.

## Seguridad y límites

- El navegador no puede modificar el saldo ni los contadores directamente.
- Las funciones PostgreSQL realizan la autorización y el descuento en una transacción.
- Los créditos y movimientos son consultables por el propio usuario; las modificaciones se realizan mediante funciones protegidas.
- La limitación de visitantes usa identidad anónima. Como ocurre con cualquier sistema sin cuenta, borrar los datos del navegador o crear otra identidad puede permitir eludir el límite; el control de visitantes es menos fuerte que el asociado a una cuenta registrada.
- Los intentos se consumen al iniciar un caso. Abrir un caso y abandonarlo consume ese intento.
- No subir pedidos con datos identificatorios reales.

## Pruebas recomendadas después de la migración

1. Visitante nuevo: iniciar un pedido; el segundo inicio del día debe bloquearse.
2. Cuenta gratuita nueva: iniciar tres pedidos; el cuarto debe requerir un crédito.
3. Otorgar 2 créditos desde Gestión educativa; el usuario debe poder iniciar dos prácticas adicionales.
4. Alumno de comisión activa: iniciar prácticas sin consumir intentos ni créditos.
5. Cambiar `ends_on` de una comisión a una fecha pasada o archivar la comisión: el alumno debe volver al límite de 3 prácticas diarias y conservar sus créditos.
6. Verificar que dos intentos simultáneos no permitan gastar un mismo crédito dos veces.

## Archivos

- `migration_1_6.sql`: migración aditiva del sistema de acceso y créditos.
- `config.js`: configuración pública existente de Supabase; conservar.
- Los demás archivos web reemplazan la versión 1.5.0 beta.

## Base de determinaciones

El repositorio incluye `determinaciones.json`, una copia de la base de determinaciones aportada para el proyecto. En esta entrega queda disponible como archivo de datos para consulta e integración. **La interfaz actual de GuiaLab Pedidos todavía no carga este JSON automáticamente**: los casos y sus respuestas esperadas siguen gestionándose desde Gestión educativa. No considerar el archivo JSON como una fuente clínica validada; revisar muestra, tubo, ayuno y condiciones según el método y el procedimiento del laboratorio antes de usar esos datos en actividades.
