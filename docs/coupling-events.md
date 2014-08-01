## Events Communicated through Connection Coupling

The following is a list of events that are emitted by the connection monitor to assist with debugging what is occuring during p2p connection negotiation.

- `negotiate:abort` => `f(stage, sdp?)`

  The `negotiate:abort` event is triggered if the connection negotiation fails for any particular reason.  The `stage` will either be `createOffer` or `createAnswer` depending on the role a peer is playing in the connection negotiation.

- `negotiate:createOffer` => `f()`

  Triggered immediately prior to the `createOffer` method being called on a `RTCPeerConnection` object.

- `negotiate:createAnswer` => `f()`

  Triggered immediately prior to the `createAnswer` method being called on an `RTCPeerConnection` object.

- `negotiate:createOffer:created` / `negotiate:createAnswer:created` => `f(sdp)`

  Triggered when SDP has successfully created for either a `createOffer` or `createAnswer` request.

- `negotiate:setlocaldescription` => `f(desc, err?)`

  Triggered after the local description of the peer connection has been set.  If the `err` argument is present, then the operation has failed and `err` contains the error details.

- `negotiate:request` => `f(peerId)`

  Triggered when a peer has requested a renegotiation of the `RTCPeerConnection`.  To simplify our connection flow one peer in a pairing always starts the connection handshake (i.e. initiates the `createOffer` call).  An event when the remote party has made changes to the inputs to the peer connection (media streams, data channels, etc) and would like to renegotiate the connection.

- `negotiate:renegotiate` => `f()`

  Triggered when a local peer connection has triggered the `onnegotiationneeded` event which indicates that something has changed in the connection and the connection should be re-established with the peer.

- `sdp:received` => `f(data)`

  Triggered when the remote peer's SDP has been received via the signalling channel.

- `icecandidate:local` => `f(candidate)`

  Triggered when an ice candidate has been gathered by a connection.  These are candidate details that will be passed to the other negotiating peer (via the signalling channel) to assist with establishing a P2P connection.

- `icecandidate:remote` => `f(data)`

  Triggered when a remote ice candidate has been sent via the signalling channel.

- `icecandidate:gathered` => `f()`

  Triggered when all the local ice candidates have been gathered by the local `RTCPeerConnection`.

- `ice:candidate:added` => `f(data, err?)`

  Triggered after a remote candidate has successfully been added to the local peer connection.  If the `err` argument is supplied to the function then the operation has failed (i.e. the candidate was not added to the connection) and the `err` argument contains the exception details.


