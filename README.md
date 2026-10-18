# Cisco Automated v4.0 (Enterprise Suite v2.2.0)
### Intcomex Chile | Aplicación Híbrida Web Standalone, Cloud CDN & Desktop Portable con IA

[![React 19](https://img.shields.io/badge/React-19.0.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.1-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![ExcelJS](https://img.shields.io/badge/ExcelJS-4.4.0-217346?logo=microsoft-excel&logoColor=white)](https://github.com/exceljs/exceljs)
[![Cloud Firestore](https://img.shields.io/badge/Cloud%20Firestore-12.18.0-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-CDN%20Global-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20GenAI-Gemini%203.6%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![PyWebView](https://img.shields.io/badge/PyWebView-5.4-3776AB?logo=python&logoColor=white)](https://pywebview.flowrl.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Descripción General

**Cisco Automated v4.0** es la suite de ingeniería de preventa y operaciones comerciales desarrollada para **Intcomex Chile**. Automatiza de principio a fin el ciclo de cotización CCW, ajuste de precios inverso (Goal Seek), auditoría de promociones Fast Track, generación de matrices oficiales DSV de 48 columnas, configuración de arquitecturas con IA, seguimiento logístico de compras (Back Order), sistema dual de versionamiento y mesa de ayuda técnica con triaje asistido por IA.

---

## 📅 Historial y Tabla de Versiones del Software (Version History)

El proyecto mantiene un registro semántico y auditable de cada versión y compilación desplegada:

| Versión | Commit | Fecha | Hitos y Novedades Principales | Canal |
|---|---|---|---|---|
| **v2.2.0** | `260bdfa` | Octubre 2026 | **Sincronización Dinámica de Versiones:** Centralización de versión en `src/core/appVersion.ts`, scripts de SemVer (`scripts/version_manager.js`) para actualizaciones chicas y grandes, **Módulo de Mejoras y Soporte Técnico** con triaje y diagnóstico de IA (Gemini 3.6 Flash / OpenRouter), SLA dinámico y Firestore Colección 11. Transición automática a Back Order (BO), catálogo permanente de SKUs manuales en Firestore (`cisco_bo_sku_catalog`), pipeline logístico Kanban (`bo_order_tracking`) con FedEx/UPS/DHL, recordador de Deals escalados (`deal_reminders`), auto-updater de 1-clic para Desktop con Cloudflare CDN, y despliegue de reglas Cloud Firestore. | **develop (Producción Oficial)** |
| **v2.1.0** | `7b4d35e` | Octubre 2026 | Integración inicial del módulo de Mejoras y Soporte Técnico, botón de acceso en Navbar y despliegue de reglas Firestore. | develop |
| **v2.0.8** | `2fa53d0` | Octubre 2026 | Motor de actualización en caliente de 1-clic para la App Desktop Windows mediante lectura de `version.json` en Cloudflare Pages CDN. | develop |
| **v2.0.7** | `c58d432` | Octubre 2026 | Multi-Versionamiento de Cotizaciones CCW (`estimates/{id}/versions/{vId}`) con versión base `v0_RAW` inmutable y modal comparador de versiones. | develop |
| **v2.0.6** | `2667366` | Octubre 2026 | Arquitectura Database Armor con bóveda redundante multi-capa (LocalStorage Vault + IndexedDB `CiscoAppCollectionsDB` + Tombstones `deleted_ids`). | develop |
| **v2.0.5** | `17b5126` | Octubre 2026 | Indicadores oficiales en vivo de Banco Central de Chile (USD / UF) con spread comercial preventivo de +10 CLP para cotizaciones en moneda local. | develop |
| **v2.0.4** | `723ffff` | Octubre 2026 | Regla estricta de Lead Time Miami (175 días corridos = 27 semanas de entrega) con anti-degradación idempotente y snapshot `sys_metadata`. | develop |
| **v2.0.3** | `e00c3a0` | Octubre 2026 | Clasificación de accesorios en Líneas Madre $N.0$ (Cámaras Meraki `MV*`, Sensores `MT*`, Teléfonos IP `CP-*/DP-*`, Webex Room Bar `CS-*`) con Arancel Aduanero del 6.0%. | develop |
| **v2.0.2** | `34a89c4` | Octubre 2026 | Cascada de IA con Google Gemini 3.6 Flash para ConfigurIAtor con fallback a OpenRouter y motor heurístico determinista offline. | develop |
| **v2.0.1** | `6b00ee7` | Octubre 2026 | Sincronización en la nube del catálogo Fast Track mediante particionado en bloques (chunks) en `cisco_fast_track_catalog`. | develop |
| **v2.0.0** | `42a385e` | Septiembre 2026 | Lanzamiento inicial v2.0: Cotizador CCW con Goal Seek, Generador DSV 48 columnas, Auditor Fast Track en IndexedDB y wrapper Desktop PyInstaller. | develop |

---

## 🔄 Sistema Dual de Versionamiento

La plataforma resuelve el control de versiones en dos capas especializadas:

### 1. Versionamiento del Software y Auto-Deploy en Caliente
- **Metadatos en Tiempo de Build:** El script `scripts/generate_build_info.js` extrae el hash del commit de Git, fecha/hora exacta en ISO y local, y notas del release, inyectándolos en `version.json`.
- **Despliegue Inmediato en Cloudflare Pages CDN:** Disponible en [https://develop.cisco-automated.pages.dev/version.json](https://develop.cisco-automated.pages.dev/version.json).
- **Auto-Updater de 1-Clic para Desktop:** La app de escritorio detecta nuevas compilaciones en la nube y se actualiza en caliente sin reinstalar el ejecutable.
- **Panel de Control en Ajustes (`SettingsView.tsx`):** Muestra el commit activo, timestamp y tiempo relativo transcurrido.

### 2. Versionamiento Comercial de Cotizaciones (Estimate Multi-Versioning)
- **Subcolección en Cloud Firestore:** `estimates/{estimateId}/versions/{versionId}`.
- **Versión Base Inmutable (`v0_RAW`):** Preserva el archivo original subido intacto para auditorías.
- **Revisiones Comerciales (`v1`, `v2`...):** Guardado de versiones derivadas tras aplicar descuentos, Goal Seek o promociones.
- **Modal de Comparación:** Permite comparar variaciones de margen y precios línea por línea entre versiones, con opción de rollback en 1 clic.

---

## 🛠️ Módulo Destacado: Mejoras, Reporte de Errores y Soporte con Asesor IA

Accesible de forma permanente en la barra superior (botón violeta **"Mejoras & Soporte"** con ícono de salvavidas), este módulo conecta a los usuarios comerciales con el equipo de ingeniería:

1. **Gestión Integral de Tickets (`app_feedback_tickets` en Firestore):**
   - Categorización por tipo: `BUG`, `IMPROVEMENT`, `FEATURE_REQUEST`, `UX_UI`, `DATA_CATALOG`, `OTHER`.
   - Control de SLA dinámico: **4 horas** (Crítico), **24 horas** (Alto), **72 horas** (Medio), **120 horas** (Bajo), con estados `ON_TIME`, `NEAR_BREACH` y `BREACHED`.
   - Captura técnica automática del estado del sistema: commit de Git, versión, entorno (Web/Desktop) y vista activa.
   - Adjuntos visuales y pegado de capturas de pantalla (`Ctrl + V`).

2. **Triaje y Asesor de Soluciones con Inteligencia Artificial (`aiFeedbackAdvisor.ts`):**
   - El motor de IA analiza cada ticket y entrega:
     - **Veredicto de Factibilidad:** `YES` / `CONDITIONAL` / `NO` (indica claramente si lo solicitado es viable en la arquitectura actual).
     - **Diagnóstico de Causa Raíz:** Explicación técnica detallada del origen del problema o requerimiento.
     - **Propuesta de Solución Técnica:** Pasos de implementación técnica y archivos afectados.
     - **Estimación de Esfuerzo:** `Bajo (1-2h)`, `Medio`, `Alto` o `Complejo`.
     - **Respuesta Lista para el Usuario:** Texto cordial y profesional listo para enviar como retroalimentación.
   - **Regla Estricta de Seguridad:** La IA **NO MODIFICA CÓDIGO** automáticamente. Su rol es actuar como asesor de ingeniería para que el equipo humano valide y apruebe las soluciones antes de desplegarlas.
   - Incluye botones directos: *"Usar como Respuesta al Usuario"*, *"Copiar Dictamen"* y *"Re-analizar con IA"*.

---

## ✨ Los 11 Módulos Principales del Sistema

1. **Cotizador Comercial CCW Cisco (Estimate Engine):**
   - Clasificación multinivel (Hardware, Intangibles, Accesorios con Arancel en Líneas Madre $N.0$, cables `CAB-*`).
   - Fórmula de margen real sobre ventas (Divisor $1 - M$).
   - Goal Seek equitativo con **Arancel Aduanero (6.0%) blindado e intocable 🔒**.
   - Lead Time Miami (175 días / 27 semanas) anti-degradación con snapshot `sys_metadata`.
   - Excel oficial Intcomex de 7 columnas y resumen enriquecido para correo Outlook.
2. **Generador Oficial Cisco DSV (48 Columnas):** Matriz oficial A-AV, Col J y K calculadas, contratos `CON-` anualizados y filtro estricto de Col O (`LIST_PRICE > 0`).
3. **Auditor y Catálogo Fast Track:** Doble almacenamiento (IndexedDB + Firestore `cisco_fast_track_catalog`) y alerta interactiva de margen.
4. **AI ConfigurIAtor:** Creación de BOMs desde lenguaje natural con cascada de modelos (Gemini 3.6 Flash / OpenRouter / Heurístico) y plantillas maestras.
5. **Gestión de Back Order (BO) y Catálogo de SKUs Manuales:** Transición directa desde Estimate/DSV a compra y persistencia en `cisco_bo_sku_catalog`.
6. **Logística de Fulfillment y Seguimiento (`bo_order_tracking`):** Tablero Kanban de 6 etapas y tracking directo de guías FedEx, UPS y DHL.
7. **Notificador y Recordador de DEALS Escalados (`deal_reminders`):** Monitoreo de Deals en AM Cisco / Velocity Hub con alertas automáticas (12:00 y 17:30).
8. **Módulo de Mejoras y Soporte Técnico:** Sistema de tickets con SLA y triaje de IA.
9. **Historial Analítico y Multi-Versionamiento:** Subcolección `versions` con versión base `v0_RAW` inmutable y modal comparador.
10. **Multi-Moneda en Vivo (Banco Central de Chile):** Tipo de cambio USD y UF en vivo con spread preventivo de **+10 CLP**.
11. **Ecosistema Multi-Entorno y Auto-Updater de 1-Clic:** Web CDN en Cloudflare Pages y ejecutable Windows portable con actualización en caliente.

---

## 🗄️ Arquitectura de Persistencia y Base de Datos (11 Colecciones)

```text
1.  estimates                  -> Cotizaciones CCW maestras
    └── versions               -> Subcolección de versiones comerciales (v0_RAW..vN)
2.  dsv_records                -> Órdenes DSV de 48 columnas emitidas
3.  users                      -> Usuarios RBAC con hash SHA-256 (admin, pm, user, viewer)
4.  shared_sku_rules           -> Overrides comunitarios de clasificación de SKUs
5.  partner_custom_params      -> Perfiles comerciales por Partner
6.  partners_xcl               -> Catálogo de clientes y códigos XCL de Intcomex
7.  cisco_bo_sku_catalog       -> Catálogo persistente de SKUs manuales de Back Order
8.  bo_order_tracking          -> Fulfillment de órdenes BO y etapas logísticas Kanban
9.  cisco_fast_track_catalog   -> Catálogo Fast Track sincronizado por bloques (chunks)
10. deal_reminders             -> Recordatorios y seguimiento de Deals escalados
11. app_feedback_tickets       -> Tickets de soporte, mejoras y diagnósticos IA
```

---

## 🚀 Comandos de Construcción y Despliegue

```bash
# Iniciar entorno de desarrollo local
npm run dev

# Compilar aplicación y preparar artefactos de despliegue
npm run prepare:pages

# Desplegar en la nube (Cloudflare Pages develop)
npm run deploy:preview

# Compilar ejecutable nativo de escritorio para Windows
npm run build:desktop
# Genera: dist/Cotizador-Cisco-Intcomex-Portable.exe y dist_exe/GravityDesktop/
```

---

## 📄 Licencia y Documentación Maestra

- **Licencia:** MIT License.
- **Especificación Técnica Completa y Master Prompt:** Ver [`INFORME_TECNICO_RECREACION_COTIZADOR_CISCO.md`](INFORME_TECNICO_RECREACION_COTIZADOR_CISCO.md).
- **Historial Detallado de Cambios:** Ver [`RELEASE_NOTES.md`](RELEASE_NOTES.md).