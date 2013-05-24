var EventEmitter = require('events').EventEmitter,
    RTCPeerConnection = require('./lib/detect')('RTCPeerConnection'),
    util = require('util'),
    extend = require('cog/extend'),
    uuid = require('uuid'),
    defaultOpts = {
        dataChannels: ['chat'],
        iceServers: [
            { url: 'stun:stun.l.google.com:19302' }
        ],

        signaller: {
            host: 'signalstream.appspot.com',
            type: require('./signaller/sse')
        }
    };

/**
# Conversation
*/
function Conversation(id, options) {
    var opts,
        peerConfig,
        peerOpts,
        dataChannels,
        signaller;

    // check constructor called correctly
    if (! (this instanceof Conversation)) {
        return new Conversation(id, options);
    }

    // inherited
    EventEmitter.call(this);

    // initialise opts
    opts = extend({}, defaultOpts, options);

    // initialise the peer config
    peerConfig = {
        iceServers: opts.iceServers
    };

    // initialise the peer Opts
    peerOpts = {
        optional: []
    };

    // initialise data channels
    dataChannels = [].concat(opts.dataChannels || []);

    // if we have data channels, then ensure we specifiy the required extra opts
    if (dataChannels.length > 0) {
        peerOpts.optional.push({ RtpDataChannels: true });
    }

    // initialise the signaller
    signaller = opts.signaller.type;

    // initialise the id
    this.id = id || uuid.v4();

    // use the connection id if supplied
    this.cid = opts.cid || null;

    // create the peer connection
    this.peer = new RTCPeerConnection(peerConfig, peerOpts);

    // initialise signalling
    this.signaller = typeof signaller == 'function' ? signaller(opts.signaller) : null;
}

util.inherits(Conversation, EventEmitter);
module.exports = Conversation;

/**
## start
*/
Conversation.prototype.start = function(callback) {
    var signaller = this.signaller;

    // if we have no signaller, then return an error
    if (! signaller) {
        return callback(new Error('No signaller available - unable to connect'));
    }

    // initialise the signalling connection
    signaller
        .on('error', callback.bind(this))
        .on('handshake', this._handshake.bind(this))
        .on('change', this._change.bind(this))
        .connect();
};

/* private methods */

/**
## _change(delta)

The internal _change method is called when peer data changes on the signalling server. 
*/
Conversation.prototype._change = function(delta) {

};

/**
## _handshake(data)

The internal _handshake method is called in response to the signalling server
reporting a successful connection.  The initial handshake contains data of all the entities
currently in the same logical room on the signalling server.
*/
Conversation.prototype._handshake = function(data) {

};