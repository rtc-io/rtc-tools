/* jshint node: true */
'use strict';

/**
  ## rtc/lib/state

  The state module is provides some helper functions for determining
  peer connection state and stability based on the various different 
  states that can occur in W3C RTCPeerConnections across browser versions.

  ```js
  var state = require('rtc/lib/state');
  ```
**/

var W3C_STATES = {
  NEW: 'new',
  LOCAL_OFFER: 'have-local-offer',
  LOCAL_PRANSWER: 'have-local-pranswer',
  REMOTE_PRANSWER: 'have-remote-pranswer',
  ACTIVE: 'active',
  CLOSED: 'closed'
};

/**
  ### state.get(pc)

  Provides a unified state definition for the RTCPeerConnection based
  on a few checks.

  In emerging versions of the spec we have various properties such as
  `readyState` that provide a definitive answer on the state of the 
  connection.  In older versions we need to look at things like
  `signalingState` and `iceGatheringState` to make an educated guess 
  as to the connection state.
**/
var getState = exports.get = function(connection) {
  var readyState = connection && connection.readyState;
  var signalingState = connection && connection.signalingState;
  var iceGatheringState = connection && connection.iceGatheringState;
  var localDesc;
  var remoteDesc;
  var state;

  // if no connection return closed
  if (! connection) {
    return W3C_STATES.CLOSED;
  }

  // if we have a ready state, then return the ready state
  if (typeof readyState != 'undefined') {
    return readyState;
  }

  // get the connection local and remote description
  localDesc = connection.localDescription;
  remoteDesc = connection.remoteDescription;

  // use the signalling state
  state = signalingState;

  // if state == 'stable' then investigate
  if (state === 'stable') {
    // initialise the state to new
    state = W3C_STATES.NEW;

    // if we have a local description and remote description flag
    // as pranswered
    if (localDesc && remoteDesc) {
      state = W3C_STATES.REMOTE_PRANSWER;
    }
  }

  // if the state is remote pranswer, look at the ice states
  if (state === W3C_STATES.REMOTE_PRANSWER && iceGatheringState === 'complete') {
    state = W3C_STATES.ACTIVE;
  }

  return state;
};

/**
  ### state.isActive(connection)

  Determine whether the connection is active or not
**/
exports.isActive = function(connection) {
  return getState(connection) === W3C_STATES.ACTIVE;
};