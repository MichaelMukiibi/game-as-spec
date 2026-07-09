# /// script
# dependencies = [
#     "fastapi",
#     "uvicorn",
#     "watchfiles",
# ]
# ///

import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from watchfiles import awatch

app = FastAPI()

# Allow connections from our local Vite dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Keep track of active browser connections
connected_clients = set()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    print(f"[Engine] Client connected. Active views: {len(connected_clients)}")
    
    # Send current world state immediately upon initial connection
    try:
        world_data = read_world_spec()
        await websocket.send_text(world_data)
        
        # Keep connection open to listen for lifecycle disconnects
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        connected_clients.remove(websocket)
        print(f"[Engine] Client disconnected. Active views: {len(connected_clients)}")

def read_world_spec():
    """Reads the current raw JSONL specification from disk."""
    try:
        with open("public/world.jsonl", "r") as f:
            return f.read()
    except FileNotFoundError:
        return ""

async def watch_file_changes():
    """Watches the public directory and streams deltas to all connected web interfaces."""
    print("[Watcher] Tracking changes on 'public/' directory...")
    async for changes in awatch("public"):
        for change_type, file_path in changes:
            #Check if modified file is the world spec
            if file_path.endswith("world.jsonl"):
                print(f"[Watcher] Change detected in world.jsonl ({change_type}). Broadcasting to engine...")
                
            if not connected_clients:
                print("[Watcher] No active browser windows open. Skipping broadcast.")
                continue
                
            print("[Watcher] Configuration update detected! Streaming changes...")
            updated_state = read_world_spec()
            
            # Broadcast the updated stream to all running engine instances
            for client in list(connected_clients):
                try:
                    await client.send_text(updated_state)
                except Exception:
                    connected_clients.remove(client)

@app.on_event("startup")
async def startup_event():
    # Spin up file watcher asynchronously alongside the web server loop
    asyncio.create_task(watch_file_changes())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)