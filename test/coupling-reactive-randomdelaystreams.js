var subtest = require('./subtest-reactive-randomdelay-streams');
var stunGoog = require('./helpers/stun-google');
var contexts = [
  new AudioContext(),
  new AudioContext()
];

subtest('4 streams, no ice servers', contexts, { iceServers: [], streamCount: 4 });
subtest('4 streams, google stun servers', contexts, { iceServers: stunGoog, streamCount: 4 });

subtest('4 streams, no ice servers (delay 200 - 1000ms)', contexts, { iceServers: [], streamCount: 4, minDelay: 200, maxDelay: 500 });
subtest('4 streams, google stun servers (delay 200 - 1000ms)', contexts, { iceServers: stunGoog, streamCount: 4, minDelay: 200, maxDelay: 500 });

subtest('10 streams, no ice servers', contexts, { iceServers: [], streamCount: 10 });
subtest('10 streams, google stun servers', contexts, { iceServers: stunGoog, streamCount: 10 });
