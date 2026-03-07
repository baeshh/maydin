# MAYDIN 서버 상태

## 1. 서버 환경

- **AWS EC2** Ubuntu 24.04
- **Node.js** v20
- **PM2** (프로세스 관리)
- **Nginx** (리버스 프록시 + 정적 파일)
- **SQLite** (DB)

### 구조

```
Internet
    ↓
Nginx (80)
    ├ 프론트 정적 파일 → /var/www/maydin
    └ /api → proxy → Node.js (3001)
            ↓
        SQLite (server/data/maydin.db)
```

---

## 2. 주소

| 용도 | URL |
|------|-----|
| 서비스 | http://3.26.7.116 |
| API 예시 | http://3.26.7.116/api/products |

---

## 3. Node 서버 (PM2)

```bash
pm2 start src/index.js --name maydin-api
pm2 startup
pm2 save
```

---

## 4. 경로

| 구분 | 경로 |
|------|------|
| 프로젝트 전체 | `/home/ubuntu/apps/maydin` |
| Nginx 프론트 root | `/var/www/maydin` |
| 백엔드 | `/home/ubuntu/apps/maydin/server` |
| DB 파일 | `/home/ubuntu/apps/maydin/server/data/maydin.db` |

---

## 5. 프론트

- 정적 HTML + 인라인 CSS + Vanilla JS
- React/Vue/Next 없음, 빌드 없음

---

## 6. Nginx

- 프론트: `/var/www/maydin` 에서 서빙
- `/api` → `localhost:3001` 프록시
- 설정은 서버에서 직접 관리 (repo의 deploy 폴더와 무관)

---

## 7. 배포

- **현재**: 수동 `git pull` + `pm2 restart`
- **자동**: GitHub Actions `Deploy to EC2` (main push 시)
  - repo 갱신 → `/var/www/maydin` rsync → `npm ci` → `pm2 restart maydin-api`
  - 필수 Secrets: `EC2_HOST`, `SSH_PRIVATE_KEY`

---

## 8. 예정 작업

1. GitHub Actions 자동 배포
2. 카카오 로그인 API 연동
3. 관리자 상품 등록 개선
4. API 보안 강화
5. 환경 변수 관리
6. 이미지 업로드
