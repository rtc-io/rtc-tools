var subtest = require('./subtest-reactive-randomdelay-streams');
var stunGoog = [
  { url: 'stun:stun1.l.google.com:19302' },
  { url: 'stun:stun2.l.google.com:19302' },
  { url: 'stun:stun3.l.google.com:19302' },
  { url: 'stun:stun4.l.google.com:19302' }
];

// subtest('4 streams, no ice servers', { iceServers: [], streamCount: 4 });
// subtest('4 streams, google stun servers', { iceServers: stunGoog, streamCount: 4 });

subtest('4 streams, no ice servers (delay 200 - 1000ms)', { iceServers: [], streamCount: 4, minDelay: 2000, maxDelay: 10000 });
subtest('4 streams, google stun servers (delay 200 - 1000ms)', { iceServers: stunGoog, streamCount: 4, minDelay: 2000, maxDelay: 10000 });

// subtest('10 streams, no ice servers', { iceServers: [], streamCount: 10 });
// subtest('10 streams, google stun servers', { iceServers: stunGoog, streamCount: 10 });
