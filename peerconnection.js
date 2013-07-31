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

var debug = require('rtc-core/debug')('peerconnection');
var defaults = require('./lib/defaults');
var generators = require('./lib/generators');
var handshakes = require('./lib/handshakes');
var state = require('./lib/state');
var Signaller = require('./signaller');
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
  'signalingState',
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

function PeerConnection(signaller, config) {
  if (! (this instanceof PeerConnection)) {
    return new PeerConnection(signaller, config);
  }

  // inherited
  EventEmitter.call(this);

  // if we have not been supplied a signaller, then oh, well
  if (! (signaller instanceof Signaller)) {
    config = signaller;
    signaller = null;
  }

  // initialise constraints (use defaults if none provided)
  this.config = config || defaults.config;

  // initialise the signaller
  this.signaller = signaller;

  // initialise the call id
  this.callId = this.config.callId;

  // flag as closed and stable
  this.open = false;
  this.stable = true;

  // create a _listeners object to hold listener function instances
  this._listeners = {};

  // parse flags from the config and inject into the peer connection
  this.flags = generators.parseFlags(config);

  // create a defered requests array
  this._deferedRequests = [];

  // create a queued ice candidates array
  this._queuedCandidates = [];

  // initialise underlying W3C connection instance
  this._createBaseConnection();

  // map event handlers
  this.on('signalingstatechange', handleStateChange(this));
  this.on('iceconnectionstatechange', handleStateChange(this));
  this.on('icecandidate', handleIceCandidate(this));
  this.on('negotiationneeded', handleNegotiationNeeded(this));

  // attach signaller handlers
  if (this.signaller) {
    this.signaller.on('config:' + this.callId, handleCallConfig(this));
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
  debug('attempting to close underlying peer connection: ', basecon);

  // first close the underlying base connection if it exists
  if (basecon) {
    this._setBaseConnection(null);
    basecon.close();
  }

  // emit the close event
  this.emit('close');
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

    // detect if open
    this.open = state.isActive(this._basecon);
  }

  return value;
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
  ### handleIceCandidate(connection)

  Return an event handler for responding to ice candidate changes
*/
function handleIceCandidate(connection) {
  return function(evt) {
    if (evt.candidate) {
      connection.emit('candidate', evt.candidate);

      // if we have a channel, send to the channel
      if (connection.signaller) {
        connection.signaller.sendConfig(connection.callId, evt.candidate);
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
    if (connection.signaller) {
      debug('negotiation needed');
      if (this.stable) {
        handshakes.offer(connection.signaller, connection);
      }
      else {
        this.once('stable', function() {
          handshakes.offer(connection.signaller, connection);
        });
      }
    }
  };
};

/*
  ### handleStateChange(connection)

  Return an event handler for dealing with peer connection state changes.
*/
function handleStateChange(connection) {
  return function(evt) {
    var isStable = connection._basecon.signalingState === 'stable';
    var isActive = state.isActive(connection._basecon);

    if (connection.stable !== isStable) {
      connection.stable = isStable;
      connection.emit(isStable ? 'stable' : 'unstable');
    }

    if (connection.open !== isActive) {
      connection.open = isActive;
      connection.emit(isActive ? 'open' : 'close');
    }
  };
}

/*
  ### handleCallConfig(connection)

  Handle data updates for the call
*/
function handleCallConfig(connection) {
  return function(data) {
    // if we have received sdp, then process 
    if (data.sdp) {
      connection._basecon.setRemoteDescription(
        new RTCSessionDescription(data),

        function() {
          // apply the queued candidates
          connection._queuedCandidates.splice(0).map(function(c) {
            connection._basecon.addIceCandidate(new RTCIceCandidate(c));
          });

          if (! connection.stable) {
            handshakes.answer(connection.signaller, connection);
          }
        },

        function(err) {
          debug('unable to set remote description', err);
        }
      );
    }
    else if (data.candidate) {
      if (! connection._basecon.remoteDescription) {
        connection._queuedCandidates.push(data);
      }
      else {
        connection._basecon.addIceCandidate(new RTCIceCandidate(data));
      }
    }
  };
}