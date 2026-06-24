#!/usr/bin/env python3
"""AgentCore Gateway + WebSearch 커넥터 1회 프로비저닝(멱등).

us-east-1에 MCP Gateway를 만들고(없으면) WebSearch 커넥터 타깃을 붙인 뒤(없으면),
READY까지 폴링하고 백엔드가 export할 env 라인을 출력한다. 운영자가 한 번 실행한다.

전제:
  - IAM 자격증명(boto3 표준 체인)이 컨트롤플레인 권한(bedrock-agentcore:CreateGateway/
    CreateGatewayTarget/GetGateway/ListGateways… + iam:PassRole)을 가짐.
  - 게이트웨이 서비스 롤(GATEWAY_ROLE_ARN env 또는 --role-arn)이 미리 생성돼 있음
    (trust: bedrock-agentcore.amazonaws.com, web-search 커넥터 호출 권한).

사용:
  GATEWAY_ROLE_ARN=arn:aws:iam::<acct>:role/AgentCoreGatewayRole \
    python3 app/backend/scripts/provision_gateway.py
  python3 app/backend/scripts/provision_gateway.py --role-arn arn:... --region us-east-1

⚠️ SDK 갭(중요): 설치된 boto3(=1.42.97, 현재 최신)의 bedrock-agentcore-control에서
   create_gateway_target의 targetConfiguration.mcp 가 지원하는 타입은
   openApiSchema / smithyModel / lambda / mcpServer / apiGateway 5종뿐이며,
   first-party Web Search 'connector'(connectorId="web-search") 멤버가 **노출되지 않는다**.
   따라서 이 스크립트의 connector 타깃 경로는 현 SDK에서 생성 실패한다.
   - 해소책 1) boto3가 connector 타깃을 노출하는 버전으로 올라오면 _TARGET_MODE="connector".
   - 해소책 2) 그 전까지는 mcpServer/lambda 타깃으로 검색 MCP·Lambda를 직접 붙인다(_TARGET_MODE).
   데이터플레인(gateway_search.py의 SigV4 MCP tools/call)은 타깃 종류와 무관하게 그대로 동작한다.
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import boto3
from botocore.exceptions import ClientError

# ── 고정 식별자(멱등 키) ─────────────────────────────────────────
GATEWAY_NAME = "silkroad-websearch-gw"
TARGET_NAME = "web-search"
CONNECTOR_ID = "web-search"  # first-party Web Search Tool 커넥터 id(확정)
DEFAULT_REGION = "us-east-1"  # WebSearch 커넥터는 us-east-1 전용

# 타깃 모드: "connector"(미래 SDK) | "mcpServer" | "lambda".
# 환경변수 GATEWAY_TARGET_MODE로 선택. 기본 connector(SDK 미지원 시 친절히 에러).
_TARGET_MODE = os.environ.get("GATEWAY_TARGET_MODE", "connector")


def _build_target_config(cp) -> dict:
    """모드별 targetConfiguration 생성. connector 미지원 SDK면 명확히 안내하고 중단."""
    mcp_members = _mcp_target_members(cp)
    if _TARGET_MODE == "connector":
        if "connector" not in mcp_members:
            raise SystemExit(
                "이 boto3 버전은 first-party Web Search 'connector' 타깃을 노출하지 않습니다"
                f"(지원: {sorted(mcp_members)}).\n"
                "  → boto3 업그레이드 후 재시도하거나, GATEWAY_TARGET_MODE=mcpServer|lambda 로\n"
                "    검색 MCP/Lambda 타깃을 사용하세요(자세한 내용은 파일 상단 주석)."
            )
        return {"mcp": {"connector": {"connectorId": CONNECTOR_ID}}}
    if _TARGET_MODE == "mcpServer":
        endpoint = os.environ.get("SEARCH_MCP_ENDPOINT")
        if not endpoint:
            raise SystemExit("GATEWAY_TARGET_MODE=mcpServer 에는 SEARCH_MCP_ENDPOINT env 필요")
        return {"mcp": {"mcpServer": {"endpoint": endpoint}}}
    if _TARGET_MODE == "lambda":
        arn = os.environ.get("SEARCH_LAMBDA_ARN")
        if not arn:
            raise SystemExit("GATEWAY_TARGET_MODE=lambda 에는 SEARCH_LAMBDA_ARN env 필요")
        # toolSchema는 검색 Lambda의 입출력 스키마(별도 정의 필요) — 여기선 골격만.
        return {"mcp": {"lambda": {"lambdaArn": arn, "toolSchema": {"inlinePayload": []}}}}
    raise SystemExit(f"알 수 없는 GATEWAY_TARGET_MODE: {_TARGET_MODE}")


def _mcp_target_members(cp) -> set:
    """현재 SDK가 노출하는 targetConfiguration.mcp 멤버 집합."""
    tc = cp.meta.service_model.operation_model(
        "CreateGatewayTarget"
    ).input_shape.members["targetConfiguration"]
    mcp = tc.members.get("mcp")
    return set(mcp.members.keys()) if mcp is not None and hasattr(mcp, "members") else set()

_POLL_INTERVAL = 5
_POLL_MAX = 60  # 최대 5분


def _client(region: str):
    return boto3.client("bedrock-agentcore-control", region_name=region)


def _find_gateway(cp) -> dict | None:
    """이름이 GATEWAY_NAME인 기존 게이트웨이를 찾는다(멱등 재사용)."""
    try:
        paginator = cp.get_paginator("list_gateways")
        pages = paginator.paginate()
    except Exception:  # noqa: BLE001 — 페이지네이터 미지원 시 단일 호출 폴백
        pages = [cp.list_gateways()]
    for page in pages:
        for gw in page.get("items", page.get("gateways", [])):
            if gw.get("name") == GATEWAY_NAME:
                return gw
    return None


def _wait_ready(getter, ident_kwargs: dict, label: str) -> dict:
    """status가 READY(또는 유사 종료상태)일 때까지 폴링."""
    for _ in range(_POLL_MAX):
        desc = getter(**ident_kwargs)
        status = desc.get("status") or desc.get("gatewayStatus") or ""
        if status.upper() in ("READY", "ACTIVE", "AVAILABLE"):
            return desc
        if status.upper() in ("FAILED", "DELETING", "DELETED"):
            raise SystemExit(f"{label} 프로비저닝 실패: status={status}")
        print(f"  … {label} status={status} (대기 중)")
        time.sleep(_POLL_INTERVAL)
    raise SystemExit(f"{label} READY 타임아웃")


def _gateway_id(gw: dict) -> str:
    return gw.get("gatewayId") or gw.get("id") or ""


def ensure_gateway(cp, role_arn: str) -> dict:
    existing = _find_gateway(cp)
    if existing:
        print(f"기존 게이트웨이 재사용: {GATEWAY_NAME} ({_gateway_id(existing)})")
        return _wait_ready(
            cp.get_gateway, {"gatewayIdentifier": _gateway_id(existing)}, "Gateway"
        )
    print(f"게이트웨이 생성: {GATEWAY_NAME}")
    created = cp.create_gateway(
        name=GATEWAY_NAME,
        protocolType="MCP",
        authorizerType="AWS_IAM",  # IAM/SigV4 inbound — Cognito/OAuth 불필요
        roleArn=role_arn,
    )
    return _wait_ready(
        cp.get_gateway, {"gatewayIdentifier": _gateway_id(created)}, "Gateway"
    )


def ensure_target(cp, gateway_id: str) -> None:
    try:
        existing = cp.list_gateway_targets(gatewayIdentifier=gateway_id)
        for t in existing.get("items", existing.get("targets", [])):
            if t.get("name") == TARGET_NAME:
                print(f"기존 타깃 재사용: {TARGET_NAME}")
                return
    except ClientError as exc:
        print(f"  (타깃 목록 조회 경고: {exc})")
    print(f"WebSearch 타깃 생성: {TARGET_NAME} (mode={_TARGET_MODE})")
    cp.create_gateway_target(
        gatewayIdentifier=gateway_id,
        name=TARGET_NAME,
        targetConfiguration=_build_target_config(cp),
    )
    _wait_ready(
        cp.get_gateway_target,
        {"gatewayIdentifier": gateway_id, "targetId": _resolve_target_id(cp, gateway_id)},
        "Target",
    )


def _resolve_target_id(cp, gateway_id: str) -> str:
    listing = cp.list_gateway_targets(gatewayIdentifier=gateway_id)
    for t in listing.get("items", listing.get("targets", [])):
        if t.get("name") == TARGET_NAME:
            return t.get("targetId") or t.get("id") or ""
    return ""


def main() -> int:
    ap = argparse.ArgumentParser(description="AgentCore WebSearch Gateway 프로비저닝")
    ap.add_argument("--region", default=os.environ.get("GATEWAY_SEARCH_REGION", DEFAULT_REGION))
    ap.add_argument("--role-arn", default=os.environ.get("GATEWAY_ROLE_ARN"))
    args = ap.parse_args()

    if not args.role_arn:
        print("ERROR: 게이트웨이 서비스 롤 ARN 필요 — GATEWAY_ROLE_ARN env 또는 --role-arn")
        return 2

    cp = _client(args.region)
    gw = ensure_gateway(cp, args.role_arn)
    gid = _gateway_id(gw)
    ensure_target(cp, gid)

    url = gw.get("gatewayUrl") or gw.get("url") or ""
    arn = gw.get("gatewayArn") or gw.get("arn") or ""
    print("\n=== 프로비저닝 완료 — 아래 env를 백엔드에 export ===")
    print(f"export GATEWAY_SEARCH_REGION={args.region}")
    print(f"export GATEWAY_SEARCH_URL={url}")
    print(f"export GATEWAY_SEARCH_ID={gid}")
    print(f"export GATEWAY_SEARCH_ARN={arn}")
    print("export WEB_SEARCH_PROVIDER=gateway")
    return 0


if __name__ == "__main__":
    sys.exit(main())
