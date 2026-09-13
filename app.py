"""Compatibility entrypoint for the local operations backend.

The former repo-root Flask implementation was retired to reduce duplication.
Use backendAPI.py for the maintained local/admin runtime and
python_sql_calls_repo/app.py plus App_render.py for the product/Render backend.
"""

from wsgiref.simple_server import make_server

from backendAPI import app, _QuietWSGIRequestHandler, _ThreadingWSGIServer


if __name__ == '__main__':
    httpd = make_server(
        '127.0.0.1',
        5050,
        app,
        server_class=_ThreadingWSGIServer,
        handler_class=_QuietWSGIRequestHandler,
    )
    print('Serving backendAPI via compatibility app.py on http://127.0.0.1:5050')
    httpd.serve_forever()
