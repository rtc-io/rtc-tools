/* jshint node: true */
'use strict';

var generators = require('./generators');

/**
## rtc/couple

This is a utility module that is not included in the rtc suite by 
default, but can be included using the following require statement:

```js
var couple = require('rtc/couple');
```

It is primarily used in local testing routines to bind two local
peer connection together, e.g.:

```js
var couple = require('rtc/couple');
var PeerConnection = require('rtc/peerconnection');
var a = new PeerConnection();
var b = new PeerConnection();

// couple the two connections together
couple(a, b, function(err) {
  // if no err, then a and b have been coupled successfully
);
```
*/
module.exports = function(a, b, callback) {
  console.log(a.mediaConstraints);
  console.log(b.mediaConstraints);

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
          a.setRemoteDescription(aDesc);

          // trigger the callback
          callback();
        },

        callback,
        b.mediaConstraints || generators.mediaConstraints()
      );
    },

    callback,
    a.mediaConstraints || generators.mediaConstraints()
  );
};