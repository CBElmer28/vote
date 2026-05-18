import requests
import time
import sys

API_GATEWAY = "http://127.0.0.1:80"

class Colors:
    GREEN = '\033[92m'
    CYAN = '\033[96m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'

def log(msg, color=Colors.RESET):
    print(f"{color}{msg}{Colors.RESET}")

def run_performance_profiling():
    log("Iniciando Micro-Profiling de Rendimiento del Backend...", Colors.CYAN)
    
    # 1. Medir carga de la lista de candidatos
    log("\n[1] Perfilando GET /api/candidatos/ ...", Colors.YELLOW)
    start_time = time.perf_counter()
    res = requests.get(f"{API_GATEWAY}/api/candidatos/")
    end_time = time.perf_counter()
    
    elapsed_ms = (end_time - start_time) * 1000
    payload_kb = len(res.content) / 1024
    
    log(f"  - Tiempo de ejecucion: {elapsed_ms:.2f} ms")
    log(f"  - Tamano del Payload: {payload_kb:.2f} KB")
    
    if elapsed_ms < 100:
        log("  [EXITO] Optimizacion algoritmica excelente (< 100ms).", Colors.GREEN)
    else:
        log("  [ADVERTENCIA] Posible cuello de botella algoritmico o consulta N+1 en BD.", Colors.YELLOW)

    # 2. Medir carga de la verificacion de usuario
    log("\n[2] Perfilando GET /api/votacion/user/<random> ...", Colors.YELLOW)
    start_time = time.perf_counter()
    res2 = requests.get(f"{API_GATEWAY}/api/votacion/user/10")
    end_time = time.perf_counter()
    
    elapsed2_ms = (end_time - start_time) * 1000
    
    log(f"  - Tiempo de ejecucion: {elapsed2_ms:.2f} ms")
    if elapsed2_ms < 50:
        log("  [EXITO] Consulta SQL indexada correctamente (< 50ms).", Colors.GREEN)
        
    log("\nMicro-Profiling finalizado.", Colors.CYAN)

if __name__ == "__main__":
    run_performance_profiling()
