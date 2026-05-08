from flask import Blueprint, jsonify, request
from app.services.analisis_service import AnalysisService

analisis_bp = Blueprint("analysis", __name__)
service = AnalysisService()


@analisis_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ms_analisis", "port": 5004}), 200


@analisis_bp.route("/summary", methods=["GET"])
def summary():
    """GET /api/analisis/summary — Returns vote counts and biometric audit data."""
    filters = {}
    if request.args.get("country"):
        filters["country"] = request.args.get("country")
    if request.args.get("department"):
        filters["department"] = request.args.get("department")
    if request.args.get("province"):
        filters["province"] = request.args.get("province")
    if request.args.get("district"):
        filters["district"] = request.args.get("district")
        
    return jsonify({"data": service.summary(**filters)}), 200


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
