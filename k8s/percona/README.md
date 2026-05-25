# Migración a Percona XtraDB Cluster (Producción)

Este directorio contiene los manifiestos listos para producción para desplegar la base de datos MySQL de alta disponibilidad utilizando el **Percona XtraDB Cluster Operator**.

## ¿Por qué Percona XtraDB Cluster (PXC)?

- **Replicación Síncrona Estricta**: Basado en Galera, garantiza cero pérdida de datos (RPO = 0) y evita problemas de Split-Brain automáticamente.
- **Proxy Integrado (HAProxy/ProxySQL)**: Balancea las lecturas/escrituras y realiza failovers transparentes para la aplicación en menos de 1 segundo.
- **Autogestionado**: Backups automatizados (locales y S3), auto-saneamiento, escalado horizontal en caliente y actualización automática de esquemas y parches.

---

## Estrategia de Migración Segura (Blue-Green)

Para realizar una migración sin interrumpir el servicio (Zero-Downtime / Blue-Green), siga estos pasos detallados:

### Paso 1: Sincronía de Secretos
El clúster de Percona está diseñado para consumir el mismo Secret de producción que ya utiliza el sistema de votos actual:
- Nombre del Secret: `mysql-secrets`
- Clave de contraseña root: `mysql-root-password`

De esta forma, no necesitará cambiar contraseñas ni variables de entorno de credenciales en los microservicios.

### Paso 2: Desplegar el Operador en un Namespace separado
Para aislar la base de datos de producción y realizar pruebas de carga seguras, despliegue el operador en un nuevo namespace llamado `prod-db`:

```bash
# 1. Crear el Namespace de producción
kubectl create namespace prod-db

# 2. Desplegar el Operador Percona XtraDB Cluster
kubectl apply -f percona-operator.yaml -n prod-db
```

### Paso 3: Desplegar el Clúster de Base de Datos
Aplique el archivo de configuración del clúster:

```bash
kubectl apply -f percona-cluster.yaml -n prod-db
```

Esto levantará:
- 3 réplicas de MySQL (Galera) con almacenamiento persistente independiente.
- Un servicio de HAProxy/ProxySQL con balanceador de carga interno.

### Paso 4: Pruebas de Carga y Validación (Blue)
Antes de realizar la migración definitiva:
1. Conéctese temporalmente al servicio del balanceador de Percona (`cluster1-haproxy.prod-db.svc.cluster.local`).
2. Importe una copia de la base de datos actual para realizar pruebas sintácticas.
3. Ejecute pruebas de carga y simule caídas de pods (`kubectl delete pod <pod-name> -n prod-db`) para constatar la velocidad del failover de Galera y confirmar que no hay pérdida de consistencia.

### Paso 5: Migración en Caliente (Switching to Green)
Cuando todo esté validado:
1. Ponga la base de datos actual (desarrollo/Staging) en modo lectura (`SET GLOBAL read_only = ON;`).
2. Realice un dump final de datos e impórtelo en el clúster de Percona.
3. Actualice la variable de entorno `DB_HOST` (o el ConfigMap de base de datos) de todos sus microservicios para que apunten al balanceador de Percona:
   `cluster1-haproxy.prod-db.svc.cluster.local`
4. Reinicie los microservicios (`kubectl rollout restart deployment/...`).
5. Una vez que confirme que todo el tráfico de escritura se procesa con éxito en Percona, proceda a eliminar los recursos antiguos de MySQL local (`db-primary` y `db-secondary`).
