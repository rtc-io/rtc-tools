/* jshint node: true */
'use strict';

var eve = require('eve');
var defaults = require('cog/defaults');
var generators = require('./lib/generators');
var processors = require('./lib/processors');
var debug = require('./debug')('automate');
var RTCPeerConnection = require('./detect')('RTCPeerConnection');
var dataProcessors = ['sdp', 'candidate'];

/**
  ## rtc/automate

  This is an automation module for dealing with peer connections, based on
  some general approaches that tend to work well when dealing with 
  an `RTCPeerConnection` object.

  The generate approach of the automate object is as follows:

  - Implement a reactive approach, i.e. the `createOffer`, `createAnswer`
    dance is completed in response to connections triggering the 
    `onnegotiationneeded` event.
**/

var automate = module.exports = function(pc, opts) {
  var signaller = opts && opts.signaller;
  var callId = opts && opts.callId;
  var canAutomate = (pc instanceof RTCPeerConnection) && signaller && callId;

  // check opts
  opts = defaults({}, opts, {
    config: {},
    constraints: {}
  });

  // if we cannot automate this connection, then log a warning and return
  // the peer connection
  if (! canAutomate) {
    debug('unable to automate peer connection: ', pc);
    return pc;
  }

  // handle signaller config events
  signaller.on('config:' + opts.callId, function(data) {
    data = data || {};

    // run the required processors
    dataProcessors
      .filter(data.hasOwnProperty.bind(data))
      .map(function(processor) {
        processors[processor](pc, opts, data);
      });
  });

  // pass eve call events through to the correct automation helper
  eve.on('call.' + callId, function() {
    // get the event name
    var evtName = eve.nt();
    var methodName = evtName.split('.').pop();
    var handler = automate[methodName];

    if (typeof handler == 'function') {
      handler(pc, opts);
    }
  });

  // handle on negotiation needed events
  pc.addEventListener('negotiationneeded', function() {
    eve('call.' + callId + '.offer');
  });

  return pc;
};

/**
  ### automate.offer(pc, opts)
**/
automate.offer = function(pc, opts) {
  return handshake(pc, opts, 'createOffer');
};

/**
  ### automate.answer(pc, opts)
**/
automate.answer = function(pc, opts) {
  return handshake(pc, opts, 'createAnswer');
};

/*
  ### handshake(pc, opts, method)
*/
function handshake(pc, opts, method) {
  var hsDebug = require('./debug')('handshake-' + method);
  var signaller = opts && opts.signaller;

  // if the signaller is not defined, then abort
  if (! signaller) {
    hsDebug('unable to ' + method + ', do have a signaller');
    return false;
  }

  // create a new offer
  return pc[method].call(pc,
    function(desc) {
      // set the local description of the instance
      pc.setLocalDescription(
        desc,

        function() {
          // send a negotiate command to the signalling server
          hsDebug('negotiating, type: ' + desc.type);
          signaller.sendConfig(opts.callId, desc);
        },

        function(err) {
          hsDebug('error setting local description: ', err);
        }
      );
    },

    function(err) {
      hsDebug('error creating:', err);
    },

    // create the media constraints for the create offer context
    generators.mediaConstraints(opts.config, 'offer')
  );
}