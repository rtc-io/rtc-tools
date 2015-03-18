var signaller = require('rtc-signaller');
var messenger = require('rtc-switchboard-messenger');
var extend = require('cog/extend');

function createSignaller(opts) {
  return signaller(messenger(location.origin), opts);
}

require('rtc-tools-test/')(
  require('..'),
  createSignaller
);
