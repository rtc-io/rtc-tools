var through = require('through');

function Channel(channel) {
    this.channel = channel;
}

/**
## send()

The send method is a simple passthrough to the underlying datachannel
*/
Channel.prototype.send = function() {
    this.channel.apply(this.channel, arguments);
}

/**
## connect(name, peer)
*/
exports.connect = function(name, opts) {
    // the last argument should be the peer
    var args = [].slice.call(arguments),
        peer = args.pop();

    // if the peer does not contain a createDataChannel function then bail
    if (!peer || typeof peer.createDataChannel != 'function') return;

    // create the channel
    return new Channel(peer.createDataChannel.apply(peer, args));
};

/**
## listen(name, peer)
*/
exports.listen = function(name, peers, callback) {

    function checkChannelMatch(evt) {

    }

    // ensure we have an array of peers
    peers = [].concat(peers || []);

    // iterate through the peers, and add listeners
    peers.forEach(function(peer, index) {
        peer.addEventListener('datachannel', checkChannelMatch);
    });

    // listen for channel connections on the specified peers

};