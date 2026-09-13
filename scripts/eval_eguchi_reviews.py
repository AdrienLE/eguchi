"""Opt-in live eval with a hard call cap. Example: python -m scripts.eval_eguchi_reviews --live.

Each invocation is capped at 12 requests and 2,400 output tokens/request, including reasoning.
An API error stops the run. Output contains synthetic results and token usage only.
"""

import argparse
import json
import time
from pathlib import Path

from backend.foundation_review_evidence import build_evidence
from backend.foundation_reviews import request_decision
from scripts.eguchi_review_cases import NOW, cases


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Authorize metered OpenAI requests")
    parser.add_argument("--model", default="gpt-5.6-luna")
    parser.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
    parser.add_argument("--limit", type=int, default=3, choices=range(1, 13))
    parser.add_argument("--cases", help="Comma-separated case names")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    chosen = [c for c in cases() if not args.cases or c[0] in args.cases.split(",")][: args.limit]
    report = {"model": args.model, "effort": args.effort, "syntheticOnly": True, "results": []}
    for name, events, expected, source in chosen:
        evidence = build_evidence(events, NOW)
        if not args.live:
            print(f"{name}: expected {expected}; source {source}; no API call")
            continue
        start = time.monotonic()
        try:
            result, usage = request_decision(evidence, args.model, args.effort)
        except Exception as error:
            # Do not print raw provider errors, which can contain request/credential data.
            print(f"{name}: stopped ({type(error).__name__})", flush=True)
            args.output.write_text(json.dumps(report, indent=2))
            raise SystemExit(2)
        passed = result.decision in expected.split("|") and (
            expected != "advance" or result.confidence != "low"
        )
        row = {
            "case": name,
            "expected": expected,
            "passed": passed,
            "expectedSource": source,
            "result": result.model_dump(),
            "usage": usage,
            "seconds": round(time.monotonic() - start, 2),
        }
        report["results"].append(row)
        args.output.write_text(json.dumps(report, indent=2))
        print(
            json.dumps(
                {
                    "case": name,
                    "passed": passed,
                    "decision": result.decision,
                    "confidence": result.confidence,
                    "usage": usage,
                }
            ),
            flush=True,
        )
    if args.live and not all(r["passed"] for r in report["results"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
