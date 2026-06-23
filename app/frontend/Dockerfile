# silk-road frontend — 멀티스테이지(vite build → nginx) — Fargate(linux/amd64) 대상
# 빌드 산출물(dist)을 nginx로 정적 서빙하고, /api 는 같은 task의 backend(localhost:8000)로 프록시.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# vite base=/app/ 이므로 자산 참조가 /app/assets/... 다. dist를 /app 하위로 복사해 경로를 맞춘다
# (루트에 두면 /app/assets/* 가 try_files fallback으로 index.html(text/html)을 반환 → CSS MIME 오류).
COPY --from=build /app/dist /usr/share/nginx/html/app
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
