// class FLCANdevice {
// 	constructor() {

// 	}

// 	get bitrate() {
// 		return this
// 	}
// }

var device;
navigator.usb.addEventListener('connect', (evt) => {
	this._attach(evt.device);
});

navigator.usb.addEventListener('disconnect', (evt) => {
	this._detach(evt.device);
});



function appendtext() {
	// document.getElementById("console").appendtext()
}

function _send() {
	if (device === undefined) {
		this.echo("Please connect to a device first")
		return;
	}
}

function _recv() {
	if (device === undefined) {
		this.echo("Please connect to a device first")
		return;
	}
}

function _detach(device) {
	console.log(device);
}

function _attach(device) {
	console.log(device);
	if (!device)
		return;

	device.open()
	.then(() => { device.selectConfiguration(1); })
	.then(() => { device.claimInterface(0); })
	.catch(error => { console.log(error) });
}

function _clear() {
	document.getElementById("console").innerHTML = "";
}

function _write(str) {
	document.getElementById("console").appendChild(document.createTextNode(str));
}

function _auth() {

}

//{ vendorId: 0xcafe}
function _scan() {
	_clear();
	navigator.usb.requestDevice({ filters: [{ vendorId: 0xdeeb }] })
	.then(d => {
		device = d;
		_write("PRODUCT: " + device.productName + "\n");
		_write("VENDOR: " + device.manufacturerName + "\n");
		_write("SERIAL: " + device.serialNumber.toString(16) + "\n");
		_attach(device);
	})
	.catch(error => { _write(error); });
}

function _authenticate() {

}

function _setbitrate() {

}

function _get() {

}

function sendBeef() {
	if (!g_Device) {
		alert("Setup Device first!");
		return;
	}

	const payload = new ArrayBuffer(8);

	g_Device.controlTransferOut({ 
		requestType: 'class', 
		recipient: 'interface', 
		request: 0xAB, 
		index: 0x00, 
		value: 0x0F 
	}, str2ab("helloworld"))
	.catch(error=> { console.log(error); });
}


function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}