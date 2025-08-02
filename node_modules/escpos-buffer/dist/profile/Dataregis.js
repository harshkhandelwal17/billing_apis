"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Elgin_1 = require("./Elgin");
class Dataregis extends Elgin_1.default {
    buzzer() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from('\x07', 'ascii'));
        });
    }
}
exports.default = Dataregis;
//# sourceMappingURL=Dataregis.js.map