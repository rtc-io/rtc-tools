var peer = require('../peer'),
    channel = require('../channel'),
    conversation = require('../conversation'),
    randomName = require('random-name'),
    media = require('../media'),
    video = media(),
    connection;

// join a conversation
connection = conversation.join('test', { identity: randomName() });

// on new peers joining the conversation
connection.on('peer', video.tx.bind(video));

// create media and attach to the specified element
video.render('.video');