"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Epson_1 = require("./Epson");
const actions_1 = require("../actions");
class Elgin extends Epson_1.default {
    cutter(mode) {
        const _super = Object.create(null, {
            cutter: { get: () => super.cutter }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.capabilities.model == 'I9') {
                return this.connection.write(Buffer.from('\x1DV0', 'ascii'));
            }
            return _super.cutter.call(this, mode);
        });
    }
    buzzer() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from('\x1B(A\x05\x00ad\x02\x02\x01', 'ascii'));
        });
    }
    drawer(number, on_time, off_time) {
        const _super = Object.create(null, {
            drawer: { get: () => super.drawer }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.capabilities.model.startsWith('I')) {
                return _super.drawer.call(this, number, on_time, off_time);
            }
            const index = {
                [actions_1.Drawer.First]: 'v',
                [actions_1.Drawer.Second]: 'v',
            };
            const on_time_char = String.fromCharCode(Math.max(Math.min(on_time, 200), 50));
            return this.connection.write(Buffer.from('\x1B' + index[number] + on_time_char, 'ascii'));
        });
    }
    setStyle(style, enable) {
        const _super = Object.create(null, {
            setStyle: { get: () => super.setStyle }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.capabilities.model == 'I9') {
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
    setMode(mode, enable) {
        const _super = Object.create(null, {
            setMode: { get: () => super.setMode }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.capabilities.model == 'I9') {
                return _super.setMode.call(this, mode, enable);
            }
            if (enable) {
                if (mode & actions_1.Style.DoubleWidth) {
                    yield this.connection.write(Buffer.from('\x1BW\x01', 'ascii'));
                }
                if (mode & actions_1.Style.DoubleHeight) {
                    yield this.connection.write(Buffer.from('\x1Bd\x01', 'ascii'));
                }
            }
            else {
                if (mode & actions_1.Style.DoubleHeight) {
                    yield this.connection.write(Buffer.from('\x1Bd\x00', 'ascii'));
                }
                if (mode & actions_1.Style.DoubleWidth) {
                    yield this.connection.write(Buffer.from('\x1BW\x00', 'ascii'));
                }
            }
        });
    }
    qrcode(data, size) {
        const _super = Object.create(null, {
            qrcode: { get: () => super.qrcode }
        });
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.capabilities.model == 'I9') {
                return _super.qrcode.call(this, data, size);
            }
            const type = String.fromCharCode(2);
            const error = 'M';
            const _size = String.fromCharCode(Math.min(255, Math.max(1, size || 4)));
            yield this.connection.write(Buffer.from('\x1Do\x00' + _size + '\x00' + type, 'ascii'));
            yield this.connection.write(Buffer.from('\x1Dk\x0B' + error + 'A,', 'ascii'));
            yield this.connection.write(Buffer.from(data, 'ascii'));
            return this.connection.write(Buffer.from('\x00', 'ascii'));
        });
    }
}
exports.default = Elgin;
//# sourceMappingURL=Elgin.js.map