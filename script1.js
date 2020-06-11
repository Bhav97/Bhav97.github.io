var flcan = {};

(function() {
	'use strict';

	flcan.getDevices = function() {
		return navigator.usb.getDevices().then(devices => {
			return devices.map(device => new flcan.Port(device));
		});
	};

	flcan.requestPort = function() {
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

		return this.device_.open()
		.then(() => {
			if (this.device_.configuration == null) {
				return this.device_.selectConfiguration(1);
			}
		})
		.then(() => this.device_.claimInterface(0))
		.then(() => this.device_.claimInterface(1))
		.then(() => this.authenticate());
	};

	flcan.Port.prototype.start = function() {
		this.device_.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x08,
			value: 0x00,
			index: 0x00
		})
		.then(() => {
			readLoop();
		})
	};

	flcan.Port.prototype.authenticate = function(first_argument) {
		return this.device_.controlTransferIn({
			requestType: 'class',
			recipient: 'interface',
			request: 0x07,
			value:0x00,
			index: 0x00
		}, 4)
		.then((res) => {
			console.log(res.data);
			this.device_.controlTransferOut({
					requestType: 'class',
					recipient: 'interface',
					request: 0x06,
					value: 0x00,
					index: 0x00
				}, res.data);
		})
		.then(() => {
			console.log("Authenticated !");
		});
	};

	flcan.Port.prototype.flush_can = function() {
		return this._device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x01,
			value: 0x00,
			index: 0x00
		});
	};

	flcan.Port.prototype.flush_usb = function() {
		return this._device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x00,
			value: 0x00,
			index: 0x00
		});
	};

	flcan.Port.prototype.flush = function() {
		this.flush_usb()
		.then(() => this.flush_can())
		.then(() => console.log("Flushed queues!"))
		.catch((err) => console.log(err));
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

function connect() {
	port.connect().then(() => {
		port.onReceive = data => {
			let textDecoder = new TextDecoder();
			str = textDecoder.decode(data);
			if (str != "")
				_write("IN> " + str + "\n");
		}

		port.onReceiveError = error => {
			console.error(error);
		}
	});
}

function send(string) {
	console.log("sending: " + string.length + " bytes");
	if (string.length == 0)
		return;

	console.log("sending: [ " + string + " ]\n");
	_write("OUT> " + string + "\n");
	let view = new TextEncoder('utf-8').encode(string);
	console.log(view);
	if (port) {
		port.send(view);
	}
}

function _clear() {
	document.getElementById("console").innerHTML = "";
	// docuemnt.
}

function _write(str) {
	document.getElementById("console").appendChild(document.createTextNode(str));
}

window.onload = _ => {
	document.querySelector("#connect").onclick = function() {
		flcan.requestPort().then(selectedPort => {
			port = selectedPort;
			_clear();
		_write("PRODUCT: " + port.device_.productName + "\n");
		_write("VENDOR: " + port.device_.manufacturerName + "\n");
		_write("SERIAL: " + port.device_.serialNumber.toString(16) + "\n");
			this.style = "visibility: hidden";
			connect();
		});
	}

/// DEVELOPMENT BUILD ONLY
/// Use these for advanced controls
	document.querySelector("#auth").onclick = function() {
		// communicate with backend

	}


	document.querySelector("#start").onclick = function() {

	}

	document.querySelector("#fcan").onclick = function() {

	}

	document.querySelector("#fusb").onclick = function() {

	}
/// END DEVELOPMENT BUILD ONLY

	document.querySelector("#send").onclick = () => {
		let source = document.querySelector("#command").value;
		send(source);
	}

}