/* jshint node: true */
'use strict';

var debug = require('../debug')('processors');
var eve = require('eve');

/**
  ## rtc/lib/processors

  This is an internal library of processor helpers that know what to do 
  when a signaller receives generic `config` events for a particular call.
  A processor is provided the local peer connection, a series of opts (
  including the signaller) and the data that was sent across the wire.
**/

/**
  ### candidate(pc, opts, data)

  Process an ice candidate being supplied from the other side of the world.
**/
exports.candidate = function(pc, opts, data) {
  // if we have no remote description, then wait
  if (! pc.remoteDescription) {
    debug('unable to add ice candidate, remote description not set');
    return;
  }

  pc.addIceCandidate(new RTCIceCandidate(data));
};

/**
  ### sdp(pc, opts, data)
**/
exports.sdp = function(pc, opts, data) {
  var signaller = opts && opts.signaller;
  var callId = opts && opts.callId;
  var isOffer = data && data.type === 'offer';

  debug('received sdp over the wire');

  // update the remote description for the connection
  pc.setRemoteDescription(
    new RTCSessionDescription(data),

    function() {
      // // apply the queued candidates
      // connection._queuedCandidates.splice(0).map(function(c) {
      //   connection._basecon.addIceCandidate(new RTCIceCandidate(c));
      // });

      // if the sdp is an offer, then we probably need to answer
      if (isOffer) {
        eve('call.' + callId + '.answer');
      }
    },

    function(err) {
      debug('unable to set remote description', err);
    }
  );
};