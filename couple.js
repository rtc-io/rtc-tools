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
  var targetInfo = undefined;
  var readyInterval = (opts || {}).readyInterval || 100;
  var readyTimer;

  // Failure timeout
  var failTimeout = (opts || {}).failTimeout || 30000;
  var failTimer;

  // Request offer timer
  var requestOfferTimer;

  // Interoperability flags
  var allowReactiveInterop = (opts || {}).allowReactiveInterop;

  // initilaise the negotiation helpers
  var isMaster = signaller.isMaster(targetId);

  // initialise the processing queue (one at a time please)
  var q = queue(pc, opts);
  var coupling = false;
  var negotiationRequired = false;
  var renegotiateRequired = false;
  var creatingOffer = false;
  var awaitingAnswer = false;
  var interoperating = false;

  /**
    Indicates whether this peer connection is in a state where it is able to have new offers created
   **/
  function isReadyForOffer() {
    return !coupling && pc.signalingState === 'stable';
  }

  function createOffer() {
    // If coupling is already in progress, return
    if (!isReadyForOffer()) return;

    debug('[' + signaller.id + '] ' + 'Creating new offer for connection to ' + targetId);
    // Otherwise, create the offer
    coupling = true;
    creatingOffer = true;
    awaitingAnswer = true;
    negotiationRequired = false;
    q.createOffer().then(function() {
      creatingOffer = false;
    }).catch(function() {
      creatingOffer = false;
      awaitingAnswer = true;
    });
  }

  var createOrRequestOffer = throttle(function() {
    if (awaitingAnswer) {
      debug('[' + signaller.id + '] awaiting answer from ' + targetId + ' before sending new offer');
      return;
    }

    if (!targetReady) {
      debug('[' + signaller.id + '] ' + targetId + ' not yet ready for offer');
      return emit.once('target.ready', createOrRequestOffer);
    }

    // If this is not the master, always send the negotiate request
    // Redundant requests are eliminated on the master side
    if (! isMaster) {
      debug('[' + signaller.id + '] ' + 'Requesting negotiation from ' + targetId + ' (requesting offerer? ' + renegotiateRequired + ')');
      // Due to https://bugs.chromium.org/p/webrtc/issues/detail?id=2782 which involves incompatibilities between
      // Chrome and Firefox created offers by default client offers are disabled to ensure that all offers are coming
      // from the same source. By passing `allowReactiveInterop` you can reallow this, then use the `filtersdp` option
      // to provide a munged SDP that might be able to work
      return signaller.to(targetId).send('/negotiate', {
        requestOfferer: (allowReactiveInterop || !interoperating) && renegotiateRequired
      });
    }

    debug('[' + signaller.id + '] Creating new offer for ' + targetId);
    return createOffer();
  }, 100, { leading: false });

  function decouple() {
    debug('decoupling ' + signaller.id + ' from ' + targetId);

    // Reset values
    coupling = false;
    creatingOffer = false;
    awaitingAnswer = false;

    // Clear any outstanding timers
    clearTimeout(readyTimer);
    clearTimeout(disconnectTimer);
    clearTimeout(requestOfferTimer);
    clearTimeout(failTimer);

    // stop the monitor
//     mon.removeAllListeners();
    mon.close();

    // cleanup the peerconnection
    cleanup(pc);

    // remove listeners
    signaller.removeListener('sdp', handleSdp);
    signaller.removeListener('candidate', handleCandidate);
    signaller.removeListener('endofcandidates', handleLastCandidate);
    signaller.removeListener('negotiate', handleNegotiateRequest);
    signaller.removeListener('ready', handleReady);
    signaller.removeListener('requestoffer', handleRequestOffer);

    // remove listeners (version >= 5)
    signaller.removeListener('message:sdp', handleSdp);
    signaller.removeListener('message:candidate', handleCandidate);
    signaller.removeListener('message:endofcandidates', handleLastCandidate);
    signaller.removeListener('message:negotiate', handleNegotiateRequest);
    signaller.removeListener('message:ready', handleReady);
    signaller.removeListener('message:requestoffer', handleRequestOffer);

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

      // If this is the peer that is coupling, and we have received the answer so we can
      // and assume that coupling (offer -> answer) process is complete, so we can clear the coupling flag
      if (coupling && sdp.type === 'answer') {
        awaitingAnswer = false;

        // Check if the coupling is complete
        checkIfCouplingComplete();

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
    targetInfo = src.data;
    interoperating = (targetInfo.browser !== signaller.attributes.browser);
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
    // This is a redundant request if not reactive
    if (coupling && !reactive) return;

    // If no coupling is occurring, regardless of reactive, start the offer process
    if (!coupling) return createOrRequestOffer();

    // If we are already coupling, we are reactive and renegotiation has not been indicated
    // defer a negotiation request
    if (coupling && reactive && !negotiationRequired) {
      debug('renegotiation is required, but deferring until existing connection is established');
      negotiationRequired = true;

      // NOTE: This is commented out, as the functionality after the setRemoteDescription
      // should adequately take care of this. But should it not, re-enable this
      // mon.once('connectionstate:completed', function() {
      //   createOrRequestOffer();
      // });
    }
  }


  /**
    This allows the master to request the client to send an offer
   **/
  function requestOfferFromClient() {
    if (requestOfferTimer) clearTimeout(requestOfferTimer);
    if (pc.signalingState === 'closed') return;

    // Check if we are ready for a new offer, otherwise delay
    if (!isReadyForOffer()) {
      debug('[' + signaller.id + '] negotiation request denied, not in a state to accept new offers [coupling = ' + coupling + ', creatingOffer = ' + creatingOffer + ', awaitingAnswer = ' + awaitingAnswer + ', ' + pc.signalingState + ']');
      // Do a check to see if the coupling is complete
      checkIfCouplingComplete();
      // Do a recheck of the request
      requestOfferTimer = setTimeout(requestOfferFromClient, 500);
    } else {
       // Flag as coupling and request the client send the offer
      debug('[' + signaller.id + '] ' + targetId + ' has requested the ability to create the offer');
      coupling = true;
      return signaller.to(targetId).send('/requestoffer');
    }
  }

  function handleNegotiateRequest(data, src) {
    debug('[' + signaller.id + '] ' + src.id + ' has requested a negotiation');

    // Sanity check that this is for the target
    if (!src || src.id !== targetId) return;
    emit('negotiate.request', src.id, data);

    // Check if the client is requesting the ability to create the offer themselves
    if (data && data.requestOfferer) {
      return requestOfferFromClient();
    }

    // Otherwise, begin the traditional master driven negotiation process
    requestNegotiation();
  }

  function handleRenegotiateRequest() {
    if (!reactive) return;
    emit('negotiate.renegotiate');
    renegotiateRequired = true;
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

  /**
    Allow clients to send offers
   **/
  function handleRequestOffer(src) {
    if (!src || src.id !== targetId) return;
    debug('[' + signaller.id + '] ' + targetId + ' has requested that the offer be sent [' + src.id + ']');
    return createOffer();
  }

  function checkIfCouplingComplete() {
    // Check if the coupling process is over
    // The coupling process should be check whenever the signaling state is stable
    // or when a remote answer has been received
    // A coupling is considered over when the offer is no longer being created, and
    // there is no answer being waited for
    if (!coupling || creatingOffer || awaitingAnswer) return;
    debug('[' + signaller.id + '] coupling completed to ' + targetId);
    coupling = false;
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
  } else {
    signaller.on('requestoffer', handleRequestOffer);
    signaller.on('message:requestoffer', handleRequestOffer);
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
    debug('[' + signaller.id + '] failed to connect to ' + targetId + ' within allocated time');
    mon('failed');
    decouple();
  }, failTimeout);

  mon.once('connected', function() {
    clearTimeout(failTimer);
  });

  mon.on('signalingchange', function(pc, state) {
    debug('[' + signaller.id + '] signaling state ' + state + ' to ' + targetId);
  });

  mon.on('signaling:stable', function() {
    // Check if the coupling if complete
    checkIfCouplingComplete();

    // Check if we have any pending negotiations
    if (negotiationRequired) {
      debug('signalling stable and a negotiation is required, so creating one');
      createOrRequestOffer();
    }
  });

  mon.stop = decouple;

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

  // Override destroy to clear the task queue as well
  mon.destroy = function() {
    mon.clear();
    q.clear();
  };

  return mon;
}

module.exports = couple;