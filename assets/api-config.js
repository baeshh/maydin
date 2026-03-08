// API 기본 URL (로컬/EC2/ GitHub Pages 구분)
(function() {
  var h = location.hostname;
  var isLocal = !h || h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:';
  if (window.API_BASE !== undefined) return;
  if (isLocal) {
    window.API_BASE = 'http://localhost:3001';
  } else if (h === 'baeshh.github.io') {
    // GitHub Pages(HTTPS)에서는 반드시 HTTPS로 API 호출 (mixed content 방지). EC2에 SSL 없으면 이 사이트 대신 EC2 주소로 접속하세요.
    window.API_BASE = 'https://3.26.7.116';
  } else {
    // EC2 등 같은 호스트에서 서빙 시 같은 origin (Nginx가 /api → 3001 프록시 필요)
    window.API_BASE = '';
  }
})();
