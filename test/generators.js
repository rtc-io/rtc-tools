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

test('iceServer generator generates iceServers', function(t) {
  var i = 0;
  var template = {
    iceServerGenerator: function () {
      i += 1;
      return [{urls: 'turn:nowhere.com:' + i}];
    }
  };
  var config = {};

  t.plan(4);
  t.ok(config = generators.config(template), 'generated config');
  t.deepEqual(config.iceServers, [{urls: 'turn:nowhere.com:1'}], 'first generation succeeded');
  t.ok(config = generators.config(template), 'generated new config');
  t.deepEqual(config.iceServers, [{urls: 'turn:nowhere.com:2'}], 'second generation succeeded');
});
