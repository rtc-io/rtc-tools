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

// require('cog/logger').enable('couple');

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

test('close a, b aware', function(t) {
  var closeTimeout = setTimeout(function() {
    t.fail('close monitor timed out');
  }, 1000);

  t.plan(1);

  monitors[1].once('close', function() {
    t.pass('captured close');
    clearTimeout(closeTimeout);
    console.log(conns[1].onclose);
  });

  conns[0].close();
});