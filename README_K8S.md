# VoteSystem en Kubernetes 🗳️☸️

Esta guía detalla la arquitectura de producción y el despliegue del sistema de votaciones `VoteSystem` sobre un clúster Kubernetes local (**Kind**). Contempla la base de datos multinodo con replicación síncrona en alta disponibilidad (**Percona Cluster**), el enrutamiento central (**Gateway Nginx**), la recolección de métricas de rendimiento (**Prometheus**) y paneles gráficos en tiempo real (**Grafana**).

---

## 🏗️ Arquitectura del Sistema en Kubernetes

El sistema se compone de pods replicados y balanceados para asegurar escalabilidad y resistencia a fallos:

| Componente / Servicio | Tecnología | Puerto / DNS Interno (K8s) | Descripción |
| :--- | :--- | :--- | :--- |
| **Cliente Web (Frontend)** | React (Vite) | `votesystem-frontend` (Puerto 80) | Interfaz web interactiva con diseño *Glassmorphism*. |
| **Gateway (API Ingress)** | Nginx | `gateway` (Puerto 8080 local / 80 K8s) | Punto de entrada único para redirigir tráfico al Frontend y APIs. |
| **MS Usuarios (MS1)** | Flask | `ms-usuarios` (Puerto 5001) | Registro, autenticación de votantes y generación de tokens JWT. |
| **MS Biométrico (MS2)** | Flask | `ms-biometrico` (Puerto 5002) | Validación facial (Azure Face API) y simulación dactilar. |
| **MS Votación (MS3)** | Flask | `ms-votacion` (Puerto 5003) | Registro de votos y lógica de negocio principal de elecciones. |
| **MS Análisis (MS4)** | Flask | `ms-analisis` (Puerto 5004) | Consolidación de estadísticas y generación de gráficos en Base64. |
| **MS Candidatos (MS5)** | Flask | `ms-candidatos` (Puerto 5005) | Gestión (CRUD) de la lista de candidatos electorales. |
| **Clúster de DB (HAProxy)** | Percona / MySQL | `votesystem-db-haproxy.prod-db` (Port 3306) | Balanceador de base de datos síncrona tolerante a fallos. |

---

## 🛠️ Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu máquina (entorno Windows recomendado con WSL2 o PowerShell):

1.  **Docker Desktop** (con soporte para WSL2 activado).
2.  **Kind** (para crear tu clúster Kubernetes local): `winget install Kubernetes.Kind`
3.  **Kubectl** (CLI de Kubernetes): `winget install Kubernetes.kubectl`
4.  **Helm** (gestor de paquetes de K8s): `winget install Helm.Helm`
5.  **Python 3.10+** (para los scripts locales y pruebas de estrés).

---

## 🌐 Paso a Paso de Despliegue

### Paso 1: Crear el Clúster Local (Kind)
Crea un clúster Kubernetes multi-nodo local llamado `desktop` (con 1 nodo control-plane y 3 nodos worker):
```powershell
# Crear clúster Kind con el nombre adecuado
kind create cluster --name desktop
```

### Paso 2: Construir y Distribuir las Imágenes de Contenedores
Dado que el clúster está en tu máquina, debes compilar las imágenes localmente y enviarlas a los nodos de Kind para que Kubernetes pueda utilizarlas sin requerir un registro externo:

1.  **Instala las dependencias de Python para compilar:**
    ```powershell
    pip install -r requirements-test.txt
    ```
2.  **Construye las imágenes locales de Docker:**
    ```powershell
    python build_images.py
    ```
3.  **Distribuye las imágenes a los nodos de containerd en Kind:**
    ```powershell
    .\distribute_images.ps1
    ```

### Paso 3: Desplegar la Base de Datos (Percona XtraDB Cluster)
Utilizaremos el operador de base de datos empresarial de Percona para garantizar alta disponibilidad automática con replicación síncrona Galera (3 nodos):

1.  **Crea el namespace dedicado para la base de datos:**
    ```powershell
    kubectl create namespace prod-db
    ```
2.  **Aplica los secretos de conexión iniciales:**
    ```powershell
    kubectl apply -f k8s/secrets.yaml -n prod-db
    ```
3.  **Instala el operador de base de datos de Percona:**
    ```powershell
    kubectl apply -f k8s/percona/percona-operator.yaml -n prod-db
    ```
4.  **Crea el clúster de base de datos multinodo y balanceador HAProxy:**
    ```powershell
    kubectl apply -f k8s/percona/percona-cluster.yaml -n prod-db
    ```

> [!NOTE]
> Las réplicas de base de datos tardarán unos 3 a 5 minutos en levantarse y auto-sincronizarse. Puedes monitorear su estado con `kubectl get pods -n prod-db -w` (deben aparecer `votesystem-db-pxc-0`, `-1`, `-2` y `votesystem-db-haproxy-0`, `-1` en estado `Running` con contenedores listos `2/2`).

### Paso 4: Desplegar los Microservicios backend y Gateway
Aplica todos los manifiestos de los microservicios y la configuración del Gateway para enrutar el tráfico:

```powershell
kubectl apply -f k8s/ms-usuarios.yaml
kubectl apply -f k8s/ms-candidatos.yaml
kubectl apply -f k8s/ms-votacion.yaml
kubectl apply -f k8s/ms-biometrico.yaml
kubectl apply -f k8s/ms-analisis.yaml
kubectl apply -f k8s/gateway.yaml
```

*   **Punto de Acceso Web:** El Gateway redirige el puerto de entrada. Puedes acceder a la aplicación desde tu navegador en: **`http://localhost:8080/`**

---

## 📊 Configuración de Monitoreo: Prometheus + Grafana

Para monitorear el rendimiento del clúster de base de datos y de las llamadas HTTP de los microservicios:

### 1. Instalar el Stack de Prometheus vía Helm
1.  **Registra el repositorio de Helm:**
    ```powershell
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    ```
2.  **Crea el namespace e instala usando los valores de configuración optimizados:**
    ```powershell
    kubectl create namespace monitoring
    helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring -f k8s/monitoring/helm-values.yaml
    ```
3.  **Aplica los monitores automáticos (ServiceMonitor y PodMonitor):**
    ```powershell
    kubectl apply -f k8s/monitoring/service-monitors.yaml
    ```

### 2. Acceder e Importar Dashboards en Grafana
*   **Acceso a Grafana:** Abre en tu navegador: **`http://localhost:8080/grafana/`**
*   **Credenciales por defecto:** Usuario: `admin` | Contraseña: `admin` *(te solicitará cambiarla al primer inicio)*.

#### Cómo configurar los Dashboards recomendados:
Ve a **Dashboards -> New -> Import** en Grafana e ingresa los siguientes IDs:

1.  **MySQL / Percona (ID `7362`):**
    *   *Solución de DataSource:* Si el panel muestra error de datasource, ve a **Dashboard Settings (⚙️) -> Variables**, selecciona la variable `DS_PROMETHEUS` y configúrala de tipo `Datasource`, seleccionando tu DataSource activo de Prometheus.
    *   *Filtrado de hosts:* Para evitar ver IPs inactivas antiguas de pods reiniciados en el filtro superior, edita la variable **`host`** en la misma sección y cámbiala a:
        *   **Query:** `query_result(mysql_up{job="prod-db/pxc-pod-monitor"} == 1)`
        *   **Regex:** `/instance="([^"]+)"/`
2.  **Flask API Overview (ID `13444`):**
    *   Este panel te mostrará la latencia, RPS y tasas de error HTTP 4xx/5xx de los 5 microservicios Flask. Al importarlo con el ID `13444`, selecciona `Prometheus` como origen de datos.

---

## ⚡ Pruebas de Carga y Simulación de Fallos (Locust)

Para comprobar el escalado de Kubernetes y ver las métricas moviéndose en tiempo real en Grafana, ejecuta una prueba de estrés:

1.  **Instala Locust localmente:**
    ```powershell
    pip install locust
    ```
2.  **Inicia Locust apuntando al archivo de pruebas del repositorio:**
    ```powershell
    locust -f tests/locustfile.py
    ```
3.  **Inicia el test:**
    *   Abre **`http://localhost:8089/`** en tu navegador.
    *   **Number of users:** `200`
    *   **Spawn rate:** `10`
    *   **Host:** `http://localhost:8080` (la dirección de tu Gateway).
4.  **Simular caídas (Tolerancia a fallos de DB):**
    Mientras corre la carga pesada de Locust, simula que se quema un servidor de base de datos apagando una réplica de golpe:
    ```powershell
    kubectl delete pod votesystem-db-pxc-1 -n prod-db --grace-period=0 --force
    ```
    *   Observa en Grafana (Dashboard MySQL) cómo el tamaño del clúster síncrono Galera (`wsrep_cluster_size`) disminuye temporalmente a 2 y luego se recupera a 3 automáticamente al recrearse el pod en segundos.
    *   Comprueba en el Dashboard de Flask que la tasa de error HTTP de tus usuarios se mantiene en `0%` gracias al failover instantáneo del balanceador HAProxy.
