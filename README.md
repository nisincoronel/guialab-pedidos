# GuiaLab Pedidos 0.6

Aplicación educativa independiente para practicar lectura de pedidos de laboratorio a partir de imágenes anonimizadas. Mantiene la identidad visual de GuiaLab y utiliza el catálogo de determinaciones importado del proyecto original.

## Qué incluye

- Biblioteca común de pedidos publicados por el docente.
- Panel docente con acceso mediante Supabase Auth.
- Carga de fotografías JPG, PNG y WebP (máximo 8 MB antes de procesar).
- Reprocesamiento de imágenes en el navegador a JPEG para reducir tamaño y eliminar metadatos EXIF. Esto **no** elimina texto visible ni datos identificatorios impresos en la imagen.
- Campos de título, dificultad, formato, áreas, habilidades, consigna, transcripción docente, términos esperados y explicación.
- Borradores y publicación/despublicación de casos.
- Corrección en servidor mediante una función RPC; las claves de respuesta no se entregan al navegador del alumno.
- Catálogo de determinaciones con búsqueda y filtros.
- Diseño adaptable a computadoras y celulares.
- PWA con caché de la interfaz y del catálogo. La biblioteca de casos requiere conexión.

## Arquitectura

- GitHub Pages: aloja la interfaz estática.
- Supabase Auth: inicio de sesión docente.
- Supabase Database: casos y claves de corrección.
- Supabase Storage: fotografías anonimizadas.

## Configuración inicial de Supabase

1. Creá un proyecto en https://supabase.com/.
2. Abrí **SQL Editor** y ejecutá el archivo completo `supabase_schema.sql`.
3. En **Project Settings > API** (o Connect), copiá la Project URL y la clave pública `anon` / `publishable`.
4. Editá `config.js` y reemplazá los dos valores de ejemplo:

```js
window.GLP_CONFIG = {
  SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
  SUPABASE_ANON_KEY: "TU-CLAVE-PUBLICA-ANON"
};
```

La clave `anon` / `publishable` está diseñada para uso en navegador. **Nunca** coloques la clave `service_role` o una clave secreta en `config.js`, GitHub o cualquier archivo público.

5. En Supabase, abrí **Authentication > Users** y creá tu usuario docente con correo y contraseña. No habilites registro público de alumnos en esta versión.
6. Copiá el UUID de ese usuario y ejecutá en SQL Editor:

```sql
insert into public.glp_admins(user_id)
values ('PEGAR-UUID-DEL-USUARIO-DOCENTE');
```

7. Confirmá que el bucket `glp-pedidos` se haya creado al ejecutar el SQL. El bucket permite lectura pública porque las fotografías publicadas son material educativo común; solo los usuarios docentes autorizados pueden cargar, modificar o borrar archivos.

## Publicar en GitHub Pages

1. Descomprimí el ZIP.
2. Subí **todo el contenido** de esta carpeta a la raíz del repositorio `guialab-pedidos`, reemplazando los archivos anteriores.
3. Confirmá que `index.html`, `config.js`, `app.js`, `styles.css`, `supabase_schema.sql`, `manifest.json`, `sw.js`, `data/` y `assets/` queden directamente en la raíz o sus carpetas indicadas.
4. Hacé Commit changes.
5. Conservá la configuración actual de GitHub Pages y el dominio personalizado `pedidos.guialab.net.ar`.
6. Abrí `https://pedidos.guialab.net.ar` y recargá con Ctrl+F5.

## Cómo cargar un pedido

1. Abrí **Panel docente**.
2. Iniciá sesión con el usuario docente autorizado.
3. Seleccioná la fotografía y completá los datos del caso.
4. Escribí términos o determinaciones esperadas separados por coma.
5. Redactá una devolución docente.
6. Guardá como borrador o marcá la opción para publicar inmediatamente.

Los alumnos ven solamente los casos publicados en **Biblioteca**. La corrección se realiza mediante `glp_evaluate_case` en Supabase. Las claves no se consultan desde el navegador.

## Privacidad y uso responsable

- Cargá únicamente imágenes para las que tengas autorización de uso educativo.
- Anonimizá manualmente antes de subir: nombres, DNI, fechas de nacimiento, domicilios, teléfonos, números de historia clínica, códigos de barras, QR, números de afiliado, firmas y cualquier identificador.
- Revisá también los bordes, reversos, sellos, etiquetas y metadatos visibles.
- La aplicación vuelve a codificar la imagen para quitar metadatos EXIF, pero **no detecta ni borra automáticamente información personal visible**.
- Las imágenes del bucket son públicamente accesibles por URL. Por eso, nunca subas documentos clínicos identificables ni datos sensibles.
- No uses pedidos para tomar decisiones sobre pacientes. La herramienta es exclusivamente educativa.
- La corrección automática de esta versión busca coincidencias de términos, no evalúa semántica ni equivalencias complejas. El docente debe definir términos concretos y explicaciones claras.

## Límites de la versión 0.6

- No hay cuentas de alumnos ni seguimiento individual en servidor.
- El historial personal no está sincronizado entre dispositivos.
- No existe OCR ni interpretación automática de escritura.
- La corrección es una coincidencia textual básica con términos configurados por el docente.
- La biblioteca fotográfica requiere internet; el catálogo técnico se puede consultar desde caché cuando esté disponible.
- El catálogo de determinaciones es una fuente inicial y debe verificarse con los procedimientos, métodos y fabricantes aplicables.

## Archivos principales

- `index.html`: interfaz.
- `styles.css`: identidad visual y diseño adaptable.
- `app.js`: navegación, biblioteca, autenticación, carga y práctica.
- `config.js`: URL y clave pública de Supabase.
- `supabase_schema.sql`: tablas, permisos, bucket y función de corrección.
- `data/determinaciones.json`: catálogo importado.
- `assets/`: identidad gráfica GuiaLab.
- `manifest.json` y `sw.js`: instalación PWA y caché.


## Seguridad de imágenes (0.6)
El bucket de Storage es privado. Los casos publicados reciben URLs firmadas temporales; los borradores no quedan disponibles al público. Las imágenes se recodifican como JPEG en el navegador para eliminar metadatos EXIF. Esto no elimina información identificatoria visible en la imagen.
