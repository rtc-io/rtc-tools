var test = require('tape');
var gen = require('../generators');

test('empty connection constraints', function(t) {
  var c;

  t.plan(1);
  c = gen.connectionConstraints();
  t.deepEqual(c, {});
});

test('data connection constraints', function(t) {
  var c;

  t.plan(1);
  c = gen.connectionConstraints({ data: true });
  t.deepEqual(c, { optional: [ { RtpDataChannels: true } ] });
});

test('dtls connection constraints', function(t) {
  var c;

  t.plan(1);
  c = gen.connectionConstraints({ dtls: true });
  t.deepEqual(c, { optional: [ { DtlsSrtpKeyAgreement: true } ] });
});