"""PDF Service (C6) — 보고서 HTML → PDF (L7, FR-5).

report-pdf 스킬 스크립트(html_to_pdf.py) 로직을 in-process import로 호출한다.
출력 규약: .../<ID>/html/<name>.html → .../<ID>/pdf/<name>.pdf (형제 pdf/).
ensure_pdf는 멱등 — 이미 있으면 재변환하지 않는다.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Optional

from .. import config

_log = config.get_logger("pdf_service")
_convert_fn = None  # lazy-loaded html_to_pdf 함수


class PdfError(RuntimeError):
    pass


def _pdf_path_for(html_path: Path) -> Path:
    """html/<name>.html → ../pdf/<name>.pdf."""
    return html_path.parent.parent / "pdf" / (html_path.stem + ".pdf")


def _load_converter():
    """report-pdf 스크립트에서 변환 함수를 동적 로드(첫 호출 시)."""
    global _convert_fn
    if _convert_fn is not None:
        return _convert_fn
    if not config.PDF_SCRIPT.exists():
        raise PdfError(f"report-pdf 스크립트 없음: {config.PDF_SCRIPT}")
    spec = importlib.util.spec_from_file_location("html_to_pdf", str(config.PDF_SCRIPT))
    if spec is None or spec.loader is None:
        raise PdfError("html_to_pdf 모듈 로드 실패")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # html_to_pdf.py의 공개 계약은 convert(src, out). 인자 시그니처가 다른
    # main() 등은 후보에서 제외(리뷰 M4).
    for name in ("convert", "html_to_pdf", "render_pdf"):
        fn = getattr(module, name, None)
        if callable(fn):
            _convert_fn = fn
            return _convert_fn
    raise PdfError("html_to_pdf 변환 함수(convert)를 찾지 못함")


def ensure_pdf(html_path: Path) -> Path:
    """HTML→PDF 변환(멱등). PDF 절대경로 반환."""
    html_path = Path(html_path)
    if not html_path.exists():
        raise PdfError(f"입력 HTML 없음: {html_path}")
    pdf_path = _pdf_path_for(html_path)
    if pdf_path.exists():
        return pdf_path  # 캐시 재사용
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    convert = _load_converter()
    convert(str(html_path), str(pdf_path))
    if not pdf_path.exists():
        raise PdfError(f"PDF 생성 실패: {pdf_path}")
    _log.info("pdf generated: %s", pdf_path)
    return pdf_path
