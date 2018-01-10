const WSServer = require('ws').Server;
const http = require('http');
const ffp = require('find-free-port');
const liveReloadClients = [];

function reload() {
  console.log('Page reload.');
  liveReloadClients.forEach(ws => {
    try {
      ws.send('reload');
    } catch(ex) {
      console.log(ex);
    }
  });
}

function initLiveReload(server) {
  const wServer = new WSServer({
    server,
  });
  wServer.on('connection',  ws => {
    liveReloadClients.push(ws);
    ws.on('close', _des);
    ws.on('error', _des);
    function _des(err) {
      if (typeof err === 'object' && err && err.code !== 'ECONNRESET') {
        console.log(err);
      }
      const idx = liveReloadClients.indexOf(ws);
      idx >= 0 && liveReloadClients.splice(idx, 1);
      ws.removeListener('close', _des);
      ws.removeListener('error', _des);
    }
  });
}

async function createDevServer() {
  const server = http.createServer((request, response) => {
    response.writeHead(404);
    response.end();
  });
  
  initLiveReload(server);
  server.reload = reload;
  await new Promise((resolve, reject) => {
    ffp(3000, (err, freePort) => {
      if (err) return reject(err);
      server.port = freePort;
      server.listen(freePort, '127.0.0.1', () => {
        resolve();
      });
    });
  });
  
  return server;
}

module.exports = createDevServer;

