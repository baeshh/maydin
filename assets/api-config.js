// API 기본 URL (로컬 개발 시 3001, 배포 시 현재 사이트와 동일한 도메인)
(function() {
  var h = location.hostname;
  var isLocal = !h || h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:';
  if (window.API_BASE !== undefined) return;
  // AWS(maydin.co.kr) 등 배포 환경: 항상 현재 열린 페이지와 같은 도메인으로 API 호출
  window.API_BASE = isLocal ? 'http://localhost:3001' : (window.location.origin || '');
})();
