"""
backend/run_server.py - Dual-Stack Server Runner for NEXUS Core

Binds to both IPv6 (::1, localhost) and IPv4 (127.0.0.1, 0.0.0.0) simultaneously
to guarantee Windows 11/10 never encounters ERR_CONNECTION_REFUSED when resolving
'localhost' to IPv6 (::1) during OAuth redirects and API calls.
"""

import os
import sys
import socket
import uvicorn
from dotenv import load_dotenv

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

def main():
    port = int(os.getenv("PORT", "8000"))
    
    sock = None
    try:
        sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        sock.bind(("::", port))
        sock.listen(128)
        print(f"[*] NEXUS Core: Dual-stack socket bound on [::]:{port} (accepts both IPv6 'localhost' and IPv4 '127.0.0.1')")
    except Exception as e:
        print(f"[!] Dual-stack socket failed ({e}). Falling back to 0.0.0.0:{port}")
        sock = None

    if sock:
        server = uvicorn.Server(uvicorn.Config("main:app", log_level="info"))
        server.run(sockets=[sock])
    else:
        uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")

if __name__ == "__main__":
    main()
