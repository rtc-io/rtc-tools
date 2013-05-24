# Simple Signalling

## Handshake

The first step when using simple signalling is to connect with a server.  During this connection (or handshake) process, the server will provide the client with it's knowledge of peers that exist in the logical room that the new client is connecting to.

Displayed below is an example of the data structure that is stored on the server and communicated to the new client:

```json
{
    "p_id": "c07bbfe2-7012-4ab0-9f2c-ac433f8c2b5e",
    "room": "testroomid",
    "peers": [{
        "name": "Fred Flintstone",
        "peer_id": "dbfa7cd5-2ea2-483a-b148-cf97a9befcfe",
        "peer_instances": [
            { "sdp": "" }
        ],
        "peer_ice": []
    }, {
        "name": "Barney Rubble",
        "peer_id": "47918146-b232-416b-9c96-fa974b7305a7",
        "peer_instances": [
            { "sdp": "" }
        ],
        "peer_ice": []
    }]
}
```

In the example JSON above we have three main sections in the data:

- `p_id` - this is a signalling server generated id for you the client, and will be communicated to the other peers already in the logical room with your identity details you provided in your initial handshake.

- `room` - this field is simply provided as a sanity check to ensure that the client has successfully connected to the room it intended to connect to.

- `peers` - this field is an array of current peers that are registered on the server.  Each of the peers follows the peer description format that is outlined below.

### Peer Description Format

Consider the following example:

```json
{
    "name": "Barney Rubble",
    "peer_id": "47918146-b232-416b-9c96-fa974b7305a7",
    "peer_instances": [
        { "sdp": "" }
    ],
    "peer_ice": []
}
```

Peer description data has a number of reserved control fields which are prefixed with `peer_`.  Additionally, it has a number of custom fields that are either provided by the the client when it connects to the signalling server or determined programmatically at connection time and initialized.

The reserved fields are:

- `peer_id` - The id generated for a peer by the signalling server.
- `peer_instances` - The local description of the peer connection instances running on the servers.
- `peer_ice` - ICE candidates for the peer.

### Peer IDs and Multiple Peer Connections from a Single Client

In some situations it will be desirable to create multiple peer connections available from a single client.  In the case that a client is aware of it's peer id already (from a previous) interaction with a signalling server, then this can be resent to the signalling server for a new connection.

This will result in a new instance entry being added to the `peer_instances` entry for the peer.

