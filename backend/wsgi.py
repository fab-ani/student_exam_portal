from werkzeug.middleware.proxy_fix import ProxyFix

from app import app

# Render and Railway terminate TLS at their edge and forward as plain HTTP
# with X-Forwarded-* headers. ProxyFix trusts one hop of those so Flask
# sees the original https scheme/host instead of plain http://internal.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
