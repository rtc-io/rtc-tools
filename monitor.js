/* jshint node: true */
'use strict';

var EventEmitter = require('events').EventEmitter;

// define the various ICEConnectionStates that are active
var activeStates = [
  'connected',
  'completed'
];

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
  monitor(pc).once('connected', function() {
    // active and ready to go
  });
  ```
  
  The monitor is reporting the changes in `iceConnectionState` of the peer
  connection, hence why the example above is looking for the `connected`
  event.  If you do want to monitor the general `iceConnectionState` of the
  peer connection then you can also listen for `change` with the monitor.

**/
var monitor = module.exports = function(pc, targetId, signaller, opts) {
  var debugLabel = (opts || {}).debugLabel || 'rtc';
  var debug = require('cog/logger')(debugLabel + '/monitor');

  // create a new event emitter which will communicate events
  var mon = new EventEmitter();
  var currentState = getState(pc);
  var isActive = mon.active = activeStates.indexOf(currentState[0]) >= 0;
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