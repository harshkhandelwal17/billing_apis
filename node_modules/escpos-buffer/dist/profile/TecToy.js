"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Epson_1 = require("./Epson");
class TecToy extends Epson_1.default {
    feed(lines) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from('\x0A'.repeat(lines), 'ascii'));
        });
    }
    buzzer() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const n = String.fromCharCode(1);
            return this.connection.write(Buffer.from('\x1BB' + n + '\x03', 'ascii'));
        });
    }
    qrcode(data, size) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const _size = String.fromCharCode(size || 4);
            const error = '0';
            const len = data.length + 3;
            const pL = String.fromCharCode(len & 0xff);
            const pH = String.fromCharCode((len >> 8) & 0xff);
            yield this.connection.write(Buffer.from('\x1D(k\x04\x001A\x00\x00', 'ascii'));
            yield this.connection.write(Buffer.from('\x1D(k\x03\x001C' + _size, 'ascii'));
            yield this.connection.write(Buffer.from('\x1D(k\x03\x001E' + error, 'ascii'));
            yield this.connection.write(Buffer.from('\x1D(k' + pL + pH + '1P0', 'ascii'));
            yield this.connection.write(Buffer.from(data, 'ascii'));
            yield this.connection.write(Buffer.from('\x1D(k\x03\x001Q0', 'ascii'));
            return this.connection.write(Buffer.from('\x0A'));
        });
    }
}
exports.default = TecToy;
//# sourceMappingURL=TecToy.js.map