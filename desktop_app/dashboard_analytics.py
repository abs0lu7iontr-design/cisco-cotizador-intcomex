import os
import json
from typing import List, Dict, Any

class AnalyticsEngine:
    """
    Power BI Style Analytical Dashboard Engine.
    Generates structured analytics metrics, Partner/Client breakdowns,
    and HTML Plotly chart data for desktop dashboard embedding.
    """

    def __init__(self, db_manager):
        self.db = db_manager

    def generate_dashboard_metrics(self, user_id: str = None, is_admin: bool = False) -> Dict[str, Any]:
        """Calculates interactive metrics and chart data series."""
        estimates = self.db.get_estimates_list(user_id=user_id, is_admin=is_admin)

        total_estimates = len(estimates)
        total_revenue = sum(e["total_cotizado_intcomex"] for e in estimates)
        total_profit = sum(e["ganancia_intcomex_usd"] for e in estimates)
        total_recargo = sum(e["recargo_reglas_usd"] for e in estimates)

        # Partner Breakdown
        partner_stats: Dict[str, Dict[str, float]] = {}
        for e in estimates:
            p = e["partner_name"]
            if p not in partner_stats:
                partner_stats[p] = {"count": 0, "revenue": 0.0, "profit": 0.0}
            partner_stats[p]["count"] += 1
            partner_stats[p]["revenue"] += float(e["total_cotizado_intcomex"])
            partner_stats[p]["profit"] += float(e["ganancia_intcomex_usd"])

        # Client Final Breakdown
        client_stats: Dict[str, Dict[str, float]] = {}
        for e in estimates:
            c = e["client_final_name"]
            if c not in client_stats:
                client_stats[c] = {"count": 0, "revenue": 0.0, "profit": 0.0}
            client_stats[c]["count"] += 1
            client_stats[c]["revenue"] += float(e["total_cotizado_intcomex"])
            client_stats[c]["profit"] += float(e["ganancia_intcomex_usd"])

        return {
            "kpis": {
                "total_estimates": total_estimates,
                "total_revenue": round(total_revenue, 2),
                "total_profit": round(total_profit, 2),
                "total_recargo": round(total_recargo, 2),
                "avg_margin_pct": round((total_profit / total_revenue * 100), 2) if total_revenue > 0 else 5.0
            },
            "partner_breakdown": partner_stats,
            "client_breakdown": client_stats,
            "recent_estimates": estimates[:15]
        }

    def export_summary_csv(self, filepath: str, user_id: str = None, is_admin: bool = False) -> str:
        """Exports estimate summary table to CSV."""
        import csv
        estimates = self.db.get_estimates_list(user_id=user_id, is_admin=is_admin)

        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                "Estimate ID Cisco", "Usuario", "Partner", "Cliente Final",
                "Archivo Original", "Net Cisco USD", "Total Intcomex USD",
                "Ganancia USD", "Cant. Items", "Fecha Carga"
            ])
            for e in estimates:
                writer.writerow([
                    e["estimate_id_cisco"], e.get("username", "N/A"),
                    e["partner_name"], e["client_final_name"],
                    e["original_filename"], e["net_cisco_total"],
                    e["total_cotizado_intcomex"], e["ganancia_intcomex_usd"],
                    e["items_count"], e["created_at"]
                ])
        return filepath
