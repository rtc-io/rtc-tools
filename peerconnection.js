/* jshint node: true */
/* global RTCIceCandidate: false */

/**
# rtc/peerconnection
**/

'use strict';

var defaults = require('./defaults');
var EventEmitter = require('events').EventEmitter;
var RTCPeerConnection = require('./detect')('RTCPeerConnection');
var RTCSessionDescription = require('./detect')('RTCSessionDescription');
var errorcodes = require('rtc-core/errorcodes');
var util = require('util');

// passthrough methods, attributes and events
// http://dev.w3.org/2011/webrtc/editor/webrtc.html#rtcpeerconnection-interface
var PASSTHROUGH_METHODS = [
  'createOffer',
  'createAnswer',
  'setLocalDescription',
  'setRemoteDescription',
  'updateIce',
  'addIceCandidate',
  'getLocalStreams',
  'getRemoteStreams',
  'getStreamById',
  'addStream',
  'removeStream'
  // 'close', -- don't include close as we need to do some custom stuff

  // add event listener passthroughs
  // NOTE: not implemented in moz so have to fudge it outselves
  // 'addEventListener',
  // 'removeEventListener'    
];


var PASSTHROUGH_ATTRIBUTES = [
  'localDescription',
  'remoteDescription',
  // 'signalingState', --> create a cross-platform compatible attribute
  'iceGatheringState',
  'iceConnectionState'
];

var PASSTHROUGH_EVENTS = [];


/*
Temporarily disable pass through events

PASSTHROUGH_EVENTS = [
    'onnegotiationneeded',
    'onicecandidate',
    'onsignalingstatechange',
    'onaddstream',
    'onremovestream',
    'oniceconnectionstatechange'
], */

var STATE_MAPPINGS = {
  active: 'stable'
};

/**
## PeerConnection prototype reference
**/

function PeerConnection(config, opts) {
  if (! (this instanceof PeerConnection)) {
    return new PeerConnection(config, opts);
  }

  // inherited
  EventEmitter.call(this);

  // initialise constraints (use defaults if none provided)
  this.config = config || defaults.config;

  // set the tunnelId and targetId to null (no relationship)
  this.targetId = null;
  this.tunnelId = null;

  // flag as not stable
  this.stable = false;

  // create a _listeners object to hold listener function instances
  this._listeners = {};

  // initialise the opts
  this.opts = opts || {};

  // initialise default media constraints
  this.mediaConstraints = this.opts.mediaConstraints || {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    },

    optional: []
  };

  // initialise underlying W3C connection instance to null
  this._basecon = null;

  // create a defered requests array
  this._deferedRequests = [];

  // create a queued ice candidates array
  this._queuedCandidates = [];

  // if we have a channel defined in options, then initialise the channel
  this.channel = null;
  if (this.opts.channel) {
    this.setChannel(this.opts.channel);
  }
}

util.inherits(PeerConnection, EventEmitter);
module.exports = PeerConnection;

/**
### close()

Cleanup the peer connection.
**/
PeerConnection.prototype.close = function() {
  var basecon = this._basecon;

  // TODO: log a better way
  console.log('attempting to close underlying peer connection: ', basecon);

  // first close the underlying base connection if it exists
  if (basecon) {
    this._setBaseConnection(null);
    basecon.close();
  }

  // set the channel to null to remove event listeners
  this.setChannel(null);

  // emit the close event
  this.emit('close');
};

/**
### initiate(targetId, callback)

Initiate a connection to the specified target peer id.  Once the offer/accept
dance has been completed, then trigger the callback.  If we have been unable
to connect for any reason the callback will contain an error as the first
argument.
**/
PeerConnection.prototype.initiate = function(targetId, callback) {
  // if we have no channel to talk over then trigger the callback with an 
  // error condition
  if (! this.channel) {
    return callback(errorcodes.toError('REQCHAN'));
  }

  // reset the tunnelId
  this.callId = null;

  // save the target id
  this.targetId = targetId;

  // create a new browser peer connection instance
  this._setBaseConnection(new RTCPeerConnection(this.config, this.opts));

  // negotiate
  this.negotiate(callback);
};

/**
### negotiate
**/
PeerConnection.prototype.negotiate = function(callback) {
  var connection = this;

  // ensure we have a callback
  callback = callback || function() {};

  // once stable trigger the callback
  this.once('stable', callback);

  // if we have no local streams, then wait until we do and try again
  if (this._basecon.getLocalStreams().length === 0) { return; }

  // create a new offer
  this._basecon.createOffer(
    function(desc) {
      // set the local description of the instance
      connection._basecon.setLocalDescription(desc);

      // send a negotiate command to the signalling server
      connection.channel.negotiate(
        connection.targetId,
        desc.sdp,
        connection.callId
      );
    },

    callback,
    this.mediaConstraints
  );
};

/**
### setChannel(channel)

Initialise the signalling channel that will be used to communicate
the actual RTCPeerConnection state to it's friend.
**/
PeerConnection.prototype.setChannel = function(channel) {
  // if no change then return
  if (this.channel === channel) { return; }

  // if we have an existing channel, then remove event listeners
  if (this.channel) {
    this.channel.removeListener('negotiate', this._listeners.negotiate);
    this.channel.removeListener('candidate', this._listeners.candidate);
  }

    // update the channel
  this.channel = channel;

  // if we have a new channel, then bind listeners
  if (channel) {
    channel.on(
      'negotiate',
      this._listeners.negotiate = this._handleRemoteUpdate.bind(this)
    );

    // handle ice candidate communications
    channel.on(
      'candidate',
      this._listeners.candidate = this._handleRemoteIceCandidate.bind(this)
    );
  }
};

/**
### _setBaseConnection()

Used to update the underlying base connection.
**/
PeerConnection.prototype._setBaseConnection = function(value) {
  // if the same, then abort
  if (this._basecon === value) { return; }

  // if we have an existing base connection, remove event listeners
  if (this._basecon) {
    this._basecon.onsignalingstatechange = null;
    this._basecon.oniceconnectionstatechange = null;

    this._basecon.onicecandidate = null;
    this._basecon.onaddstream = null;
    this._basecon.onremovestream = null;
    this._basecon.onnegotiationneeded = null;
  }

  // update the base connection
  this._basecon = value;

  if (value) {
    // attach event listeners for state changes
    value.onsignalingstatechange =
    value.oniceconnectionstatechange = this._handleStateChange.bind(this);

    value.onicecandidate = this._handleIceCandidate.bind(this);
    value.onaddstream = this._handleRemoteAdd.bind(this);
    value.onremovestream = this._handleRemoteRemove.bind(this);
    value.onnegotiationneeded = this._handleNegotiationNeeded.bind(this);

    // update the stable flag
    this.stable = this.signalingState === 'stable';
  }

  return value;
};

/**
### _handleICECandidate()
**/
PeerConnection.prototype._handleIceCandidate = function(evt) {
  if (evt.candidate) {
    // console.log('received ice candidate: ' + evt.candidate.candidate);
    this.channel.send(
      '/to',
      this.targetId, 'candidate', evt.candidate.candidate
    );
  }
};

/**
### _handleNegotiationNeeded

Trigger when the peer connection and it's remote counterpart need to 
renegotiate due to streams being added, removed, etc.
**/
PeerConnection.prototype._handleNegotiationNeeded = function() {
  // wait for stable and then create the new offer
  console.log('!!! anyone else want to negotiate?');

  if (this.signalingState === 'stable') {
    this.negotiate();
  }
  else {
    this.once('stable', this.negotiate.bind(this));
  }
};

/**
### _handleRemoteAdd()
**/
PeerConnection.prototype._handleRemoteAdd = function(evt) {
  if (evt.stream) {
    return this.emit('stream:add', evt.stream);
  }
};

/**
### _handleRemoteUpdate

This method responds to updates in the remote RTCPeerConnection updating
it's local session description and sending that via the signalling channel.
**/
PeerConnection.prototype._handleRemoteUpdate = function(sdp, callId, type) {
  var connection = this;

  console.log('received remote update, callid: ' + callId +
    ', local call id: ' + this.callId + ', type: ' + type);

  // if we have a callid and this is not a match, then abort
  if (this.callId && this.callId !== callId) { return; }
  console.log('processing remote update');

  // if we have a callid provided, and no local call id update
  this.callId = this.callId || callId;

  // if we don't have a base connection, then create it
  if (! this._basecon) {
    // create a new browser peer connection instance
    this._setBaseConnection(new RTCPeerConnection(this.config, this.opts));
  }

  // update the remote session description
  // set the remote description
  this._basecon.setRemoteDescription(new RTCSessionDescription({
    type: type || 'offer',
    sdp: sdp
  }));

  // if we received an offer, we need to answer
  if (this._basecon.remoteDescription && type === 'offer') {
    // update the call id
    this.callId = callId;

    this._basecon.createAnswer(
      function(desc) {
        connection._basecon.setLocalDescription(desc);

        // send a negotiate command to the signalling server
        connection.channel.negotiate(
          connection.targetId,
          desc.sdp,
          connection.callId,
          'answer'
        );
      },

      function(err) {
        connection.emit('error', err);
      }
    );
  }

  // apply any remote ice candidates
  this._queuedCandidates.splice(0).forEach(this._handleIceCandidate.bind(this));
};

/**
### _handleRemoteIceCandidate(candidate)

This event is triggered in response to receiving a candidate from its
peer connection via the signalling channel.  Once ice candidates have been 
received and synchronized we are able to properly establish the communication 
between two peer connections.
**/
PeerConnection.prototype._handleRemoteIceCandidate = function(sdp) {
  var haveRemoteDesc = this._basecon && this._basecon.remoteDescription;

  // if we have no remote description for the base connection
  // then queue the ice candidate
  if (! haveRemoteDesc) {
    return this._queuedCandidates.push(sdp);
  }

  try {
    this._basecon.addIceCandidate(new RTCIceCandidate({ candidate: sdp }));
  }
  catch (e) {
    console.error('invalidate ice candidate: ' + sdp);
    console.error(e);
  }
};

/**
### _handleRemoteRemove()
**/
PeerConnection.prototype._handleRemoteRemove = function() {
  console.log('remote stream removed', arguments);
};

/**
### _handleStateChange(evt)

This is a generate state change handler that will inspect the various states
of the peer connection and make a determination on whether the connection is
ready for use.  In the event that the connection is ready, it will trigger
a `ready` event.
**/
PeerConnection.prototype._handleStateChange = function() {
  console.log(
    'checking peer connection state',
    this.signalingState,
    this._basecon.iceGatheringState
  );

  if (! this.stable && this.signalingState === 'stable') {
    this.stable = true;
    this.emit('stable');
  }
  else if (this.stable) {
    this.stable = false;
  }
};

/* RTCPeerConnection passthroughs */

PASSTHROUGH_METHODS.forEach(function(method) {
  PeerConnection.prototype[method] = function() {
    if (this._basecon) {
      return this._basecon[method].apply(this._basecon, arguments);
    }
  };
});

PASSTHROUGH_ATTRIBUTES.forEach(function(getter) {
  Object.defineProperty(PeerConnection.prototype, getter, {
    get: function() {
      return this._basecon && this._basecon[getter];
    }
  });
});

// inject a xp signalling state attribute
Object.defineProperty(PeerConnection.prototype, 'signalingState', {
  get: function() {
    var state = this._basecon &&
          (this._basecon.signalingState || this._basecon.readyState);

    // apply a state mapping if one exists
    if (state) {
      state = STATE_MAPPINGS[state] || state;
    }

    return state;
  }
});

PASSTHROUGH_EVENTS.forEach(function(eventName) {
  Object.defineProperty(PeerConnection.prototype, eventName, {
    set: function(handler) {
      if (this._basecon) {
        this._basecon[eventName] = handler;
      }
    }
  });
});
