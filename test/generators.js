var generators = require('../generators');
var test = require('tape');
var testConstraints = {
  optional: [
    { DtlsSrtpKeyAgreement: true }
  ],
  mandatory: {
    OfferToReceiveAudio: true,
    OfferToReceiveVideo: true
  }
};

test('parseflags on undefined', function(t) {
  t.plan(1);
  t.ok(generators.parseFlags(), 'ok');
});

test('video flag recognized', function(t) {
  t.plan(1);
  t.ok(generators.parseFlags({ video: true }).indexOf('video') >= 0, 'found');
});

test('falsey video flag ignored', function(t) {
  t.plan(1);
  t.ok(generators.parseFlags({ video: false }).indexOf('video') < 0, 'ok');
});

test('video flag recognized (UPPERCASE OK)', function(t) {
  t.plan(1);
  t.ok(generators.parseFlags({ VIDEO: true }).indexOf('video') >= 0, 'found');
});

test('audio flag recognized', function(t) {
  t.plan(1);
  t.ok(generators.parseFlags({ audio: true }).indexOf('audio') >= 0, 'found');
});

test('data flag recognized', function(t) {
  t.plan(1);
  t.ok(generators.parseFlags({ data: true }).indexOf('data') >= 0, 'found');
});

test('generate config', function(t) {
  var config;

  t.plan(2);
  t.ok(config = generators.config(), 'generated config');
  t.ok(config.iceServers, 'config contains ice servers');
});

test('extend config', function(t) {
  var config;

  t.plan(2);
  t.ok(config = generators.config({ a: 1 }), 'generated config');
  t.equal(config.a, 1, 'setting preserved');
});

test('base media constraints match expected', function(t) {
  t.plan(1);
  t.deepEqual(generators.mediaConstraints(), testConstraints);
});

test('can disable video', function(t) {
  var c = generators.mediaConstraints({ video: false });

  t.plan(1);
  t.notOk(c.mandatory.OfferToReceiveVideo, 'video turned off');
});

test('can disable audio', function(t) {
  var c = generators.mediaConstraints({ audio: false });

  t.plan(1);
  t.notOk(c.mandatory.OfferToReceiveAudio, 'audio turned off');  
});

test('can flag data channels as required', function(t) {
  var c = generators.mediaConstraints({ data: true }, 'create');

  t.plan(1);
  t.equal(c.optional.filter(function(data) {
    return typeof data == 'object' && data.RtpDataChannels;
  }).length, 1, 'found RtpDataChannels flag in optional');
});