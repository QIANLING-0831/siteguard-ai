"""Check the local vision runtime without downloading model weights."""

from __future__ import annotations

import platform
from pathlib import Path

import supervision
import torch
import ultralytics


def main() -> None:
    print(f"python={platform.python_version()}")
    print(f"ultralytics={ultralytics.__version__}")
    print(f"supervision={supervision.__version__}")
    print(f"torch={torch.__version__}")
    print(f"cuda_available={torch.cuda.is_available()}")
    print(f"yolo_world_weight_present={Path('yolov8s-worldv2.pt').exists()}")
    print("status=ready (experimental open-vocabulary model; no validated PPE-specific weights installed)")


if __name__ == "__main__":
    main()
