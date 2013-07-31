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
  t.plan(2);

  t.ok(a = new PeerConnection({ data: true }), 'created a');
  t.ok(b = new PeerConnection({ data: true }), 'created b');
});

test('create channel a', function(t) {
  t.plan(1);
  t.ok(aData = a.createDataChannel('RTCDataChannel', { reliable: false }), 'a created');
});

test('couple connections, b emit datachannel', function(t) {
  t.plan(2);

  b.on('datachannel', function(evt) {
    t.ok(bData = evt.channel);
  });

  couple(a, b, function(err) {
    t.ifError(err, 'done');
  })
});

test('a is open', function(t) {
  t.plan(1);
  if (aData.readyState === 'open') {
    t.pass('a open');
  }
  else {
    aData.onopen = t.pass.bind(t, 'a open');
  }
});

test('b is open', function(t) {
  t.plan(1);
  if (bData.readyState === 'open') {
    t.pass('b open');
  }
  else {
    bData.onopen = t.pass.bind(t, 'b open');
  }
});

test('can send from a --> b', function(t) {
  t.plan(1);
  aData.send('hello');

  bData.onmessage = function() {
    t.pass('message received');
    console.log(arguments);
  }
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