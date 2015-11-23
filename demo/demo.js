(function() {
	var myApp = angular.module('demoApp', ['ByGiro.multiStreamRecorder']);
	myApp.controller('demoCtrl', [
		'$scope','$window', function($scope, $window) {
			$scope.model = {};		
			
			$scope.options = {
				text: {
					uploadBtn: "Upload"
				},
				"class": "myClass",
				type: "stream",
				uploadUrl: "",	// url to upload
				uploadBtn: false,
				recordOnce: true,
				onDeviceError: function(){
					console.log('error', this);
				},
				onStartRecord: function(){
					console.log(this);
				},
				onFinishRecord: function(){
					return true;
				}
			};
		}
	]);
	myApp.filter('bytes', function() {
		return function(bytes, precision) {
			if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
			if (typeof precision === 'undefined') precision = 1;
			var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
				number = Math.floor(Math.log(bytes) / Math.log(1024));
			return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
		}
	});
})();
