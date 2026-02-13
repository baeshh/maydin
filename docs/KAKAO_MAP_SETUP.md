# 배포 사이트에서 지도가 안 뜰 때 해결 방법

GitHub Pages 등으로 배포한 주소(예: `https://baeshh.github.io/maydin`)에서는 **카카오맵 API 도메인 제한** 때문에 지도가 안 나올 수 있습니다. 아래 순서대로 하면 해결됩니다.

---

## 1. Kakao 개발자 콘솔 접속

1. **https://developers.kakao.com** 접속 후 로그인
2. 상단 메뉴에서 **내 애플리케이션** 클릭
3. 사용 중인 앱 선택 (지도용 JavaScript 키가 있는 앱)
   - 앱이 없으면 **애플리케이션 추가하기**로 새로 만든 뒤 진행

---

## 2. Web 플랫폼 도메인 등록

1. 왼쪽 메뉴에서 **앱 설정** → **플랫폼** 클릭
2. **Web** 플랫폼이 있는지 확인
   - 없으면 **Web** 선택 후 **저장**해서 플랫폼 추가
3. **Web** 항목에서 **사이트 도메인** 입력란에 아래처럼 **배포 주소만** 입력 후 **저장**

   ```
   https://baeshh.github.io
   ```

   - 반드시 `https://` 포함
   - `https://baeshh.github.io/maydin` 처럼 경로까지 넣지 말고, **도메인만** `https://baeshh.github.io` 로 등록

---

## 3. JavaScript 키 확인

1. 왼쪽 메뉴 **앱 설정** → **앱 키** 클릭
2. **JavaScript 키** 값을 확인
3. 이 키가 `index.html` 7~8번째 줄 근처 script의 `appkey=` 값과 **같은지** 확인  
   - 다르면 `index.html`의 `appkey=` 값을 이 JavaScript 키로 바꿔서 저장 후 다시 배포

---

## 4. 배포 후 확인

- 저장 후 1~2분 지나서 **https://baeshh.github.io/maydin** 새로고침
- 그래도 안 되면 **캐시 없이 새로고침** (Ctrl+Shift+R 또는 Cmd+Shift+R)

---

## 요약

| 단계 | 할 일 |
|------|--------|
| 1 | developers.kakao.com → 내 애플리케이션 → 앱 선택 |
| 2 | 플랫폼 → Web → 사이트 도메인에 `https://baeshh.github.io` 입력 후 저장 |
| 3 | 앱 키에서 JavaScript 키가 index.html의 appkey와 같은지 확인 |
| 4 | 배포 사이트 새로고침 후 지도 표시 확인 |

도메인만 위와 같이 등록하면 배포한 페이지에서도 지도가 정상적으로 표시됩니다.
