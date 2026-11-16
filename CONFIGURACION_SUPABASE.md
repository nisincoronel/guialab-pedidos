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

7. Confirmá que el bucket `glp-pedidos` se haya creado al ejecutar el SQL. El bucket es **privado**: las imágenes de borradores no son públicas. La aplicación genera enlaces temporales para las imágenes de casos publicados; los docentes autorizados también pueden acceder a sus borradores.

**Antes de publicar fotografías:** verificá manualmente que no haya nombres, DNI, fechas de nacimiento, códigos de barras, números de historia clínica, etiquetas o cualquier otro dato identificatorio visible. La aplicación vuelve a codificar la imagen para quitar metadatos EXIF, pero no puede borrar texto que aparezca dentro de la foto.

