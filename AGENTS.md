# Regla Obligatoria Permanente: Sincronización Automática Total (Versiones, Changelog, Develop, GitHub, Cloudflare, App Desktop)

Esta regla es de cumplimiento estricto y mandatorio para el asistente de IA (Antigravity / Gemini) en este proyecto, **independientemente de que el usuario lo solicite explícitamente o no en cada mensaje**.

---

## Mandato de Sincronización Automática

Cada vez que se complete cualquier modificación de código, reparación de errores, ajuste de cálculos, actualización de interfaz o nueva funcionalidad en la aplicación:

### 1. Actualización de Versión y Registro de Changelog (Memoria y UI)
Es estrictamente obligatorio mantener la trazabilidad de versiones antes de compilar y desplegar:
- **Incrementar Versión SemVer:** En `package.json` y sincronizar en `src/core/appVersion.ts` (patch para fixes/ajustes menores, minor para nuevas funcionalidades o módulos visuales).
- **Documentar en `CHANGELOG.md`:** Registrar los cambios notables en la sección de la nueva versión siguiendo rigurosamente el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) con fecha actual.
- **Registrar en `src/core/versionHistory.ts`:** Incorporar la nueva versión en el arreglo `VERSION_HISTORY` con su título, estado (`CURRENT`), tipo (`patch` o `minor`) y `highlights` detallados, para que los usuarios puedan consultarlo directamente en la interfaz de la aplicación (*Configuración -> Historial de Versiones*).

### 2. Compilar y Empaquetar Artefactos de Actualización
Ejecutar el pipeline de preparación de despliegue:
```bash
npm run prepare:pages
```
Este script ejecuta de forma automática:
- Sincronización de versión en todo el código fuente y encabezados nativos.
- Extracción de metadatos de Git (`scripts/generate_build_info.js`): Hash corto del commit, fecha ISO y notas de release.
- Compilación del bundle portable single-file (`desktop_build.html` ~5 MB) y sincronización a `dist_exe/GravityDesktop/_internal/index.html` y `desktop_app/index.html`.
- Compilación de la versión web chunked para navegador en `dist-pages/`.
- Sincronización de `version.json` en todas las carpetas correspondientes (`public/`, `dist-pages/`, `desktop_app/`, `dist_exe/`).

### 3. Despliegue en la Nube CDN de Cloudflare Pages
Desplegar inmediatamente los nuevos artefactos en el alias oficial de la rama develop:
```bash
npx wrangler pages deploy dist-pages --project-name=cisco-automated --branch develop
```
*(o mediante el comando unificado `npm run deploy:preview`)*.  
Esto asegura que el bundle `desktop_build.html` y `version.json` queden disponibles de inmediato en `https://develop.cisco-automated.pages.dev` para que los usuarios de la App Desktop puedan actualizarse en caliente en 1 solo clic.

### 4. Sincronización y Push a GitHub (Rama `develop` y `main`)
- Comprobar estado con `git status`.
- Agregar todos los cambios de código, especificaciones y metadatos actualizados (`git add -A`).
- Realizar el commit con un mensaje convencional claro referenciando la versión (ej. `feat(v2.5.0): ...`, `fix(v2.4.8): ...`).
- Subir inmediatamente a GitHub en `develop`:
```bash
git push origin develop
```
- Sincronizar con `main` mediante fast-forward merge y push:
```bash
git checkout main; git merge develop --ff-only; git push origin main; git checkout develop
```

### 5. Verificación de Integridad
- Comprobar que el árbol de trabajo quede completamente limpio: `nothing to commit, working tree clean`.
- Confirmar que la rama local `develop` esté al día con `origin/develop`.

---
> **Regla de Cierre:** Ninguna tarea de código se considera terminada hasta que el ciclo anterior (Versión + Changelog + Compilación + Deploy Cloudflare + Git Commit & Push develop + Merge main) se haya ejecutado y verificado satisfactoriamente.
