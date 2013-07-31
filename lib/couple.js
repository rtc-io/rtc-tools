/* jshint node: true */
'use strict';

var debug = require('rtc-core/debug')('coupling');
var generators = require('./generators');

/**
## rtc/lib/couple

This is a utility module that is not included in the rtc suite by 
default, but can be included using the following require statement:

```js
var couple = require('rtc/lib/couple');
```

It is primarily used in local testing routines to bind two local
peer connection together, e.g.:

```js
var couple = require('rtc/lib/couple');
var PeerConnection = require('rtc/peerconnection');
var a = new PeerConnection();
var b = new PeerConnection();

// couple the two connections together
couple(peerA, peerB, function(err) {
  // if no err, then a and b have been coupled successfully
);
```
**/
module.exports = function(peerA, peerB, done) {

  var negotiating = false;

  function addCandidate(target) {
    return function(candidate) {
      target.addIceCandidate(new RTCIceCandidate(candidate));
    };
  }

  function checkOpen() {
    if (peerA.open && peerB.open) {
      peerA.removeListener('open', checkOpen);
      peerB.removeListener('open', checkOpen);

      done();
    }
  }

  function renegotiate(a, b, callback) {
    // if we are already negotiating, bail
    if (negotiating) {
      debug('currently negotiating, aborting negotiation request');
      return;
    }

    // create a dummy callback (if required)
    callback = callback || function() {};
    negotiating = true;
    debug('negotiating connection');

    // create an offer for a
    a.createOffer(
      function(aDesc) {
        // tell a about itself, and b about a
        a.setLocalDescription(aDesc);
        b.setRemoteDescription(aDesc);

        // now get b to generate an answer
        b.createAnswer(
          function(bDesc) {
            // tell b about itself, and a about b
            b.setLocalDescription(bDesc);
            a.setRemoteDescription(bDesc);

            // trigger the callback
            callback();

            // flag as not negotiating
            debug('completed negotiation process');
            negotiating = false;
          },

          callback,
          generators.mediaConstraints(b.flags, 'offer')
        );
      },

      callback,
      generators.mediaConstraints(a.flags, 'offer')
    );
  }

  // complete the first round negotiation
  renegotiate(peerA, peerB);
  peerA.on('open', checkOpen);
  peerB.on('open', checkOpen);

  // tell them about eachother 
  peerA.on('candidate', addCandidate(peerB));
  peerB.on('candidate', addCandidate(peerA));

  // handle negotiation requests
  peerA.on('negotiate', function() {
    renegotiate(peerA, peerB);
  });

  peerB.on('negotiate', function() {
    renegotiate(peerB, peerA);
  });
};