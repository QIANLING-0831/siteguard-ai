"""Run experimental open-vocabulary PPE inference for one inspection image."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from ultralytics import YOLOWorld


def center_in_head_region(helmet: list[float], person: list[float]) -> bool:
    hx = (helmet[0] + helmet[2]) / 2
    hy = (helmet[1] + helmet[3]) / 2
    px1, py1, px2, py2 = person
    return px1 <= hx <= px2 and py1 <= hy <= py1 + (py2 - py1) * 0.42


def normalized_box(box: list[float], width: int, height: int) -> dict[str, float]:
    x1, y1, x2, y2 = box
    return {
        "x": max(0.0, min(1.0, x1 / width)),
        "y": max(0.0, min(1.0, y1 / height)),
        "width": max(0.0, min(1.0, (x2 - x1) / width)),
        "height": max(0.0, min(1.0, (y2 - y1) / height)),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--inspection-id", required=True)
    parser.add_argument("--evidence-id", required=True)
    parser.add_argument("--model", default="yolov8s-worldv2.pt")
    args = parser.parse_args()

    model = YOLOWorld(args.model)
    classes = ["person", "hard hat", "safety helmet"]
    model.set_classes(classes)
    result = model(Path(args.image), device="cpu", conf=0.25, verbose=False)[0]
    height, width = result.orig_shape

    detections: list[tuple[str, float, list[float]]] = []
    for item in result.boxes:
        class_name = model.names[int(item.cls.item())]
        confidence = float(item.conf.item())
        xyxy = [float(value) for value in item.xyxy[0].tolist()]
        detections.append((class_name, confidence, xyxy))

    helmet_boxes = [box for name, _, box in detections if name in {"hard hat", "safety helmet"}]
    person_rows = [(confidence, box) for name, confidence, box in detections if name == "person"]
    persons = []
    findings = []
    model_name = "YOLOWorld v2 zero-shot + 头部归属规则 · 实验"

    for index, (confidence, box) in enumerate(person_rows, start=1):
        person_id = f"person-{index}"
        has_helmet = any(center_in_head_region(helmet, box) for helmet in helmet_boxes)
        status = "helmet" if has_helmet else "no_helmet"
        persons.append(
            {
                "id": person_id,
                "box": normalized_box(box, width, height),
                "helmetStatus": status,
                "confidence": round(confidence, 4),
            }
        )
        if not has_helmet:
            finding_confidence = round(min(confidence, 0.75), 4)
            findings.append(
                {
                    "id": f"finding-{args.evidence_id}-{person_id}",
                    "inspectionId": args.inspection_id,
                    "evidenceId": args.evidence_id,
                    "subjectDetectionId": person_id,
                    "title": "临边工作人员疑似未佩戴安全帽",
                    "label": "suspected_no_helmet",
                    "confidence": finding_confidence,
                    "severitySuggestion": "high",
                    "status": "pending_confirmation",
                    "model": model_name,
                }
            )

    print(
        json.dumps(
            {
                "inspectionId": args.inspection_id,
                "evidenceId": args.evidence_id,
                "model": model_name,
                "adapter": "ultralytics-yolo-world",
                "reviewStatus": "pending_human_review",
                "persons": persons,
                "findings": findings,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
