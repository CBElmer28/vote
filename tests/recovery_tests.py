import time
import requests
import docker
import sys

# Constantes
API_GATEWAY = "http://127.0.0.1:80"
TIMEOUT = 5.0  # Timeout de red amplio para evitar 499, pero esperamos < 2s

# Colores para consola
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

def log(msg, color=Colors.RESET):
    print(f"{color}{msg}{Colors.RESET}")

def run_tests():
    try:
        client = docker.from_env()
    except Exception as e:
        log(f"Error conectando a Docker: {e}", Colors.RED)
        sys.exit(1)

    # Buscar contenedores
    try:
        db_container = client.containers.get("votesystem_db")
        ms_usuarios = client.containers.get("votesystem_ms_usuarios")
        ms_biometrico = client.containers.get("votesystem_ms_biometrico")
    except docker.errors.NotFound as e:
        log(f"Contenedor no encontrado. Asegurate de que el entorno este corriendo. {e}", Colors.RED)
        sys.exit(1)

    log("Iniciando Pruebas de Recuperacion (Chaos Engineering)...", Colors.GREEN)

    # ---------------------------------------------------------
    # TEST 1: Caída de la Base de Datos (Tolerancia y Reconexión)
    # ---------------------------------------------------------
    log("\n[Test 1] Simulando caida catastrofica de MySQL...", Colors.YELLOW)
    
    # Endpoint que requiere base de datos
    db_endpoint = f"{API_GATEWAY}/api/usuarios/by-email/admin@test.local"

    # 1.1 Estado inicial
    try:
        res = requests.get(db_endpoint, timeout=TIMEOUT)
        if res.status_code == 200 or res.status_code == 404:
            log("  - ms_usuarios (DB connect) esta SALUDABLE.")
        else:
            log(f"  - ms_usuarios NO ESTA SALUDABLE antes de empezar (Status {res.status_code}).", Colors.RED)
    except Exception as e:
        log(f"  - ms_usuarios fallo en la comprobacion inicial: {e}", Colors.RED)

    # 1.2 Detener DB
    log("  - Apagando base de datos (db)...")
    db_container.stop(timeout=2)
    time.sleep(2) # Esperar a que las conexiones mueran

    # 1.3 Verificar Fail-Fast
    log("  - Probando Endpoint de usuarios con la DB caida (debe fallar rapido)...")
    start_time = time.time()
    try:
        res = requests.get(db_endpoint, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        log(f"  - Respuesta recibida: {res.status_code}. Tiempo: {elapsed:.2f}s")
        if elapsed < 2.5 and res.status_code in [500, 502, 503, 504]:
            log("  [EXITO] El sistema fallo rapido con un codigo HTTP correcto.", Colors.GREEN)
        else:
            log(f"  [FALLO] El sistema respondio con un codigo inesperado o muy lento ({elapsed:.2f}s, status {res.status_code})", Colors.RED)
    except requests.exceptions.Timeout:
        log("  [FALLO] El sistema se quedo colgado (> 5s). Falla el patron Fail-Fast.", Colors.RED)
    except requests.exceptions.ConnectionError:
        log("  [EXITO] Conexion rechazada (Fail-Fast puro).", Colors.GREEN)

    # 1.4 Restaurar DB
    log("  - Reiniciando base de datos (db)...")
    db_container.start()
    log("  - Esperando 10 segundos para inicializacion de MySQL...")
    time.sleep(10)

    # 1.5 Verificar Recuperación
    log("  - Comprobando auto-recuperacion de ms_usuarios (pool_pre_ping)...")
    try:
        res = requests.get(db_endpoint, timeout=TIMEOUT)
        if res.status_code == 200 or res.status_code == 404:
            log("  [EXITO] ms_usuarios se reconecto automaticamente a la BD.", Colors.GREEN)
        else:
            log(f"  [FALLO] ms_usuarios regreso codigo {res.status_code}. Problema de reconexion.", Colors.RED)
    except Exception as e:
        log(f"  [FALLO] ms_usuarios no pudo recuperarse. Excepcion: {e}", Colors.RED)

    # ---------------------------------------------------------
    # TEST 2: Caída de Microservicio Dependiente (Biométrico)
    # ---------------------------------------------------------
    log("\n[Test 2] Simulando caida de ms_biometrico...", Colors.YELLOW)
    
    # 2.1 Detener Biométrico
    log("  - Apagando ms_biometrico...")
    ms_biometrico.stop(timeout=2)
    time.sleep(2)

    # 2.2 Verificar Fail-Fast y Circuit Breaker / Timeout interno
    log("  - Validando ruta (requiere ms_biometrico vivo). El gateway debe rechazar rapido...")
    start_time = time.time()
    try:
        res = requests.post(f"{API_GATEWAY}/api/biometrico/verify/fingerprint/minutiae", data={"foo": "bar"}, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        log(f"  - Respuesta recibida: {res.status_code}. Tiempo: {elapsed:.2f}s")
        if elapsed < 2.5 and res.status_code in [502, 503, 504]:
             log("  [EXITO] Nginx Gateway protegio el sistema con un error rapido (Fail-Fast).", Colors.GREEN)
        else:
             log(f"  [ADVERTENCIA] Comportamiento inesperado o tardo mucho ({elapsed:.2f}s, status {res.status_code}).", Colors.YELLOW)
    except requests.exceptions.Timeout:
        log("  [FALLO] El Gateway se quedo colgado (> 5s). Falla el patron Fail-Fast.", Colors.RED)
    except requests.exceptions.ConnectionError:
        log("  [EXITO] Conexion rechazada (Fail-Fast puro).", Colors.GREEN)

    # 2.3 Restaurar Biométrico
    log("  - Reiniciando ms_biometrico...")
    ms_biometrico.start()
    time.sleep(3)

    # ---------------------------------------------------------
    # TEST 3: Caída de Microservicio de Votación (Alto Tráfico)
    # ---------------------------------------------------------
    log("\n[Test 3] Simulando caida de ms_votacion por sobrecarga...", Colors.YELLOW)
    
    try:
        ms_votacion = client.containers.get("votesystem_ms_votacion")
    except docker.errors.NotFound:
        log("  [FALLO] No se encontro el contenedor votesystem_ms_votacion.", Colors.RED)
        return

    # 3.1 Detener Votación
    log("  - Apagando ms_votacion...")
    ms_votacion.stop(timeout=2)
    time.sleep(2)

    # 3.2 Verificar Fail-Fast
    log("  - Intentando emitir/consultar un voto. El gateway debe rechazar rapido...")
    start_time = time.time()
    try:
        res = requests.post(f"{API_GATEWAY}/api/votacion/cast", json={"dni": "12345678", "candidato_id": 1}, timeout=TIMEOUT)
        elapsed = time.time() - start_time
        log(f"  - Respuesta recibida: {res.status_code}. Tiempo: {elapsed:.2f}s")
        if elapsed < 2.5 and res.status_code in [502, 503, 504]:
             log("  [EXITO] Nginx Gateway contuvo la caida de ms_votacion (Fail-Fast).", Colors.GREEN)
        else:
             log(f"  [ADVERTENCIA] Comportamiento inesperado o tardo mucho ({elapsed:.2f}s, status {res.status_code}).", Colors.YELLOW)
    except requests.exceptions.Timeout:
        log("  [FALLO] El Gateway se quedo colgado (> 5s). Falla el patron Fail-Fast.", Colors.RED)
    except requests.exceptions.ConnectionError:
        log("  [EXITO] Conexion rechazada (Fail-Fast puro).", Colors.GREEN)

    # 3.3 Restaurar Votación
    log("  - Reiniciando ms_votacion...")
    ms_votacion.start()
    time.sleep(3)
    
    log("\nPruebas de Recuperacion finalizadas.", Colors.GREEN)

if __name__ == "__main__":
    run_tests()
