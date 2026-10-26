import { api } from "./client";

export function getEngines() {
  return api("/api/v1/engines");
}
/* 생성한 파일
- engines.js: 엔진 목록을 조회하는 API 요청을 처리하는 함수들을 제공
- getEngines: 엔진 목록을 조회하는 함수
- 다른 파일들과의 관계
- client.js: api 함수를 사용하여 API 요청을 수행
*/
