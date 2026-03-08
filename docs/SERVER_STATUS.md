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
  - repo 갱신 → `/var/www/maydin` rsync → `npm ci` → `pm2 restart maydin-api` (없으면 start) → API 헬스체크
  - 필수 Secrets: `EC2_HOST`, `SSH_PRIVATE_KEY`

---

## 8. "서버에 일시적으로 연결할 수 없습니다" 나올 때

장바구니/주문이 안 되고 위 메시지가 뜨면 **API(3001) 또는 Nginx 프록시** 문제일 수 있습니다.

### 1) 브라우저에서 API 확인

- 주소창에 **https://maydin.co.kr/api/health** 입력 후 접속
- `{"ok":true,"message":"MAYDIN API"}` 비슷한 JSON이 보이면 → API는 동작 중. (다른 원인 가능)
- 502/503/연결 실패 → API가 안 떠 있거나 Nginx 프록시 설정 문제

### 2) EC2 SSH 접속 후 확인

```bash
# API 프로세스 확인 (maydin-api 있어야 함)
pm2 list

# 없거나 stopped 이면
cd /home/ubuntu/apps/maydin/server
pm2 start src/index.js --name maydin-api
pm2 save

# 로그로 에러 확인
pm2 logs maydin-api
```

### 3) Nginx 설정 확인

- 프론트 root: **/var/www/maydin** (배포 시 rsync 대상과 동일해야 함)
- `/api/` → `proxy_pass http://127.0.0.1:3001;` (끝에 슬래시 없음)

repo와 맞추려면:

```bash
sudo cp /home/ubuntu/apps/maydin/deploy/nginx-maydin.conf /etc/nginx/sites-available/maydin
sudo nginx -t && sudo systemctl reload nginx
```

### 4) 배포( GitHub Actions ) 실패 시

- 저장소 **Actions** 탭에서 "Deploy to EC2" 실패 로그 확인
- "API health check failed" 나오면 → 위 2), 3) 순서로 서버 점검

---

## 9. 예정 작업

1. GitHub Actions 자동 배포
2. 카카오 로그인 API 연동
3. 관리자 상품 등록 개선
4. API 보안 강화
5. 환경 변수 관리
6. 이미지 업로드
