# Cisco Automated v4.0 (Enterprise Suite v2.1.0)
### Intcomex Chile | Aplicación Híbrida Web Standalone, Cloud CDN & Desktop Portable

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

**Cisco Automated v4.0** es la plataforma tecnológica integral diseñada para **Intcomex Chile** que automatiza de extremo a extremo el ciclo de cotización, análisis de rentabilidad, generación de pedidos directos a fábrica, configuración con inteligencia artificial, gestión logística de compras y mesa de ayuda técnica.

Opera bajo una arquitectura híbrida de alta disponibilidad:
- **Cloud Web CDN ([develop.cisco-automated.pages.dev](https://develop.cisco-automated.pages.dev)):** Despliegue global en Cloudflare Pages con tiempos de respuesta inferiores a 50 ms.
- **Web Standalone Single-File (`desktop_build.html` / `dist/index.html`):** Bundle autocontenido que funciona 100% offline en cualquier navegador moderno sin requerir servidores locales.
- **App Desktop Portable para Windows (`dist/Cotizador-Cisco-Intcomex-Portable.exe`):** Ejecutable nativo con almacenamiento estructurado, aceleración por hardware y **auto-actualización en caliente de 1-clic**.

---

## ✨ Los 11 Módulos Principales del Sistema

### 1. Cotizador Comercial CCW (Estimate Engine)
- **Clasificación Inteligente Multinivel:** Reconocimiento de equipos físicos (Hardware), intangibles (Licencias, Suscripciones, Servicios `CON-`, SaaS), accesorios con arancel (`=` al final) y clasificación especial en Líneas Madre (`N.0`) para cámaras Meraki (`MV*`), sensores (`MT*`), telefonía IP (`CP-*/DP-*`) y terminales Webex (`CS-*`).
- **Fórmula de Margen Comercial Real en Ventas:**
  $$\text{Precio Venta Unitario} = \frac{\text{Net Cisco} + \text{Costo Internación} + \text{Costo Arancel}}{1 - (\text{Margen\%} / 100)}$$
- **Ajuste Comercial de Precio Objetivo (Goal Seek Equitativo):** Solver matemático bi-etápico para alcanzar precios o descuentos exactos a $\pm \$0.01$. **El Arancel Aduanero (6.0%) está estrictamente blindado 🔒**.
- **Regla de Lead Time Miami (175 días / 27 semanas):** Anti-degradación de tiempos de entrega y persistencia en metadatos ocultos `sys_metadata` de Excel.
- **Exportación Oficial:** Plantilla corporativa oficial de 7 columnas con logo metálico de Intcomex, etiqueta totalizadora `Price Total:`, tipografía `Arial 9` y resumen preformateado en HTML para correo de Microsoft Outlook.

### 2. Generador Oficial Cisco DSV (48 Columnas)
- **100% Desacoplado:** Módulo independiente en `src/modules/dsv/` para procesar Deal BOMs (`.xls` y `.xlsx`).
- **Filtro Estricto de Columna O:** Procesa únicamente filas con `LIST_PRICE > 0`, preservando la numeración original de líneas (`LINE#`).
- **Lógica Financiera Diferenciada (Cols J y K):** Descuento fijo del 42% para Hardware/Suscripciones y anualización calculada para contratos de servicio `CON-`.
- **Estilos Oficiales ExcelJS:** 48 columnas oficiales, cabeceras en gris plomo (`#BFBFBF`) con texto en rojo/negro, columnas vacías reducidas a ancho 5, columnas Bill-To ocultas e inyección de números nativos sin advertencias verdes.

### 3. Gestor y Auditoría de Catálogo Fast Track
- **Doble Persistencia:** Motor ultrarrápido en IndexedDB (`CiscoFastTrackDB`) + sincronización en la nube mediante Firestore (`cisco_fast_track_catalog`).
- **Auditoría Silenciosa en Tiempo Real:** Cruce automático de SKUs al importar cotizaciones CCW; despliega el modal interactivo de oportunidad si detecta mayor margen promocional.
- **Kill Switch de Seguridad:** Interruptor maestro con modal persuasivo de advertencia de rentabilidad.

### 4. AI ConfigurIAtor (BOM Generator & Discrepancy Auditor)
- **NLP Deductivo con Inteligencia Artificial:** Extracción de requerimientos en lenguaje natural con soporte multi-modelo (Google Gemini 3.6 Flash como primario y OpenRouter como fallback).
- **Protección Antidegradación:** Preservación de familias de producto avanzadas (ej. Catalyst 9300 24P/48P Advantage) y validación de compatibilidad con plantillas maestras (`goldenTemplates.ts`).

### 5. Gestión de Back Order (BO) y Catálogo de SKUs Manuales
- **Transición Comercial Directa:** Promoción de cotizaciones a compras formalmente aprobadas al presionar copiar correo o emitir DSV.
- **Persistencia de SKUs Manuales:** Almacenamiento transaccional de códigos y mapeos de catálogo en la colección `cisco_bo_sku_catalog`.

### 6. Logística de Fulfillment y Seguimiento de Órdenes (`bo_order_tracking`)
- **Pipeline Kanban de 6 Etapas:** `PO_RECIBIDA`, `ORDENADA_CISCO`, `TRANSITO_MIAMI`, `EN_ADUANA_CHILE`, `EN_BODEGA_INTCOMEX`, `ENTREGADO_CLIENTE`.
- **Integración con Couriers:** Rastreo directo de guías FedEx, UPS y DHL.
- **Auditoría Financiera del BO:** Monitoreo en vivo de ventas brutas, utilidades acumuladas y costos de internación.

### 7. Notificador y Recordador de DEALS Escalados
- **Gestión de Aprobaciones Especiales:** Seguimiento de Deals en revisión por AM Cisco y Velocity Hub (VF) en la colección `deal_reminders`.
- **Alertas Emergentes Diarias:** Avisos automáticos en horarios estratégicos (12:00 y 17:30) con plantillas de correo preformateadas y soporte de envío offline.

### 8. Módulo de Mejoras, Reporte de Errores y Soporte Técnico con Triaje IA
- **Ticketing Corporativo:** Colección `app_feedback_tickets` con control de SLAs por prioridad (4h a 48h).
- **Captura Técnica Automática:** Recopila commit de Git, versión activa, entorno (Web/Desktop) y vista actual para acelerar la resolución.
- **Asesor de Soluciones IA:** Analiza el ticket, dictamina la factibilidad (`YES` / `CONDITIONAL` / `NO`), diagnostica la causa raíz y formula una propuesta de solución técnica detallada paso a paso sin modificar código fuente. Incluye botón directo para usar el dictamen como respuesta al usuario.

### 9. Historial Analítico y Multi-Versionamiento de Cotizaciones
- **Versionamiento Inmutable:** Subcolección `estimates/{estimateId}/versions/{versionId}` con versión original `v0_RAW` protegida contra alteraciones.
- **Comparador Visual de Versiones:** Modal de contraste de márgenes y diferencias línea a línea entre distintas revisiones comerciales.

### 10. Multi-Moneda y Tipo de Cambio Oficial (Banco Central de Chile)
- **Consulta en Vivo de Indicadores:** Dólar Observado y Unidad de Fomento (UF) actualizados diariamente desde APIs oficiales chilenas.
- **Spread Comercial Intcomex (+10 CLP):** Incorporación automática de +10 pesos sobre el dólar interbancario para protección de márgenes en cotizaciones en pesos chilenos.

### 11. Ecosistema Multi-Entorno y Auto-Updater de 1-Clic
- **Despliegue Continuo en Cloudflare Pages:** Cada cambio se compila y publica en el alias oficial de la rama develop.
- **Actualización en Caliente de la App Desktop:** La aplicación de escritorio detecta nuevas versiones en la CDN y permite actualizarse con 1 solo clic en caliente sin reinstalaciones.

---

## 🗄️ Arquitectura de Persistencia y Base de Datos (11 Colecciones)

El sistema integra **Google Cloud Firestore** (modo producción) complementado con la arquitectura local **Database Armor** (IndexedDB + Bóvedas de Respaldo + Tombstones de eliminación):

```text
1.  estimates                  -> Cabeceras y partidas de cotizaciones CCW
    └── versions               -> Subcolección de versiones comerciales (v0_RAW..vN)
2.  dsv_records                -> Historial de órdenes de compra DSV de 48 columnas
3.  users                      -> Usuarios RBAC con hash SHA-256 (admin, pm, user, viewer)
4.  shared_sku_rules           -> Overrides comunitarios de clasificación de SKUs
5.  partner_custom_params      -> Perfiles de márgenes e internación por Partner
6.  partners_xcl               -> Catálogo de clientes y códigos XCL de Intcomex
7.  cisco_bo_sku_catalog       -> Catálogo persistente de SKUs manuales de Back Order
8.  bo_order_tracking          -> Fulfillment de órdenes BO y etapas de entrega
9.  cisco_fast_track_catalog   -> Catálogo Fast Track sincronizado por bloques (chunks)
10. deal_reminders             -> Recordatorios y seguimiento de Deals escalados
11. app_feedback_tickets       -> Tickets de soporte, mejoras y diagnósticos de IA
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
- **Especificación Técnica Completa:** Para consultar la especificación matemática, algorítmica y el Prompt Maestro para Inteligencia Artificial, ver [`INFORME_TECNICO_RECREACION_COTIZADOR_CISCO.md`](INFORME_TECNICO_RECREACION_COTIZADOR_CISCO.md).