var couple = require('../lib/couple');
var test = require('tape');
var detect = require('../detect');
var rtc = require('../');
var a;
var b;
var aData;
var bData;
var source;
var sink;

var dcConstraints = {
  optional: [
    { RtpDataChannels: true }
  ]
};

test('create peer connections and couple', function(t) {
  t.plan(2);

  t.ok(a = rtc.createConnection({}, dcConstraints), 'created a');
  t.ok(b = rtc.createConnection({}, dcConstraints), 'created b');
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

  b.addEventListener('datachannel', function(evt) {
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

/*test('close connections', function(t) {
  t.plan(2);

  a.once('close', t.pass.bind(t, 'a closed'));
  b.once('close', t.pass.bind(t, 'b closed'));

  a.close();
  b.close();
});*/