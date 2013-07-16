# rtc

The `rtc` package is a convenience layer for working with the rtc.io toolkit.
Consider it a boxed set of lego of the most common pieces required to build
the front-end component of a WebRTC application.

## Getting Started

# rtc/peerconnection

## PeerConnection prototype reference

### close()

Cleanup the peer connection.

### initiate(targetId, callback)

Initiate a connection to the specified target peer id.  Once the offer/accept
dance has been completed, then trigger the callback.  If we have been unable
to connect for any reason the callback will contain an error as the first
argument.

### negotiate

### setChannel(channel)

Initialise the signalling channel that will be used to communicate
the actual RTCPeerConnection state to it's friend.

### _setBaseConnection()

Used to update the underlying base connection.

### _handleICECandidate()

### _handleNegotiationNeeded

Trigger when the peer connection and it's remote counterpart need to 
renegotiate due to streams being added, removed, etc.

### _handleRemoteAdd()

### _handleRemoteUpdate

This method responds to updates in the remote RTCPeerConnection updating
it's local session description and sending that via the signalling channel.

### _handleRemoteIceCandidate(candidate)

This event is triggered in response to receiving a candidate from its
peer connection via the signalling channel.  Once ice candidates have been 
received and synchronized we are able to properly establish the communication 
between two peer connections.

### _handleRemoteRemove()

### _handleStateChange(evt)

This is a generate state change handler that will inspect the various states
of the peer connection and make a determination on whether the connection is
ready for use.  In the event that the connection is ready, it will trigger
a `ready` event.

# rtc/media

This is a convenience import of the `rtc-media` package into the `rtc`
package. For example, both of the following `require` statements return
equivalent modules:

```js
var media;

// use the rtc/media entry point
media = require('rtc/media');

// use rtc-media directly
media = require('rtc-media');
```

In most cases we would recommend importing `rtc` into your application and
using that.  In a case that you are writing a web application that does not
require the full WebRTC suite but only want to work with getUserMedia then
you may consider using `rtc-media` directly.

For the full rtc-media reference see:

<http://rtc.io/modules/media>

# rtc/signaller

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

# rtc/detect

A browser detection helper for accessing prefix-free versions of the various
WebRTC types. 

## Example Usage

If you wanted to get the native `RTCPeerConnection` prototype in any browser
you could do the following:

```js
var detect = require('rtc/detect');
var RTCPeerConnection = detect('RTCPeerConnection');
```

This would provide whatever the browser prefixed version of the
RTCPeerConnection is available (`webkitRTCPeerConnection`, 
`mozRTCPeerConnection`, etc).
