var couple = require('../couple');
var test = require('tape');
var PeerConnection = require('../peerconnection');
var pull = require('pull-stream');
var a;
var b;
var aData;
var bData;
var source;
var sink;

test('create peer connections and couple', function(t) {
  t.plan(3);

  t.ok(a = new PeerConnection(), 'created a');
  t.ok(b = new PeerConnection(), 'created b');

  couple(a, b, function(err) {
    t.ifError(err, 'done');
  });
});

test('can create a data channel for a', function(t) {
  t.plan(1);
  t.ok(aData = a.createDataChannel('default', { reliable: false }));
});

test('can create a data channel for b', function(t) {
  t.plan(1);
  t.ok(bData = b.createDataChannel('default', { reliable: false }));
});