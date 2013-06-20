var defaults = require('./defaults'),
	EventEmitter = require('events').EventEmitter,
	RTCPeerConnection = require('rtc-detect/peerconnection'),
	signaller = require('./signaller'),
	util = require('util');

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
	this.instance = null;

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
		messageHandler = this._parseMessage.bind(this);

	function finalize() {
		// stop listening for messages
		channel.unbind('message', messageHandler);

		// trigger the callback
		callback.apply(this, arguments);
	}

	// if we have no channel to talk over then trigger the callback with an 
	// error condition
	if (! channel) return callback(new Error('A channel is required to initiate a peer connection'));

	// create a new browser peer connection instance
	this.instance = new RTCPeerConnection(this.constraints, this.opts);

	// listen for messages
	channel.on('message', messageHandler);

	// dial our peer
	channel.dial(targetId, function(err) {
		if (err) {
			// if the error is a simulatenous dial error
			// then pass our callback to the answer event handler
			if (err.code && err.code === signaller.errorcodes.SIMULTANEOUS_DIAL) {
				return connection.once('answer', finalize.bind(null, null));
			}
			// otherwise, abort and pass the error to the callback
			else {
				return finalize(err);
			}
		}
	});

	// create the offer for the instance
	console.log(this.instance);
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

/**
## _parseMessage(message)

Parse a message from the signalling channel and take appropriate action.
*/
PeerConnection.prototype._parseMessage = function(message) {
	console.log('received message: ' + message);
};