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
require('./coupling-constraints');
require('./capture-close-localonly');

// only test reactive coupling in chrome
if (! detect.moz) {
  require('./coupling-reactive');
  require('./capture-close');
}

// ensure that signaller disconnects properly close a connection
require('./capture-close-signaller')('peer:leave closes connection', ids);

// ensure that the ids from the previous test can be successfully reused
// to create new connections
require('./capture-close-signaller')('peer id reuse', ids);