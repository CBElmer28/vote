# distribute_images.ps1
# Script para guardar e importar imágenes de Docker en los nodos de Kind en Docker Desktop.

$images = @(
    "votesystem-gateway",
    "votesystem-ms-usuarios",
    "votesystem-ms-biometrico",
    "votesystem-ms-votacion",
    "votesystem-ms-analisis",
    "votesystem-ms-candidatos",
    "votesystem-frontend"
)

$nodes = @(
    "desktop-control-plane",
    "desktop-worker",
    "desktop-worker2",
    "desktop-worker3"
)

foreach ($image in $images) {
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "Preparando imagen: ${image}:latest" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    
    # Guardar la imagen localmente en un tar
    docker save -o "${image}.tar" "${image}:latest"
    
    foreach ($node in $nodes) {
        Write-Host "Cargando en nodo -> $node..." -ForegroundColor Yellow
        
        # Copiar usando subexpresión $($node) para evitar el error del dos puntos ':'
        docker cp "${image}.tar" "$($node):/${image}.tar"
        
        # Importar el archivo tar en el containerd del nodo (namespace k8s.io)
        docker exec $($node) ctr -n k8s.io images import "/${image}.tar"
        
        # Eliminar el archivo .tar temporal del nodo
        docker exec $($node) rm "/${image}.tar"
    }
    
    # Eliminar el archivo .tar de tu máquina local
    Remove-Item "${image}.tar"
}

Write-Host "¡Proceso de distribución completado con éxito!" -ForegroundColor Green
