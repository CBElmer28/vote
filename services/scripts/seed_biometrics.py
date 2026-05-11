import os
import boto3
import mysql.connector
from dotenv import load_dotenv

# 1. Cargar el .env desde la raíz del proyecto (un nivel arriba)
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

# 2. Configuración de BD (Apuntamos a localhost porque lo corremos fuera de Docker)
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': int(os.getenv('DB_PORT', 3307)), # El puerto va aquí, como un número entero
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', 'rootpassword'),
    'database': os.getenv('MYSQL_DATABASE', 'votesystem')
}
# 3. Configuración de AWS
rek_client = boto3.client(
    'rekognition',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

COLLECTION_ID = 'votos_collection'
FACES_DIR = os.path.join(os.path.dirname(__file__), 'seed_faces')

def seed_biometrics():
    print("Iniciando simulación de base de datos del Estado (RENIEC)...")
    
    # Crear la colección si no existe
    try:
        rek_client.create_collection(CollectionId=COLLECTION_ID)
        print(f"Colección '{COLLECTION_ID}' creada en AWS.")
    except rek_client.exceptions.ResourceAlreadyExistsException:
        print(f"La colección '{COLLECTION_ID}' ya existe en AWS. Continuando...")

    # Conectar a MySQL
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
    except Exception as e:
        print(f"❌ Error al conectar a la Base de Datos. ¿Está corriendo Docker? Detalle: {e}")
        return

    # Leer la carpeta de fotos
    if not os.path.exists(FACES_DIR):
        print(f"❌ No se encontró la carpeta: {FACES_DIR}")
        return

    fotos_procesadas = 0

    for filename in os.listdir(FACES_DIR):
        if filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            dni = os.path.splitext(filename)[0]
            image_path = os.path.join(FACES_DIR, filename)
            
            print(f"\nProcesando DNI: {dni}...")

            # Verificar si el usuario existe en BD
            cursor.execute("SELECT id FROM users WHERE dni = %s", (dni,))
            user = cursor.fetchone()
            
            if not user:
                print(f" ❌ DNI {dni} no encontrado en la tabla 'users'. Saltando...")
                continue
                
            user_id = user['id']

            # Leer la foto
            with open(image_path, 'rb') as img_file:
                image_bytes = img_file.read()

            try:
                # Enviar foto a AWS
                response = rek_client.index_faces(
                    CollectionId=COLLECTION_ID,
                    Image={'Bytes': image_bytes},
                    MaxFaces=1,
                    QualityFilter="AUTO"
                )

                if response['FaceRecords']:
                    face_id = response['FaceRecords'][0]['Face']['FaceId']
                    
                    # Actualizar BD
                    cursor.execute(
                        "UPDATE users SET aws_face_id = %s WHERE id = %s",
                        (face_id, user_id)
                    )
                    conn.commit()
                    print(f" ✅ Éxito: Vector biométrico vinculado (FaceId: {face_id})")
                    fotos_procesadas += 1
                else:
                    print(f" ⚠️ AWS no detectó un rostro claro en la foto {filename}")

            except Exception as e:
                print(f" ❌ Error procesando en AWS: {e}")

    cursor.close()
    conn.close()
    print(f"\nProceso finalizado. {fotos_procesadas} rostros sincronizados exitosamente.")

if __name__ == "__main__":
    seed_biometrics()