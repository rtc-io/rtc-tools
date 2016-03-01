/* jshint node: true */
'use strict';

var mbus = require('mbus');
var queue = require('rtc-taskqueue');
var cleanup = require('./cleanup');
var monitor = require('./monitor');
var throttle = require('cog/throttle');
var pluck = require('whisk/pluck');
var pluckCandidate = pluck('candidate', 'sdpMid', 'sdpMLineIndex');
var CLOSED_STATES = [ 'closed', 'failed' ];
var CHECKING_STATES = [ 'checking' ];

/**
  ### rtc-tools/couple

  #### couple(pc, targetId, signaller, opts?)

  Couple a WebRTC connection with another webrtc connection identified by
  `targetId` via the signaller.

  The following options can be provided in the `opts` argument:

  - `sdpfilter` (default: null)

    A simple function for filtering SDP as part of the peer
    connection handshake (see the Using Filters details below).

  ##### Example Usage

  ```js
  var couple = require('rtc/couple');

  couple(pc, '54879965-ce43-426e-a8ef-09ac1e39a16d', signaller);
  ```

  ##### Using Filters

  In certain instances you may wish to modify the raw SDP that is provided
  by the `createOffer` and `createAnswer` calls.  This can be done by passing
  a `sdpfilter` function (or array) in the options.  For example:

  ```js
  // run the sdp from through a local tweakSdp function.
  couple(pc, '54879965-ce43-426e-a8ef-09ac1e39a16d', signaller, {
    sdpfilter: tweakSdp
  });
  ```

**/
function couple(pc, targetId, signaller, opts) {
  var debugLabel = (opts || {}).debugLabel || 'rtc';
  var debug = require('cog/logger')(debugLabel + '/couple');

  // create a monitor for the connection
  var mon = monitor(pc, targetId, signaller, (opts || {}).logger);
  var emit = mbus('', mon);
  var reactive = (opts || {}).reactive;
  var endOfCandidates = true;

  // configure the time to wait between receiving a 'disconnect'
  // iceConnectionState and determining that we are closed
  var disconnectTimeout = (opts || {}).disconnectTimeout || 10000;
  var disconnectTimer;

  // Target ready indicates that the target peer has indicated it is
  // ready to begin coupling
  var targetReady = false;
  var readyInterval = (opts || {}).readyInterval || 100;
  var readyTimer;

  // Failure timeout
  var failTimeout = (opts || {}).failTimeout || 30000;
  var failTimer;

  // initilaise the negotiation helpers
  var isMaster = signaller.isMaster(targetId);

  // initialise the processing queue (one at a time please)
  var q = queue(pc, opts);
  var coupling = false;
  var negotiationRequired = false;

  function isStable() {
    return pc.signalingState === 'stable';
  }

  var createOrRequestOffer = throttle(function() {
    if (!targetReady) {
      debug('[' + signaller.id + '] ' + targetId + ' not yet ready for offer');
      return emit.once('target.ready', createOrRequestOffer);
    }

    debug('createOrRequestOffer');
    // Ensure that the connection is in a state ready for an offer
    if (!isStable()) return;

    // Otherwise, create the offer
    negotiationRequired = false;
    q.createOffer();
  }, 100, { leading: false });

  function decouple() {
    debug('decoupling ' + signaller.id + ' from ' + targetId);

    // stop the monitor
//     mon.removeAllListeners();
    mon.stop();

    // cleanup the peerconnection
    cleanup(pc);

    // remove listeners
    signaller.removeListener('sdp', handleSdp);
    signaller.removeListener('candidate', handleCandidate);
    signaller.removeListener('negotiate', handleNegotiateRequest);
    signaller.removeListener('ready', handleReady);

    // remove listeners (version >= 5)
    signaller.removeListener('message:sdp', handleSdp);
    signaller.removeListener('message:candidate', handleCandidate);
    signaller.removeListener('message:negotiate', handleNegotiateRequest);
    signaller.removeListener('message:ready', handleReady);
  }

  function handleCandidate(data, src) {
    // if the source is unknown or not a match, then don't process
    if ((! src) || (src.id !== targetId)) {
      return;
    }

    q.addIceCandidate(data);
  }

  // No op
  function handleLastCandidate() {
  }

  function handleSdp(sdp, src) {
    // if the source is unknown or not a match, then don't process
    if ((! src) || (src.id !== targetId)) {
      return;
    }

    emit('sdp.remote', sdp);

    // To speed up things on the renegotiation side of things, determine whether we have
    // finished the coupling (offer -> answer) cycle, and whether it is safe to start
    // renegotiating prior to the iceConnectionState "completed" state
    q.setRemoteDescription(sdp).then(function() {

      // If this is the master, then we can assume that this description was the answer
      // and assume that coupling (offer -> answer) process is complete, so we can
      // now renegotiate without threat of interference
      if (isMaster) {
        debug('coupling complete, can now trigger any pending renegotiations');
        if (negotiationRequired) createOrRequestOffer();
      }
    });
  }

  function handleReady(src) {
    if (targetReady || !src || src.id !== targetId) {
      return;
    }
    debug('[' + signaller.id + '] ' + targetId + ' is ready for coupling');
    targetReady = true;
    emit('target.ready');
  }

  function handleConnectionClose() {
    debug('captured pc close, iceConnectionState = ' + pc.iceConnectionState);
    decouple();
  }

  function handleDisconnect() {
    debug('captured pc disconnect, monitoring connection status');

    // start the disconnect timer
    disconnectTimer = setTimeout(function() {
      debug('manually closing connection after disconnect timeout');
      mon('failed');
      cleanup(pc);
    }, disconnectTimeout);

    mon.on('statechange', handleDisconnectAbort);
    mon('failing');
  }

  function handleDisconnectAbort() {
    debug('connection state changed to: ' + pc.iceConnectionState);

    // if the state is checking, then do not reset the disconnect timer as
    // we are doing our own checking
    if (CHECKING_STATES.indexOf(pc.iceConnectionState) >= 0) {
      return;
    }

    resetDisconnectTimer();

    // if we have a closed or failed status, then close the connection
    if (CLOSED_STATES.indexOf(pc.iceConnectionState) >= 0) {
      return mon('closed');
    }

    mon.once('disconnect', handleDisconnect);
  }

  function handleLocalCandidate(evt) {
    var data = evt.candidate && pluckCandidate(evt.candidate);

    if (evt.candidate) {
      resetDisconnectTimer();
      emit('ice.local', data);
      signaller.to(targetId).send('/candidate', data);
      endOfCandidates = false;
    }
    else if (! endOfCandidates) {
      endOfCandidates = true;
      emit('ice.gathercomplete');
      signaller.to(targetId).send('/endofcandidates', {});
    }
  }

  function requestNegotiation() {
    var stable = isStable();
    // This is a redundant request if not reactive
    if (!stable && !reactive) return;

    debug('not coupling so create or request offer');
    // If no coupling is occurring, regardless of reactive, start the offer process
    if (stable) return createOrRequestOffer();

    // If we are already coupling, we are reactive and renegotiation has not been indicated
    // defer a negotiation request
    if (!stable && reactive && !negotiationRequired) {
      debug('renegotiation is required, but deferring until existing connection is established');
      negotiationRequired = true;

      // NOTE: This is commented out, as the functionality after the setRemoteDescription
      // should adequately take care of this. But should it not, re-enable this
      // mon.once('connectionstate:completed', function() {
      //   createOrRequestOffer();
      // });
    }
  }

  function handleNegotiateRequest(src) {
    if (src.id === targetId) {
      emit('negotiate.request', src.id);
      requestNegotiation();
    }
  }

  function handleRenegotiateRequest() {
    if (!reactive) return;
    emit('negotiate.renegotiate');
    requestNegotiation();
  }

  function resetDisconnectTimer() {
    var recovered = !!disconnectTimer && CLOSED_STATES.indexOf(pc.iceConnectionState) === -1;
    mon.off('statechange', handleDisconnectAbort);

    // clear the disconnect timer
    debug('reset disconnect timer, state: ' + pc.iceConnectionState);
    clearTimeout(disconnectTimer);
    disconnectTimer = undefined;

    // Trigger the recovered event if this is a recovery
    if (recovered) {
      mon('recovered');
    }
  }

  // when regotiation is needed look for the peer
  if (reactive) {
    pc.onnegotiationneeded = handleRenegotiateRequest;
  }

  pc.onicecandidate = handleLocalCandidate;

  // when the task queue tells us we have sdp available, send that over the wire
  q.on('sdp.local', function(desc) {
    signaller.to(targetId).send('/sdp', desc);
  });

  // when we receive sdp, then
  signaller.on('sdp', handleSdp);
  signaller.on('candidate', handleCandidate);
  signaller.on('endofcandidates', handleLastCandidate);
  signaller.on('ready', handleReady);

  // listeners (signaller >= 5)
  signaller.on('message:sdp', handleSdp);
  signaller.on('message:candidate', handleCandidate);
  signaller.on('message:endofcandidates', handleLastCandidate);
  signaller.on('message:ready', handleReady);

  // if this is a master connection, listen for negotiate events
  if (isMaster) {
    signaller.on('negotiate', handleNegotiateRequest);
    signaller.on('message:negotiate', handleNegotiateRequest); // signaller >= 5
  }

  // when the connection closes, remove event handlers
  mon.once('closed', handleConnectionClose);
  mon.once('disconnected', handleDisconnect);

  // patch in the create offer functions
  mon.createOffer = createOrRequestOffer;

  // A heavy handed approach to ensuring readiness across the coupling
  // peers. Will periodically send the `ready` message to the target peer
  // until the target peer has acknowledged that it also is ready - at which
  // point the offer can be sent
  function checkReady() {
    clearTimeout(readyTimer);
    signaller.to(targetId).send('/ready');

    // If we are ready, they've told us they are ready, and we've told
    // them we're ready, then exit
    if (targetReady) return;

    // Otherwise, keep telling them we're ready
    readyTimer = setTimeout(checkReady, readyInterval);
  }
  checkReady();
  debug('[' + signaller.id + '] ready for coupling to ' + targetId);

  // If we fail to connect within the given timeframe, trigger a failure
  failTimer = setTimeout(function() {
    mon('failed');
    decouple();
  }, failTimeout);

  mon.once('connected', function() {
    clearTimeout(failTimer);
  });

  mon.on('signaling:stable', function() {
    if (negotiationRequired) {
      debug('signaling state is now stable, handling queued renegotiation');
      createOrRequestOffer();
    }
  });

  /**
    Aborts the coupling process
   **/
  mon.abort = function() {
    if (failTimer) {
      clearTimeout(failTimer);
    }
    decouple();
    mon('aborted');
  };

  return mon;
}

module.exports = couple;
