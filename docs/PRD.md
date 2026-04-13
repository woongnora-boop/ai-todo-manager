# PRD (Product Requirements Document) v2

## 1. 프로젝트 개요

### 1.1 제품 정의
AI 기반 자연어 입력을 활용하여 할 일을 자동 생성하고, 업무/일정 관리 효율을 개선하는 생산성 관리 시스템

### 1.2 목표
- 자연어 입력 기반 할 일 생성으로 입력 시간 70% 단축
- AI 요약을 통한 업무 가시성 확보
- 직관적인 UI 기반 빠른 CRUD 환경 제공

### 1.3 타겟 사용자
- 직장인 (업무 관리)
- 학생 (학습 계획)
- 프리랜서 (프로젝트 관리)

### 1.4 핵심 가치
- 자연어 → 구조화 자동 변환
- AI 기반 요약 및 분석 자동화
- 빠른 입력 / 조회 중심 UX

---

## 2. 주요 기능

### 2.1 사용자 인증
- Supabase Auth (이메일/비밀번호)
- 로그인 / 회원가입 / 로그아웃
- 세션 유지
- 비밀번호 재설정

---

### 2.2 할 일 관리 (CRUD)

#### 데이터 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | 사용자 ID |
| title | text | 제목 |
| description | text | 설명 |
| created_date | timestamp | 생성일 |
| due_date | timestamp | 마감일 |
| priority | enum | high / medium / low |
| category_id | UUID | 카테고리 |
| completed | boolean | 완료 여부 |

---

### 2.3 상태 정의

| 상태 | 조건 |
|------|------|
| 진행중 | completed = false AND due_date >= now() |
| 완료 | completed = true |
| 지연 | completed = false AND due_date < now() |

---

### 2.4 검색 / 필터 / 정렬

#### 검색
- 대상: title, description
- 방식: ILIKE (부분 문자열 검색)

#### 필터
- 우선순위 (high / medium / low)
- 카테고리
- 상태 (진행중 / 완료 / 지연)

#### 정렬
- 우선순위순
- 마감일순
- 생성일순

---

### 2.5 AI 할 일 생성

#### 기능 정의
자연어 입력을 구조화된 Todo 데이터로 변환

#### 처리 흐름
1. 사용자 입력
2. 서버 API 호출
3. Gemini API 요청
4. JSON 변환
5. 검증 후 DB 저장

---

#### 입력 예시
"내일 오전 10시에 팀 회의 준비"

#### 출력 포맷
```json
{
  "title": "팀 회의 준비",
  "description": "내일 오전 10시에 있을 팀 회의를 위해 자료 작성",
  "created_date": "YYYY-MM-DD HH:MM",
  "due_date": "YYYY-MM-DD 10:00",
  "priority": "high",
  "category": ["업무"],
  "completed": false
}