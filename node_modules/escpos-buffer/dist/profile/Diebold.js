"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Elgin_1 = require("./Elgin");
const actions_1 = require("../actions");
class Diebold extends Elgin_1.default {
    buzzer() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from('\x07', 'ascii'));
        });
    }
    initialize() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.setCodepage(this.capabilities.codepage);
            yield this.setColumns(this.capabilities.columns);
        });
    }
    fontChanged(_, __) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () { });
    }
    cutter(_) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from('\x1Bw', 'ascii'));
        });
    }
    drawer(number, on_time, off_time) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const index = {
                [actions_1.Drawer.First]: '0',
                [actions_1.Drawer.Second]: '1',
            };
            const on_time_char = String.fromCharCode(Math.min(Math.trunc(on_time / 2), 65));
            const off_time_char = String.fromCharCode(Math.min(Math.trunc(off_time / 2), 65));
            return this.connection.write(Buffer.from('\x1B&' + index[number] + on_time_char + off_time_char, 'ascii'));
        });
    }
}
exports.default = Diebold;
//# sourceMappingURL=Diebold.js.map