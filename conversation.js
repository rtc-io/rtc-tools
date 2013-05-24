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
    this.peerId = opts.peerId || uuid.v4();

    // initialise media constraints
    this.mediaConstraints = extend({}, {
        mandatory: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: true
        },

        optional: []
    }, opts.mediaConstraints);

    // initialise signalling
    this.connected = false;
    this.signaller = typeof signaller == 'function' ? signaller(opts.signaller) : null;

    // have a concept of identity
    this._identity = {};

    // initialise the webrtc connection elements
    this._initWebRTC(opts);
}

util.inherits(Conversation, EventEmitter);
module.exports = Conversation;

/**
## identify(data)

TODO: handle identity changes after the connection with the signalling server has been established
*/
Conversation.prototype.identify = function(data) {
    // if we have no data, then reset the identity
    if (typeof data == 'undefined') {
        this._identity = {};
    }

    // if the data is a string, then do a set of the identity data
    if (typeof data == 'string' || (data instanceof String)) {
        this._identity[data] = arguments[1];
    }
    // update the identity data
    else {
        extend(this._identity, data);
    }

    // chainable
    return this;
};

/**
## start
*/
Conversation.prototype.start = function(data) {
    var conv = this,
        signaller = this.signaller;

    // if we have no signaller, then return an error
    if (! signaller) {
        return this.emit('error', new Error('No signaller available - unable to connect'));
    }

    // if we have no peer connection, then also complain
    if (! this.connection) {
        return this.emit('error', new Error('No peer connection, unable to connect'));
    }

    // create the offer on the peer connection
    this.connection.createOffer(
        // handle connection success
        function(desc) {
            // we have a session description (hooray)
            console.log('succcess, got session description', desc);

            // set the local description
            conv.connection.setLocalDescription(desc);

            // initialise the signalling connection
            signaller
                .on('error', conv.emit.bind(conv, 'error'))
                .on('handshake', conv._handshake.bind(conv))
                .on('change', conv._change.bind(this))
                .connect(conv.id, extend({
                    peerId:  conv.peerId,
                    peerSdp: desc.sdp
                }, data));      
        },

        // handle errors
        conv.emit.bind(conv, 'error'),

        // send through the media constraints
        this.mediaConstraints
    );

    // chainable
    return this;
};

// patch in the addStream and removeStream methods
['addStream', 'removeStream'].forEach(function(method) {
    Conversation.prototype[method] = function() {
        // if we have no connection then bail
        if (! this.connection) return;

        this.connection[method].apply(this.connection, arguments);
    };
});

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
    console.log('handshake complete with data: ', data);

    // flag as connected
    this.connected = true;
    this.emit('ready', data);
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

    // handle renogotiation
    conn.addEventListener('negotiationneeded', this._negotiate.bind(this));

    // create the data channels
    // TODO: allow customization of data channel dict ops
    this.dataChannels = dataChannels.map(function(name) {
        return conn.createDataChannel(name, { reliable: false });
    });
};

/**
## _negotiate()

This method is used to call 
*/
Conversation.prototype._negotiate = function() {
    if (this.connection && this.connection.localDescription) {
        console.log(this.connection.localDescription);        
    }
};