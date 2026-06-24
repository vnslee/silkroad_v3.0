# 배포 대상 (Deploy Target)

ROADMAP 4차(배포) 및 `deploy` 스킬이 참조하는 **배포 대상 고정 값**. 임의로 바꾸지 말 것.

## 배포 스택 = `silk-road` (신규)

우리 프로젝트는 **신규 독립 스택 `silk-road`** 로 배포한다. 절차·파라미터는 [`DEPLOY.md`](DEPLOY.md), 템플릿은 [`silk-road-stack.yaml`](silk-road-stack.yaml).

| 항목 | 값 |
|---|---|
| **스택 이름 (STACK_NAME)** | `silk-road` |
| 리전 (REGION) | `ap-northeast-2` (서울) |
| AWS 계정 (ACCOUNT) | `970227532419` (확인됨: user/admin) |
| ECR | `silk-road-backend`, `silk-road-frontend` |
| 구성 | ECS Fargate(1 task, backend:8000 + frontend nginx:80) + ALB. **DocumentDB 없음**(파일 storage). |

## 참조 스택 = `auto-finance` (기존 — 건드리지 않음)

| 항목 | 값 |
|---|---|
| 스택 ARN | `arn:aws:cloudformation:ap-northeast-2:970227532419:stack/auto-finance/a34432b0-69ec-11f1-be74-0ab177ce874d` |
| 상태 | `CREATE_COMPLETE` (기존 운영 인프라) |
| 구성 | ECS+ALB+**DocumentDB**+Secret, ECR `auto-finance-*:v1`, Sonnet/Haiku(apac) |
| ALB | `http://auto-fin-Alb-SQhhAY8y9yRc-1009988652.ap-northeast-2.elb.amazonaws.com` |

> auto-finance는 MongoDB/DocDB 의존·다른 모델 구성이라 **우리 코드와 불일치**. 그래서 새 스택을 분리(사용자 결정). VPC/서브넷만 재사용:
> - VpcId `vpc-09f7890577d5695fa`
> - PublicSubnets `subnet-070c28239494b5bbc,subnet-0ceae5ca1e0fd0769`
> - PrivateSubnets `subnet-0bf54a65a9f6fe0ed,subnet-00ec642fed1f7fa7f`

## 상태 (2026-06-22) — ✅ 배포 완료
- ✅ Dockerfile(backend·frontend) + nginx.conf, CloudFormation 템플릿 작성·validate 통과
- ✅ **arm64 네이티브** 빌드(빌드 호스트 Graviton, Fargate `RuntimePlatform: ARM64`). 컨테이너 로컬 스모크 통과.
- ✅ ECR 푸시: `silk-road-backend:e4f5d70`, `silk-road-frontend:e4f5d70`
- ✅ 스택 `silk-road` `CREATE_COMPLETE`, ECS 서비스 running 1/1, ALB 타깃 healthy
- ✅ **라이브 검증**: root 200 · `/api/countries` 200 · detail 잡(3차 확장) succeeded
- **서비스 URL**: http://silk-road-alb-1413394757.ap-northeast-2.elb.amazonaws.com
- 재배포(이미지 교체): `aws ecs update-service --cluster silk-road --service silk-road --force-new-deployment --region ap-northeast-2`
- **현재 배포 태그**: `47559ad-session` (보고서 공유 UI 제거 + region 보고서 본문 헤더 제거 + 시뮬레이션 버튼 보고서 생성 연결 + 챗봇 대상 LLM 추출). 이전: `e4f5d70-fix2`, `e4f5d70`.

## 리서치 웹검색 — AgentCore Gateway 연동 (템플릿 반영, 재배포 필요)

- **네트워크**: peering·VPC endpoint **불가/불필요**. Gateway는 AWS 관리형 서비스(us-east-1 전용)라 peering할 VPC가 없고, PrivateLink는 cross-region 미지원. 프라이빗 서브넷은 이미 **NAT GW**(`nat-0724bf6ed41a3baee`, `nat-097dea1d0d146ad71`)로 아웃바운드가 있어 us-east-1 공인 엔드포인트에 SigV4 호출 가능 — 추가 네트워크 작업 없음.
- **template 변경**(`silk-road-stack.yaml`): ① TaskRole에 `bedrock-agentcore:InvokeGateway`(Resource=게이트웨이 ARN으로 스코프) 추가, ② backend env에 `WEB_SEARCH_PROVIDER`/`GATEWAY_SEARCH_REGION`/`GATEWAY_SEARCH_URL`/`GATEWAY_SEARCH_ARN` 추가, ③ 파라미터 `WebSearchProvider`/`GatewaySearchUrl`/`GatewaySearchArn` 신설(기본값에 실제 게이트웨이 박힘). `validate-template` 통과.
- **게이트웨이**(콘솔 생성, us-east-1): URL `https://gateway-web-search-rdxcntzg00.gateway.bedrock-agentcore.us-east-1.amazonaws.com`, ARN `arn:aws:bedrock-agentcore:us-east-1:970227532419:gateway/gateway-web-search-rdxcntzg00`. 상세는 `architecture/research/GATEWAY_WEBSEARCH.md`.
- **적용**: 템플릿 변경이 반영되려면 `aws cloudformation deploy`로 스택 업데이트 필요(env·IAM 변경은 task 재생성 동반). 기본값에 게이트웨이가 박혀 있어 parameter-overrides 없이도 적용됨.
