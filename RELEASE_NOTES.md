# HISTORIAL DE VERSIONES Y NOTAS DE RELEASE (RELEASE NOTES)
## Cisco Automated v2.2.0 (Arquitectura Enterprise Suite v4.0)
### Intcomex Chile

---

## 📅 Tabla General de Versiones y Releases

| Versión | Commit Principal | Fecha / Periodo | Hitos y Cambios Arquitectónicos Principales | Estado |
|---|---|---|---|---|
| **v2.2.0 (Enterprise)** | `260bdfa` | Octubre 2026 | **Sincronización Dinámica de Versiones:** Centralización de versión en `src/core/appVersion.ts`, scripts automáticos de SemVer (`scripts/version_manager.js`) para actualizaciones chicas (`patch`) y grandes (`minor`/`major`), y eliminación de versiones estáticas en todo el código. **Módulo de Mejoras & Soporte** con triaje y diagnóstico de IA (Gemini 3.6 Flash / OpenRouter), SLA dinámico y Firestore Col 11. Transición automática a Back Order (BO), catálogo de SKUs manuales en Firestore (`cisco_bo_sku_catalog`), pipeline logístico Kanban (`bo_order_tracking`) con FedEx/UPS/DHL, recordador de Deals escalados (`deal_reminders`), auto-updater de 1-clic para Desktop con Cloudflare CDN, y despliegue de reglas Cloud Firestore. | **VIGENTE / PRODUCCIÓN** |
| **v2.1.0** | `7b4d35e` / `511c934` | Octubre 2026 | Integración inicial del módulo de Mejoras y Soporte Técnico, botón de acceso en Navbar y despliegue de reglas Firestore. | Predecesora Estable |
| **v2.0.8** | `2fa53d0` | Octubre 2026 | Implementación del motor de auto-actualización en caliente de 1-clic para la App de Escritorio Windows conectado a `version.json` en Cloudflare CDN. | Estable |
| **v2.0.7** | `c58d432` | Octubre 2026 | Sistema de Multi-Versionamiento de Cotizaciones CCW (`estimates/{id}/versions/{vId}`) con `v0_RAW` inmutable y modal comparador de versiones. | Estable |
| **v2.0.6** | `2667366` | Octubre 2026 | Arquitectura Database Armor con bóveda redundante multi-capa (LocalStorage Vault + IndexedDB `CiscoAppCollectionsDB` + Tombstones `deleted_ids`). | Estable |
| **v2.0.5** | `17b5126` | Octubre 2026 | Integración de indicadores oficiales de Banco Central de Chile (USD / UF) con spread comercial preventivo de +10 CLP para cotizaciones en moneda local. | Estable |
| **v2.0.4** | `723ffff` | Octubre 2026 | Regla estricta de Lead Time Miami (175 días corridos = 27 semanas de entrega) con anti-degradación idempotente y snapshot `sys_metadata`. | Estable |
| **v2.0.3** | `e00c3a0` | Octubre 2026 | Clasificación de accesorios en Líneas Madre $N.0$ (Cámaras Meraki `MV*`, Sensores `MT*`, Teléfonos IP `CP-*/DP-*`, Webex Room Bar `CS-*`) con Arancel Aduanero del 6.0%. | Estable |
| **v2.0.2** | `34a89c4` | Octubre 2026 | Cascada de IA con Google Gemini 3.6 Flash para ConfigurIAtor con fallback a OpenRouter y motor heurístico determinista offline. | Estable |
| **v2.0.1** | `6b00ee7` | Octubre 2026 | Sincronización en la nube del catálogo Fast Track mediante particionado en bloques (chunks) en `cisco_fast_track_catalog`. | Estable |
| **v2.0.0** | `42a385e` | Septiembre 2026 | Lanzamiento inicial v2.0: Cotizador CCW con Goal Seek, Generador DSV 48 columnas, Auditor Fast Track en IndexedDB y wrapper Desktop PyInstaller. | Predecesora |

---

## [v2.2.0] - Octubre 2026 (Enterprise Release Actual)

### 🔄 Sincronización Dinámica de Versiones y SemVer Automático
- **Única Fuente de Verdad (`src/core/appVersion.ts`):** Eliminación de versiones hardcodeadas estáticas en el frontend, bridge de escritorio y servicios en la nube. Todas las vistas (`SettingsView`, `Sidebar`, `App`, `feedbackService`, `databaseBackupManager`, `desktopBridge`) leen de forma dinámica `APP_VERSION` y `getFormattedAppVersion()`.
- **Motor Inteligente de Versiones (`scripts/version_manager.js`):** Analiza los mensajes de commits y la envergadura del cambio para determinar si es una actualización chica (`patch`, ej: `2.2.1`) o grande (`minor`, ej: `2.3.0` o `major` `3.0.0`).
- **Nuevos Scripts en `package.json`:** `npm run version:bump:patch`, `npm run version:bump:minor`, `npm run version:bump:major`, `npm run version:sync`.
- **Sincronización Transversal en Build:** En cada compilación `prepare:pages`, se regeneran automáticamente `version.json` en todas las carpetas (`public/`, `dist/`, `desktop_app/`, `dist_exe/`) y el runtime desktop `desktop_window.py`.

---

## [v2.1.0] - Octubre 2026 (Lanzamiento Predecesor)

### 🚀 Módulo Destacado: Mejoras, Reporte de Errores y Soporte Técnico con Triaje IA
- **Bandeja Centralizada de Tickets (`app_feedback_tickets` en Firestore):**
  - Registro estructurado de solicitudes de usuarios clasificados en 6 categorías: `BUG` (error técnico), `IMPROVEMENT` (optimización existente), `FEATURE_REQUEST` (nueva función), `UX_UI` (diseño y visualización), `DATA_CATALOG` (reglas o SKUs) y `OTHER` (consultas generales).
  - **SLA Dinámico por Prioridad:**
    - `CRITICAL`: 4 horas (bloqueo de cálculos comerciales o bases de datos).
    - `HIGH`: 24 horas (falla severa sin workaround ágil).
    - `MEDIUM`: 72 horas (mejora relevante o problema menor).
    - `LOW`: 120 horas (sugerencia estética o idea futura).
    - Indicadores de tiempo real de SLA: `ON_TIME` (en plazo), `NEAR_BREACH` (en riesgo, menos del 25% restante) y `BREACHED` (plazo vencido).
  - **Captura Técnica Automática:** Incluye hash de commit de Git, versión de la app, entorno (Web/Desktop), resolución de pantalla y vista activa al momento del reporte.
  - **Adjuntos Visuales:** Soporte para adjuntar y pegar imágenes (`Ctrl + V`) directamente en el modal de creación.
- **Asesor de Soluciones y Triaje con Inteligencia Artificial (`aiFeedbackAdvisor.ts`):**
  - Cascada multi-modelo (Google Gemini 3.6 Flash primario, OpenRouter secundario, heurístico determinista offline).
  - **Dictamen Estructurado:**
    1. *Factibilidad:* Veredicto claro (`YES` / `CONDITIONAL` / `NO`) indicando si es viable realizar lo que solicita el usuario.
    2. *Diagnóstico de Causa Raíz:* Explicación técnica detallada de por qué ocurre el error o cómo funciona el flujo actual.
    3. *Propuesta de Solución Técnica:* Plano de diseño e ingeniería paso a paso, archivos a intervenir e impacto técnico.
    4. *Estimación de Esfuerzo:* `Bajo (1-2h)`, `Medio`, `Alto` o `Complejo`.
    5. *Respuesta Recomendada al Usuario:* Texto cordial y profesional listo para enviar como feedback.
  - **Directiva Estricta de No Modificación:** La IA formula la propuesta técnica y el dictamen de factibilidad sin aplicar modificaciones automáticas en el código fuente, garantizando el control del equipo de ingeniería.
  - **Acciones Rápidas:** Botón *"Usar como Respuesta al Usuario"*, *"Copiar Dictamen"* y *"Re-analizar con IA"*.
- **Acceso Inmediato en Navbar:** Botón violeta dedicado con icono de salvavidas integrado en la barra de navegación superior para máxima accesibilidad.

---

### 🔄 Sistema Dual de Versionamiento
1. **Versionamiento del Software y Auto-Deploy en Caliente:**
   - Script de build `scripts/generate_build_info.js` sincronizado con metadatos de Git.
   - Publicación automática de `version.json` en Cloudflare Pages CDN.
   - Auto-updater de 1-clic para la versión Desktop de Windows sin requerir instaladores externos.
   - Panel de control en `SettingsView.tsx` con hora local chilena y antigüedad del despliegue.
2. **Versionamiento Comercial de Cotizaciones:**
   - Subcolección `estimates/{estimateId}/versions/{versionId}` en Cloud Firestore.
   - Versión original inmutable `v0_RAW` para respaldo y auditoría permanente.
   - Generación de revisiones comerciales (`v1`, `v2`, etc.) al aplicar Goal Seek o descuentos.
   - Modal comparador lado a lado con variaciones de margen y precios línea por línea.

---

### 📦 Gestión de Back Order (BO) y Fulfillment Logístico
- **Transición Automática:** Al copiar el correo comercial o generar el archivo DSV, la cotización se marca automáticamente como aceptada por el cliente y se transiciona al estado de Back Order.
- **Catálogo de SKUs Manuales (`cisco_bo_sku_catalog`):** Persistencia permanente en Cloud Firestore de SKUs ingresados manualmente, evitando su pérdida entre sesiones o actualizaciones.
- **Tablero Kanban de Fulfillment (`bo_order_tracking`):** 6 etapas logísticas (`PO_RECIBIDA`, `ORDENADA_CISCO`, `TRANSITO_MIAMI`, `EN_ADUANA_CHILE`, `EN_BODEGA_INTCOMEX`, `ENTREGADO_CLIENTE`) con rastreo de guías FedEx, UPS y DHL.
- **Notificador de Deals Escalados (`deal_reminders`):** Monitoreo de Deals en revisión por Account Managers de Cisco o Velocity Hub, con alertas automáticas programadas (12:00 y 17:30) y generación de correos con respaldo offline.

---

### 📐 Cálculos Comerciales, Moneda y Clasificación
- **Lead Time Miami (175 días / 27 semanas):** Regla anti-degradación idempotente y snapshot canónico en `sys_metadata` de Excel.
- **Accesorios en Líneas Madre $N.0$:** Aplicación de Arancel Aduanero del 6.0% a Cámaras Meraki (`MV*`), Sensores (`MT*`), Telefonía IP (`CP-*/DP-*`) y terminales Webex Room Bar (`CS-*`).
- **Cables `CAB-*`:** Clasificación fiel en sublíneas (Tangibles sin `=`, Arancel con `=`).
- **Multi-Moneda en Vivo:** Integración de Dólar Observado y UF de Banco Central de Chile con spread comercial de **+10 CLP** sobre el dólar interbancario.

---

### 🛡️ Seguridad y Database Armor
- Despliegue oficial de reglas de seguridad en Cloud Firestore para las 11 colecciones.
- Bóveda de almacenamiento redundante multi-capa (LocalStorage Vault + IndexedDB `CiscoAppCollectionsDB` + Tombstones de eliminación).
- Autenticación custom RBAC con SHA-256 salted hashes.
