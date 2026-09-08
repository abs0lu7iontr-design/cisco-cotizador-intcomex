# Cisco Automated v3.3 — Cotizador CCW, Generador DSV & Auditor Fast Track
### Intcomex Chile | Aplicación Híbrida Web Standalone & Desktop Portable

[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![ExcelJS](https://img.shields.io/badge/ExcelJS-4.4-217346?logo=microsoft-excel&logoColor=white)](https://github.com/exceljs/exceljs)
[![IndexedDB](https://img.shields.io/badge/IndexedDB-Native-FFA000?logo=google-chrome&logoColor=white)](https://developer.mozilla.org/es/docs/Web/API/IndexedDB_API)
[![PyWebView](https://img.shields.io/badge/PyWebView-5.4-3776AB?logo=python&logoColor=white)](https://pywebview.flowrl.com/)

---

## 🌟 Descripción General

**Cisco Automated v3.3** es una solución integral de ingeniería de software modular desarrollada para **Intcomex Chile**. Automatiza de punta a punta:
1. **Cotizador Comercial CCW:** Transformación y costeo de cotizaciones de Cisco Commerce Workspace con ajuste comercial inverso (Goal Seek).
2. **Generador Oficial DSV (48 Columnas):** Conversión de Deal BOMs a la plantilla oficial de órdenes requerida por el portal de Cisco.
3. **Gestor de Base de Datos y Auditoría Fast Track:** Microservicio cliente que cruza automáticamente las cotizaciones contra el catálogo promocional de Fast Track almacenado en **IndexedDB** para maximizar la rentabilidad de las ofertas.

La aplicación opera bajo una arquitectura híbrida:
- **Web Single-File Offline (`dist/index.html`):** Archivo HTML autocontenido de ~2.1 MB que funciona 100% offline en cualquier navegador.
- **App Desktop Standalone Portable (`dist/Cotizador-Cisco-Intcomex-Portable.exe`):** Ejecutable Windows de ~19.0 MB con guardado estructurado (`gravity_storage/Partner/Cliente/Mes/`) y persistencia local.

---

## ✨ Características Principales

### 1. Cotizador Comercial CCW
- **Clasificación Inteligente Multinivel:** Identifica equipos físicos (Hardware), intangibles (Licencias, Suscripciones, Servicios `CON-`, SmartNet, Cloud SaaS) y accesorios con arancel aduanero (SKUs terminados en `=`).
- **Fórmula de Margen Comercial Real en Ventas:**
  $$\text{Precio Venta Unitario} = \frac{\text{Net Cisco} + \text{Costo Internación} + \text{Costo Arancel}}{1 - (\text{Margen\%} / 100)}$$
- **Ajuste de Precio Objetivo (Goal Seek Equitativo):** Solver de 2 fases para fijar precio o descuento exacto. **Arancel Aduanero (6.0%) strictly fixed e intocable 🔒**.
- **Formato Excel de Alta Fidelidad:** 7 columnas limpias, `Qty` entero nativo (`numFmt = '0'`, sin `$`), precios en `Arial 9` y fila final con etiqueta oficial **`Price Total:`**.

### 2. Generador Oficial Cisco DSV (48 Columnas Oficiales)
- **100% Desacoplado y Modular:** Módulo aislado en `src/modules/dsv/` con su propio parser, motor ExcelJS, tipos y vistas.
- **Sanitización Total `.trim()`:** Eliminación de espacios en blanco al final de todos los campos extraídos y manuales.
- **Filtro de Cero:** Descarte de filas con `LIST_PRICE <= 0` conservando los `LINE#` originales sin renumerar.
- **Lógica Financiera de Servicios (`CON-`):** Col J = valor unitario anual, Col K = Col J $\times$ Años.
- **Estilos Oficiales ExcelJS:**
  - Tipografía `Calibri 11` global.
  - Fila 1 en gris plomo (`#BFBFBF`): cabeceras con datos en rojo (`#FF0000`) y vacías en negro (`#000000`).
  - Columnas vacías (`F, G, H, N, O, P, W, Z, AK, AN, AR, AU`) reducidas a `width: 5`.
  - Columnas Bill-To (`AB a AH`) ocultas con `hidden: true`.
  - Cero triángulos verdes en Excel (IDs numéricos inyectados como Number nativo con `numFmt = '0'`).
- **Modal y Menú Contextual:** Validación estricta (SO 9 dígitos, PO 6 dígitos, Deal ID 8 dígitos) y override manual de categoría.

### 3. Gestor de Base de Datos y Auditoría Fast Track (Módulo 3)
- **Almacenamiento Persistente en Front-End (IndexedDB):** Base de datos `CiscoFastTrackDB` para almacenar el catálogo oficial con clave primaria por SKU sanitizado.
- **Carga y Purgado Automático:** Importa archivos Excel Fast Track (`.xlsx` o `.xls`) purgando automáticamente el catálogo anterior para evitar duplicados.
- **Interruptor Maestro (Kill Switch):** Toggle On/Off en el Navbar con modal de confirmación persuasivo de advertencia de rentabilidad al intentar apagarlo teniendo datos.
- **Auditoría e Interceptación Automática:** Cruza silenciosamente los SKUs al subir un BOM/CCW. Si detecta mejores descuentos, abre el modal de oportunidad (`FastTrackOpportunityModal.tsx`) para aplicar los precios promocionales en memoria con un solo clic.

---

## 🚀 Inicio Rápido y Construcción

```bash
# Modo Desarrollo
npm run dev

# Compilar Web Standalone (Single-File)
npm run build
# Genera dist/index.html (2.1 MB)

# Compilar Desktop Portable (.exe)
python -m PyInstaller --noconfirm GravityDesktopPortable.spec
# Genera dist/Cotizador-Cisco-Intcomex-Portable.exe (19.0 MB)
```

---

## 📖 Documentación y Prompt Maestro de Ingeniería

El **Prompt Maestro Definitivo (Master Prompt v3.3)** para replicar o evolucionar este proyecto se encuentra en [`INFORME_TECNICO_RECREACION_COTIZADOR_CISCO.md`](INFORME_TECNICO_RECREACION_COTIZADOR_CISCO.md).