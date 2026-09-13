"""Canonical WSGI probe runner for the local backend."""

from wsgiref.simple_server import make_server

from backendAPI import app


def main() -> None:
    server = make_server('127.0.0.1', 5050, app)
    print('WSGI server ready on 5050')
    server.serve_forever()


if __name__ == '__main__':
    main()