/*jshint node:true*/

'use strict';

var automate = require('./automate');
var debug = require('rtc-core/debug')('signaller');
var RTCPeerConnection = require('rtc-core/detect')('RTCPeerConnection');
var EventEmitter = require('events').EventEmitter;
var pull = require('pull-stream');
var pushable = require('pull-pushable');
var util = require('util');

/**
  ## rtc/signaller

  The `rtc/signaller` package provides a simple interface for WebRTC 
  Signalling that is protocol independent.  Rather than tie the 
  implementation specifically to Websockets, XHR, etc. the signaller package
  allows you to implement signalling in your application and then `pipe` it 
  to the appropriate output interface.

  This in turn reduces the overall effort required to implement WebRTC
  signalling over different protocols and also means that your application
  code is able to include different underlying transports with relative ease.

  ## Getting Started (Client)

  ### Creating a Signaller and Associating a Transport

  The first thing you will need to do is to include the `rtc-signaller`
  package in your application, and provide it a channel name that it will use
  to communicate with its peers.

  ```js
  var signaller = require('rtc-signaller');
  var channel = signaller('channel-name');
  ```

  The next thing to do is to tell the signaller which transport it is
  going to be using:

  ```js
  channel.setTransport(require('rtc-signaller-ws')({ host: 'rtc.io' }));
  ```

  ### Handling Events

  At the point at which the transport is associated, the channel will attempt
  to connect. Once this connection is established, the signaller will become
  aware of other peers (if any) that are currently connected to the room:

  ```js
  // wait for ready event
  channel.once('ready', function() {
    console.log('connected to ' + channel.name);
  });
  ```

  In addition to the `ready` event, the channel will also trigger a
  `peer:discover` event to signal the discovery of a new peer in the channel:

  ```js
  channel.on('peer:discover', function(peer) {
    console.log('discovered a new peer in the channel');
  });
  ```

  ### Peers vs Peer Connections

  When working with WebRTC and signalling concepts, it's important to
  differentiate between peers and actual `RTCPeerConnection` instances.
  From a signalling perspective, a peer is someone (or something) out there
  that we can potentially connect with.

  It is completely reasonable to have 0..n `RTCPeerConnection` instances
  associated with each of the peers that we have knowledge of.

  ### Connecting to a Peer

  So once we know about other peers in the current channel, we should probably
  look at how we can start connecting with them.  To do this we need to start
  the offer-answer negotiation process.

  In an application where we want to automatically connect to every other
  known peer in the channel, we could implement code similar to that shown
  below:

  ```js
  channel.on('peer:discover', function(peer) {
    var connection = channel.connect(peer);

    // add a stream to the connection
    connection.addStream(media.stream);
  });
  ```

  In the example above, once a peer is discovered our application will
  automatically attempt to connect with the peer by creating an offer
  and then sending that offer using the signaller transport.

  Now in most circumstances using code like the sample above will result in
  two peers creating offers for each other and duplicating the connection
  requests.  In this situation, the signaller will coordinate the connection
  requests and make sure that peers find each other correctly.

  Once two peers have established a working connection, the channel
  will let you know:

  ```js
  channel.on('peer:connect', function(connection) {
  });
  ```
**/

/**
  ## Signaller prototype

  An instance of a Signaller prototype supports the following methods:
**/
function Signaller(opts) {
  if (! (this instanceof Signaller)) {
    return new Signaller(opts);
  }

  EventEmitter.call(this);

  // if opts is a string, then we have a channel name
  if (typeof opts == 'string' || (opts instanceof String)) {
    opts = {
      channel: opts
    };
  }

  // initialise the messages queue
  this._outboundMessages = pushable();

  // ensure we have an opts hash
  this.opts = opts = opts || {};

  // ensure we have a transport creator
  this.transport = opts.transport ||
    opts.transportCreator ||
    require('./transports/socket');

  // initialise members
  this.debug = opts.debug && typeof console.log == 'function';

  // initialise the channel name
  this.channel = '';

  // maintain a list of calls
  this.calls = {};

  // if the autoconnect option is not false, and we have a transport
  // connect on next tick
  if (typeof opts.autoConnect == 'undefined' || opts.autoConnect) {
    process.nextTick(this._autoConnect.bind(this, opts));
  }
}

util.inherits(Signaller, EventEmitter);
module.exports = Signaller;

/**
  ### connect(callback)
**/
Signaller.prototype.connect = function(callback) {
  var signaller = this;
  var proxy;

  // create a default callback
  // TODO: make the default callback useful
  callback = callback || function() {};

  // if we don't have a transport, return an error
  if (! this.transport) {
    return callback(new Error('A transport is required to connect'));
  }

  // when we receive the connect:ok event trigger the callback
  this.once('connect:ok', function(id) {
    // update the signaller id
    signaller.id = id;

    // trigger the callback
    callback(null, id);
  });

  // create the new peer proxy
  proxy = this.transport(this.opts);

  // pipe signaller messages to the peer proxy
  signaller.outbound().pipe(proxy.inbound());

  // listen for messages from the peer proxy and parse those messages
  proxy.outbound().pipe(signaller.inbound());

  // create a list of monitored connections
  this.connections = [];

  // watch for peer:leave events and check against our peers
  this.on('peer:leave', handlePeerLeave(this));
  this.on('peer:call', handleCall(this));
};

/**
  ### createConnection(cid, pid, cfg?, constraints?)

  The `createConnection` method of the signaller is will provide you an
  `RTCPeerConnection` instance that is connected to the signalling channel
  and set to automatically negotiate via the signalling channel.
**/
Signaller.prototype.createConnection = function(cid, pid, cfg, constraints) {

  function factory() {
    return new RTCPeerConnection(cfg, constraints);
  }

  // create the connection - if we have been provided a function as the
  // config, then this should replace the default factory
  return automate(typeof cfg == 'function' ? cfg() : factory(), {
    signaller: this,
    callId: cid,
    peerId: pid,
    config: typeof cfg == 'function' ? {} : cfg,
    constraints: constraints
  });
};

/**
  ### dial(targetId, callback)

  Make a connection to the specified target peer.  When the operation 
  completes (either succesfully, or in an error - usually just a busy error
  ) then the callback will be fired.

  ```js
  signaller.dial(
    'aa8787c6-1770-4f7d-90ab-64a75f3f8f2d',
    function(err, callId) {
    }
  );
  ```

**/
Signaller.prototype.dial = function(id, callback) {
  var signaller = this;
  var parts = ['dial', id];
  var evtFail = parts.concat('fail').join(':');
  var evtAnswer = parts.concat('answer').join(':');

  function handleDialFail(msg) {
    signaller.removeListener(evtAnswer, handleDialAnswer);

    // trigger the callback with the error condition
    callback(new Error(msg));
  }

  function handleDialAnswer(callId) {
    signaller.removeListener(evtFail, handleDialFail);

    // emit the peer:connect event at the signaller level
    signaller.emit('peer:connect', callId, id);

    // trigger the callback, passing the callId
    callback(null, callId);
  }

  // ensure we have a callback
  callback = callback || function() {};

  // send a dial message over the wire
  this.send('/dial', id);
  this.once(evtFail, handleDialFail);
  this.once(evtAnswer, handleDialAnswer);
};

/**
  ### inbound()

  Return a pull-stream sink for messages generated by the transport
**/
Signaller.prototype.inbound = function() {
  return pull.drain(createMessageParser(this));
};

/**
  ### join(name, callback)

  Send a join command to the signalling server, indicating that you would like 
  to join the current room.  In the current implementation of the rtc.io suite
  it is only possible for the signalling client to exist in one room at one
  particular time, so joining a new channel will automatically mean leaving the
  existing one if already joined.
**/
Signaller.prototype.join = function(name, callback) {
  var signaller = this;

  // handle the pre:join:ok handler and update the channel name
  this.once('pre:join:ok', function(newChannel) {
    signaller.channel = newChannel;
  });

  if (callback) {
    this.once('join:ok', callback);
  }

  return this.send('/join', name);
};

/**
  ### negotiate(targetId, sdp, callId, type)

  The negotiate function handles the process of sending an updated Session
  Description Protocol (SDP) description to the specified target signalling
  peer.  If this is an established connection, then a callId will be used to 
  ensure the sdp is deliver to the correct RTCPeerConnection instance
**/
Signaller.prototype.negotiate = function(targetId, sdp, callId, type) {
  debug('sending negotiate message, type: ' + type, sdp);
  return this.send('/negotiate', targetId, sdp, callId || '', type);
};

/**
  ### offerIntent(opts, callback)

  The offerIntent method is used to secure offer rights for an
  offer / answer handshake negotiation.
**/
Signaller.prototype.offerIntent = function(opts, callback) {
  var callId = opts && opts.callId;
  var signaller = this;

  function handleAccept(response) {
    signaller.removeListener('offer:reject', handleReject);
    debug('received offer response for call ' + callId + ': ', response);

    callback();
  }

  function handleReject() {
    signaller.removeListener('offer:accept', handleAccept);
    debug('received rejection');
    callback(new Error('received rejection'));
  }

  // if we don't have a callid, then abort
  if (! callId) {
    return callback(new Error('Unable to offer intent, no callid'));
  }

  debug('sending offer intent for call: ' + callId);
  this.once('offer:accept', handleAccept);
  this.once('offer:reject', handleReject);

  return this.send('/offer', callId);
};

/**
  ### outbound()

  Return a pull-stream source that can write messages to a transport
**/
Signaller.prototype.outbound = function() {
  return this._outboundMessages;
};

/**
  ### send(data)

  Send data across the line
**/
Signaller.prototype.send = function() {
  // get the args and jsonify as required
  var data = [].slice.call(arguments).map(function(arg) {
    return typeof arg == 'object' ? JSON.stringify(arg) : arg;
  }).join('|');

  if (this.debug) {
    console.log('--> ' + data);
  }

  this._outboundMessages.push(data);

  // chainable
  return this;
};

/**
  ### sendConfig(callId, data)

  Send the config of the current target for the specified call across the
  wire.
**/
Signaller.prototype.sendConfig = function(callId, data) {
  this.send('/config', callId, data);
};

/* internals */

/**
  ### _autoConnect(opts)
**/
Signaller.prototype._autoConnect = function(opts) {
  // if we have no transport, abort
  if (! this.transport) { return; }

  // connect
  this.connect();

  // if a channel has been specified, then update the channel name
  if (opts.channel) {
    this.join(opts.channel);
  }
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

/**
  ## Helper Functions (Not Exported)
**/

/**
  ### createMessageParser(signaller)

  This is used to create a function handler that will operate more quickly that 
  when using bind.  The parser will pull apart a message into parts (splitting 
  on the pipe character), parsing those parts where appropriate and then
  triggering the relevant event.
**/
function createMessageParser(signaller) {
  return function(data) {
    var parts = (data || '').split('|');
    var evtName = (parts[0] || '').toLowerCase();
    var args = parts.slice(1).map(function(arg) {
      // if it looks like JSON then parse it
      return ['{', '['].indexOf(arg.charAt(0)) >= 0 ?JSON.parse(arg) : arg;
    });

    if (signaller.debug) {
      console.log('<-- ' + data);
    }

    // trigger the event
    if (evtName) {
      // trigger the message pre-processor
      signaller.emit.apply(signaller, ['pre:' + evtName].concat(args));

      // trigger the main processor
      if (! signaller.emit.apply(signaller, [evtName].concat(args))) {
        // if not handled by a specific message parser then emit
        // as a raw message for something else to handle (potentially)
        signaller.emit('message', data);
      }

      // TODO: emit a data message for the 
    }
  };
}

/* internal events handlers */

function handleCall(signaller) {
  return function(peerId, callId) {
    // TODO: check to see if the signaller has listeners for the "acceptcall"
    // event, if so, trigger it

    // send the answer event
    signaller.send('/answer', peerId, callId);

    // emit the peer:connect event
    signaller.emit(
      'peer:connect',
      callId,
      peerId
    );
  };
}

/*
### handlePeerLeave

A peer:leave event has been broadcast through the signalling channel.  We need
to check if the peer that has left is connected to any of our connections. If
it is, then those connections should be closed.
*/
function handlePeerLeave(signaller) {
  return function(peerId) {
    debug('received peer leave event for peer: ' + peerId);

    // remove any dead connections
    signaller.connections = signaller.connections.map(function(conn) {
      if (conn && conn.targetId === peerId) {
        return conn.close();
      }

      return conn;
    }).filter(Boolean);
  };
}
