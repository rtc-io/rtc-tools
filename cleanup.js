/* jshint node: true */
'use strict';

var CANNOT_CLOSE_STATES = [
  'closed'
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
  var canClose = CANNOT_CLOSE_STATES.indexOf(pc.iceConnectionState) < 0;

  if (canClose) {
    pc.close();
  }

  // TODO: remove event listeners
};