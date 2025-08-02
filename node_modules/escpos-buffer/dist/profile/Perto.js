"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Elgin_1 = require("./Elgin");
class Perto extends Elgin_1.default {
    buzzer() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from('\x07', 'ascii'));
        });
    }
    cutter(_) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from('\x1BJ\x18\x1DVB(', 'ascii'));
        });
    }
}
exports.default = Perto;
//# sourceMappingURL=Perto.js.map