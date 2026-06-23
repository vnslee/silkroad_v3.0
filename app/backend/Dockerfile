# silk-road backend (FastAPI + weasyprint) — Fargate(linux/amd64) 대상
# weasyprint(PDF)는 pango/cairo/gdk-pixbuf 시스템 라이브러리가 필요(ROADMAP: weasyprint(+pango/cairo)).
FROM python:3.9-slim

# weasyprint 런타임 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi8 \
        shared-mime-info \
        fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 의존성 먼저(레이어 캐시). 테스트 전용 패키지는 런타임에 불필요하지만 핀 일관 위해 그대로 설치.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 앱 코드 + 스토리지(시드 데이터: research/internal/report/detail)
COPY . /app/app/backend

# 엔진·렌더러가 sys.path로 서로를 찾으므로 backend 루트를 PYTHONPATH에 둔다.
ENV PYTHONPATH=/app/app/backend
ENV PORT=8000
EXPOSE 8000

# api/main.py 의 app 객체. 컨테이너에서는 패키지 경로 api.main:app.
WORKDIR /app/app/backend
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
