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
