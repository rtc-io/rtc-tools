/* jshint node: true */

'use strict';

/**
  # rtc

  The `rtc` package is a convenience layer for working with the rtc.io toolkit.
  Consider it a boxed set of lego of the most common pieces required to build
  the front-end component of a WebRTC application.

  ## Getting Started

  TO BE COMPLETED

**/

// export peer connection
exports.PeerConnection = require('./peerconnection');

// export detect
exports.detect = require('./detect');

// export media
exports.media = require('./media');

// export the signaller
exports.signaller = require('./signaller');