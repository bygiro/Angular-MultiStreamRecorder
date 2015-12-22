/*! angular-multistreamrecorder - v0.0.2 - 16 november 2015
* Copyright (c) G. Tomaselli <girotomaselli@gmail.com> 2015; Licensed  
* based on https://github.com/collab-project/videojs-record  */
angular.module('ByGiro.multiStreamRecorder', [])
.directive('multiStreamRecorder', ['$window','$parse', function ($window, $parse) {
  return {
    restrict: 'AE',
	scope: {
		dataVal: "=?ngModel"
	},
	template:'<video ng-if=\"opts.streamType != \'audio\'\" class=\"stream-recorder video-js vjs-default-skin {{opts.class}}\" style=\"background-color: #9FD6BA;\"></video><audio ng-if=\"opts.streamType == \'audio\'\" class=\"stream-recorder video-js vjs-default-skin {{opts.class}}\" style=\"background-color: #9FD6BA;\"></audio><br><button ng-click=upload(); ng-show=btnVisible class=\"btn btn-default\">{{opts.text.uploadBtn}}</button><div ng-show=showUploadStatus class=upload-status><span style=\"float:left; font-style: italic; font-size:70%;\">partial time left: {{timeLeft}} - speed: {{speed}}</span><br><div class=progress><div class=\"progress-bar progress-bar-primary progress-bar-striped active\" role=progressbar aria-valuenow={{completed}} aria-valuemin=0 aria-valuemax=100 style=width:{{completed}}%>{{completed}}%</div></div><span style=\"float:left; font-style: italic; font-size:70%;\">total time left: {{totalTimeLeft}}</span><br><div class=progress><div class=\"progress-bar progress-bar-success active\" role=progressbar aria-valuenow={{totalCompleted}} aria-valuemin=0 aria-valuemax=100 style=width:{{totalCompleted}}%>{{totalCompleted}}%</div></div></div><div ng-show=uploadError class=\"label label-danger\">{{opts.text.uploadError}}</div><div ng-show=uploaded class=\"label label-success\">{{opts.text.uploaded}}</div>',
    link: function (scope, elem, attrs){

		var bg = (typeof jQuery != 'undefined') ? jQuery : angular.element,
		result = '',		
		browserSupported = true,
		browserNotSupportList = {},
		customOpts = {},
		opts = {
			text: {
				uploadBtn: "Upload",
				days: "Days",
				hours: "Hours",
				minutes: "Mins",
				seconds: "Sec",
				uploadError: "Error on upload, please try again",
				uploaded: "Uploaded",
				notSupported: "Browser not supported"
			},
			streamType: 'stream', // audio, video, stream, gif, image
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
			setModel: true,
			base64Result: false, // if true the blob result will be a base64 encoded string
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

		customOpts.streamType = (customOpts.streamType || opts.streamType).toLowerCase();
		switch(customOpts.streamType){				
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
		
		function get_browser_info(){
			var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []; 
			if(/trident/i.test(M[1])){
				tem=/\brv[ :]+(\d+)/g.exec(ua) || []; 
				return {name:'IE',version:(tem[1]||'')};
				}   
			if(M[1]==='Chrome'){
				tem=ua.match(/\bOPR\/(\d+)/)
				if(tem!=null)   {return {name:'Opera', version:tem[1]};}
				}   
			M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
			if((tem=ua.match(/version\/(\d+)/i))!=null) {M.splice(1,1,tem[1]);}
			return {
			  name: M[0],
			  version: M[1]
			};
		}
		
		// todo
		browserNotSupportList = {
			"stream": {
				"Chrome": true
			},
			"video": {
				
			},
			"audio": {
				
			},
			"gif": {
				
			},
			"image": {
				
			}
		};
		
		function blobToB64(blob, cb){
			var reader = new FileReader();
			reader.onload = function(){				
				if(typeof cb == 'function'){
					cb(reader.result);
				}
			};
			reader.readAsDataURL(blob);
		};
		
		function b64toBlob(b64Data, sliceSize) {
			sliceSize = sliceSize || 512;

			b64Data = b64Data.replace(/data:/i,"").split(";base64,");
			var contentType = b64Data[0];
			b64Data = b64Data[1];
			
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
			
			if(!scope.opts.uploadUrl || scope.opts.uploadUrl == '' || !result || result == '') return;
			var blob = result;
			
			if(scope.opts.base64Result){
				// convert base64 to blob
				blob = b64toBlob(blob);
			}

			var splitAt = scope.opts.splitAt || blob.size;
				
			// let's split the blob
			fileReader = new FileReader();
			fileReader.onload = function(e){
				function _upload(blobPart) {
					return new Promise(function(resolve, reject){
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
		
		// TODO: check browser support
		var uBrowser,user = get_browser_info(),
		uncompatibility = browserNotSupportList[scope.opts.type];
		if(uncompatibility && uncompatibility[user.name]){
			uBrowser = uncompatibility[user.name];
			if(uBrowser === true || parseInt(user.version) < uBrowser){
				browserSupported = false;
			}
		}
		
		setTimeout(function(){
			if(!browserSupported){
				elem.html('<p style="font-size: 120%; color: red; text-align: center; font-style: italic;">'+ scope.opts.text.notSupported +'</p>');
				return;
			}			
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

				var callback = function(value){
					result = value;
					if(scope.opts.setModel){
						scope.dataVal = value;
					}
					
					if(value){
						if(scope.opts.uploadBtn){
							// show upload button
							scope.btnVisible = true;
						} else {
							scope.upload();
						}
					}
					
					if(scope.opts.recordOnce){
						player.recordToggle.hide();
					}

					apply();
				}
				
				var recordedData = this.recordedData;
				if(scope.opts.base64Result){
					// result as base64					
					if(scope.opts.streamType == 'image'){
						callback(recordedData);
					} else {
						blobToB64(recordedData, callback);
					}
				} else {
					// result as blob
					if(scope.opts.streamType == 'image'){
						recordedData = b64toBlob(recordedData);
					}
					
					callback(recordedData);
				}
			});		
		
		}, 50);		
    }
  };
}]);
