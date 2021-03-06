#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var archiver = require("archiver");
var args = require("commander");
var fs = require("fs");
var _ = require("lodash");
var request = require("request-promise");
var stp = require("stream-to-promise");
var baseUrl = 'https://build.phonegap.com/api/v1';
var pollTime = 10000;
args
    .version('0.1')
    .option('-a, --appId <item>', 'Phone gap app id', parseInt)
    .option('-t, --token <item>', 'Phone gap build API auth token')
    .option('-p, --platform <item>', 'Platform')
    .option('-i, --keyId <item>', 'Key id')
    .option('-k, --keystorePassword <item>', 'Keystore password')
    .option('-s, --keyPassword <item>', 'Signing key password')
    .parse(process.argv);
// Load from environments if needed
if (!args.appId) {
    args.appId = process.env.PHONEGAP_APP_ID;
}
if (!args.token) {
    args.token = process.env.PHONEGAP_AUTH_TOKEN;
}
if (!args.keystorePassword) {
    args.keystorePassword = process.env.PHONEGAP_KEYSTORE_PASSWORD;
}
if (!args.keyPassword) {
    args.keyPassword = process.env.PHONEGAP_KEY_PASSWORD;
}
if (!args.keyId) {
    args.keyId = process.env.PHONEGAP_KEY_ID;
}
function sleep(duration) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    setTimeout(function () { return resolve(); }, duration);
                })];
        });
    });
}
function zip() {
    var archive = archiver('zip', {
        zlib: { level: 9 },
    });
    archive.glob('www/**/*');
    archive.glob('resources/**/*');
    archive.glob('config.xml');
    archive.finalize();
    console.log('Zipped app for upload.');
    return stp(archive);
}
function build(platform) {
    return __awaiter(this, void 0, void 0, function () {
        var zippedApp, response, password, keys, res, appTitle, status, e, result, outfilename, file;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, zip()
                    // Get all keys
                ];
                case 1:
                    zippedApp = _a.sent();
                    if (!!args.keyId) return [3 /*break*/, 3];
                    return [4 /*yield*/, request.get(baseUrl + "/keys?auth_token=" + args.token)];
                case 2:
                    response = _a.sent();
                    args.keyId = _.get(JSON.parse(response), "keys." + platform + ".all[0].id");
                    if (!args.keyId) {
                        console.info('No signing key found for this platform');
                    }
                    _a.label = 3;
                case 3:
                    if (!args.keyId) return [3 /*break*/, 5];
                    password = platform === 'ios' ? { password: args.keystorePassword } : { key_pw: args.keyPassword, keystore_pw: args.keystorePassword };
                    return [4 /*yield*/, request.put(baseUrl + "/keys/" + platform + "/" + args.keyId + "?auth_token=" + args.token, { formData: { data: JSON.stringify(password) } })];
                case 4:
                    _a.sent();
                    console.log('Unlocked key');
                    _a.label = 5;
                case 5:
                    keys = {};
                    keys[platform] = { id: args.keyId };
                    return [4 /*yield*/, request.put(baseUrl + "/apps/" + args.appId + "?auth_token=" + args.token, {
                            formData: {
                                file: {
                                    value: zippedApp,
                                    options: {
                                        filename: 'www.zip',
                                        contentType: 'application/zip',
                                    },
                                },
                                data: {
                                    keys: {
                                        value: keys,
                                        options: {
                                            contentType: 'application/json',
                                        },
                                    },
                                },
                            },
                        })];
                case 6:
                    res = _a.sent();
                    appTitle = JSON.parse(res).title;
                    console.log("Uploaded source code, new version " + JSON.parse(res).version);
                    // Start build
                    return [4 /*yield*/, request.post(baseUrl + "/apps/" + args.appId + "/build/" + platform + "?auth_token=" + args.token)];
                case 7:
                    // Start build
                    _a.sent();
                    console.log('Started build');
                    status = 'pending';
                    _a.label = 8;
                case 8:
                    if (!(status === 'pending')) return [3 /*break*/, 11];
                    return [4 /*yield*/, sleep(pollTime)];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, request.get(baseUrl + "/apps/" + args.appId + "?auth_token=" + args.token)];
                case 10:
                    e = _a.sent();
                    result = JSON.parse(e);
                    status = result.status[platform];
                    console.log("Status: " + status + "...");
                    if (status === 'error') {
                        console.log("Error: " + result.error[platform]);
                    }
                    return [3 /*break*/, 8];
                case 11:
                    if (!(status === 'complete')) return [3 /*break*/, 13];
                    outfilename = (appTitle ? appTitle : 'app') + "-" + platform + "." + (platform === 'ios' ? 'ipa' : 'apk');
                    return [4 /*yield*/, request.get(baseUrl + "/apps/" + args.appId + "/" + platform + "?auth_token=" + args.token).pipe(fs.createWriteStream(outfilename))];
                case 12:
                    file = _a.sent();
                    console.log("Downloaded " + outfilename);
                    _a.label = 13;
                case 13: return [2 /*return*/];
            }
        });
    });
}
build(args.platform);
