// API 기본 URL (로컬 / maydin.co.kr / GitHub Pages 구분)
(function() {
  var h = location.hostname;
  var isLocal = !h || h === 'localhost' || h === '127.0.0.1' || location.protocol === 'file:';
  if (window.API_BASE !== undefined) return;
  if (isLocal) {
    window.API_BASE = 'http://localhost:3001';
  } else if (h === 'baeshh.github.io') {
    // GitHub Pages에서는 운영 도메인으로 API 호출 (장바구니/주문 등 전부 사용 가능)
    window.API_BASE = 'https://maydin.co.kr';
  } else {
    // maydin.co.kr, 3.26.7.116 등 서버에서 서빙 시 같은 origin
    window.API_BASE = '';
  }
})();
