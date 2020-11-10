// SPDX-License-Identifier: MIT
// CC: webadb dev

(function(root, factory) {
	if (typeof define == 'function' && define.amd) {
		define([], factory);
	} else if (typeof exports === 'object') {
		module.exports = factory();
	} else {
		root.flCAN = factory();
	}
} (this, function() {
	// daddy please
	'use strict';

	let flCAN = {};

	flCAN.Opt = {};
	flCAN.Opt.debug = true;
	flCAN.Opt.dump = true;
	flCAN.Opt.seed_size = 4;
	// TODO: add parseable message to check endianess
	flCAN.Opt.le = true;

	flCAN.open = function() {
		// TODO: add support for more transports
		// js -> native code running a local server
		// js -> cloud
		return flCAN.WebUSB.Transport.open();
	};

	flCAN.WebUSB = {};

	flCAN.WebUSB.Transport = function(device) {
		this.device = device;

		if (flCAN.Opt.debug)
			console.log(this);
	};

	// function: open
	// open USB device and instantiate Transport
	flCAN.WebUSB.Transport.open = function() {
		// TODO: update filter
		let filters = [
			{ 'vendorId': 0xB00B, 'productID': 0x1EE5 },
			{ 'vendorId': 0xC007, 'productID': 0x1EE5 }
		];

		return navigator.usb.requestDevice({ filters: filters })
				.then(device => device.open()
					.then(() => new flCAN.WebUSB.Transport(device)));
	};

	// List of commands for the transport
	flCAN.WebUSB.Transport.prototype.Cmds = {
		Flush_HOSTQ 	: 0x00, // Flush USB -> CAN queue
		Flush_DEVQ 		: 0x01, // Flush CAN -> CAN queue
		Bitrate_SET 	: 0x02, // Set CAN Bitrate
		Bitrate_GET 	: 0x03, // Get CAN Bitrate
		Mode_SET 		: 0x04, // Set CAN peripheral MODE
		Mode_GET 		: 0x05, // Get CAN peripheral MODE
		Seed_GET 		: 0x06, // Get Seed for Unlocking device
		Unlock_SET 		: 0x07, // Unlock device for operation
		Channel_START 	: 0x08, // Start CAN peripheral
		Channel_STOP 	: 0x09, // Stop CAN peripheral
		Features_GET 	: 0x0B, // Get supported features
		Channel_SET 	: 0xFF, // TODO: multichannel setup
		Protocol_SET 	: 0x0C, // Select the protocol to use
	};

	// For end to end communication, instead of running the
	// protocol stack in the browser itself
	// multipacket messages are decoded on the device itself
	// This may not be the right way to do what we do
	// but it works
	flCAN.WebUSB.Transport.protocols = {
		CAN2_0BRAW 	: 0,
		SAE_J1939 	: 1,
		NMEA_2000 	: 2
	};

	// function: close
	// close the Transport
	flCAN.WebUSB.Transport.prototype.close = function() {
		this.device.close();
	};

	// function: 
	flCAN.WebUSB.Transport.prototype.reset = function() {
		this.device.reset();
	};

	flCAN.WebUSB.Transport.prototype.send = function(ep, data) {
		if (flCAN.Opt.dump)
			hexdump(new DataView(data), "" + ep + "==> ");

		return this.device.transferOut(ep, data);
	};

	flCAN.WebUSB.Transport.prototype.receive = function(ep, len) {
		return this.device.transferIn(ep, len)
				.then(response => {
					if (flCAN.Opt.dump)
						hexdump(response.data, "<==" + ep + " ")

					return response.data;
				});
	};

	flCAN.WebUSB.Transport.prototype.control = function(cmd) {
		return this.device.controlTransferOut({
				requestType: 'class',
				recipient: 'interface',
				request: cmd,
				value: 0,
				index: 0
			});
	};

	flCAN.WebUSB.Transport.prototype.controlIn = function(cmd, len) {
		return this.device.controlTransferIn({
				requestType: 'class',
				recipient: 'interface',
				request: cmd,
				value: 0,
				index: 0
			}, len);
	};

	flCAN.WebUSB.Transport.prototype.controlOut = function(cmd, data) {
		return this.device.controlTransferOut({
				requestType: 'class',
				recipient: 'interface',
				request: cmd,
				value: 0,
				index: 0
			}, data);
	};

	flCAN.WebUSB.Transport.prototype.flushHostQ = function() {
		return this.controlOut(this.Cmds.Flush_HOSTQ);
	};

	flCAN.WebUSB.Transport.prototype.flushDevQ = function() {
		return this.controlOut(this.Cmds.Flush_DEVQ);
	};

	flCAN.WebUSB.Transport.prototype.getBitrate = function() {
		return this.controlIn(this.Cmds.Bitrate_GET, 4);
	};

	flCAN.WebUSB.Transport.prototype.setBitrate = function(bitrate) {
		// TODO: use get FEATURES to assert condition
		if (bitrate < 1000 || bitrate > 1000000)
			throw new Error("Bitrate out of range: " + bitrate)
		
		return this.controlOut(this.Cmds.Bitrate_SET, new Uint32Array([bitrate]));
	};

	flCAN.WebUSB.Transport.prototype.getMode = function() {
		return this.controlIn(this.Cmds.Mode_GET, 4);
	};

	flCAN.WebUSB.Transport.prototype.setMode = function(mode) {
		// TODO: use get features to assert condition
		return this.controlOut(this.Cmds.Mode_SET, new Uint8Array([mode]));
	}
	
	flCAN.WebUSB.Transport.prototype.startChannel = function(channel) {
		// TODO: UNUSED(channel)
		return this.controlOut(this.Cmds.Channel_START);
	}

	flCAN.WebUSB.Transport.prototype.stopChannel = function(channel) {
		// TODO: UNUSED(channel)
		return this.controlOut(this.Cmds.Channel_STOP);
	}

	flCAN.WebUSB.Transport.prototype.getFeatures = function() {
		return this.controlIn(this.Cmds.Features_GET, 8);
	}

	flCAN.WebUSB.Transport.prototype.setProtocol = function(protocol) {
		if (!check_protocol_support(protocol))
			throw new Error("Unsupported protocol: " + protocol);
		return this.controlOut(this.Cmds.Protocol_SET, new Uint8Array([protocol]));
	}

	flCAN.WebUSB.Transport.prototype.getDevice = function() {
		// TODO: filter ?
		if (this.device.configuration == null)
			throw new Error("Unsupported device: " + this.device.productName);

		return this.device.selectConfiguration(1)
				.then(() => this.device.claimInterface(0))
				.then(() => this.device.claimInterface(1));
	}

	flCAN.WebUSB.Transport.prototype.getEndpoints = function() {
		let endpoints = {
			data_in : this.device.configuration.interfaces[0].alternate.endpoints[0].endpointNumber,
			data_out : this.device.configuration.interfaces[0].alternate.endpoints[1].endpointNumber,
			status : this.device.configuration.interfaces[0].alternate.endpoints[2],
		};

		return endpoints;
	};

	flCAN.WebUSB.Transport.prototype.prepTransport = function(transport_settings, authfn) {
		return this.getDevice()
				.then(() => this.setBitrate(transport_settings.Bitrate))
				.then(() => this.setMode(transport_settings.Mode))
				.then(() => this.setProtocol(transport_settings.Protocol))
				.then(() => this.controlIn(this.Cmds.Seed_GET, flCAN.Opt.seed_size))
				.then((seed) => authfn(seed))
				.then((key) => this.controlOut(this.Cmds.Unlock_SET, key))
				.then(() => this.controlOut(this.Cmds.Channel_START));
	};

	flCAN.WebUSB.Transport.prototype.connectBMS = function(addr) {
		let endpoints = this.getEndpoints();
		let bms = new flCAN.WebUSB.BMSX(this, endpoints, addr);
		return bms.identify()
			.then(() => {
				return bms;
			});
	};

	flCAN.WebUSB.Transport.prototype.disconnectBMS = function(bms) {
		// TODO: this bullshit
		return 0;
	};

	flCAN.WebUSB.BMSX = function(transport, endpoints, addr) {
		this.transport = transport;
		this.addr = addr;
		
		// need to figure out a way to prevent babbles
		this.can_metadata_maxlen = 12;
		this.can_data_maxlen = 64;

		this.ep_in = endpoints.data_in;
		this.ep_out = endpoints.data_out;
		this.ep_stat = endpoints.status;

		this.Info = null;
	};

	flCAN.WebUSB.BMSX.prototype.Cmds = {
		RequestId 		: 0x11, // Request the BMS to send it's bms_info struct
		Authenticate 	: 0x0E, // Runs proprietary authentication with the BMS
		Wakeup 			: 0x10, // Send a NOP to wakeup the device
		RequestSleep 	: 0x12, // Request the BMS to go to power saving mode
		Synchronize 	: 0x0F, // Synchronize BMS clock with device clock
		Desynchronize 	: 0x13, // Force BMS to lose synchronization with device
		RequestOTA 		: 0x20, // Request the BMS to move reboot to bootloader
	};

	// function: identify
	// Identify the BMS Series
	// returns a BMS_Info object with the following properties
	// Id 		: <= 20 character identifier
	// Version 	: Hardware Revision
	// Warranty : warranty status
	// Series 	: Number of cells in series
	// Parallel : Number of cells in parallel 
	flCAN.WebUSB.BMSX.prototype.identify = function() {
		let BMS_Info = {};
		// TODO: identify endianess dynamically with a 4 byte transaction with the ECU
		this.transport.le = flCAN.Opt.le;
		return this.transport.controlOut(this.Cmds.RequestId, new Uint8Array([this.addr]))
				.then(() => flCAN.Frame.receive(this))
				.then((frame) => {
					if (frame.Dlc == 0)
						throw new Error("Could not identify BMS");
					// TODO: this will need to be updated soon
					// Right now we use the DATA PGN for ID, but it has it's own PGN
					// Implementation needs updating in: BMS, FLCAN, and JS
					if (flCAN.Opt.debug)
						console.log(frame)
					BMS_Info.Id = new TextDecoder().decode(frame.Data.slice(5, 25));
					let view = new DataView(frame.Data.buffer);
					BMS_Info.Version = view.getUint8(25);
					BMS_Info.Warranty = view.getUint8(26);
					BMS_Info.Series = view.getUint8(27);
					BMS_Info.Parallel = view.getUint8(28);
					// TODO: add therm count to ID
					// TODO: add firmware version to ID
					// BMS_Info.fw_ver = 0
					// BMS_Info.therm_count = 7
					if (flCAN.Opt.debug)
						console.log(BMS_Info);
					this.Info = BMS_Info;
				});
	};

	// function: authenticate
	// Runs authentication between device and BMS
	// Needs to be run only after waking up the BMS from sleep
	// Run within 1 second after wakeup to prevent the BMS from going back to sleep
	flCAN.WebUSB.BMSX.prototype.authenticate = function() {
		return this.transport.controlOut(this.Cmds.Authenticate, new Uint8Array([this.addr]));
	};

	// function: wakeup
	// Wakes up BMS via CAN
	// Has no effect if the BMS is awake
	flCAN.WebUSB.BMSX.prototype.wakeup = function() {
		return this.transport.controlOut(this.Cmds.Wakeup, new Uint8Array([this.addr]));
	};

	// function: sleep
	// Requests the BMS to go to sleep
	// The BMS will lose synchronization and stop broadcasting acquired data
	// wakes up the BMS if it is sleeping till timeout
	// The BMS may not go to sleep in case of a fault
	flCAN.WebUSB.BMSX.prototype.sleep = function() {
		return this.tranport.controlOut(this.Cmds.RequestSleep, new Uint8Array([this.addr]));
	};

	// function: sync
	// Synchronizes the BMS clock with the device
	// Until synchronization the BMS does not broadcast any acquired data
	flCAN.WebUSB.BMSX.prototype.sync = function() {
		return this.transport.controlOut(this.Cmds.Synchronize, new Uint8Array([this.addr]));
	};

	// function: desync
	// Forces the BMS clock to lose synchronization with the device
	// Use this to stop the BMS from broadcasting acquisitions 
	flCAN.WebUSB.BMSX.prototype.desync = function() {
		return this.transport.controlOut(this.Cmds.Desynchronize, new Uint8Array([this.addr]));
	};

	// CAN Frame factory
	// Create a CAN frame to send to a device
	flCAN.Frame = function(id, data, timestamp=0) {

		this.Timestamp = timestamp;
		this.Id = id;

		if (data == null)
			throw new Error("Frame data cannot be null: " + this);

		this.Dlc = (typeof data === "string") ? data.length : data.byteLength;
		if (typeof data === "string") {
			this.Data = new TextEncoder().encode(data);
		} else {
			this.Data = data;
		}
	};

	// function: send
	// This function transmits a CAN frame
	flCAN.Frame.send = function(ecu, frame) {
		// TODO: find a better converter for Object -> ArrayBuffer
		let metadata = new ArrayBuffer(ecu.can_metadata_max);

		if (flCAN.Opt.debug) 
			console.log(frame);

		if (frame.Dlc > ecu.can_data_maxlen)
			throw new Error("Frame too big: " + frame.Dlc + " bytes (max: " + ecu.can_data_maxlen + " bytes)");
		
		let view = new DataView(metadata);
		view.setUint32(0, frame.Timestamp, ecu.transport.le);
		view.setUint32(4, frame.Id, ecu.transport.le);
		view.setUint8(8, frame.Dlc);

		return ecu.transport.send(ecu.ep_out, metadata)
				then(() => ecu.transport.send(ecu.ep_out, frame.Data));
	};

	// function: receive
	// This function receives USB packets and parses them into a CAN frame
	// returns a Frame object with the following properties
	// Timestamp 	: hardware ms timestamp since the device was connected
	// Id 			: CAN ID of the message
	// Dlc 			: Data length code of the CAN message
	// Data 		: ArrayBuffer of the databytes in the message (<64 bytes)
	// TODO: add other flags like RTR etcetra
	// TODO: add support for protocol level max messages and not  
	flCAN.Frame.receive = async function(ecu) {
		// Every CAN message is split into 2 USB packets
		// Packet 1 : Metadata 
		// 				- Timestamp [4 bytes, uint32]
		// 				- Id [4 bytes, uint32]
		// 				- Dlc [1 byte, uint8]
		// Packet 2 : Data
		// let r = {};
		// return ecu.transport.receive(ecu.ep_in, ecu.can_metadata_maxlen)
		// 		.then((metadata) => { 
		// 			// if (metadata.byteLength == 0) {
		// 			// 	return flCAN.Frame.receive(ecu);
		// 			// }
		// 			r.dlc = metadata.getUint8(5);
		// 			r.id = metadata.getUint32(4, ecu.transport.le);
		// 			r.timestamp = metadata.getUint32(0, ecu.transport.le);
		// 			console.log(r);
		// 			// return new flCAN.Frame(id, "\x08\x00\x00\x00\x00VEC00224X\x00\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\x04\x01\x0E\x08");
		// 			return ecu.transport.receive(ecu.ep_in, ecu.can_data_maxlen > r.dlc ? r.dlc : this.can_data_maxlen);
		// 		})
		// 		.then((data) => {
		// 			return new flCAN.Frame(r.id, data.buffer, r.timestamp);
		// 		});
		var metadata = await ecu.transport.receive(ecu.ep_in, ecu.can_metadata_maxlen);
		let r = {
			id : metadata.getUint32(4, ecu.transport.le),
			dlc : metadata.getUint8(5)
		}
		// return new flCAN.Frame(r.id, "\x08\x00\x00\x00\x00VEC00224X\x00\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF\x04\x01\x0E\x08");
		var data = await ecu.transport.receive(ecu.ep_in, ecu.can_data_maxlen > r.dlc ? r.dlc : this.can_data_maxlen);
		return new flCAN.Frame(r.id, data.buffer, r.timestamp);
	};

	flCAN.WebUSB.Updater = function(device) {
		this.metadata = new ArrayBuffer(device.can_data_maxlen);
		
		let id = 0x00FF89 << 8;

		let view  = new DataView(this.payload);
		view.setUint32(0, 0, device.transport.le);
		view.setUint32(4, id, device.transport.le);
	};

	flCAN.WebUSB.Updater.prototype.startOTA = function(device) {
		device.transport.controlOut(device.Cmds.RequestOTA, new Uint8Array([device.addr]))
			.then(() => {});
	};


	flCAN.WebUSB.Updater.prototype.sendPhrase = function(ecu, phrase) {		
		if (phrase == null) 
			throw new Error("Invalid phrase: " + phrase);
		
		if (phrase.length > ecu.can_data_maxlen)
			throw new Error("Phrase too long: " + phrase.length + " bytes (max: " + ecu.can_data_maxlen + " bytes)");
		
		let view =  new DataView(this.metadata);
		view.setUint8(8, phrase.length);

		if (flCAN.Opt.debug)
			console.log(phrase);

		return ecu.transport.send(ecu.ep_out, this.metadata)
				.then(() => ecu.transport.send(ecu.ep_out, new TextEncoder().encode(phrase)));
	};

	flCAN.WebUSB.Logger = function() {};

	function get_bitrate(bitrate)
	{
		return new Uint32Array([bitrate]);
	}

	function get_unlock_key(seed)
	{
		return seed;
	}

	function check_protocol_support(protocol) {
		return Object.keys(flCAN.WebUSB.Transport.protocols).some((idx) => {
			return flCAN.WebUSB.Transport.protocols[idx] == protocol;
		});
	}

	function paddit(text, width, padding)
	{
		let padlen = width - text.length;
		let padded = "";

		for (let i = 0; i < padlen; i++)
			padded += padding;

		return padded + text;
	}

	function toHex8(num)
	{
		return paddit(num.toString(16), 2, "0");
	}

	function toHex16(num)
	{
		return paddit(num.toString(16), 4, "0");
	}

	function hexdump(view, prefix="")
	{
		let decoder = new TextDecoder();

		for (let i = 0; i < view.byteLength; i += 16) {
			let max = (view.byteLength - i) > 16 ? 16 : (view.byteLength - i);
			let row = prefix + toHex16(i) + " ";
			let j;

			for (j = 0; j < max; j++)
				row += " " + toHex8(view.getUint8(i + j));
			for (; j < 16; j++)
				row += "   ";

			row += " | " + decoder.decode(new DataView(view.buffer, i, max));
			console.log(row);
		}
	}

	return flCAN;
}));