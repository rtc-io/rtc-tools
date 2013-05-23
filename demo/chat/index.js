var room = require('../../room'),
    conversation = room(window.location.hash);

// start the conversation
conversation.start(function(err) {
    // if we received an error, then handle it
});