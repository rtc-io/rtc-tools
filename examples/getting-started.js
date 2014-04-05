var signaller = require('rtc-signaller')('http://rtc.io/switchboard/');
var rtc = require('..');
var media = require('rtc-media');
var localMedia = media();

// render the local media to the document body
localMedia.render(document.body);

// capture local media first as firefox
// will want a local stream and doesn't support onnegotiationneeded event
localMedia.once('capture', function(localStream) {
  // look for friends
  signaller.on('peer:announce', function(data) {
    // create a peer connection for our new friend
    var pc = rtc.createConnection();

    // couple our connection via the signalling channel
    var monitor = rtc.couple(pc, data.id, signaller);

    // add the stream to the connection
    pc.addStream(localStream);

    // once the connection is active, log a console message
    monitor.once('connected', function() {
      console.log('connection active to: ' + data.id);
  
      pc.getRemoteStreams().forEach(function(stream) {
        media(stream).render(document.body);
      });
    });


    monitor.createOffer();
  });

  // announce ourself in the rtc-getting-started room
  signaller.announce({ room: 'rtc-getting-started' });
});

