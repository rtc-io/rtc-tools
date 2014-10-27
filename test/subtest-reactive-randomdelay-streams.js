var couple = require('../couple');
var signaller = require('rtc-signaller');
var messenger = require('./helpers/messenger');
var MediaStream = require('../detect')('MediaStream');
var test = require('tape');
var rtc = require('..');
var times = require('whisk/times');

module.exports = function(name, contexts, opts) {
  var conns = [];
  var signallers = [];
  var monitors = [];
  var scope = [];
  var dcs = [];
  var scope = [];

  // default options
  var roomId = (opts || {}).roomId || require('uuid').v4();
  var iceServers = (opts || {}).iceServers || [];
  var minDelay = (opts || {}).minDelay || 0;
  var maxDelay = ((opts || {}).maxDelay || 500) - minDelay;
  var streamCount = (opts || {}).streamCount || 10;

  function randomDelay() {
    return minDelay + (Math.random() * maxDelay);
  }

  test(name + ': create peer connections', function(t) {
    t.plan(2);

    t.ok(conns[0] = rtc.createConnection({ iceServers: iceServers }), 'created a');
    t.ok(conns[1] = rtc.createConnection({ iceServers: iceServers }), 'created b');
  });

  test(name + ': create signallers', function(t) {
    t.plan(2);
    signallers = times(2).map(function() {
      return signaller(messenger);
    });
    t.ok(signallers[0], 'created signaller a');
    t.ok(signallers[1], 'created signaller b');
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

  test(name + ': create streams', function(t) {
    var masterIdx = signallers[0].isMaster(signallers[1].id) ? 0 : 1;
    var ids = times(streamCount).map(function(idx) {
      return 'newstream_' + idx;
    });
    var pendingCount = ids.length;
    var pendingIds = [];

    function addStream(idx) {
      var stream;

      idx = idx || 0;

      // create the stream from the context
      stream = contexts[idx].createMediaStreamDestination().stream;
      stream.id = ids.shift();
      conns[idx].addStream(stream);

      pendingIds.push(stream.id);
      console.log('created stream ' + stream.id + ' on connection: ' + idx + ' ' + ids.length + ' to go');

      if (ids.length > 0) {
        setTimeout(function() {
          addStream(idx ^ 1);
        }, Math.random() * 200);
      }
    }

    function handleStream(evt) {
      var streamIdx = pendingIds.indexOf(evt && evt.stream && evt.stream.id);
      t.ok(streamIdx >= 0, 'stream found: ' + evt.stream.id);
      pendingCount -= 1;

      if (pendingCount === 0) {
        conns[masterIdx ^ 1].removeEventListener('addstream', handleStream);
        conns[masterIdx].removeEventListener('addstream', handleStream);
        t.pass('got all channels');
      }
    }

    console.log('expect: ' + (ids.length + 1));
    t.plan(ids.length + 1);
    conns[masterIdx ^ 1].addEventListener('addstream', handleStream);
    conns[masterIdx].addEventListener('addstream', handleStream);

    addStream();
  });

  test(name + ': close the connections', function(t) {
    t.plan(conns.length);
    conns.forEach(function(conn, index) {
      monitors[index].once('closed', t.pass.bind(t, 'closed connection: ' + index));
      conn.close();
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
