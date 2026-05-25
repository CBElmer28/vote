import requests

BASE_URL = "http://localhost/api"

def test_malicious_file_rejection():
    print("\n[Black Box] Testing Malicious/Fake Image Rejection...")
    
    # Create a fake image (actually just text)
    with open("fake_image.jpg", "w") as f:
        f.write("This is not an image, it is a malicious script or dummy text.")
    
    # Attempt to upload it to biometric register
    files = {
        'face_photo': ('rostro.jpg', open('fake_image.jpg', 'rb'), 'image/jpeg')
    }
    data = {
        'dni': '99999999'
    }
    
    try:
        res = requests.post(f"{BASE_URL}/biometrico/register/face", files=files, data=data)
        print(f"Fake image upload result: {res.status_code}")
        if res.status_code != 200:
            print(f"Success: File rejected as expected. Error: {res.json().get('error')}")
        else:
            print("Failure: File was accepted! Security gap detected.")
    except Exception as e:
        print(f"Error during upload: {e}")

if __name__ == "__main__":
    test_malicious_file_rejection()
