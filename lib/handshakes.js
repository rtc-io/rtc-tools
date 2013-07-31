/* jshint node: true */
'use strict';

var generators = require('./generators');

/**
  ## rtc/lib/handshakes

  This is an internal helper module that helps with applying the appropriate
  handshake logic for a connection.
**/

/**
  ### handshakes.offer(connection, signaller)

  Create an offer and send it over the wire.
**/
exports.offer = function(connection, signaller) {
  var debug = require('../debug')('handshake-offer');
  var pc = connection._basecon || connection._createBaseConnection();

  // create a new offer
  pc.createOffer(
    function(desc) {
      // set the local description of the instance
      pc.setLocalDescription(
        desc,

        function() {
          // send a negotiate command to the signalling server
          debug('negotiating, type: ' + desc.type);
          signaller.negotiate(
            connection.targetId,
            desc.sdp,
            connection.callId,
            desc.type
          );
        }, 

        function(err) {
          debug('error setting local description: ', err);
        }
      );
    },

    function(err) {
      debug('error creating offer:', err);
    },

    // create the media constraints for the create offer context
    generators.mediaConstraints(connection.flags, 'offer')
  );  
};

/**
  ### handshakes.answer(connection, signaller)

  Create an answer and send it over the wire.
**/
exports.answer = function(connection, signaller) {
  var debug = require('../debug')('handshake-answer');
  var pc = connection._basecon || connection._createBaseConnection();

  // create a new offer
  pc.createAnswer(
    function(desc) {
      // set the local description of the instance
      pc.setLocalDescription(
        desc,

        function() {
          // send a negotiate command to the signalling server
          debug('negotiating, type: ' + desc.type);
          signaller.negotiate(
            connection.targetId,
            desc.sdp,
            connection.callId,
            desc.type
          );
        }, 

        function(err) {
          debug('error setting local description: ', err);
        }
      );
    },

    function(err) {
      debug('error creating offer:', err);
    },

    // create the media constraints for the create offer context
    generators.mediaConstraints(connection.flags, 'offer')
  );  
};