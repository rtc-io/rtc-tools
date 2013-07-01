var BaseSignaller = require('rtc-signaller'),
    PeerConnection = require('./peerconnection'),
    util = require('util');

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
## dial(targetId)

Connect to the specified target peer.  This method implements some helpful
connection management logic that will cater for the majority of use cases
for creating new peer connections.
*/
Signaller.prototype.dial = function(targetId) {
    var connection = new PeerConnection();

    connection.setChannel(this);
    connection.initiate(targetId, function(err) {
        console.log('connection initiation phase complete');

        if (! err) {
            console.log('connection initiated, call id: ' + connection.callId);
        }
        else {
            console.log('encountered error: ', err);
        }
    });

    // add this connection to the monitored connections list
    this.connections.push(connection);

    return connection;
};

/** static factory methods (for syntactic sugar) */

Signaller.create = function(opts) {
    return new Signaller(opts);
};

Signaller.join = function(name) {
    return new Signaller().join(name);
};

/* internal event handlers */

/**
## _handlePeerLeave

A peer:leave event has been broadcast through the signalling channel.  We need
to check if the peer that has left is connected to any of our connections. If
it is, then those connections should be closed.
*/
Signaller.prototype._handlePeerLeave = function(peerId) {
    // remove any dead connections
    this.connections = this.connections.map(function(conn) {
        if (conn && conn.targetId === peerId) {
            return conn.close();
        }

        return conn;
    }).filter(Boolean);

    console.log('currently have ' + this.connections.length + ' active connections');
};
