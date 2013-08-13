/* jshint node: true */
'use strict';

var monitor = require('./monitor');

/**
  ## rtc/couple

  Couple a WebRTC connection with another webrtc connection via a
  signalling scope.

  ### Example Usage

  ```js
  var couple = require('rtc/couple');

  couple(new RTCConnection(), { id: 'test' }, signaller);
  ```

**/
module.exports = function(conn, targetAttr, signaller) {
  // return a monitor for the connection
  var mon = monitor(conn);
  var blockId;
  var createAnswer = createHandshaker('createAnswer');
  var createOffer = createHandshaker('createOffer');

  function abort(err) {
    // clear any block
    signaller.clearBlock(blockId);

    // log the error
  }

  function createHandshaker(methodName) {
    return function() {
      signaller.request(targetAttr, function(err, channel) {
        if (err) {
          return;
        }

        // block the signalling scope
        blockId = signaller.block();

        // create the offer
        conn[methodName](
          function(desc) {
            // initialise the local description
            conn.setLocalDescription(
              desc,

              // if successful, then send the sdp over the wire
              function() {
                channel.send('/sdp', desc);
                signaller.clearBlock(blockId);
              },

              // on error, abort
              abort
            );
          },

          // on error, abort
          abort
        );
      });
    }
  }

  function handleSdp(data) {
    if (data.type === 'offer') {
      // update the remote description
      // once successful, send the answer
      conn.setRemoteDescription(
        new RTCSessionDescription(data),
        createAnswer,
        abort
      );
    }
  }

  // when regotiation is needed look for the peer
  conn.addEventListener('negotiationneeded', createOffer);

  // when we receive sdp, then
  signaller.on('sdp', handleSdp);

  return mon;
};