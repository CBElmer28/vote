import time
import requests
import sys
from kubernetes import client, config
from kubernetes.client.rest import ApiException
 
# ============================================================
#  CONFIGURACIÓN
# ============================================================
 
API_GATEWAY = "http://localhost:80"
TIMEOUT     = 5.0
NS          = "default"
 
# Endpoints de salud extraídos de los YAMLs (livenessProbe/readinessProbe)
HEALTH = {
    "ms-usuarios"   : f"{API_GATEWAY}/api/usuarios/health",
    "ms-biometrico" : f"{API_GATEWAY}/api/biometrico/health",
    "ms-votacion"   : f"{API_GATEWAY}/api/votacion/health",
    "ms-analisis"   : f"{API_GATEWAY}/api/analisis/health",
    "ms-candidatos" : f"{API_GATEWAY}/api/candidatos/health",
}
 
# Réplicas definidas en cada Deployment (según los YAMLs)
REPLICAS = {
    "ms-usuarios"   : 1,
    "ms-biometrico" : 1,
    "ms-analisis"   : 1,
    "ms-candidatos" : 3,   # ← resiliente por réplicas
    "ms-votacion"   : 3,   # ← resiliente por réplicas
}
 
# Tiempo máximo esperado para que Kubernetes recree un pod (self-healing)
RESTART_TIMEOUT = 90   # segundos
 
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
 
def header(title):
    bar = "=" * 60
    log(f"\n{bar}", C.BOLD)
    log(f"  {title}", C.BOLD)
    log(f"{bar}", C.BOLD)
 
def section(title):
    log(f"\n  {'─'*54}", C.CYAN)
    log(f"  {title}", C.CYAN)
    log(f"  {'─'*54}", C.CYAN)
 
# ============================================================
#  Helpers HTTP
# ============================================================
 
def probe(url: str) -> tuple:
    """GET al health endpoint. Retorna (status|None, elapsed, error|None)."""
    start = time.time()
    try:
        r = requests.get(url, timeout=TIMEOUT)
        return r.status_code, time.time() - start, None
    except requests.exceptions.Timeout:
        return None, time.time() - start, "TIMEOUT"
    except requests.exceptions.ConnectionError:
        return None, time.time() - start, "CONN_ERROR"
 
def is_healthy(status) -> bool:
    return status == 200
 
def probe_continuously(url: str, n: int, interval: float = 1.2) -> list:
    """
    Lanza `n` peticiones con pausa `interval` entre cada una.
    Retorna lista de (status, elapsed, error) para análisis.
    """
    results = []
    for i in range(n):
        s, e, err = probe(url)
        ok     = is_healthy(s)
        symbol = f"{C.GREEN}[OK]{C.RESET}" if ok else f"{C.RED}[FAIL]{C.RESET}"
        label  = f"HTTP {s}" if s else (err or "?")
        log(f"      [{i+1:02d}/{n}] {symbol} {label:<20} ({e:.3f}s)")
        results.append((s, e, err))
        if i < n - 1:
            time.sleep(interval)
    return results
 
def summarize(results: list, label: str):
    ok    = sum(1 for s, _, _ in results if is_healthy(s))
    total = len(results)
    pct   = ok / total * 100
    color = C.GREEN if pct >= 87.5 else (C.YELLOW if pct >= 50 else C.RED)
    log(f"\n      {label}: {ok}/{total} peticiones exitosas ({pct:.0f}%)", color)
    if pct >= 87.5:
        log(f"      [ÉXITO] Servicio RESILIENTE durante la caída del pod.", C.GREEN)
    elif pct >= 50:
        log(f"      [PARCIAL] Interrupciones breves — revisar readinessProbe o HPA.", C.YELLOW)
    else:
        log(f"      [FALLO] Demasiadas interrupciones — el servicio no es resiliente.", C.RED)
 
# ============================================================
#  Helpers Kubernetes
# ============================================================
 
def get_pods(core_v1: client.CoreV1Api, app_label: str) -> list:
    """Lista pods de un Deployment usando su label app=<name>."""
    pods = core_v1.list_namespaced_pod(
        namespace=NS,
        label_selector=f"app={app_label}"
    )
    return pods.items
 
 
def pod_is_ready(pod) -> bool:
    """V1PodCondition.status es str 'True'/'False', no bool."""
    if not pod.status or not pod.status.conditions:
        return False
    for cond in pod.status.conditions:
        if cond.type == "Ready":
            return cond.status == "True"
    return False
 
 
def delete_pod(core_v1: client.CoreV1Api, name: str) -> bool:
    """Elimina un pod inmediatamente (grace_period=0)."""
    try:
        core_v1.delete_namespaced_pod(
            name=name, namespace=NS,
            body=client.V1DeleteOptions(grace_period_seconds=0)
        )
        log(f"      Pod '{name}' eliminado.", C.GREEN)
        return True
    except ApiException as e:
        log(f"      Error eliminando '{name}': {e.reason}", C.RED)
        return False
 
 
def wait_until_pod_gone(core_v1: client.CoreV1Api,
                        pod_name: str, app_label: str,
                        timeout: int = 30) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        names = [p.metadata.name for p in get_pods(core_v1, app_label)]
        if pod_name not in names:
            return True
        time.sleep(3)
    return False
 
 
def wait_until_n_ready(core_v1: client.CoreV1Api,
                       app_label: str, n: int,
                       timeout: int = RESTART_TIMEOUT) -> float:
    """
    Espera hasta que `n` pods del Deployment estén Ready.
    Retorna los segundos que tardó, o -1 si hubo timeout.
    """
    start    = time.time()
    deadline = start + timeout
    while time.time() < deadline:
        pods  = get_pods(core_v1, app_label)
        ready = sum(1 for p in pods if pod_is_ready(p))
        log(f"      ... pods Ready: {ready}/{n}  "
            f"(pods totales: {len(pods)})")
        if ready >= n:
            return time.time() - start
        time.sleep(5)
    return -1
 
 
def print_pod_table(core_v1: client.CoreV1Api, app_label: str):
    pods = get_pods(core_v1, app_label)
    log(f"    {'POD':<50} {'FASE':<12} {'READY'}", C.CYAN)
    for p in pods:
        fase  = (p.status.phase or "Unknown")
        ready = "[OK]" if pod_is_ready(p) else "[FAIL]"
        log(f"    {p.metadata.name:<50} {fase:<12} {ready}")
    return pods
 
# ============================================================
#  Estrategias de test
# ============================================================
 
def test_kill_one_serve_all(core_v1: client.CoreV1Api,
                             apps_v1: client.AppsV1Api,
                             deploy_name: str,
                             test_num: int):
    """
    Para Deployments con ≥2 réplicas.
    Elimina UN pod y verifica que el servicio sigue disponible
    gracias a las réplicas restantes (kube-proxy + iptables).
    """
    n_replicas  = REPLICAS[deploy_name]
    health_url  = HEALTH[deploy_name]
 
    header(f"[Test {test_num}] Kill-One-Serve-All — {deploy_name} ({n_replicas} réplicas)")
 
    # Estado inicial
    section("Estado inicial")
    pods = print_pod_table(core_v1, deploy_name)
    ready_pods = [p for p in pods if pod_is_ready(p)]
    if len(ready_pods) < 2:
        log(f"  Necesita ≥2 pods Ready para este test. Encontrados: {len(ready_pods)}.", C.RED)
        return
 
    # Baseline
    section("Baseline (antes de la caída)")
    s, e, _ = probe(health_url)
    log(f"      Health: HTTP {s}  ({e:.3f}s)")
 
    # Elegir víctima: el pod con nombre mayor (último del ReplicaSet)
    victim = sorted(p.metadata.name for p in ready_pods)[-1]
    log(f"\n  Víctima: {C.BOLD}{victim}{C.RESET}")
 
    # Eliminar pod y probar continuidad en paralelo
    section("Eliminando pod — midiendo continuidad del servicio")
    delete_pod(core_v1, victim)
 
    log(f"\n      Sondeando /health durante la recreación del pod...")
    results = probe_continuously(health_url, n=10, interval=1.5)
    summarize(results, f"{deploy_name} durante caída")
 
    # Esperar recreación
    section("Esperando recreación automática del pod")
    log(f"      Kubernetes debe recrear el pod vía ReplicaSet...")
    wait_until_pod_gone(core_v1, victim, deploy_name, timeout=20)
    elapsed = wait_until_n_ready(core_v1, deploy_name, n_replicas, timeout=RESTART_TIMEOUT)
 
    if elapsed >= 0:
        log(f"\n      [ÉXITO] {deploy_name} recuperado en {elapsed:.1f}s. "
            f"Réplicas completas.", C.GREEN)
    else:
        log(f"\n      [FALLO] Timeout: {deploy_name} no alcanzó {n_replicas} pods Ready "
            f"en {RESTART_TIMEOUT}s.", C.RED)
 
    # Estado final
    section("Estado final")
    print_pod_table(core_v1, deploy_name)
 
    # Verificación post-recuperación
    s, e, err = probe(health_url)
    if is_healthy(s):
        log(f"\n  [ÉXITO] {deploy_name} responde HTTP {s} ({e:.3f}s). "
            f"Totalmente recuperado.", C.GREEN)
    else:
        log(f"\n  [FALLO] {deploy_name} no responde correctamente tras recuperación: "
            f"{err or s}", C.RED)
 
 
def test_pod_restart_recovery(core_v1: client.CoreV1Api, deploy_name: str, test_num: int):
    """
    Para Deployments con 1 réplica.
    Elimina el único pod y mide el tiempo hasta que Kubernetes
    lo recrea y lo vuelve a marcar Ready (self-healing).
    No se espera continuidad de servicio — se mide el RTO.
    """
    health_url = HEALTH[deploy_name]
 
    header(f"[Test {test_num}] Pod Restart Recovery — {deploy_name} (1 réplica)")
    log(f"  Estrategia: eliminar el único pod y medir RTO (Recovery Time Objective).")
    log(f"  Kubernetes recrea el pod vía ReplicaSet + livenessProbe/readinessProbe.")
 
    # Estado inicial
    section("Estado inicial")
    pods = print_pod_table(core_v1, deploy_name)
    if not pods:
        log(f"  No se encontraron pods para '{deploy_name}'.", C.RED)
        return
 
    victim = pods[0].metadata.name
 
    # Baseline
    s, e, _ = probe(health_url)
    log(f"\n  Baseline: HTTP {s}  ({e:.3f}s)")
 
    # Eliminar pod
    section(f"Eliminando único pod '{victim}'")
    t_start = time.time()
    delete_pod(core_v1, victim)
 
    # Medir downtime sondeando
    section("Midiendo downtime hasta auto-recuperación")
    log("      Sondeando cada 3s hasta que el nuevo pod esté Ready...\n")
 
    downtime_start = time.time()
    recovered      = False
    attempts       = 0
    deadline       = downtime_start + RESTART_TIMEOUT
 
    while time.time() < deadline:
        s, e, err = probe(health_url)
        attempts += 1
        ok     = is_healthy(s)
        symbol = f"{C.GREEN}✓{C.RESET}" if ok else f"{C.RED}✗{C.RESET}"
        label  = f"HTTP {s}" if s else (err or "?")
        elapsed_since_kill = time.time() - t_start
        log(f"      [{attempts:02d}] {symbol} {label:<20} "
            f"({e:.3f}s)  +{elapsed_since_kill:.1f}s desde la caída")
        if ok:
            rto = time.time() - t_start
            recovered = True
            break
        time.sleep(3)
 
    # Resultado
    section("Resultado")
    if recovered:
        log(f"  RTO (Recovery Time Objective): {C.BOLD}{rto:.1f}s{C.RESET}", C.GREEN)
        if rto < 20:
            log(f"  [EXCELENTE] Recuperación muy rápida (< 20s).", C.GREEN)
        elif rto < 45:
            log(f"  [BIEN] Recuperación normal para un pod Flask con "
                f"initialDelaySeconds=15.", C.GREEN)
        else:
            log(f"  [LENTO] Recuperación tardó > 45s. Considera reducir "
                f"initialDelaySeconds en readinessProbe.", C.YELLOW)
    else:
        log(f"  [FALLO] El pod no se recuperó en {RESTART_TIMEOUT}s.", C.RED)
        log(f"  Verifica con: kubectl describe pod -n default -l app={deploy_name}", C.CYAN)
 
    # Estado final
    section("Estado final")
    print_pod_table(core_v1, deploy_name)
 
# ============================================================
#  Main
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
 
    core_v1 = client.CoreV1Api()
    apps_v1 = client.AppsV1Api()
 
    log(f"\n{'#'*62}", C.BOLD)
    log(f"#  CHAOS ENGINEERING — Microservicios VoteSystem", C.BOLD)
    log(f"#  Gateway: {API_GATEWAY}", C.BOLD)
    log(f"#  Namespace: {NS}", C.BOLD)
    log(f"{'#'*62}", C.BOLD)
 
    # ── Diagnóstico previo ──────────────────────────────────
    log("\n[Pre-check] Estado de health endpoints:", C.CYAN)
    for name, url in HEALTH.items():
        s, e, err = probe(url)
        desc  = f"HTTP {s}" if s else (err or "?")
        ok    = "[OK]" if is_healthy(s) else "[FAIL]"
        color = C.GREEN if is_healthy(s) else C.RED
        log(f"  {ok} {name:<20} {desc:<12} ({e:.3f}s)", color)
 
    # ── Tests por tipo ──────────────────────────────────────
    #
    #  TIPO A — Kill-One-Serve-All (3 réplicas)
    #    ms-candidatos: el más consultado según Locust (weight=3 en list_candidates)
    #    ms-votacion:   crítico para la integridad del sistema
    #
    test_kill_one_serve_all(core_v1, apps_v1, "ms-candidatos", 2)
    test_kill_one_serve_all(core_v1, apps_v1, "ms-votacion", 3)
 
    #  TIPO B — Pod Restart Recovery (1 réplica)
    #    Se mide el RTO de cada microservicio de réplica única.
    #    El comportamiento esperado viene de los YAMLs:
    #      initialDelaySeconds: 15  → el pod tardará ≥15s en volver a Ready
    #
    test_pod_restart_recovery(core_v1, "ms-usuarios", 4)
    test_pod_restart_recovery(core_v1, "ms-biometrico", 5)
    test_pod_restart_recovery(core_v1, "ms-analisis", 6)
 
    log(f"\n{'#'*62}", C.BOLD)
    log(f"#  PRUEBAS FINALIZADAS", C.BOLD)
    log(f"{'#'*62}\n", C.BOLD)
 
 
if __name__ == "__main__":
    run_tests()
 