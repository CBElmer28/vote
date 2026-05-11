import logging
from flask import current_app
from webauthn import (
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers.structs import AuthenticationCredential
from webauthn.helpers.exceptions import InvalidAuthenticationResponse

logger = logging.getLogger(__name__)

class WebAuthnFingerprintService:
    def __init__(self):
        # El RP_ID (Relying Party ID) es el dominio de tu frontend (ej. "localhost" o "midominio.com")
        self.rp_id = current_app.config.get("WEBAUTHN_RP_ID", "localhost")
        # El ORIGIN es la URL exacta de tu frontend (ej. "http://localhost:3000")
        self.origin = current_app.config.get("WEBAUTHN_ORIGIN", "http://localhost:3000")

    def generate_options(self, credential_id: str) -> dict:
        """
        Paso 1: Genera el desafío criptográfico que se enviará al frontend.
        Requiere el credential_id que se guardó en la DB durante el registro.
        """
        try:
            # Convierte el string guardado a bytes para WebAuthn
            allow_credentials = []
            if credential_id:
                # Asumimos que el credential_id está guardado en base64 o hex, 
                # pero webauthn maneja internamente las conversiones en la v2
                allow_credentials.append({
                    "id": credential_id.encode('utf-8') if isinstance(credential_id, str) else credential_id,
                    "type": "public-key"
                })

            options = generate_authentication_options(
                rp_id=self.rp_id,
                allow_credentials=allow_credentials,
                user_verification="required" # Exige que el usuario ponga la huella/FaceID
            )

            # Se debe guardar el "challenge" temporalmente (ej. en sesión o Redis)
            # para validarlo en el Paso 2.
            return {
                "success": True,
                "options": options,
                "challenge": options.challenge # El controlador deberá guardar esto
            }
        except Exception as e:
            logger.error(f"Error generando opciones WebAuthn: {str(e)}")
            return {"success": False, "error": str(e)}

    def verify_response(self, credential_response: dict, expected_challenge: bytes, public_key: bytes) -> dict:
        """
        Paso 2: Verifica la firma enviada por el celular contra la llave pública.
        """
        try:
            # Parsear la respuesta del frontend
            credential = AuthenticationCredential.parse_raw(credential_response)

            verification = verify_authentication_response(
                credential=credential,
                expected_challenge=expected_challenge,
                expected_rp_id=self.rp_id,
                expected_origin=self.origin,
                credential_public_key=public_key,
                credential_current_sign_count=0,
                require_user_verification=True
            )

            return {
                "verified": True,
                "score": 100.0, # WebAuthn es 100% o 0% (Boolean)
                "message": "Huella verificada correctamente por el hardware",
                "sign_count": verification.new_sign_count
            }

        except InvalidAuthenticationResponse as e:
            logger.warning(f"Fallo de validación WebAuthn: {str(e)}")
            return {"verified": False, "score": 0.0, "message": "Firma biométrica inválida"}
        except Exception as e:
            logger.error(f"Error interno WebAuthn: {str(e)}")
            return {"verified": False, "score": 0.0, "message": f"Error: {str(e)}"}

def get_fingerprint_service():
    return WebAuthnFingerprintService()