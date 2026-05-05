# VoteSystem 🗳️

Plataforma de Votación Segura basada en una arquitectura de Microservicios (Flask/Python) y un cliente moderno (React). 
Diseñada para escalabilidad, validación biométrica (Azure Face API) y un diseño *Premium Glassmorphism*.

## Arquitectura

El sistema está compuesto por 5 microservicios backend orquestados mediante Docker y una base de datos MySQL 8, más un frontend independiente.

| Servicio | Tecnología | Puerto | Descripción |
|----------|------------|--------|-------------|
| **Base de Datos** | MySQL 8 | `3307` | Base de datos principal (mapeado al 3307 para evitar conflictos locales). |
| **MS1 Usuarios** | Flask | `5001` | Gestión de usuarios, registro y generación de tokens JWT de autenticación. |
| **MS2 Biométrico** | Flask | `5002` | Validación facial y dactilar conectada a Microsoft Azure Face API. |
| **MS3 Votación** | Flask | `5003` | Emisión y validación cruzada de votos. Reglas de negocio principales. |
| **MS4 Análisis** | Flask | `5004` | Generación de estadísticas en tiempo real y gráficos en base64 (Matplotlib). |
| **MS5 Candidatos** | Flask | `5005` | Gestión (CRUD) del padrón de candidatos electorales. |
| **Frontend** | React (Vite) | `5173` | Cliente Web UI. |

---

## 🚀 Requisitos Previos

Antes de arrancar el proyecto, asegúrate de tener instalado:
- [Docker](https://www.docker.com/) y [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) (Versión 20+ o 22.12+)

---

## 🛠️ Instalación y Configuración

### 1. Variables de Entorno
Clona este repositorio y configura las variables de entorno. 
Existe un archivo `.env.example` en la raíz. Cópialo y renómbralo a `.env`:

```bash
cp .env.example .env
```
*(Puedes dejar los valores por defecto para pruebas locales).*

### 2. Levantar el Backend (Microservicios)
Utiliza Docker Compose para construir y levantar toda la infraestructura:

```bash
docker-compose up -d --build
```

Verifica que todos los contenedores estén corriendo (`docker ps`). La primera vez que MySQL arranca, ejecutará automáticamente los scripts en `db/init/` para crear las tablas y datos semilla (Candidatos por defecto).

### 3. Levantar el Frontend (React)
Abre otra pestaña de tu terminal, navega a la carpeta `frontend` y ejecuta:

```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en [http://localhost:5173](http://localhost:5173).

---

## 👤 Uso del Sistema

1. **Registro:** Ingresa a la app y regístrate como un nuevo votante (recuerda usar un DNI de 8 dígitos).
2. **Login:** Inicia sesión con el DNI recién creado.
3. **Flujo de Votación:**
   - **Paso 1 (Foto):** Concede permisos de cámara y tómate una foto.
   - **Paso 2 (Huella):** Para este entorno de demostración, sube cualquier imagen o archivo simulando el escáner dactilar.
   - **Paso 3 (Selección):** Elige a tu candidato de la lista.
4. **Resultados en Vivo:** Al finalizar, verás las analíticas que se refrescan automáticamente cada 10 segundos.

---

## 📄 Notas de Desarrollo
- Si realizas cambios en el esquema de base de datos (`01_schema.sql`), deberás borrar el volumen persistente de MySQL para que los scripts de inicialización vuelvan a ejecutarse:
  `docker-compose down -v` y luego `docker-compose up -d --build`.
- Los gráficos del dashboard en vivo son generados internamente por el microservicio de análisis (MS4) y enviados en Base64 al frontend para evitar dependencias pesadas de gráficas en el cliente.
