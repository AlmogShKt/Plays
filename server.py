#!/usr/bin/env python3
"""
Tiny local server for the real-estate calculator.
Run: python server.py
Open: http://localhost:8420

Serves static files (html/css/js) and exposes two API endpoints
that read/write cal-data.json in the same directory — acting as
a simple local database.
"""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8420
DATA_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "real-estate-data.json"
)


class CalHandler(SimpleHTTPRequestHandler):
    """Extend SimpleHTTPRequestHandler with JSON save/load API + CORS."""

    # ── CORS headers (needed when HTML is served from another port) ──

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/load":
            self._handle_load()
        elif self.path == "/":
            self.send_response(302)
            self.send_header("Location", "/real-estate-calc.html")
            self.end_headers()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/save":
            self._handle_save()
        else:
            self.send_error(404)

    # ── API handlers ──

    def _handle_load(self):
        """Return the contents of real-estate-data.json, or 204 if not found."""
        if os.path.isfile(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                raw = f.read()
            self._json_response(200, raw, already_encoded=True)
        else:
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()

    def _handle_save(self):
        """Write request body to real-estate-data.json."""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self._json_response(200, json.dumps({"ok": True}), already_encoded=True)
        except (json.JSONDecodeError, OSError) as e:
            self._json_response(
                500,
                json.dumps({"ok": False, "error": str(e)}),
                already_encoded=True,
            )

    def _json_response(self, code, body, already_encoded=False):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._send_cors_headers()
        self.end_headers()
        if already_encoded:
            self.wfile.write(body.encode("utf-8") if isinstance(body, str) else body)
        else:
            self.wfile.write(json.dumps(body).encode("utf-8"))

    def log_message(self, format, *args):
        pass


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = HTTPServer(("127.0.0.1", PORT), CalHandler)
    print(f"🏠 Calculator server running at http://localhost:{PORT}")
    print(f"   Data file: {DATA_FILE}")
    print("   Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
