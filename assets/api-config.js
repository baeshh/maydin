// API 기본 URL (로컬 개발 시 3001, AWS/EC2 서빙 시 같은 origin)
(function() {
  var h = location.hostname;
  var isLocal = !h || h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:';
  if (window.API_BASE !== undefined) return;
  window.API_BASE = isLocal ? 'http://localhost:3001' : '';
})();
