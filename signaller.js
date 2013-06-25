var SignallingChannel = require('rtc-signaller'),
    PeerConnection = require('./peerconnection'),
    util = require('util');

function PeerConnectionSignallingChannel(opts) {
    if (! (this instanceof PeerConnectionSignallingChannel)) {
        return new PeerConnectionSignallingChannel(opts);
    }

    // call inherited
    SignallingChannel.call(this, opts);

    // create a list of monitored connections
    this.connections = [];

    // watch for peer:leave events and check against our peers
    this.on('peer:leave', this._handlePeerLeave.bind(this));
}

util.inherits(PeerConnectionSignallingChannel, SignallingChannel);
module.exports = PeerConnectionSignallingChannel;

/**
## connect(targetId)

Connect to the specified target peer.  This method implements some helpful
connection management logic that will cater for the majority of use cases
for creating new peer connections.
*/
PeerConnectionSignallingChannel.prototype.connect = function(targetId) {
    var connection = new PeerConnection();

    connection.setChannel(this);
    connection.initiate(targetId, function(err) {
        console.log('connection initiation phase complete');

        if (! err) {
            console.log('connection initiated, tunnel id: ' + connection.tunnelId);
        }
        else {
            console.log('encountered error: ', err);
        }
    });

    // add this connection to the monitored connections list
    this.connections.push(connection);

    return connection;
};

/* internal event handlers */

/**
## _handlePeerLeave

A peer:leave event has been broadcast through the signalling channel.  We need
to check if the peer that has left is connected to any of our connections. If
it is, then those connections should be closed.
*/
PeerConnectionSignallingChannel.prototype._handlePeerLeave = function(peerId) {
    // remove any dead connections
    this.connections = this.connections.map(function(conn) {
        if (conn && conn.targetId === peerId) {
            console.log('found dead connection, removing');
            return;
        }

        return conn;
    }).filter(Boolean);

    console.log('currently have ' + this.connections.length + ' active connections');
};
