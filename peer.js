var EventEmitter = require('events').EventEmitter,
    RTCPeerConnection = require('./lib/detect')('RTCPeerConnection'),
    util = require('util');

function Peer(connection) {
    // inherited
    EventEmitter.call(this);

    // save a reference to the peer
    this.connection = connection;
}

util.inherits(Peer, EventEmitter);

// export the helper
module.exports = function(constraints, options) {
    return new Peer(new RTCPeerConnection(constraints, options));
};

