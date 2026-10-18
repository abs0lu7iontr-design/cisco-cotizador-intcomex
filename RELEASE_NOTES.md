# HISTORIAL DE VERSIONES Y NOTAS DE RELEASE (RELEASE NOTES)
## Cisco Automated v2.1.0 (Arquitectura Enterprise Suite v4.0)
### Intcomex Chile

---

## [v2.1.0] - Octubre 2026 (Enterprise Release Actual)

### 🚀 Nuevos Módulos Principales
1. **Módulo de Feedback, Mejoras y Soporte Técnico con Triaje IA:**
   - Creación de tickets de reporte de errores, mejoras y sugerencias en Firestore (`app_feedback_tickets`).
   - SLA dinámico según prioridad (4h para Crítico, 12h para Alto, 24h para Medio, 48h para Bajo).
   - Captura automática de metadatos técnicos (commit de Git, versión, vista activa, agente de usuario).
   - **Asesor de Soluciones con Inteligencia Artificial:** Diagnóstico de factibilidad (`YES` / `CONDITIONAL` / `NO`), causa raíz, propuesta técnica paso a paso y estimación de esfuerzo sin modificar el código fuente.
   - Botón directo en la barra de navegación superior (Navbar) para acceso inmediato en toda la aplicación.

2. **Transición Automática de Cotizaciones a Back Order (BO):**
   - La cotización se marca automáticamente como aceptada por el cliente al exportar el correo o emitir el archivo DSV.
   - Registro instantáneo en el pipeline logístico de compras y fulfillment.

3. **Catálogo Persistente de SKUs Manuales de BO (`cisco_bo_sku_catalog`):**
   - Almacenamiento permanente en Cloud Firestore de códigos ingresados manualmente, previniendo su pérdida entre actualizaciones o reinicios de sesión.

4. **Fulfillment Logístico y Seguimiento de Órdenes BO (`bo_order_tracking`):**
   - Tablero Kanban interactivo con 6 etapas logísticas (`PO_RECIBIDA`, `ORDENADA_CISCO`, `TRANSITO_MIAMI`, `EN_ADUANA_CHILE`, `EN_BODEGA_INTCOMEX`, `ENTREGADO_CLIENTE`).
   - Rastreo de guías de courier internacional (FedEx, UPS, DHL).
   - Indicadores de venta total en USD, margen bruto y costos de internación.

5. **Notificador y Recordador de DEALS Escalados (`deal_reminders`):**
   - Monitoreo de Deals enviados a Account Managers de Cisco o Velocity Hub.
   - Alertas emergentes automáticas programadas en horarios clave (12:00 y 17:30).
   - Generación de plantillas de correo con respaldo offline.

6. **Auto-Updater en Caliente de 1-Clic para la App de Escritorio:**
   - La aplicación desktop consulta de forma transparente el archivo `version.json` en Cloudflare Pages CDN.
   - Permite descargar e instalar la última versión compilada con 1 solo clic sin reinstalar el ejecutable.

---

### ⚙️ Optimizaciones de Cálculo y Reglas Comerciales
- **Lead Time Miami (175 días / 27 semanas):**
  - Implementación de regla anti-degradación idempotente para tiempos de entrega desde Miami.
  - Preservación del estado canónico original mediante snapshot en la metadata oculta de Excel (`sys_metadata`).
- **Clasificación Avanzada de Hardware y Arancel:**
  - Clasificación de accesorios en Líneas Madre (`N.0`): Cámaras Meraki (`MV*`), Sensores IoT (`MT*`), Teléfonos IP (`CP-*`, `DP-*`) y terminales Webex Room Bar (`CS-*`) aplican Arancel Aduanero del 6.0%.
  - Soporte de cables `CAB-*` como Tangibles (sin `=`) o Arancel (con `=`) preservando su costeo en sublíneas.
  - Corrección de clasificación para familias Cisco Catalyst 1000/1200/1300 y routers Cisco ISR 1100.
- **Multi-Moneda en Vivo (Banco Central de Chile):**
  - Consumo en vivo de tipo de cambio USD y UF oficial.
  - Aplicación automática de spread comercial preventivo de **+10 CLP** sobre el Dólar Observado para cotizaciones en moneda local.
- **Exportación Enriquecida para Outlook:**
  - Botón de copia al portapapeles con formato HTML corporativo y saludo dinámico adaptado a la hora del día.

---

### 🛡️ Blindaje de Persistencia y Seguridad (Database Armor)
- **11 Colecciones en Cloud Firestore:**
  - Despliegue de reglas de seguridad declarativas completas para las 11 colecciones del sistema.
  - Eliminación de expiraciones temporales de modo de prueba de Firebase.
- **Multi-Versionamiento de Estimates:**
  - Subcolección `estimates/{estimateId}/versions/{versionId}` con versión original `v0_RAW` inmutable y modal de comparación lado a lado.
- **Sincronización en la Nube de Fast Track:**
  - Persistencia de catálogos promocionales en `cisco_fast_track_catalog` mediante particionado en bloques (chunks) para almacenamiento a gran escala.
- **Bóveda Redundante y Tombstones:**
  - Almacenamiento redundante en LocalStorage e IndexedDB (`CiscoAppCollectionsDB` y `CiscoFastTrackDB`) con registro de tombstones (`deleted_ids`) para evitar reaparición de registros eliminados.

---

## [v2.0.0] - Septiembre 2026 (Lanzamiento Inicial Híbrido)
- Cotizador comercial Cisco CCW con clasificación multinivel de hardware, intangibles y aranceles.
- Solver Goal Seek equitativo de 2 fases con arancel aduanero del 6.0% blindado.
- Generador de matriz oficial DSV de 48 columnas (A a AV).
- Auditor Fast Track local en IndexedDB con Kill Switch.
- Arquitectura híbrida Web Single-File y ejecutable portable de escritorio para Windows.
