import requests
import json
import jwt
import time
import sys

# Constantes
API_GATEWAY = "http://localhost:80"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

def log(msg, color=Colors.RESET):
    print(f"{color}{msg}{Colors.RESET}")

def run_security_tests():
    log("Iniciando Pruebas de Seguridad (Penetration Testing Automatizado)...", Colors.GREEN)
    
    # ---------------------------------------------------------
    # TEST 1: Rate Limiting & Brute Force (OWASP A07)
    # ---------------------------------------------------------
    log("\n[Test 1] Validando Rate Limiting en Login (Fuerza Bruta)...", Colors.YELLOW)
    endpoint_login = f"{API_GATEWAY}/api/usuarios/auth/login"
    
    # El limite en el controlador es "10 per minute"
    # Dado que ms-usuarios esta escalado a 3 replicas con limitador in-memory,
    # incrementamos a 35 peticiones para forzar a que al menos una replica alcance el limite (10) y retorne 429.
    rate_limit_triggered = False
    for i in range(35):
        res = requests.post(endpoint_login, json={"dni": "00000000"})
        if res.status_code == 429:
            log(f"  - Peticion {i+1}: Bloqueada por Rate Limit (429).")
            rate_limit_triggered = True
            break
        else:
            log(f"  - Peticion {i+1}: Fallida normal (401).")
            
    if rate_limit_triggered:
        log("  [EXITO] El sistema previno el ataque de fuerza bruta.", Colors.GREEN)
    else:
        log("  [FALLO] El sistema NO bloqueo las peticiones masivas (Esperaba 429).", Colors.RED)


    # IMPORTANTE: Esperamos para que el Limiter expire, o usamos un endpoint distinto
    log("  - Esperando 10 segundos para disipar parte del Rate Limit (si aplica en otras rutas)...")
    time.sleep(10)

    # ---------------------------------------------------------
    # TEST 2: SQL Injection (SQLi) (OWASP A03)
    # ---------------------------------------------------------
    log("\n[Test 2] Validando Evasion de Inyeccion SQL (SQLi)...", Colors.YELLOW)
    
    # Intentamos inyectar SQL en la busqueda por DNI o Email
    sqli_payloads = [
        "12345678' OR '1'='1",
        "admin@test.local' OR '1'='1",
        "1'; DROP TABLE usuarios; --"
    ]
    
    sqli_success = True
    for payload in sqli_payloads:
        # Probamos el endpoint de busqueda por dni
        res = requests.get(f"{API_GATEWAY}/api/usuarios/by-dni/{payload}")
        if res.status_code == 200:
             log(f"  [FALLO CRITICO] SQLi posible con payload DNI: {payload}", Colors.RED)
             sqli_success = False
        elif res.status_code == 500:
             log(f"  [FALLO] Excepcion no controlada en BD con payload DNI: {payload}", Colors.RED)
             sqli_success = False
        else:
             log(f"  - Payload rechazado (Status {res.status_code}): {payload}")

    if sqli_success:
        log("  [EXITO] SQLAlchemy/ORM sanitizo correctamente los payloads de SQLi.", Colors.GREEN)

    # ---------------------------------------------------------
    # TEST 3: JWT Manipulation (OWASP A01)
    # ---------------------------------------------------------
    log("\n[Test 3] Validando Falsificacion de Tokens (JWT Manipulation)...", Colors.YELLOW)
    endpoint_me = f"{API_GATEWAY}/api/usuarios/auth/me"
    
    # 3.1 Token falso/inventado
    fake_token = jwt.encode({"sub": 1, "role": "admin"}, "falsa_contraseña", algorithm="HS256")
    headers = {"Authorization": f"Bearer {fake_token}"}
    res = requests.get(endpoint_me, headers=headers)
    if res.status_code in [401, 403]:
        log("  - Token con firma incorrecta fue RECHAZADO.")
    else:
        log(f"  [FALLO] Token falso fue aceptado. (Status {res.status_code})", Colors.RED)
        
    # 3.2 Token "alg: none" (Vulnerabilidad clasica)
    # Algunos JWT antiguos aceptaban tokens sin firmar si el header decia "alg: none"
    header_none = {"alg": "none", "typ": "JWT"}
    payload = {"sub": 1, "role": "admin"}
    import base64
    
    def b64_encode(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
        
    token_none = f"{b64_encode(header_none)}.{b64_encode(payload)}."
    headers_none = {"Authorization": f"Bearer {token_none}"}
    
    res = requests.get(endpoint_me, headers=headers_none)
    if res.status_code in [401, 403]:
        log("  - Token 'alg: none' fue RECHAZADO.")
        log("  [EXITO] Validacion estricta de JWT comprobada.", Colors.GREEN)
    else:
        log(f"  [FALLO] Token 'alg: none' fue aceptado. Vulnerabilidad grave. (Status {res.status_code})", Colors.RED)

    # ---------------------------------------------------------
    # TEST 4: Cross-Site Scripting (XSS) via API (OWASP A03)
    # ---------------------------------------------------------
    log("\n[Test 4] Validando rechazo/sanitizacion de XSS...", Colors.YELLOW)
    
    xss_payload = "<script>alert('XSS')</script>"
    # Lo enviaremos en un intento de registro
    register_data = {
        "first_name": xss_payload,
        "paternal_last_name": "Test",
        "maternal_last_name": "Test",
        "dni": "00000000",
        "dob": "1990-01-01",
        "email": f"{xss_payload}@test.com"
    }
    
    # La validación dependerá de si el backend rechaza o simplemente almacena escapado.
    # Usualmente, Pydantic/Validadores deberían rebotar caracteres especiales en nombres.
    res = requests.post(f"{API_GATEWAY}/api/usuarios/", json=register_data)
    
    if res.status_code in [422, 400]:
        log(f"  - Payload XSS rechazado en la validacion (Status {res.status_code}).")
        log("  [EXITO] Proteccion XSS preventiva funciona.", Colors.GREEN)
    elif res.status_code == 201:
        # Check if the returned data was sanitized (tags stripped by bleach)
        returned_user = res.json().get("data", {})
        first_name = returned_user.get("first_name", "")
        if "script" not in first_name and "<" not in first_name:
            log(f"  - El backend acepto el registro pero sanitizo la cadena: {first_name}")
            log("  [EXITO] Sanitizacion XSS activa (Bleach).", Colors.GREEN)
            
            # Limpiar usuario de prueba
            user_id = returned_user.get("id")
            if user_id:
                 requests.delete(f"{API_GATEWAY}/api/usuarios/{user_id}")
        else:
            log(f"  [FALLO CRITICO] XSS no fue sanitizado: {first_name}", Colors.RED)
    else:
        log(f"  [ADVERTENCIA] Respuesta inesperada al payload XSS (Status {res.status_code}).", Colors.YELLOW)
        
    log("\nPruebas de Seguridad finalizadas.", Colors.GREEN)


if __name__ == "__main__":
    run_security_tests()
