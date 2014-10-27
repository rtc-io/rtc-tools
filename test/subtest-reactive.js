var couple = require('../couple');
var signaller = require('rtc-signaller');
var messenger = require('./helpers/messenger');
var test = require('tape');
var rtc = require('..');
var times = require('whisk/times');

// require('cog/logger').enable('*');
require('cog/logger').enable('rtc-validator');

module.exports = function(name, opts) {
  var conns = [];
  var signallers = [];
  var monitors = [];
  var scope = [];
  var messengers = [];
  var dcs = [];
  var scope = [];

  // default options
  var roomId = (opts || {}).roomId || require('uuid').v4();
  var iceServers = (opts || {}).iceServers || [];
  var minDelay = (opts || {}).minDelay || 0;
  var maxDelay = ((opts || {}).maxDelay || 500) - minDelay;
  var channelCount = (opts || {}).channelCount || 10;

  test(name + ': create peer connections', function(t) {
    t.plan(2);

    t.ok(conns[0] = rtc.createConnection(), 'created a');
    t.ok(conns[1] = rtc.createConnection(), 'created b');
  });

  test(name + ': create signallers', function(t) {
    t.plan(2);

    t.ok(signallers[0] = signaller(messenger), 'created signaller a');
    t.ok(signallers[1] = signaller(messenger), 'created signaller b');
  });

  test(name + ': announce signallers', function(t) {
    t.plan(2);
    signallers[0].once('peer:announce', t.pass.bind(t, '0 knows about 1'));
    signallers[1].once('peer:announce', t.pass.bind(t, '1 knows about 0'));

    signallers[0].announce({ room: roomId });
    signallers[1].announce({ room: roomId });
  });

  test(name + ': couple a --> b', function(t) {
    t.plan(1);

    monitors[0] = couple(conns[0], signallers[1].id, signallers[0], {
      reactive: true,
      debugLabel: 'conn:0'
    });

    t.ok(monitors[0], 'ok');
  });

  test(name + ': couple b --> a', function(t) {
    t.plan(1);

    monitors[1] = couple(conns[1], signallers[0].id, signallers[1], {
      reactive: true,
      debugLabel: 'conn:1'
    });

    t.ok(monitors[1], 'ok');
  });

  test(name + ': activate connection', function(t) {
    t.plan(monitors.length);

    monitors.forEach(function(mon, index) {
      mon.once('connected', t.pass.bind(t, 'connection ' + index + ' active'));
    });

    monitors[0].createOffer();
  });

  test(name + ': create an offer from the other party', function(t) {

    function handleChange(conn) {
      if (conn.signalingState === 'stable') {
        monitors[0].removeListener('statechange', handleChange);
        t.pass('signaling state stable again');
      }
    }

    t.plan(1);
    monitors[0].on('statechange', handleChange);
    monitors[1].createOffer();
  });

  test(name + ': create a data channel on the master connection', function(t) {
    var masterIdx = signallers[0].isMaster(signallers[1].id) ? 0 : 1;

    t.plan(1);

    conns[masterIdx ^ 1].ondatachannel = function(evt) {
      dcs[masterIdx ^ 1] = evt.channel;

      conns[masterIdx ^ 1].ondatachannel = null;
      t.pass('got data channel');
    };

    dcs[masterIdx] = conns[masterIdx].createDataChannel('test');
  });

  test(name + ': create additional data channels', function(t) {
    var masterIdx = signallers[0].isMaster(signallers[1].id) ? 0 : 1;
    var channels = times(channelCount).map(function(idx) {
      return 'newdc_' + idx;
    });
    var pendingChannels = [].concat(channels);

    function addChannel() {
      conns[masterIdx].createDataChannel(channels.shift());

      if (channels.length > 0) {
        setTimeout(addChannel, Math.random() * 200);
      }
    }

    t.plan(pendingChannels.length + 1);

    conns[masterIdx ^ 1].ondatachannel = function(evt) {
      var channelIdx = pendingChannels.indexOf(evt && evt.channel && evt.channel.label);
      t.ok(channelIdx >= 0, 'channel found');
      pendingChannels.splice(channelIdx, 1);

      if (pendingChannels.length === 0) {
        conns[masterIdx ^ 1].ondatachannel = null;
        t.pass('got all channels');
      }
    };

    addChannel();
  });

  test(name + ': close the connections', function(t) {
    t.plan(conns.length);
    conns.forEach(function(conn, index) {
      monitors[index].once('closed', t.pass.bind(t, 'closed connection: ' + index));
      conn.close();
    });
  });

  test(name + ': close the signallers', function(t) {
    t.plan(signallers.length);
    signallers.splice(0).forEach(function(sig) {
      sig.once('disconnected', t.pass.bind(t, 'disconnected'));
      sig.close();
    });
  });

  test(name + ': release references', function(t) {
    t.plan(1);
    conns = [];
    monitors = [];
    dcs = [];
    t.pass('done');
  });

};
