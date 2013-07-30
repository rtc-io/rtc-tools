# rtc

The `rtc` package is a convenience layer for working with the rtc.io toolkit.
Consider it a boxed set of lego of the most common pieces required to build
the front-end component of a WebRTC application.

## Getting Started

TO BE COMPLETED

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

### initiate(targetId, callback)

Initiate a connection to the specified target peer id.  Once the 
offer/accept dance has been completed, then trigger the callback.  If we
have been unable to connect for any reason the callback will contain an
error as the first argument.

### negotiate

### setChannel(channel)

Initialise the signalling channel that will be used to communicate
the actual RTCPeerConnection state to it's friend.

### PeerConnection Data Channel Helper Methods

The PeerConnection wrapper provides some methods that make working
with data channels simpler a simpler affair.

### createReader(channelName?)

Calling this method will create a
[pull-stream](https://github.com/dominictarr/pull-stream) source for
the data channel attached to the peer connection.  If a data channel
has not already been configured for the connection, then it will 
be created if the peer connection is in a state that will allow that
to happen.

### createWriter(channelName?)

Create a new [pull-stream](https://github.com/dominictarr/pull-stream)
sink for data that should be sent to the peer connection.  Like the
`createReader` function if a suitable data channel has not be created
then calling this method will initiate that behaviour.

### _autoNegotiate()

Instruct the PeerConnection to call it's own `negotiate` method whenever
it emit's a `negotiate` event.

Can be disabled by calling `connection._autoNegotiate(false)`

### _createBaseConnection()

This will create a new base RTCPeerConnection object based
on the currently configuration and media constraints.

### _setBaseConnection()

Used to update the underlying base connection.

### _handleRemoteUpdate

This method responds to updates in the remote RTCPeerConnection updating
it's local session description and sending that via the signalling channel.

### _handleRemoteIceCandidate(candidate)

This event is triggered in response to receiving a candidate from its
peer connection via the signalling channel.  Once ice candidates have been 
received and synchronized we are able to properly establish the 
communication between two peer connections.

## rtc/signaller

The `rtc/signaller` provides a higher level signalling implementation than
the pure [rtc-signaller](https://github.com/rtc-io/rtc-signaller) package.

The signaller included in this packge provides some convenience methods for
making connections with a peer given a typical rtc.io setup.

## Signaller prototype reference

### dial(targetId)

Connect to the specified target peer.  This method implements some helpful
connection management logic that will cater for the majority of use cases
for creating new peer connections.

### _handlePeerLeave

A peer:leave event has been broadcast through the signalling channel.  We need
to check if the peer that has left is connected to any of our connections. If
it is, then those connections should be closed.

## Signaller factory methods (for sugar)

### Signaller.create(opts)

Create a new Signaller instance

### Signaller.join(name)

Create a new signaller instance, and join the specified channel

## Internal RTC Helper Libraries

The RTC library uses a number of helper modules that are contained within
the `lib/` folder of the `rtc-io/rtc` repository.  While these are designed
primarily for internal use, they can be accessed by directly requiring
the modules, e.g. `require('rtc/lib/helpermodule')`

## rtc/couple

This is a utility module that is not included in the rtc suite by 
default, but can be included using the following require statement:

```js
var couple = require('rtc/couple');
```

It is primarily used in local testing routines to bind two local
peer connection together, e.g.:

```js
var couple = require('rtc/couple');
var PeerConnection = require('rtc/peerconnection');
var a = new PeerConnection();
var b = new PeerConnection();

// couple the two connections together
couple(peerA, peerB, function(err) {
// if no err, then a and b have been coupled successfully
);
```

## rtc/generators

The generators package provides some utility methods for generating
constraint objects and similar constructs.  Primarily internal use.

```js
var generators = require('rtc/generators');
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
