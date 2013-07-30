var generators = require('../generators');
var test = require('tape');
var testConstraints = {
  mandatory: {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: true
  },

  optional: []
};

test('base media constraints match expected', function(t) {
  t.plan(1);
  t.deepEqual(generators.mediaConstraints(), testConstraints);
});

test('can disable video', function(t) {
  var c = generators.mediaConstraints({ video: false });

  t.plan(1);
  t.equal(c.mandatory.OfferToReceiveVideo, false, 'video turned off');
});

test('can disable audio', function(t) {
  var c = generators.mediaConstraints({ audio: false });

  t.plan(1);
  t.equal(c.mandatory.OfferToReceiveAudio, false, 'audio turned off');  
});

test('can flag data channels as required', function(t) {
  var c = generators.mediaConstraints({ data: true });

  t.plan(1);
  t.equal(c.optional.filter(function(data) {
    return typeof data == 'object' && data.RtpDataChannels;
  }).length, 1, 'found RtpDataChannels flag in optional');
});