// API 기본 URL
(function() {
  var h = location.hostname;
  var isLocal = !h || h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:';
  if (window.API_BASE !== undefined) return;
  if (isLocal) {
    window.API_BASE = 'http://localhost:3001';
  } else if (h === 'baeshh.github.io') {
    window.API_BASE = 'http://3.26.7.116';  // GitHub Pages에서 접속 시 EC2 API 사용
  } else {
    window.API_BASE = '';  // EC2 등 같은 호스트에서 서빙 시 같은 origin
  }
})();
