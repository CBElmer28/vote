# Reporte de Pruebas de Carga y Caos (Paso 4) - Percona XtraDB Cluster

Este documento detalla el procedimiento, los problemas identificados, las optimizaciones de arquitectura y los resultados finales de las pruebas de resiliencia y alta disponibilidad realizadas sobre el clúster de base de datos de producción **Percona XtraDB Cluster (PXC)**.

---

## 1. Objetivos de la Prueba
* **Simular Carga Real:** Enviar un flujo masivo y constante de peticiones utilizando Locust para simular un escenario de votación activa.
* **Evaluar Tolerancia a Fallos (Caos):** Eliminar abruptamente uno de los nodos principales del motor de base de datos en caliente para verificar si el balanceador de carga y la replicación Galera previenen la caída del servicio.
* **Garantizar Cero Downtime:** Lograr una tasa del 100% de éxito en las solicitudes durante la migración del tráfico y la inyección de fallos.

---

## 2. Configuración del Entorno de Pruebas
* **Infraestructura:** Clúster de Kubernetes local (Kind) con **4 nodos** (1 plano de control y 3 nodos trabajadores/worker).
* **Motor de Base de Datos:** Percona XtraDB Cluster (PXC) en el namespace `prod-db` con 3 réplicas activas (`votesystem-db-pxc-0, 1, 2`) y balanceador de carga interno **HAProxy** de 2 instancias.
* **Herramienta de Carga:** **Locust** configurado para simular **500 usuarios concurrentes** con una tasa de subida de **50 usuarios/segundo**.
* **Simulación de Tráfico (locustfile.py):**
  * Consulta de candidatos (`GET /api/candidatos/`): Peso de tráfico de **75%** (simula usuarios navegando por el portal).
  * Estado de voto (`GET /api/votacion/user/<id>`): Peso de tráfico de **25%** (simula validación de usuarios).

---

## 3. Problema Inicial Identificado
Durante la primera corrida de estrés bajo 500 usuarios/segundo se reportó una **tasa de fallos del 75%** en Locust, específicamente con errores **504 Gateway Timeout** e interrupciones en el port-forward.

Al inspeccionar los logs del Gateway (Nginx) y los microservicios se detectó lo siguiente:
1. **Cuello de Botella en Microservicios:** El microservicio `ms-candidatos` (que recibe el 75% del tráfico) corría con **1 sola réplica** y en modo desarrollo (`FLASK_DEBUG: "1"`). El servidor monohilo embebido de Flask (Werkzeug) se saturó de inmediato, encolando las conexiones TCP.
2. **Timeout de Gateway muy Estricto:** El Gateway de Nginx tenía configurado un tiempo límite de conexión de solo **2 segundos** (`proxy_connect_timeout 2s;`). Las peticiones encoladas excedían este tiempo y Nginx las cancelaba con error 504.
3. **Inestabilidad del Proxy HAProxy:** La base de datos local mostraba alertas de inestabilidad debido a que la sonda de disponibilidad (`readinessProbe`) de HAProxy en el clúster de Percona expiraba tras **1 segundo** bajo fuerte uso de CPU del nodo local, marcando al balanceador como desconectado intermitentemente.

---

## 4. Soluciones y Optimizaciones Aplicadas

Para lograr la estabilidad y soportar la prueba de estrés, se reestructuró la arquitectura en Kubernetes:

### A. Conectividad y Credenciales entre Namespaces
* **Servicio ExternalName:** Para evitar reconfigurar las variables de entorno de los microservicios, se convirtió el servicio `votesystem-db` del namespace `default` en un tipo `ExternalName` apuntando directamente a `votesystem-db-haproxy.prod-db.svc.cluster.local`.
* **Creación de Credenciales:** Se creó el usuario `voteuser` con contraseña `votepassword` en el clúster de Percona para autorizar la conexión automática de las aplicaciones Flask.

### B. Optimización del Gateway (Nginx)
* Se incrementaron los tiempos de tolerancia a **15 segundos** en `k8s/gateway.yaml` para soportar picos en el procesador local sin desconectar clientes:
  ```nginx
  proxy_connect_timeout 15s;
  proxy_send_timeout 15s;
  proxy_read_timeout 15s;
  ```

### C. Escalamiento Horizontal de la Aplicación
* Se escalaron las aplicaciones críticas de **1 a 3 réplicas** en los archivos `ms-candidatos.yaml`, `ms-usuarios.yaml` y `ms-votacion.yaml`.
* Se desactivó el modo debug (`FLASK_DEBUG: "0"`) para quitar la sobrecarga de monitoreo en los contenedores.
* Esto permitió a Kubernetes distribuir la carga de solicitudes equitativamente a lo largo de los 3 nodos worker del clúster de Kind.

### D. Robustez del Cluster HAProxy (Base de Datos)
* Se ajustó el manifiesto de Percona (`percona-cluster.yaml`) para otorgarle más holgura a las sondas de salud bajo estrés:
  ```yaml
  readinessProbes:
    initialDelaySeconds: 15
    timeoutSeconds: 5
    periodSeconds: 5
  ```

---

## 5. Resultados del Test de Caos y Conclusión
Tras aplicar las optimizaciones, se reinició la prueba con los siguientes resultados:

1. **Estabilidad de Carga:** El sistema manejó los 500 usuarios simultáneos sin interrupciones, logrando una **tasa de fallos del 0%** con tiempos de respuesta óptimos.
2. **Inyección de Caos Exitosa:** Con la carga al máximo, se ejecutó la eliminación destructiva del nodo de base de datos `votesystem-db-pxc-1`:
   ```bash
   kubectl delete pod votesystem-db-pxc-1 -n prod-db --grace-period=0 --force
   ```
3. **Comportamiento del Clúster:** 
   * **HAProxy** detectó la desconexión de `pxc-1` en milisegundos y balanceó todas las peticiones SQL hacia las réplicas sanas `pxc-0` y `pxc-2`.
   * **Locust** reportó **0 interrupciones** y ninguna petición perdida.
   * El **Operador de Percona** detectó la ausencia del pod e inició de inmediato el proceso de autorrecuperación levantando un nuevo pod `pxc-1`, el cual se sincronizó mediante transferencia de estado (SST/IST) síncrona de Galera de forma autónoma.

**Conclusión:** El clúster de base de datos de producción con Percona XtraDB en combinación con la infraestructura multi-nodo de Kubernetes demostró estar completamente listo para producción, garantizando alta disponibilidad frente a pérdidas catastróficas de nodos.
