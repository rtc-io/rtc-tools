var couple = require('../lib/couple');
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

  t.ok(a = new PeerConnection({ data: true }), 'created a');
  t.ok(b = new PeerConnection({ data: true }), 'created b');

  couple(a, b, function(err) {
    t.ifError(err, 'done');
  });
});

test('can create a data channel (a initiate)', function(t) {
  t.plan(3);
  t.ok(aData = a.createDataChannel('RTCDataChannel', { reliable: false }), 'created');

  b.ondatachannel = function(evt) {
    t.ok(bData = evt.channel, 'b received');
    console.log(bData.readyState);
  };

  // wait for a to open
  aData.onopen = t.pass.bind(t, 'data channel a opened');
});

test('can send from a --> b', function(t) {
  t.plan(1);
  aData.send('hello');
});

/*
test('data channels open', function(t) {
  t.plan(2);
  console.log(aData.readyState);
  console.log(bData.readyState);
  aData.onopen = t.pass.bind(t, 'a opened');
  bData.onopen = t.pass.bind(t, 'b opened');

  aData.addEventListener('open', function() {
    console.log('opened');
  });
});
*/