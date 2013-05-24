var media = require('../../media'),
	qsa = require('cog/qsa'),
    video = media();

// create media and attach to the specified element
video.render('.video');

window.addEventListener('load', function() {
	qsa('button').forEach(function(button){ 
		button.addEventListener('click', function() {
			video[button.dataset.action].call(video);
		});
	});
});