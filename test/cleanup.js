var test = require('tape');
var detect = require('../detect');
var peerpair = require('peerpair');
var cleanup = require('../cleanup');
var pcs = [];
var monitors = [];

test('use peerpair to create a connected set of peers', function(t) {
  t.plan(1);
  pcs = peerpair();
  pcs.events.once('connected', t.pass.bind(t, 'connected'));
  pcs.createChannelsAndConnect(['test']);
});

test('cleanup peer:0', function(t) {
  t.plan(1);

  setTimeout(function() {
    cleanup(pcs[0]);
    t.equal(pcs[0].iceConnectionState, 'closed', 'pc is closed');
  }, 50);
});

test('cleanup peer:0 again (will not error)', function(t) {
  t.plan(1);

  setTimeout(function() {
    cleanup(pcs[0]);
    t.equal(pcs[0].iceConnectionState, 'closed', 'pc is closed');
  }, 50);
});

test('wait for peer:1 to register it has disconnected', function(t) {
  t.plan(1);
  if (detect.moz) {
    return t.pass('cannot detect disconnection in firefox yet :/');
  }

  pcs[1].oniceconnectionstatechange = function() {
    console.log('captured state change to: ' + pcs[1].iceConnectionState);
    if (pcs[1].iceConnectionState === 'disconnected') {
      pcs[1].oniceconnectionstatechange = null;
      t.pass('peer:1 registered disconnection');
    }
  };
});

test('cleanup peer:1', function(t) {
  t.plan(1);

  setTimeout(function() {
    cleanup(pcs[1]);
    t.equal(pcs[1].iceConnectionState, 'closed', 'pc is closed');
  }, 50);
});