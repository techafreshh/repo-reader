import requests
import json

BASE_URL = "http://localhost:8000"

def test_api():
    print("Initializing repo...")
    resp = requests.post(f"{BASE_URL}/initialize", json={"repo_target": "."})
    print(f"Init status: {resp.status_code}")
    data = resp.json()
    print(data)
    
    session_id = data["session_id"]
    
    print("\nSending chat message...")
    chat_resp = requests.post(f"{BASE_URL}/chat", json={
        "session_id": session_id,
        "message": "What files are in this repo?"
    })
    print(f"Chat status: {chat_resp.status_code}")
    print(chat_resp.json()["response"])

if __name__ == "__main__":
    test_api()
