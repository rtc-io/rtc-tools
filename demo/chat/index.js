var conversation = require('../../conversation');

// start the conversation
conversation(location.hash).start(function(err) {
    // if we received an error, then handle it
    if (err) return console.error(err);
});