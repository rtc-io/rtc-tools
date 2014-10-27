var couple = require('../couple');
var cleanup = require('../cleanup');
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

module.exports = function(suiteName, ids) {
  test(suiteName + ': create peer connections', function(t) {
    t.plan(2);

    t.ok(conns[0] = rtc.createConnection(), 'created a');
    t.ok(conns[1] = rtc.createConnection(), 'created b');
  });

  test(suiteName + ': create signallers', function(t) {
    t.plan(4);

    t.ok(signallers[0] = signaller(messenger, { id: ids[0] }), 'created signaller a');
    t.equal(signallers[0].id, ids[0], 'id assigned');

    t.ok(signallers[1] = signaller(messenger, { id: ids[1] }), 'created signaller b');
    t.equal(signallers[1].id, ids[1], 'id assigned');
  });

  test(suiteName + ': announce signallers', function(t) {
    t.plan(4);

    signallers[0].once('peer:announce', function(data) {
      t.ok(data, 'signaller:0 received signaller:1 info');
      t.equal(data.id, ids[1], 'id matched expected');
    });

    signallers[1].once('peer:announce', function(data) {
      t.ok(data, 'signaller:1 received signaller:0 info');
      t.equal(data.id, ids[0], 'id matched expected');
    });

    signallers[0].announce({ room: roomId });
    signallers[1].announce({ room: roomId });
  });

  test(suiteName + ': couple a --> b', function(t) {
    t.plan(1);

    monitors[0] = couple(conns[0], signallers[1].id, signallers[0], {
      debugLabel: 'conn:0'
    });

    t.ok(monitors[0], 'ok');
  });

  test(suiteName + ': couple b --> a', function(t) {
    t.plan(1);

    monitors[1] = couple(conns[1], signallers[0].id, signallers[1], {
      debugLabel: 'conn:1'
    });

    t.ok(monitors[1], 'ok');
  });

  test(suiteName + ': create a data channel on the master connection', function(t) {
    var masterIdx = signallers[0].isMaster(signallers[1].id) ? 0 : 1;

    t.plan(2);

    dcs[masterIdx] = conns[masterIdx].createDataChannel('test');
    conns[masterIdx ^ 1].ondatachannel = function(evt) {
      dcs[masterIdx ^ 1] = evt.channel;
      t.ok(evt && evt.channel, 'got data channel');
      t.equal(evt.channel.label, 'test', 'dc named test');
    };

    monitors[0].createOffer();
  });

  test(suiteName + ': close a, b aware', function(t) {
    var closeTimeout = setTimeout(function() {
      t.fail('close monitor timed out');
    }, 20000);

    function handleClose() {
      t.pass('captured close');
      clearTimeout(closeTimeout);
    };

    t.plan(1);
    monitors[1].once('closed', handleClose);
    signallers[0].send('/fake:leave');
  });

  test(suiteName + ': disconnect signaller:1', function(t) {
    t.plan(1);
    // signallers[1].once('disconnect', t.pass.bind(t, 'closed'));
    signallers[1].leave();
    t.pass('disconnected');
  });

  test('release references', function(t) {
    t.plan(1);
    conns.splice(0).forEach(cleanup);

    monitors = [];
    dcs = [];
    t.pass('done');
  });
};
