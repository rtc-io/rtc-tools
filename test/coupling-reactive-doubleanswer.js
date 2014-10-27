var couple = require('../couple');
var signaller = require('rtc-signaller');
var messenger = require('./helpers/messenger');
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

  t.ok(signallers[0] = signaller(messenger), 'created signaller a');
  t.ok(signallers[1] = signaller(messenger), 'created signaller b');
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

test('activate connection (clone sdp from a --> b)', function(t) {
  t.plan(monitors.length);

  monitors.forEach(function(mon, index) {
    mon.on('negotiate:abort', t.fail.bind(t, 'negotiation failed'));
    mon.once('connected', t.pass.bind(t, 'connection ' + index + ' active'));
  });

  monitors[0].createOffer();
  signallers[1].once('sdp', function(data) {
    signallers[0].to(signallers[1].id).send('/sdp', data);
  });
});

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
