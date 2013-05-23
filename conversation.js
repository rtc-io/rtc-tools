var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    extend = require('cog/extend'),
    uuid = require('uuid'),
    defaultOpts = {
        host: 'signalstream.appspot.com',
        signaller: require('./signaller/sse')
    };

/**
# Conversation
*/
function Conversation(id, options) {
    var opts;

    // check constructor called correctly
    if (! (this instanceof Conversation)) {
        return new Conversation(id, options);
    }

    // inherited
    EventEmitter.call(this);

    // initialise opts
    opts = extend({}, defaultOpts, options);

    // initialise the id
    this.id = id || uuid.v4();

    // initialise signalling
    this.signaller = typeof opts.signaller == 'function' ? opts.signaller(opts) : null;
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
        .connect()
        .on('error', callback.bind(this))
        .on('handshake', this._handshake.bind(this))
        .on('change', this._change.bind(this));
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