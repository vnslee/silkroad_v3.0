# 리서치 웹검색 — AgentCore Gateway WebSearch 연동

챗봇 리서치 트리거(2차) 시 4축 에이전트(상품·규제·시장·시스템)가 외부 웹 정보를 가져오는
경로다. **오케스트레이션 선검색(Pattern B)** 방식 — 코드(`research_agent`)가 신뢰 도메인으로
검색을 직접 수행해 검증된 출처만 프롬프트에 주입하고, LLM은 검색하지 않는다. 출처 신뢰도
3티어는 코드가 결정적으로 강제한다.

## 왜 Gateway인가 (IAM 키만 있는 환경)

이 환경 자격증명은 IAM access key뿐이라 LLM 백엔드가 `legacy`(Bedrock InvokeModel)로 잡히고,
Anthropic SDK 웹검색 서버툴(`api`/`aws` 백엔드 한정)을 못 쓴다. AgentCore Gateway는 inbound
auth로 **AWS_IAM(SigV4)** 을 지원해 **Cognito/OAuth 없이 IAM 키만으로** 호출 가능하다.

## 리전 제약 (중요)

first-party "Web Search Tool" 커넥터는 **us-east-1 전용**(서울 미지원)이다. 따라서 Gateway는
us-east-1에 만들고, 서울 백엔드에서 **cross-region SigV4 호출**한다(`GATEWAY_SEARCH_REGION=us-east-1`).

## 실측 사실 (2026-06, us-east-1 실제 게이트웨이로 검증)

- **MCP 엔드포인트 경로는 `/mcp`**. 게이트웨이 루트 URL로 JSON-RPC를 보내면
  `UnknownOperationException`이 난다. `gateway_search._gateway_url()`이 URL 끝에 `/mcp`를 보장한다.
- **Accept 헤더에 `application/json, text/event-stream` 둘 다** 명시(MCP streamable HTTP).
- **도구명은 네임스페이스가 붙는다**: `WebSearch___WebSearch`(`<target>___<tool>`). 하드코딩하지
  않고 `tools/list`에서 `websearch` 포함 도구를 동적 해석한다(`_resolve_tool_name`).
- **WebSearch 입력 스키마는 `query`·`maxResults` 뿐 — 도메인 필터 인자가 없다.** 따라서
  티어/도메인 강제는 검색이 아니라 **호출측 사후 필터링**으로 한다: `web_search(allowed_domains=...)`가
  결과를 호스트 접미사로 거르고, `research_agent._prefetch_sources`는 넓게 검색→실제 도메인의
  신뢰 티어로 태깅→미분류 도메인 제외한다. 티어 강제는 코드가 100% 소유(설계 그대로).
- inbound auth `AWS_IAM` + 서울 백엔드 IAM 키로 cross-region SigV4 호출이 **정상 동작**.

## SDK 갭 참고 (프로비저닝 자동화 한정)

게이트웨이는 **콘솔에서 1회 생성**했다(WebSearch 커넥터 타깃 포함). 코드 자동 프로비저닝
(`provision_gateway.py`)은 보조 수단인데, 설치된 boto3(1.42.97, 현재 최신)의
`bedrock-agentcore-control`은 `targetConfiguration.mcp`로 `openApiSchema / smithyModel /
lambda / mcpServer / apiGateway` 5종만 노출하고 first-party **`connector` 멤버를 노출하지 않는다**
→ 스크립트의 connector 모드는 SDK가 지원할 때까지 친절한 에러로 중단한다. 데이터플레인은
타깃 생성 방식과 무관하므로, **콘솔 생성 게이트웨이로 충분히 운영**된다(URL만 env로 주입).

## 프로비저닝 (현재: 콘솔 1회)

us-east-1 콘솔에서 WebSearch 게이트웨이를 만들고 `gatewayUrl`을 env(`GATEWAY_SEARCH_URL`)로
주입한다. 코드 자동화가 필요해지면(connector 노출 SDK) `provision_gateway.py` 사용:

```bash
GATEWAY_ROLE_ARN=arn:aws:iam::<acct>:role/AgentCoreGatewayRole \
  python3 app/backend/scripts/provision_gateway.py
```

## 환경 변수 (config.py)

| 변수 | 기본 | 설명 |
|------|------|------|
| `WEB_SEARCH_PROVIDER` | `gateway` | `gateway`(선검색) / `server_tool`(SDK 서버툴) / `off` |
| `GATEWAY_SEARCH_REGION` | `us-east-1` | 커넥터 리전(서울 아님) |
| `GATEWAY_SEARCH_URL` | (없음) | provision 출력 `gatewayUrl`. 없으면 gateway 경로 비활성 |
| `GATEWAY_SEARCH_ID` / `GATEWAY_SEARCH_ARN` | (없음) | 진단·IAM 스코프용 |
| `GATEWAY_SEARCH_MAX_RESULTS` | `10` | 쿼리당 결과 수 상한(1~25) |

`gateway_search_enabled()` = `WEB_SEARCH_PROVIDER=="gateway" and GATEWAY_SEARCH_URL 설정됨`.

## IAM (실제 ARN/키 커밋 금지)

### 1) 호출자 정책 — 서울 백엔드 IAM 사용자/롤
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock-agentcore:InvokeGateway"],
    "Resource": ["arn:aws:bedrock-agentcore:us-east-1:<ACCOUNT_ID>:gateway/<GATEWAY_ID>"]
  }]
}
```
컨트롤플레인(프로비저닝 1회)에는 추가로 `bedrock-agentcore:CreateGateway`·`CreateGatewayTarget`·
`GetGateway`·`GetGatewayTarget`·`ListGateways`·`ListGatewayTargets` 와 `iam:PassRole`(게이트웨이 롤)이 필요.

### 2) 게이트웨이 서비스 롤 (`roleArn`)
```json
// trust policy
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "bedrock-agentcore.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```
권한 정책: web-search 커넥터 호출 권한(또는 mcpServer/lambda 타깃 시 `lambda:InvokeFunction` 등).
정확한 액션 목록은 AWS AgentCore Gateway setup 문서로 확정할 것. # TODO verify

## 신뢰도 3티어

`app/backend/storage/data/internal/source_tiers.json`이 도메인→티어(T1/T2/T3)를 소유한다
(운영자 편집). 점수 가중(tier→multiplier)은 `internal_latest.json.tier_weights`가 소유 — 분리.

- **T1**(=정수 tier 1): 정부·규제기관·중앙은행·통계·신용평가(.gov, europa.eu, imf.org, S&P/Moody's/Fitch…)
- **T2**(=정수 tier 2): 신뢰 언론·협회·컨설팅(Reuters, FT, ACEA…)
- **T3**(=정수 tier 3·4): 교차검증 전용 — **단독 인용 금지**(`is_citable_alone=false`).

`research_agent._prefetch_sources`가 T1·T2 도메인 allowlist로만 검색(티어 강제), 어느 티어에도
없는 도메인은 제외한다. `_apply_tier_policy`가 인용 출처 기준으로 item.tier를 보정하고,
T3 단독 지지 item은 `estimated:true`/`so_what="조사 필요"`로 FLAG한다(삭제 아님).

## 검증

```bash
# 유닛(네트워크 없음, 기본 수집)
pytest tests/test_credibility.py
# 실 게이트웨이 스모크(env + IAM 필요)
pytest -m bedrock tests/test_gateway_search_smoke.py
# E2E 리서치(gateway 경로)
WEB_SEARCH_PROVIDER=gateway pytest -m bedrock tests/test_research_bedrock_smoke.py
```
