"""
WhatsApp Campaign Builder - Backend Server
Runs the Node.js API server with PostgreSQL.
"""
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import subprocess
import os
import time
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NODE_API_URL = "http://127.0.0.1:8080"
node_process = None

async def ensure_node_server():
    """Ensure the Node.js API server is running."""
    global node_process
    
    # Check if already running
    try:
        async with httpx.AsyncClient() as client:
            await client.get(f"{NODE_API_URL}/api/healthz", timeout=2.0)
            return True
    except:
        pass
    
    # Start PostgreSQL
    subprocess.run(["pg_ctlcluster", "15", "main", "start"], capture_output=True)
    await asyncio.sleep(1)
    
    # Start Node server
    env = os.environ.copy()
    env["DATABASE_URL"] = "postgresql://whatsapp:whatsapp_secret@localhost:5432/whatsapp_campaigns"
    env["PORT"] = "8080"
    
    node_process = subprocess.Popen(
        ["node", "--enable-source-maps", "dist/index.mjs"],
        cwd="/app/artifacts/api-server",
        env=env,
    )
    
    # Wait for it to be ready
    for _ in range(30):
        try:
            async with httpx.AsyncClient() as client:
                await client.get(f"{NODE_API_URL}/api/healthz", timeout=2.0)
                return True
        except:
            await asyncio.sleep(0.5)
    
    return False

@app.on_event("startup")
async def startup():
    await ensure_node_server()

@app.get("/api/healthz")
async def health():
    return {"status": "ok"}

@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_api(request: Request, path: str):
    """Proxy /api/* requests to Node.js server."""
    await ensure_node_server()
    
    async with httpx.AsyncClient() as client:
        url = f"{NODE_API_URL}/api/{path}"
        headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]}
        
        body = None
        if request.method not in ["GET", "HEAD", "OPTIONS"]:
            body = await request.body()
        
        try:
            resp = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body,
                params=request.query_params,
                timeout=120.0,
            )
            
            resp_headers = {k: v for k, v in resp.headers.items() 
                          if k.lower() not in ["content-encoding", "content-length", "transfer-encoding"]}
            
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=resp_headers,
                media_type=resp.headers.get("content-type"),
            )
        except httpx.TimeoutException:
            return Response(content='{"error":"Timeout"}', status_code=504, media_type="application/json")
        except Exception as e:
            return Response(content=f'{{"error":"{str(e)}"}}', status_code=502, media_type="application/json")
