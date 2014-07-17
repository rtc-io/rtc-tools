/* jshint node: true */
'use strict';

var debug = require('cog/logger')('rtc/cleanup');

var CANNOT_CLOSE_STATES = [
  'closed'
];

var EVENTS_DECOUPLE_BC = [
  'addstream',
  'datachannel',
  'icecandidate',
  'negotiationneeded',
  'removestream',
  'signalingstatechange'
];

var EVENTS_DECOUPLE_AC = [
  'iceconnectionstatechange'
];

/**
  ### rtc-tools/cleanup

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

  function decouple(events) {
    events.forEach(function(evtName) {
      if (pc['on' + evtName]) {
        pc['on' + evtName] = null;
      }
    });
  }

  // decouple "before close" events
  decouple(EVENTS_DECOUPLE_BC);

  if (canClose) {
    debug('attempting connection close, current state: '+ pc.iceConnectionState);
    pc.close();
  }

  // remove the event listeners
  // after a short delay giving the connection time to trigger
  // close and iceconnectionstatechange events
  setTimeout(function() {
    decouple(EVENTS_DECOUPLE_AC);
  }, 100);
};
