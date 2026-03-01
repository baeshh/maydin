# MAYDIN API

약사전용몰 백엔드 API (Node.js + Express + SQLite)

## 시작하기

```bash
cd server
npm install
npm run init-db   # DB 초기화 (상품·약국 시드 데이터)
npm start         # http://localhost:3001
```

개발 시 `npm run dev` 로 파일 변경 시 자동 재시작

## 관리자 (admin)

- **관리자 페이지**: `admin.html` (프론트엔드 퍼블릭 루트)
- **기본 계정**: admin@maydin.kr / admin123 (최초 DB 초기화 시 생성)
- **기능**: 대시보드, 상품 CRUD, 주문 관리(배송상태), 블로그/소식 작성

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/login | 로그인 (license, password) |
| POST | /api/auth/register | 회원가입 |
| POST | /api/auth/kakao | 카카오 로그인 (code) |
| GET | /api/auth/me | 토큰 검증 및 사용자 정보 |
| GET | /api/products | 상품 목록 (filter: best, new, category) |
| GET | /api/products/:id | 상품 상세 |
| POST | /api/orders | 주문 생성 |
| GET | /api/orders | 주문 목록 (인증 필요) |
| GET | /api/pharmacies | 제휴 약국 목록 |
| GET | /api/posts | 블로그/소식 목록 (공개) |

### 관리자 API (인증 필요)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/admin/auth/login | 관리자 로그인 |
| GET | /api/admin/stats | 대시보드 통계 |
| GET/POST/PUT/DELETE | /api/admin/products | 상품 관리 |
| GET | /api/admin/orders | 주문 목록 |
| PATCH | /api/admin/orders/:id | 주문 상태 변경 |
| GET/POST/PUT/DELETE | /api/admin/posts | 블로그/소식 관리 |

## 환경변수

`.env` 파일 생성 (`.env.example` 참고)

- `PORT` - 서버 포트 (기본 3001)
- `JWT_SECRET` - JWT 서명 키
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` - 카카오 로그인 (선택)

## 프론트엔드 연동

- 로컬: `assets/api-config.js` 기본값 `http://localhost:3001`
- 배포: API 서버 URL로 `window.API_BASE` 수정
