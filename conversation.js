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
        signaller;

    // check constructor called correctly
    if (! (this instanceof Conversation)) {
        return new Conversation(id, options);
    }

    // inherited
    EventEmitter.call(this);

    // initialise opts
    opts = extend({}, defaultOpts, options);

    // initialise the signaller
    signaller = opts.signaller.type;

    // initialise the id
    this.id = id || uuid.v4();

    // use the connection id if supplied
    this.cid = opts.cid || null;

    // initialise media constraints
    this.mediaConstraints = extend({}, {
        mandatory: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: true
        },

        optional: []
    }, opts.mediaConstraints);

    // initialise signalling
    this.signaller = typeof signaller == 'function' ? signaller(opts.signaller) : null;

    // initialise the webrtc connection elements
    this._initWebRTC(opts);
}

util.inherits(Conversation, EventEmitter);
module.exports = Conversation;

/**
## start
*/
Conversation.prototype.start = function(callback) {
    var conv = this,
        signaller = this.signaller;

    // if we have no signaller, then return an error
    if (! signaller) {
        return callback(new Error('No signaller available - unable to connect'));
    }

    // if we have no peer connection, then also complain
    if (! this.connection) {
        return callback(new Error('No peer connection, unable to connect'));
    }

    // create the offer on the peer connection
    this.connection.createOffer(
        function(desc) {
            // we have a session description (hooray)
            console.log('succcess, got session description', desc);
        },

        function() {
            console.log('fail', arguments);
        },

        this.mediaConstraints
    );

    // initialise the signalling connection
    signaller
        .on('error', callback.bind(this))
        .on('handshake', function(data) {
            // pass handshake data onto the callback
            conv._handshake(data, callback);
        })
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
Conversation.prototype._handshake = function(data, callback) {
    console.log('handshake complete with data: ', data);

    // trigger the callback
    if (typeof callback == 'function') {
        callback(null, data);        
    }
};

/**
## _initWebRTC(dataChannels)

The _initWebRTC function is used to initialise the peer connection.
*/
Conversation.prototype._initWebRTC = function(opts) {
    var peerConfig = {
            iceServers: opts.iceServers
        },
        peerOpts = {
            optional: []
        },
        dataChannels = [].concat(opts.dataChannels || []),
        conn;

    // if we have data channels, then ensure we specifiy the required extra opts
    if (dataChannels.length > 0) {
        peerOpts.optional.push({ RtpDataChannels: true });
    }

    // create the peer connection
    conn = this.connection = new RTCPeerConnection(peerConfig, peerOpts);

    // create the data channels
    // TODO: allow customization of data channel dict ops
    this.dataChannels = dataChannels.map(function(name) {
        return conn.createDataChannel(name, { reliable: false });
    });
};