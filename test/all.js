var test = require('tape');
var detect = require('rtc-core/detect');
var uuid = require('uuid');

// regenerate some signaller ids for the reuse tests
var ids = [ uuid.v4(), uuid.v4() ];

test('can import rtc module', function(t) {
  t.plan(1);
  t.ok(require('../'), 'imported successfully');
});

require('./generators');
require('./generators-connection-constraints');
require('./peerconnection');
require('./monitor');
require('./cleanup');

require('./coupling');
require('./coupling-customid');
require('./coupling-constraints');
require('./capture-close-localonly');

// only test reactive coupling in chrome
if (! detect.moz) {
  require('./all-reactive');
}
