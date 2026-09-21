#!/usr/bin/env python3
"""Local preview and content editor. Only listens on this computer."""
import argparse
import hashlib
import json
import secrets
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from content import validate_content

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
TOKEN = secrets.token_urlsafe(32)
MIME_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm"}


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] in ("/__editor", "/__editor/"):
            payload = (ROOT / "tools" / "editor.html").read_text(encoding="utf-8").replace("__EDITOR_TOKEN__", TOKEN).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("X-Frame-Options", "DENY")
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def respond(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        # A private token and same-origin request keep unrelated web pages from editing local files.
        origin = self.headers.get("Origin", "")
        expected = "http://" + self.headers.get("Host", "")
        if origin != expected or self.headers.get("X-Editor-Token") != TOKEN:
            self.respond(403, {"error": "请从本机编辑页面保存内容"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            limit = 25 * 1024 * 1024 if self.path == "/api/upload" else 1024 * 1024
            if length <= 0 or length > limit:
                raise ValueError("文件超过大小限制，单个媒体文件需小于 25 MB")
            raw = self.rfile.read(length)
            if self.path == "/api/content":
                content = validate_content(json.loads(raw))
                temporary = SITE / "content.json.tmp"
                temporary.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                temporary.replace(SITE / "content.json")
                self.respond(200, {"ok": True})
            elif self.path == "/api/upload":
                extension = MIME_EXT.get(self.headers.get("Content-Type", "").split(";")[0])
                if not extension:
                    raise ValueError("支持 JPG、PNG、WebP、GIF 图片和 MP4、WebM 视频")
                filename = "upload-" + hashlib.sha256(raw).hexdigest()[:16] + extension
                (SITE / "assets" / filename).write_bytes(raw)
                self.respond(200, {"path": "assets/" + filename})
            else:
                self.respond(404, {"error": "地址不存在"})
        except (ValueError, UnicodeDecodeError) as error:
            self.respond(400, {"error": str(error)})
        except OSError:
            self.respond(500, {"error": "保存失败，请检查本地文件权限"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(SITE)))
    print("网站预览：http://127.0.0.1:%s" % args.port, flush=True)
    print("内容编辑：http://127.0.0.1:%s/__editor" % args.port, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
