# silk-road 배포 절차 (ROADMAP 4차)

신규 독립 스택 **`silk-road`** 로 배포한다. 기존 **`auto-finance`** 스택은 **참조 모델**일 뿐 건드리지 않는다.

## 대상 요약
| 항목 | 값 |
|---|---|
| 신규 스택 | `silk-road` (ECS Fargate + ALB, DocDB 없음) |
| 참조 스택 | `auto-finance` (기존 운영 — 수정 안 함) |
| 리전 / 계정 | `ap-northeast-2` / `970227532419` |
| 템플릿 | `architecture/deploy/silk-road-stack.yaml` |
| ECR | `silk-road-backend`, `silk-road-frontend` (신규 생성) |

> auto-finance와의 핵심 차이: 우리 백엔드는 **파일 storage** 기반 → **DocumentDB/Secret 제거**. 모델은 Opus(global)+legacy Bedrock(메모리 `bedrock-env-constraints`).

## VPC/서브넷 (auto-finance에서 참조)
- VpcId: `vpc-09f7890577d5695fa`
- PublicSubnets: `subnet-070c28239494b5bbc,subnet-0ceae5ca1e0fd0769`
- PrivateSubnets: `subnet-0bf54a65a9f6fe0ed,subnet-00ec642fed1f7fa7f`

## 절차

```bash
ACCOUNT=970227532419
REGION=ap-northeast-2
TAG=$(git rev-parse --short HEAD)   # 또는 v1
ECR=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com

# 0) 자격증명 확인
aws sts get-caller-identity

# 1) ECR 리포 생성(없으면)
for r in silk-road-backend silk-road-frontend; do
  aws ecr describe-repositories --repository-names $r --region $REGION >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name $r --region $REGION
done

# 2) 로그인
aws ecr get-login-password --region $REGION \
  | docker login --username AWS --password-stdin $ECR

# 3) 빌드(linux/arm64 — 빌드 호스트=Graviton, Fargate RuntimePlatform=ARM64) & 푸시
docker build --platform linux/arm64 -t $ECR/silk-road-backend:$TAG  app/backend
docker build --platform linux/arm64 -t $ECR/silk-road-frontend:$TAG app/frontend
docker push $ECR/silk-road-backend:$TAG
docker push $ECR/silk-road-frontend:$TAG

# 4) 스택 배포(생성 또는 갱신)
aws cloudformation deploy \
  --stack-name silk-road \
  --template-file architecture/deploy/silk-road-stack.yaml \
  --parameter-overrides \
      VpcId=vpc-09f7890577d5695fa \
      PublicSubnetIds=subnet-070c28239494b5bbc,subnet-0ceae5ca1e0fd0769 \
      PrivateSubnetIds=subnet-0bf54a65a9f6fe0ed,subnet-00ec642fed1f7fa7f \
      BackendImageUri=$ECR/silk-road-backend:$TAG \
      FrontendImageUri=$ECR/silk-road-frontend:$TAG \
  --capabilities CAPABILITY_IAM \
  --region $REGION

# 5) 검증
aws cloudformation describe-stacks --stack-name silk-road --region $REGION \
  --query 'Stacks[0].[StackStatus]' --output text
URL=$(aws cloudformation describe-stacks --stack-name silk-road --region $REGION \
  --query "Stacks[0].Outputs[?OutputKey=='AlbUrl'].OutputValue" --output text)
curl -s -o /dev/null -w "%{http_code}\n" $URL          # 200 기대(frontend)
curl -s -o /dev/null -w "%{http_code}\n" $URL/api/countries  # 200 기대(backend 프록시)

# 재배포(이미지만 교체 시)
aws ecs update-service --cluster silk-road --service silk-road --force-new-deployment --region $REGION
```

## 주의
- 빌드 플랫폼 `linux/arm64`(빌드 호스트=Graviton/aarch64). Fargate task는 `RuntimePlatform: ARM64`(템플릿). amd64로 바꾸려면 둘 다 함께 변경.
- 스택 생성/이미지 푸시는 비가역·과금 → 실행 전 사용자 확인.
- `CAPABILITY_IAM` 필요(ExecutionRole·TaskRole 생성).
- backend·frontend는 **같은 task**(awsvpc) → frontend nginx가 `/api`를 `127.0.0.1:8000`로 프록시.
- ParameterStore/Secret 미사용(파일 storage). Bedrock 자격증명은 TaskRole(bedrock:InvokeModel*).

## 미해결/후속
- backend storage는 컨테이너 이미지에 시드 포함(읽기 위주). 신규 리서치/보고서 산출물은 컨테이너 임시 FS → 재시작 시 소실. 영속 필요하면 EFS 마운트 또는 S3 연동(후속).
- HTTPS(ACM+443) 미구성(데모는 HTTP). 필요 시 Listener 443 추가.
