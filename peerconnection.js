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
        'close',

        // add event listener passthroughs
        'addEventListener',
        'removeEventListener'    
    ],
    PASSTHROUGH_ATTRIBUTES = [
        'localDescription',
        'remoteDescription',
        'signallingState',
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
## initiate(targetId, callback)

Initiate a connection to the specified target peer id.  Once the offer/accept
dance has been completed, then trigger the callback.  If we have been unable
to connect for any reason the callback will contain an error as the first
argument.
*/
PeerConnection.prototype.initiate = function(targetId, callback) {
	var channel = this.channel,
		connection = this,
        basecon;

	function finalize() {
		// stop listening for messages
        channel.removeListener('offer', checkOffer);
        channel.removeListener('answer', checkAnswer);

		// trigger the callback
		callback.apply(this, arguments);
        finalize = null;
	}

    function checkAnswer(sdp, remoteId) {
        if (remoteId && remoteId === targetId) {
            basecon.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: sdp
            }));

            // tell the channel to clean up the handshake
            channel.send('/dialend ' + targetId);
            finalize();
        }
    }

    function checkOffer(sdp, remoteId) {
        // if we have a remote and the remote matches the target, then talk
        if (remoteId && remoteId === targetId) {
            createAnswer(sdp);
        }
    }

    function createAnswer(remoteSdp) {
        basecon.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: remoteSdp }));

        // TODO: consider adding constraints
        basecon.createAnswer(
            function(desc) {
                basecon.setLocalDescription(desc);

                // send the answer
                console.log('sending answer');
                channel.send('/to ' + targetId, 'answer', desc.sdp, channel.id);

                // finalize the connection
                finalize();
            },

            function() {
                channel.send('/to  ' + targetId, 'answer:fail', channel.id);
                finalize(new Error('Could not create answer'));
            }
        );
    }

    function createOffer() {
        // TODO: consider adding constraints
        basecon.createOffer(
            function(desc) {
                console.log(desc);

                // set the local description of the instance
                basecon.setLocalDescription(desc);

                // send the offer
                console.log('sending offer');
                channel.send('/to ' + targetId, 'offer', desc.sdp, channel.id);
            },

            finalize.bind(this, new Error('Could not create a RTCPeerConnection offer'))
        );
    }

	// if we have no channel to talk over then trigger the callback with an 
	// error condition
	if (! channel) return callback(new Error('A channel is required to initiate a peer connection'));

	// create a new browser peer connection instance
	basecon = this._basecon = new RTCPeerConnection(this.constraints, this.opts);

	// listen for messages
	// channel.on('message', messageHandler);
    channel.on('offer', checkOffer);
    channel.on('answer', checkAnswer);

	// dial our peer
	channel.dial(targetId, function(err) {
        // if we received an error, and it is not a simulatenous dial error, abort
		if (err && err.code !== errorcodes.SIMULTANEOUS_DIAL) {
			return finalize(err);
		}
        else if (err) {
            // simulatenous dial, do nothing
            return;
        }

        createOffer();
	});
};

/**
## setChannel(channel)

Initialise the signalling channel that will be used to communicate
the actual RTCPeerConnection state to it's friend.
*/
PeerConnection.prototype.setChannel = function(channel) {
	this.channel = channel;
};

/* internal methods */

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
