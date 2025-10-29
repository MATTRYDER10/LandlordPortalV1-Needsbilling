# examples/run_python_example.py
import json, os, sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))
from propertygoose_scoring import score_propertygoose

with open(Path(__file__).parent / "example_input.json", "r") as f:
    data = json.load(f)

print(json.dumps(score_propertygoose(data), indent=2))
