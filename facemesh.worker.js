
importScripts('lib/tf.js');
importScripts('lib/facemesh/facemesh.js');

// tf.setBackend('cpu');

var facemeshTensorFlowModel;

onmessage = function(e) {
	// console.log('Message received from main script', e.data);
	if (e.data.type === "LOAD") {
		facemesh.load(e.data.options).then((model)=> {
			facemeshTensorFlowModel = model;
			postMessage({type: "LOADED"});
		});
	} else if (e.data.type === "ESTIMATE_FACES") {
		facemeshTensorFlowModel.estimateFaces(e.data.imageData).then((predictions)=> {
			postMessage({type: "ESTIMATED_FACES", predictions});
		}, (error)=> {
			console.log(error);
		});
	}
};
