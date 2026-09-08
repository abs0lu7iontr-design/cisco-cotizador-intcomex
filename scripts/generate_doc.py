import os
import shutil
from PIL import Image, ImageDraw, ImageFont
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def create_flowchart_image(output_path):
    w, h = 1400, 1080
    img = Image.new('RGB', (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    try:
        font_main_title = ImageFont.truetype('arialbd.ttf', 24)
        font_sub_title = ImageFont.truetype('arial.ttf', 13)
        font_box_title = ImageFont.truetype('arialbd.ttf', 13)
        font_box_desc = ImageFont.truetype('arial.ttf', 10.5)
        font_badge = ImageFont.truetype('arialbd.ttf', 10)
    except:
        font_main_title = ImageFont.load_default()
        font_sub_title = ImageFont.load_default()
        font_box_title = ImageFont.load_default()
        font_box_desc = ImageFont.load_default()
        font_badge = ImageFont.load_default()

    for y in range(0, h, 40):
        draw.line([(0, y), (w, y)], fill=(248, 250, 252), width=1)
    for x in range(0, w, 40):
        draw.line([(x, 0), (x, h)], fill=(248, 250, 252), width=1)

    draw.rectangle([(0, 0), (w, 85)], fill=(15, 23, 42))
    draw.rectangle([(0, 85), (w, 88)], fill=(37, 99, 235))
    draw.text((40, 20), "ARQUITECTURA DE PROCESAMIENTO Y FLUJO DE DATOS", fill=(255, 255, 255), font=font_main_title)
    draw.text((40, 52), "Cisco Automated v2.1 • Motor Integral de Cotizaciones y Órdenes Intcomex", fill=(148, 163, 184), font=font_sub_title)

    def draw_card(x, y, bw, bh, title, desc, bg_color=(241, 245, 249), border_color=(203, 213, 225), title_color=(15, 23, 42), badge=""):
        draw.rounded_rectangle([x+3, y+3, x+bw+3, y+bh+3], radius=10, fill=(226, 232, 240))
        draw.rounded_rectangle([x, y, x+bw, y+bh], radius=10, fill=bg_color, outline=border_color, width=2)
        
        if badge:
            badge_w = 90
            draw.rounded_rectangle([x+bw-badge_w-12, y+10, x+bw-12, y+28], radius=6, fill=(37, 99, 235))
            draw.text((x+bw-badge_w-6, y+13), badge, fill=(255, 255, 255), font=font_badge)

        draw.text((x + 18, y + 14), title, fill=title_color, font=font_box_title)
        
        lines = desc.split("\n")
        curr_y = y + 36
        for line in lines:
            draw.text((x + 18, curr_y), line, fill=(71, 85, 105), font=font_box_desc)
            curr_y += 16

    def draw_arrow(x1, y1, x2, y2, color=(59, 130, 246), width=2):
        draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
        if y2 > y1 and x1 == x2:
            draw.polygon([(x2 - 5, y2 - 8), (x2 + 5, y2 - 8), (x2, y2)], fill=color)
        elif y2 == y1 and x2 > x1:
            draw.polygon([(x2 - 8, y2 - 5), (x2 - 8, y2 + 5), (x2, y2)], fill=color)
        elif y2 == y1 and x2 < x1:
            draw.polygon([(x2 + 8, y2 - 5), (x2 + 8, y2 + 5), (x2, y2)], fill=color)
        elif y2 > y1:
            draw.polygon([(x2 - 4, y2 - 7), (x2 + 6, y2 - 4), (x2, y2)], fill=color)

    cx = 700
    b1_w, b1_h = 440, 68
    draw_card(cx - b1_w//2, 115, b1_w, b1_h, "1. ARCHIVO CISCO CCW (.XLSX)", "Entrada cruda oficial Cisco Commerce Workspace.\nContiene costos netos mayoristas y metadatos del cliente.", bg_color=(238, 242, 255), border_color=(99, 102, 241), title_color=(67, 56, 202), badge="INPUT RAW")

    draw_arrow(cx, 183, cx, 220)

    b2_w, b2_h = 440, 72
    draw_card(cx - b2_w//2, 220, b2_w, b2_h, "2. PARSER INTELIGENTE EN MEMORIA (excelEngine.ts)", "• Procesamiento 100% en cliente con ExcelJS (sin enviar archivos a terceros).\n• Unmerge global, limpieza de fórmulas corruptas y artefactos ('0-0').", bg_color=(240, 253, 250), border_color=(20, 184, 166), title_color=(15, 118, 110), badge="EXCELJS")

    draw_line_y = 315
    draw.line([(cx, 292), (cx, draw_line_y)], fill=(59, 130, 246), width=2)
    draw.line([(380, draw_line_y), (1020, draw_line_y)], fill=(59, 130, 246), width=2)
    draw_arrow(380, draw_line_y, 380, 345)
    draw_arrow(1020, draw_line_y, 1020, 345)

    b3_w, b3_h = 480, 80
    draw_card(380 - b3_w//2, 345, b3_w, b3_h, "3A. CLASIFICADOR MULTI-NIVEL TANGIBLE/INTANGIBLE", "• Nivel 1: Hardware físico (Switches, APs, Módulos) -> Tangible.\n• Nivel 2: Accesorios con arancel (SKU termina en '=') -> Arancel 6%.\n• Nivel 3: Licencias, SmartNet y Cloud -> Intangibles (sin internación).", bg_color=(254, 242, 242), border_color=(239, 68, 68), title_color=(185, 28, 28), badge="REGLAS AFIP")

    draw_card(1020 - b3_w//2, 345, b3_w, b3_h, "3B. MOTOR SAAS UNIVERSAL (Meraki & Catalyst Cloud)", "• Detección precisa de suscripciones Cloud y rescate de meses de vigencia.\n• Conversión automática de meses a estándar de años comerciales (1Y, 3Y, 5Y).\n• Inyección directa en la descripción y multiplicación secuencial exacta.", bg_color=(254, 243, 199), border_color=(245, 158, 11), title_color=(180, 83, 9), badge="CLOUD SAAS")

    draw_merge_y = 450
    draw.line([(380, 425), (380, draw_merge_y)], fill=(59, 130, 246), width=2)
    draw.line([(1020, 425), (1020, draw_merge_y)], fill=(59, 130, 246), width=2)
    draw.line([(380, draw_merge_y), (1020, draw_merge_y)], fill=(59, 130, 246), width=2)
    draw_arrow(cx, draw_merge_y, cx, 475)

    b4_w, b4_h = 560, 85
    draw_card(cx - b4_w//2, 475, b4_w, b4_h, "4. MOTOR FINANCIERO DE PRECISIÓN IEEE 754 (calculations.ts)", "• Helper roundFinancial(val) con Number.EPSILON (evita descalces de centavos).\n• Costo Total = Neto Cisco + Internación (7%) + Arancel Aduanero (6%).\n• Precio Venta Comercial = Costo Total / (1 - Margen Comercial 5%).\n• Exclusión estricta de filas informativas ('Initial Term') de los sumatorios.", bg_color=(240, 249, 255), border_color=(2, 132, 199), title_color=(3, 105, 161), badge="FINTECH CORE")

    draw_arrow(cx, 560, cx, 595)

    b5_w, b5_h = 560, 75
    draw_card(cx - b5_w//2, 595, b5_w, b5_h, "5. AUDITORÍA AUTOMÁTICA FAST TRACK (modules/fasttrack)", "• Cruce en tiempo real contra catálogo de promociones oficiales Cisco Fast Track.\n• Detección de oportunidades de mayor descuento para incrementar la ganancia bruta.\n• Modal interactivo de decisión: transferir ahorro al cliente o retenerlo.", bg_color=(243, 232, 255), border_color=(168, 85, 247), title_color=(126, 34, 206), badge="PROMO AUDIT")

    draw_arrow(cx, 670, cx, 705)

    b6_w, b6_h = 560, 80
    draw_card(cx - b6_w//2, 705, b6_w, b6_h, "6. PANEL REACTIVO COMERCIAL & GOAL SEEK (Cálculo Inverso)", "• Modificación en vivo de parámetros (Margen, Internación, Overrides individuales).\n• Algoritmo Goal Seek: Búsqueda binaria para cuadrar precios con descuentos meta.\n• Blindaje Legal: El Arancel del 6.0% es intocable; solo cede margen e internación.", bg_color=(236, 253, 245), border_color=(16, 185, 129), title_color=(4, 120, 87), badge="GOAL SEEK")

    draw_out_y = 815
    draw.line([(cx, 785), (cx, draw_out_y)], fill=(59, 130, 246), width=2)
    draw.line([(240, draw_out_y), (1160, draw_out_y)], fill=(59, 130, 246), width=2)
    draw_arrow(240, draw_out_y, 240, 845)
    draw_arrow(cx, draw_out_y, cx, 845)
    draw_arrow(1160, draw_out_y, 1160, 845)

    out_w, out_h = 360, 150
    draw_card(240 - out_w//2, 845, out_w, out_h, "SALIDA 1: EXCEL CLIENTE", "• Archivo .xlsx ejecutivo y limpio.\n• Tabla re-anclada en fila 13.\n• Metadatos horizontales minimalistas.\n• Aviso USD en celda G12 sin huecos.\n• Logotipo oficial Intcomex en celda A1.\n• Cláusula de validez de 14 días corridos.", bg_color=(248, 250, 252), border_color=(15, 23, 42), title_color=(15, 23, 42), badge="EXCELJS EXPORT")

    draw_card(cx - out_w//2, 845, out_w, out_h, "SALIDA 2: PLANTILLA DSV (48 COL)", "• Plantilla oficial Direct Ship Vendor.\n• 48 columnas estrictas para fábrica Cisco.\n• Excepción automática SMB:\n  20% descuento en familias Catalyst 1000,\n  1200, 1300 y CBS (vs 42% estándar).\n• Generación lista para carga B2B.", bg_color=(255, 241, 242), border_color=(225, 29, 72), title_color=(190, 18, 60), badge="B2B CISCO DSV")

    draw_card(1160 - out_w//2, 845, out_w, out_h, "SALIDA 3: PERSISTENCIA HÍBRIDA", "• Cloud Firestore: Historial compartido sin\n  listeners continuos (Zero Cost on-demand).\n• SQLite Offline: Almacenamiento local en\n  la App Portable para trabajo en terreno.\n• Reglas compartidas entre PMs por SKU.", bg_color=(240, 253, 244), border_color=(22, 163, 74), title_color=(21, 128, 61), badge="CLOUD & SQLITE")

    draw.text((40, 1040), "Cisco Automated v2.1 • Documento Oficial de Arquitectura • Intcomex Chile / LATAM", fill=(148, 163, 184), font=font_badge)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG", dpi=(150, 150))
    print(f"Diagram saved to {output_path}")

def set_cell_background(cell, fill_hex):
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = parse_xml(f'''<w:tcMar {nsdecls("w")}>
        <w:top w:w="{top}" w:type="dxa"/>
        <w:bottom w:w="{bottom}" w:type="dxa"/>
        <w:left w:w="{left}" w:type="dxa"/>
        <w:right w:w="{right}" w:type="dxa"/>
    </w:tcMar>''')
    tcPr.append(tcMar)

def build_docx_documentation(docx_path, image_path):
    doc = docx.Document()

    for section in doc.sections:
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    style_normal = doc.styles['Normal']
    font_normal = style_normal.font
    font_normal.name = 'Calibri'
    font_normal.size = Pt(10.5)
    font_normal.color.rgb = RGBColor(30, 41, 59)

    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("COTIZADOR AUTOMÁTICO CISCO – INTCOMEX")
    run_title.font.name = 'Arial'
    run_title.font.size = Pt(22)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(15, 23, 42)

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(16)
    run_sub = sub_p.add_run("Manual de Arquitectura de Software, Motor Financiero y Flujo de Procesamiento (v2.1)")
    run_sub.font.name = 'Calibri'
    run_sub.font.size = Pt(12)
    run_sub.font.italic = True
    run_sub.font.color.rgb = RGBColor(71, 85, 105)

    meta_table = doc.add_table(rows=2, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False

    col_widths = [Inches(3.2), Inches(3.3)]
    for row in meta_table.rows:
        for i, w in enumerate(col_widths):
            row.cells[i].width = w

    c00 = meta_table.cell(0, 0)
    c00.paragraphs[0].add_run("Ecosistema: ").bold = True
    c00.paragraphs[0].add_run("Cisco Commerce Workspace (CCW) & Intcomex")
    set_cell_background(c00, "F8FAFC")
    set_cell_margins(c00, 80, 80, 120, 120)

    c01 = meta_table.cell(0, 1)
    c01.paragraphs[0].add_run("Versión de Motor: ").bold = True
    c01.paragraphs[0].add_run("v2.1 Professional (Release 2026)")
    set_cell_background(c01, "F8FAFC")
    set_cell_margins(c01, 80, 80, 120, 120)

    c10 = meta_table.cell(1, 0)
    c10.paragraphs[0].add_run("Plataformas: ").bold = True
    c10.paragraphs[0].add_run("Web Cloudflare Pages & Windows Portable (.exe)")
    set_cell_background(c10, "F8FAFC")
    set_cell_margins(c10, 80, 80, 120, 120)

    c11 = meta_table.cell(1, 1)
    c11.paragraphs[0].add_run("Área: ").bold = True
    c11.paragraphs[0].add_run("Unidad de Negocios Cisco / Product Managers")
    set_cell_background(c11, "F8FAFC")
    set_cell_margins(c11, 80, 80, 120, 120)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(14)
    h1.paragraph_format.space_after = Pt(6)
    r_h1 = h1.add_run("1. Visión General del Proyecto")
    r_h1.font.name = 'Arial'
    r_h1.font.size = Pt(15)
    r_h1.font.bold = True
    r_h1.font.color.rgb = RGBColor(30, 58, 138)

    p_desc = doc.add_paragraph(
        "Cisco Automated v2.1 es una solución integral de ingeniería financiera y automatización de procesos creada para Intcomex. "
        "Su objetivo primordial es procesar automáticamente los archivos de cotización exportados desde la plataforma oficial de Cisco (Cisco Commerce Workspace - CCW), "
        "aplicar las reglas impositivas y comerciales de importación, resolver cálculos complejos de contratos SaaS, y generar en cuestión de segundos "
        "cotizaciones ejecutivas listas para el cliente y plantillas de compras de fábrica (DSV de 48 columnas)."
    )
    p_desc.paragraph_format.line_spacing = 1.15

    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)
    r_h2 = h2.add_run("2. El Problema de Negocio que Resuelve")
    r_h2.font.name = 'Arial'
    r_h2.font.size = Pt(15)
    r_h2.font.bold = True
    r_h2.font.color.rgb = RGBColor(30, 58, 138)

    p_prob = doc.add_paragraph(
        "El flujo manual tradicional de cotización presentaba graves cuellos de botella que afectaban tanto la agilidad comercial como el margen neto de Intcomex:"
    )
    p_prob.paragraph_format.line_spacing = 1.15

    bullets = [
        ("Complejidad Impositiva y Aduanera: ", "El equipamiento físico requiere un 7% de costo de internación y flete. Los accesorios específicos (cables, fuentes con SKU terminados en '=') exigen un 6% de arancel aduanero. El software y los servicios en la nube son intangibles y están exentos. Calcular esto manualmente producto por producto generaba cotizaciones erróneas o pérdida de competitividad."),
        ("El Problema de las Licencias SaaS (Meraki & Catalyst): ", "Cisco exporta las licencias en CCW con un precio de lista mensual unitario, pero el contrato cotizado suele ser por 12, 36 o 60 meses. Los comerciales cometían errores recurrentes multiplicando o descontando en desorden, generando discrepancias de centavos o pérdidas monetarias."),
        ("Lenta Negociación Comercial (Goal Seek): ", "Cuando un cliente solicitaba un descuento global (por ejemplo: 'redondea la cotización a $15.000 USD exactos'), el ejecutivo pasaba horas recalculando a mano celdas en Excel para saber cuánto margen ceder sin afectar el arancel obligatorio por ley."),
        ("Formato Visual Sucio: ", "El archivo original de Cisco contiene fórmulas rotas, celdas combinadas defectuosas, fechas obsoletas y textos residuales que no poseen un estándar corporativo apto para ser presentado a un cliente final.")
    ]
    for title_b, desc_b in bullets:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_after = Pt(3)
        r_bt = bp.add_run(title_b)
        r_bt.bold = True
        r_bt.font.color.rgb = RGBColor(15, 23, 42)
        bp.add_run(desc_b)

    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(6)
    r_h3 = h3.add_run("3. Diagrama de Arquitectura y Flujo de Procesamiento")
    r_h3.font.name = 'Arial'
    r_h3.font.size = Pt(15)
    r_h3.font.bold = True
    r_h3.font.color.rgb = RGBColor(30, 58, 138)

    doc.add_paragraph(
        "El siguiente diagrama ilustra el flujo secuencial de datos desde la ingesta del archivo CCW original hasta la emisión de los tres entregables finales:"
    )

    if os.path.exists(image_path):
        img_p = doc.add_paragraph()
        img_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        img_p.paragraph_format.space_before = Pt(6)
        img_p.paragraph_format.space_after = Pt(4)
        run_img = img_p.add_run()
        run_img.add_picture(image_path, width=Inches(6.5))

        caption_p = doc.add_paragraph()
        caption_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        caption_p.paragraph_format.space_after = Pt(16)
        r_cap = caption_p.add_run("Figura 1: Arquitectura y pipeline de procesamiento modular de Cisco Automated v2.1")
        r_cap.font.size = Pt(9)
        r_cap.font.italic = True
        r_cap.font.color.rgb = RGBColor(100, 116, 139)

    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(6)
    r_h4 = h4.add_run("4. Arquitectura Modular del Sistema")
    r_h4.font.name = 'Arial'
    r_h4.font.size = Pt(15)
    r_h4.font.bold = True
    r_h4.font.color.rgb = RGBColor(30, 58, 138)

    modules_data = [
        ("Módulo 1: Motor CCW y Generador ExcelJS (src/core/excelEngine.ts)", 
         "Responsable del desempaquetado en memoria del archivo binario Excel original de Cisco. "
         "Ejecuta un barrido maestro (wipe global) desde la fila 6 para purgar rastros, fórmulas y celdas combinadas defectuosas. "
         "Fija la cabecera comercial en la fila 13 de forma invariable, eliminando espacios en blanco muertos. "
         "Inserta el logotipo corporativo Intcomex en alta resolución, ubica la leyenda monetaria 'All prices are shown in USD' en la celda G12 "
         "y añade la cláusula legal de validez de 14 días corridos. "
         "Adicionalmente, detecta la vigencia del servicio desde la columna oficial de meses y añade la nomenclatura comercial estándar a la descripción (ej. 36 meses -> '3Y', 12 meses -> '1Y')."),

        ("Módulo 2: Motor Financiero IEEE 754 y Goal Seek (src/core/calculations.ts)",
         "Aplica matemática financiera estricta implementando la función roundFinancial(value) con Number.EPSILON, eliminando errores de redondeo de punto flotante característicos de JavaScript. "
         "Fórmula comercial aplicada:\n"
         "• Costo Total Unitario = Neto Cisco + Internación (7.0%) + Arancel (6.0% si corresponde).\n"
         "• Precio Venta Unitario = Costo Total Unitario / (1 - Margen Comercial 5.0%).\n"
         "Para licencias SaaS Meraki, aplica un flujo secuencial: Costo Neto Mensual -> Precio Venta Mensual -> Multiplicación por meses y cantidad.\n"
         "Incluye el algoritmo de cálculo inverso 'Goal Seek': búsqueda binaria más ajuste fino discreto (pasos de 0.1%) para recalcular internación y margen ante un descuento solicitado, manteniendo el Arancel Aduanero (6.0%) estrictamente blindado por exigencia legal."),

        ("Módulo 3: Fast Track & Detección de Promociones (src/modules/fasttrack/)",
         "Realiza un cruce de auditoría automática contra la base de datos de precios promocionales Cisco Fast Track. "
         "Al cargar una cotización, identifica oportunidades de descuento adicional no aprovechadas, alertando al ejecutivo "
         "mediante un modal interactivo para decidir si traspasar el ahorro al cliente o retenerlo como utilidad bruta para Intcomex."),

        ("Módulo 4: Persistencia Dual e Historial Compartido (src/modules/cloud/)",
         "Ofrece un esquema híbrido de almacenamiento:\n"
         "• Cloud Firestore: Almacenamiento en la nube con arquitectura Zero Listeners (consumo bajo demanda mediante getDocs, sin sockets permanentes para costo cero de servidor).\n"
         "• SQLite Offline: Motor de base de datos embebido en la aplicación de escritorio portátil que permite archivar cotizaciones localmente sin internet.\n"
         "• Reglas Compartidas por SKU: Permite a los Product Managers autorizar reclasificaciones manuales de ítems y compartirlas instantáneamente con el equipo de preventa."),

        ("Módulo 5: Generador de Órdenes DSV 48 Columnas (src/modules/dsv/)",
         "Genera de forma automatizada la plantilla de 48 columnas requerida para la carga directa de órdenes en la fábrica de Cisco (Direct Ship Vendor).\n"
         "Incorpora la regla de negocio de excepción SMB: aplica automáticamente un 20% de descuento (en vez del 42% habitual) "
         "exclusivamente a las familias de conmutadores SMB: Catalyst 1000 (C1000-), Catalyst 1200 (C1200-), Catalyst 1300 (C1300-) y Cisco Business (CBS).")
    ]

    for m_title, m_desc in modules_data:
        p_mt = doc.add_paragraph()
        p_mt.paragraph_format.space_before = Pt(8)
        p_mt.paragraph_format.space_after = Pt(2)
        r_mt = p_mt.add_run(m_title)
        r_mt.font.name = 'Arial'
        r_mt.font.size = Pt(11.5)
        r_mt.font.bold = True
        r_mt.font.color.rgb = RGBColor(15, 118, 110)

        p_md = doc.add_paragraph(m_desc)
        p_md.paragraph_format.space_after = Pt(6)
        p_md.paragraph_format.line_spacing = 1.15

    h5 = doc.add_paragraph()
    h5.paragraph_format.space_before = Pt(14)
    h5.paragraph_format.space_after = Pt(6)
    r_h5 = h5.add_run("5. Doble Plataforma: Web y Desktop Portable (.exe)")
    r_h5.font.name = 'Arial'
    r_h5.font.size = Pt(15)
    r_h5.font.bold = True
    r_h5.font.color.rgb = RGBColor(30, 58, 138)

    p_plat = doc.add_paragraph(
        "El proyecto fue concebido para operar bajo una arquitectura universal sin dependencias de infraestructura compleja:\n"
        "1. Versión Web Cloudflare Pages: Compilada con Vite en un único archivo inlined (Single-File Bundle). Se despliega globalmente en la red perimetral de Cloudflare (https://develop.cisco-automated.pages.dev), logrando tiempos de carga ultrarrápidos menores a un segundo en cualquier navegador.\n"
        "2. Versión Desktop Portable (Cotizador-Cisco-Intcomex-Portable.exe): Ejecutable autónomo para Windows empaquetado con PyInstaller y pywebview (Edge WebView2). No requiere permisos de administrador, no necesita instalar Python ni Node.js, y opera 100% desconectado de internet gracias a su motor SQLite local."
    )
    p_plat.paragraph_format.line_spacing = 1.15

    h6 = doc.add_paragraph()
    h6.paragraph_format.space_before = Pt(14)
    h6.paragraph_format.space_after = Pt(8)
    r_h6 = h6.add_run("6. Cuadro Comparativo: Impacto y Valor de Negocio")
    r_h6.font.name = 'Arial'
    r_h6.font.size = Pt(15)
    r_h6.font.bold = True
    r_h6.font.color.rgb = RGBColor(30, 58, 138)

    table = doc.add_table(rows=6, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    t_widths = [Inches(1.8), Inches(2.3), Inches(2.4)]
    for row in table.rows:
        for i, w in enumerate(t_widths):
            row.cells[i].width = w

    headers = ["Aspecto Operativo", "Proceso Manual Anterior", "Cisco Automated v2.1"]
    for i, h_text in enumerate(headers):
        cell = table.cell(0, i)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 120, 120, 140, 140)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h_text)
        run.bold = True
        run.font.name = 'Arial'
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(255, 255, 255)

    rows_data = [
        ("Tiempo de Respuesta", "45 a 60 minutos por cotización compleja con múltiples líneas.", "Menos de 5 segundos de procesamiento automatizado al arrastrar el archivo."),
        ("Precisión Matemática", "Frecuentes errores de redondeo IEEE 754 y descuadre de centavos en Excel.", "Motor estricto roundFinancial(val) con tolerancia de error cero."),
        ("Suscripciones SaaS", "Confusión entre precios mensuales de CCW y contratos anuales.", "Detección universal de vigencia y concatenación comercial (1Y, 3Y)."),
        ("Negociación Comercial", "Ajuste manual ciego de celdas arriesgando el margen de ganancia.", "Algoritmo Goal Seek con blindaje legal del 6% de arancel aduanero."),
        ("Estándar de Entrega", "Excel con filas muertas, textos residuales y formatos inconsistentes.", "Libro Excel minimalista, horizontal, con logotipo oficial y aviso USD en G12.")
    ]

    for row_idx, data in enumerate(rows_data, start=1):
        bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(data):
            cell = table.cell(row_idx, col_idx)
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, 100, 100, 120, 120)
            p = cell.paragraphs[0]
            if col_idx == 0:
                run = p.add_run(text)
                run.bold = True
                run.font.color.rgb = RGBColor(15, 23, 42)
            elif col_idx == 2:
                run = p.add_run(text)
                run.bold = True
                run.font.color.rgb = RGBColor(4, 120, 87)
            else:
                run = p.add_run(text)
                run.font.color.rgb = RGBColor(71, 85, 105)
            p.paragraph_format.line_spacing = 1.1

    doc.add_paragraph().paragraph_format.space_before = Pt(16)

    p_concl = doc.add_paragraph()
    p_concl.add_run("Conclusión: ").bold = True
    p_concl.add_run(
        "Cisco Automated v2.1 unifica en una sola herramienta la inteligencia de negocio de preventa, "
        "el rigor financiero impositivo y la agilidad de entrega comercial, permitiendo a Intcomex "
        "escalar su volumen de negocios Cisco con máxima precisión y rentabilidad garantizada."
    )
    p_concl.paragraph_format.line_spacing = 1.15

    doc.save(docx_path)
    print(f"Document saved successfully to {docx_path}")

if __name__ == '__main__':
    workspace_dir = r"C:\Users\Adm\antigravity\Remix-Cotizador-Automático-Cisco---Intcomex"
    dist_dir = os.path.join(workspace_dir, "dist")
    img_path = os.path.join(dist_dir, "flujo_arquitectura_cisco.png")
    docx_path = os.path.join(dist_dir, "Documentacion_Cotizador_Cisco_Intcomex_v2.1.docx")
    
    create_flowchart_image(img_path)
    build_docx_documentation(docx_path, img_path)

    root_docx = os.path.join(workspace_dir, "Documentacion_Cotizador_Cisco_Intcomex_v2.1.docx")
    shutil.copyfile(docx_path, root_docx)
    print(f"Copied to root: {root_docx}")
