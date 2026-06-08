import socket
import sys

import uvicorn

from app.core.config import settings


def is_port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0


def main():
    if is_port_in_use(settings.HOST, settings.PORT):
        print(
            f"ERROR: Port {settings.PORT} is already in use. "
            f"Kill the existing process or change the PORT in .env",
            file=sys.stderr,
        )
        sys.exit(1)

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )


if __name__ == "__main__":
    main()
