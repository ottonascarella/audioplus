//////////////////////////
///     AudioPlus      ///
/// by Otto Nascarella ///
//////////////////////////


///requestAnimationFrame polyfill by someone I can't remember...sorry!
(function(window) {

	var lastTime = 0;
	var vendors = ['webkit', 'moz'];
	for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame =
		window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = function(callback, element) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};

	if (!window.cancelAnimationFrame)
		window.cancelAnimationFrame = function(id) {
		clearTimeout(id);
	};

}(window));


(function(window) {

	window.AudioContext = window.AudioContext || window.webkitAudioContext || false;
	if (!window.AudioContext) throw new Error("Web Audio not available");

	var ZERO = 0.000001;

	function AudioPlus() {
		this.context = new AudioContext();
		this.paused = true;
		this.loop = false;

		//this is the audio buffer source, not audio URL
		this.source = null;
		this.nodes = [];

		///timer for fading master
		this._fadeTimer = 0;

		this._buffer = null;
		this._playTime = 0;
		this._pauseTime = 0;
		this._deltaTime = 0;
		///creates a master gain node, deattached from nodes string
		this.master = this.context.createGain();
	}

	AudioPlus.prototype = {
		///to connect a <audio> or <video> element to the node chain
		/// which does not work on iOS or Safari.
		player: function(player) {
			var that = this;

			if (! (player instanceof HTMLMediaElement) ) {
				throw new Error("Player interface takes a <video> or <audio> element as parameter.");
			}

			this.source = this.nodes[0] = this.context.createMediaElementSource(player);

			player.addEventListener("play", function() {
				that._connectAll();
				that.paused = this.paused;
			});

			player.addEventListener("pause", function() {
				that._disconnectAll();
				that.paused = this.paused;
			});

			player.addEventListener("ended", function() {
				that._disconnectAll();
				that.paused = this.paused;
			});

			return this;
		},
		///loads and decodes audio files using XHR request
		load: function(url) {
			var that = this,
				req = new XMLHttpRequest();


			req.onreadystatechange = function() {
				if (this.readyState === 4) { /// when audio finished loading

					// handles requests with bad statuses
					if (this.status !== 200) throw new Error("Request of " + url + " failed. code: " + this.status);

					/// try decode audio
					that.context.decodeAudioData(this.response, function(buffer) {
						/// on decode sucess, create source
						console.log("decoded");
						that._buffer = buffer;

						///if there's a onload handler, call it.
						if (that.onload) that.onload.call(that);

					}, function() {
						throw new Error("Error decoding " + url);
					});


				}
			};

			req.ontimeout = this.ontimeout;

			req.onerror = function() {
				throw new Error("Error requesting " + url);
			};

			req.open('GET', url, true);
			req.responseType = 'arraybuffer';
			req.send();

			return this;
		},

		//creates the bufferSource from decoded audio file
		_createSource: function() {
			var that = this;
			if (!(that._buffer instanceof AudioBuffer)) {
				that._buffer = null;
				throw new Error ("AudioContext buffer has never been initialized! Are you sure the audio decoded properly?");
			}

			this.source = this.context.createBufferSource();
			console.log("buffer created");
			this.source.buffer = this._buffer;
			this.source.loop = this.loop;
		},

		_destroySource: function() {
			this.source = null;
		},

		//connects all nodes from source to destination
		_connectAll: function() {
			var l = this.nodes.length, i = 0;
			if (l) {
				this.source.connect(this.nodes[0]);
				for (i = 0; i < l; i++) {
					this.nodes[i].connect(this.nodes[i+1]);
				}
				this.nodes[l].connect(this.master);
			} else
				this.source.connect(this.master);

			this.master.connect(this.context.destination);
		},

		//disconnects all nodes from source to destination
		_disconnectAll: function() {
			var l = this.nodes.length-1, i = 0;
			this.source.disconnect();
			if (!l) return;
			for (i = 0; i < l; i++) {
				if (this.nodes[i].disconnect) this.nodes[i].disconnect();
			}
		},

		//connects all nodes and plays audio
		play: function(level) {
			if (!this.paused) return;

			this._createSource();
			this._connectAll();

			///cancel possible fader automations
			this.master.gain.cancelScheduledValues(0);
			if (typeof level == "number") this.master.gain.value = level;

			this.source.start(0, this._deltaTime);
			this._playTime = this._pauseTime = this.context.currentTime;
			this.paused = false;

			return this;
		},

		///pauses audio
		pause: function (t) {
			if (this.paused) return;
			this.source.stop(0);
			// saves current time in case you want to play again.
			this._pauseTime = this.context.currentTime;
			this._deltaTime += (this._pauseTime - this._playTime);
			this._disconnectAll();
			this._destroySource();
			this.paused = true;

			return this;
		},

		///pauses audio
		stop: function (t) {
			this.source.stop(0);
			this._pauseTime = 0;
			this._deltaTime = 0;
			this._disconnectAll();
			this._destroySource();
			this.paused = true;

			return this;
		},

		toggle: function () {
			if (this.paused) this.play();
			else this.pause();

			return this;
		},

		set volume(v) {
			var gain = this.master.gain;
			gain.cancelScheduledValues(0);
			return gain.value = v;
		},
		get volume() {
			return this.master.gain.value;
		},
		///fades to level in t seconds and callback
		///FILE BUG ON FIREFOX -> NOT RETURNING gain.value correctly
		fadeTo: function (level, t, callback) {
			var gain = this.master.gain;
			if (this.paused) return;
			gain.cancelScheduledValues(0);
			gain.setValueAtTime(gain.value, this.context.currentTime);
			gain.exponentialRampToValueAtTime(level, this.context.currentTime+t);
			clearTimeout(this._fadeTimer);
			if (callback) {
				this._fadeTimer = setTimeout(callback, 1001*t);
			}
		},

		fadeIn: function (t) {
			var that = this, value;
			this.play(ZERO);
			this.fadeTo(1, t||1);
		},


		fadeOut: function (t) {
			var that = this;
			this.fadeTo(ZERO, t||1, function() {
				that.pause();
			});
		},


		///returns currentTime, or sets currenTime
		get time() {
			var that = this,
				t = this._deltaTime + this.context.currentTime - this._pauseTime;

			/// AudioContext currentTime is continuous, so we need a hack
			/// to return the right number within AudioBuffer duration limits
			function normalize_time(x) {
				var d = that.duration;
				if (x > d) return normalize_time(x - d);
				return x;
			}

			if (this.paused)
				return normalize_time(this._deltaTime);

			return normalize_time(t);
		},
		set time(t) {

			if (typeof t != "number") return;

			/// calculates negative time (if needed)
			if (t < 0) this._deltaTime = (this.duration + t);
			else this._deltaTime = t;

			if (!this.paused) {
				/// not calling this.pause() cos don't want to track as if it was paused (tempo)
				this.source.stop(0);
				this.paused = true;
				this._disconnectAll();
				this._destroySource();
				this.play();
			}


		},

		///retuns source duration
		get duration() {
			return (this._buffer) ? this._buffer.duration : 0;
		},

		//adds gain node to chain and returns it
		createGain: function() {
			var ctx = this.context,
				gain = ctx.createGain();

			this.nodes.push(gain);
			return gain;
		},

/////////////////
//////////////// TODO: implement loops
////////////////


		//adds anylyzer node to chain and returns it
		createAnalyser: function(size) {
			var ctx = this.context,
				analyser = ctx.createAnalyser();

			analyser.fftSize = size || 256;
			this.nodes.push(analyser);
			return analyser;
		},

		///create a wave view. returns a <canvas> element
		createWaveView: function(datasize) {
			var analyser = this.createAnalyser(datasize = datasize || 256),
				canvas = document.createElement("canvas"),
				gctx = canvas.getContext("2d"),
				data,
				that = this;

			analyser.smoothingTimeConstant = 0;
		 	data = new Uint8Array(datasize);
			canvas.width = gctx.width = datasize*2;
			canvas.height = gctx.height = 256;

			function render() {
				var y, h;

				analyser.getByteTimeDomainData(data);
				gctx.fillStyle = "#000";
				gctx.fillRect(0, 0, gctx.width, gctx.height);

				for (var i = 0, l = data.length; i < l; ++i) {
					gctx.fillStyle = "#F00DAA";
					gctx.fillRect(i*2, data[i], 2, 2);
				}

				/*if (!that.paused) */window.requestAnimationFrame(render);
			}


			render();

			return canvas;
		},

		//creates a frequency view. returnns a <canvas> element
		createFrequencyView: function(datasize) {
			var analyser = this.createAnalyser(datasize || 32),
				canvas = document.createElement("canvas"),
				gctx = canvas.getContext("2d"),
				data,
				that = this;

			analyser.smoothingTimeConstant = 0.85;
		 	data = new Uint8Array(analyser.frequencyBinCount);
			canvas.width = gctx.width = analyser.frequencyBinCount * 20;
			canvas.height = gctx.height = 256;

			function render() {
				var y, h;

				analyser.getByteFrequencyData(data);
				gctx.fillStyle = "#000";
				gctx.fillRect(0, 0, gctx.width, gctx.height);

				for (var i = 0, l = data.length; i < l; ++i) {
					gctx.fillStyle = "#F00DAA";
					gctx.fillRect(i*20, 255-data[i], 15, data[i]);
				}

				/*if (!that.paused) */ window.requestAnimationFrame(render);
			}


			render();

			return canvas;
		},

		//creates a level view. returns a <canvas> element
		createLevelView: function() {
			var analyser = this.createAnalyser(32),
				canvas = document.createElement("canvas"),
				gctx = canvas.getContext("2d"),
				that = this,
			 	data = new Uint8Array(analyser.frequencyBinCount);

			analyser.smoothingTimeConstant = 0.8;
			canvas.width = gctx.width = 50;
			canvas.height = gctx.height = 256;


			function render() {
				var t;

				analyser.getByteFrequencyData(data);
				gctx.fillStyle = "#000";
				gctx.fillRect(0, 0, gctx.width, gctx.height);

				t = 0;
				for (var i = 0, l = data.length; i < l; ++i) {
					if(data[i] > t) t = data[i];
				}

				gctx.fillStyle = "#F00DAA";
				gctx.fillRect(0, 255-t, 50, t);

				/*if (!that.paused) */window.requestAnimationFrame(render);
			}


			render();

			return canvas;
		}


	}; /// AudioPlus.prototype


	AudioPlus.prototype.constructor = AudioPlus;

	window.AudioPlus = AudioPlus;

}(window));