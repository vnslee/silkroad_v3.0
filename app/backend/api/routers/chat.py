"""Chat 라우터 (C14, FR-4.2) — 챗봇 동기 응답.

데이터 없음은 200 + needs_research(정상 분기). Bedrock 호출 실패는 502.
target_id/domain 형식 오류는 422(pydantic), message 비어있음도 422(VR-5).
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException

from ..config import TARGET_ID_PATTERN
from ..schemas import ChatRequest, ChatResponse
from ..services import chatbot
from ..services.bedrock_client import BedrockError

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    # VR-5: message 비어있지 않음.
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=422, detail="message가 비어있음")
    # VR-2: target_id 형식(대문자 정규화).
    target = req.target_id.upper()
    if not re.fullmatch(TARGET_ID_PATTERN, target):
        raise HTTPException(status_code=422, detail=f"target_id 형식 오류: {target}")
    members = [c.upper() for c in (req.member_codes or [])]
    domain = req.domain
    try:
        # 질문 속 국가/권역을 LLM으로 추출 — 식별되면 그 대상으로 분기,
        # 실패 시 프론트가 보낸 domain/target_id로 폴백(§6.5).
        resolved = chatbot.resolve_target(req.message, history=req.history)
        if resolved:
            r_domain, r_target = resolved
            if re.fullmatch(TARGET_ID_PATTERN, r_target):
                domain, target = r_domain, r_target
        resp = chatbot.handle(
            domain, target, req.message, history=req.history, member_codes=members
        )
        # 식별한 대상을 응답에 실어 프론트가 리서치 트리거 대상으로 쓰게 한다.
        resp.resolved_domain = domain
        resp.resolved_target_id = target
        return resp
    except BedrockError as exc:
        raise HTTPException(status_code=502, detail=f"Bedrock 호출 실패: {exc}")
