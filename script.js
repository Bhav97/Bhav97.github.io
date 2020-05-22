document.getElementById("clickme").onclick = USBctrl;

function USBctrl() {
	navigator.usb.requestDevice({ filters: [{ vendorId: 0x1d50 }] })
	.then(device => {
		console.log(device.productName);      // "CAN-USB-IoT adapter"
		console.log(device.manufacturerName); // "Vecmocon Technologies Private Limited"
		return device.open(); // Begin session
	})
	.then(() => device.selectConfiguration(1)) // ref. USBD_GS_CAN_CfgDesc[0]
	.then(() => device.claimInterface(0)) 		// interface 0, ref. USB_GS_CAN_CfgDesc[1]
	.then(() => device.controlTransferOut({
		requestType: 'vendor',	// or class, fw maps class requests to vendor requests
		request: 0x02,			// GS_USB_BREQ_MODE used as class setup request
		value: 0x00, 			// CAN channel 0
		index: 0x02				// don't care, drivers are shit
	})) // by now the hardware should change states visibly in response
	.catch(error => { console.log(error); });
}