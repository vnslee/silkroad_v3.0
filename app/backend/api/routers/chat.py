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
        # 질문 속 국가/권역을 추출(LLM + 결정적 매칭). 식별되면 그 대상으로 분기.
        resolved = chatbot.resolve_target(req.message, history=req.history)
        if resolved:
            r_domain, r_target = resolved
            if re.fullmatch(TARGET_ID_PATTERN, r_target):
                domain, target = r_domain, r_target
        elif not chatbot.continues_prior_target(req.message, req.history):
            # 대상 식별 실패 + 이전 대상을 이어가는 후속질문도 아님(예: '아프리카' 같은
            # 대륙·모호한 질문) → 프론트 기본값(ES)으로 답하지 말고 어느 국가인지 되묻는다.
            return chatbot.ask_for_target()
        # (식별 실패지만 후속질문이면 프론트가 보낸 직전 target 유지 — 대화 연속성)
        resp = chatbot.handle(
            domain, target, req.message, history=req.history, member_codes=members
        )
        # 식별한 대상을 응답에 실어 프론트가 리서치/보고서 트리거 대상으로 쓰게 한다.
        resp.resolved_domain = domain
        resp.resolved_target_id = target
        return resp
    except BedrockError as exc:
        raise HTTPException(status_code=502, detail=f"Bedrock 호출 실패: {exc}")
