var generators = require('../generators');
var test = require('tape');
var freeice = require('freeice');

test('generate config', function(t) {
  var config;

  t.plan(2);
  t.ok(config = generators.config(), 'generated config');
  t.ok(config.iceServers, 'config contains ice servers');
});

test('extend config', function(t) {
  var config;

  t.plan(2);
  t.ok(config = generators.config({ a: 1 }), 'generated config');
  t.equal(config.a, 1, 'setting preserved');
});

test('extend config with iceServers', function(t) {
  var config;
  var testServers = freeice();

  t.plan(2);
  t.ok(config = generators.config({ iceServers: testServers }), 'generated config');
  t.deepEqual(config.iceServers, testServers, 'servers matched');
});