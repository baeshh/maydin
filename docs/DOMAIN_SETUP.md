# 도메인 설정 가이드 (maydin.co.kr)

EC2 IP(`3.26.7.116`) 대신 **maydin.co.kr** 로 접속하려면 아래 순서대로 진행하세요.

---

## 1. DNS 설정 (A 레코드 / TXT)

도메인 관리 페이지(가비아, 카페24, Cloudflare, Route53 등)에서 아래처럼 등록합니다.

### 1-1. A 레코드 (필수 — 웹 접속용)

| 타입 | 호스트 | 값 | TTL |
|------|--------|-----|-----|
| **A** | **@** | **3.26.7.116** | 300 (또는 기본값) |
| **A** | **www** | **3.26.7.116** | 300 (또는 기본값) |

- **호스트 @** = 루트 도메인 → `maydin.co.kr` 로 접속
- **호스트 www** = `www.maydin.co.kr` 로 접속  
두 개 모두 **값(IP)** 에 **3.26.7.116** 을 넣으면 됩니다.

일부 사이트에서는 호스트를 **비우거나** **maydin.co.kr** 로 쓰는 경우도 있는데, 그때도 **값**은 동일하게 **3.26.7.116** 입니다.

### 1-2. TXT 레코드 (선택 — 나중에 필요할 때)

- **웹사이트만 쓸 때**: A 레코드만 있으면 됩니다. **TXT는 안 넣어도 됩니다.**
- **나중에 아래 같은 걸 할 때** TXT를 추가하면 됩니다.
  - **도메인 소유 확인**: Google Search Console, 네이버 서치어드바이저 등에서 요구하는 TXT 값
  - **이메일 발송(SPF/DKIM)**: 메일 서비스에서 안내하는 TXT 값을 그대로 넣기
  - **SSL(CAA)**: 특정 CA만 쓰고 싶을 때만 사용

그래서 **지금은 A 레코드 2개(@, www → 3.26.7.116)만 등록**해 두면 됩니다.

### 1-3. 전파 확인

저장 후 수 분 ~ 24시간 내 전파됩니다. 확인:

```bash
dig maydin.co.kr +short
dig www.maydin.co.kr +short
# 둘 다 3.26.7.116 이 나오면 OK
```

---

## 2. Nginx에 도메인 반영 (EC2)

EC2에 SSH 접속한 뒤, Nginx 설정에서 `server_name`을 도메인으로 바꿉니다.

### 방법 A: 서버에서 직접 수정

```bash
sudo nano /etc/nginx/sites-available/maydin
```

다음 줄을 찾아:

```nginx
server_name _;
```

아래처럼 수정:

```nginx
server_name maydin.co.kr www.maydin.co.kr;
```

저장 후:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 방법 B: repo 설정 수정 후 배포

프로젝트의 `deploy/nginx-maydin.conf`에서 `server_name`을 도메인으로 수정한 뒤 커밋·푸시합니다.  
배포 워크플로는 Nginx 설정 파일을 자동으로 복사하지 않으므로, **EC2에서 한 번만** 아래처럼 반영하면 됩니다.

```bash
# EC2에서 (도메인 반영된 설정으로 덮어쓰기)
sudo cp /home/ubuntu/apps/maydin/deploy/nginx-maydin.conf /etc/nginx/sites-available/maydin
sudo nginx -t && sudo systemctl reload nginx
```

---

## 3. HTTPS(SSL) 설정 (권장)

무료 인증서는 **Let’s Encrypt + Certbot**으로 발급합니다.

### 3-1. Certbot 설치 (EC2)

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### 3-2. 인증서 발급

도메인 DNS가 이미 EC2 IP로 연결된 상태에서:

```bash
sudo certbot --nginx -d maydin.co.kr -d www.maydin.co.kr
```

이메일 입력, 약관 동의 후 발급됩니다. Certbot이 Nginx 설정에 `listen 443 ssl` 블록을 자동으로 추가합니다.

### 3-3. 자동 갱신

갱신 테스트:

```bash
sudo certbot renew --dry-run
```

`systemd` 타이머가 기본 설치되어 있어, 만료 전에 자동 갱신됩니다.

---

## 4. 체크리스트

- [ ] DNS A 레코드: @, www → 3.26.7.116
- [ ] `dig` 또는 브라우저로 도메인 접속 확인
- [ ] EC2 Nginx `server_name` 도메인으로 수정 후 `nginx -t` && `reload`
- [ ] (선택) Certbot으로 HTTPS 적용 후 https://maydin.co.kr 접속 확인

---

## 5. 참고

- **AWS 보안 그룹**: EC2 인스턴스에 **80**, **443** 포트 인바운드 허용되어 있어야 합니다.
- **프론트에서 API 주소**: 도메인 사용 시 같은 도메인으로 서비스하면 `/api` 상대 경로만 쓰면 되어 별도 수정 없습니다.
