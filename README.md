# rtc

The `rtc` module does most of the heavy lifting within the
[rtc.io](http://rtc.io) suite.  Primarily it handles the logic of coupling
a local `RTCPeerConnection` with it's remote counterpart via an
[rtc-signaller](https://github.com/rtc-io/rtc-signaller) signalling
channel.


[![NPM](https://nodei.co/npm/rtc.png)](https://nodei.co/npm/rtc/)

[![Build Status](https://img.shields.io/travis/rtc-io/rtc.svg?branch=master)](https://travis-ci.org/rtc-io/rtc)
![unstable](https://img.shields.io/badge/stability-unstable-yellowgreen.svg)

[![Gitter chat](https://badges.gitter.im/rtc-io/discuss.png)](https://gitter.im/rtc-io/discuss)


## Getting Started

If you decide that the `rtc` module is a better fit for you than either
[rtc-quickconnect](https://github.com/rtc-io/rtc-quickconnect) or
[rtc-glue](https://github.com/rtc-io/rtc-glue) then the code snippet below
will provide you a guide on how to get started using it in conjunction with
the [rtc-signaller](https://github.com/rtc-io/rtc-signaller) and
[rtc-media](https://github.com/rtc-io/rtc-media) modules:

```js
var signaller = require('rtc-signaller')('http://rtc.io/switchboard/');
var rtc = require('rtc');
var media = require('rtc-media');
var localMedia = media();

// render the local media to the document body
localMedia.render(document.body);

// capture local media first as firefox
// will want a local stream and doesn't support onnegotiationneeded event
localMedia.once('capture', function(localStream) {
  // look for friends
  signaller.on('peer:announce', function(data) {
    // create a peer connection for our new friend
    var pc = rtc.createConnection();

    // couple our connection via the signalling channel
    var monitor = rtc.couple(pc, data.id, signaller);

    // add the stream to the connection
    pc.addStream(localStream);

    // once the connection is active, log a console message
    monitor.once('connected', function() {
      console.log('connection active to: ' + data.id);
  
      pc.getRemoteStreams().forEach(function(stream) {
        media(stream).render(document.body);
      });
    });


    monitor.createOffer();
  });

  // announce ourself in the rtc-getting-started room
  signaller.announce({ room: 'rtc-getting-started' });
});


```

This code definitely doesn't cover all the cases that you need to consider
(i.e. peers leaving, etc) but it should demonstrate how to:

1. Capture video and add it to a peer connection
2. Couple a local peer connection with a remote peer connection
3. Deal with the remote steam being discovered and how to render
   that to the local interface.

## Reference

### rtc.createConnection

```
createConnection(opts?, constraints?) => RTCPeerConnection
```

Create a new `RTCPeerConnection` auto generating default opts as required.

```js
var conn;

// this is ok
conn = rtc.createConnection();

// and so is this
conn = rtc.createConnection({
  iceServers: []
});
```

### rtc/cleanup

```
cleanup(pc)
```

The `cleanup` function is used to ensure that a peer connection is properly
closed and ready to be cleaned up by the browser.

### rtc/couple

#### couple(pc, targetId, signaller, opts?)

Couple a WebRTC connection with another webrtc connection identified by
`targetId` via the signaller.

The following options can be provided in the `opts` argument:

- `sdpfilter` (default: null)

  A simple function for filtering SDP as part of the peer
  connection handshake (see the Using Filters details below).

##### Example Usage

```js
var couple = require('rtc/couple');

couple(pc, '54879965-ce43-426e-a8ef-09ac1e39a16d', signaller);
```

##### Using Filters

In certain instances you may wish to modify the raw SDP that is provided
by the `createOffer` and `createAnswer` calls.  This can be done by passing
a `sdpfilter` function (or array) in the options.  For example:

```js
// run the sdp from through a local tweakSdp function.
couple(pc, '54879965-ce43-426e-a8ef-09ac1e39a16d', signaller, {
  sdpfilter: tweakSdp
});
```

### rtc/detect

Provide the [rtc-core/detect](https://github.com/rtc-io/rtc-core#detect) 
functionality.

### rtc/generators

The generators package provides some utility methods for generating
constraint objects and similar constructs.

```js
var generators = require('rtc/generators');
```

#### generators.config(config)

Generate a configuration object suitable for passing into an W3C
RTCPeerConnection constructor first argument, based on our custom config.

#### generators.connectionConstraints(flags, constraints)

This is a helper function that will generate appropriate connection
constraints for a new `RTCPeerConnection` object which is constructed
in the following way:

```js
var conn = new RTCPeerConnection(flags, constraints);
```

In most cases the constraints object can be left empty, but when creating
data channels some additional options are required.  This function
can generate those additional options and intelligently combine any
user defined constraints (in `constraints`) with shorthand flags that
might be passed while using the `rtc.createConnection` helper.

### rtc/monitor

```
monitor(pc, targetId, signaller, opts?) => EventEmitter
```

The monitor is a useful tool for determining the state of `pc` (an
`RTCPeerConnection`) instance in the context of your application. The
monitor uses both the `iceConnectionState` information of the peer
connection and also the various
[signaller events](https://github.com/rtc-io/rtc-signaller#signaller-events)
to determine when the connection has been `connected` and when it has
been `disconnected`.

A monitor created `EventEmitter` is returned as the result of a
[couple](https://github.com/rtc-io/rtc#rtccouple) between a local peer
connection and it's remote counterpart.

## License(s)

### Apache 2.0

Copyright 2014 National ICT Australia Limited (NICTA)

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
