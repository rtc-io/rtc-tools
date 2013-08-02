/* jshint node: true */
'use strict';

var debug = require('rtc-core/debug')('monitor');
var EventEmitter = require('events').EventEmitter;
var W3C_STATES = {
  NEW: 'new',
  LOCAL_OFFER: 'have-local-offer',
  LOCAL_PRANSWER: 'have-local-pranswer',
  REMOTE_PRANSWER: 'have-remote-pranswer',
  ACTIVE: 'active',
  CLOSED: 'closed'
};

/**
  ## rtc/monitor

  In most current implementations of `RTCPeerConnection` it is quite
  difficult to determine whether a peer connection is active and ready
  for use or not.  The monitor provides some assistance here by providing
  a simple function that provides an `EventEmitter` which gives updates
  on a connections state.

  ### monitor(pc) -> EventEmitter

  ```js
  var monitor = require('rtc/monitor');
  var pc = new RTCPeerConnection(config);

  // watch pc and when active do something
  monitor(pc).once('active', function() {
    // active and ready to go
  });
  ```

  Events provided by the monitor are as follows:

  - `active`: triggered when the connection is active and ready for use
  - `stable`: triggered when the connection is in a stable signalling state
  - `unstable`: trigger when the connection is renegotiating.

  It should be noted, that the monitor does a check when it is first passed
  an `RTCPeerConnection` object to see if the `active` state passes checks.
  If so, the `active` event will be fired in the next tick.

  If you require a synchronous check of a connection's "openness" then
  use the `monitor.isActive` test outlined below.
**/
var monitor = module.exports = function(pc, tag) {
  // create a new event emitter which will communicate events
  var mon = new EventEmitter();
  var signalingState = pc && pc.signalingState;
  var currentState = getState(pc);
  var isActive = mon.active = currentState === W3C_STATES.ACTIVE;

  function checkState() {
    var newState = getState(pc, tag);
    debug('captured state change, new state: ' + newState);

    // update the monitor active flag
    mon.active = newState === W3C_STATES.ACTIVE;

    // if we have a state change, emit an event for the new state
    if (newState !== currentState) {
      mon.emit(currentState = newState);
    }
  }

  // if the current state is active, trigger the active event
  if (isActive) {
    process.nextTick(mon.emit.bind(mon, W3C_STATES.ACTIVE, pc));
  }

  // start watching stuff on the pc
  pc.addEventListener('signalingstatechange', checkState);
  pc.addEventListener('iceconnectionstatechange', checkState);

  // patch in a stop method into the emitter
  mon.stop = function() {
    pc.removeEventListener('signalingstatechange', checkState);
    pc.removeEventListener('iceconnectionstatechange', checkState);
  };

  return mon;
};

/**
  ### monitor.getState(pc)

  Provides a unified state definition for the RTCPeerConnection based
  on a few checks.

  In emerging versions of the spec we have various properties such as
  `readyState` that provide a definitive answer on the state of the 
  connection.  In older versions we need to look at things like
  `signalingState` and `iceGatheringState` to make an educated guess 
  as to the connection state.
**/
var getState = monitor.getState = function(pc, tag) {
  var readyState = pc && pc.readyState;
  var signalingState = pc && pc.signalingState;
  var iceGatheringState = pc && pc.iceGatheringState;
  var iceConnectionState = pc && pc.iceConnectionState;
  var localDesc;
  var remoteDesc;
  var state;

  // if no connection return closed
  if (! pc) {
    return W3C_STATES.CLOSED;
  }

  // initialise the tag to an empty string if not provided
  tag = tag || '';

  // if we have a ready state, then return the ready state
  if (typeof readyState != 'undefined') {
    return readyState;
  }

  // get the connection local and remote description
  localDesc = pc.localDescription;
  remoteDesc = pc.remoteDescription;

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

  debug(tag + 'signaling state: ' + signalingState +
    ', iceGatheringState: ' + iceGatheringState + 
    ', iceConnectionState: ' + iceConnectionState);
  
  // if the state is remote pranswer, look at the ice states
  if (state === W3C_STATES.REMOTE_PRANSWER && iceConnectionState === 'connected') {
    state = W3C_STATES.ACTIVE;
  }

  return state;
};

/**
  ### monitor.isActive(pc) -> Boolean

  Test an `RTCPeerConnection` to see if it's currently open.  The test for
  "openness" looks at a combination of current `signalingState` and
  `iceGatheringState`.
**/
monitor.isActive = function(pc) {
  var isStable = pc && pc.signalingState === 'stable';

  // return with the connection is active
  return isStable && getState(pc) === W3C_STATES.ACTIVE;
};