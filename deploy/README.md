# EC2 배포 가이드

## 1. Nginx 설정 (프론트 + API 프록시)

EC2에 접속한 뒤:

```bash
sudo cp /home/ubuntu/apps/maydin/deploy/nginx-maydin.conf /etc/nginx/sites-available/maydin
sudo ln -sf /etc/nginx/sites-available/maydin /etc/nginx/sites-enabled/
# 기존 default 비활성화 (선택)
# sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

이후 `http://3.26.7.116` 으로 접속하면 프론트 + API가 함께 동작합니다.

**HTTPS(Certbot) 사용 중인데 이미지 업로드 시 413 나면:**  
`/etc/nginx/sites-available/maydin` 에서 `listen 443 ssl;` 이 있는 `server { }` 블록 **안쪽 맨 위**에 한 줄 추가 후 reload:

```nginx
client_max_body_size 20M;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. GitHub Actions 자동 배포 설정

### 2-1. EC2에 저장소 클론 (최초 1회)

EC2에서:

```bash
cd /home/ubuntu
sudo mkdir -p apps && sudo chown ubuntu:ubuntu apps
cd apps
git clone https://github.com/baeshh/maydin.git
cd maydin/server
npm ci --omit=dev
pm2 start src/index.js --name maydin-api
```

### 2-2. GitHub Secrets 등록

저장소 **Settings → Secrets and variables → Actions** 에서:

| Name | Value |
|------|--------|
| `EC2_HOST` | `3.26.7.116` |
| `SSH_PRIVATE_KEY` | EC2 접속용 `.pem` 파일 **전체 내용** (복사·붙여넣기) |

### 2-3. 동작

- `main` 브랜치에 push 하면 자동으로 EC2에서 `git pull` 후 `pm2 restart maydin-api` 실행됩니다.
- 수동 실행: **Actions → Deploy to EC2 → Run workflow**
