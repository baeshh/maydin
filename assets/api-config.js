// API 기본 URL (로컬: http://localhost:3001, 배포 시 실제 API 서버 URL로 변경)
(function() {
  var isLocal = !location.hostname || location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
  window.API_BASE = window.API_BASE || (isLocal ? 'http://localhost:3001' : 'https://your-api-server.com');
})();
