var messenger = require('rtc-switchboard-messenger');
var signaller = require('rtc-signaller')(messenger('https://switchboard.rtc.io/'));
var rtc = require('..');
var getUserMedia = require('getusermedia');
var attachMedia = require('attachmediastream');

// capture local media first as firefox
// will want a local stream and doesn't support onnegotiationneeded event
getUserMedia({ video: true, audio: true }, function(err, localStream) {
  if (err) {
    return console.error('could not capture media: ', err);
  }

  document.body.appendChild(attachMedia(localStream));

  // look for friends
  signaller.on('peer:announce', function(data) {
    var pc = rtc.createConnection();
    var monitor = rtc.couple(pc, data.id, signaller);

    // add the stream to the connection
    pc.addStream(localStream);

    // once the connection is active, log a console message
    monitor.once('connected', function() {
      console.log('connection active to: ' + data.id);

      pc.getRemoteStreams().forEach(function(stream) {
        document.body.appendChild(attachMedia(stream));
      });
    });


    monitor.createOffer();
  });

  // announce ourself in the rtc-getting-started room
  signaller.announce({ room: 'rtc-getting-started' });
});
