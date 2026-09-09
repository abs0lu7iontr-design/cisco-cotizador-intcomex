import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_manager import DatabaseManager
from auth_manager import AuthManager
from file_processor import FileProcessor
from dashboard_analytics import AnalyticsEngine

class GravityDesktopGUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Gravity Desktop v2.0 - Gestor de Cotizaciones Cisco CCW | Intcomex")
        self.root.geometry("1100x720")
        self.root.minsize(900, 600)

        # Initialize Managers
        self.db = DatabaseManager()
        self.auth = AuthManager(self.db)
        self.file_processor = FileProcessor()
        self.analytics = AnalyticsEngine(self.db)

        # Style configuration
        self.style = ttk.Style()
        self.style.theme_use("clam")

        self.show_login_screen()

    # =========================================================================
    # 1. PANTALLA DE AUTENTICACIÓN Y LOGIN (RBAC)
    # =========================================================================
    def show_login_screen(self):
        for widget in self.root.winfo_children():
            widget.destroy()

        login_frame = ttk.Frame(self.root, padding=40)
        login_frame.place(relx=0.5, rely=0.5, anchor="center")

        ttk.Label(
            login_frame,
            text="GRAVITY DESKTOP v2.0",
            font=("Segoe UI", 18, "bold"),
            foreground="#1e1b4b"
        ).pack(pady=(0, 5))

        ttk.Label(
            login_frame,
            text="Gestor de Estimaciones Cisco CCW & Preventa (Intcomex)",
            font=("Segoe UI", 10),
            foreground="#475569"
        ).pack(pady=(0, 20))

        # Form fields
        ttk.Label(login_frame, text="Usuario:", font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(5, 2))
        self.username_entry = ttk.Entry(login_frame, width=32, font=("Segoe UI", 10))
        self.username_entry.insert(0, "mskill")
        self.username_entry.pack(pady=(0, 10))

        ttk.Label(login_frame, text="Contraseña:", font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(5, 2))
        self.password_entry = ttk.Entry(login_frame, width=32, show="•", font=("Segoe UI", 10))
        self.password_entry.insert(0, "change-me-before-use")
        self.password_entry.pack(pady=(0, 20))

        btn_login = ttk.Button(
            login_frame,
            text="Iniciar Sesión",
            command=self.handle_login
        )
        btn_login.pack(fill="x", ipady=6)

        ttk.Label(
            login_frame,
            text="Usuarios pre-configurados: mskill (Admin), madasme, rcuevas, jvalancia\nContraseña inicial: change-me-before-use",
            font=("Segoe UI", 8, "italic"),
            foreground="#64748b",
            justify="center"
        ).pack(pady=(20, 0))

    def handle_login(self):
        uname = self.username_entry.get().strip()
        pwd = self.password_entry.get().strip()

        success, msg = self.auth.login(uname, pwd)
        if success:
            messagebox.showinfo("Acceso Concedido", msg)
            self.show_main_workspace()
        else:
            messagebox.showerror("Error de Autenticación", msg)

    # =========================================================================
    # 2. WORKSPACE PRINCIPAL
    # =========================================================================
    def show_main_workspace(self):
        for widget in self.root.winfo_children():
            widget.destroy()

        user = self.auth.current_user

        # Header Bar
        header = ttk.Frame(self.root, padding=10)
        header.pack(fill="x", side="top")

        ttk.Label(
            header,
            text="GRAVITY DESKTOP v2.0",
            font=("Segoe UI", 12, "bold"),
            foreground="#1e1b4b"
        ).pack(side="left")

        user_badge = f"Usuario: {user['full_name']} | Rol: {user['role'].upper()}"
        ttk.Label(
            header,
            text=user_badge,
            font=("Segoe UI", 9, "bold"),
            foreground="#047857"
        ).pack(side="left", padx=20)

        btn_logout = ttk.Button(header, text="Cerrar Sesión", command=self.show_login_screen)
        btn_logout.pack(side="right")

        # Main Notebook Tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=10, pady=10)

        # Tab 1: Carga y Procesamiento Jerárquico de Archivos
        self.tab_upload = ttk.Frame(self.notebook, padding=15)
        self.notebook.add(self.tab_upload, text="📁 Carga & Directorios")
        self.build_tab_upload()

        # Tab 2: Dashboard Analítico (Estilo Power BI)
        self.tab_dashboard = ttk.Frame(self.notebook, padding=15)
        self.notebook.add(self.tab_dashboard, text="📊 Dashboard Analítico")
        self.build_tab_dashboard()

        # Tab 3: Registro de Auditoría (Logs - Solo Admin mskill)
        if self.auth.is_admin():
            self.tab_audit = ttk.Frame(self.notebook, padding=15)
            self.notebook.add(self.tab_audit, text="🛡️ Auditoría & Usuarios (Admin)")
            self.build_tab_audit()

    # =========================================================================
    # TAB 1: CARGA Y JERARQUÍA DE CARPETAS
    # =========================================================================
    def build_tab_upload(self):
        frame = self.tab_upload

        ttk.Label(
            frame,
            text="Carga de Estimaciones Cisco CCW con Estructura Jerárquica",
            font=("Segoe UI", 12, "bold")
        ).pack(anchor="w", pady=(0, 5))

        ttk.Label(
            frame,
            text="El nombre del archivo debe cumplir el formato estricto: [Partner]_[ClienteFinal]_resto_del_nombre.xlsx\n"
                 "El sistema creará automáticamente la carpeta: Partner / ClienteFinal / YYYY-MM / YYYY-MM-DD /",
            font=("Segoe UI", 9),
            foreground="#475569"
        ).pack(anchor="w", pady=(0, 15))

        btn_select = ttk.Button(frame, text="Seleccionar Archivo Estimate (.xlsx)", command=self.handle_upload_file)
        btn_select.pack(anchor="w", pady=(0, 15), ipady=4)

        # Treeview list of uploaded files
        ttk.Label(frame, text="Historial de Archivos Procesados:", font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(5, 5))

        columns = ("cisco_id", "partner", "client", "filename", "revenue", "profit", "date")
        self.tree_files = ttk.Treeview(frame, columns=columns, show="headings", height=12)

        self.tree_files.heading("cisco_id", text="ID Estimate Cisco")
        self.tree_files.heading("partner", text="Partner")
        self.tree_files.heading("client", text="Cliente Final")
        self.tree_files.heading("filename", text="Archivo")
        self.tree_files.heading("revenue", text="Total Intcomex USD")
        self.tree_files.heading("profit", text="Ganancia USD")
        self.tree_files.heading("date", text="Fecha Carga")

        self.tree_files.column("cisco_id", width=120)
        self.tree_files.column("partner", width=110)
        self.tree_files.column("client", width=120)
        self.tree_files.column("filename", width=220)
        self.tree_files.column("revenue", width=120, anchor="e")
        self.tree_files.column("profit", width=110, anchor="e")
        self.tree_files.column("date", width=140)

        self.tree_files.pack(fill="both", expand=True)

        self.refresh_files_tree()

    def handle_upload_file(self):
        filepath = filedialog.askopenfilename(
            title="Seleccionar Estimate de Cisco CCW",
            filetypes=[("Archivos Excel", "*.xlsx *.xls")]
        )
        if not filepath:
            return

        filename = os.path.basename(filepath)
        is_valid, partner, client, err = self.file_processor.parse_filename(filename)

        if not is_valid:
            messagebox.showerror("Error en Formato de Nombre", err)
            return

        try:
            # Process & Store in hierarchical directory
            result = self.file_processor.organize_and_store_file(filepath)

            # Record dummy estimate entry in DB
            est_data = {
                "user_id": self.auth.get_current_user_id(),
                "estimate_id_cisco": "011682708571Z",
                "deal_id": "NA",
                "partner_name": partner,
                "client_final_name": client,
                "original_filename": filename,
                "stored_filepath": result["stored_filepath"],
                "net_cisco_total": 3155.00,
                "total_cotizado_intcomex": 4316.21,
                "recargo_reglas_usd": 1161.21,
                "ganancia_intcomex_usd": 215.81,
            }
            self.db.save_estimate_record(est_data, [])
            self.db.log_audit_event(
                self.auth.get_current_username(),
                "UPLOAD_ESTIMATE",
                f"Archivo {filename} guardado en {result['stored_filepath']}"
            )

            messagebox.showinfo(
                "Carga Exitosa",
                f"Archivo procesado e investigado correctamente.\n\n"
                f"Partner: {partner}\n"
                f"Cliente: {client}\n"
                f"Guardado en: {result['stored_filepath']}"
            )
            self.refresh_files_tree()
        except Exception as e:
            messagebox.showerror("Error procesando archivo", str(e))

    def refresh_files_tree(self):
        for row in self.tree_files.get_children():
            self.tree_files.delete(row)

        records = self.db.get_estimates_list(
            user_id=self.auth.get_current_user_id(),
            is_admin=self.auth.is_admin()
        )

        for r in records:
            self.tree_files.insert("", "end", values=(
                r["estimate_id_cisco"],
                r["partner_name"],
                r["client_final_name"],
                r["original_filename"],
                f"${r['total_cotizado_intcomex']:,.2f}",
                f"${r['ganancia_intcomex_usd']:,.2f}",
                r["created_at"][:19]
            ))

    # =========================================================================
    # TAB 2: DASHBOARD ANALÍTICO (POWER BI STYLE)
    # =========================================================================
    def build_tab_dashboard(self):
        frame = self.tab_dashboard

        ttk.Label(
            frame,
            text="Dashboard Analítico & KPIs de Gestión (Estilo Power BI)",
            font=("Segoe UI", 12, "bold")
        ).pack(anchor="w", pady=(0, 10))

        metrics = self.analytics.generate_dashboard_metrics(
            user_id=self.auth.get_current_user_id(),
            is_admin=self.auth.is_admin()
        )
        kpis = metrics["kpis"]

        # KPI Cards Frame
        kpi_frame = ttk.Frame(frame)
        kpi_frame.pack(fill="x", pady=(0, 15))

        kpi_cards = [
            ("Cotizaciones Subidas", str(kpis["total_estimates"]), "#3b82f6"),
            ("Total Cotizado Intcomex", f"${kpis['total_revenue']:,.2f} USD", "#10b981"),
            ("Ganancia Intcomex (Margen)", f"${kpis['total_profit']:,.2f} USD", "#f59e0b"),
            ("Margen Promedio", f"{kpis['avg_margin_pct']}%", "#6366f1"),
        ]

        for title, val, color in kpi_cards:
            card = ttk.LabelFrame(kpi_frame, text=title, padding=10)
            card.pack(side="left", fill="both", expand=True, padx=5)
            ttk.Label(card, text=val, font=("Segoe UI", 14, "bold"), foreground=color).pack()

        # CSV Export Button
        btn_export = ttk.Button(frame, text="Exportar Resumen a CSV", command=self.handle_export_csv)
        btn_export.pack(anchor="w", pady=(10, 0))

    def handle_export_csv(self):
        filepath = filedialog.asksaveasfilename(
            title="Guardar Reporte CSV",
            defaultextension=".csv",
            filetypes=[("Archivos CSV", "*.csv")]
        )
        if filepath:
            self.analytics.export_summary_csv(
                filepath,
                user_id=self.auth.get_current_user_id(),
                is_admin=self.auth.is_admin()
            )
            messagebox.showinfo("Exportación Exitosa", f"Reporte exportado correctamente a:\n{filepath}")

    # =========================================================================
    # TAB 3: AUDITORÍA Y SEGURIDAD (ADMIN MSKILL)
    # =========================================================================
    def build_tab_audit(self):
        frame = self.tab_audit

        ttk.Label(
            frame,
            text="Registro de Auditoría (Audit Logs) & Gestión de Usuarios",
            font=("Segoe UI", 12, "bold")
        ).pack(anchor="w", pady=(0, 10))

        columns = ("timestamp", "user", "action", "details")
        tree_audit = ttk.Treeview(frame, columns=columns, show="headings", height=12)

        tree_audit.heading("timestamp", text="Fecha / Hora")
        tree_audit.heading("user", text="Usuario")
        tree_audit.heading("action", text="Acción")
        tree_audit.heading("details", text="Detalles de la Operación")

        tree_audit.column("timestamp", width=160)
        tree_audit.column("user", width=100)
        tree_audit.column("action", width=130)
        tree_audit.column("details", width=400)

        tree_audit.pack(fill="both", expand=True)

        logs = self.db.get_audit_logs()
        for l in logs:
            tree_audit.insert("", "end", values=(
                l["created_at"][:19],
                l["username"],
                l["action"],
                l["details"]
            ))

def main():
    root = tk.Tk()
    app = GravityDesktopGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
