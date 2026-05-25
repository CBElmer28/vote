from locust import HttpUser, task, between
import random

def generate_random_ip():
    """Generates a random public IPv4 address to spoof X-Forwarded-For"""
    return f"{random.randint(1, 254)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"

class VoterUser(HttpUser):
    wait_time = between(1, 3) # Wait 1 to 3 seconds between tasks
    
    def on_start(self):
        # Assign a random IP to this virtual user for the duration of its session
        # This prevents Flask-Limiter from blocking the entire stress test suite
        self.virtual_ip = generate_random_ip()
        self.headers = {
            "X-Forwarded-For": self.virtual_ip,
            "User-Agent": "Locust Stress Tester"
        }

    @task(3) # Weight 3: Very common action
    def list_candidates(self):
        """Simulates a user browsing the candidates page"""
        with self.client.get("/api/candidatos/", headers=self.headers, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed with status: {response.status_code}")

    @task(1) # Weight 1: Less common action
    def check_vote_status(self):
        """Simulates checking if a specific user has voted (Random user ID to avoid caching)"""
        user_id = random.randint(1, 1000)
        with self.client.get(f"/api/votacion/user/{user_id}", headers=self.headers, catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed with status: {response.status_code}")
