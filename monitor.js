/* jshint node: true */
'use strict';

var mbus = require('mbus');

// define some state mappings to simplify the events we generate
var stateMappings = {
  completed: 'connected'
};

// define the events that we need to watch for peer connection
// state changes
var peerStateEvents = [
  'signalingstatechange',
  'iceconnectionstatechange',
];

/**
  ### rtc-tools/monitor

  ```
  monitor(pc, targetId, signaller, parentBus) => mbus
  ```

  The monitor is a useful tool for determining the state of `pc` (an
  `RTCPeerConnection`) instance in the context of your application. The
  monitor uses both the `iceConnectionState` information of the peer
  connection and also the various
  [signaller events](https://github.com/rtc-io/rtc-signaller#signaller-events)
  to determine when the connection has been `connected` and when it has
  been `disconnected`.

  A monitor created `mbus` is returned as the result of a
  [couple](https://github.com/rtc-io/rtc#rtccouple) between a local peer
  connection and it's remote counterpart.

**/
module.exports = function(pc, targetId, signaller, parentBus) {
  var monitor = mbus('', parentBus);
  var state;
  var connectionState;
  var signalingState;
  var isClosed = false;

  function checkState() {
    var newConnectionState = pc.iceConnectionState;
    var newState = getMappedState(newConnectionState);
    var newSignalingState = pc.signalingState;

    // flag the we had a state change
    monitor('statechange', pc, newState);
    monitor('connectionstatechange', pc, newConnectionState);

    // if the active state has changed, then send the appopriate message
    if (state !== newState) {
      monitor(newState);
      state = newState;
    }

    if (connectionState !== newConnectionState) {
      monitor('connectionstate:' + newConnectionState);
      connectionState = newConnectionState;
    }

    // As Firefox does not always support `onclose`, if the state is closed
    // and we haven't already handled the close, do so now
    if (newState === 'closed' && !isClosed) {
      handleClose();
    }

    // Check the signalling state to see if it has also changed
    if (signalingState !== newSignalingState) {
      monitor('signalingchange', pc, newSignalingState, signalingState);
      monitor('signaling:' + newSignalingState, pc, newSignalingState, signalingState);
      signalingState = newSignalingState;
    }
  }

  function handleClose() {
    isClosed = true;
    monitor('closed');
  }

  pc.onclose = handleClose;
  peerStateEvents.forEach(function(evtName) {
    pc['on' + evtName] = checkState;
  });

  monitor.close = function() {
    pc.onclose = null;
    peerStateEvents.forEach(function(evtName) {
      pc['on' + evtName] = null;
    });
  };

  monitor.checkState = checkState;

  monitor.destroy = function() {
    monitor.clear();
  };

  // if we haven't been provided a valid peer connection, abort
  if (! pc) {
    return monitor;
  }

  // determine the initial is active state
  state = getMappedState(pc.iceConnectionState);

  return monitor;
};

/* internal helpers */

function getMappedState(state) {
  return stateMappings[state] || state;
}
