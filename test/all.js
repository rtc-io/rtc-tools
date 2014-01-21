var test = require('tape');
var detect = require('rtc-core/detect');

test('can import rtc module', function(t) {
  t.plan(1);
  t.ok(require('../'), 'imported successfully');
});

require('./generators');
require('./generators-connection-constraints');
require('./peerconnection');
require('./coupling');

// only test reactive coupling in chrome
if (! detect.moz) {
  require('./coupling-reactive');
}
// require('./data-channel');

// test the signalling
// require('./signalling/all');