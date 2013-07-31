/* jshint node: true */
/* global WebSocket: false */

'use strict';

var pull = require('pull-stream');
var pushable = require('pull-pushable');
var reTrailingSlash = /^(.*)\/?$/;

/**
  ## WebSocketPeerProxy prototype
*/

function WebSocketPeerProxy(opts) {
  var host;

  if (! (this instanceof WebSocketPeerProxy)) {
    return new WebSocketPeerProxy(opts);
  }

  // cleanup the host
  host = (opts && opts.host || 'http://rtc.io/')
    .replace(reTrailingSlash, '$1/rtc-signaller')
    .replace(/^http/, 'ws');

  // create the websocket connection
  this.socket = new WebSocket(host);
}

module.exports = WebSocketPeerProxy;

/**
  ### inbound()

  The inbound function creates a pull-stream sink that will accept the 
  outbound messages from the signaller and route them to the server.
**/
WebSocketPeerProxy.prototype.inbound = function() {
  var socket = this.socket;
  var sink = pull.Sink(function(read) {
    socket.addEventListener('open', function() {
      read(null, function next(end, data) {
        if (end) {
          return false;
        }

        if (socket.readyState !== WebSocket.OPEN) {
          return false;
        }

        socket.send(data);
        read(null, next);
      });
    });
  });

  return sink();
};

/**
  ### outbound()

  The outbound function creates a pull-stream source that will be fed into 
  the signaller input.  The source will be populated as messages are received
  from the websocket and closed if the websocket connection is closed.
**/
WebSocketPeerProxy.prototype.outbound = function() {
  var messages = pushable();

  this.socket.addEventListener('message', function(evt) {
    messages.push(evt.data);
  });

  this.socket.addEventListener('close', function() {
    messages.end();
  });

  return messages;
};