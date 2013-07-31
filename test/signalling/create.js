var test = require('tape');
var uuid = require('uuid');
var Signaller = require('../../signaller');
var signaller;

function isEmpty(b) {
  return b.filter(function(part) {
    return part === 0;
  }).length === 16;
}

test('create a new signaller', function(t) {
  t.plan(2);

  // create a test signaller (using the dummy transport)
  signaller = new Signaller({
    transport: require('./transports/dummy'),
        debug: true,
    autoConnect: false
  });

  // ensure we have a new signaller
  t.ok(signaller, 'signaller was successfully created');

  // ensure the channel is empty
  t.equal(signaller.channel, '', 'Signaller has not joined a channel');
});

test('should be able to connect the signaller', function(t) {
  t.plan(1);

  signaller.connect(function(err) {
    t.error(err);
  });
});

test('should be able to change the signaller channel', function(t) {
  t.plan(1);
  signaller.join('test', function(err) {
    t.equal(signaller.channel, 'test', 'Signaller has joined the test channel');
  });
});

test('should be able to create a signaller that auto connects', function(t) {
  t.plan(1);

  signaller = new Signaller({
    transport: require('./transports/dummy')
  });

  signaller.once('connect:ok', function(id) {
    t.ok(id, 'Connnect and received id');
  });
});

test('should be able to create a signaller that auto connects and joins', function(t) {
  t.plan(2);

  signaller = new Signaller({
    transport: require('./transports/dummy'),
    channel: 'test'
  });

  signaller.once('join:ok', function(channel) {
    t.equal(channel, 'test', 'Signaller created and joined the test channel');
    t.equal(signaller.channel, channel, 'Signaller channel matches expected');
  });
});
