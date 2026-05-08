# Connecting VoltChat to Your Backend

VoltChat is designed to be a "plug-and-play" frontend for any AI service. It communicates with your backend via standard HTTP POST requests.

## 1. Configuration
Open your `.env` file and set the following variables:

```env
# The main endpoint for chat messages
VITE_WEBHOOK_URL=https://your-api.com/chat

# Optional: Bearer token for authentication
# If set, VoltChat will send: Authorization: Bearer <token>
VITE_API_TOKEN=your_secret_token

# Optional: Endpoint for file uploads
VITE_UPLOAD_URL=https://your-api.com/upload
VITE_ENABLE_UPLOADS=true
```

## 2. Chat Integration Specs

### Request
When a user sends a message, VoltChat sends a `POST` request with a JSON body:

```json
{
  "message": "Hello, how are you?",
  "sessionId": "abc-123-xyz",
  "timestamp": "2024-05-07T15:30:00Z"
}
```

### Expected Response
Your backend should return a JSON object. VoltChat is flexible and looks for the response in the following fields (in order of priority):
1. `output.response`
2. `output` (as a string)
3. `response`
4. `message`
5. `content`

**Standard Example:**
```json
{
  "response": "I am doing great! How can I help you build today?"
}
```

## 3. File Upload Integration Specs

### Request
When a user uploads a file, VoltChat sends a `POST` request with `multipart/form-data`:
- **Key**: `file`
- **Value**: The binary file data.

### Expected Response
Your backend should return a JSON object. If successful, VoltChat will display a confirmation message in the chat.

```json
{
  "status": "success",
  "file_id": "file_98765"
}
```

## 4. Critical: CORS Configuration
Since VoltChat runs in the browser, your backend **must** have Cross-Origin Resource Sharing (CORS) enabled.

- **Allowed Origins**: `http://localhost:8026` (or your production domain).
- **Allowed Methods**: `POST`, `OPTIONS`.
- **Allowed Headers**: `Content-Type`, `Authorization`.

## 5. Example Backend (Python / FastAPI)

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, specify your exact frontend URL
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/chat")
async def chat_handler(request: Request):
    data = await request.json()
    user_message = data.get("message")
    
    # Your AI logic here
    ai_response = f"You said: {user_message}"
    
    return {"response": ai_response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9732)
```

## 6. Docker Considerations
If you are running VoltChat inside a Docker container and your backend is running on your host machine:
- Use `VITE_WEBHOOK_URL=http://host.docker.internal:9732/chat`.
- Ensure your backend is listening on `0.0.0.0` rather than `127.0.0.1`.
