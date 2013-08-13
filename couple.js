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
  var openChannel;

  function abort(err) {
    // log the error
    console.log('captured error: ', err);

    // clear any block
    signaller.clearBlock(blockId);
  }

  function createHandshaker(methodName) {
    return function() {
      // clear the open channel
      openChannel = null;

      console.log('making signaller request');
      signaller.request(targetAttr, function(err, channel) {
        if (err) {
          return;
        }

        console.log('request ok');

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
                // save the channel as open
                openChannel = channel;

                // send the sdp
                channel.send('/sdp', desc);

                // clear the block
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

  function handleLocalCandidate(evt) {
    if (evt.candidate && openChannel) {
      openChannel.send('/candidate', evt.candidate);
    }
  }

  function handleRemoteCandidate(data) {
    if (! conn.remoteDescription) {
      return;
    }
    
    console.log('got remote candidate: ', data);
    conn.addIceCandidate(new RTCIceCandidate(data));
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
  conn.addEventListener('icecandidate', handleLocalCandidate);

  // when we receive sdp, then
  signaller.on('sdp', handleSdp);
  signaller.on('candidate', handleRemoteCandidate);

  return mon;
};