"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
class WebBluetooth {
    constructor(device) {
        this.device = device;
        this.characteristic = null;
    }
    open() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const server = yield this.device.gatt.connect();
            const service = yield server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = yield service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            this.characteristic = characteristic;
        });
    }
    write(data) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.characteristic.writeValue(data);
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const server = yield this.device.gatt.connect();
            return server.disconnect();
        });
    }
}
exports.default = WebBluetooth;
//# sourceMappingURL=WebBluetooth.js.map