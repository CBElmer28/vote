import os
import sys
import json
import pymysql

# Ajustar path para importar el servicio dentro del contenedor
sys.path.append('/app')

from app.services.fingerprint_minutiae_service import FingerprintMinutiaeService

def seed():
    service = FingerprintMinutiaeService()
    
    # Rutas dentro del contenedor
    seeds = [
        {"dni": "11111111", "file": "/app/storage/huellas/101.png"},
        {"dni": "00000000", "file": "/app/storage/huellas/102.png"}
    ]
    
    templates = {}
    
    for item in seeds:
        print(f"Procesando huella para DNI {item['dni']}...")
        if not os.path.exists(item['file']):
            print(f"Archivo no encontrado: {item['file']}")
            continue

        with open(item['file'], 'rb') as f:
            img_bytes = f.read()
            
        skeleton = service.preprocess(img_bytes)
        if skeleton is None:
            print(f"Error procesando {item['file']}")
            continue
            
        minutiae = service.extract_minutiae(skeleton)
        template = service.generate_iso_template(minutiae)
        templates[item['dni']] = template
        print(f"Template generado: {len(minutiae)} minucias encontradas.")

    # Conectar a la DB (usamos host 'db' interno)
    try:
        connection = pymysql.connect(
            host=os.getenv('DB_HOST', 'votesystem-db'),
            port=3306,
            user='voteuser',
            password='votepassword',
            database='votesystem',
            cursorclass=pymysql.cursors.DictCursor
        )
        
        with connection.cursor() as cursor:
            for dni, template in templates.items():
                sql = "UPDATE users SET fingerprint_template = %s WHERE dni = %s"
                cursor.execute(sql, (json.dumps(template), dni))
            connection.commit()
            print("Base de datos actualizada correctamente.")
    except Exception as e:
        print(f"Error conectando a la DB: {e}")
    finally:
        if 'connection' in locals():
            connection.close()

if __name__ == "__main__":
    seed()
