# Registro de Cambios e Historial de Modificaciones (Changelog)

Todos los cambios notables y modificaciones de cada actualización en **Cisco Automated** están documentados en este archivo.

El formato se basa rigurosamente en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning (SemVer)](https://semver.org/lang/es/).

---

## [v2.2.5] - 2026-10-22
### 🌟 Agregado
- **Documentación Completa en GitHub (`README.md`):** Actualización integral de la portada del repositorio con los 11 módulos del ecosistema, arquitectura híbrida (Web Standalone + Desktop Portable), persistencia en las 11 colecciones de Google Cloud Firestore y guía de despliegue.
- **Historial Completo de Versiones (`CHANGELOG.md`):** Estandarización del registro de cambios siguiendo el formato internacional SemVer y Keep a Changelog.
- **Git Tags Oficiales:** Etiquetado de todas las versiones publicadas en el repositorio de GitHub para consulta en la pestaña *Releases / Tags*.

### 🎨 UI / UX
- **Alineación Ergonómica de Acciones Principales:** Reubicación de los botones *Subir Excel*, *Generar DSV* y *Descargar Excel* hacia el extremo izquierdo superior para un flujo de trabajo más natural y accesible.
- **Limpieza Minimalista:** Eliminación del logo secundario redundante de Intcomex Cisco Partner para despejar el encabezado de cotización.

---

## [v2.2.4] - 2026-10-22
### 🎨 UI / UX
- **Minimalismo en Barra de Navegación (Navbar):** Eliminación de botones redundantes de soporte y accesos dispersos en la barra superior.
- **Submenú Unificado "Configuración del Sistema" en Sidebar:** Consolidación de 5 áreas administrativas clave en una única ubicación accesible desde la barra lateral izquierda:
  1. *Reglas y Metodología CCW* (Fórmulas comerciales, Lead Time Miami, Aranceles).
  2. *Base de Partners XCL* (Códigos Intcomex y mapeo de resellers).
  3. *Reglas de SKUs* (Reclasificación comercial y reglas compartidas).
  4. *Catálogo Fast Track* (Promociones y auditoría de descuentos).
  5. *Mejoras & Soporte IA* (Bandeja de tickets y asistencia técnica con SLA).

---

## [v2.2.3] - 2026-10-22
### ⚡ Optimizado (Performance)
- **Descarga Instantánea de Cotizaciones Excel (<500ms):** Aceleración radical del proceso de descarga tras aplicar Goal Seek o modificaciones en la cotización, reduciendo los tiempos de espera de ~5-7 segundos a una respuesta inmediata.
- **Desacoplamiento Asíncrono de Guardado:** La sincronización con Google Cloud Firestore y la persistencia en caché local se desacoplaron del hilo principal mediante procesos en segundo plano no bloqueantes.

---

## [v2.2.2] - 2026-10-22
### 🛡️ Corregido (Bug Fixes)
- **Supresión Estricta de Hardware en Licenciamiento:** Corrección en el motor heurístico y los prompts de IA de **ConfigurIAtor** para evitar que se inyecten switches físicos (Catalyst / Meraki) o equipos de red cuando la solicitud del usuario es estrictamente de software o suscripciones.
- **Filtro Post-Procesamiento de Seguridad:** Verificación determinista que purga automáticamente hardware residual de las cotizaciones cuando la intención del usuario fue clasificada como 100% intangible.

---

## [v2.2.1] - 2026-10-22
### 🌟 Agregado
- **Cotización de Licencias Puras en ConfigurIAtor:**
  - Soporte nativo para suites de colaboración Webex Calling, Webex Meetings y paquetes Flex (`A-FLEX-*`, `A-SPK-*`).
  - Cisco Enterprise Agreement (EA) en Networking, Seguridad y Data Center.
  - Renovaciones de contratos de servicio SmartNet / SNTC (`CON-SNT-*`, `CON-SNTP-*`).
  - Soluciones de Ciberseguridad Cloud SaaS (Cisco Umbrella, Secure Endpoint / AMP, Duo Security).
  - Terminales de telefonía IP (`CP-88xx`, `CP-78xx`) y salas de videoconferencia Webex Room Bar (`CS-BAR-*`).

---

## [v2.2.0] - 2026-10-22
### 🔄 Agregado (Arquitectura Enterprise)
- **Sincronización Dinámica de Versiones (SemVer):**
  - Implementación de `src/core/appVersion.ts` como única fuente de verdad transversal para Web, Desktop y Cloud.
  - Scripts automáticos de SemVer en `scripts/version_manager.js` (`npm run version:bump:patch`, `npm run version:bump:minor`, `npm run version:bump:major`).
  - Eliminación de versiones estáticas hardcodeadas en todos los componentes del sistema.
  - Extracción automática de metadatos de Git (`scripts/generate_build_info.js`) inyectando commit corto, fecha ISO y notas de release en `version.json`.

---

## [v2.1.0] - 2026-10-22
### 🌟 Agregado
- **Módulo de Soporte Técnico, Reporte de Errores y Mejoras con Triaje IA:**
  - Bandeja centralizada de tickets en Firestore (`app_feedback_tickets`).
  - Asesor de Inteligencia Artificial (`aiFeedbackAdvisor.ts`) con cascada multi-modelo (Google Gemini 3.6 Flash, OpenRouter y heurístico offline).
  - Diagnóstico estructurado: Viabilidad técnica (`YES`/`CONDITIONAL`/`NO`), Causa Raíz, Solución Técnica Paso a Paso y Estimación de Esfuerzo.
  - Matriz de SLA dinámico con semáforo en tiempo real (`CRITICAL`: 4h, `HIGH`: 24h, `MEDIUM`: 72h, `LOW`: 120h).
  - Captura técnica automática (commit Git, versión, resolución, vista activa) y adjuntos de capturas con pegado `Ctrl + V`.
- **Reglas Cloud Firestore Col 11:** Despliegue de seguridad para la colección `app_feedback_tickets`.

---

## [v2.0.8] - 2026-10-22
### 🚀 Agregado
- **Auto-Actualizador Desktop de 1-Clic en Caliente:** Motor de actualización directa para la aplicación Windows sin necesidad de reinstalar ejecutables ni usar instaladores externos.
- **Distribución CDN Global:** Despliegue automático de bundles portables en Cloudflare Pages (`desktop_build.html` y `version.json`).

---

## [v2.0.7] - 2026-10-21
### 🌟 Agregado
- **Multi-Versionamiento Comercial de Cotizaciones:**
  - Persistencia de revisiones en subcolecciones de Firestore (`estimates/{id}/versions/{vId}`).
  - Versión base original `v0_RAW` inmutable para auditoría permanente y protección contra manipulaciones.
  - Modal comparador de versiones lado a lado con variaciones de margen y precios línea por línea.

---

## [v2.0.6] - 2026-10-20
### 🛡️ Seguridad & Persistencia
- **Arquitectura Database Armor:**
  - Bóveda de persistencia de triple capa: LocalStorage Vault + IndexedDB `CiscoAppCollectionsDB` + Tombstones de borrado.
  - Respaldo de contingencia y recuperación automática ante fallas de red o indisponibilidad de la nube.

---

## [v2.0.5] - 2026-10-19
### 💵 Finanzas & Moneda
- **Indicadores Oficiales del Banco Central de Chile:**
  - Consulta en vivo de valores observados de USD y UF.
  - Incorporación de spread comercial preventivo de **+$10 CLP** sobre el dólar interbancario para cotizaciones en moneda nacional.

---

## [v2.0.4] - 2026-10-18
### 📦 Logística & Importación
- **Regla Estricta de Lead Time Miami:**
  - Fijación obligatoria de 175 días corridos (27 semanas de entrega).
  - Mecanismo anti-degradación idempotente y persistencia en metadatos sombra (`sys_metadata`) de Excel.

---

## [v2.0.3] - 2026-10-17
### 📐 Cálculos Comerciales
- **Arancel Aduanero en Accesorios de Línea Madre:**
  - Clasificación automática y aplicación de Arancel Aduanero (6.0%) a Cámaras Meraki (`MV*`), Sensores (`MT*`), Teléfonos IP (`CP-*/DP-*`) y terminales Webex Room Bar (`CS-*`).

---

## [v2.0.2] - 2026-10-16
### 🤖 Inteligencia Artificial
- **Motor Multi-Proveedor en ConfigurIAtor:**
  - Cascada de IA con Google Gemini 3.6 Flash primario y OpenRouter secundario.
  - Fallback determinista offline con plantillas de oro (*Golden Templates*) para operación sin conexión.

---

## [v2.0.1] - 2026-10-15
### ☁️ Cloud & Catálogo
- **Sincronización en la Nube de Fast Track:**
  - Almacenamiento distribuido del catálogo de promociones por bloques (chunks) en `cisco_fast_track_catalog`.
  - Detección automática de duplicados y purga de catálogo anterior.

---

## [v2.0.0] - 2026-10-12
### 🚀 Lanzamiento Inicial (Arquitectura Base)
- **Cotizador Comercial CCW:** Motor de importación y costeo de cotizaciones Cisco Commerce Workspace con solver de margen objetivo (Goal Seek).
- **Generador Oficial Cisco DSV:** Exportación en la plantilla oficial de 48 columnas, formato tipográfico Calibri 11, sanitización `.trim()` y descarte de ítems sin precio de lista.
- **Auditor Fast Track en IndexedDB:** Microservicio en frontend que cruza SKUs automáticamente contra ofertas promocionales.
- **Desktop Portable:** Empaquetado Windows con SQLite local integrado para uso 100% offline.
