/* jshint node: true */
'use strict';

var listen = require('cog/listen');

// initialise the core events
var CORE_EVENTS = [
  'negotiationneeded',
  'icecandidate',
  'signalingstatechange',
  'addstream',
  'removestream',
  'iceconnectionstatechange',
  'datachannel'
];

/**
  ## rtc/lib/listen

  ```js
  var listen = require('rtc/lib/listen');

  // listen for negotiation needed events
  listen(pc).on('negotiationneeded', function(evt) {
  
  });
  ```

  The `listen` helper provides an event emitter for a peer connection object
  that will bind to each of the core events WebRTC events (unless overriden
  by providing the listen function additional arguments).
  
**/
module.exports = function(pc) {
  var args = [].slice.call(arguments, 1);

  // listen for all the core events unless overriden in extra args
  return listen(pc, arguments.length > 1 ? args : CORE_EVENTS);
};