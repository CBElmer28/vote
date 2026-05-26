import time
import requests
import sys
from kubernetes import client, config
from kubernetes.client.rest import ApiException

# ============================================================
#  CONFIGURACIÓN
# ============================================================

API_GATEWAY  = "http://127.0.0.1:80"
TIMEOUT      = 5.0

NS_SERVICES = "default"
NS_DB       = "prod-db"
PXC_STS     = "votesystem-db-pxc"   # nombre del StatefulSet creado por el operador
PXC_REPLICAS_ORIG = 3

DEPLOY_BIOMETRICO = "ms-biometrico"
DEPLOY_VOTACION   = "ms-votacion"

ENDPOINT_USUARIOS   = f"{API_GATEWAY}/api/usuarios/by-email/admin@test.local"
ENDPOINT_BIOMETRICO = f"{API_GATEWAY}/api/biometrico/verify/fingerprint/minutiae"
ENDPOINT_VOTACION   = f"{API_GATEWAY}/api/votacion/cast"

FAIL_FAST_LIMIT = 2.5

# ============================================================
#  Colores
# ============================================================
class C:
    GREEN  = '\033[92m'
    RED    = '\033[91m'
    YELLOW = '\033[93m'
    CYAN   = '\033[96m'
    BOLD   = '\033[1m'
    RESET  = '\033[0m'

def log(msg, color=C.RESET):
    print(f"{color}{msg}{C.RESET}")

# ============================================================
#  Helpers HTTP
# ============================================================

GATEWAY_DOWN_CODES  = {502, 503, 504}
BACKEND_ALIVE_CODES = {200, 201, 400, 404, 422}

def probe(method: str, url: str, **kwargs) -> tuple:
    start = time.time()
    try:
        resp = requests.request(method, url, timeout=TIMEOUT, **kwargs)
        return resp.status_code, time.time() - start, None
    except requests.exceptions.Timeout:
        return None, time.time() - start, "TIMEOUT"
    except requests.exceptions.ConnectionError as e:
        return None, time.time() - start, f"CONNECTION_ERROR"

def is_alive(status) -> bool:
    """True si el código indica que el backend respondió (no que el gateway falló)."""
    return status is not None and status in BACKEND_ALIVE_CODES

def evaluate_fail_fast(status, elapsed, err, context=""):
    prefix = f"      [{context}] " if context else "      "
    if err == "TIMEOUT":
        log(f"{prefix}[FALLO] Gateway colgado > {TIMEOUT}s (Fail-Fast ausente).", C.RED)
        return False
    if err and "CONNECTION_ERROR" in err:
        log(f"{prefix}[ÉXITO] Conexión rechazada al instante (Fail-Fast puro).", C.GREEN)
        return True
    log(f"{prefix}HTTP {status}  |  {elapsed:.3f}s")
    fast = elapsed < FAIL_FAST_LIMIT
    if status in GATEWAY_DOWN_CODES and fast:
        log(f"{prefix}[ÉXITO] Gateway reportó backend caído ({status}) rápidamente.", C.GREEN)
        return True
    elif status in GATEWAY_DOWN_CODES and not fast:
        log(f"{prefix}[FALLO] Código correcto ({status}) pero lento ({elapsed:.2f}s).", C.RED)
        return False
    elif status == 500 and fast:
        # 500 también indica que el microservicio no pudo conectarse a la BD
        log(f"{prefix}[ÉXITO] Microservicio retornó 500 rápidamente (BD no disponible).", C.GREEN)
        return True
    elif is_alive(status):
        log(f"{prefix}[INFO] Backend respondió con {status} — puede seguir activo.", C.CYAN)
        return None
    else:
        log(f"{prefix}[ADVERTENCIA] Código inesperado {status}.", C.YELLOW)
        return None

# ============================================================
#  Helpers Kubernetes — Pods PXC
# ============================================================

def get_pxc_pods(core_v1: client.CoreV1Api) -> list:
    """Lista todos los pods del StatefulSet PXC."""
    pods = core_v1.list_namespaced_pod(namespace=NS_DB)
    return [p for p in pods.items if p.metadata.name.startswith(PXC_STS)]


def pod_is_ready(pod) -> bool:
    """Comprueba si un pod tiene la condición Ready=True.
    V1PodCondition usa .status (str "True"/"False"), no .ready."""
    if not pod.status or not pod.status.conditions:
        return False
    for cond in pod.status.conditions:
        if cond.type == "Ready":
            return cond.status == "True"
    return False


def print_pxc_status(core_v1: client.CoreV1Api):
    """Imprime una tabla del estado actual de los pods PXC."""
    pods = get_pxc_pods(core_v1)
    log(f"    {'POD':<35} {'FASE':<12} {'READY'}", C.CYAN)
    for p in pods:
        fase  = p.status.phase or "Unknown"
        ready = "✓" if pod_is_ready(p) else "✗"
        log(f"    {p.metadata.name:<35} {fase:<12} {ready}")
    return pods


def wait_for_pod_gone(core_v1: client.CoreV1Api, pod_name: str, timeout: int = 90):
    log(f"    Esperando hasta {timeout}s a que '{pod_name}' termine...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        pods = get_pxc_pods(core_v1)
        names = [p.metadata.name for p in pods]
        if pod_name not in names:
            log(f"    Pod '{pod_name}' eliminado.", C.GREEN)
            return True
        time.sleep(4)
    log(f"    Timeout: '{pod_name}' sigue existiendo.", C.RED)
    return False


def wait_for_pod_ready(core_v1: client.CoreV1Api, pod_name: str, timeout: int = 120):
    log(f"    Esperando hasta {timeout}s a que '{pod_name}' esté Ready...")
    deadline = time.time() + timeout
    while time.time() < deadline:
        pods = get_pxc_pods(core_v1)
        for p in pods:
            if p.metadata.name == pod_name and pod_is_ready(p):
                log(f"    Pod '{pod_name}' Ready.", C.GREEN)
                return True
        ready_count = sum(1 for p in pods if pod_is_ready(p))
        log(f"    ... pods PXC Ready: {ready_count}/{PXC_REPLICAS_ORIG}")
        time.sleep(8)
    log(f"    Timeout: '{pod_name}' no quedó Ready.", C.RED)
    return False

# ============================================================
#  Helpers Kubernetes — Deployments
# ============================================================

def scale_deployment(apps_v1: client.AppsV1Api, name: str, replicas: int):
    body = {"spec": {"replicas": replicas}}
    apps_v1.patch_namespaced_deployment_scale(
        name=name, namespace=NS_SERVICES, body=body)
    log(f"    Deployment '{name}' → {replicas} réplica(s).")


def wait_for_deploy_down(apps_v1: client.AppsV1Api, name: str, timeout: int = 40):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            dep = apps_v1.read_namespaced_deployment(name=name, namespace=NS_SERVICES)
            available = dep.status.available_replicas or 0
            log(f"    ... '{name}' pods disponibles: {available}")
            if available == 0:
                log(f"    '{name}' sin réplicas activas.", C.GREEN)
                return True
        except ApiException as e:
            log(f"    Error leyendo deployment: {e.reason}", C.YELLOW)
        time.sleep(5)
    log(f"    Timeout esperando parada de '{name}'.", C.RED)
    return False

# ============================================================
#  Diagnóstico de rutas
# ============================================================

def diagnose_routes():
    log("\n[Diagnóstico] Rutas del gateway antes de los tests:", C.CYAN)
    routes = [
        ("GET",  ENDPOINT_USUARIOS,   {}),
        ("POST", ENDPOINT_BIOMETRICO, {"data": {"foo": "bar"}}),
        ("POST", ENDPOINT_VOTACION,   {"json": {"dni": "12345678", "candidato_id": 1}}),
    ]
    for method, url, kwargs in routes:
        status, elapsed, err = probe(method, url, **kwargs)
        desc = err if err else f"HTTP {status}"
        log(f"  {method:4s} {url}  →  {desc}  ({elapsed:.3f}s)")

# ============================================================
#  Suite de Tests
# ============================================================

def run_tests():
    try:
        config.load_kube_config()
    except Exception:
        try:
            config.load_incluster_config()
        except Exception as e:
            log(f"No se pudo cargar config de Kubernetes: {e}", C.RED)
            sys.exit(1)

    apps_v1  = client.AppsV1Api()
    core_v1  = client.CoreV1Api()

    log("Iniciando Pruebas de Recuperacion (Chaos Engineering) — Kubernetes...", C.GREEN)
    log(f"  Gateway  : {API_GATEWAY}")
    log(f"  NS serv  : {NS_SERVICES}  |  NS db: {NS_DB}  |  STS: {PXC_STS}")

    diagnose_routes()

    # =========================================================
    # TEST 1: Resiliencia de la BD — "Kill One, Serve All"
    #
    #   Galera (PXC) con 3 nodos mantiene quórum con 2 vivos.
    #   Borramos UN pod y demostramos que el sistema SIGUE
    #   respondiendo sin interrupción mientras el pod se recupera.
    # =========================================================
    log(f"\n{C.BOLD}[Test 1] Resiliencia de BD — Kill One, Serve All (Galera 3 nodos){C.RESET}", C.YELLOW)
    log("  Estrategia: eliminar UN pod PXC y probar continuidad del servicio.")
    log("  Con Galera, 2 nodos mantienen quórum → el sistema NO debe caer.\n")

    # 1.1 — Estado inicial
    log("  1.1 Estado inicial del clúster PXC:")
    pods = print_pxc_status(core_v1)
    if len(pods) < PXC_REPLICAS_ORIG:
        log(f"      El clúster tiene {len(pods)} pods (esperados {PXC_REPLICAS_ORIG}). "
            f"Continúa de todas formas.", C.YELLOW)

    ready_pods = [p for p in pods if pod_is_ready(p)]
    if not ready_pods:
        log("      No hay pods PXC Ready. Verifica el clúster antes de continuar.", C.RED)
        sys.exit(1)

    # Elegir el pod víctima (el último del StatefulSet: votesystem-db-pxc-2)
    victim_pod = sorted(p.metadata.name for p in pods)[-1]
    log(f"\n  Víctima elegida: {C.BOLD}{victim_pod}{C.RESET}")

    # 1.2 — Medir baseline ANTES de la caída
    log("\n  1.2 Baseline: midiendo latencia ANTES de eliminar el pod...")
    status, elapsed, err = probe("GET", ENDPOINT_USUARIOS)
    log(f"      HTTP {status}  |  {elapsed:.3f}s  (baseline)")

    # 1.3 — Eliminar el pod víctima (el StatefulSet lo recreará solo)
    log(f"\n  1.3 Eliminando pod '{victim_pod}'...")
    try:
        core_v1.delete_namespaced_pod(
            name=victim_pod,
            namespace=NS_DB,
            body=client.V1DeleteOptions(grace_period_seconds=0),
        )
        log(f"      Pod '{victim_pod}' eliminado.", C.GREEN)
    except ApiException as e:
        log(f"      Error al eliminar pod: {e.reason}", C.RED)
        sys.exit(1)

    # 1.4 — Probar continuidad INMEDIATAMENTE (los otros 2 nodos deben absorber el tráfico)
    log("\n  1.4 Probando continuidad durante la caída del pod...")
    log("      (HAProxy debería enrutar a los 2 nodos restantes)\n")

    samples = []
    for i in range(8):
        s, e, err = probe("GET", ENDPOINT_USUARIOS)
        alive = is_alive(s)
        symbol = C.GREEN + "✓" if alive else C.RED + "✗"
        label  = "SIRVE" if alive else ("TIMEOUT" if err == "TIMEOUT" else f"HTTP {s}")
        log(f"      [{i+1}/8] {symbol} {label}{C.RESET}  ({e:.3f}s)")
        samples.append(alive)
        time.sleep(1.5)

    available = sum(1 for x in samples if x)
    log(f"\n      Resultado: {available}/8 peticiones exitosas durante la caída.")
    if available >= 7:
        log("      [ÉXITO] El sistema fue RESILIENTE — Galera + HAProxy absorben la caída.",
            C.GREEN)
    elif available >= 5:
        log("      [PARCIAL] Hubo interrupciones breves — revisar config de HAProxy.",
            C.YELLOW)
    else:
        log("      [FALLO] Demasiadas interrupciones — el quórum o HAProxy tiene problemas.",
            C.RED)

    # 1.5 — Esperar a que el StatefulSet recree el pod
    log(f"\n  1.5 Esperando que Kubernetes recree '{victim_pod}' automáticamente...")
    wait_for_pod_gone(core_v1, victim_pod, timeout=30)   # esperar que el viejo desaparezca
    wait_for_pod_ready(core_v1, victim_pod, timeout=180) # esperar al nuevo

    log("\n  1.6 Estado final del clúster PXC:")
    print_pxc_status(core_v1)

    log("\n  1.7 Verificación post-recuperación...")
    status, elapsed, err = probe("GET", ENDPOINT_USUARIOS)
    if is_alive(status):
        log(f"      [ÉXITO] ms_usuarios responde HTTP {status} ({elapsed:.3f}s). "
            f"Clúster completamente recuperado.", C.GREEN)
    else:
        log(f"      [FALLO] ms_usuarios no responde tras la recuperación: "
            f"{err or status}", C.RED)

    # =========================================================
    # TEST 2: Caída de ms_biometrico (Deployment)
    # =========================================================
    log(f"\n{C.BOLD}[Test 2] Simulando caida de ms_biometrico...{C.RESET}", C.YELLOW)

    log("  2.1 Escalando ms_biometrico a 0...")
    try:
        scale_deployment(apps_v1, DEPLOY_BIOMETRICO, 0)
        wait_for_deploy_down(apps_v1, DEPLOY_BIOMETRICO)
    except ApiException as e:
        log(f"      Error: {e.reason}", C.RED)

    log("  2.2 Gateway debe rechazar rápido sin backend biométrico...")
    status, elapsed, err = probe("POST", ENDPOINT_BIOMETRICO, data={"foo": "bar"})
    result = evaluate_fail_fast(status, elapsed, err, "Fail-Fast Biométrico")
    if result is None and status == 400:
        log("      NOTA: 400 probablemente es validación nginx. Revisa nginx.conf.", C.CYAN)

    log("  2.3 Restaurando ms_biometrico...")
    try:
        scale_deployment(apps_v1, DEPLOY_BIOMETRICO, 1)
    except ApiException as e:
        log(f"      Error: {e.reason}", C.RED)
    time.sleep(8)

    # =========================================================
    # TEST 3: Caída de ms_votacion (Deployment)
    # =========================================================
    log(f"\n{C.BOLD}[Test 3] Simulando caida de ms_votacion...{C.RESET}", C.YELLOW)

    log("  3.1 Escalando ms_votacion a 0...")
    try:
        scale_deployment(apps_v1, DEPLOY_VOTACION, 0)
        wait_for_deploy_down(apps_v1, DEPLOY_VOTACION)
    except ApiException as e:
        log(f"      Error: {e.reason}", C.RED)

    log("  3.2 Gateway debe rechazar rápido sin backend de votación...")
    status, elapsed, err = probe(
        "POST", ENDPOINT_VOTACION,
        json={"dni": "12345678", "candidato_id": 1}
    )
    result = evaluate_fail_fast(status, elapsed, err, "Fail-Fast Votación")
    if result is None and status == 404:
        log("      NOTA: 404 sugiere que la ruta no está en nginx.conf.", C.CYAN)
        log("        kubectl exec -n default deploy/gateway -- cat /etc/nginx/nginx.conf", C.CYAN)

    log("  3.3 Restaurando ms_votacion...")
    try:
        scale_deployment(apps_v1, DEPLOY_VOTACION, 1)
    except ApiException as e:
        log(f"      Error: {e.reason}", C.RED)
    time.sleep(8)

    log(f"\n{C.BOLD}Pruebas de Recuperacion finalizadas.{C.RESET}", C.GREEN)


if __name__ == "__main__":
    run_tests()