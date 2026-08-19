"""
ConectaFone Pro - Servidor Local & Vercel Ready
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="ConectaFone Pro", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas PWA e Arquivos Principais
@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

@app.get("/manifest.json")
async def serve_manifest():
    return FileResponse(os.path.join(BASE_DIR, "manifest.json"), media_type="application/manifest+json")

@app.get("/sw.js")
async def serve_sw():
    return FileResponse(os.path.join(BASE_DIR, "sw.js"), media_type="application/javascript")

@app.get("/app.css")
async def serve_css():
    return FileResponse(os.path.join(BASE_DIR, "app.css"), media_type="text/css")

@app.get("/app.js")
async def serve_js():
    return FileResponse(os.path.join(BASE_DIR, "app.js"), media_type="application/javascript")

# Monta diretório de ícones
if os.path.exists(os.path.join(BASE_DIR, "icons")):
    app.mount("/icons", StaticFiles(directory=os.path.join(BASE_DIR, "icons")), name="icons")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, log_level="info")
