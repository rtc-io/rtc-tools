var test = require('tape');
var Signaller = require('../signaller');
var PeerConnection = require('../peerconnection');
var signaller;
var peers = [];

test('can create a signaller instance', function(t) {
  t.plan(1);

  signaller = new Signaller({
    channel: 'test',
    transport: require('./transports/dummy')
  });

  t.ok(signaller instanceof Signaller, 'created');
});

test('can create a peer connection associated with the signaller', function(t) {
  var peer;

  t.plan(1);
  peer = new PeerConnection({ channel: signaller });
  t.ok(peer, 'created peer connection');

  peers.push(peer);
});

test('can create a second peer connection', function(t) {
  var peer;

  t.plan(1);
  peer = new PeerConnection({ channel: signaller });
  t.ok(peer, 'created 2nd peer');

  peers.push(peer);
});

