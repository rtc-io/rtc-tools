# rtc

The `rtc` package is a convenience layer for working with the rtc.io toolkit.
Consider it a boxed set of lego of the most common pieces required to build
the front-end component of a WebRTC application.

## Getting Started

TO BE COMPLETED

## rtc/automate

This is an automation module for dealing with peer connections, based on
some general approaches that tend to work well when dealing with 
an `RTCPeerConnection` object.

The generate approach of the automate object is as follows:

- Implement a reactive approach, i.e. the `createOffer`, `createAnswer`
  dance is completed in response to connections triggering the 
  `onnegotiationneeded` event.

### automate.offer(pc, opts)

### automate.answer(pc, opts)

## rtc/detect

Provide the [rtc-core/detect](https://github.com/rtc-io/rtc-core#detect) 
functionality.

## rtc/media

Provide the core [rtc-media](https://github.com/rtc-io/rtc-media) for
convenience.

## rtc/peerconnection

The `rtc/peerconnection` module provides an `RTCPeerConnection` proxy 
prototype.  All of the core W3C `RTCPeerConnection` methods and attributes
are available on created `PeerConnection` instances, but also some 
helper methods that are outlined in the reference documentation below.

```js
var PeerConnection = require('rtc/peerconnection');
var conn = new PeerConnection();
```

### PeerConnection prototype reference

### close()

Cleanup the peer connection.

### _createBaseConnection()

This will create a new base RTCPeerConnection object based
on the currently configuration and media constraints.

### _setBaseConnection()

Used to update the underlying base connection.

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

## Signaller prototype

An instance of a Signaller prototype supports the following methods:

### connect(callback)

### createConnection(cid, pid, cfg?, constraints?)

The `createConnection` method of the signaller is will provide you an
`RTCPeerConnection` instance that is connected to the signalling channel
and set to automatically negotiate via the signalling channel.

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

### inbound()

Return a pull-stream sink for messages generated by the transport

### join(name, callback)

Send a join command to the signalling server, indicating that you would like 
to join the current room.  In the current implementation of the rtc.io suite
it is only possible for the signalling client to exist in one room at one
particular time, so joining a new channel will automatically mean leaving the
existing one if already joined.

### negotiate(targetId, sdp, callId, type)

The negotiate function handles the process of sending an updated Session
Description Protocol (SDP) description to the specified target signalling
peer.  If this is an established connection, then a callId will be used to 
ensure the sdp is deliver to the correct RTCPeerConnection instance

### outbound()

Return a pull-stream source that can write messages to a transport

### send(data)

Send data across the line

### sendConfig(callId, data)

Send the config of the current target for the specified call across the
wire.

### _autoConnect(opts)

## Signaller factory methods (for sugar)

### Signaller.create(opts)

Create a new Signaller instance

### Signaller.join(name)

Create a new signaller instance, and join the specified channel

## Helper Functions (Not Exported)

### createMessageParser(signaller)

This is used to create a function handler that will operate more quickly that 
when using bind.  The parser will pull apart a message into parts (splitting 
on the pipe character), parsing those parts where appropriate and then
triggering the relevant event.

## Internal RTC Helper Libraries

The RTC library uses a number of helper modules that are contained within
the `lib/` folder of the `rtc-io/rtc` repository.  While these are designed
primarily for internal use, they can be accessed by directly requiring
the modules, e.g. `require('rtc/lib/helpermodule')`

## rtc/lib/couple

This is a utility module that is not included in the rtc suite by 
default, but can be included using the following require statement:

```js
var couple = require('rtc/lib/couple');
```

It is primarily used in local testing routines to bind two local
peer connection together, e.g.:

```js
var couple = require('rtc/lib/couple');
var PeerConnection = require('rtc/peerconnection');
var a = new PeerConnection();
var b = new PeerConnection();

// couple the two connections together
couple(peerA, peerB, function(err) {
// if no err, then a and b have been coupled successfully
);
```

## rtc/lib/generators

The generators package provides some utility methods for generating
constraint objects and similar constructs.  Primarily internal use.

```js
var generators = require('rtc/lib/generators');
```

### generators.config(config)

Generate a configuration object suitable for passing into an W3C 
RTCPeerConnection constructor first argument, based on our custom config.

### generators.mediaConstraints(flags, context)

Generate mediaConstraints appropriate for the context in which they are 
being called (i.e. either constructing an RTCPeerConnection object, or
on the `createOffer` or `createAnswer` calls).

### parseFlags(opts)

This is a helper function that will extract known flags from a generic 
options object.

## rtc/lib/handshakes

This is an internal helper module that helps with applying the appropriate
handshake logic for a connection.

### handshakes.offer(signaller, connection)

Create an offer and send it over the wire.

### handshakes.answer(signaller, connection);

Create an answer and send it over the wire.

## rtc/lib/processors

This is an internal library of processor helpers that know what to do 
when a signaller receives generic `config` events for a particular call.
A processor is provided the local peer connection, a series of opts (
including the signaller) and the data that was sent across the wire.

### candidate(pc, opts, data)

Process an ice candidate being supplied from the other side of the world.

### sdp(pc, opts, data)

## rtc/lib/state

The state module is provides some helper functions for determining
peer connection state and stability based on the various different 
states that can occur in W3C RTCPeerConnections across browser versions.

```js
var state = require('rtc/lib/state');
```

### state.get(pc)

Provides a unified state definition for the RTCPeerConnection based
on a few checks.

In emerging versions of the spec we have various properties such as
`readyState` that provide a definitive answer on the state of the 
connection.  In older versions we need to look at things like
`signalingState` and `iceGatheringState` to make an educated guess 
as to the connection state.

### state.isActive(connection)

Determine whether the connection is active or not

### inbound()

The inbound function creates a pull-stream sink that will accept the 
outbound messages from the signaller and route them to the server.

### outbound()

The outbound function creates a pull-stream source that will be fed into 
the signaller input.  The source will be populated as messages are received
from the websocket and closed if the websocket connection is closed.
