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
    if (! (this instanceof Room)) {
        return new Room(id, options);
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
module.exports = Room;

/**
## start
*/
Conversation.prototype.start = function() {

};