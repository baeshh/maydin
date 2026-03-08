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

**⚠️ Nginx 설정 적용 후 "연결할 수 없음 / ERR_CONNECTION_REFUSED" 나올 때**

1. **EC2에 SSH 접속** 후 아래 순서로 확인:
   ```bash
   sudo systemctl status nginx   # inactive면 nginx가 꺼진 것
   sudo nginx -t                 # 설정 문법 검사 (에러 나오면 설정 문제)
   sudo tail -30 /var/log/nginx/error.log   # 에러 원인 확인
   ```
2. **이전에 HTTPS(Certbot)를 쓰고 있었다면**  
   repo 설정으로 덮어쓰면 **listen 443 (SSL) 블록이 없어져서** `https://maydin.co.kr` 접속이 거부될 수 있습니다.  
   - **복구(SSL 다시 붙이기):**
     ```bash
     sudo certbot --nginx -d maydin.co.kr -d www.maydin.co.kr
     ```
   - Certbot이 자동으로 443 블록을 다시 넣어 줍니다.
3. **Nginx가 꺼져 있으면:**
   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```
4. **설정 오류면** repo 설정 적용 전 상태로 되돌린 뒤, `location /api/` 부분만 수동으로 추가하는 방식으로 맞추는 것이 안전합니다.

### 4) 배포( GitHub Actions ) 실패 시

- 저장소 **Actions** 탭에서 "Deploy to EC2" 실패 로그 확인
- "API health check failed" 나오면 → 위 2), 3) 순서로 서버 점검

### 5) 다른 건 되는데 장바구니/주문만 안 될 때

- **F12 → Network** 탭 연 뒤, 장바구니 담기 또는 주문하기 클릭
  - 실패한 요청(`/api/cart` 또는 `/api/orders`) 클릭 → **Status**(상태 코드), **Response**(응답 내용) 확인
  - Status **0** 또는 **(failed)** → 요청이 서버까지 안 감 (방화벽, Nginx 중단, 타임아웃 등)
  - **502/504** → Nginx는 도달했으나 Node 응답 없음 → `pm2 logs maydin-api` 로 서버 에러 확인
  - **413** → 요청 본문이 너무 큼 → Nginx `client_max_body_size` 확인 (repo 설정은 2M)
- **Nginx가 POST 본문을 넘기지 않는 경우**가 있을 수 있음. 아래처럼 적용 후 재시도:
  ```bash
  sudo cp /home/ubuntu/apps/maydin/deploy/nginx-maydin.conf /etc/nginx/sites-available/maydin
  sudo nginx -t && sudo systemctl reload nginx
  ```
- 브라우저 **Console**에 `장바구니 연결 실패` / `주문 연결 실패` 로그가 찍히면, 옆에 나온 **URL**과 **에러 메시지**를 확인

---

## 9. 예정 작업

1. GitHub Actions 자동 배포
2. 카카오 로그인 API 연동
3. 관리자 상품 등록 개선
4. API 보안 강화
5. 환경 변수 관리
6. 이미지 업로드
