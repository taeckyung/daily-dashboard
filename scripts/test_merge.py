"""Tests for merge.py. Run: python3 -m unittest discover -s scripts"""

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from merge import EMPTY_DATA, FindingsError, merge  # noqa: E402

NOW = "2026-11-14T04:40:00+00:00"


def job(**overrides):
    base = {
        "id": "lg-ai-research-phd-2026",
        "company": "LG AI Research",
        "title": "AI Research Scientist (박사)",
        "qualification": "박사 학위 소지자 또는 예정자",
        "jeonmun": "가능",
        "deadline": "2026-11-30",
        "url": "https://careers.lg.com/apply/1234",
    }
    return {**base, **overrides}


def gpu(**overrides):
    base = {
        "id": "nipa-gpu-2026-4q",
        "name": "고성능 컴퓨팅 지원사업 4차",
        "org": "NIPA",
        "kind": "정부",
        "scale": "H100 4장, 3개월",
        "deadline": "2026-11-20",
        "url": "https://www.nipa.kr/notice/5678",
    }
    return {**base, **overrides}


def findings(date, jobs=(), gpus=(), summary=""):
    return {"date": date, "summary": summary, "jobs": list(jobs), "gpu": list(gpus)}


class MergeAccumulationTest(unittest.TestCase):
    def test_first_run_adds_items_as_new(self):
        data = merge(EMPTY_DATA, findings("2026-11-14", [job()], [gpu()]), NOW)
        self.assertEqual(data["updated_at"], NOW)
        self.assertEqual(data["jobs"][0]["first_seen"], "2026-11-14")
        self.assertEqual(data["jobs"][0]["status"], "open")
        self.assertEqual(data["runs"][0]["new"], {"jobs": ["lg-ai-research-phd-2026"], "gpu": ["nipa-gpu-2026-4q"]})

    def test_items_missing_from_later_run_are_kept(self):
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [job()], [gpu()]), NOW)
        day2 = merge(day1, findings("2026-11-15", [], []), NOW)
        self.assertEqual(len(day2["jobs"]), 1)
        self.assertEqual(len(day2["gpu"]), 1)
        self.assertEqual(day2["jobs"][0]["last_seen"], "2026-11-14")
        self.assertEqual([r["date"] for r in day2["runs"]], ["2026-11-15", "2026-11-14"])

    def test_seen_again_updates_last_seen_only(self):
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [job()]), NOW)
        day2 = merge(day1, findings("2026-11-15", [job()]), NOW)
        item = day2["jobs"][0]
        self.assertEqual((item["first_seen"], item["last_seen"]), ("2026-11-14", "2026-11-15"))
        self.assertEqual(item["changes"], [])
        self.assertEqual(day2["runs"][0]["new"]["jobs"], [])

    def test_deadline_extension_is_recorded_as_change(self):
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [job()]), NOW)
        day2 = merge(day1, findings("2026-11-15", [job(deadline="2026-12-07")]), NOW)
        self.assertEqual(
            day2["jobs"][0]["changes"],
            [{"date": "2026-11-15", "field": "deadline", "from": "2026-11-30", "to": "2026-12-07"}],
        )
        self.assertEqual(day2["runs"][0]["changed"]["jobs"], ["lg-ai-research-phd-2026"])

    def test_same_url_with_different_id_is_not_duplicated(self):
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [job()]), NOW)
        day2 = merge(day1, findings("2026-11-15", [job(id="lg-ai-phd-renamed")]), NOW)
        self.assertEqual([i["id"] for i in day2["jobs"]], ["lg-ai-research-phd-2026"])

    def test_rerun_on_same_date_is_idempotent(self):
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [job()]), NOW)
        again = merge(day1, findings("2026-11-14", [job()]), NOW)
        self.assertEqual(len(again["runs"]), 1)
        self.assertEqual(again["runs"][0]["new"]["jobs"], ["lg-ai-research-phd-2026"])
        self.assertEqual(again["jobs"], day1["jobs"])

    def test_inputs_are_not_mutated(self):
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [job()]), NOW)
        snapshot = copy.deepcopy(day1)
        merge(day1, findings("2026-11-15", [job(deadline="2026-12-07")]), NOW)
        self.assertEqual(day1, snapshot)
        self.assertEqual(EMPTY_DATA["jobs"], [])


class MergeDeadlineTest(unittest.TestCase):
    def test_item_closes_the_day_after_deadline(self):
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [], [gpu()]), NOW)
        on_deadline = merge(day1, findings("2026-11-20"), NOW)
        after = merge(on_deadline, findings("2026-11-21"), NOW)
        self.assertEqual(on_deadline["gpu"][0]["status"], "open")
        self.assertEqual(after["gpu"][0]["status"], "closed")

    def test_rolling_item_without_deadline_stays_open(self):
        rolling = job(deadline=None, deadline_text="상시채용")
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [rolling]), NOW)
        later = merge(day1, findings("2027-03-01"), NOW)
        self.assertEqual(later["jobs"][0]["status"], "open")

    def test_explicit_close_is_applied(self):
        day1 = merge(EMPTY_DATA, findings("2026-11-14", [job()]), NOW)
        day2 = merge(day1, findings("2026-11-15", [job(status="closed")]), NOW)
        self.assertEqual(day2["jobs"][0]["status"], "closed")


class MergeValidationTest(unittest.TestCase):
    def assert_rejected(self, bad):
        with self.assertRaises(FindingsError):
            merge(EMPTY_DATA, bad, NOW)

    def test_rejects_bad_run_date(self):
        self.assert_rejected(findings("11/14/2026", [job()]))

    def test_rejects_missing_required_field(self):
        self.assert_rejected(findings("2026-11-14", [job(company="")]))

    def test_rejects_non_http_url(self):
        self.assert_rejected(findings("2026-11-14", [job(url="javascript:alert(1)")]))

    def test_rejects_free_text_deadline(self):
        self.assert_rejected(findings("2026-11-14", [], [gpu(deadline="11월 말")]))

    def test_rejects_duplicate_ids(self):
        self.assert_rejected(findings("2026-11-14", [job(), job(url="https://careers.lg.com/apply/9")]))


class MergeCliTest(unittest.TestCase):
    def test_cli_writes_accumulated_file(self):
        script = Path(__file__).resolve().parent / "merge.py"
        with tempfile.TemporaryDirectory() as tmp:
            data_path = Path(tmp) / "data.json"
            for date, jobs in (("2026-11-14", [job()]), ("2026-11-15", [job(id="sait-phd", url="https://sait.samsung.com/1")])):
                findings_path = Path(tmp) / "findings.json"
                findings_path.write_text(json.dumps(findings(date, jobs)), encoding="utf-8")
                subprocess.run([sys.executable, str(script), str(findings_path), str(data_path)], check=True, capture_output=True)
            data = json.loads(data_path.read_text(encoding="utf-8"))
        self.assertEqual(len(data["jobs"]), 2)
        self.assertEqual(len(data["runs"]), 2)


if __name__ == "__main__":
    unittest.main()
