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

    // set the tunnelId and targetId to null (no relationship)
    this.targetId = null;
    this.tunnelId = null;

    // create a _listeners object to hold listener function instances
    this._listeners = {};

	// initialise the opts
	this.opts = opts || {};

	// initialise underlying W3C connection instance to null
	this._basecon = null;

    // create a defered requests array
    this._deferedRequests = [];

    // initialise known ice candidates
    this.iceCandidates = [];
    this._newIceCandidates = [];

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
    var basecon = this._basecon;
    console.log('attempting to close underlying peer connection: ', basecon);

    // first close the underlying base connection if it exists
    if (basecon) {
        this._setBaseConnection(null);
        basecon.close();
    }

    // set the channel to null to remove event listeners
    this.setChannel(null);
};

/**
## initiate(targetId, callback)

Initiate a connection to the specified target peer id.  Once the offer/accept
dance has been completed, then trigger the callback.  If we have been unable
to connect for any reason the callback will contain an error as the first
argument.
*/
PeerConnection.prototype.initiate = function(targetId, callback) {
	var connection = this;

	// if we have no channel to talk over then trigger the callback with an 
	// error condition
	if (! this.channel) return callback(new Error('A channel is required to initiate a peer connection'));

    // reset the tunnelId
    this.tunnelId = null;

    // save the target id
    this.targetId = targetId;

	// create a new browser peer connection instance
	this._setBaseConnection(new RTCPeerConnection(this.constraints, this.opts));

    // once we have a stable connection, trigger the callback
    this.once('stable', callback);

    // wait for streams
    process.nextTick(function() {

    });

	// dial our peer
	this.channel.dial(targetId, function(err, data) {
        // if we received an error, and it is not a simulatenous dial error, abort
		if (err && err.code !== errorcodes.SIMULTANEOUS_DIAL) {
			return finalize(err);
		}
        else if (err) {
            // simulatenous dial, set the tunnel id and then bail
            connection.setTunnelId(err.tunnelId);

            return;
        }

        // initialise the tunnel id from the data
        connection.setTunnelId(data.tunnelId);

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
        this.channel.removeListener('candidates', this._listeners.candidates);
    }

    // update the channel
	this.channel = channel;

    // if we have a new channel, then bind listeners
    if (channel) {
        channel.on('offer', this._listeners.offer = this._handleOffer.bind(this));
        channel.on('answer', this._listeners.answer = this._handleAnswer.bind(this));

        // handle ice candidate communications
        channel.on('candidates', this._listeners.candidates = this._handleRemoteIceCandidates.bind(this));
    }
};

/**
## setIceCandidates
*/
PeerConnection.prototype.setIceCandidates = function(newCandidates) {
    // send the ice candidates
    // TODO: check whether this naive 0 length test is ok
    if (newCandidates && newCandidates.length > 0) {
        this.channel.send('/to ' + this.targetId, 'candidates', newCandidates);
    }
    
    this.iceCandidates = [].concat(newCandidates);
};

/**
## setTunnelId(value)
*/
PeerConnection.prototype.setTunnelId = function(value) {
    var handler,
        data;

    if (this.tunnedId !== value) {
        this.tunnelId = value;

        // if we have a value, then process defered requests
        if (value) {
            while (this._deferedRequests.length > 0) {
                data = this._deferedRequests.shift();
                handler = PeerConnection.prototype['_handle' + data.type];

                // if we have a handler, then run it
                if (typeof handler == 'function') {
                    handler.call(this, data.sdp, data.tunnelId);
                }
            }
        }
    }
};

/* internal methods */

/**
## _setBaseConnection()

Used to update the underlying base connection.
*/
PeerConnection.prototype._setBaseConnection = function(value) {
    // if the same, then abort
    if (this._basecon === value) return;

    // if we have an existing base connection, remove event listeners
    if (this._basecon) {
        this._basecon.removeEventListener('signalingstatechange', this._listeners.signalingstatechange);
        this._basecon.removeEventListener('icecandidate', this._listeners.icecandidate);
        this._basecon.removeEventListener('iceconnectionstatechange', this._listeners.iceconnectionstatechange);
        this._basecon.removeEventListener('addstream', this._listeners.addstream);
        this._basecon.removeEventListener('removestream', this._listeners.removestream);
        this._basecon.removeEventListener('negotiationneeded', this._listeners.negotiationneeded);
    }

    // update the base connection
    this._basecon = value;

    if (value) {
        // attach event listeners for core behaviour
        value.addEventListener(
            'signalingstatechange',
            this._listeners.signalingstatechange = this._handleSignalingStateChange.bind(this)
        );

        // handle new ice candidates being added
        value.addEventListener(
            'icecandidate',
            this._listeners.icecandidate = this._handleIceCandidate.bind(this)
        );

        // handle ice connection state changes
        value.addEventListener(
            'iceconnectionstatechange',
            this._listeners.iceconnectionstatechange = this._handleIceConnectionStateChange.bind(this)
        );

        // listen for new remote streams
        value.addEventListener(
            'addstream',
            this._listeners.addstream = this._handleRemoteAdd.bind(this)
        );

        // listen for remote streams being removed
        value.addEventListener(
            'removestream',
            this._listeners.removestream = this._handleRemoteRemove.bind(this)
        );

        // handle when the connection requires renegotiation (a new stream has been added, etc)
        value.addEventListener(
            'negotiationneeded',
            this._listeners.negotiationneeded = this._handleNegotiationNeeded.bind(this)
        );
    }

    return value;
};

/**
## _createAnswer(sdp)

Once we have received an offer from a remote peerconnection, we need to 
send that connection an answer with our own capabilities.
*/
PeerConnection.prototype._createAnswer = function(sdp) {
    var connection = this,
        basecon = this._basecon,
        targetId = this.targetId;

    // if no base connection, abort
    if (! basecon) return;

    // TODO: consider adding constraints
    basecon.createAnswer(
        function(desc) {
            basecon.setLocalDescription(desc);

            // send the answer
            console.log('sending answer');
            connection.channel.send(
                '/to ' + targetId,
                'answer',
                desc.sdp,
                connection.tunnelId
            );
        },

        function() {
            connection.channel.send(
                '/to  ' + targetId,
                'answer:fail',
                connection.tunnelId
            );

            // finalize(new Error('Could not create answer'));
            // TODO: relay an error
        }
    );
};

/**
## _createOffer()
*/
PeerConnection.prototype._createOffer = function() {
    var connection = this,
        basecon = this._basecon,
        targetId = this.targetId;

    // if we have no base connection, abort
    if (! basecon) return;

    // TODO: consider adding constraints
    basecon.createOffer(
        function(desc) {
            // set the local description of the instance
            basecon.setLocalDescription(desc);

            // send the offer
            console.log('sending offer');
            connection.channel.send(
                '/to ' + targetId,
                'offer',
                desc.sdp,
                connection.tunnelId
            );
        },

        function(err) {
            // TODO: handle error
        }
    );
};

/**
## _defer(type, sdp, tunnelId)

In the instance that we receive an offer or answer request when we don't have
a tunnelId (which uniquely identies our A -> B signalling relationship) we
need to defer handling until such point that we do.  These queued requests
are stored in an array that is processed when a tunnelId is set using the 
`setTunnelId` method.
*/
PeerConnection.prototype._defer = function(type, sdp, tunnelId) {
    return this._deferedRequests.push({
        type: type,
        sdp: sdp,
        tunnelId: tunnelId
    });
};

/**
## _handleAnswer(sdp, remoteid)
*/
PeerConnection.prototype._handleAnswer = function(sdp, tunnelId) {
    // if we don't have a tunnel id yet, defer the answer handling
    if (! this.tunnelId) return this._defer('Answer', sdp, tunnelId);
    console.log('received answer');

    // normal answer handling
    if (this._basecon && tunnelId && tunnelId === this.tunnelId) {
        this._basecon.setRemoteDescription(new RTCSessionDescription({
            type: 'answer',
            sdp: sdp
        }));

        console.log('set remote desc in answer', this._basecon.getRemoteStreams());

        // tell the channel to clean up the handshake
        this.channel.send('/dialend ' + this.targetId);
    }
};

/**
## _handleICECandidate()
*/
PeerConnection.prototype._handleIceCandidate = function(evt) {
    if (evt.candidate) {
        this._newIceCandidates.push(evt.candidate);
    }
    else {
        // save the current ice candidates
        this.setIceCandidates(this._newIceCandidates);

        // reset the new iceCandidates array
        this._newIceCandidates = [];
    }
};

PeerConnection.prototype._handleIceConnectionStateChange = function(evt) {
    console.log('ice connection state changed: ' + this._basecon.iceConnectionState);
};

/**
## _handleNegotiationNeeded

Trigger when the peer connection and it's remote counterpart need to 
renegotiate due to streams being added, removed, etc.
*/
PeerConnection.prototype._handleNegotiationNeeded = function() {
    // wait for stable and then create the new offer
    console.log('!!! anyone else want to negotiate?');

    /*
    if (this._basecon && this._basecon.signalingState === 'stable') {
        this._createOffer();
    }
    else {
        this.once('stable', this._createOffer.bind(this));
    }
    */

    // create a new offer
    // this._createOffer();
};

/**
## _handleOffer(sdp, remoteid)

When we receive connection offers, see if they are for our target connection.
If so then handle the connection, otherwise ignore
*/
PeerConnection.prototype._handleOffer = function(sdp, tunnelId) {
    // if we don't yet have a tunnel id, then defer handling the offer
    if (! this.tunnelId) return this._defer('Offer', sdp, tunnelId);

    // if we have a remote and the remote matches the target, then talk
    if (this._basecon && tunnelId && tunnelId === this.tunnelId) {
        this._basecon.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: sdp
        }));

        console.log('set remote desc in offer', this._basecon.getRemoteStreams());

        this._createAnswer(sdp);
    }
};

/**
## _handleRemoteAdd()
*/
PeerConnection.prototype._handleRemoteAdd = function(evt) {
    if (evt.stream) return this.emit('stream:add', evt.stream);
};

/**
## _handleRemoteIceCandidates(candidates)

This event is triggered in response to receiving the `candidates` event via
the signalling channel.  Once ice candidates have been received and
synchronized we are able to properly establish the communication between two
peer connections.
*/
PeerConnection.prototype._handleRemoteIceCandidates = function(candidates) {
    var basecon = this._basecon;

    // if we don't have a base connection (which would be weird...) abort
    if (! basecon) return;

    // add the candidates to the base connection
    candidates.forEach(function(data) {
        try {
            var candidate = new RTCIceCandidate({ candidate: data.candidate.replace(/\n/g, '') });

            candidate.sdpMid = data.sdpMid;
            candidate.sdpMLineIndex = data.sdpMLineIndex;

            basecon.addIceCandidate(candidate);
        }
        catch (e) {
            console.log('invalid ice candidate: ', data, e);
        }
    });
};

/**
## _handleRemoteRemove()
*/
PeerConnection.prototype._handleRemoteRemove = function() {
    console.log('remote stream removed', arguments);
};

/**
## _handleSignalingStateChange
*/
PeerConnection.prototype._handleSignalingStateChange = function() {
    console.log('signalling state change: ' + this._basecon.signalingState);
    if (this._basecon && this._basecon.signalingState === 'stable') {
        this.emit('stable');
    }
};

/* RTCPeerConnection passthroughs */

PASSTHROUGH_METHODS.forEach(function(method) {
    PeerConnection.prototype[method] = function() {
        if (this._basecon) {
            return this._basecon[method].apply(this._basecon, arguments);
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
