"""Chat 라우터 (C14, FR-4.2) — 챗봇 tool-use 에이전트.

POST /api/chat        — 동기 응답(스트림 미지원 클라이언트 폴백).
POST /api/chat/stream — SSE 스트림(status/token/done 이벤트). 답변이 타이핑되듯 흐른다.
데이터 없음은 needs_research가 아니라 에이전트의 잠정답 + propose_research로 처리.
Bedrock 호출 실패는 동기 502, 스트림은 본문 error 이벤트.
target_id/domain 형식 오류는 422(pydantic), message 비어있음도 422(VR-5).
"""
from __future__ import annotations

import json
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..config import TARGET_ID_PATTERN
from ..schemas import ChatFlowResponse, ChatRequest, ChatResponse
from ..services import chatbot, chatbot_flow
from ..services.bedrock_client import BedrockError

router = APIRouter(prefix="/api", tags=["chat"])


def _validate(req: ChatRequest) -> None:
    """공통 검증 — message 비어있지 않음(VR-5), target_id 형식(VR-2)."""
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=422, detail="message가 비어있음")
    if not re.fullmatch(TARGET_ID_PATTERN, req.target_id.upper()):
        raise HTTPException(status_code=422, detail=f"target_id 형식 오류: {req.target_id}")


@router.get("/chat/flow", response_model=ChatFlowResponse)
def chat_flow() -> ChatFlowResponse:
    """챗봇 흐름·선택지 명세(SoT) 제공 — 프론트가 초기 케이스/관점/퀵프롬프트 칩 렌더에 사용."""
    return ChatFlowResponse(**chatbot_flow.load_flow())


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """동기 응답 — 에이전트 루프를 끝까지 돌려 완성된 ChatResponse를 반환."""
    _validate(req)
    try:
        return chatbot.handle_agent(req)
    except BedrockError as exc:
        raise HTTPException(status_code=502, detail=f"Bedrock 호출 실패: {exc}")


def _sse(event: str, data: dict) -> str:
    """SSE 프레임 — `event:`/`data:`(한 줄 JSON) + 빈 줄 종결."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat/stream")
def chat_stream(req: ChatRequest) -> StreamingResponse:
    """SSE 스트림 — status/token/done 이벤트. tool-use 루프를 스트리밍 실행한다."""
    _validate(req)

    def gen():
        try:
            for ev in chatbot.stream_agent(req):
                etype = ev["type"]
                if etype == "token":
                    yield _sse("token", {"text": ev["text"]})
                elif etype == "status":
                    yield _sse("status", {"tool": ev["tool"]})
                elif etype == "done":
                    yield _sse("done", ev["response"])
        except BedrockError as exc:
            yield _sse("error", {"detail": f"Bedrock 호출 실패: {exc}"})
        except Exception as exc:  # noqa: BLE001 — 스트림은 HTTP가 이미 200이므로 본문 이벤트로 전달.
            yield _sse("error", {"detail": str(exc)})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 프록시(nginx/CloudFront) 버퍼링 방지.
        },
    )
