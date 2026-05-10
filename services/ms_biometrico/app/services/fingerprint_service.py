import cv2
import numpy as np
import logging
from flask import current_app

logger = logging.getLogger(__name__)

class FingerprintService:
    def __init__(self):
        # Umbral de coincidencia (ajustable)
        self.match_threshold = 30

    def _decode_and_enhance_image(self, image_bytes: bytes):
        """
        Decodifica la imagen y normaliza su contraste para absorber 
        diferencias de iluminación o presión del escáner.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError("No se pudo decodificar la imagen.")

        # CLAHE (Contrast Limited Adaptive Histogram Equalization)
        # Esto hace que las crestas grises se vuelvan más negras y el fondo más blanco.
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        img_enhanced = clahe.apply(img)

        return img_enhanced

    def verify(self, probe_bytes: bytes, reference_bytes: bytes) -> dict:
        """
        Verifica la similitud entre dos huellas usando el algoritmo ORB.
        """
        try:
            # 1. Decodificar imágenes
            img1 = self._decode_and_enhance_image(probe_bytes)
            img2 = self._decode_and_enhance_image(reference_bytes)

            # 2. Inicializar detector ORB
            # ORB es una alternativa eficiente a SIFT/SURF para matching de características
            orb = cv2.ORB_create(nfeatures=1000)

            # 3. Encontrar keypoints y descriptores
            kp1, des1 = orb.detectAndCompute(img1, None)
            kp2, des2 = orb.detectAndCompute(img2, None)

            # Validar que se hayan extraído descriptores (si no, la imagen es mala)
            if des1 is None or des2 is None:
                return {
                    "verified": False,
                    "score": 0.0,
                    "message": "Calidad de imagen insuficiente para extraer características."
                }

            # 4. Comparador de fuerza bruta (BFMatcher) SIN crossCheck
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

            # Usar k=2 para obtener los dos mejores matches
            matches = bf.knnMatch(des1, des2, k=2)

            # Aplicar Lowe's Ratio Test con validación de seguridad
            good_matches = []
            for match_pair in matches:
                # Nos aseguramos de que haya encontrado al menos 2 vecinos
                if len(match_pair) == 2:
                    m, n = match_pair
                    # Si la distancia del mejor (m) es mucho menor que la del segundo mejor (n)
                    if m.distance < 0.85 * n.distance:
                        good_matches.append(m)

            # Aplicar RANSAC si hay suficientes puntos
            if len(good_matches) > 10:
                src_pts = np.float32([kp1[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp2[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

                # Esta función encuentra la transformación geométrica y detecta outliers
                M, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 8.0)
                
                # Prevenir error si findHomography falla y devuelve None
                if mask is not None:
                    matches_mask = mask.ravel().tolist()
                    # El score real son solo los puntos que pasaron el filtro RANSAC
                    score = sum(matches_mask)
                else:
                    score = 0
            else:
                score = 0

            # 8. Decisión final
            verified = score >= self.match_threshold

            return {
                "verified": bool(verified),
                "score": float(score),
                "message": "Coincidencia biométrica confirmada" if verified else "Las huellas no coinciden suficientemente"
            }

        except Exception as e:
            logger.error(f"Error en FingerprintService (ORB): {str(e)}")
            raise e

def get_fingerprint_service():
    """
    Factory para obtener la instancia del servicio.
    """
    return FingerprintService()
