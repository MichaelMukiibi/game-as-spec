# /// script
# dependencies = [
#     "fastapi",
#     "uvicorn",
#     "websockets",
#     "watchfiles",
# ]
# ///

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from watchfiles import awatch

connected_clients = set()

def read_world_spec():
    """Reads the current raw JSONL specification from disk."""
    try:
        with open("public/world.jsonl", "r") as f:
            return f.read()
    except FileNotFoundError:
        return ""

async def watch_file_changes():
    """Watches the public directory safely without breaking on atomic saves."""
    print("[Watcher] Tracking changes in the 'public/' directory...")
    async for changes in awatch("public"):
        for change_type, file_path in changes:
            if file_path.endswith("world.jsonl"):
                print(f"[Watcher] Change detected in world.jsonl ({change_type}). Broadcasting...")
                
                if not connected_clients:
                    print("[Watcher] No active browser windows open. Skipping broadcast.")
                    continue
                    
                updated_state = read_world_spec()
                for client in list(connected_clients):
                    try:
                        await client.send_text(updated_state)
                    except Exception:
                        connected_clients.remove(client)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Phase: Spin up our asynchronous directory file watcher
    watcher_task = asyncio.create_task(watch_file_changes())
    yield
    # Shutdown Phase: Cleanly cancel the background worker task
    watcher_task.cancel()

# Initialize FastAPI directly injecting the lifespan rules
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    print(f"[Engine] Browser UI connected! Active connections: {len(connected_clients)}")
    
    try:
        # Immediate state synchronization frame
        await websocket.send_text(read_world_spec())
        while True:
            await websocket.receive_text()  # Keeps socket stream alive
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        connected_clients.remove(websocket)
        print(f"[Engine] Browser UI disconnected. Active connections: {len(connected_clients)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)