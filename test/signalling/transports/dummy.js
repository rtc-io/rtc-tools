var channelManager = require('rtc-channelmanager')();

module.exports = function() {
  return channelManager.connect();
}