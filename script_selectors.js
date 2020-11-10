let canusb;
let webusb;

let init = async () => {
	try {
		webusb = await flCAN.open();
	}
	catch(error) {
		console.log(error);
	}
};
let settings = {
		Bitrate: 500000, 
		Mode: 0, 
		Protocol: flCAN.WebUSB.Transport.protocols.SAE_J1939,
};

let auth = async (seed) => {
	return new Uint32Array([seed]);
};

let find = async () => {
	if (!webusb) {
		console.log("No device Connected");
		return;
	}

	let bms = null; 
	
	await webusb.prepTransport(settings, auth);
	bms = await webusb.connectBMS(0x23).catch((e) => console.log("No BMS at addr:" + e.stack));
	console.log(bms);
	// TODO: fix in BMS firmware, do not use for now
	// all BMS will respond to all requests
	// for (var i = 0; i < 254; ++i) {
		
	// 		let ecu = await webusb.connectBMS(i).catch(() => console.log("No BMS at addr:" + i));
	// 		if (ecu) {
	// 			bms = ecu;
	// 		}
	// }
};

document.querySelector("#connect").onclick = init;
document.querySelector("#find").onclick = find;