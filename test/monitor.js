var test = require('tape');
var peerpair = require('peerpair');
var cleanup = require('../cleanup');
var monitor = require('../monitor');
var rtc = require('../');
var pcs = [];
var monitors = [];

test('use peerpair to create a connected set of peers', function(t) {
  t.plan(1);
  pcs = peerpair();
  pcs.events.once('connected', t.pass.bind(t, 'connected'));
  pcs.createChannelsAndConnect(['test']);
});

test('create monitors for the connections', function(t) {
  t.plan(2);
  monitors = pcs.map(monitor);
  t.equal(typeof monitors[0].on, 'function', 'monitor:0 created');
  t.equal(typeof monitors[0].on, 'function', 'monitor:1 created');
});

test('release references', function(t) {
  t.plan(1);
  pcs.splice(0).forEach(cleanup);
  monitors = [];
  t.pass('done');
});