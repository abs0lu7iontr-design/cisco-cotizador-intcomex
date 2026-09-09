import os
import sys
from datetime import datetime

# Add desktop_app folder to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db_manager import DatabaseManager
from auth_manager import AuthManager
from file_processor import FileProcessor
from dashboard_analytics import AnalyticsEngine

def print_banner():
    print("=" * 75)
    print(" GRAVITY DESKTOP v2.0 - GESTOR DE ESTIMACIONES CISCO CCW (INTCOMEX) ")
    print(" Stack: PySide6/Tkinter + Supabase/SQLite + RBAC + Audit Logs")
    print("=" * 75)

class GravityDesktopApp:
    def __init__(self):
        print_banner()
        self.db = DatabaseManager()
        self.auth = AuthManager(self.db)
        self.file_processor = FileProcessor()
        self.analytics = AnalyticsEngine(self.db)

    def run_cli_demo(self):
        """Interactive desktop CLI launcher demonstrating full system workflow."""
        print("\n[STEP 1] INICIO DE SESIÓN Y AUTENTICACIÓN RBAC")
        print("Usuarios Pre-configurados:")
        print(" 1) mskill    (Rol: ADMINISTRADOR)")
        print(" 2) madasme   (Rol: PRODUCT MANAGER)")
        print(" 3) rcuevas   (Rol: PRODUCT MANAGER)")
        print(" 4) jvalancia (Rol: PRODUCT MANAGER)")
        print("Contraseña por defecto: change-me-before-use\n")

        # Simulate login as mskill (Admin)
        success, msg = self.auth.login("mskill", "change-me-before-use")
        print(f"[*] Resultado Login mskill: {msg}")

        # Simulate file upload with strict regex naming: [Partner]_[ClienteFinal]_name.xlsx
        sample_filename = "Intcomex_BancoDeChile_Estimate_CCW_2026.xlsx"
        print(f"\n[STEP 2] PROCESAMIENTO Y JERARQUÍA DE CARPETAS DE ARCHIVO")
        print(f"[*] Analizando nombre del archivo: '{sample_filename}'")
        
        is_valid, partner, client, err = self.file_processor.parse_filename(sample_filename)
        print(f" -> Formato Válido: {is_valid}")
        print(f" -> Partner Extraído: '{partner}'")
        print(f" -> Cliente Final Extraído: '{client}'")

        if is_valid:
            # Simulate saving file to hierarchical folder structure: Partner / ClienteFinal / YYYY-MM / YYYY-MM-DD /
            today = datetime.now()
            month_str = today.strftime("%Y-%m")
            day_str = today.strftime("%Y-%m-%d")
            rel_path = os.path.join(partner, client, month_str, day_str, sample_filename)
            print(f" -> Ruta Jerárquica Creada: gravity_storage/{rel_path}")

        print(f"\n[STEP 3] DASHBOARD ANALÍTICO (ESTILO POWER BI)")
        kpis = self.analytics.generate_dashboard_metrics(
            user_id=self.auth.get_current_user_id(),
            is_admin=self.auth.is_admin()
        )
        print(" [*] KPIs Globales del Sistema:")
        print(f"  - Total Cotizaciones Subidas: {kpis['kpis']['total_estimates']}")
        print(f"  - Total Revenue Intcomex: ${kpis['kpis']['total_revenue']} USD")
        print(f"  - Total Ganancia (Margen Real): ${kpis['kpis']['total_profit']} USD")
        print(f"  - Margen Promedio: {kpis['kpis']['avg_margin_pct']}%")

        print(f"\n[STEP 4] REGISTRO DE AUDITORÍA (AUDIT LOGS)")
        logs = self.db.get_audit_logs()
        for log in logs[:5]:
            print(f"  [{log['created_at']}] User: {log['username']} | Action: {log['action']} | Details: {log['details']}")

        print("\n" + "=" * 75)
        print("GRAVITY DESKTOP LISTO Y CONFIGURADO CORRECTAMENTE.")
        print("Motor HTML index.html integrado en dist/index.html (1.33 MB).")
        print("=" * 75)

if __name__ == "__main__":
    app = GravityDesktopApp()
    app.run_cli_demo()
