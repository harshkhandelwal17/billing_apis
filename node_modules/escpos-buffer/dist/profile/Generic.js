"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Epson_1 = require("./Epson");
const actions_1 = require("../actions");
class Generic extends Epson_1.default {
    setMode(mode, enable) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (enable) {
                if (mode & actions_1.Style.DoubleWidth) {
                    yield this.connection.write(Buffer.from('\x0E', 'ascii'));
                }
                if (mode & actions_1.Style.DoubleHeight) {
                    yield this.connection.write(Buffer.from('\x1Bd1', 'ascii'));
                }
            }
            else {
                if (mode & actions_1.Style.DoubleHeight) {
                    yield this.connection.write(Buffer.from('\x1Bd0', 'ascii'));
                }
                if (mode & actions_1.Style.DoubleWidth) {
                    yield this.connection.write(Buffer.from('\x14', 'ascii'));
                }
            }
        });
    }
    qrcode(data, size) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.drawQrcode(data, size);
        });
    }
}
exports.default = Generic;
//# sourceMappingURL=Generic.js.map