var test = require('tape');
var gen = require('../generators');

test('empty connection constraints', function(t) {
  var c;

  t.plan(1);
  c = gen.connectionConstraints();
  t.deepEqual(c, {});
});