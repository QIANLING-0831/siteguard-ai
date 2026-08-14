"""Return a 64-bit difference hash for image bytes received on stdin."""

import io
import json
import sys

from PIL import Image


def difference_hash(content: bytes) -> str:
    with Image.open(io.BytesIO(content)) as image:
        pixels = list(image.convert("L").resize((9, 8), Image.Resampling.LANCZOS).getdata())
    bits = 0
    for row in range(8):
        for column in range(8):
            bits = (bits << 1) | int(pixels[row * 9 + column] > pixels[row * 9 + column + 1])
    return f"{bits:016x}"


if __name__ == "__main__":
    try:
        print(json.dumps({"visualHash": difference_hash(sys.stdin.buffer.read())}))
    except Exception as error:  # adapter treats this as an unavailable optional fingerprint
        print(json.dumps({"error": str(error)}))
        raise SystemExit(1)
