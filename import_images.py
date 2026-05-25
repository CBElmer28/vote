import subprocess
import sys

images = [
    "votesystem-gateway",
    "votesystem-ms-usuarios",
    "votesystem-ms-biometrico",
    "votesystem-ms-votacion",
    "votesystem-ms-analisis",
    "votesystem-ms-candidatos"
]

def get_containerd_shim_pid():
    # Ejecutar ps de forma limpia sin banderas conflictivas
    res = subprocess.run(
        ["wsl", "-d", "docker-desktop", "-u", "root", "--", "ps"],
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        print("[ERROR] No se pudo ejecutar ps en WSL.")
        return None
    
    lines = res.stdout.splitlines()
    for line in lines:
        if "containerd-shim-runc-v2" in line and "-namespace k8s.io" in line:
            parts = line.strip().split()
            if parts:
                return parts[0]
                
    # Fallback: buscar cualquier containerd-shim-runc-v2
    for line in lines:
        if "containerd-shim-runc-v2" in line:
            parts = line.strip().split()
            if parts:
                return parts[0]
                
    return None

pid = get_containerd_shim_pid()
if not pid:
    print("[ERROR] No se pudo encontrar el PID del proceso containerd-shim en WSL.")
    sys.exit(1)

print(f"[INFO] PID de containerd-shim encontrado: {pid}")

for img in images:
    print(f"\n==========================================")
    print(f"Importando {img}:latest al namespace k8s.io...")
    print(f"==========================================")
    cmd = f'cmd.exe /c "docker save {img}:latest | wsl -d docker-desktop -u root -- nsenter -t {pid} -m -u -i -n -p -- ctr -n k8s.io images import -"'
    subprocess.run(cmd, shell=True)

print("\n[SUCCESS] ¡Todas las imágenes locales han sido importadas al clúster de Kubernetes!")
