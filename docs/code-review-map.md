# 코드 검토 안내

이 문서는 개발 경험이 많지 않은 검토자가 기능별 코드를 찾아볼 수 있도록 만든 안내서입니다. 각 핵심 파일에는 동일한 목적의 한글 주석이 포함되어 있습니다.

| 확인하고 싶은 기능 | 우선 볼 파일 | 확인할 내용 |
|---|---|---|
| 자료 업로드·삭제 | `server/routers/assessment.ts`, `server/db.ts` | 교사 소유권, 논리 삭제, 검색 발췌 제거, 원본 위치 기록 |
| 문항 생성·근거 추적 | `server/routers/assessment.ts`, `server/services/assessmentAi.ts` | 근거 선택, AI 호출, 유사도 검증, 근거 스냅샷 |
| 그래프·표 문항 | `server/services/assessmentAi.ts`, `client/src/components/QuestionVisual.tsx` | 그래프 좌표·축·범례, SVG 렌더링, 표 행·열 표시 |
| 기출 PDF 연결 | `client/src/pages/References.tsx`, `server/services/referenceStorageKey.ts` | PDF 선택, ASCII 안전 저장 키, 출처·페이지·문항 번호 |
| 개인 API·로컬 AI | `server/services/aiProviders.ts`, `server/services/personalApiCrypto.ts`, `client/src/pages/AiSettings.tsx` | 제공자 구분, 키 암호화, 외부 전송 동의, 로컬 실행 경계 |
| 데이터 구조 | `drizzle/schema.ts`, `drizzle/migrations/` | 테이블 필드와 실제 적용된 마이그레이션 |
| 변경 이력·미래 과제 | `CHANGELOG.md`, `todo.md` | 배포 단위 변경, 예정 기능, 완료 상태 |

코드 변경을 검토할 때는 먼저 해당 기능의 화면을 사용해 보고, 표의 파일을 연 뒤 한글 주석이 설명하는 입력·처리·저장·표시 순서로 따라가면 됩니다.
