"""Kleiner Testserver mit HTTP-Range-Unterstützung (nötig fürs Springen im Video)."""
import http.server, os, re, sys
class H(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path); m = re.match(r"bytes=(\d*)-(\d*)", rng)
        start = int(m.group(1) or 0); end = int(m.group(2)) if m.group(2) else size - 1
        f = open(path, "rb"); f.seek(start); self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path)); self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}"); self.send_header("Content-Length", str(end - start + 1)); self.end_headers()
        self._len = end - start + 1; return f
    def copyfile(self, src, dst):
        n = getattr(self, "_len", None)
        if n is None: return super().copyfile(src, dst)
        while n > 0:
            b = src.read(min(65536, n))
            if not b: break
            dst.write(b); n -= len(b)
        self._len = None
os.chdir(sys.argv[1]); http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), H).serve_forever()
