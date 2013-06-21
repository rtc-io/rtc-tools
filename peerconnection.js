var defaults = require('./defaults'),
	EventEmitter = require('events').EventEmitter,
	RTCPeerConnection = require('rtc-detect/peerconnection'),
    errorcodes = require('rtc-core/errorcodes'),
	signaller = require('./signaller'),
	util = require('util'),

    // regexes
    reNewLine = /\n/g, 

    // passthrough methods, attributes and events
    // see: http://dev.w3.org/2011/webrtc/editor/webrtc.html#rtcpeerconnection-interface
    PASSTHROUGH_METHODS = [
        'createOffer',
        'createAnswer',
        'setLocalDescription',
        'setRemoteDescription',
        'updateIce',
        'addIceCandidate',
        'getLocalStreams',
        'getRemoteStreams',
        'getStreamById',
        'addStream',
        'removeStream',
        // 'close', -- don't include close as we need to do some custom stuff

        // add event listener passthroughs
        'addEventListener',
        'removeEventListener'    
    ],
    PASSTHROUGH_ATTRIBUTES = [
        'localDescription',
        'remoteDescription',
        'signalingState',
        'iceGatheringState',
        'iceConnectionState'
    ],
    PASSTHROUGH_EVENTS = [
        'onnegotiationneeded',
        'onicecandidate',
        'onsignalingstatechange',
        'onaddstream',
        'onremovestream',
        'oniceconnectionstatechange'
    ];

function PeerConnection(constraints, opts) {
	if (! (this instanceof PeerConnection)) {
		return new PeerConnection(constraints, optional);
	}

	// inherited
	EventEmitter.call(this);

	// initialise constraints (use defaults if none provided)
	this.constraints = constraints || defaults.constraints;

    // set the tunnelid and targetid to null (no relationship)
    this.targetid = null;
    this.tunnelid = null;

    // create a _listeners object to hold listener function instances
    this._listeners = {};

	// initialise the opts
	this.opts = opts || {};

	// initialise underlying W3C connection instance to null
	this._basecon = null;

	// if we have a channel defined in options, then initialise the channel
	this.channel = null;
	if (this.opts.channel) {
		this.setChannel(this.opts.channel);
	}
}

util.inherits(PeerConnection, EventEmitter);
module.exports = PeerConnection;

/**
## close()

Cleanup the peer connection.
*/
PeerConnection.prototype.close = function() {
    // first close the underlying base connection if it exists
    if (this._basecon) {
        this._basecon.close();
    }

    // set the channel to null to remove event listeners
    this.setChannel(null);
};

/**
## initiate(targetid, callback)

Initiate a connection to the specified target peer id.  Once the offer/accept
dance has been completed, then trigger the callback.  If we have been unable
to connect for any reason the callback will contain an error as the first
argument.
*/
PeerConnection.prototype.initiate = function(targetid, callback) {
	var connection = this;

	// if we have no channel to talk over then trigger the callback with an 
	// error condition
	if (! this.channel) return callback(new Error('A channel is required to initiate a peer connection'));

    // reset the tunnelid
    this.tunnelId = null;

    // save the target id
    this.targetid = targetid;

	// create a new browser peer connection instance
	this._createBaseConnection();

    // once we have a stable connection, trigger the callback
    this.once('stable', callback);

	// dial our peer
	this.channel.dial(targetid, function(err, data) {
        // if we received an error, and it is not a simulatenous dial error, abort
		if (err && err.code !== errorcodes.SIMULTANEOUS_DIAL) {
			return finalize(err);
		}
        else if (err) {
            // simulatenous dial, set the tunnel id and then bail
            connection.tunnelid = err.tunnelid;

            return;
        }

        // initialise the tunnel id from the data
        connection.tunnelid = data.tunnelid;

        // create the offer
        connection._createOffer();
	});
};

/**
## setChannel(channel)

Initialise the signalling channel that will be used to communicate
the actual RTCPeerConnection state to it's friend.
*/
PeerConnection.prototype.setChannel = function(channel) {
    // if no change then return
    if (this.channel === channel) return;

    // if we have an existing channel, then remove event listeners
    if (this.channel) {
        this.channel.removeListener('offer', this._listeners.offer);
        this.channel.removeListener('answer', this._listeners.answer);
    }

    // update the channel
	this.channel = channel;

    // if we have a new channel, then bind listeners
    if (channel) {
        channel.on('offer', this._listeners.offer = this._handleOffer.bind(this));
        channel.on('answer', this._listeners.answer = this._handleAnswer.bind(this));
    }
};

/* internal methods */

/**
## _createBaseConnection()

Used to create an underlying RTCPeerConnection as per the W3C specification.
*/
PeerConnection.prototype._createBaseConnection = function() {
    var basecon = this._basecon;

    // if we have an existing base connection, remove event listeners
    if (basecon) {
        basecon.removeEventListener('signalingstatechange', this._listeners.signalingstatechange);
    }

    // create the new base connection
    basecon = this._basecon = new RTCPeerConnection(this.constraints, this.opts);

    // attach event listeners for core behaviour
    basecon.addEventListener(
        'signalingstatechange',
        this._listeners.signalingstatechange = this._handleSignalingStateChange.bind(this)
    );

    return basecon;
};

/**
## _createAnswer(sdp)

Once we have received an offer from a remote peerconnection, we need to 
send that connection an answer with our own capabilities.
*/
PeerConnection.prototype._createAnswer = function(sdp) {
    var channel = this.channel,
        basecon = this._basecon,
        targetid = this.targetid;

    // if no base connection, abort
    if (! basecon) return;

    // TODO: consider adding constraints
    basecon.createAnswer(
        function(desc) {
            basecon.setLocalDescription(desc);

            // send the answer
            console.log('sending answer');
            channel.send('/to ' + targetid, 'answer', desc.sdp, channel.id);
        },

        function() {
            channel.send('/to  ' + targetid, 'answer:fail', channel.id);

            // finalize(new Error('Could not create answer'));
            // TODO: relay an error
        }
    );
};

/**
## _createOffer()
*/
PeerConnection.prototype._createOffer = function() {
    var basecon = this._basecon,
        channel = this.channel,
        targetid = this.targetid;

    // if we have no base connection, abort
    if (! basecon) return;

    // TODO: consider adding constraints
    basecon.createOffer(
        function(desc) {
            // set the local description of the instance
            basecon.setLocalDescription(desc);

            // send the offer
            console.log('sending offer');
            channel.send('/to ' + targetid, 'offer', desc.sdp, channel.id);
        },

        function(err) {
            // TODO: handle error
        }
    );
};

/**
## _handleAnswer(sdp, remoteid)
*/
PeerConnection.prototype._handleAnswer = function(sdp, remoteid) {
    if (this._basecon && remoteid && remoteid === this.targetid) {
        this._basecon.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
        }));

        // tell the channel to clean up the handshake
        this.channel.send('/dialend ' + this.targetid);
    }
};

/**
## _handleOffer(sdp, remoteid)

When we receive connection offers, see if they are for our target connection.
If so then handle the connection, otherwise ignore
*/
PeerConnection.prototype._handleOffer = function(sdp, remoteid) {
    // if we have a remote and the remote matches the target, then talk
    if (this._basecon && remoteid && remoteid === this.targetid) {
        this._basecon.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: sdp
        }));

        this._createAnswer(sdp);
    }
};

/**
## _handleSignalingStateChange
*/
PeerConnection.prototype._handleSignalingStateChange = function() {
    if (this._basecon && this._basecon.signalingState === 'stable') {
        this.emit('stable');
    }
};

/* RTCPeerConnection passthroughs */

PASSTHROUGH_METHODS.forEach(function(method) {
    PeerConnection.prototype[method] = function() {
        if (this._basecon) {
            return this._basecon[method].apply(this.instance, arguments);
        }
    };
});

PASSTHROUGH_ATTRIBUTES.forEach(function(getter) {
    Object.defineProperty(PeerConnection.prototype, getter, {
        get: function() {
            return this._basecon && this._basecon[getter];
        }
    });
});

PASSTHROUGH_EVENTS.forEach(function(eventName) {
    Object.defineProperty(PeerConnection.prototype, eventName, {
        set: function(handler) {
            if (this._basecon) {
                this._basecon[eventName] = handler;
            }
        }
    });
});
