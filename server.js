var connect = require('connect'),
    parse = require('url').parse,
    querystring = require('querystring').parse,
    sessions = {}, // [id] : res: [], log: []
    eventid = 0;

function removeConnection(id, res) {
  var i = sessions[id].res.indexOf(res);
  if (i !== -1) {
    sessions[id].res.splice(i, 1);
  }
}

function remoteServer(app) {
  app.get('/spike/:id/log', function (req, res) {
    var id = req.params.id;
    res.writeHead(200, {'Content-Type': 'text/html', 'Cache-Control': 'no-cache'});
    var log = sessions[id] ? sessions[id].log.join('\n<li>') : '<li>No session';
    res.end('<!DOCTYPE html><html><title>\n' + id + '</title><body><ul><li>' + log);
  });

  app.post('/spike/:id/log', function (req, res) {
    // post made to send log to jsconsole
    var id = req.params.id;
    // passed over to Server Sent Events on jsconsole.com
    if (sessions[id]) {
      sessions[id].log.push('message: ' + req.body.data);
    }

    res.writeHead(200, { 'Content-Type' : 'text/plain' });
    res.end();
  });

  // listening stream
  app.get('/spike/:id', function (req, res) {
    var id = req.params.id;

    if (req.headers.accept == 'text/event-stream') {
      res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'});
      res.write('id\n\n');
      if (!sessions[id]) sessions[id] = { res: [], log: [] };
      sessions[id].res.push(res);
      res.xhr = req.headers['x-requested-with'] == 'XMLHttpRequest';

      req.on('close', function () {
        sessions[id].log.push('disconnect: ' + req.headers['user-agent']);
        removeConnection(id, res);
      });
    } else {
      // send spike
      if (sessions[id].res.length) {
        sessions[id].res.forEach(function (res) {
          res.write('data:\nid:' + (++eventid) + '\n\n');
          if (res.xhr) {
            res.end(); // lets older browsers finish their xhr request
          }
        });

      }
      res.writeHead(200, { 'Content-Type' : 'text/plain' });
      res.end('sent');
    }
  });

  app.get('/spike', function (req, res, next) {
    var url = parse(req.url),
        query = querystring(url.query);

    // save a new session id - maybe give it a token back?
    // serve up some JavaScript
    var id = req.params.id || connect.utils.uid(12);
    res.writeHead(200, {'Content-Type': 'text/javascript'});
    // res.end((query.callback || 'callback') + '("' + id + '");');
    res.end('<script src="http://spike.leftlogic.com/spike.js?' + id + '"></script>');
  });



  app.get('/', function (req, res) {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('ok');
  });
}

// connect.static.mime.define('text/cache-manifest', ['appcache']);

var server = connect.createServer(
  connect.bodyParser(),
  connect.logger('tiny'),
  connect.static(__dirname),
  connect.router(remoteServer)
);

console.log('Listening on ' + (process.argv[2] || 80));
server.listen(parseInt(process.argv[2]) || 80);