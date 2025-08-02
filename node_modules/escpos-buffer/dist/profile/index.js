"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Profile = void 0;
const tslib_1 = require("tslib");
const actions_1 = require("../actions");
const iconv = require("iconv-lite");
const Image_1 = require("../graphics/Image");
const filter_1 = require("../graphics/filter");
class Profile {
    constructor(capabilities) {
        this.capabilities = capabilities;
    }
    setStyles(styles, enable) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let properties = [
                actions_1.Style.Condensed,
                actions_1.Style.Bold,
                actions_1.Style.Italic,
                actions_1.Style.Underline,
            ];
            properties = enable ? properties : properties.reverse();
            for (const style of properties) {
                yield this.setStyle(style & styles, enable);
            }
        });
    }
    write(text, styles) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.setMode(styles, true);
            yield this.setStyles(styles, true);
            yield this.connection.write(iconv.encode(text, this._codepage.code));
            yield this.setStyles(styles, false);
            return this.setMode(styles, false);
        });
    }
    withStyle(styleConf, cb) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { width = undefined, height = undefined, bold = false, italic = false, underline = false, align = actions_1.Align.Left, } = styleConf;
            let styles = 0;
            if (bold)
                styles |= actions_1.Style.Bold;
            if (italic)
                styles |= actions_1.Style.Italic;
            if (underline)
                styles |= actions_1.Style.Underline;
            if (align !== actions_1.Align.Left) {
                yield this.setAlignment(align);
            }
            yield this.setCharSize({ width, height });
            yield this.setStyles(styles, true);
            yield cb();
            yield this.setStyles(styles, false);
            yield this.setCharSize({ width: 1, height: 1 });
            if (align !== actions_1.Align.Left) {
                yield this.setAlignment(actions_1.Align.Left);
            }
        });
    }
    writeln(text, styles, align) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (align !== actions_1.Align.Left) {
                yield this.setAlignment(align);
            }
            if (text.length > 0) {
                yield this.write(text, styles);
            }
            yield this.feed(1);
            if (align !== actions_1.Align.Left) {
                return this.setAlignment(actions_1.Align.Left);
            }
        });
    }
    get bitmapCmd() {
        return '\x1B*!';
    }
    draw(image) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const low = String.fromCharCode(image.width & 0xff);
            const high = String.fromCharCode((image.width >> 8) & 0xff);
            yield this.connection.write(Buffer.from('\x1B3\x10', 'ascii'));
            for (let y = 0; y < image.lines; y++) {
                const data = image.lineData(y);
                yield this.connection.write(Buffer.from(this.bitmapCmd + low + high, 'ascii'));
                yield this.connection.write(data);
                yield this.connection.write(Buffer.from('\x1BJ\x00', 'ascii'));
            }
            return this.connection.write(Buffer.from('\x1B2', 'ascii'));
        });
    }
    drawQrcode(data, size) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.imageManager) {
                throw new Error('No image manager to draw qrcode');
            }
            const imageData = yield this.imageManager.buildQrcodeImage(data, size);
            const image = new Image_1.default(imageData, new filter_1.Threshold());
            return this.draw(image);
        });
    }
    get connection() {
        if (this._connection) {
            return this._connection;
        }
        throw new Error('Connection must be set before priting');
    }
    set connection(value) {
        this._connection = value;
    }
    get name() {
        return this.capabilities.brand + ' ' + this.capabilities.model;
    }
    get columns() {
        return this._columns;
    }
    setColumns(value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const font = this.fonts.find(({ columns }) => columns >= value);
            yield this.setFont(font || this.fonts.slice(-1)[0]);
            this._columns = this.font.columns >= value ? value : this.font.columns;
        });
    }
    setFont(value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const old = this._font;
            this._font = value;
            if (old && old.name != value.name) {
                yield this.fontChanged(value, old);
                return this.applyCodePage();
            }
        });
    }
    get font() {
        return this._font;
    }
    get fonts() {
        return this.capabilities.fonts;
    }
    setCodepage(value) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const old = this._codepage;
            const codepage = this.capabilities.codepages.find(({ code }) => value == code);
            if (codepage === undefined) {
                throw new Error(`Unsupported codepage "${value}"`);
            }
            this._codepage = codepage;
            if (old && old.code != codepage.code) {
                yield this.applyCodePage();
            }
        });
    }
    applyCodePage() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.write(Buffer.from(this._codepage.command, 'ascii'));
        });
    }
    fontChanged(_, __) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () { });
    }
    initialize() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.setCodepage(this.capabilities.codepage);
            yield this.setColumns(this.capabilities.columns);
            if (this.capabilities.initialize) {
                yield this.connection.write(Buffer.from(this.capabilities.initialize, 'ascii'));
            }
            return this.applyCodePage();
        });
    }
    finalize() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            return this.connection.close();
        });
    }
}
exports.Profile = Profile;
//# sourceMappingURL=index.js.map