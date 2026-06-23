"""API 통합 테스트 (예제 기반, PBT-10) — happy-path + 에러(409/404/422).

기존 리서치 데이터(country ES, region EU)를 활용한다.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_list_countries_contains_es(client):
    r = client.get("/api/countries")
    assert r.status_code == 200
    codes = {c["code"] for c in r.json()}
    assert "ES" in codes


def test_list_regions_contains_eu(client):
    r = client.get("/api/regions")
    assert r.status_code == 200
    codes = {c["code"] for c in r.json()}
    assert "EU" in codes


def test_country_existence_true(client):
    r = client.get("/api/countries/ES")
    assert r.status_code == 200
    body = r.json()
    assert body["exists"] is True
    assert body["domain"] == "country"


def test_country_existence_false_returns_200(client):
    # 데이터 없는 국가도 200 + exists:false (Q4=A)
    r = client.get("/api/countries/ZZ")
    assert r.status_code == 200
    assert r.json()["exists"] is False


def test_invalid_target_id_422(client):
    # 패턴 위반(소문자/숫자) → 422
    r = client.get("/api/countries/es1")
    assert r.status_code == 422


def test_report_list_es(client):
    r = client.get("/api/countries/ES/reports")
    assert r.status_code == 200
    body = r.json()
    assert body["domain"] == "country"
    # 기존 RPT_CTR_ES_001 존재
    assert any(rep["report_id"] == "RPT_CTR_ES_001" for rep in body["reports"])


def test_report_json_fetch(client):
    r = client.get("/api/countries/ES/reports/RPT_CTR_ES_001/json")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
    assert r.json()["report_id"] == "RPT_CTR_ES_001"


def test_report_html_fetch(client):
    r = client.get("/api/countries/ES/reports/RPT_CTR_ES_001/html")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")


def test_report_missing_404(client):
    r = client.get("/api/countries/ES/reports/RPT_CTR_ES_999/json")
    assert r.status_code == 404


def test_report_id_prefix_mismatch_404(client):
    # region prefix를 country 경로에 → 형식 불일치 404
    r = client.get("/api/countries/ES/reports/RPT_RGN_ES_001/json")
    assert r.status_code == 404


def test_generate_report_for_missing_data_409(client):
    r = client.post("/api/countries/ZZ/reports")
    assert r.status_code == 409


def test_job_not_found_404(client):
    r = client.get("/api/jobs/nonexistent")
    assert r.status_code == 404


def test_detail_html_es(client):
    r = client.get("/api/countries/ES/detail")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")


# ── 비동기 생성 플로우 (POST→폴링) — 라우트 충돌 회귀 방지 포함 ──────────
def _cleanup_report(domain: str, code: str, report_id: str) -> None:
    """테스트로 생성된 산출물(JSON/HTML/PDF) 제거 — 부수효과 정리."""
    from api import config

    base = config.REPORT_DIR / domain / code
    for sub, ext in (("data", "json"), ("html", "html"), ("pdf", "pdf")):
        f = base / sub / f"{report_id}.{ext}"
        if f.exists():
            f.unlink()
    pdf_dir = base / "pdf"
    if pdf_dir.is_dir() and not any(pdf_dir.iterdir()):
        pdf_dir.rmdir()


def _run_generation(client, domain_path: str, code: str, prefix: str):
    r = client.post(f"/api/{domain_path}/{code}/reports")
    assert r.status_code == 202, r.text
    body = r.json()
    assert "status_url" in body
    # TestClient는 BackgroundTasks를 응답 후 동기 실행 → 폴링 시 완료 상태
    js = client.get(body["status_url"]).json()
    assert js["status"] == "succeeded", js.get("error")
    assert js["step"] == "done" and js["percent"] == 100
    report_id = js["result"]["report_id"]
    assert report_id.startswith(prefix)
    # 산출물 HTML 조회 가능
    assert client.get(js["result"]["html_url"]).status_code == 200
    return report_id


def test_country_report_generation_flow(client):
    rid = _run_generation(client, "countries", "GB", "RPT_CTR_GB_")
    _cleanup_report("country", "GB", rid)


def test_region_report_generation_flow(client):
    # region POST 경로가 country 라우트와 충돌하지 않는지 회귀 검증
    rid = _run_generation(client, "regions", "EU", "RPT_RGN_EU_")
    _cleanup_report("region", "EU", rid)
