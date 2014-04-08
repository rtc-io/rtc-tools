/* jshint node: true */
'use strict';

var CANNOT_CLOSE_STATES = [
  'closed'
];

var EVENTNAMES = [
  'addstream',
  'datachannel',
  'icecandidate',
  'iceconnectionstatechange',
  'negotiationneeded',
  'removestream',
  'signalingstatechange'
];

/**
  ### rtc/cleanup

  ```
  cleanup(pc)
  ```

  The `cleanup` function is used to ensure that a peer connection is properly
  closed and ready to be cleaned up by the browser.

**/
module.exports = function(pc) {
  // see if we can close the connection
  var currentState = pc.iceConnectionState;
  var canClose = CANNOT_CLOSE_STATES.indexOf(currentState) < 0;

  if (canClose) {
    pc.close();
  }

  // remove the event listeners
  // after a short delay giving the connection time to trigger
  // close and iceconnectionstatechange events
  setTimeout(function() {
    EVENTNAMES.forEach(function(evtName) {
      if (pc['on' + evtName]) {
        pc['on' + evtName] = null;
      }
    });
  }, 100);
};