import io
import base64
import matplotlib
matplotlib.use("Agg")   # required in Docker — no display
import matplotlib.pyplot as plt
from app.repositories.analisis_repository import AnalysisRepository


class AnalysisService:
    """Generates statistics and charts from vote data."""

    def __init__(self):
        self.repo = AnalysisRepository()

    def summary(self) -> dict:
        return {
            "total_votes":         self.repo.total_votes(),
            "count_by_candidate":  self.repo.count_by_candidate(),
            "votes_per_hour":      self.repo.votes_per_hour(),
            "biometric_audit":     self.repo.biometric_audit(),
        }

    def _to_base64_png(self, fig) -> str:
        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=120)
        buf.seek(0)
        encoded = base64.b64encode(buf.read()).decode("utf-8")
        plt.close(fig)
        return encoded

    def bar_chart_base64(self) -> str | None:
        data = self.repo.count_by_candidate()
        if not data:
            return None

        labels = [d["candidate_name"] for d in data]
        totals = [d["total"] for d in data]

        fig, ax = plt.subplots(figsize=(9, 5))
        bars = ax.bar(labels, totals, color="#4A90D9", edgecolor="white", width=0.5)
        ax.set_title("Resultados de Votación", fontsize=16, fontweight="bold")
        ax.set_xlabel("Candidato")
        ax.set_ylabel("Votos")
        ax.bar_label(bars, padding=4)
        ax.set_ylim(0, max(totals) * 1.25)
        fig.tight_layout()
        return self._to_base64_png(fig)

    def pie_chart_base64(self) -> str | None:
        data = self.repo.count_by_candidate()
        if not data:
            return None

        labels = [d["candidate_name"] for d in data]
        sizes  = [d["total"] for d in data]
        colors = ["#4A90D9", "#E67E22", "#2ECC71", "#9B59B6", "#E74C3C"]

        fig, ax = plt.subplots(figsize=(7, 7))
        ax.pie(sizes, labels=labels, autopct="%1.1f%%",
               colors=colors[:len(sizes)], startangle=140)
        ax.set_title("Distribución de Votos", fontsize=16, fontweight="bold")
        fig.tight_layout()
        return self._to_base64_png(fig)
