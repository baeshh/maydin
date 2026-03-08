# OD Cloud 사업자등록정보 진위확인 API

회원가입 시 **사업자 정보 인증**에 공공데이터포털 OD Cloud API를 사용합니다.

## 1. API 정보

- **서비스**: 국세청 사업자등록정보 진위확인 및 상태조회
- **Base URL**: `https://api.odcloud.kr/api/nts-businessman/v1`
- **Swagger**: [infuser.odcloud.kr](https://infuser.odcloud.kr/api/stages/28493/api-docs)
- **호출**: POST, `serviceKey`는 쿼리스트링, 본문은 JSON

## 2. 서버 설정

인증키는 **서버 환경 변수**에만 두세요. (프론트에 노출되지 않습니다.)

EC2 또는 로컬 `server/.env`:

```env
ODCLOUD_SERVICE_KEY=발급받은_일반인증키
```

- 공공데이터포털에서 발급한 **일반 인증키(Encoding/Decoding)** 를 그대로 넣습니다.
- EC2 배포 후 서버에서 `.env` 수정한 뒤 `pm2 restart maydin-api` 로 재시작하면 적용됩니다.

## 3. 사용 흐름

1. 회원가입 폼에서 **사업자번호**(10자리), **개업일자**(YYYYMMDD), **이름**(대표자성명), **약국명**(상호) 입력
2. **사업자 정보 인증** 버튼 클릭 → 백엔드 `POST /api/auth/validate-business` 호출
3. 백엔드가 OD Cloud 진위확인 API를 호출한 뒤, 결과를 프론트에 반환
4. 인증 성공 시 메시지 표시 후 회원가입 진행

## 4. 백엔드 API

- **POST** `/api/auth/validate-business`
- **Body**: `{ b_no, start_dt, p_nm [, b_nm ] }`  
  - `b_no`: 사업자등록번호 10자리 (숫자만)  
  - `start_dt`: 개업일자 YYYYMMDD  
  - `p_nm`: 대표자성명  
  - `b_nm`: 상호(선택)
- **Response**: `{ success, valid, message [, status ] }`
