/* jshint node: true */
/* global RTCIceCandidate: false */
/* global RTCSessionDescription: false */
'use strict';

var debug = require('cog/logger')('couple');
var monitor = require('./monitor');
var detect = require('./detect');
var RTCSessionDescription = detect('RTCSessionDescription');
var RTCIceCandidate = detect('RTCIceCandidate');

/**
  ## rtc/couple

  ### couple(pc, targetAttr, signaller, opts?)

  Couple a WebRTC connection with another webrtc connection via a
  signalling scope.  The `targetAttr` argument specifies the criteria that
  are passed onto a `/request` command when looking for remote peer
  to couple and exchange messages with.

  ### Example Usage

  ```js
  var couple = require('rtc/couple');
  
  couple(new RTCPeerConnection(), { id: 'test' }, signaller);
  ```

  ### Using Filters

  In certain instances you may wish to modify the raw SDP that is provided
  by the `createOffer` and `createAnswer` calls.  This can be done by passing
  a `sdpfilter` function (or array) in the options.  For example:

  ```js
  // run the sdp from through a local tweakSdp function.
  couple(pc, { id: 'blah' }, signaller, { sdpfilter: tweakSdp });
  ```

**/
module.exports = function(conn, targetAttr, signaller, opts) {
  // create a monitor for the connection
  var mon = monitor(conn);
  var blockId;
  var createAnswer = createHandshaker('createAnswer');
  var createOffer = createHandshaker('createOffer');
  var openChannel;
  var queuedCandidates = [];
  var sdpFilter = (opts || {}).sdpfilter;

  function abort(err) {
    // log the error
    debug('captured error: ', err);

    // clear any block
    signaller.clearBlock(blockId);
  }

  function createHandshaker(methodName) {
    var hsDebug = require('cog/logger')('handshake-' + methodName);

    return function() {
      // clear the open channel
      openChannel = null;

      hsDebug('starting, making signaller request', conn.signalingState);
      signaller.request(targetAttr, function(err, channel) {
        if (err) {
          return;
        }

        hsDebug('request ok');

        // block the signalling scope
        blockId = signaller.block();

        // create the offer
        conn[methodName](
          function(desc) {

            // if a filter has been specified, then apply the filter
            if (sdpFilter) {
              desc.sdp = sdpFilter(desc.sdp);
            }

            // initialise the local description
            conn.setLocalDescription(
              desc,

              // if successful, then send the sdp over the wire
              function() {
                // save the channel as open
                openChannel = channel;

                // send the sdp
                channel.send('/sdp', desc);

                // clear the block
                signaller.clearBlock(blockId);
                hsDebug('block cleared');
              },

              // on error, abort
              abort
            );
          },

          // on error, abort
          abort
        );
      });
    };
  }

  function handleLocalCandidate(evt) {
    if (evt.candidate && openChannel) {
      openChannel.send('/candidate', evt.candidate);
    }
  }

  function handleRemoteCandidate(data) {
    if (! conn.remoteDescription) {
      return queuedCandidates.push(data);
    }
    
    debug('adding remote candidate');
    conn.addIceCandidate(new RTCIceCandidate(data));
  }

  function handleSdp(data) {
    // update the remote description
    // once successful, send the answer
    conn.setRemoteDescription(
      new RTCSessionDescription(data),
      function() {
        // apply any queued candidates
        queuedCandidates.splice(0).forEach(function(data) {
          debug('applying queued candidate');
          conn.addIceCandidate(new RTCIceCandidate(data));
        });

        // create the answer
        if (data.type === 'offer') {
          createAnswer();
        }
      },
      abort
    );
  }

  // when regotiation is needed look for the peer
  conn.addEventListener('negotiationneeded', createOffer);
  conn.addEventListener('icecandidate', handleLocalCandidate);

  // when we receive sdp, then
  signaller.on('sdp', handleSdp);
  signaller.on('candidate', handleRemoteCandidate);

  // when the connection closes, remove event handlers
  mon.once('closed', function() {
    debug('closed');

    // remove listeners
    signaller.removeListener('sdp', handleSdp);
    signaller.removeListener('candidate', handleRemoteCandidate);
  });

  // patch in the create offer function
  mon.createOffer = createOffer;

  return mon;
};