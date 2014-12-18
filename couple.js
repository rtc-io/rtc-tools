/* jshint node: true */
'use strict';

var mbus = require('mbus');
var queue = require('rtc-taskqueue');
var cleanup = require('./cleanup');
var monitor = require('./monitor');
var throttle = require('cog/throttle');
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

  // initilaise the negotiation helpers
  var isMaster = signaller.isMaster(targetId);

  // initialise the processing queue (one at a time please)
  var q = queue(pc, opts);

  var createOrRequestOffer = throttle(function() {
    if (! isMaster) {
      return signaller.to(targetId).send('/negotiate');
    }

    q.createOffer();
  }, 100, { leading: false });

  var debounceOffer = throttle(q.createOffer, 100, { leading: false });

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

    // remove listeners (version >= 5)
    signaller.removeListener('message:sdp', handleSdp);
    signaller.removeListener('message:candidate', handleCandidate);
    signaller.removeListener('message:negotiate', handleNegotiateRequest);
  }

  function handleCandidate(data) {
    q.addIceCandidate(data);
  }

  function handleSdp(sdp, src) {
    emit('sdp.remote', sdp);

    // if the source is unknown or not a match, then don't process
    if ((! src) || (src.id !== targetId)) {
      return;
    }

    q.setRemoteDescription(sdp);
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
      cleanup(pc);
    }, disconnectTimeout);

    mon.on('statechange', handleDisconnectAbort);
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
    var data;

    if (evt.candidate) {
      resetDisconnectTimer();

      // formulate into a specific data object so we won't be upset by plugin
      // specific implementations of the candidate data format (i.e. extra fields)
      data = {
        candidate: evt.candidate.candidate,
        sdpMid: evt.candidate.sdpMid,
        sdpMLineIndex: evt.candidate.sdpMLineIndex
      };

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

  function handleNegotiateRequest(src) {
    if (src.id === targetId) {
      emit('negotiate.request', src.id);
      debounceOffer();
    }
  }

  function resetDisconnectTimer() {
    mon.off('statechange', handleDisconnectAbort);

    // clear the disconnect timer
    debug('reset disconnect timer, state: ' + pc.iceConnectionState);
    clearTimeout(disconnectTimer);
  }

  // when regotiation is needed look for the peer
  if (reactive) {
    pc.onnegotiationneeded = function() {
      emit('negotiate.renegotiate');
      createOrRequestOffer();
    };
  }

  pc.onicecandidate = handleLocalCandidate;

  // when the task queue tells us we have sdp available, send that over the wire
  q.on('sdp.local', function(desc) {
    signaller.to(targetId).send('/sdp', desc);
  });

  // when we receive sdp, then
  signaller.on('sdp', handleSdp);
  signaller.on('candidate', handleCandidate);

  // listeners (signaller >= 5)
  signaller.on('message:sdp', handleSdp);
  signaller.on('message:candidate', handleCandidate);

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

  return mon;
}

module.exports = couple;
