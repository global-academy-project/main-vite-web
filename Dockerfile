# `24.22.2-alpine3.24`이 상대적으로 가볍게 설계된 Node.js Alpine 이미지
FROM node:24.22.2-alpine3.24

WORKDIR /app

COPY package.json package-lock.json ./

# package.json과 package-lock.json을 먼저 복사하여 의존성 비교하고
# 의존성을 설치한 후 나머지 파일을 복사하여 빌드 캐시를 효율적으로 사용한다.
RUN npm ci --no-audit --no-fund

COPY . .

# 모든 파일들을 복사가 완료되면 `dist` 디렉터리를 생성하도록 빌드하고,
# 최종적으로 애플리케이션을 실행할 준비를 한다.
RUN npm run build

EXPOSE 50001

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "50001"]