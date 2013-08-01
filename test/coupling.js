var couple = require('../lib/couple');
var test = require('tape');
var rtc = require('..');
var a;
var b;

test('create peer connections', function(t) {
  t.plan(2);

  t.ok(a = rtc.createConnection(), 'created a');
  t.ok(b = rtc.createConnection(), 'created b');
});

test('couple the two connections together', function(t) {
  t.plan(1);

  couple(a, b, function(err) {
    t.ifError(err, 'done');
  });
});

/*
test('close connections', function(t) {
  t.plan(2);

  a.once('close', t.pass.bind(t, 'a closed'));
  b.once('close', t.pass.bind(t, 'b closed'));

  a.close();
  b.close();
});
*/