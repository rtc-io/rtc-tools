var test = require('tape');
var PeerConnection = require('../peerconnection');

test('create peer connection', function(t) {
  t.plan(1);
  t.ok(new PeerConnection(), 'created');
});

test('create peer connection with data channel support', function(t) {
  t.plan(1);
  t.ok(new PeerConnection({ data: true }), 'created');
});