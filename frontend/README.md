# VoltChat ⚡

![Screenshot 2026-01-18 175318](https://github.com/user-attachments/assets/8ccad6d3-b541-4acd-b1f2-34805dbee882)![Screenshot 2026-01-18 175334](https://github.com/user-attachments/assets/af611872-a2dc-4432-b8f6-ff2e1450f7cd)



## Project info

This project, named "VoltChat", is a high-performance, frontend chat interface designed for developers. It's built using a modern web stack including **Vite, React, TypeScript, and Tailwind CSS**. The UI is composed of components from **shadcn-ui**.

The core functionality allows a user to interact with an AI backend. The application is architected to be backend-agnostic; it connects to any AI service via a configurable **webhook URL**. See the [Backend Connection Guide](./connect-to-backend.md) for detailed integration instructions.

If no webhook is configured, the application runs in a "demo mode" with simulated, pre-defined responses. State, including the webhook URL and chat history, is persisted in the browser's `localStorage`.

### Key Features:

*   **Backend Agnostic:** Connects to any service via a webhook.
*   **Stateful UI:** Persists chat history and webhook configuration locally.
*   **Demo Mode:** Fully functional UI even without a backend connected.
*   **Streaming Responses:** Simulates a real-time streaming effect for incoming messages.
*   **Modern Stack:** Utilizes Vite for fast development and bundling, with a full TypeScript and React foundation.

## Configuration

VoltChat is designed to be easily integrated with your own AI backend. You can configure it using environment variables in a `.env` file at the root of the project:

```env
# The URL of your AI chat endpoint (POST)
VITE_WEBHOOK_URL=https://your-api.com/chat

# Optional: Bearer token for authentication
VITE_API_TOKEN=your_secure_token

# Branding and Customization
VITE_APP_NAME=VoltChat
VITE_APP_DESCRIPTION=A high-performance chat interface.
VITE_APP_LOGO_URL=https://your-api.com/logo.png
VITE_FAVICON_URL=https://your-api.com/favicon.svg

# File Upload Configuration
VITE_ENABLE_UPLOADS=true
VITE_UPLOAD_URL=https://your-api.com/upload
```

### Integration Details
- **Branding**: `VITE_APP_NAME`, `VITE_APP_DESCRIPTION`, `VITE_APP_LOGO_URL`, and `VITE_FAVICON_URL` will update the UI title, welcome message, logos, and icons.
- **Upload Toggle**: Setting `VITE_ENABLE_UPLOADS=false` will hide the `+` button entirely, even if a URL is provided.
- **Chat**: Messages are sent as a POST request with a JSON body: `{ "message": "string", "sessionId": "string", "timestamp": "ISO-string" }`.
- **Upload**: Files are sent as `multipart/form-data` with the key `file`.
- **Auth**: If `VITE_API_TOKEN` is set, all requests will include an `Authorization: Bearer <token>` header.

## Building and Running

The project uses `npm` for package management.

### Docker: build-only image (artifacts only)

This repository includes a build-only `DOCKERFILE` which produces a minimal image containing the built static files at `/dist` and does not include any web server.

Build the image (PowerShell):

```powershell
docker build -t voltchat:dist .
```

After building, the image will contain the files at `/dist`. You can extract them or use a small server image to serve them if you need to run the app in a container:

```powershell
# extract dist from the image
docker create --name tmp voltchat:dist; docker cp tmp:/dist ./dist; docker rm tmp
```


### Setup Locally:

*   **Clone Project:**
    ```bash
    git clone
    ```

*   **Install Dependencies:**
    ```bash
    npm install
    ```

*   **Run Development Server:** Starts the Vite development server with hot-reloading.
    ```bash
    npm run dev
    ```

### Project Structure:

*   **`src/components`**: Contains reusable React components.
    *   `src/components/ui`: Holds the `shadcn-ui` components.
    *   `src/components/chat`: Contains application-specific components like `ChatContainer`, `ChatInput`, etc.
*   **`src/hooks`**: Custom React hooks are located here. The core application logic resides in `useChat.ts`.
*   **`src/pages`**: Contains top-level page components that are mapped to routes.
*   **`src/lib`**: Utility functions.
*   **`src/types`**: TypeScript type definitions.


## Technologies Used

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
