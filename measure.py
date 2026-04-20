import urllib.request
import time

start_time = time.time()
requests = 0
while time.time() - start_time < 5:
    urllib.request.urlopen("http://localhost:8000/api/stats").read()
    urllib.request.urlopen("http://localhost:8000/api/trades").read()
    requests += 2
    time.sleep(2)
print(f"Polling baseline: {requests} HTTP requests in 5s")
