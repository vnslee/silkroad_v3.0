# Tech Stack Decisions — research-chatbot (2차)

## 런타임
- Python 3.9.25 (1차 상속). 타입힌트 `Optional`/`Literal`/`from __future__`.

## 신규/변경 의존성
| 패키지 | 버전 | 용도 | 결정 |
|---|---|---|---|
| anthropic | ==0.109.2 | Bedrock Mantle 클라이언트·구조화출력 | **신규 핀 추가**(Q3=A) — `app/backend/requirements.txt` |
| boto3 | ==1.42.97 | 자격증명 체인(Bedrock) | 1차에서 이미 핀(2차에서 실사용) |

> 1차 requirements.txt에 `anthropic==0.109.2` 한 줄 추가. 나머지(fastapi·pydantic·pytest·hypothesis·httpx 등) 그대로.

## Bedrock 구성 (config.py 확장)
```python
BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "ap-northeast-2")   # Q1: env override
BEDROCK_MODEL  = os.environ.get("BEDROCK_MODEL", "anthropic.claude-opus-4-8")
RESEARCH_SPEC_DIR = PROJECT_ROOT / "architecture" / "research"        # 프롬프트/스키마 self-locate
RESEARCH_MAX_TOKENS = 16000
```
- 클라이언트: `AnthropicBedrockMantle(aws_region=BEDROCK_REGION)`. 자격증명 boto3 표준 체인(Q1=A).
- 호출: `messages.create(model=BEDROCK_MODEL, max_tokens=RESEARCH_MAX_TOKENS, streaming, output_config={format:json_schema})`.
- 타임아웃: SDK 기본(10분)(Q2=A).

## 구조화 출력 / 검증
- 구조화출력: 느슨 json_schema(claude-api 제약 회피 — numeric/length constraint·재귀 없음).
- 사후 검증: pydantic 관대 모델(조건부 Optional·extra:allow, 필수 핵심키 strict).

## 챗봇
- `generate_text`(구조화 없음, Q4=A). 시스템 프롬프트로 톤·범위 지정. 무상태(Q5=A).

## 테스트
- pytest + Hypothesis(1차). 실 Bedrock 통합 스모크(Q8=B) — 마커(`@pytest.mark.bedrock` 등)로 분리 가능.

## 미채택
- 별도 AWS env 변수 강제(Q1 B) · 앱 레벨 재시도(Q5 B) · 챗봇 서버 세션(Q5 functional B).
