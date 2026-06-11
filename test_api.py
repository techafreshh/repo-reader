import requests
import json

BASE_URL = "http://localhost:7643"

def test_api():
    print("Initializing repo...")
    resp = requests.post(f"{BASE_URL}/initialize", json={"repo_target": "."})
    print(f"Init status: {resp.status_code}")
    data = resp.json()
    print(data)
    
    session_id = data["session_id"]
    
    print("\nSending AG-UI message...")
    agui_resp = requests.post(
        f"{BASE_URL}/agui",
        json={
            "threadId": session_id,
            "runId": "test-run-1",
            "messages": [
                {"id": "msg-1", "role": "user", "content": "What files are in this repo?"}
            ],
            "state": {"session_id": session_id},
            "tools": [],
            "context": [],
            "forwardedProps": {},
        },
        stream=True,
    )
    print(f"AG-UI status: {agui_resp.status_code}")
    
    # Parse SSE response
    for line in agui_resp.iter_lines(decode_unicode=True):
        if line:
            print(f"  {line}")

if __name__ == "__main__":
    test_api()
