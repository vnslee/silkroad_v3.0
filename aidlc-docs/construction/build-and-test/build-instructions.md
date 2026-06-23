# Build Instructions — backend-api (1차)

## Prerequisites
- **런타임**: Python 3.9.25
- **의존성**: `app/backend/requirements.txt` (버전 핀)
- **시스템 의존성**: weasyprint용 pango·cairo (PDF 변환 시) — 설치돼 있음
- **환경 변수**: 없음(1차). storage 경로는 self-locate.

## Build Steps

### 1. 의존성 설치
```bash
pip install -r app/backend/requirements.txt
```
> 신규 추가분: `hypothesis==6.141.1` (PBT). 나머지는 기설치본 핀.

### 2. 환경 설정
```bash
# 별도 설정 불필요. (2차에서 Bedrock 자격증명 등 추가 예정)
```

### 3. 빌드(구문 검증)
```bash
# 컴파일 언어가 아니므로 빌드 = 구문 게이트
cd /home/participant/silk-road_v1.0
python3 -m py_compile app/backend/api/*.py app/backend/api/services/*.py \
  app/backend/api/routers/*.py app/backend/tests/*.py
```

### 4. 빌드 성공 확인
- **기대 출력**: 오류 없이 종료(exit 0)
- **앱 import 스모크**:
  ```bash
  cd app/backend && python3 -c "from api.main import app; print(len(app.routes), 'routes')"
  # → 22 routes
  ```

## Troubleshooting
- **`ModuleNotFoundError: hypothesis`**: `pip install -r app/backend/requirements.txt`
- **`OSError: libpango...`** (PDF): `sudo dnf install -y pango cairo`
- **엔진 import 실패**: `config.ensure_engine_on_path()`가 `engine/generation`·`engine/rendering`을 sys.path에 추가하는지 확인.
