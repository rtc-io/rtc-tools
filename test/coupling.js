var couple = require('../couple');
var messenger = require('messenger-memory');
var signaller = require('rtc-signaller');
var test = require('tape');
var rtc = require('..');
var conns = [];
var signallers = [];
var monitors = [];

var dcConstraints = {
  optional: [
    { RtpDataChannels: true }
  ]
};

test('create peer connections', function(t) {
  t.plan(2);

  t.ok(conns[0] = rtc.createConnection({}, dcConstraints), 'created a');
  t.ok(conns[1] = rtc.createConnection({}, dcConstraints), 'created b');
});

test('create signallers', function(t) {
  t.plan(2);

  t.ok(signallers[0] = signaller(messenger()), 'created signaller a');
  t.ok(signallers[1] = signaller(messenger()), 'created signaller b');
});

test('couple a --> b', function(t) {
  t.plan(1);

  t.ok(
    monitors[0] = couple(conns[0], { id: signallers[1].id }, signallers[0]),
    'ok'
  );
});

test('couple b --> a', function(t) {
  t.plan(1);
  t.ok(
    monitors[1] = couple(conns[1], { id: signallers[0].id }, signallers[1]),
    'ok'
  );
});

test('activate connection', function(t) {
  t.plan(monitors.length);

  monitors.forEach(function(mon, index) {
    mon.once('active', t.pass.bind(t, 'connection ' + index + ' active'));
  });

  monitors[0].createOffer();
});

test('create a data channel on a', function(t) {
  t.plan(2);

  conns[1].addEventListener('datachannel', function(evt) {
    t.pass('got data channel');
  });

  t.ok(
    conns[0].createDataChannel('RTCDataChannel', { reliable: false }),
    'a created'
  );
});

// test('close connections', function(t) {
//   t.plan(2);

//   a.once('close', t.pass.bind(t, 'a closed'));
//   b.once('close', t.pass.bind(t, 'b closed'));

//   a.close();
//   b.close();
// });