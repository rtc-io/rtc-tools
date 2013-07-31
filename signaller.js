/* jshint node: true */

'use strict';

/**
  ## rtc/signaller

  The `rtc/signaller` provides a higher level signalling implementation than
  the pure [rtc-signaller](https://github.com/rtc-io/rtc-signaller) package.

  The signaller included in this packge provides some convenience methods for
  making connections with a peer given a typical rtc.io setup.  
**/

var debug = require('rtc-core/debug')('rtc/signaller');
var BaseSignaller = require('rtc-signaller');
var PeerConnection = require('./peerconnection');
var util = require('util');

/**
## Signaller prototype reference
**/

function Signaller(opts) {
  if (! (this instanceof Signaller)) {
    return new Signaller(opts);
  }

  // call inherited
  BaseSignaller.call(this, opts);

  // create a list of monitored connections
  this.connections = [];

  // watch for peer:leave events and check against our peers
  this.on('peer:leave', this._handlePeerLeave.bind(this));
}

util.inherits(Signaller, BaseSignaller);
module.exports = Signaller;

/**
### dial(targetId)

Connect to the specified target peer.  This method implements some helpful
connection management logic that will cater for the majority of use cases
for creating new peer connections.
**/
Signaller.prototype.dial = function(targetId) {
  var connection = new PeerConnection();

  connection.setChannel(this);
  connection.initiate(targetId, function(err) {
    debug('connection initiation phase complete');

    if (! err) {
      debug('connection initiated, call id: ' + connection.callId);
    }
    else {
      debug('encountered error: ', err);
    }
  });

  // add this connection to the monitored connections list
  this.connections.push(connection);

  return connection;
};

/**
### _handlePeerLeave

A peer:leave event has been broadcast through the signalling channel.  We need
to check if the peer that has left is connected to any of our connections. If
it is, then those connections should be closed.
**/
Signaller.prototype._handlePeerLeave = function(peerId) {
  // remove any dead connections
  this.connections = this.connections.map(function(conn) {
    if (conn && conn.targetId === peerId) {
      return conn.close();
    }

    return conn;
  }).filter(Boolean);
};

/**
## Signaller factory methods (for sugar)
**/

/**
### Signaller.create(opts)

Create a new Signaller instance
**/
Signaller.create = function(opts) {
  return new Signaller(opts);
};

/**
### Signaller.join(name)

Create a new signaller instance, and join the specified channel
**/
Signaller.join = function(name) {
  return new Signaller().join(name);
};