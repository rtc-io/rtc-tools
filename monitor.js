/* jshint node: true */
'use strict';

var debug = require('cog/logger')('monitor');
var EventEmitter = require('events').EventEmitter;

var comboStates = {
  active: [
    'connected', 'stable'
  ]
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
var monitor = module.exports = function(pc) {
  // create a new event emitter which will communicate events
  var mon = new EventEmitter();
  var currentState = getState(pc);
  var isActive = mon.active = currentState[0] === 'connected';
  var lastConnectionState = pc && pc.iceConnectionState;

  function checkState() {
    var newState = getState(pc);
    var testState = [].concat(newState);
    var isChange = false;

    debug('captured state change: ', newState);
    while ((! isChange) && testState.length > 0) {
      isChange = isChange || testState.shift() !== currentState.shift();
    }

    // update the monitor active flag
    mon.active = newState[0] === 'connected';

    // if we have a state change, emit an event for the new state
    if (isChange) {
      mon.emit('change', pc);
    }

    // check for iceConnectionState changes and report those
    if (lastConnectionState != newState[0]) {
      debug('iceConnectionState change: ' + lastConnectionState + ' --> ' +
        newState[0]);

      mon.emit(newState[0], pc);
      lastConnectionState = newState[0];
    }

    currentState = [].concat(newState);
  }

  // if the current state is active, trigger the active event
  if (isActive) {
    process.nextTick(mon.emit.bind(mon, 'connected', pc));
  }

  // start watching stuff on the pc
  pc.onsignalingstatechange = checkState;
  pc.oniceconnectionstatechange = checkState;
  pc.onclose = checkState;

  // patch in a stop method into the emitter
  mon.stop = function() {
    pc.onsignalingstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.onclose = null;
  };

  return mon;
};

/**
  ### monitor.getState(pc)

  The `getState` method of the monitor provides the state combination for
  the specified peer connection as a 3 element array comprised of the
  following (in order):

  - `iceConnectionState`
  - `signalingState`
  - `iceGatheringState`

**/
var getState = monitor.getState = function(pc) {
  return pc ?
    [ pc.iceConnectionState, pc.signalingState, pc.iceGatheringState] :
    [];
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