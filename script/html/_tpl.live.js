/*
 * auto reload page when bundle ready
 */
(function() {
  var ws;
  var isClosed = false;
  var tryTimes = 0;

  function connect() {
    ws = new WebSocket('ws://127.0.0.1:${PORT}', 'echo-protocol');
    afterConnect();
  }

  function afterConnect() {
    ws.onmessage = function(evt) {
      if (evt.data === 'reload') {
        ws.close();
        console.log('reload');
        location.reload();
      }
    };
    ws.onerror = function(err) {
      console.error(err);
    };
    ws.onclose = function() {
      tryTimes++;
      if (tryTimes < 600000) {
        // console.error('Live reload connection closed. retry.');
        setTimeout(connect, 1000);
      } else {
        console.error('Live reload connect failed. Please refresh the page manually.');
      }
      isClosed = true;
    };
    ws.onopen = function() {
      if (isClosed) {
        location.reload();
      }
      isClosed = false;
    };
  }

  connect();

})();
