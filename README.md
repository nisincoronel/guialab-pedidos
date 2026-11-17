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


## Formulario interactivo (práctica abierta)
La biblioteca continúa siendo pública para visitantes: no se exige cuenta de alumno. Al abrir un caso, el usuario puede agregar filas por determinación y completar área, muestra, tubo/aditivo y notas preanalíticas. El catálogo permite autocompletar algunos campos al seleccionar una determinación conocida.

**Alcance de corrección de esta entrega:** el RPC existente `glp_evaluate_case` sigue corrigiendo por coincidencia de determinaciones esperadas. Los demás campos del formulario se envían junto con la respuesta, pero todavía no tienen puntuación automática individual. No se modificó el esquema SQL ni se requiere volver a ejecutarlo.


## GuiaLab Pedidos 1.0
Esta versión separa responsabilidades: GuiaLab Pedidos es el entorno de práctica y GuiaLab (https://guialab.net.ar/) es la fuente de consulta técnica. Se eliminó la copia local del catálogo de determinaciones para evitar duplicación y divergencia. El alumno puede abrir GuiaLab en otra pestaña mientras resuelve.

### Modalidad
- Práctica abierta: no se exige cuenta de alumno.
- El docente mantiene acceso autenticado mediante Supabase.
- La biblioteca muestra solamente casos publicados.
- El alumno resuelve cada determinación en una fila con nombre, área, muestra y tubo/aditivo; además completa campos de preparación, condiciones especiales y observaciones.
- Las imágenes se sirven desde el bucket privado mediante URLs firmadas.

### Alcance de corrección
La función existente `glp_evaluate_case` compara los términos esperados configurados por el docente con el texto enviado y devuelve una puntuación de reconocimiento de determinaciones. En esta entrega, área, muestra, tubo/aditivo y respuestas preanalíticas se capturan en la resolución, pero NO reciben puntuación automática independiente. Deben revisarse con la devolución docente/transcripción. No se presenta el resultado como evaluación integral de competencia.

### Configuración
No ejecutar nuevamente `supabase_schema.sql` si el proyecto ya tiene las tablas creadas. `config.js` debe conservar Project URL y Publishable key. Nunca publicar una secret/service_role key.
