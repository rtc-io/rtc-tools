var test = require('tape');
var PeerConnection = require('../peerconnection');
var conn;

test('create peer connection', function(t) {
  t.plan(1);
  t.ok(new PeerConnection(), 'created');
});

test('create peer connection with data channel support', function(t) {
  t.plan(1);
  t.ok(conn = new PeerConnection({ data: true }), 'created');
});

test('close the connection', function(t) {
  t.plan(1);

  conn.once('close', t.pass.bind(t, 'closed'));
  conn.close();
});