"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Epson_1 = require("./Epson");
const actions_1 = require("../actions");
class Daruma extends Epson_1.default {
    drawer(number, _, __) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const index = {
                [actions_1.Drawer.First]: 'p',
                [actions_1.Drawer.Second]: 'p',
            };
            return this.connection.write(Buffer.from('\x1B' + index[number], 'ascii'));
        });
    }
    setAlignment(align) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const cmd = {
                [actions_1.Align.Left]: '\x1Bj0',
                [actions_1.Align.Center]: '\x1Bj1',
                [actions_1.Align.Right]: '\x1Bj2',
            };
            return this.connection.write(Buffer.from(cmd[align], 'ascii'));
        });
    }
    setStyle(style, enable) {
        const _super = Object.create(null, {
            setStyle: { get: () => super.setStyle }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (enable) {
                if (actions_1.Style.Bold == style) {
                    return this.connection.write(Buffer.from('\x1BE', 'ascii'));
                }
            }
            else {
                if (actions_1.Style.Bold == style) {
                    return this.connection.write(Buffer.from('\x1BF', 'ascii'));
                }
            }
            return _super.setStyle.call(this, style, enable);
        });
    }
    setMode(mode, enable) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (enable) {
                if (mode & actions_1.Style.DoubleWidth) {
                    yield this.connection.write(Buffer.from('\x0E', 'ascii'));
                }
                if (mode & actions_1.Style.DoubleHeight) {
                    yield this.connection.write(Buffer.from('\x1Bw1', 'ascii'));
                }
            }
            else {
                if (mode & actions_1.Style.DoubleHeight) {
                    yield this.connection.write(Buffer.from('\x1Bw0', 'ascii'));
                }
                if (mode & actions_1.Style.DoubleWidth) {
                    yield this.connection.write(Buffer.from('\x14', 'ascii'));
                }
            }
        });
    }
    feed(lines) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from('\r\n'.repeat(lines), 'ascii'));
        });
    }
    initialize() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.setCodepage(this.capabilities.codepage);
            yield this.setColumns(this.capabilities.columns);
            return this.fontChanged(this.font, this.font);
        });
    }
    fontChanged(current, previous) {
        const _super = Object.create(null, {
            fontChanged: { get: () => super.fontChanged }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield _super.fontChanged.call(this, current, previous);
            return this.applyCodePage();
        });
    }
    qrcode(data, size) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const len = data.length + 2;
            const pL = String.fromCharCode(len & 0xff);
            const pH = String.fromCharCode((len >> 8) & 0xff);
            const error = 'M';
            const _size = String.fromCharCode(Math.min(7, Math.max(3, size || 4)));
            yield this.connection.write(Buffer.from('\x1B\x81', 'ascii'));
            yield this.connection.write(Buffer.from(pL + pH, 'ascii'));
            yield this.connection.write(Buffer.from(_size + error, 'ascii'));
            return this.connection.write(Buffer.from(data, 'ascii'));
        });
    }
    get bitmapCmd() {
        return '\x1B*m';
    }
}
exports.default = Daruma;
//# sourceMappingURL=Daruma.js.map