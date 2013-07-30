/* jshint node: true */
'use strict';

var mappings = {
  // audio toggle
  // { audio: false } in peer connection config turns off audio
  audio: function(c, val) {
    c.mandatory.OfferToReceiveAudio = val;
  },

  // video toggle
  // { video: false } in peer connection config turns off video
  video: function(c, val) {
    c.mandatory.OfferToReceiveVideo = val;
  },

  // data enabler
  // { data: true } in peer connection will enable video
  data: function(c, val) {
    if (val) {
      c.optional = (c.optional || []).concat({ RtpDataChannels: true });
    }

    // TODO: remove?
  }
};

/**
  ## rtc/generators

  The generators package provides some utility methods for generating
  constraint objects and similar constructs.
**/
exports.mediaConstraints = function(opts) {
  var constraints = {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    },

    optional: []
  };

  Object.keys(opts || {}).map(function(key, index) {
    if (mappings[key]) {
      // mutate the constraints
      mappings[key](constraints, opts[key]);
    }
  });

  return constraints;
};