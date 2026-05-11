import logging
from flask import current_app
from webauthn import (
    generate_authentication_options,
    verify_authentication_response,
    generate_registration_options,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AuthenticationCredential,
    RegistrationCredential,
    AuthenticatorSelectionCriteria,
    AuthenticatorAttachment,
    UserVerificationRequirement,
    ResidentKeyRequirement,
    AttestationConveyancePreference,
)
from webauthn.helpers.exceptions import InvalidAuthenticationResponse

logger = logging.getLogger(__name__)

class WebAuthnFingerprintService:
    def __init__(self):
        self.rp_id = current_app.config.get("WEBAUTHN_RP_ID", "localhost")
        self.origin = current_app.config.get("WEBAUTHN_ORIGIN", "http://localhost:5173")
        self.rp_name = "VoteSystem Admin Portal"

    def generate_options(self, credential_id: str) -> dict:
        try:
            allow_credentials = []
            if credential_id:
                allow_credentials.append({
                    "id": credential_id.encode('utf-8') if isinstance(credential_id, str) else credential_id,
                    "type": "public-key"
                })

            options = generate_authentication_options(
                rp_id=self.rp_id,
                allow_credentials=allow_credentials,
                user_verification=UserVerificationRequirement.REQUIRED
            )

            return {
                "success": True,
                "options": options,
                "challenge": options.challenge
            }
        except Exception as e:
            logger.error(f"Error generando opciones WebAuthn: {str(e)}")
            return {"success": False, "error": str(e)}

    def verify_response(self, credential_response: dict, expected_challenge: bytes, public_key: bytes) -> dict:
        try:
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
                "score": 100.0,
                "message": "Huella verificada correctamente",
                "sign_count": verification.new_sign_count
            }
        except InvalidAuthenticationResponse as e:
            logger.warning(f"Fallo de validación WebAuthn: {str(e)}")
            return {"verified": False, "score": 0.0, "message": "Firma biométrica inválida"}
        except Exception as e:
            logger.error(f"Error interno WebAuthn: {str(e)}")
            return {"verified": False, "score": 0.0, "message": f"Error: {str(e)}"}

    def generate_registration_options(self, user_id: int, user_name: str) -> dict:
        try:
            options = generate_registration_options(
                rp_id=self.rp_id,
                rp_name=self.rp_name,
                user_id=str(user_id).encode('utf-8'),
                user_name=user_name,
                attestation=AttestationConveyancePreference.NONE,
                authenticator_selection=AuthenticatorSelectionCriteria(
                    authenticator_attachment=AuthenticatorAttachment.PLATFORM,
                    user_verification=UserVerificationRequirement.REQUIRED,
                    resident_key=ResidentKeyRequirement.PREFERRED
                )
            )
            return {
                "success": True,
                "options": options,
                "challenge": options.challenge
            }
        except Exception as e:
            logger.error(f"Error generando registro WebAuthn: {str(e)}")
            return {"success": False, "error": str(e)}

    def verify_registration_response(self, credential_response: dict, expected_challenge: bytes) -> dict:
        try:
            credential = RegistrationCredential.parse_raw(credential_response)
            
            verification = verify_registration_response(
                credential=credential,
                expected_challenge=expected_challenge,
                expected_rp_id=self.rp_id,
                expected_origin=self.origin,
                require_user_verification=True
            )
            
            return {
                "verified": True,
                "credential_id": verification.credential_id.decode('utf-8') if isinstance(verification.credential_id, bytes) else verification.credential_id,
                "public_key": verification.credential_public_key.hex()
            }
        except Exception as e:
            logger.error(f"Fallo registro WebAuthn: {str(e)}")
            return {"verified": False, "error": str(e)}

def get_fingerprint_service():
    return WebAuthnFingerprintService()