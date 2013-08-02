/* jshint node: true */
/* global RTCIceCandidate: false */
'use strict';

require('rtc-core/debug').enable('*');

var debug = require('rtc-core/debug')('coupling');
var generators = require('../generators');
var monitor = require('../monitor');
var listen = require('./listen');

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

  var peers = [peerA, peerB];
  var listeners;
  var negotiating = false;
  var monA;
  var monB;

  function checkActive() {
    debug('checking active state, a: ' + monA.active + ', b: ' + monB.active);
    if (monA.active && monB.active) {
      monA.stop();
      monB.stop();

      // stop the listeners also
      listeners.map(function(a) {
        return a.stop();
      });

      done();
    }
  }

  function renegotiate(a, b, callback) {
    // if we are already negotiating, bail
    if (negotiating) {
      debug('currently negotiating, aborting negotiation request');
      return;
    }

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

            // flag as not negotiating
            debug('completed negotiation process');
            negotiating = false;
          },

          function(err) {
            debug('error creating answer:', err);
          },
          generators.mediaConstraints(b.flags, 'offer')
        );
      },

      function(err) {
        debug('error creating offer: ', err)
      },
      generators.mediaConstraints(a.flags, 'offer')
    );
  }

  // create a state monitor for each of the peers
  monA = monitor(peerA, 'peer a: ').on('active', checkActive);
  monB = monitor(peerB, 'peer b: ').on('active', checkActive);
  
  // attach valid events
  listeners = peers.map(function(peer, index) {
    var listener = listen(peer);
    var otherPeer = peers[index ^ 1];

    // send candidates to their other peers
    listener.on('icecandidate', function(evt) {
      if (evt.candidate) {
        otherPeer.addIceCandidate(new RTCIceCandidate(evt.candidate));
      }
    });

    // handle renegotiation
    listener.on('negotiationneeded', function() {
      renegotiate(peer, otherPeer);
    });

    return listener;
  });

  // complete the first round negotiation
  renegotiate(peerA, peerB);
};