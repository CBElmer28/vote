import subprocess
import os
import sys

IMAGES = {
    "votesystem-ms-usuarios": "services/ms_usuarios",
    "votesystem-ms-biometrico": "services/ms_biometrico",
    "votesystem-ms-votacion": "services/ms_votacion",
    "votesystem-ms-analisis": "services/ms_analisis",
    "votesystem-ms-candidatos": "services/ms_candidatos",
    "votesystem-gateway": "services/gateway",
    "votesystem-frontend": "frontend"
}

def build_image(name, path):
    print(f"\n==========================================")
    print(f"Building image {name} from {path}...")
    print(f"==========================================")
    
    cmd = ["docker", "build", "-t", f"{name}:latest", "."]
    res = subprocess.run(cmd, cwd=os.path.abspath(path))
    if res.returncode != 0:
        print(f"[ERROR] Failed to build {name}")
        sys.exit(1)
    print(f"[SUCCESS] Built {name}:latest")

def main():
    for name, path in IMAGES.items():
        build_image(name, path)
    print("\n[SUCCESS] All images built successfully!")

if __name__ == "__main__":
    main()
