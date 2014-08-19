var subtest = require('./subtest-reactive-randomdelay-streams');
var stunGoog = require('./helpers/stun-google');

subtest('4 streams, no ice servers', { iceServers: [], streamCount: 4 });
subtest('4 streams, google stun servers', { iceServers: stunGoog, streamCount: 4 });

subtest('4 streams, no ice servers (delay 200 - 1000ms)', { iceServers: [], streamCount: 4, minDelay: 200, maxDelay: 500 });
subtest('4 streams, google stun servers (delay 200 - 1000ms)', { iceServers: stunGoog, streamCount: 4, minDelay: 200, maxDelay: 500 });

subtest('10 streams, no ice servers', { iceServers: [], streamCount: 10 });
subtest('10 streams, google stun servers', { iceServers: stunGoog, streamCount: 10 });
