var subtest = require('./subtest-reactive');
var stunGoog = require('./helpers/stun-google');

subtest('4 channels, no ice servers', { iceServers: [], channelCount: 4 });
subtest('4 channels, google stun servers', { iceServers: stunGoog, channelCount: 4 });

subtest('4 channels, no ice servers (delay 200 - 1000ms)', { iceServers: [], channelCount: 4, minDelay: 200, maxDelay: 500 });
subtest('4 channels, google stun servers (delay 200 - 1000ms)', { iceServers: stunGoog, channelCount: 4, minDelay: 200, maxDelay: 500 });

subtest('10 channels, no ice servers', { iceServers: [], channelCount: 10 });
subtest('10 channels, google stun servers', { iceServers: stunGoog, channelCount: 10 });
