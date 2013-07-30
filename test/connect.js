var test = require('tape');
var signaller = require('../signaller');
var PeerConnection = require('../peerconnection');

test('create create a peer connection object', function(t) {
  t.plan(1);
  t.ok(new PeerConnection(), 'created ok');
});
