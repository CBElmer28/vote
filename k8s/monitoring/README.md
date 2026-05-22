# Guía de Monitoreo: Prometheus + Grafana

Este directorio contiene las configuraciones necesarias para monitorear el estado de los microservicios, el clúster de base de datos Percona (PXC), el gateway y la infraestructura Kubernetes en tiempo real.

---

## 🛠️ Requisitos Previos

Dado que estamos en Windows y utilizas un clúster de Kubernetes local (Kind / Docker Desktop), necesitas instalar **Helm** (el gestor de paquetes de Kubernetes).

### Instalar Helm en Windows

Elige uno de los siguientes métodos en tu PowerShell como Administrador:

*   **Usando Winget (Recomendado):**
    ```powershell
    winget install Helm.Helm
    ```
*   **Usando Chocolatey:**
    ```powershell
    choco install kubernetes-helm
    ```

> [!NOTE]
> Después de la instalación, reinicia tu terminal PowerShell para que el comando `helm` esté disponible en el PATH. Puedes verificarlo corriendo `helm version`.

---

## 🚀 Paso a Paso para la Instalación

### Paso 1: Agregar el repositorio de Helm de Prometheus
En tu terminal PowerShell, ejecuta:
```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

### Paso 2: Crear el namespace de Monitoreo e Instalar el Stack
Instalaremos Prometheus y Grafana usando nuestro archivo de configuración personalizada `helm-values.yaml`:
```powershell
# 1. Crear el namespace
kubectl create namespace monitoring

# 2. Instalar el stack de Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring -f k8s/monitoring/helm-values.yaml
```

### Paso 3: Aplicar los Monitores (ServiceMonitor y PodMonitor)
Aplica los manifiestos que le indican a Prometheus qué pods e infraestructura debe raspar (*scrape*):
```powershell
kubectl apply -f k8s/monitoring/service-monitors.yaml
```

### Paso 4: Reconstruir y Desplegar los Microservicios
Como hemos modificado los microservicios de Flask para exportar métricas, debes reconstruir las imágenes de Docker y distribuirlas en los nodos de tu clúster de Kind:

```powershell
# 1. Reconstruir las imágenes de los microservicios
python build_images.py

# 2. Distribuir las imágenes a los nodos de Kind (ejecutar script de PowerShell)
.\distribute_images.ps1

# 3. Aplicar los cambios en los manifiestos de Kubernetes (servicios y base de datos)
kubectl apply -f k8s/ms-usuarios.yaml
kubectl apply -f k8s/ms-candidatos.yaml
kubectl apply -f k8s/ms-votacion.yaml
kubectl apply -f k8s/ms-biometrico.yaml
kubectl apply -f k8s/ms-analisis.yaml
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/percona/percona-cluster.yaml -n prod-db
```

> [!IMPORTANT]
> Al aplicar `percona-cluster.yaml`, el operador de Percona actualizará los Pods agregando el contenedor sidecar `mysqld-exporter`. Esto tomará unos momentos mientras recrea las réplicas de forma secuencial sin pérdida de disponibilidad.

---

## 🖥️ Acceso a Grafana

Gracias a la configuración en el Gateway (`k8s/gateway.yaml`) y el subpath de Grafana (`helm-values.yaml`), puedes acceder al dashboard directamente a través del balanceador de carga de tu gateway actual:

1.  Asegúrate de que el Gateway esté corriendo.
2.  Abre tu navegador e ingresa a: **`http://localhost:8080/grafana/`** (o el puerto en el que expongas tu `gateway-service`).
3.  **Credenciales de Acceso:**
    *   **Usuario:** `admin`
    *   **Contraseña:** `admin` (se te pedirá cambiarla al primer inicio).

---

## 📊 Dashboards Recomendados para Importar

Una vez dentro de Grafana, puedes importar tableros pre-configurados utilizando sus IDs en la opción **Dashboards -> New -> Import**:

| Dashboard | ID de Grafana | Descripción |
| :--- | :--- | :--- |
| **Kubernetes / Pods** | **15760** o **14282** | Permite monitorear el consumo de CPU, memoria, red y **caídas/reinicios de pods** en todo el clúster. |
| **Flask API Overview** | **13444** | Muestra la **latencia**, rendimiento (RPS), tasas de error (HTTP 4xx/5xx) y endpoints más consumidos. |
| **MySQL / Percona** | **7362** | Visualiza el estado de las réplicas Galera (`wsrep_*`), tamaño de clúster, búferes de memoria InnoDB, y conexiones activas. |

---

## 🔍 Verificación del Funcionamiento

### 1. Verificar que Prometheus está raspando los microservicios
Puedes ver los objetivos (*targets*) de Prometheus haciendo port-forward directamente a la interfaz web de Prometheus:
```powershell
kubectl port-forward svc/prometheus-operated 9090:9090 -n monitoring
```
Luego ve a `http://localhost:9090/targets` y confirma que los endpoints de `votesystem-services-monitor` y `pxc-pod-monitor` estén en estado **UP**.

### 2. Simular un Failover y Monitorear
Con Locust corriendo a 500 usuarios/segundo:
1.  Observa en Grafana cómo la latencia promedio se mantiene estable.
2.  Elimina un nodo de base de datos:
    ```powershell
    kubectl delete pod votesystem-db-pxc-1 -n prod-db --grace-period=0 --force
    ```
3.  Observa en el dashboard de MySQL cómo el clúster Galera reporta una reducción temporal del número de nodos (`wsrep_cluster_size` baja a 2) y cómo se recupera automáticamente a 3 en pocos segundos cuando el pod se reinicia, sin que en el dashboard de Flask aumente la tasa de errores HTTP 500.

---

## 🛠️ Solución de Problemas Comunes (Troubleshooting de Dashboards)

Al importar tableros de la comunidad en Grafana, es común encontrarse con problemas de mapeo de variables de origen de datos (DataSources). A continuación, se detalla cómo solucionar los dos problemas que mencionas:

### 1. MySQL / Percona (ID 7362): Error de `${DS_PROMETHEUS}` faltante en el botón de Host

Este error ocurre porque la variable dinámica del host o del dashboard no está resolviendo el nombre de tu origen de datos local. Para solucionarlo de forma permanente en la interfaz:

1. **Abre el Dashboard de MySQL / Percona** en tu navegador.
2. Haz clic en el icono de **Configuración del Dashboard** (la rueda dentada ⚙️ en la esquina superior derecha).
3. En el menú de la izquierda, selecciona **Variables**.
4. Busca la variable llamada `DS_PROMETHEUS`.
   * **Si existe:** Haz clic sobre ella. Asegúrate de que su **Type** esté configurado como `Datasource`. En la sección de abajo (*Datasource options*), verifica que el **Type** sea `Prometheus` y selecciona tu origen de datos activo (ej. `Prometheus`) en el campo *Value*.
   * **Si NO existe:** Haz clic en **New variable**. Rellena los campos con:
     * **Name:** `DS_PROMETHEUS`
     * **Type:** `Datasource`
     * **Label:** `Prometheus`
     * **Type (bajo Datasource options):** `Prometheus`
5. Si lo anterior no resuelve el botón de Host, busca la variable llamada **`host`** en la misma lista de variables, edítala y cambia su campo **Data source** directamente de `${DS_PROMETHEUS}` a tu DataSource de Prometheus (por ejemplo, selecciona `Prometheus` explícitamente en el menú desplegable en lugar de usar la variable).
6. Haz clic en **Apply** (o **Save dashboard**) abajo, y luego guarda los cambios usando el botón **Save dashboard** de la esquina superior derecha.

---

### 2. Flask API Overview (ID 13444): Corrección del ID del Dashboard y problemas de Importación

Si intentas usar el ID **`9684`**, verás que Grafana te solicita un origen de datos llamado **`DS_VARKEN`**. Esto se debe a que el ID `9684` corresponde al panel de la aplicación **Varken** (que monitorea servidores multimedia Plex usando InfluxDB/Varken, no Prometheus).

El ID correcto y estándar para visualizar las métricas del exportador `prometheus-flask-exporter` de tus microservicios de Flask es el **`13444`**.

Para importarlo correctamente:
1. En Grafana, ve a **Dashboards** -> **New** -> **Import**.
2. Escribe el ID **`13444`** en el campo de *Import via grafana.com* y haz clic en **Load**.
3. En la pantalla de opciones de importación, ahora verás que te solicita un DataSource de **Prometheus**. Selecciona tu origen de datos de Prometheus (ej. `Prometheus`) en el menú desplegable y haz clic en **Import**.

#### ¿Qué hacer si aún así no se listara tu origen de datos de Prometheus al importar?
Si por algún conflicto de versión de Grafana tu origen de datos no aparece en el menú desplegable al cargar el ID `13444`:
1. **Descarga el JSON del dashboard** usando la API pública de Grafana:
   [https://grafana.com/api/dashboards/13444/revisions/1/download](https://grafana.com/api/dashboards/13444/revisions/1/download)
2. Guarda el archivo como `flask-dashboard.json`.
3. Abre el archivo en un editor de texto y elimina la sección `"__inputs"` en la parte superior (o reemplázala con `"__inputs": [],`), tal como se explicó para el dashboard de MySQL.
4. Sube el JSON en Grafana -> **Import**, y una vez dentro del dashboard ve a **Dashboard Settings (⚙️) -> Variables** para mapear la variable `DS_PROMETHEUS` directamente a tu origen de datos de Prometheus activo.
5. Guarda el Dashboard. ¡Los paneles de Flask se actualizarán con las métricas en tiempo real de tus microservicios!
