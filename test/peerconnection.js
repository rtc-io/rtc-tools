var test = require('tape');
var rtc = require('..');
var gen = require('../generators')
var conn;

test('create peer connection', function(t) {
  t.plan(1);
  t.ok(new rtc.RTCPeerConnection(gen.config()), 'created');
});

test('create via factory', function(t) {
  t.plan(1);
  t.ok(rtc.createConnection(), 'created');
});

// test('close the connection', function(t) {
//   t.plan(1);

//   conn.once('close', t.pass.bind(t, 'closed'));
//   conn.close();
// });