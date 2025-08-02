"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
class InMemory {
    open() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.list = [];
        });
    }
    write(data) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.list.push(data);
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () { });
    }
    buffer() {
        return Buffer.concat(this.list);
    }
}
exports.default = InMemory;
//# sourceMappingURL=InMemory.js.map