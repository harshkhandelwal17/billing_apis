"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Epson_1 = require("./Epson");
const actions_1 = require("../actions");
class Bematech extends Epson_1.default {
    setStyle(style, enable) {
        const _super = Object.create(null, {
            setStyle: { get: () => super.setStyle }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.font.name != 'Font C') {
                return _super.setStyle.call(this, style, enable);
            }
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
    buzzer() {
        const _super = Object.create(null, {
            buzzer: { get: () => super.buzzer }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.capabilities.model == 'MP-2800 TH') {
                return this.connection.write(Buffer.from('\x1BB\x02\x01', 'ascii'));
            }
            else if (this.font.name != 'Font C') {
                return this.connection.write(Buffer.from('\x1B(A\x05\x00ad\x02\x02\x01', 'ascii'));
            }
            else {
                return _super.buzzer.call(this);
            }
        });
    }
    drawer(number, on_time, off_time) {
        const _super = Object.create(null, {
            drawer: { get: () => super.drawer }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.font.name != 'Font C') {
                return _super.drawer.call(this, number, on_time, off_time);
            }
            const index = {
                [actions_1.Drawer.First]: 'v',
                [actions_1.Drawer.Second]: '\x80',
            };
            const on_time_char = String.fromCharCode(Math.max(Math.min(on_time, 255), 50));
            return this.connection.write(Buffer.from('\x1B' + index[number] + on_time_char, 'ascii'));
        });
    }
    qrcode(data, size) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const len = data.length + 3;
            const pL = String.fromCharCode(len & 0xff);
            const pH = String.fromCharCode((len >> 8) & 0xff);
            const error = String.fromCharCode(2);
            const _size = String.fromCharCode(Math.min(11, Math.max(1, size || 4)) * 2);
            const version = String.fromCharCode(0);
            const encoding = String.fromCharCode(1);
            yield this.connection.write(Buffer.from('\x1DkQ', 'ascii'));
            yield this.connection.write(Buffer.from(error + _size + version + encoding, 'ascii'));
            yield this.connection.write(Buffer.from(pL + pH, 'ascii'));
            yield this.connection.write(Buffer.from(data, 'ascii'));
            yield this.connection.write(Buffer.from('\x00', 'ascii'));
            return this.feed(1);
        });
    }
    fontChanged(current, previous) {
        const _super = Object.create(null, {
            fontChanged: { get: () => super.fontChanged }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (current.name == 'Font C') {
                return this.connection.write(Buffer.from('\x1D\xf950', 'ascii'));
            }
            yield this.connection.write(Buffer.from('\x1D\xf951', 'ascii'));
            return _super.fontChanged.call(this, current, previous);
        });
    }
}
exports.default = Bematech;
//# sourceMappingURL=Bematech.js.map