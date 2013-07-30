var couple = require('../lib/couple');
var test = require('tape');
var PeerConnection = require('../peerconnection');
var a;
var b;

test('create peer connections', function(t) {
  t.plan(2);

  t.ok(a = new PeerConnection(), 'created a');
  t.ok(b = new PeerConnection(), 'created b');
});

test('couple the two connections together', function(t) {
  t.plan(1);

  couple(a, b, function(err) {
    t.ifError(err, 'done');
  });
});

test('close connections', function(t) {
  t.plan(2);

  a.once('close', t.pass.bind(t, 'a closed'));
  b.once('close', t.pass.bind(t, 'b closed'));

  a.close();
  b.close();
});