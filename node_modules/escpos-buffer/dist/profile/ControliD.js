"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Epson_1 = require("./Epson");
const actions_1 = require("../actions");
class ControliD extends Epson_1.default {
    setStyle(style, enable) {
        const _super = Object.create(null, {
            setStyle: { get: () => super.setStyle }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (enable) {
                if (actions_1.Style.Bold == style) {
                    return this.connection.write(Buffer.from('\x1BE\x01', 'ascii'));
                }
            }
            else {
                if (actions_1.Style.Bold == style) {
                    return this.connection.write(Buffer.from('\x1BE\x00', 'ascii'));
                }
            }
            return _super.setStyle.call(this, style, enable);
        });
    }
    qrcode(data, size) {
        const _super = Object.create(null, {
            qrcode: { get: () => super.qrcode }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.capabilities.model == 'PrintiD-Touch') {
                return _super.qrcode.call(this, data, size);
            }
            else {
                return this.drawQrcode(data, size);
            }
        });
    }
    initialize() {
        const _super = Object.create(null, {
            initialize: { get: () => super.initialize }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield _super.initialize.call(this);
            return this.fontChanged(this.font, this.font);
        });
    }
    fontChanged(current, previous) {
        const _super = Object.create(null, {
            fontChanged: { get: () => super.fontChanged }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (current.name == 'Font C') {
                return this.connection.write(Buffer.from('\x1BM\x02', 'ascii'));
            }
            else {
                return _super.fontChanged.call(this, current, previous);
            }
        });
    }
}
exports.default = ControliD;
//# sourceMappingURL=ControliD.js.map