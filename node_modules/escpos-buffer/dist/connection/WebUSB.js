"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
class WebUSB {
    constructor(device, configurationValue = -1, interfaceNumber = -1) {
        this.device = device;
        this.configurationValue = configurationValue;
        this.interfaceNumber = interfaceNumber;
        this.endpointNumber = -1;
    }
    open() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.device.open();
            if (this.configurationValue === -1 || this.interfaceNumber === -1) {
                this.autoSelect();
            }
            yield this.device.selectConfiguration(this.configurationValue);
            yield this.device.claimInterface(this.interfaceNumber);
            const iface = this.device.configuration.interfaces[this.interfaceNumber];
            const endpoint = iface.alternate.endpoints.find((e) => e.direction === 'out');
            this.endpointNumber = endpoint.endpointNumber;
        });
    }
    write(data) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.device.transferOut(this.endpointNumber, data);
        });
    }
    close() {
        return this.device.close();
    }
    autoSelect() {
        this.device.configurations.find((config) => {
            if (this.configurationValue !== -1 &&
                config.configurationValue !== this.configurationValue) {
                return false;
            }
            return (config.interfaces.findIndex((iface) => {
                if (this.interfaceNumber !== -1 &&
                    iface.interfaceNumber !== this.interfaceNumber) {
                    return false;
                }
                const endpoint = iface.alternate.endpoints.find((e) => e.direction === 'out');
                if (!endpoint) {
                    return false;
                }
                this.configurationValue = config.configurationValue;
                this.interfaceNumber = iface.interfaceNumber;
                return true;
            }) >= 0);
        });
    }
}
exports.default = WebUSB;
//# sourceMappingURL=WebUSB.js.map