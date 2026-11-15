# GuiaLab Pedidos

PWA educativa independiente del proyecto principal GuiaLab.

## Publicar en GitHub Pages

Esta versión está preparada para publicarse como un sitio estático en GitHub Pages. Los archivos deben quedar en la **raíz del repositorio**, no dentro de otra carpeta.

1. En GitHub, creá un repositorio nuevo, por ejemplo `guialab-pedidos`.
2. Descomprimí este paquete en tu computadora.
3. Subí **todo el contenido** de esta carpeta al repositorio. En GitHub, al usar `Add file > Upload files`, seleccioná los archivos y carpetas interiores: `index.html`, `app.js`, `styles.css`, `data/`, `assets/`, etc.
4. Confirmá el commit en la rama `main`.
5. Abrí `Settings > Pages`.
6. En `Build and deployment`, elegí `Deploy from a branch`.
7. Seleccioná la rama `main` y la carpeta `/(root)`. Guardá.
8. Esperá a que GitHub Pages termine el despliegue. La dirección será similar a:
   `https://TU-USUARIO.github.io/guialab-pedidos/`

Cada vez que subas cambios a `main`, GitHub Pages actualizará el sitio.

## Probar localmente

No abras `index.html` con doble clic (`file://`), porque la biblioteca carga un archivo JSON mediante `fetch()`.

Con Python instalado, abrí una terminal en esta carpeta y ejecutá:

```bash
python -m http.server 8000
```

Después visitá `http://localhost:8000`.

## Archivos principales

- `index.html`: estructura y pantallas.
- `styles.css`: estilos visuales.
- `app.js`: navegación, simulador, corrección y biblioteca.
- `data/determinaciones.json`: catálogo inicial importado desde GuiaLab.
- `manifest.json`: configuración de instalación PWA.
- `sw.js`: caché y funcionamiento sin conexión.
- `assets/`: logo y recursos visuales.

## Importante sobre GitHub Pages y PWA

- El proyecto utiliza rutas relativas (`./`) para funcionar tanto en localhost como en una URL de proyecto de GitHub Pages.
- GitHub Pages publica el frontend estático. No proporciona por sí solo cuentas de usuario, base de datos privada, panel docente ni almacenamiento seguro de fotografías.
- El progreso de esta versión se guarda únicamente en el navegador del dispositivo mediante `localStorage`.
- No subir pedidos reales, fotografías clínicas, datos personales, credenciales, claves API ni archivos `.env` a este repositorio público.
- Los casos actuales son ficticios. El catálogo se reutiliza como referencia inicial y no está validado para emplearse como única fuente de decisiones técnicas.

## Alcance de esta versión

Prototipo frontend 0.1. Incluye inicio, simulador demostrativo, corrección, biblioteca y PWA básica. No incluye backend ni autenticación.
