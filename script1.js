var flcan = {};

(function() {
	'use strict';

	flcan.opcodes = Object.freeze({
	"FLCAN_CMD_FLUSH_HOSTQ" 	: 0x00,
	"FLCAN_CMD_FLUSH_DEVQ" 		: 0x01,
	"FLCAN_CMD_SET_BITRATE" 	: 0x02,
	"FLCAN_CMD_GET_BITRATE"		: 0x03,
	"FLCAN_CMD_SET_MODE" 		: 0x04,
	"FLCAN_CMD_GET_MODE"		: 0x05,
	"FLCAN_CMD_SET_CHG"			: 0x06,
	"FLCAN_CMD_GET_CHG"			: 0x07,
	"FLCAN_CMD_START"			: 0x08,
	"FLCAN_CMD_STOP"			: 0x09,
	"FLCAN_CMD_GET_STATS" 		: 0x0A,
	"FLCAN_CMD_GET_FEATURES" 	: 0x0B,
	});

	flcan.status = {
		"device": 0,
		"driver": 0
	};

	flcan.getDevices = () => {
		return navigator.usb.getDevices().then(devices => {
			return devices.map(device => new flcan.Port(device));
		});
	};

	flcan.requestPort = () => {
		const filters = [
			{ 'vendorId': 0xB00B, 'productID': 0x1EE5 },
			/* Add more here */
		];
		return navigator.usb.requestDevice({ 'filters': [] }).then(
			device => new flcan.Port(device)
		);
	}

	flcan.Port = function(device) {
		this.device_ = device;
		this.packet_rx = { metadata: null, data: null };
		this.packet_tx = { metadata: null, data: null };
	};

	flcan.Port.prototype.connect = function() {
		return this.device_.open()
		.then(() => {
			if (this.device_.configuration == null) {
				return this.device_.selectConfiguration(1);
			}
		})
		.then(() => this.device_.claimInterface(0))
		.then(() => this.device_.claimInterface(1));
	};

	flcan.Port.prototype.sendCommand = function(opcode, data) {
		if (data === undefined)
		{ // No DATA stage
			return this.device_.controlTransferOut({
				requestType: 'class',
				recipient: 'interface',
				request: opcode,
				value: 0,
				index: 0
			});
		}
		else if (Number.isInteger(data)) 
		{ // command is expecting DATA stage
			return this.device_.controlTransferIn({
				requestType: 'class',
				recipient: 'interface',
				request: opcode,
				value: 0,
				index: 0
			}, data);
		}
		else if ( data.buffer instanceof ArrayBuffer )
		{ // command generates DATA stage
			return this.device_.controlTransferOut({
				requestType: 'class',
				recipient: 'interface',
				request: opcode,
				value: 0,
				index: 0
			}, data.buffer);
		}
		else {
			console.log(data);
			throw new TypeError('Invalid Argument. Not of type Int or ArrayBuffer');
		}
	}

	flcan.Port.prototype.clearRxPacket = function() {
		this.packet_rx.metadata = null;
		this.packet_rx.data = null;
	}

	flcan.Port.prototype.clearTxPacket = function() {
		this.packet_tx.metadata = null;
		this.packet_tx.data = null;
	}

	flcan.Port.prototype.stop = function() {
		return this.sendCommand(flcan.opcodes.FLCAN_CMD_STOP)
		.then(this._stop = true)
	}

	flcan.Port.prototype.start = async function() {
		let readLoop = async () => {
			while (this.read) {
				const { endpointNumber } = this.device_.configuration.interfaces[0].alternate.endpoints[0]
				var buffer = await this.device_.transferIn(endpointNumber, 12);
				if (!buffer) continue;
				this.packet_rx.metadata = buffer.data;
				
				buffer = await this.device_.transferIn(endpointNumber, 64);
				if (!buffer) continue;
				this.packet_rx.data  = buffer.data;

				this.onReceive(this.packet_rx);
			}
		};

		var res = await this.selectProtocol()
		console.log("selectProtocol:", res);
		res = await this.sendCommand(flcan.opcodes.FLCAN_CMD_START)
		console.log("FLCAN_CMD_START:", res);
		this.read = true;
		res = await this.identify(0x23);
		console.log("identify:", res);
		readLoop();
	};

	flcan.Port.prototype.selectProtocol = function() {
		return this.sendCommand(0x0C, new Uint8Array([1]));

	};

	flcan.Port.prototype.wake = function(addr) {
		return this.sendCommand(0x10) /* wakeup */
		// .then(sleeper(1000)) /* wait 1 sec */
		// .then(this.sendCommand(0x0E, new Uint8Array([addr]))) /* authenticate */
		// .then(sleeper(10000))  wait 1 sec 
		// .then(this.sendCommand(0x0F, new Uint8Array([addr]))) /* synchronize */
		// .then(sleeper/(500)); /* wait 1 sec */
	};

	flcan.Port.prototype.south = function(ddr) {
		return this.sendCommand(0x0E, new Uint8Array([ddr]));
	}

	flcan.Port.prototype.sync = function(addr) {
		return this.sendCommand(0x0F, new Uint8Array([addr]));
	}	

	flcan.Port.prototype.sleep = function(addr) {
		return this.sendCommand(0x12, new Uint8Array([addr]));
	}

	flcan.Port.prototype.identify = function(addr) {
		return this.sendCommand(0x11, new Uint8Array([addr]));
	}

	flcan.Port.prototype.authenticate = function() {
		return this.sendCommand(flcan.opcodes.FLCAN_CMD_GET_CHG, 4)
		.then(token => this.onAuthTokenFetch(token.data))
		.then(key => this.sendCommand(flcan.opcodes.FLCAN_CMD_SET_CHG, key));
	};

	flcan.Port.prototype.flush_can = function() {
		return this.sendCommand(flcan.opcodes.FLCAN_CMD_FLUSH_DEVQ);
	};

	flcan.Port.prototype.flush_usb = function() {
		return this.sendCommand(flcan.opcodes.FLCAN_CMD_FLUSH_HOSTQ);
	};

	flcan.Port.prototype.flush = function() {
		return this.flush_can().then(this.flush_usb());
	};

	flcan.Port.sendFOTAPhrase = async function() {
		return 
	}

	flcan.Port.prototype.disconnect = function() {
		return this.device_.close();
	};

	flcan.Port.prototype.send = function(metadata, data) {
		const {
			endpointNumber
		} = this.device_.configuration.interfaces[0].alternate.endpoints[1]
		return this.device_.transferOut(endpointNumber, metadata)
		.then(()=> this.device_.transferOut(endpointNumber, data))
		.catch(err => { console.log(err); });
	};

	flcan.Port.prototype.desync = function(addr) {
		return this.sendCommand(0x13, new Uint8Array([addr]));
	};

})();

let port;
let t;
bms_info = {}

/* https://stackoverflow.com/questions/38956121/how-to-add-delay-to-promise-inside-then */
function sleeper(ms) {
  return function(x) {
    return new Promise(resolve => setTimeout(() => resolve(x), ms));
  };
}

function connect() {
	port.connect().then(() => {
		port.onReceive = data => {
			if (port.ota_start !== undefined) {

			}
			// console.log("onReceive");
			// console.log(data);

			// let time = data.getUint32(0, true);
			// let canid = data.getUint32(4, true);
			// let dlc = data.getUint8(8, true);
			// _write("IN> ID: " + canid + ", DLC:  " + dlc + "[");
			// for (var i = 0; i < dlc; i++) {
			// 	_write(data.getUint8(12 + i));
			// }
			// _write("]\n");
			// str = new TextDecoder().decode(data["buffer"].slice(12, 12+dlc));
			// if (str != "") {
			// 	t = data;
			// 	_write("IN> ID: " + canid + ", DLC: " + dlc +"[" + str +"]\n");
			// }
			try {
				var canid = data.metadata.getUint32(4, true); //?little endian
			} catch(err) {
				return;
			}
			console.log(canid.toString(16));
			// return;
			if ((canid & 0x00ffff) != 0xff33) {
				if ((canid & 0x00ffff) == 0xfffc) {
					console.log("Heartbeat!");
				} else {
					console.log(canid.toString(16));
				}
				return;
			}
			var recvdata = data.data;
			try {
				var timestamp = data.metadata.getUint32(0, true); //?little endian
				var dlc = data.metadata.getUint8(8);
				// console.log(timestamp.toString(16));
				// console.log(canid.toString(16));
				// console.log(dlc);
				_write("IN["+ timestamp +"]> " + canid.toString(16) + ": " + recvdata.getUint8(0) +"\n");
				parseData(recvdata.getUint8(0), recvdata);
			}
			catch(err)
			{ console.log(err);}

		}

		port.onReceiveError = error => {
			_write("[!] " + error + "\n");
		}

		port.onAuthTokenFetch = token => {
			console.log("Fetching key for token");
			return token;
		}
	});
}

function parseData(gf, data) {
	console.log("Parsing");
	switch(gf) {
		case 1: {
			// voltages
			// if (bms_info.series === undefined) {
			// 	break;
			// }

			s = { timestamp: 0, cellVoltages: [] };
			s.timestamp = data.getUint32(1, true);
			for (var i = 0; i < 14; i++) {
				s.cellVoltages.push(data.getUint16(5 + i*2, true));
			}
			console.log(JSON.stringify(s));
			break;
		}

		case 2: {
			// temperature
			if (bms_info.series === undefined) {
				break;
			}
			var s = { timestamp: 0, temperatures: []};
			s.timestamp = data.getUint32(1, true);
			for (var i = 0; i < bms_info.therm_count; i++) {
				s.temperatures.push( data.getInt16(5 + i*2, true).toString());
			}
			console.log(JSON.stringify(s));
			break;
		}

		case 3: {
			//misc
			var s 			= {};
			s.timestamp 	= data.getUint32(1, true);
			s.isenseCurrent = data.getInt32(5, true);
			s.SOC 			= data.getFloat32(9, true);
			s.SOH 			= data.getFloat32(13, true);
			s.stackVoltage 	= data.getUint16(17, true);
			console.log(JSON.stringify(s));
			// console.log();
			break;
		}

		case 4: {
			//stats
			var s = {};
			s.timestamp = data.getUint32(1, true);
			s.balancing = [];
			for (var i = 0; i < 14; ++i) {
				s.balancing.push(data.getUint8(5+i))
			}
			s.mosfets = [];
			for (var i = 0; i < 3; ++i) {
				s.mosfets.push(data.getUint8(19+i))
			}
			console.log(JSON.stringify(s))
			break;
		}

		case 5: {
			//capacity
			break;
		}

		case 6: {
			//

			break;
		}
		case 7: {
			//fault frame
			console.log(data.getUint8(5).toString(2));
			break;
		}

		case 8: {
		/*
		 	uint8_t batt_id[20];
			uint8_t bms_ver;
			uint8_t warranty;
			uint8_t str_series;
			uint8_t str_parallel;
			uint16_t design_cap;
		*/
			bms_info.id = new TextDecoder().decode(data["buffer"].slice(5, 25));
			bms_info.version =  data.getUint8(25);
			bms_info.warranty = data.getUint8(26);
			bms_info.series = data.getUint8(27);
			bms_info.parallel = data.getUint8(28);
			if ( bms_info.id == "HRYYHW0XDZUT7SXYGM28" ) {
				bms_info.therm_count = 7;
			} else {
				bms_info.therm_count = 0;
			}
			console.log(bms_info);
			// bms_info.des_cap = data.getUint16(30, true);
			break;
		}
	}
}

function send(canid, data, dlc) {
	// _write("OUT> " + string + "\n");
	// let view = new TextEncoder('utf-8').encode(string);
	// /* Data Packet Struct */
// typedef struct {
// 		uint32_t timestamp;
// 		canid_t id;
// 		uint8_t dlc;
// 		uint8_t _[3]; /* padding */
// } FLCAN_MetadataPdu_t;]
	console.log(canid);
	console.log(data);
	var metadata = new Uint8Array([ 0,0,0,0, canid & 0xFF, (canid >> 8) & 0xFF, (canid >> 16) & 0xFF, (canid >> 24) & 0xFF, dlc ]);
	// console.log()
	// console.log(packet);
	if (port) {
		port.send(metadata, new Uint8Array(data));
	}
}

function _clear() {
	document.getElementById("console").innerHTML = "";
}

function _write(str) {
	document.getElementById("console").appendChild(document.createTextNode(str));
}

window.onload = _ => {
	document.querySelector("#connect").onclick = function() {
		if (this.innerHTML == "Connect" ) 
		{
			flcan.requestPort().then(selectedPort => { 
				port = selectedPort; 
				_clear();
				_write("PRODUCT: " + port.device_.productName + "\n")
				_write("VENDOR: " + port.device_.manufacturerName + "\n")
				_write("SERIAL: " + port.device_.serialNumber.toString(16) + "\n")
				this.innerHTML = "Disconnect"
				 connect() 
				});
		}
		else if (this.innerHTML == "Disconnect" ) 
		{
			port.disconnect()
			.then( () => {
				_write("[!] Disconnected from " + port.device_.productName + "\n"); 
				this.innerHTML = "Connect"
			})
			.catch( _write("[!] Error while disconnecting from " + port.devie_.productName + "\n") );
		}
	}

	document.querySelector("#auth").onclick = function() {
		port.authenticate().then(_write("[!] AUTHENTICATED!\n"));
	}


	document.querySelector("#start").onclick = function() {
		if (this.innerHTML == "Start" ) 
		{
			port.start()
			.then(_write("[!] Activating CAN peripheral\n"))
			.then( this.innerHTML = "Stop" );
		} 
		else if (this.innerHTML == "Stop")
		{
			port.stop()
			.then(_write("[!] Deactivating CAN peripheral\n"))
			.then( this.innerHTML = "Start" );
		}
	}

	document.querySelector("#flush").onclick = function() {
		port.sleep()
		.then( _write("[!] Flushing device queues\n") );
	}

	document.querySelector('#fw').addEventListener('input', (e) => {
		console.log(e.target.value);
	})

	var dnd = new DnDFileController('body', function(data) {

	var file = data.files[0];
	var reader = new FileReader();
	reader.onload = function(progressEvent) {
		var lines = this.result.split('\n');
		for(var line = 0; line < lines.length; line++){
			console.log(lines[line]);
			port.sendFOTAPhrase(lines[line]);
		}
	}
	reader.readAsText(file);

	// for (var i = 0; i < data.items.length; i++) {
	// 	var item = data.items[i];
	// 	console.log(item)
	// 	if (item.kind == 'file' && item.type.match('\*\.srec') && item.webkitGetAsEntry()) {
	// 			chosenEntry = item.webkitGetAsEntry();
	// 			break;
	// 	}
	// };

	// if (!chosenEntry) {
	// 	console.log("Sorry. That's not a text file.");
	// 	return;
	// }
	});

	document.querySelector("#send").onclick = () => {
		let id = parseInt(document.querySelector("#id").value);
		let data = document.querySelector("#data").value.split(",").slice(0,8).map(num => parseInt(num));
		let dlc = data.length;
		send(id, data, data.length);
	}

	document.querySelector("#data").oninput = function inputparser() {
		byte_fields = [
			document.querySelector("#byte0"),
			document.querySelector("#byte1"),
			document.querySelector("#byte2"),
			document.querySelector("#byte3"),
			document.querySelector("#byte4"),
			document.querySelector("#byte5"),
			document.querySelector("#byte6"),
			document.querySelector("#byte7") 
		];
		byte_fields.forEach(elm => elm.value = "");

		this.value.split(",").slice(0,8).forEach((byte, idx) => {
			byte_fields[idx].value = parseInt(byte) & 0xFF;
		});
	}

}