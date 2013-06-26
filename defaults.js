// initialise default constraints
exports.config = {
	iceServers: [
        { url: 'stun:127.0.0.1:3478' },
        { url: 'turn:127.0.0.1:3478' }
    ]
};
