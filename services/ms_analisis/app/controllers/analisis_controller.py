from flask import Blueprint, jsonify
from app.services.analisis_service import AnalysisService

analisis_bp = Blueprint("analysis", __name__)
service = AnalysisService()


@analisis_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ms_analisis", "port": 5004}), 200


@analisis_bp.route("/summary", methods=["GET"])
def summary():
    """GET /api/analisis/summary — Returns vote counts and biometric audit data."""
    return jsonify({"data": service.summary()}), 200


@analisis_bp.route("/charts/bar", methods=["GET"])
def chart_bar():
    """GET /api/analisis/charts/bar — Bar chart as base64 PNG."""
    img = service.bar_chart_base64()
    if img is None:
        return jsonify({"error": "No votes registered yet"}), 404
    return jsonify({"image_base64": img, "format": "png"}), 200


@analisis_bp.route("/charts/pie", methods=["GET"])
def chart_pie():
    """GET /api/analisis/charts/pie — Pie chart as base64 PNG."""
    img = service.pie_chart_base64()
    if img is None:
        return jsonify({"error": "No votes registered yet"}), 404
    return jsonify({"image_base64": img, "format": "png"}), 200
