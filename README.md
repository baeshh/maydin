# 메이딘 (MAYDIN) - 영양제 회사 소개 & 약사전용몰

자연 추출물 기반 영양제를 제조하는 메이딘의 공식 웹사이트입니다.

## 프로젝트 구조

```
maydin/
├── index.html          # 메인 페이지 (회사 소개 + 약사전용몰)
├── README.md          # 프로젝트 설명서
└── (향후 추가 예정)
    ├── admin/         # 어드민 패널
    ├── api/           # 백엔드 API
    ├── assets/        # 이미지, CSS, JS 파일
    └── config/        # 설정 파일
```

## 현재 구현된 기능

### 1. 회사 소개 페이지
- 히어로 섹션 (Hero Section)
- 브랜드 철학 소개
- 기술력 소개
- 시그니처 제품 소개
- 반응형 디자인 (모바일 최적화)

### 2. 약사전용몰
- 약사 로그인/회원가입 (현재: 로컬 스토리지, 향후: API 연결)
- 제품 목록 조회
- 장바구니 기능
- 주문 처리 (현재: 로컬 스토리지, 향후: API + 이메일 발송)

## 향후 개발 계획

### 프론트엔드
- [ ] CSS/JS 파일 분리
- [ ] 컴포넌트화 (React/Vue 등 프레임워크 고려)
- [ ] 이미지 최적화
- [ ] 로딩 상태 표시
- [ ] 에러 핸들링 UI

### 백엔드 API
- [ ] 사용자 인증 API (`/api/auth/login`, `/api/auth/register`)
- [ ] 제품 조회 API (`/api/products`)
- [ ] 주문 처리 API (`/api/orders`)
- [ ] 이메일 발송 API (`/api/email/send-order-confirmation`)
- [ ] 어드민 API (`/api/admin/*`)

### 어드민 패널
- [ ] 주문 내역 조회 및 관리
- [ ] 사용자 정보 관리
- [ ] 제품 관리 (CRUD)
- [ ] 사이트 트래픽 조회
- [ ] 통계 대시보드

### 데이터베이스
- [ ] 사용자 정보 저장
- [ ] 제품 정보 저장
- [ ] 주문 내역 저장
- [ ] 트래픽 로그 저장

## API 연결 포인트

현재 코드에서 `TODO: API 연결` 주석으로 표시된 부분:

1. **로그인**: `handleLogin()` 함수
2. **회원가입**: `handleRegister()` 함수
3. **제품 조회**: `showProducts()` 함수
4. **주문 처리**: `handleOrder()` 함수

## 기술 스택 (현재)

- HTML5
- CSS3 (Glassmorphism 디자인)
- Vanilla JavaScript
- Pretendard 폰트

## 실행 방법

1. `index.html` 파일을 브라우저에서 직접 열기
2. 또는 로컬 서버 실행:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (http-server)
   npx http-server
   ```

## 디자인 특징

- **Glassmorphism**: 반투명 유리 효과의 모던한 디자인
- **스태킹 카드**: 스크롤 시 카드가 겹쳐지는 시네마틱 효과
- **반응형**: 모바일, 태블릿, 데스크톱 완벽 대응
- **애니메이션**: 부드러운 스크롤 인터랙션

## 브라우저 지원

- Chrome (최신)
- Safari (최신)
- Firefox (최신)
- Edge (최신)

## 라이선스

© 2026 MAYDIN LABS. ALL RIGHTS RESERVED.
