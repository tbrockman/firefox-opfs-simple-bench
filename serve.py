#!/usr/bin/env python3
"""Serve this directory with COOP/COEP headers (stdlib only).

`python3 -m http.server` works for the benchmark too, but without
cross-origin isolation performance.now() is clamped to 1 ms in Firefox and
100 µs in Chromium, which quantises the per-call latency percentiles. With
the two headers below the page becomes cross-origin isolated and the clock
resolution drops to 20 µs (Firefox) / 5 µs (Chromium). Totals, ops/s and
MB/s are unaffected either way; the page reports the measured resolution.

Usage: python3 serve.py [port]      default port 8000, binds 127.0.0.1
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class IsolatedHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    directory = str(Path(__file__).resolve().parent)
    handler = partial(IsolatedHandler, directory=directory)
    with ThreadingHTTPServer(('127.0.0.1', port), handler) as httpd:
        print(f'Serving {directory} at http://localhost:{port}/ with COOP/COEP (Ctrl+C to stop)')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
