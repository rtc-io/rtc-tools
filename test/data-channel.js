var couple = require('../lib/couple');
var test = require('tape');
var detect = require('../detect');
var PeerConnection = require('../peerconnection');
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

  if (detect.moz) {
    aData.binaryType = 'blob';
  }
});

test('couple connections, b emit datachannel', function(t) {
  t.plan(2);

  b.on('datachannel', function(evt) {
    bData = evt.channel;
    if (detect.moz) {
      aData.binaryType = 'blob';
    }

    t.ok(bData);
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

  bData.onmessage = function(evt) {
    t.equal(evt.data, 'hello');
  }

  aData.send('hello');
});

test('can send from b --> a', function(t) {
  t.plan(1);

  aData.onmessage = function(evt) {
    t.equal(evt.data, 'hello');
  };

  bData.send('hello');
});

test('close connections', function(t) {
  t.plan(2);

  a.once('close', t.pass.bind(t, 'a closed'));
  b.once('close', t.pass.bind(t, 'b closed'));

  a.close();
  b.close();
});