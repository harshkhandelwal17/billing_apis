"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Style = exports.Drawer = exports.Cut = exports.Align = void 0;
var Align;
(function (Align) {
    Align[Align["Left"] = 0] = "Left";
    Align[Align["Center"] = 1] = "Center";
    Align[Align["Right"] = 2] = "Right";
})(Align = exports.Align || (exports.Align = {}));
var Cut;
(function (Cut) {
    Cut[Cut["Full"] = 0] = "Full";
    Cut[Cut["Partial"] = 1] = "Partial";
})(Cut = exports.Cut || (exports.Cut = {}));
var Drawer;
(function (Drawer) {
    Drawer[Drawer["First"] = 0] = "First";
    Drawer[Drawer["Second"] = 1] = "Second";
})(Drawer = exports.Drawer || (exports.Drawer = {}));
var Style;
(function (Style) {
    Style[Style["Bold"] = 1] = "Bold";
    Style[Style["Italic"] = 2] = "Italic";
    Style[Style["Underline"] = 4] = "Underline";
    Style[Style["Condensed"] = 8] = "Condensed";
    Style[Style["DoubleWidth"] = 16] = "DoubleWidth";
    Style[Style["DoubleHeight"] = 32] = "DoubleHeight";
})(Style = exports.Style || (exports.Style = {}));
//# sourceMappingURL=actions.js.map