// API 기본 URL (로컬: localhost:3001, EC2 배포: 같은 호스트 /api 사용)
(function() {
  var isLocal = !location.hostname || location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
  window.API_BASE = window.API_BASE || (isLocal ? 'http://localhost:3001' : '');
})();
