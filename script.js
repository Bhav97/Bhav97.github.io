// class FLCANdevice {
// 	constructor() {

// 	}

// 	get bitrate() {
// 		return this
// 	}
// }
const FLCAN_CMD_FLUSH_HOSTQ 	= 0x00; //impl
const FLCAN_CMD_FLUSH_DEVQ 		= 0x01; //impl
const FLCAN_CMD_SET_BITRATE 	= 0xAA;
const FLCAN_CMD_GET_BITRATE		= 0xAB;
const FLCAN_CMD_SET_MODE 		= 0x11;
const FLCAN_CMD_GET_MODE 		= 0x12;
const FLCAN_CMD_SET_CHG			= 0x22; //impl
const FLCAN_CMD_GET_CHG			= 0x23; //impl
const FLCAN_CMD_START 			= 0x33; //impl
const FLCAN_CMD_STOP 			= 0x34; //impl
const FLCAN_CMD_GET_STATS 		= 0xEE;
const FLCAN_CMD_GET_FEATURES 	= 0xE4;

var device;
navigator.usb.addEventListener('connect', (evt) => {
	this._attach(evt.device);
});

navigator.usb.addEventListener('disconnect', (evt) => {
	this._detach(evt.device);
});


function flush_queue_usb()
{
	device.controlTransferOut({
		requestType: 'class',
		recipient: 'interface',
		request: FLCAN_CMD_FLUSH_HOSTQ,
		value: 0x00,
		index: 0x00
	})
	.then( ()=>{ _write("[!] Flushed device USB queue\n") } )
	.catch( ()=>{ _write("[!]" + err + "\n") } );
}

function flush_queue_can()
{
	device.controlTransferOut({
		requestType: 'class',
		recipient: 'interface',
		request: FLCAN_CMD_FLUSH_DEVQ,
		value: 0x00,
		index: 0x00
	})
	.then( ()=>{ _write("[!] Flushed device CAN queue\n"); } )
	.catch( (err)=>{_write("[!]" +  err + "\n"); } );
}

function appendtext() {
	document.getElementsByName("command")[0].value
	.replace(/ /g,"")
	.split(",")
	.forEach((val)=>{ 
		console.log(parseInt(val)); 
	});
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
	.catch(error => { _write("[!] " + error + "\n") });
}

function _clear() {
	document.getElementById("console").innerHTML = "";
}

function _write(str) {
	document.getElementById("console").appendChild(document.createTextNode(str));
}

var buf;

function _auth() {
	device.controlTransferIn({
		requestType: 'class',
		recipient: 'interface',
		request: 0x23,
		value: 0x00,
		index: 0x00
	}, 4)
	.then((res)=>{
		let decoder = new TextDecoder();
		console.log(res.data.buffer);
		buf = res.data;
		device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x22,
			value: 0x00,
			index: 0x00
		}, res.data.buffer);
		console.log(decoder.decode(res.data));
	})
	.then(()=>{ _write("[!] Authenticated!\n"); })
	.catch((err)=>{ _write("[!] " + err + "\n"); });
}


function _start() {
	var button = document.getElementById("toggle");
	if ( button.innerHTML == "Start" )
	{
		device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: FLCAN_CMD_START,
			value: 0x00,
			index: 0x00
		})
		.then( ()=>{ 
			_write("[!] Activating CAN peripheral\n");
			button.innerHTML = "Stop";
		})
		.catch( (err)=>{ _write("[!]" + err); } );
	}
	else if ( button.innerHTML == "Stop" )
	{
		device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: FLCAN_CMD_STOP,
			value: 0x00,
			index: 0x00
		})
		.then( ()=>{ 
			_write("[!] Deactivating CAN peripheral\n");
			button.innerHTML = "Start";
		})
		.catch( (err)=>{ _write("[!]" + err); } );
	}
	else{
		console.log(button.innerHTML);
	}// do nothing
}

//{ vendorId: 0xcafe}
function _scan() {
	_clear();
	navigator.usb.requestDevice({ filters: [{ vendorId: 0xb00b }] })
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
