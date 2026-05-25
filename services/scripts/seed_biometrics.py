import os
import boto3
import pymysql
from dotenv import load_dotenv

# 1. Cargar el .env (opcional, útil para local)
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv() 

# 2. Configuración de BD
DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 3307)) if os.getenv('DB_HOST') not in ['db', 'votesystem_db'] else 3306,
    'user': os.getenv('DB_USER', os.getenv('MYSQL_USER', 'voteuser')),
    'password': os.getenv('DB_PASSWORD', os.getenv('MYSQL_PASSWORD', 'votepassword')),
    'database': os.getenv('DB_NAME', os.getenv('MYSQL_DATABASE', 'votesystem'))
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
    except Exception as e:
        print(f"Error crítico al conectar con AWS Rekognition: {e}")
        return

    # Conectar a MySQL usando pymysql
    try:
        conn = pymysql.connect(
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            database=DB_CONFIG['database'],
            cursorclass=pymysql.cursors.DictCursor
        )
        cursor = conn.cursor()
    except Exception as e:
        print(f"Error al conectar a la Base de Datos. Detalle: {e}")
        return

    # Leer la carpeta de fotos
    if not os.path.exists(FACES_DIR):
        print(f"No se encontró la carpeta: {FACES_DIR}")
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
                print(f"DNI {dni} no encontrado en la tabla 'users'. Saltando...")
                continue
                
            user_id = user['id']

            # Leer la foto
            with open(image_path, 'rb') as img_file:
                image_bytes = img_file.read()

            try:
                # Enviar foto a AWS Rekognition
                response = rek_client.index_faces(
                    CollectionId=COLLECTION_ID,
                    Image={'Bytes': image_bytes},
                    MaxFaces=1,
                    QualityFilter="AUTO"
                )

                if response['FaceRecords']:
                    face_id = response['FaceRecords'][0]['Face']['FaceId']
                    
                    # Actualizar BD con el FaceId real de AWS
                    cursor.execute(
                        "UPDATE users SET aws_face_id = %s WHERE id = %s",
                        (face_id, user_id)
                    )
                    conn.commit()
                    print(f"Exito: Rostro indexado en AWS y vinculado en BD (FaceId: {face_id})")
                    fotos_procesadas += 1
                else:
                    print(f"Advertencia: AWS no detectó un rostro claro en la foto {filename}")

            except Exception as e:
                print(f"Error procesando en AWS para DNI {dni}: {e}")

    cursor.close()
    conn.close()
    print(f"\nProceso finalizado. {fotos_procesadas} rostros sincronizados exitosamente.")

if __name__ == "__main__":
    seed_biometrics()