var couple = require('../couple');
var signaller = require('rtc-signaller');
var test = require('tape');
var rtc = require('..');
var conns = [];
var signallers = [];
var monitors = [];
var scope = [];
var messengers = [];
var dcs = [];
var roomId = require('uuid').v4();

// require('cog/logger').enable('*');

test('create peer connections', function(t) {
  t.plan(2);

  t.ok(conns[0] = rtc.createConnection(), 'created a');
  t.ok(conns[1] = rtc.createConnection(), 'created b');
});

test('create signallers', function(t) {
  t.plan(2);

  t.ok(signallers[0] = signaller(location.origin), 'created signaller a');
  t.ok(signallers[1] = signaller(location.origin), 'created signaller b');
});

test('announce signallers', function(t) {
  t.plan(2);
  signallers[0].once('peer:announce', t.pass.bind(t, '0 knows about 1'));
  signallers[1].once('peer:announce', t.pass.bind(t, '1 knows about 0'));

  signallers[0].announce({ room: roomId });
  signallers[1].announce({ room: roomId });
});

test('couple a --> b', function(t) {
  t.plan(1);

  monitors[0] = couple(conns[0], signallers[1].id, signallers[0], {
    reactive: true,
    debugLabel: 'conn:0'
  });

  t.ok(monitors[0], 'ok');
});

test('couple b --> a', function(t) {
  t.plan(1);

  monitors[1] = couple(conns[1], signallers[0].id, signallers[1], {
    reactive: true,
    debugLabel: 'conn:1'
  });

  t.ok(monitors[1], 'ok');
});

test('activate connection', function(t) {
  t.plan(monitors.length);

  monitors.forEach(function(mon, index) {
    mon.once('connected', t.pass.bind(t, 'connection ' + index + ' active'));
  });

  monitors[0].createOffer();
});

test('create an offer from the other party', function(t) {

  function handleChange(conn) {
    if (conn.signalingState === 'stable') {
      monitors[0].removeListener('change', handleChange);
      t.pass('signaling state stable again');
    }
  }

  t.plan(1);
  monitors[0].on('change', handleChange);
  monitors[1].createOffer();
});

test('create a data channel on the master connection', function(t) {
  var masterIdx = signallers[0].isMaster(signallers[1].id) ? 0 : 1;

  t.plan(1);

  conns[masterIdx ^ 1].ondatachannel = function(evt) {
    dcs[masterIdx ^ 1] = evt.channel;
    t.pass('got data channel');
  };

  dcs[masterIdx] = conns[masterIdx].createDataChannel('test');
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

test('close the connections', function(t) {
  t.plan(conns.length);
  conns.forEach(function(conn, index) {
    monitors[index].once('closed', t.pass.bind(t, 'closed connection: ' + index));
    conn.close();
  });
});

test('close the signallers', function(t) {
  t.plan(signallers.length);
  signallers.splice(0).forEach(function(sig) {
    sig.once('disconnected', t.pass.bind(t, 'disconnected'));
    sig.close();
  });
});

test('release references', function(t) {
  t.plan(1);
  conns = [];
  monitors = [];
  dcs = [];
  t.pass('done');
});