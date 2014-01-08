var couple = require('../couple');
var messenger = require('messenger-memory');
var signaller = require('rtc-signaller');
var test = require('tape');
var rtc = require('..');
var conns = [];
var signallers = [];
var monitors = [];
var scope = [];
var messengers = [];
var dcs = [];

// require('cog/logger').enable('couple'qqq);

test('create peer connections', function(t) {
  t.plan(2);

  t.ok(conns[0] = rtc.createConnection(), 'created a');
  t.ok(conns[1] = rtc.createConnection(), 'created b');
});

test('create test messengers', function(t) {
  t.plan(1);
  messengers = [
    messenger({ delay: Math.random() * 200, scope: scope }),
    messenger({ delay: Math.random() * 200, scope: scope })
  ];
  t.ok(messengers.length == 2, 'created');
});

test('create signallers', function(t) {
  t.plan(2);

  t.ok(signallers[0] = signaller(messengers[0]), 'created signaller a');
  t.ok(signallers[1] = signaller(messengers[1]), 'created signaller b');
});

test('announce signallers', function(t) {
  t.plan(1);
  signallers[0].announce();
  signallers[1].announce();

  // TODO: do this better....
  setTimeout(t.pass.bind(t, 'done'), 600);
});

test('couple a --> b', function(t) {
  t.plan(1);

  t.ok(
    monitors[0] = couple(conns[0], signallers[1].id, signallers[0]),
    'ok'
  );
});

test('couple b --> a', function(t) {
  t.plan(1);
  t.ok(
    monitors[1] = couple(conns[1], signallers[0].id, signallers[1]),
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

test('create an offer from the other party', function(t) {
  t.plan(1);

  monitors[0].on('change', function handleChange(status, conn) {
    if (conn.signalingState === 'stable') {
      monitors[0].removeListener('change', handleChange);
      t.pass('signaling state stable again');
    }
  });

  monitors[1].createOffer();
});

test('create a data channel on the master connection', function(t) {
  var masterIdx = signallers[0].isMaster(signallers[1].id) ? 0 : 1;

  t.plan(1);

  dcs[masterIdx] = conns[masterIdx].createDataChannel('test');
  conns[masterIdx ^ 1].ondatachannel = function(evt) {
    dcs[masterIdx ^ 1] = evt.channel;
    t.pass('got data channel');
  };
});

// test('create a data channel on a', function(t) {
//   t.plan(2);

//   conns[1].addEventListener('datachannel', function(evt) {
//     t.pass('got data channel');
//   });

//   t.ok(conns[0].createDataChannel('RTCDataChannel'), 'a created');
// });

// test('close connections', function(t) {
//   t.plan(2);

//   monitors[0].once('closed', t.pass.bind(t, 'a closed'));
//   monitors[1].once('closed', t.pass.bind(t, 'b closed'));

//   conns[0].close();
//   conns[1].close();
// });