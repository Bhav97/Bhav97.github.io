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
		return navigator.usb.requestDevice({ 'filters': filters }).then(
			device => new flcan.Port(device)
		);
	}

	flcan.Port = function(device) {
		this.device_ = device;
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

	flcan.Port.prototype.start = function() {
		let readLoop = () => {
			const {
				endpointNumber
			} = this.device_.configuration.interfaces[0].alternate.endpoints[0]
			this.device_.transferIn(endpointNumber, 64).then(result => {
				this.onReceive(result.data);
				readLoop();
			}, error => {
				this.onReceiveError(error);
			});
		};

		return this.sendCommand(flcan.opcodes.FLCAN_CMD_START)
		.then(() => {
			readLoop();
		})
	};

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

	flcan.Port.prototype.disconnect = function() {
		return this.device_.close();
	};

	flcan.Port.prototype.send = function(data) {
		const {
			endpointNumber
		} = this.device_.configuration.interfaces[0].alternate.endpoints[1]
		return this.device_.transferOut(endpointNumber, data);
	};
})();

let port;
let t;

function connect() {
	port.connect().then(() => {
		port.onReceive = data => {
			console.log(data.buffer);

			let time = data.getUint32(0, true);
			let canid = data.getUint32(4, true);
			let dlc = data.getUint8(8, true);
			_write("IN> ID: " + canid + ", DLC:  " + dlc + "[");
			for (var i = 0; i < dlc; i++) {
				_write(data.getUint8(12 + i));
			}
			_write("]\n");
			str = new TextDecoder().decode(data["buffer"].slice(12, 12+dlc));
			if (str != "") {
				t = data;
				_write("IN> ID: " + canid + ", DLC: " + dlc +"[" + str +"]\n");
			}
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

function send(data) {
	// _write("OUT> " + string + "\n");
	// let view = new TextEncoder('utf-8').encode(string);
	console.log(data);
	if (port) {
		port.send(data);
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
				_clear()
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
			port.start()
			.then(_write("[!] Deactivating CAN peripheral\n"))
			.then( this.innerHTML = "Start" );
		}
	}

	document.querySelector("#flush").onclick = function() {
		port.flush()
		.then( _write("[!] Flushing device queues\n") );
	}

	document.querySelector("#send").onclick = () => {
		let id = parseInt(document.querySelector("#id").value);
		let data = document.querySelector("#data").value.split(",").slice(0,8).map(num => parseInt(num)).reverse();
		let dlc = data.length;


		/* push reserved bytes */
		data.push(0);
		data.push(0);
		data.push(0);
		/* push dlc */
		data.push(dlc);
		/* push MSB first */
		data.push(id >> 24);
		data.push(id >> 16);
		data.push(id >> 8);
		data.push(id >> 0);
		/* push fake timestamp */
		data.push(0);
		data.push(0);
		data.push(0);
		data.push(0);
		// console.log(data);
		/* push data */
		// byte_fields.forEach((field, idx) => {
		// 	data.push(parseInt(field.value));
		// });
		send(new Uint8Array(data).reverse());
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