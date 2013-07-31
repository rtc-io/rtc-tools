var test = require('tape');
var Signaller = require('../../signaller');
var opts = {
  transport: require('./transports/dummy'),
  channel: 'test'
};
var signallers = [];

test('create signaller 0', function(t) {
  t.plan(1);

  signallers[0] = new Signaller(opts);
  signallers[0].once('join:ok', function() {
    t.equal(signallers[0].channel, 'test');
  });
});

test('create signaller 1', function(t) {
  t.plan(1);

  signallers[1] = new Signaller(opts);
  signallers[1].once('join:ok', function() {
    t.equal(signallers[1].channel, 'test');
  });
});

test('message from 0 --> 1', function(t) {
  t.plan(1);

  signallers[1].once('hello', function() {
    t.pass('got hello message');
  });

  signallers[0].send('/to', signallers[1].id, 'hello');
});

test('message from 1 --> 0', function(t) {
  t.plan(1);

  signallers[0].once('ehlo', function() {
    t.pass('got ehlo message');
  });

  signallers[1].send('/to', signallers[0].id, 'ehlo');
});