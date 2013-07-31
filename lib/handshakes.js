/* jshint node: true */
'use strict';

var generators = require('./generators');

/**
  ## rtc/lib/handshakes

  This is an internal helper module that helps with applying the appropriate
  handshake logic for a connection.
**/

/**
  ### handshakes.offer(signaller, connection)

  Create an offer and send it over the wire.
**/
exports.offer = function(signaller, connection) {
  return handshake(signaller, connection, 'createOffer');
};

/**
  ### handshakes.answer(signaller, connection);

  Create an answer and send it over the wire.
**/
exports.answer = function(signaller, connection) {
  return handshake(signaller, connection, 'createAnswer');
};

function handshake(signaller, connection, method) {
  var debug = require('../debug')('handshake-' + method);
  var pc = connection._basecon;

  // create a new offer
  pc[method].call(pc, 
    function(desc) {
      // set the local description of the instance
      pc.setLocalDescription(
        desc,

        function() {
          // send a negotiate command to the signalling server
          debug('negotiating, type: ' + desc.type);
          signaller.sendConfig(connection.callId, desc);
        }, 

        function(err) {
          debug('error setting local description: ', err);
        }
      );
    },

    function(err) {
      debug('error creating:', err);
    },

    // create the media constraints for the create offer context
    generators.mediaConstraints(connection.flags, 'offer')
  );  
}