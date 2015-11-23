/*! angular-multistreamrecorder - v0.0.1 - 16 november 2015
* Copyright (c) G. Tomaselli <girotomaselli@gmail.com> 2015; Licensed  
* based on https://github.com/collab-project/videojs-record  */
angular.module('ByGiro.multiStreamRecorder', [])
.directive('multiStreamRecorder', ['$window','$parse','$q', function ($window, $parse, $q) {
  return {
    restrict: 'AE',
	scope: {
		dataVal: "=?ngModel"
	},
	templateUrl: 'tmpl.html',
    link: function (scope, elem, attrs){

		var bg = (typeof jQuery != 'undefined') ? jQuery : angular.element,
		customOpts = {},
		opts = {
			text: {
				uploadBtn: "Upload",
				days: "Days",
				hours: "Hours",
				minutes: "Mins",
				seconds: "Sec",
				uploadError: "Error on upload, please try again",
				uploaded: "Uploaded"
			},
			type: 'stream', // audio, video, stream, gif, image
			"class": "",
			video: {
				controls: true,
				width: 320,
				height: 240,
				plugins: {
					record: {
						audio: true,
						video: true,
						maxLength: 10
					}
				}
			},
			splitAt: 1000, // kb
			uploadUrl: "",
			uploadBtn: false,
			recordOnce: false,
			maxLength: 10,
			onDeviceError: false,
			onStartRecord: false,
			onFinishRecord: false,
			onUploadError: false,
			onUploadCompleted: false
		},
		dataToUpload,videoElem,player,customOptsAvailable = attrs.msrOptions && scope.$parent[attrs.msrOptions];
		scope.btnVisible = false;
		scope.uploadStatus = false;
		scope.uploaded = false;
		scope.uploadError = false;
		scope.uploadBtnTemp = false;
		
		if(customOptsAvailable){
			customOpts = scope.$parent[attrs.msrOptions];
		}

		customOpts.type = (customOpts.type || opts.type).toLowerCase();
		switch(customOpts.type){				
			case 'video':
				opts.video.plugins.record.audio = false;
				break;
				
			case 'audio':
				opts.video.plugins.wavesurfer = {
					src: "live",
					waveColor: "black",
					progressColor: "#2E732D",
					cursorWidth: 1,
					msDisplayMax: 20,
					hideScrollbar: true
				}
				opts.video.plugins.record.video = false;
				break;
				
			case 'gif':
				opts.video.controlBar = {
					volumeMenuButton: false,
					fullscreenToggle: false
				}
				
				opts.video.plugins.record = {
					animation: true,
					animationQuality: 20,
					animationFrameRate: 200,
					maxLength: 5
				};
				break;
				
			case 'image':
				opts.video.controlBar = {
					volumeMenuButton: false,
					fullscreenToggle: false
				}
				
				opts.video.plugins.record = {
					image: true
				}
				break;
				
			case 'stream':
			default:
				break;
		}
		
		if(customOptsAvailable){
			scope.opts = bg.extend({},opts,customOpts);
		}
		
		if(customOpts.text){
			scope.opts.text = bg.extend({},opts.text,customOpts.text);
		}
		
		
		scope.opts.video.plugins.record.maxLength = scope.opts.maxLength;
		
		function b64toBlob(b64Data, contentType, sliceSize) {
			contentType = contentType || '';
			sliceSize = sliceSize || 512;

			var byteCharacters = atob(b64Data);
			var byteArrays = [];

			for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
				var slice = byteCharacters.slice(offset, offset + sliceSize);

				var byteNumbers = new Array(slice.length);
				for (var i = 0; i < slice.length; i++) {
					byteNumbers[i] = slice.charCodeAt(i);
				}

				var byteArray = new Uint8Array(byteNumbers);

				byteArrays.push(byteArray);
			}

			var blob = new Blob(byteArrays, {type: contentType});
			return blob;
		}
		
		function apply(){
			var phase = scope.$root.$$phase;
			if (phase != '$apply' && phase != '$digest'){
				scope.$apply();
			}
		}
		
		var done = {};		
		scope.upload = function(){
			function humanizeBytes(bytes) {
				var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
				if (bytes == 0) return '0 Byte';
				var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
				return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
			};
			
			function humanizeMillis(mill){
				var date = new Date(mill),
				days = date.getUTCDate()-1,
				hours = date.getUTCHours(),
				minutes = date.getUTCMinutes(),
				seconds = date.getUTCSeconds(),
				str = [];
				
				if(days) str.push(days +" "+ scope.opts.text.days);				
				if(hours) str.push(hours +" "+ scope.opts.text.hours);				
				if(minutes) str.push(minutes +" "+ scope.opts.text.minutes);				
				
				str.push(seconds +" "+ scope.opts.text.seconds);				
				
				return str.join(", ");
			}			
			
			if(!scope.opts.uploadUrl || scope.opts.uploadUrl == '' || !scope.dataVal || scope.dataVal == '') return;
			var blob = scope.dataVal;
			
			if(scope.opts.type == 'image'){
				// convert base64 image to blob
				blob = blob.split('base64,');
				blob = b64toBlob(blob[1]);
			}

			var splitAt = scope.opts.splitAt || blob.size;
				
			// let's split the blob
			fileReader = new FileReader();
			fileReader.onload = function(e){
				function _upload(blobPart) {
					return new Promise(function(resolve, reject){
						console.log(blobPart.index, blobPart.data.size);
						var doneLength = Object.keys(done).length,
						formData = new FormData();
						formData.append('index', blobPart.index);
						formData.append('data', blobPart.data);

						// hide upload button
						scope.btnVisible = false;
						apply();

						var request = new XMLHttpRequest();

						request.onreadystatechange = function(){		
							if (request.readyState == 4){ // request completed
								if(request.status == 200){
									
									done[blobPart.index]='ok';
									// sigle upload completed
									if(doneLength >= totalChunks){
										
										if(typeof scope.opts.onUploadCompleted == 'function'){
											scope.opts.onUploadCompleted();
										}
										
										// upload process completed
										scope.showUploadStatus = false;
										scope.uploaded = true;
										apply();
									}
									
									resolve(request.response); // data sent, so resolve the Promise
								} else {
									// some error, re-enable the upload
									scope.showUploadStatus = false;
									scope.btnVisible = true;
									
									// show error
									scope.uploadError = true;
									
									apply();
									
									if(typeof scope.opts.onUploadError == 'function'){
										scope.opts.onUploadError(request);
									}
									reject(request); // if status is not 200 OK, reject.
								}
							}
						};
						
						var now,speed,timeSpent,timeStarted = new Date().getTime(),
						speedHumanized = '0 kb',
						timeLeft = '',
						completed = 0,
						previousUploadedData = 0;
						
						scope.speed = speedHumanized +'/sec';
						scope.timeLeft = timeLeft;
						scope.completed = completed;
						scope.totalCompleted = completed;
						
						request.upload.onprogress = function(progress){
							if(totalChunks > 1){
								previousUploadedData = doneLength * bytes;
							}
							
							now = new Date().getTime();
							timeSpent = now - timeStarted;
							completed = parseInt((progress.loaded * 100) / progress.total);
							totalCompleted = parseInt(((progress.loaded + previousUploadedData) * 100) / totalSize);
							speed = progress.loaded * 1000 / timeSpent;
							timeLeft = humanizeMillis(parseInt(((progress.total - progress.loaded) / speed) * 1000));
							totalTimeLeft = humanizeMillis(parseInt(((totalSize - (progress.loaded + previousUploadedData)) / speed) * 1000));
							speedHumanized = humanizeBytes(speed);
							
							scope.speed = speedHumanized +'/sec';
							scope.timeLeft = timeLeft;
							scope.totalTimeLeft = totalTimeLeft;
							scope.completed = completed;
							scope.totalCompleted = totalCompleted;

							apply();
						}		
						
						request.onerror = function() {
						  reject(Error("Error fetching data.")); // error occurred, so reject the Promise
						};

						request.open('POST', scope.opts.uploadUrl);
						request.send(formData); // send the request
					});
				}						
				
				var arrayBuffer = new Uint8Array(this.result),
				bytes = splitAt *1000,
				k=0,
				totalSize = arrayBuffer.length,
				totalChunks = parseInt(arrayBuffer.length / bytes);
				
				scope.showUploadStatus = true;
				scope.uploadError = false;
				
				var blobs = [],k=0; // initial Promise always resolves
				for (var i=0; i < arrayBuffer.length; i += bytes){
					k++;
					if(typeof done[k] != 'undefined') continue;
					var blobChunk = new Blob([arrayBuffer.subarray(i, i + bytes)]);					
					blobs.push({
						data: blobChunk,
						index: k
					});
				}

				blobs.reduce(function(p, item) {
					return p.then(function() {
						return _upload(item);
					});
				}, Promise.resolve());

			};
			fileReader.readAsArrayBuffer(blob);
		}
		
		setTimeout(function(){		
			videoElem = elem[0].querySelectorAll('.stream-recorder')[0];
			player = videojs(videoElem,scope.opts.video);
			
			// error handling
			player.on('deviceError',function(){				
				if(typeof scope.opts.onDeviceError == 'function'){
					scope.opts.onDeviceError.apply(this);
				}
			});
			
			// user clicked the record button and started recording
			player.on('startRecord', function(){
				if(scope.opts.uploadBtn){
					
					// new recording so empty the "done" variable
					done = {};
					
					// hide upload button
					scope.btnVisible = false;
					scope.uploaded = false;
					scope.uploadBtnTemp = false;
					scope.uploadError = false;
	
					apply();
				}
				
				if(typeof scope.opts.onStartRecord == 'function'){
					scope.opts.onStartRecord.apply(this);
				}
			});
			
			
			// user completed recording and stream is available
			player.on('finishRecord', function()
			{				
				if(typeof scope.opts.onFinishRecord == 'function'){
					scope.opts.onFinishRecord.apply(this);					
				}

				// the blob object contains the recorded data that
				// can be downloaded by the user, stored on server etc.
				scope.dataVal = this.recordedData;
				
				if(this.recordedData){				
					if(scope.opts.uploadBtn){
						// show upload button
						scope.btnVisible = true;
					} else {
						scope.upload();
					}
				}
				
				if(scope.opts.recordOnce){
					this.recordToggle.hide();
				}

				apply();
			});		
		
		}, 50);		
    }
  };
}]);
