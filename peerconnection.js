/* jshint node: true */
/* global RTCIceCandidate: false */

/**
  ## rtc/peerconnection

  The `rtc/peerconnection` module provides an `RTCPeerConnection` proxy 
  prototype.  All of the core W3C `RTCPeerConnection` methods and attributes
  are available on created `PeerConnection` instances, but also some 
  helper methods that are outlined in the reference documentation below.

  ```js
  var PeerConnection = require('rtc/peerconnection');
  var conn = new PeerConnection();
  ```
**/

'use strict';

var defaults = require('./lib/defaults');
var generators = require('./lib/generators');
var EventEmitter = require('events').EventEmitter;
var RTCPeerConnection = require('./detect')('RTCPeerConnection');
var RTCSessionDescription = require('./detect')('RTCSessionDescription');
var errorcodes = require('rtc-core/errorcodes');
var util = require('util');
var pull = require('pull-stream');

// passthrough methods, attributes and events
// http://dev.w3.org/2011/webrtc/editor/webrtc.html#rtcpeerconnection-interface
var PASSTHROUGH_METHODS = [
  // not yet stable, but including
  'createDataChannel',

  // stable? methods
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
  'removeStream',
  // 'close', -- don't include close as we need to do some custom stuff

  // add event listener passthroughs
  // NOTE: not implemented in moz so have to fudge it outselves
  'addEventListener',
  'removeEventListener'
];


var PASSTHROUGH_ATTRIBUTES = [
  'localDescription',
  'remoteDescription',
  // 'signalingState', --> create a cross-platform compatible attribute
  'iceGatheringState',
  'iceConnectionState'
];

var EMITTED_EVENTS = [
  'negotiationneeded',
  'icecandidate',
  'signalingstatechange',
  'addstream',
  'removestream',
  'iceconnectionstatechange',
  'datachannel'
];

/*
var PASSTHROUGH_EVENTS = [
  'onnegotiationneeded',
  'onicecandidate',
  'onsignalingstatechange',
  'onaddstream',
  'onremovestream',
  'oniceconnectionstatechange',
  'ondatachannel'
];
*/

var STATE_MAPPINGS = {
  active: 'stable'
};

/**
  ### PeerConnection prototype reference
**/

function PeerConnection(config) {
  if (! (this instanceof PeerConnection)) {
    return new PeerConnection(config, mediaConstraints);
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

  // parse flags from the config and inject into the peer connection
  this.flags = generators.parseFlags(config);

  // initialise underlying W3C connection instance to null
  this._basecon = null;

  // create a defered requests array
  this._deferedRequests = [];

  // create a queued ice candidates array
  this._queuedCandidates = [];

  // if we have a channel defined in options, then initialise the channel
  this.channel = null;
  if (this.config.channel) {
    this.setChannel(this.config.channel);
  }

  // map event handlers
  this.on('signalingstatechange', handleStateChange(this));
  this.on('iceconnectionstatechange', handleStateChange(this));
  this.on('icecandidate', handleIceCandidate(this));
  this.on('addstream', handleAddStream(this));
  this.on('remvestream', handleRemoveStream(this));
  this.on('negotiationneeded', handleNegotiationNeeded(this));

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
  // console.log('attempting to close underlying peer connection: ', basecon);

  // first close the underlying base connection if it exists
  if (basecon) {
    this._setBaseConnection(null);
    basecon.close();
  }

  // emit the close event
  this.emit('close');

  // set the channel to null to remove event listeners
  this.setChannel(null);
};

/**
  ### initiate(targetId, callback)

  Initiate a connection to the specified target peer id.  Once the 
  offer/accept dance has been completed, then trigger the callback.  If we
  have been unable to connect for any reason the callback will contain an
  error as the first argument.
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
  this._createBaseConnection();

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

    // create the media constraints for the create offer context
    generators.mediaConstraints(connection.flags, 'offer')
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
    // initialise auto-negotiation
    this._autoNegotiate();

    // handle channel negotiation
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
  ### PeerConnection Data Channel Helper Methods

  The PeerConnection wrapper provides some methods that make working
  with data channels simpler a simpler affair.
**/

/**
### createReader(channelName?)

Calling this method will create a
[pull-stream](https://github.com/dominictarr/pull-stream) source for
the data channel attached to the peer connection.  If a data channel
has not already been configured for the connection, then it will 
be created if the peer connection is in a state that will allow that
to happen.
**/
PeerConnection.prototype.createReader = pull.Source(function(channelName) {
  // ensure we have a channel name
  channelName = channelName || 'default';

  // open the channel
  console.log(this);

  // wait for requests
  return function(end, cb) {
    if (end) {
      return cb();
    }
  };
});

/**
### createWriter(channelName?)

Create a new [pull-stream](https://github.com/dominictarr/pull-stream)
sink for data that should be sent to the peer connection.  Like the
`createReader` function if a suitable data channel has not be created
then calling this method will initiate that behaviour.
**/
PeerConnection.prototype.createWriter = pull.Sink(function(read, channelName, done) {
  if (typeof channelName == 'function') {
    done = channelName;
    channelName = 'default';
  }

  // ensure we have a channelName
  channelName = channelName || 'default';

  // create the channel

  // read from upstream
  read(null, function next(end, data) {
    if (end) {
      return;
    }

    // TODO: write the data to the data channel
    read(null, next);
  });
});

/**
  ### _autoNegotiate()

  Instruct the PeerConnection to call it's own `negotiate` method whenever
  it emit's a `negotiate` event.

  Can be disabled by calling `connection._autoNegotiate(false)`
**/
PeerConnection.prototype._autoNegotiate = function(enabled) {
  // unbind previous event handler
  if (this._listeners.autoneg) {
    this.removeListener('negotiate', this._listeners.autoneg);
    this._listeners.autoneg = undefined;
  }

  if (typeof enabled == 'undefined' || enabled) {
    this.on('negotiate', this._listeners.autoneg = this.negotiate.bind(this));
  }
};

/**
  ### _createBaseConnection()

  This will create a new base RTCPeerConnection object based
  on the currently configuration and media constraints.
**/
PeerConnection.prototype._createBaseConnection = function() {
  return this._setBaseConnection(new RTCPeerConnection(
    generators.config(this.config),
    generators.mediaConstraints(this.flags, 'create')
  ));
};

/**
  ### _setBaseConnection()

  Used to update the underlying base connection.
**/
PeerConnection.prototype._setBaseConnection = function(value) {
  var conn = this;

  // if the same, then abort
  if (this._basecon === value) { return; }

  // if we have an existing base connection, remove event listeners
  if (this._basecon) {
    // clear mapped listeners
    EMITTED_EVENTS.map(function(evtName) {
      conn._basecon['on' + evtName] = null;
    });
  }

  // update the base connection
  this._basecon = value;

  if (value) {
    // attach event listeners for pass through
    EMITTED_EVENTS.map(function(evtName) {
      value['on' + evtName] = conn.emit.bind(conn, evtName);
    });

    // update the stable flag
    this.stable = this.signalingState === 'stable';
  }

  return value;
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

  // update the remote session description
  // set the remote description
  this.setRemoteDescription(new RTCSessionDescription({
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
  this._queuedCandidates.splice(0).forEach(handleIceCandidate(this));
};

/**
  ### _handleRemoteIceCandidate(candidate)

  This event is triggered in response to receiving a candidate from its
  peer connection via the signalling channel.  Once ice candidates have been 
  received and synchronized we are able to properly establish the 
  communication between two peer connections.
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

/* RTCPeerConnection passthroughs */

PASSTHROUGH_METHODS.forEach(function(method) {
  PeerConnection.prototype[method] = function() {
    // if we don't already have a base connection, then create it
    var baseCon = this._basecon || this._createBaseConnection();

    return this._basecon[method].apply(this._basecon, arguments);
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

/*
PASSTHROUGH_EVENTS.forEach(function(eventName) {
  Object.defineProperty(PeerConnection.prototype, eventName, {
    set: function(handler) {
      if (this._basecon) {
        this._basecon[eventName] = handler;
      }
    }
  });
});
*/

/* event handler helpers */

/*
  ### handleAddStream(connection)
*/
function handleAddStream(connection) {
  return function(evt) {
    if (evt.stream) {
      return connection.emit('stream:add', evt.stream);
    }
  };
}

/*
  ### handleRemoveStream(connection)
*/
function handleRemoveStream(connection) {
  return function(evt) {
    console.log('remote stream removed', arguments);
  };
}

/*
  ### handleIceCandidate(connection)

  Return an event handler for responding to ice candidate changes
*/
function handleIceCandidate(connection) {
  return function(evt) {
    if (evt.candidate) {
      connection.emit('candidate', evt.candidate);

      // if we have a channel, send to the channel
      if (connection.channel) {
        connection.channel.send(
          '/to',
          connection.targetId, 'candidate', evt.candidate.candidate
        );
      }
    }
  };
}

/*
  ### handleNegotiationNeeded(connection)

  Trigger when the peer connection and it's remote counterpart need to 
  renegotiate due to streams being added, removed, etc.
*/
function handleNegotiationNeeded(connection) {
  return function(evt) {
    connection.emit('negotiate');

    /*
    if (this.signalingState === 'stable') {
      this.emit('negotiate');
    }
    else {
      this.once('stable', this.emit.bind(this, 'negotiate'));
    }
    */
  };
};

/*
  ### handleStateChange(connection)

  Return an event handler for dealing with peer connection state changes.
*/
function handleStateChange(connection) {
  return function(evt) {
    var isStable = connection.signalingState === 'stable' &&
      connection._basecon.iceGatheringState === 'complete';

    console.log(
      'checking peer connection state, isStable = ' + isStable,
      connection.signalingState,
      connection._basecon.iceGatheringState
    );

    if (connection.stable !== isStable) {
      connection.stable = isStable;
      connection.emit(isStable ? 'stable' : 'unstable');
    }
  };
}