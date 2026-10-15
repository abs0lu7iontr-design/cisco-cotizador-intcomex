# Regla Obligatoria Permanente: Sincronización Automática Total (Develop, GitHub, Cloudflare, App Desktop)

Esta regla es de cumplimiento estricto y mandatorio para el asistente de IA (Antigravity / Gemini) en este proyecto, **independientemente de que el usuario lo solicite explícitamente o no en cada mensaje**.

---

## Mandato de Sincronización Automática

Cada vez que se complete cualquier modificación de código, reparación de errores, ajuste de cálculos, actualización de interfaz o nueva funcionalidad en la aplicación:

### 1. Compilar y Empaquetar Artefactos de Actualización
Ejecutar el pipeline de preparación de despliegue:
```bash
npm run prepare:pages
```
Este script ejecuta de forma automática:
- Extracción de metadatos de Git (`scripts/generate_build_info.js`): Hash corto del commit, fecha ISO y notas de release.
- Compilación del bundle portable single-file (`desktop_build.html` ~5 MB) y sincronización a `dist_exe/GravityDesktop/_internal/index.html` y `desktop_app/index.html`.
- Compilación de la versión web chunked para navegador en `dist-pages/`.
- Sincronización de `version.json` en todas las carpetas correspondientes (`public/`, `dist-pages/`, `desktop_app/`, `dist_exe/`).

### 2. Despliegue en la Nube CDN de Cloudflare Pages
Desplegar inmediatamente los nuevos artefactos en el alias oficial de la rama develop:
```bash
npx wrangler pages deploy dist-pages --project-name=cisco-automated --branch develop
```
*(o mediante el comando unificado `npm run deploy:preview`)*.  
Esto asegura que el bundle `desktop_build.html` y `version.json` queden disponibles de inmediato en `https://develop.cisco-automated.pages.dev` para que los usuarios de la App Desktop puedan actualizarse en caliente en 1 solo clic.

### 3. Sincronización y Push a GitHub (Rama `develop`)
- Comprobar estado con `git status`.
- Agregar todos los cambios de código, especificaciones y metadatos actualizados (`git add -A`).
- Realizar el commit con un mensaje convencional claro (`feat: ...`, `fix: ...`, `chore: ...`).
- Subir inmediatamente a GitHub:
```bash
git push origin develop
```

### 4. Verificación de Integridad
- Comprobar que el árbol de trabajo quede completamente limpio: `nothing to commit, working tree clean`.
- Confirmar que la rama local `develop` esté al día con `origin/develop`.

---
> **Regla de Cierre:** Ninguna tarea de código se considera terminada hasta que el ciclo anterior (Compilación + Deploy Cloudflare + Git Commit & Push develop) se haya ejecutado y verificado satisfactoriamente.
