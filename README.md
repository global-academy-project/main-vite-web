# Main Vite Web

현장 안전관리 서비스를 위한 React 웹 애플리케이션입니다. 인증, 작업 현황,
안전 기록, 결재, 감사 보고서 등의 화면을 제공하며, `/api` 요청을
Spring Boot 서버로 전달합니다.

## 기술 스택

- React 19
- React Router 7
- Vite 8
- Node.js 24 (Docker 이미지 기준)

## 로컬 개발

Node.js와 npm을 설치한 뒤 저장소 루트에서 실행합니다.

```powershell
npm ci
npm run dev
```

개발 서버는 `http://localhost:50001`에서 실행됩니다. Vite는 `/api` 요청을
기본적으로 `http://localhost:8080`으로 프록시합니다. 다른 API 주소를 사용할
때는 서버를 실행하기 전에 `VITE_API_PROXY_TARGET`을 지정합니다.

```powershell
$env:VITE_API_PROXY_TARGET = "http://localhost:60001"
npm run dev
```

## 빌드와 점검

```powershell
npm run lint
npm run build
npm run preview
```

`preview`도 포트 `50001`을 사용합니다. 빌드 결과물은 `dist/`에 생성됩니다.

## Docker

기본 [Dockerfile](Dockerfile)은 Vite preview 서버를 포트 `50001`에서 실행합니다.
여러 저장소를 함께 실행하는 Compose 환경과 웹 배포 설정은
`main-infra-manage` 저장소에서 관리합니다.

## 디렉터리

| 경로 | 내용 |
|---|---|
| `src/api/` | 서버 API 클라이언트 |
| `src/components/` | 공통 UI 및 레이아웃 |
| `src/pages/` | 인증, 작업, 결재, 기록, 관리자 화면 |
| `src/contexts/`, `src/hooks/` | 공유 상태와 React hooks |
| `src/styles/`, `src/style/` | 전역 및 화면 스타일 |
