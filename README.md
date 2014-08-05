AudioPlus
=========

Trying to make Web Audio API even more easy and fun to use!
-----------------------------------------------------------

```javascript

var audio = new AudioPlus();
audio.onload = function() {
  /// executes when finished loading and decoding file
  this.play();
};
audio.load("url/to/file.mp3");

```


You can do:
```javascript
audio.play(); ///plays
audio.pause(); //pause
audio.stop(); ///stops
audio.paused; ///returns state of play
audio.volume = 0.2; ///sets gain to 0.2
audio.volume = 3; ///sets gain to 3
audio.duration; /// returns duration of AudioBuffer
audio.time; /// returns currentTime
audio.time = 3.213; /// goes to that exact time location on audiobuffer
audio.fadeIn(4); ///fades in from paused during 4sec
audio.fadeOut(3); /// fades out to paused in 3sec
audio.fadeTo(0.2, 5); ///fades to 0.2(gain) in 5sec
audio.player(element); /// attaches an <audio> or <video> as audioSource (needs some working out)

var canvas = audio.createFrequencyView(64); /// creates a frequency view of 64 bands
var canvas = audio.createWaveView(256); /// creates a wave view with FFT 256 
var canvas = audio.createLevelView(); /// creates a level view
```
