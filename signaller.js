var SignallingChannel = require('rtc-signaller'),
    PeerConnection = require('./peerconnection'),
    util = require('util');

function PeerConnectionSignallingChannel(opts) {
    if (! (this instanceof PeerConnectionSignallingChannel)) {
        return new PeerConnectionSignallingChannel(opts);
    }

    // call inherited
    SignallingChannel.call(this, opts);
}

util.inherits(PeerConnectionSignallingChannel, SignallingChannel);
module.exports = PeerConnectionSignallingChannel;

// add a connect method
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

    return connection;
};
