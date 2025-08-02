"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const Model_1 = require("./Model");
const actions_1 = require("./actions");
class Printer {
    constructor(model) {
        this.model = model;
    }
    setCodepage(value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.setCodepage(value);
        });
    }
    buzzer() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.buzzer();
        });
    }
    cutter(mode = actions_1.Cut.Partial) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.cutter(mode);
        });
    }
    drawer(number = actions_1.Drawer.First, on_time = 120, off_time = 240) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.drawer(number, on_time, off_time);
        });
    }
    draw(image) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.draw(image);
        });
    }
    qrcode(data, size = null) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.qrcode(data, size);
        });
    }
    setAlignment(align) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.setAlignment(align);
        });
    }
    write(text, styles = 0) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.write(text, styles);
        });
    }
    writeln(text = '', styles = 0, align = actions_1.Align.Left) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.writeln(text, styles, align);
        });
    }
    withStyle(styleConf, cb) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.withStyle(styleConf, cb);
        });
    }
    feed(lines = 1) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.feed(lines);
        });
    }
    get columns() {
        return this.model.profile.columns;
    }
    setColumns(value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.setColumns(value);
        });
    }
    close() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.model.profile.finalize();
        });
    }
    static CONNECT(_model, connection, imageManager) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let model;
            if (typeof _model === 'string') {
                model = new Model_1.default(_model);
            }
            else {
                model = _model;
            }
            yield connection.open();
            model.profile.connection = connection;
            model.profile.imageManager = imageManager;
            yield model.profile.initialize();
            return new Printer(model);
        });
    }
}
exports.default = Printer;
//# sourceMappingURL=Printer.js.map