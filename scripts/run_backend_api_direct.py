"""Canonical direct Flask runner for the local backend."""

import backendAPI


def main() -> None:
    backendAPI.app.run(
        host='127.0.0.1',
        port=5000,
        debug=False,
        use_reloader=False,
        threaded=True,
    )


if __name__ == '__main__':
    main()