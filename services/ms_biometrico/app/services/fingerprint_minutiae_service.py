import cv2
import numpy as np
import logging
from skimage.morphology import skeletonize
from scipy.spatial.distance import cdist

logger = logging.getLogger(__name__)

class FingerprintMinutiaeService:
    def __init__(self):
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

    def preprocess(self, image_bytes):
        """
        Pipeline: Grayscale -> CLAHE -> Binarización -> Thinning
        """
        try:
            # 1. Decodificar imagen
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            if img is None:
                raise ValueError("No se pudo decodificar la imagen")

            # 2. Normalización (CLAHE)
            img_norm = self.clahe.apply(img)

            # 3. Binarización de Otsu (Invertida para que las crestas sean blancas/1)
            # Generalmente los lectores dan fondo claro (255) y crestas oscuras (0)
            _, img_bin = cv2.threshold(img_norm, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

            # 4. Thinning (Adelgazamiento)
            # Skeletonize requiere valores 0 y 1
            skeleton = skeletonize(img_bin // 255).astype(np.uint8)

            return skeleton
        except Exception as e:
            logger.error(f"Error en pre-procesamiento: {str(e)}")
            return None

    def extract_minutiae(self, skeleton):
        """
        Extrae minucias usando el algoritmo de Crossing Number (CN)
        """
        minutiae = []
        rows, cols = skeleton.shape

        for i in range(1, rows - 1):
            for j in range(1, cols - 1):
                if skeleton[i, j] == 1:
                    # Vecindad de 8 píxeles
                    # P9 P2 P3
                    # P8 P1 P4
                    # P7 P6 P5
                    block = [
                        skeleton[i-1, j],   # P2
                        skeleton[i-1, j+1], # P3
                        skeleton[i, j+1],   # P4
                        skeleton[i+1, j+1], # P5
                        skeleton[i+1, j],   # P6
                        skeleton[i+1, j-1], # P7
                        skeleton[i, j-1],   # P8
                        skeleton[i-1, j-1]  # P9
                    ]
                    
                    # Crossing Number = 0.5 * sum|P_i - P_{i+1}|
                    cn = 0
                    for k in range(8):
                        cn += abs(int(block[k]) - int(block[(k + 1) % 8]))
                    cn = 0.5 * cn

                    if cn == 1:
                        # Terminación
                        angle = self._calculate_orientation(skeleton, i, j, "termination")
                        minutiae.append({"x": j, "y": i, "type": 1, "angle": angle, "quality": 100})
                    elif cn == 3:
                        # Bifurcación
                        angle = self._calculate_orientation(skeleton, i, j, "bifurcation")
                        minutiae.append({"x": j, "y": i, "type": 2, "angle": angle, "quality": 100})

        # Filtrado básico (eliminar minucias cerca de bordes o muy juntas)
        return self._filter_minutiae(minutiae, rows, cols)

    def _calculate_orientation(self, skeleton, y, x, m_type):
        # Simplificación: En un sistema real se usa el gradiente local
        # Aquí devolveremos un valor base para cumplir con el esquema ISO
        return 0.0

    def _filter_minutiae(self, minutiae, rows, cols, dist_threshold=5):
        # Eliminar minucias demasiado cerca de los bordes (ruido común)
        filtered = [m for m in minutiae if 10 < m["x"] < cols - 10 and 10 < m["y"] < rows - 10]
        
        # Eliminar minucias duplicadas o demasiado cercanas entre sí
        final = []
        if not filtered: return []
        
        for m in filtered:
            is_valid = True
            for other in final:
                d = ((m["x"] - other["x"])**2 + (m["y"] - other["y"])**2)**0.5
                if d < dist_threshold:
                    is_valid = False
                    break
            if is_valid:
                final.append(m)
        return final

    def generate_iso_template(self, minutiae_list):
        """
        Genera una estructura compatible con ISO/IEC 19794-2 (formato JSON)
        """
        return {
            "format_id": "FMR", # Finger Minute Record
            "version": "2011",
            "minutiae_count": len(minutiae_list),
            "minutiae": minutiae_list
        }

    def calculate_score(self, template_a, template_b):
        """
        Compara dos sets de minucias intentando alinearlos.
        Retorna un score de 0 a 100.
        """
        pts_a = np.array([[m["x"], m["y"]] for m in template_a["minutiae"]])
        pts_b = np.array([[m["x"], m["y"]] for m in template_b["minutiae"]])

        if len(pts_a) == 0 or len(pts_b) == 0:
            return 0.0

        # Algoritmo de alineación por traslación (Brute-force alignment)
        # Tomamos una muestra de puntos de A y buscamos el mejor offset (dx, dy)
        # que maximice los matches con B.
        best_matches = 0
        
        # Para optimizar, tomamos solo las primeras N minucias como candidatos de referencia
        sample_size = min(15, len(pts_a))
        
        for i in range(sample_size):
            ref_a = pts_a[i]
            # Probamos alinear ref_a con cada punto en B
            for j in range(len(pts_b)):
                ref_b = pts_b[j]
                
                # Calcular el desplazamiento necesario para alinear pts_a[i] con pts_b[j]
                dx = ref_b[0] - ref_a[0]
                dy = ref_b[1] - ref_a[1]
                
                # Aplicar traslación a todos los puntos de A
                pts_a_transformed = pts_a + [dx, dy]
                
                # Calcular matches con este offset
                distances = cdist(pts_a_transformed, pts_b, 'euclidean')
                threshold = 12 # Tolerancia de píxeles
                
                current_matches = 0
                used_b = set()
                for k in range(len(pts_a_transformed)):
                    row = distances[k]
                    # Solo consideramos puntos dentro de la vecindad
                    close_indices = np.where(row < threshold)[0]
                    for idx in close_indices:
                        if idx not in used_b:
                            current_matches += 1
                            used_b.add(idx)
                            break
                
                if current_matches > best_matches:
                    best_matches = current_matches
            
            # Early exit si ya tenemos un score muy alto
            if (best_matches / max(len(pts_a), len(pts_b))) * 100 > 80:
                break

        score = (best_matches / max(len(pts_a), len(pts_b))) * 100
        logger.info(f"Matching finalizado. Score: {score:.2f} (Matches: {best_matches})")
        return score

def get_fingerprint_minutiae_service():
    return FingerprintMinutiaeService()
