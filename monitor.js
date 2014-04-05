/* jshint node: true */
'use strict';

var EventEmitter = require('events').EventEmitter;

// define some state mappings to simplify the events we generate
var stateMappings = {
  completed: 'connected'
};

// define the events that we need to watch for peer connection
// state changes
var peerStateEvents = [
  'signalingstatechange',
  'iceconnectionstatechange',
  'close'
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
module.exports = function(pc, targetId, signaller, opts) {
  var debugLabel = (opts || {}).debugLabel || 'rtc';
  var debug = require('cog/logger')(debugLabel + '/monitor');
  var monitor = new EventEmitter();
  var state;

  // if we haven't been provided a valid peer connection, abort
  if (! pc) {
    return monitor;
  }

  // determine the initial is active state
  state = getMappedState(pc.iceConnectionState);

  function checkState() {
    var newState = getMappedState(pc.iceConnectionState);
    debug('state changed: ' + pc.iceConnectionState + ', mapped: ' + newState);

    // if the active state has changed, then send the appopriate message
    if (state !== newState) {
      monitor.emit(newState);
      state = newState;
    }

    // flag the we had a state change
    monitor.emit('change', pc);
  }

  peerStateEvents.forEach(function(evtName) {
    pc['on' + evtName] = checkState;
  });

  monitor.stop = function() {
    peerStateEvents.forEach(function(evtName) {
      pc['on' + evtName] = null;
    });
  };

  monitor.checkState = checkState;

  // if we are active, trigger the connected state
  // setTimeout(monitor.emit.bind(monitor, state), 0);

  return monitor;
};

/* internal helpers */

function getMappedState(state) {
  return stateMappings[state] || state;
}