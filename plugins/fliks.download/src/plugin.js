"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/postgres-array/index.js
var require_postgres_array = __commonJS({
  "node_modules/postgres-array/index.js"(exports2) {
    "use strict";
    exports2.parse = function(source, transform) {
      return new ArrayParser(source, transform).parse();
    };
    var ArrayParser = class _ArrayParser {
      constructor(source, transform) {
        this.source = source;
        this.transform = transform || identity;
        this.position = 0;
        this.entries = [];
        this.recorded = [];
        this.dimension = 0;
      }
      isEof() {
        return this.position >= this.source.length;
      }
      nextCharacter() {
        var character = this.source[this.position++];
        if (character === "\\") {
          return {
            value: this.source[this.position++],
            escaped: true
          };
        }
        return {
          value: character,
          escaped: false
        };
      }
      record(character) {
        this.recorded.push(character);
      }
      newEntry(includeEmpty) {
        var entry;
        if (this.recorded.length > 0 || includeEmpty) {
          entry = this.recorded.join("");
          if (entry === "NULL" && !includeEmpty) {
            entry = null;
          }
          if (entry !== null) entry = this.transform(entry);
          this.entries.push(entry);
          this.recorded = [];
        }
      }
      consumeDimensions() {
        if (this.source[0] === "[") {
          while (!this.isEof()) {
            var char = this.nextCharacter();
            if (char.value === "=") break;
          }
        }
      }
      parse(nested) {
        var character, parser, quote;
        this.consumeDimensions();
        while (!this.isEof()) {
          character = this.nextCharacter();
          if (character.value === "{" && !quote) {
            this.dimension++;
            if (this.dimension > 1) {
              parser = new _ArrayParser(this.source.substr(this.position - 1), this.transform);
              this.entries.push(parser.parse(true));
              this.position += parser.position - 2;
            }
          } else if (character.value === "}" && !quote) {
            this.dimension--;
            if (!this.dimension) {
              this.newEntry();
              if (nested) return this.entries;
            }
          } else if (character.value === '"' && !character.escaped) {
            if (quote) this.newEntry(true);
            quote = !quote;
          } else if (character.value === "," && !quote) {
            this.newEntry();
          } else {
            this.record(character.value);
          }
        }
        if (this.dimension !== 0) {
          throw new Error("array dimension not balanced");
        }
        return this.entries;
      }
    };
    function identity(value) {
      return value;
    }
  }
});

// node_modules/pg-types/lib/arrayParser.js
var require_arrayParser = __commonJS({
  "node_modules/pg-types/lib/arrayParser.js"(exports2, module2) {
    var array = require_postgres_array();
    module2.exports = {
      create: function(source, transform) {
        return {
          parse: function() {
            return array.parse(source, transform);
          }
        };
      }
    };
  }
});

// node_modules/postgres-date/index.js
var require_postgres_date = __commonJS({
  "node_modules/postgres-date/index.js"(exports2, module2) {
    "use strict";
    var DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/;
    var DATE = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/;
    var TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/;
    var INFINITY = /^-?infinity$/;
    module2.exports = function parseDate(isoDate) {
      if (INFINITY.test(isoDate)) {
        return Number(isoDate.replace("i", "I"));
      }
      var matches = DATE_TIME.exec(isoDate);
      if (!matches) {
        return getDate(isoDate) || null;
      }
      var isBC = !!matches[8];
      var year = parseInt(matches[1], 10);
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var hour = parseInt(matches[4], 10);
      var minute = parseInt(matches[5], 10);
      var second = parseInt(matches[6], 10);
      var ms = matches[7];
      ms = ms ? 1e3 * parseFloat(ms) : 0;
      var date;
      var offset = timeZoneOffset(isoDate);
      if (offset != null) {
        date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
        if (is0To99(year)) {
          date.setUTCFullYear(year);
        }
        if (offset !== 0) {
          date.setTime(date.getTime() - offset);
        }
      } else {
        date = new Date(year, month, day, hour, minute, second, ms);
        if (is0To99(year)) {
          date.setFullYear(year);
        }
      }
      return date;
    };
    function getDate(isoDate) {
      var matches = DATE.exec(isoDate);
      if (!matches) {
        return;
      }
      var year = parseInt(matches[1], 10);
      var isBC = !!matches[4];
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var date = new Date(year, month, day);
      if (is0To99(year)) {
        date.setFullYear(year);
      }
      return date;
    }
    function timeZoneOffset(isoDate) {
      if (isoDate.endsWith("+00")) {
        return 0;
      }
      var zone = TIME_ZONE.exec(isoDate.split(" ")[1]);
      if (!zone) return;
      var type = zone[1];
      if (type === "Z") {
        return 0;
      }
      var sign = type === "-" ? -1 : 1;
      var offset = parseInt(zone[2], 10) * 3600 + parseInt(zone[3] || 0, 10) * 60 + parseInt(zone[4] || 0, 10);
      return offset * sign * 1e3;
    }
    function bcYearToNegativeYear(year) {
      return -(year - 1);
    }
    function is0To99(num) {
      return num >= 0 && num < 100;
    }
  }
});

// node_modules/xtend/mutable.js
var require_mutable = __commonJS({
  "node_modules/xtend/mutable.js"(exports2, module2) {
    module2.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    }
  }
});

// node_modules/postgres-interval/index.js
var require_postgres_interval = __commonJS({
  "node_modules/postgres-interval/index.js"(exports2, module2) {
    "use strict";
    var extend = require_mutable();
    module2.exports = PostgresInterval;
    function PostgresInterval(raw) {
      if (!(this instanceof PostgresInterval)) {
        return new PostgresInterval(raw);
      }
      extend(this, parse(raw));
    }
    var properties = ["seconds", "minutes", "hours", "days", "months", "years"];
    PostgresInterval.prototype.toPostgres = function() {
      var filtered = properties.filter(this.hasOwnProperty, this);
      if (this.milliseconds && filtered.indexOf("seconds") < 0) {
        filtered.push("seconds");
      }
      if (filtered.length === 0) return "0";
      return filtered.map(function(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/\.?0+$/, "");
        }
        return value + " " + property;
      }, this).join(" ");
    };
    var propertiesISOEquivalent = {
      years: "Y",
      months: "M",
      days: "D",
      hours: "H",
      minutes: "M",
      seconds: "S"
    };
    var dateProperties = ["years", "months", "days"];
    var timeProperties = ["hours", "minutes", "seconds"];
    PostgresInterval.prototype.toISOString = PostgresInterval.prototype.toISO = function() {
      var datePart = dateProperties.map(buildProperty, this).join("");
      var timePart = timeProperties.map(buildProperty, this).join("");
      return "P" + datePart + "T" + timePart;
      function buildProperty(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/0+$/, "");
        }
        return value + propertiesISOEquivalent[property];
      }
    };
    var NUMBER = "([+-]?\\d+)";
    var YEAR = NUMBER + "\\s+years?";
    var MONTH = NUMBER + "\\s+mons?";
    var DAY = NUMBER + "\\s+days?";
    var TIME = "([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?";
    var INTERVAL = new RegExp([YEAR, MONTH, DAY, TIME].map(function(regexString) {
      return "(" + regexString + ")?";
    }).join("\\s*"));
    var positions = {
      years: 2,
      months: 4,
      days: 6,
      hours: 9,
      minutes: 10,
      seconds: 11,
      milliseconds: 12
    };
    var negatives = ["hours", "minutes", "seconds", "milliseconds"];
    function parseMilliseconds(fraction) {
      var microseconds = fraction + "000000".slice(fraction.length);
      return parseInt(microseconds, 10) / 1e3;
    }
    function parse(interval) {
      if (!interval) return {};
      var matches = INTERVAL.exec(interval);
      var isNegative = matches[8] === "-";
      return Object.keys(positions).reduce(function(parsed, property) {
        var position = positions[property];
        var value = matches[position];
        if (!value) return parsed;
        value = property === "milliseconds" ? parseMilliseconds(value) : parseInt(value, 10);
        if (!value) return parsed;
        if (isNegative && ~negatives.indexOf(property)) {
          value *= -1;
        }
        parsed[property] = value;
        return parsed;
      }, {});
    }
  }
});

// node_modules/postgres-bytea/index.js
var require_postgres_bytea = __commonJS({
  "node_modules/postgres-bytea/index.js"(exports2, module2) {
    "use strict";
    var bufferFrom = Buffer.from || Buffer;
    module2.exports = function parseBytea(input) {
      if (/^\\x/.test(input)) {
        return bufferFrom(input.substr(2), "hex");
      }
      var output = "";
      var i = 0;
      while (i < input.length) {
        if (input[i] !== "\\") {
          output += input[i];
          ++i;
        } else {
          if (/[0-7]{3}/.test(input.substr(i + 1, 3))) {
            output += String.fromCharCode(parseInt(input.substr(i + 1, 3), 8));
            i += 4;
          } else {
            var backslashes = 1;
            while (i + backslashes < input.length && input[i + backslashes] === "\\") {
              backslashes++;
            }
            for (var k = 0; k < Math.floor(backslashes / 2); ++k) {
              output += "\\";
            }
            i += Math.floor(backslashes / 2) * 2;
          }
        }
      }
      return bufferFrom(output, "binary");
    };
  }
});

// node_modules/pg-types/lib/textParsers.js
var require_textParsers = __commonJS({
  "node_modules/pg-types/lib/textParsers.js"(exports2, module2) {
    var array = require_postgres_array();
    var arrayParser = require_arrayParser();
    var parseDate = require_postgres_date();
    var parseInterval = require_postgres_interval();
    var parseByteA = require_postgres_bytea();
    function allowNull(fn) {
      return function nullAllowed(value) {
        if (value === null) return value;
        return fn(value);
      };
    }
    function parseBool(value) {
      if (value === null) return value;
      return value === "TRUE" || value === "t" || value === "true" || value === "y" || value === "yes" || value === "on" || value === "1";
    }
    function parseBoolArray(value) {
      if (!value) return null;
      return array.parse(value, parseBool);
    }
    function parseBaseTenInt(string) {
      return parseInt(string, 10);
    }
    function parseIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(parseBaseTenInt));
    }
    function parseBigIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(function(entry) {
        return parseBigInteger(entry).trim();
      }));
    }
    var parsePointArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parsePoint(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseFloatArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseFloat(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseStringArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value);
      return p.parse();
    };
    var parseDateArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseDate(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseIntervalArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseInterval(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseByteAArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(parseByteA));
    };
    var parseInteger = function(value) {
      return parseInt(value, 10);
    };
    var parseBigInteger = function(value) {
      var valStr = String(value);
      if (/^\d+$/.test(valStr)) {
        return valStr;
      }
      return value;
    };
    var parseJsonArray2 = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(JSON.parse));
    };
    var parsePoint = function(value) {
      if (value[0] !== "(") {
        return null;
      }
      value = value.substring(1, value.length - 1).split(",");
      return {
        x: parseFloat(value[0]),
        y: parseFloat(value[1])
      };
    };
    var parseCircle = function(value) {
      if (value[0] !== "<" && value[1] !== "(") {
        return null;
      }
      var point = "(";
      var radius = "";
      var pointParsed = false;
      for (var i = 2; i < value.length - 1; i++) {
        if (!pointParsed) {
          point += value[i];
        }
        if (value[i] === ")") {
          pointParsed = true;
          continue;
        } else if (!pointParsed) {
          continue;
        }
        if (value[i] === ",") {
          continue;
        }
        radius += value[i];
      }
      var result = parsePoint(point);
      result.radius = parseFloat(radius);
      return result;
    };
    var init = function(register) {
      register(20, parseBigInteger);
      register(21, parseInteger);
      register(23, parseInteger);
      register(26, parseInteger);
      register(700, parseFloat);
      register(701, parseFloat);
      register(16, parseBool);
      register(1082, parseDate);
      register(1114, parseDate);
      register(1184, parseDate);
      register(600, parsePoint);
      register(651, parseStringArray);
      register(718, parseCircle);
      register(1e3, parseBoolArray);
      register(1001, parseByteAArray);
      register(1005, parseIntegerArray);
      register(1007, parseIntegerArray);
      register(1028, parseIntegerArray);
      register(1016, parseBigIntegerArray);
      register(1017, parsePointArray);
      register(1021, parseFloatArray);
      register(1022, parseFloatArray);
      register(1231, parseFloatArray);
      register(1014, parseStringArray);
      register(1015, parseStringArray);
      register(1008, parseStringArray);
      register(1009, parseStringArray);
      register(1040, parseStringArray);
      register(1041, parseStringArray);
      register(1115, parseDateArray);
      register(1182, parseDateArray);
      register(1185, parseDateArray);
      register(1186, parseInterval);
      register(1187, parseIntervalArray);
      register(17, parseByteA);
      register(114, JSON.parse.bind(JSON));
      register(3802, JSON.parse.bind(JSON));
      register(199, parseJsonArray2);
      register(3807, parseJsonArray2);
      register(3907, parseStringArray);
      register(2951, parseStringArray);
      register(791, parseStringArray);
      register(1183, parseStringArray);
      register(1270, parseStringArray);
    };
    module2.exports = {
      init
    };
  }
});

// node_modules/pg-int8/index.js
var require_pg_int8 = __commonJS({
  "node_modules/pg-int8/index.js"(exports2, module2) {
    "use strict";
    var BASE = 1e6;
    function readInt8(buffer) {
      var high = buffer.readInt32BE(0);
      var low = buffer.readUInt32BE(4);
      var sign = "";
      if (high < 0) {
        high = ~high + (low === 0);
        low = ~low + 1 >>> 0;
        sign = "-";
      }
      var result = "";
      var carry;
      var t;
      var digits;
      var pad;
      var l;
      var i;
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        t = 4294967296 * carry + low;
        digits = "" + t % BASE;
        return sign + digits + result;
      }
    }
    module2.exports = readInt8;
  }
});

// node_modules/pg-types/lib/binaryParsers.js
var require_binaryParsers = __commonJS({
  "node_modules/pg-types/lib/binaryParsers.js"(exports2, module2) {
    var parseInt64 = require_pg_int8();
    var parseBits = function(data, bits, offset, invert, callback) {
      offset = offset || 0;
      invert = invert || false;
      callback = callback || function(lastValue, newValue, bits2) {
        return lastValue * Math.pow(2, bits2) + newValue;
      };
      var offsetBytes = offset >> 3;
      var inv = function(value) {
        if (invert) {
          return ~value & 255;
        }
        return value;
      };
      var mask = 255;
      var firstBits = 8 - offset % 8;
      if (bits < firstBits) {
        mask = 255 << 8 - bits & 255;
        firstBits = bits;
      }
      if (offset) {
        mask = mask >> offset % 8;
      }
      var result = 0;
      if (offset % 8 + bits >= 8) {
        result = callback(0, inv(data[offsetBytes]) & mask, firstBits);
      }
      var bytes = bits + offset >> 3;
      for (var i = offsetBytes + 1; i < bytes; i++) {
        result = callback(result, inv(data[i]), 8);
      }
      var lastBits = (bits + offset) % 8;
      if (lastBits > 0) {
        result = callback(result, inv(data[bytes]) >> 8 - lastBits, lastBits);
      }
      return result;
    };
    var parseFloatFromBits = function(data, precisionBits, exponentBits) {
      var bias = Math.pow(2, exponentBits - 1) - 1;
      var sign = parseBits(data, 1);
      var exponent = parseBits(data, exponentBits, 1);
      if (exponent === 0) {
        return 0;
      }
      var precisionBitsCounter = 1;
      var parsePrecisionBits = function(lastValue, newValue, bits) {
        if (lastValue === 0) {
          lastValue = 1;
        }
        for (var i = 1; i <= bits; i++) {
          precisionBitsCounter /= 2;
          if ((newValue & 1 << bits - i) > 0) {
            lastValue += precisionBitsCounter;
          }
        }
        return lastValue;
      };
      var mantissa = parseBits(data, precisionBits, exponentBits + 1, false, parsePrecisionBits);
      if (exponent == Math.pow(2, exponentBits + 1) - 1) {
        if (mantissa === 0) {
          return sign === 0 ? Infinity : -Infinity;
        }
        return NaN;
      }
      return (sign === 0 ? 1 : -1) * Math.pow(2, exponent - bias) * mantissa;
    };
    var parseInt16 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 15, 1, true) + 1);
      }
      return parseBits(value, 15, 1);
    };
    var parseInt32 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 31, 1, true) + 1);
      }
      return parseBits(value, 31, 1);
    };
    var parseFloat32 = function(value) {
      return parseFloatFromBits(value, 23, 8);
    };
    var parseFloat64 = function(value) {
      return parseFloatFromBits(value, 52, 11);
    };
    var parseNumeric = function(value) {
      var sign = parseBits(value, 16, 32);
      if (sign == 49152) {
        return NaN;
      }
      var weight = Math.pow(1e4, parseBits(value, 16, 16));
      var result = 0;
      var digits = [];
      var ndigits = parseBits(value, 16);
      for (var i = 0; i < ndigits; i++) {
        result += parseBits(value, 16, 64 + 16 * i) * weight;
        weight /= 1e4;
      }
      var scale = Math.pow(10, parseBits(value, 16, 48));
      return (sign === 0 ? 1 : -1) * Math.round(result * scale) / scale;
    };
    var parseDate = function(isUTC, value) {
      var sign = parseBits(value, 1);
      var rawValue = parseBits(value, 63, 1);
      var result = new Date((sign === 0 ? 1 : -1) * rawValue / 1e3 + 9466848e5);
      if (!isUTC) {
        result.setTime(result.getTime() + result.getTimezoneOffset() * 6e4);
      }
      result.usec = rawValue % 1e3;
      result.getMicroSeconds = function() {
        return this.usec;
      };
      result.setMicroSeconds = function(value2) {
        this.usec = value2;
      };
      result.getUTCMicroSeconds = function() {
        return this.usec;
      };
      return result;
    };
    var parseArray = function(value) {
      var dim = parseBits(value, 32);
      var flags = parseBits(value, 32, 32);
      var elementType = parseBits(value, 32, 64);
      var offset = 96;
      var dims = [];
      for (var i = 0; i < dim; i++) {
        dims[i] = parseBits(value, 32, offset);
        offset += 32;
        offset += 32;
      }
      var parseElement = function(elementType2) {
        var length = parseBits(value, 32, offset);
        offset += 32;
        if (length == 4294967295) {
          return null;
        }
        var result;
        if (elementType2 == 23 || elementType2 == 20) {
          result = parseBits(value, length * 8, offset);
          offset += length * 8;
          return result;
        } else if (elementType2 == 25) {
          result = value.toString(this.encoding, offset >> 3, (offset += length << 3) >> 3);
          return result;
        } else {
          console.log("ERROR: ElementType not implemented: " + elementType2);
        }
      };
      var parse = function(dimension, elementType2) {
        var array = [];
        var i2;
        if (dimension.length > 1) {
          var count = dimension.shift();
          for (i2 = 0; i2 < count; i2++) {
            array[i2] = parse(dimension, elementType2);
          }
          dimension.unshift(count);
        } else {
          for (i2 = 0; i2 < dimension[0]; i2++) {
            array[i2] = parseElement(elementType2);
          }
        }
        return array;
      };
      return parse(dims, elementType);
    };
    var parseText = function(value) {
      return value.toString("utf8");
    };
    var parseBool = function(value) {
      if (value === null) return null;
      return parseBits(value, 8) > 0;
    };
    var init = function(register) {
      register(20, parseInt64);
      register(21, parseInt16);
      register(23, parseInt32);
      register(26, parseInt32);
      register(1700, parseNumeric);
      register(700, parseFloat32);
      register(701, parseFloat64);
      register(16, parseBool);
      register(1114, parseDate.bind(null, false));
      register(1184, parseDate.bind(null, true));
      register(1e3, parseArray);
      register(1007, parseArray);
      register(1016, parseArray);
      register(1008, parseArray);
      register(1009, parseArray);
      register(25, parseText);
    };
    module2.exports = {
      init
    };
  }
});

// node_modules/pg-types/lib/builtins.js
var require_builtins = __commonJS({
  "node_modules/pg-types/lib/builtins.js"(exports2, module2) {
    module2.exports = {
      BOOL: 16,
      BYTEA: 17,
      CHAR: 18,
      INT8: 20,
      INT2: 21,
      INT4: 23,
      REGPROC: 24,
      TEXT: 25,
      OID: 26,
      TID: 27,
      XID: 28,
      CID: 29,
      JSON: 114,
      XML: 142,
      PG_NODE_TREE: 194,
      SMGR: 210,
      PATH: 602,
      POLYGON: 604,
      CIDR: 650,
      FLOAT4: 700,
      FLOAT8: 701,
      ABSTIME: 702,
      RELTIME: 703,
      TINTERVAL: 704,
      CIRCLE: 718,
      MACADDR8: 774,
      MONEY: 790,
      MACADDR: 829,
      INET: 869,
      ACLITEM: 1033,
      BPCHAR: 1042,
      VARCHAR: 1043,
      DATE: 1082,
      TIME: 1083,
      TIMESTAMP: 1114,
      TIMESTAMPTZ: 1184,
      INTERVAL: 1186,
      TIMETZ: 1266,
      BIT: 1560,
      VARBIT: 1562,
      NUMERIC: 1700,
      REFCURSOR: 1790,
      REGPROCEDURE: 2202,
      REGOPER: 2203,
      REGOPERATOR: 2204,
      REGCLASS: 2205,
      REGTYPE: 2206,
      UUID: 2950,
      TXID_SNAPSHOT: 2970,
      PG_LSN: 3220,
      PG_NDISTINCT: 3361,
      PG_DEPENDENCIES: 3402,
      TSVECTOR: 3614,
      TSQUERY: 3615,
      GTSVECTOR: 3642,
      REGCONFIG: 3734,
      REGDICTIONARY: 3769,
      JSONB: 3802,
      REGNAMESPACE: 4089,
      REGROLE: 4096
    };
  }
});

// node_modules/pg-types/index.js
var require_pg_types = __commonJS({
  "node_modules/pg-types/index.js"(exports2) {
    var textParsers = require_textParsers();
    var binaryParsers = require_binaryParsers();
    var arrayParser = require_arrayParser();
    var builtinTypes = require_builtins();
    exports2.getTypeParser = getTypeParser;
    exports2.setTypeParser = setTypeParser;
    exports2.arrayParser = arrayParser;
    exports2.builtins = builtinTypes;
    var typeParsers = {
      text: {},
      binary: {}
    };
    function noParse(val) {
      return String(val);
    }
    function getTypeParser(oid, format) {
      format = format || "text";
      if (!typeParsers[format]) {
        return noParse;
      }
      return typeParsers[format][oid] || noParse;
    }
    function setTypeParser(oid, format, parseFn) {
      if (typeof format == "function") {
        parseFn = format;
        format = "text";
      }
      typeParsers[format][oid] = parseFn;
    }
    textParsers.init(function(oid, converter) {
      typeParsers.text[oid] = converter;
    });
    binaryParsers.init(function(oid, converter) {
      typeParsers.binary[oid] = converter;
    });
  }
});

// node_modules/pg/lib/defaults.js
var require_defaults = __commonJS({
  "node_modules/pg/lib/defaults.js"(exports2, module2) {
    "use strict";
    var user;
    try {
      user = process.platform === "win32" ? process.env.USERNAME : process.env.USER;
    } catch {
    }
    module2.exports = {
      // database host. defaults to localhost
      host: "localhost",
      // database user's name
      user,
      // name of database to connect
      database: void 0,
      // database user's password
      password: null,
      // a Postgres connection string to be used instead of setting individual connection items
      // NOTE:  Setting this value will cause it to override any other value (such as database or user) defined
      // in the defaults object.
      connectionString: void 0,
      // database port
      port: 5432,
      // number of rows to return at a time from a prepared statement's
      // portal. 0 will return all rows at once
      rows: 0,
      // binary result mode
      binary: false,
      // Connection pool options - see https://github.com/brianc/node-pg-pool
      // number of connections to use in connection pool
      // 0 will disable connection pooling
      max: 10,
      // max milliseconds a client can go unused before it is removed
      // from the pool and destroyed
      idleTimeoutMillis: 3e4,
      client_encoding: "",
      ssl: false,
      // SSL negotiation style: 'postgres' (traditional SSLRequest) or 'direct'
      sslnegotiation: void 0,
      application_name: void 0,
      fallback_application_name: void 0,
      options: void 0,
      parseInputDatesAsUTC: false,
      // max milliseconds any query using this connection will execute for before timing out in error.
      // false=unlimited
      statement_timeout: false,
      // Abort any statement that waits longer than the specified duration in milliseconds while attempting to acquire a lock.
      // false=unlimited
      lock_timeout: false,
      // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds
      // false=unlimited
      idle_in_transaction_session_timeout: false,
      // max milliseconds to wait for query to complete (client side)
      query_timeout: false,
      connect_timeout: 0,
      keepalives: 1,
      keepalives_idle: 0
    };
    var pgTypes = require_pg_types();
    var parseBigInteger = pgTypes.getTypeParser(20, "text");
    var parseBigIntegerArray = pgTypes.getTypeParser(1016, "text");
    module2.exports.__defineSetter__("parseInt8", function(val) {
      pgTypes.setTypeParser(20, "text", val ? pgTypes.getTypeParser(23, "text") : parseBigInteger);
      pgTypes.setTypeParser(1016, "text", val ? pgTypes.getTypeParser(1007, "text") : parseBigIntegerArray);
    });
  }
});

// node_modules/pg/lib/utils.js
var require_utils = __commonJS({
  "node_modules/pg/lib/utils.js"(exports2, module2) {
    "use strict";
    var defaults2 = require_defaults();
    var { isDate } = require("util/types");
    function escapeElement(elementRepresentation) {
      const escaped = elementRepresentation.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return '"' + escaped + '"';
    }
    function arrayString(val) {
      let result = "{";
      for (let i = 0; i < val.length; i++) {
        if (i > 0) {
          result += ",";
        }
        let item = val[i];
        if (item == null) {
          result += "NULL";
        } else if (Array.isArray(item)) {
          result += arrayString(item);
        } else if (ArrayBuffer.isView(item)) {
          if (!(item instanceof Buffer)) {
            item = Buffer.from(item.buffer, item.byteOffset, item.byteLength);
          }
          result += "\\\\x" + item.toString("hex");
        } else {
          result += escapeElement(prepareValue(item));
        }
      }
      result += "}";
      return result;
    }
    var prepareValue = function(val, seen) {
      if (val == null) {
        return null;
      }
      if (typeof val === "object") {
        if (val instanceof Buffer) {
          return val;
        }
        if (ArrayBuffer.isView(val)) {
          return Buffer.from(val.buffer, val.byteOffset, val.byteLength);
        }
        if (isDate(val)) {
          if (defaults2.parseInputDatesAsUTC) {
            return dateToStringUTC(val);
          } else {
            return dateToString(val);
          }
        }
        if (Array.isArray(val)) {
          return arrayString(val);
        }
        return prepareObject(val, seen);
      }
      return val.toString();
    };
    function prepareObject(val, seen) {
      if (val && typeof val.toPostgres === "function") {
        seen = seen || [];
        if (seen.indexOf(val) !== -1) {
          throw new Error('circular reference detected while preparing "' + val + '" for query');
        }
        seen.push(val);
        return prepareValue(val.toPostgres(prepareValue), seen);
      }
      return JSON.stringify(val);
    }
    function dateToString(date) {
      let offset = -date.getTimezoneOffset();
      let year = date.getFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + "T" + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0") + ":" + String(date.getSeconds()).padStart(2, "0") + "." + String(date.getMilliseconds()).padStart(3, "0");
      if (offset < 0) {
        ret += "-";
        offset *= -1;
      } else {
        ret += "+";
      }
      ret += String(Math.floor(offset / 60)).padStart(2, "0") + ":" + String(offset % 60).padStart(2, "0");
      if (isBCYear) ret += " BC";
      return ret;
    }
    function dateToStringUTC(date) {
      let year = date.getUTCFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0") + "T" + String(date.getUTCHours()).padStart(2, "0") + ":" + String(date.getUTCMinutes()).padStart(2, "0") + ":" + String(date.getUTCSeconds()).padStart(2, "0") + "." + String(date.getUTCMilliseconds()).padStart(3, "0");
      ret += "+00:00";
      if (isBCYear) ret += " BC";
      return ret;
    }
    function normalizeQueryConfig(config, values, callback) {
      config = typeof config === "string" ? { text: config } : config;
      if (values) {
        if (typeof values === "function") {
          config.callback = values;
        } else {
          config.values = values;
        }
      }
      if (callback) {
        config.callback = callback;
      }
      return config;
    }
    var escapeIdentifier2 = function(str) {
      return '"' + str.replace(/"/g, '""') + '"';
    };
    var escapeLiteral2 = function(str) {
      let hasBackslash = false;
      let escaped = "'";
      if (str == null) {
        return "''";
      }
      if (typeof str !== "string") {
        return "''";
      }
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "'") {
          escaped += c + c;
        } else if (c === "\\") {
          escaped += c + c;
          hasBackslash = true;
        } else {
          escaped += c;
        }
      }
      escaped += "'";
      if (hasBackslash === true) {
        escaped = " E" + escaped;
      }
      return escaped;
    };
    module2.exports = {
      prepareValue: function prepareValueWrapper(value) {
        return prepareValue(value);
      },
      normalizeQueryConfig,
      escapeIdentifier: escapeIdentifier2,
      escapeLiteral: escapeLiteral2
    };
  }
});

// node_modules/pg/lib/crypto/utils.js
var require_utils2 = __commonJS({
  "node_modules/pg/lib/crypto/utils.js"(exports2, module2) {
    var nodeCrypto = require("crypto");
    module2.exports = {
      postgresMd5PasswordHash,
      randomBytes,
      deriveKey,
      sha256,
      hashByName,
      hmacSha256,
      md5
    };
    var webCrypto = nodeCrypto.webcrypto || globalThis.crypto;
    var subtleCrypto = webCrypto.subtle;
    var textEncoder = new TextEncoder();
    function randomBytes(length) {
      return webCrypto.getRandomValues(Buffer.alloc(length));
    }
    async function md5(string) {
      try {
        return nodeCrypto.createHash("md5").update(string, "utf-8").digest("hex");
      } catch (e) {
        const data = typeof string === "string" ? textEncoder.encode(string) : string;
        const hash = await subtleCrypto.digest("MD5", data);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
    async function postgresMd5PasswordHash(user, password, salt) {
      const inner = await md5(password + user);
      const outer = await md5(Buffer.concat([Buffer.from(inner), salt]));
      return "md5" + outer;
    }
    async function sha256(text) {
      return await subtleCrypto.digest("SHA-256", text);
    }
    async function hashByName(hashName, text) {
      return await subtleCrypto.digest(hashName, text);
    }
    async function hmacSha256(keyBuffer, msg) {
      const key = await subtleCrypto.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return await subtleCrypto.sign("HMAC", key, textEncoder.encode(msg));
    }
    async function deriveKey(password, salt, iterations) {
      const key = await subtleCrypto.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const params = { name: "PBKDF2", hash: "SHA-256", salt, iterations };
      return await subtleCrypto.deriveBits(params, key, 32 * 8, ["deriveBits"]);
    }
  }
});

// node_modules/pg/lib/crypto/cert-signatures.js
var require_cert_signatures = __commonJS({
  "node_modules/pg/lib/crypto/cert-signatures.js"(exports2, module2) {
    function x509Error(msg, cert) {
      return new Error("SASL channel binding: " + msg + " when parsing public certificate " + cert.toString("base64"));
    }
    function readASN1Length(data, index) {
      let length = data[index++];
      if (length < 128) return { length, index };
      const lengthBytes = length & 127;
      if (lengthBytes > 4) throw x509Error("bad length", data);
      length = 0;
      for (let i = 0; i < lengthBytes; i++) {
        length = length << 8 | data[index++];
      }
      return { length, index };
    }
    function readASN1OID(data, index) {
      if (data[index++] !== 6) throw x509Error("non-OID data", data);
      const { length: OIDLength, index: indexAfterOIDLength } = readASN1Length(data, index);
      index = indexAfterOIDLength;
      const lastIndex = index + OIDLength;
      const byte1 = data[index++];
      let oid = (byte1 / 40 >> 0) + "." + byte1 % 40;
      while (index < lastIndex) {
        let value = 0;
        while (index < lastIndex) {
          const nextByte = data[index++];
          value = value << 7 | nextByte & 127;
          if (nextByte < 128) break;
        }
        oid += "." + value;
      }
      return { oid, index };
    }
    function expectASN1Seq(data, index) {
      if (data[index++] !== 48) throw x509Error("non-sequence data", data);
      return readASN1Length(data, index);
    }
    function signatureAlgorithmHashFromCertificate(data, index) {
      if (index === void 0) index = 0;
      index = expectASN1Seq(data, index).index;
      const { length: certInfoLength, index: indexAfterCertInfoLength } = expectASN1Seq(data, index);
      index = indexAfterCertInfoLength + certInfoLength;
      index = expectASN1Seq(data, index).index;
      const { oid, index: indexAfterOID } = readASN1OID(data, index);
      switch (oid) {
        // RSA
        case "1.2.840.113549.1.1.4":
          return "MD5";
        case "1.2.840.113549.1.1.5":
          return "SHA-1";
        case "1.2.840.113549.1.1.11":
          return "SHA-256";
        case "1.2.840.113549.1.1.12":
          return "SHA-384";
        case "1.2.840.113549.1.1.13":
          return "SHA-512";
        case "1.2.840.113549.1.1.14":
          return "SHA-224";
        case "1.2.840.113549.1.1.15":
          return "SHA512-224";
        case "1.2.840.113549.1.1.16":
          return "SHA512-256";
        // ECDSA
        case "1.2.840.10045.4.1":
          return "SHA-1";
        case "1.2.840.10045.4.3.1":
          return "SHA-224";
        case "1.2.840.10045.4.3.2":
          return "SHA-256";
        case "1.2.840.10045.4.3.3":
          return "SHA-384";
        case "1.2.840.10045.4.3.4":
          return "SHA-512";
        // RSASSA-PSS: hash is indicated separately
        case "1.2.840.113549.1.1.10": {
          index = indexAfterOID;
          index = expectASN1Seq(data, index).index;
          if (data[index++] !== 160) throw x509Error("non-tag data", data);
          index = readASN1Length(data, index).index;
          index = expectASN1Seq(data, index).index;
          const { oid: hashOID } = readASN1OID(data, index);
          switch (hashOID) {
            // standalone hash OIDs
            case "1.2.840.113549.2.5":
              return "MD5";
            case "1.3.14.3.2.26":
              return "SHA-1";
            case "2.16.840.1.101.3.4.2.1":
              return "SHA-256";
            case "2.16.840.1.101.3.4.2.2":
              return "SHA-384";
            case "2.16.840.1.101.3.4.2.3":
              return "SHA-512";
          }
          throw x509Error("unknown hash OID " + hashOID, data);
        }
        // Ed25519 -- see https: return//github.com/openssl/openssl/issues/15477
        case "1.3.101.110":
        case "1.3.101.112":
          return "SHA-512";
        // Ed448 -- still not in pg 17.2 (if supported, digest would be SHAKE256 x 64 bytes)
        case "1.3.101.111":
        case "1.3.101.113":
          throw x509Error("Ed448 certificate channel binding is not currently supported by Postgres");
      }
      throw x509Error("unknown OID " + oid, data);
    }
    module2.exports = { signatureAlgorithmHashFromCertificate };
  }
});

// node_modules/pg/lib/crypto/sasl.js
var require_sasl = __commonJS({
  "node_modules/pg/lib/crypto/sasl.js"(exports2, module2) {
    "use strict";
    var crypto2 = require_utils2();
    var { signatureAlgorithmHashFromCertificate } = require_cert_signatures();
    function saslprep(password) {
      const nonAsciiSpace = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g;
      const mappedToNothing = /[\u00AD\u034F\u1806\u180B\u180C\u180D\u200C\u200D\u2060\uFE00-\uFE0F\uFEFF]/g;
      return password.replace(nonAsciiSpace, " ").replace(mappedToNothing, "").normalize("NFKC");
    }
    var DEFAULT_MAX_SCRAM_ITERATIONS = 1e5;
    function startSession(mechanisms, stream, scramMaxIterations = DEFAULT_MAX_SCRAM_ITERATIONS) {
      const candidates = ["SCRAM-SHA-256"];
      if (stream) candidates.unshift("SCRAM-SHA-256-PLUS");
      const mechanism = candidates.find((candidate) => mechanisms.includes(candidate));
      if (!mechanism) {
        throw new Error("SASL: Only mechanism(s) " + candidates.join(" and ") + " are supported");
      }
      if (mechanism === "SCRAM-SHA-256-PLUS" && typeof stream.getPeerCertificate !== "function") {
        throw new Error("SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate");
      }
      const clientNonce = crypto2.randomBytes(18).toString("base64");
      const gs2Header = mechanism === "SCRAM-SHA-256-PLUS" ? "p=tls-server-end-point" : stream ? "y" : "n";
      return {
        mechanism,
        clientNonce,
        response: gs2Header + ",,n=*,r=" + clientNonce,
        message: "SASLInitialResponse",
        scramMaxIterations
      };
    }
    async function continueSession(session, password, serverData, stream) {
      if (session.message !== "SASLInitialResponse") {
        throw new Error("SASL: Last message was not SASLInitialResponse");
      }
      if (typeof password !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
      }
      if (password === "") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
      }
      const sv = parseServerFirstMessage(serverData);
      if (!sv.nonce.startsWith(session.clientNonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
      } else if (sv.nonce.length === session.clientNonce.length) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
      }
      const scramMaxIterations = typeof session.scramMaxIterations === "number" ? session.scramMaxIterations : DEFAULT_MAX_SCRAM_ITERATIONS;
      if (scramMaxIterations !== 0 && sv.iteration > scramMaxIterations) {
        throw new Error(
          "SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration count " + sv.iteration + " exceeds scramMaxIterations of " + scramMaxIterations
        );
      }
      const clientFirstMessageBare = "n=*,r=" + session.clientNonce;
      const serverFirstMessage = "r=" + sv.nonce + ",s=" + sv.salt + ",i=" + sv.iteration;
      let channelBinding = stream ? "eSws" : "biws";
      if (session.mechanism === "SCRAM-SHA-256-PLUS") {
        const peerCert = stream.getPeerCertificate().raw;
        let hashName = signatureAlgorithmHashFromCertificate(peerCert);
        if (hashName === "MD5" || hashName === "SHA-1") hashName = "SHA-256";
        const certHash = await crypto2.hashByName(hashName, peerCert);
        const bindingData = Buffer.concat([Buffer.from("p=tls-server-end-point,,"), Buffer.from(certHash)]);
        channelBinding = bindingData.toString("base64");
      }
      const clientFinalMessageWithoutProof = "c=" + channelBinding + ",r=" + sv.nonce;
      const authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;
      const saltBytes = Buffer.from(sv.salt, "base64");
      const saltedPassword = await crypto2.deriveKey(saslprep(password), saltBytes, sv.iteration);
      const clientKey = await crypto2.hmacSha256(saltedPassword, "Client Key");
      const storedKey = await crypto2.sha256(clientKey);
      const clientSignature = await crypto2.hmacSha256(storedKey, authMessage);
      const clientProof = xorBuffers(Buffer.from(clientKey), Buffer.from(clientSignature)).toString("base64");
      const serverKey = await crypto2.hmacSha256(saltedPassword, "Server Key");
      const serverSignatureBytes = await crypto2.hmacSha256(serverKey, authMessage);
      session.message = "SASLResponse";
      session.serverSignature = Buffer.from(serverSignatureBytes).toString("base64");
      session.response = clientFinalMessageWithoutProof + ",p=" + clientProof;
    }
    function finalizeSession(session, serverData) {
      if (session.message !== "SASLResponse") {
        throw new Error("SASL: Last message was not SASLResponse");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
      }
      const { serverSignature } = parseServerFinalMessage(serverData);
      if (serverSignature !== session.serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
      }
    }
    function isPrintableChars(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: text must be a string");
      }
      return text.split("").map((_, i) => text.charCodeAt(i)).every((c) => c >= 33 && c <= 43 || c >= 45 && c <= 126);
    }
    function isBase64(text) {
      return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(text);
    }
    function parseAttributePairs(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: attribute pairs text must be a string");
      }
      return new Map(
        text.split(",").map((attrValue) => {
          if (!/^.=/.test(attrValue)) {
            throw new Error("SASL: Invalid attribute pair entry");
          }
          const name = attrValue[0];
          const value = attrValue.substring(2);
          return [name, value];
        })
      );
    }
    function parseServerFirstMessage(data) {
      const attrPairs = parseAttributePairs(data);
      const nonce = attrPairs.get("r");
      if (!nonce) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
      } else if (!isPrintableChars(nonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
      }
      const salt = attrPairs.get("s");
      if (!salt) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
      } else if (!isBase64(salt)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
      }
      const iterationText = attrPairs.get("i");
      if (!iterationText) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
      } else if (!/^[1-9][0-9]*$/.test(iterationText)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
      }
      const iteration = parseInt(iterationText, 10);
      return {
        nonce,
        salt,
        iteration
      };
    }
    function parseServerFinalMessage(serverData) {
      const attrPairs = parseAttributePairs(serverData);
      const error = attrPairs.get("e");
      const serverSignature = attrPairs.get("v");
      if (error) {
        throw new Error(`SASL: SCRAM-SERVER-FINAL-MESSAGE: server returned error: "${error}"`);
      }
      if (!serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
      } else if (!isBase64(serverSignature)) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
      }
      return {
        serverSignature
      };
    }
    function xorBuffers(a, b) {
      if (!Buffer.isBuffer(a)) {
        throw new TypeError("first argument must be a Buffer");
      }
      if (!Buffer.isBuffer(b)) {
        throw new TypeError("second argument must be a Buffer");
      }
      if (a.length !== b.length) {
        throw new Error("Buffer lengths must match");
      }
      if (a.length === 0) {
        throw new Error("Buffers cannot be empty");
      }
      return Buffer.from(a.map((_, i) => a[i] ^ b[i]));
    }
    module2.exports = {
      startSession,
      continueSession,
      finalizeSession,
      DEFAULT_MAX_SCRAM_ITERATIONS
    };
  }
});

// node_modules/pg/lib/type-overrides.js
var require_type_overrides = __commonJS({
  "node_modules/pg/lib/type-overrides.js"(exports2, module2) {
    "use strict";
    var types2 = require_pg_types();
    function TypeOverrides2(userTypes) {
      this._types = userTypes || types2;
      this.text = {};
      this.binary = {};
    }
    TypeOverrides2.prototype.getOverrides = function(format) {
      switch (format) {
        case "text":
          return this.text;
        case "binary":
          return this.binary;
        default:
          return {};
      }
    };
    TypeOverrides2.prototype.setTypeParser = function(oid, format, parseFn) {
      if (typeof format === "function") {
        parseFn = format;
        format = "text";
      }
      this.getOverrides(format)[oid] = parseFn;
    };
    TypeOverrides2.prototype.getTypeParser = function(oid, format) {
      format = format || "text";
      return this.getOverrides(format)[oid] || this._types.getTypeParser(oid, format);
    };
    module2.exports = TypeOverrides2;
  }
});

// node_modules/pg-connection-string/index.js
var require_pg_connection_string = __commonJS({
  "node_modules/pg-connection-string/index.js"(exports2, module2) {
    "use strict";
    function parse(str, options = {}) {
      if (str.charAt(0) === "/") {
        const config2 = str.split(" ");
        return { host: config2[0], database: config2[1] };
      }
      const config = /* @__PURE__ */ Object.create(null);
      let result;
      let dummyHost = false;
      if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(str)) {
        str = encodeURI(str).replace(/%25(\d\d)/g, "%$1");
      }
      try {
        try {
          result = new URL(str, "postgres://base");
        } catch (e) {
          result = new URL(str.replace("@/", "@___DUMMY___/"), "postgres://base");
          dummyHost = true;
        }
      } catch (err) {
        err.input && (err.input = "*****REDACTED*****");
        throw err;
      }
      for (const entry of result.searchParams.entries()) {
        config[entry[0]] = entry[1];
      }
      config.user = config.user || decodeURIComponent(result.username);
      config.password = config.password || decodeURIComponent(result.password);
      if (result.protocol == "socket:") {
        config.host = decodeURI(result.pathname);
        config.database = result.searchParams.get("db");
        config.client_encoding = result.searchParams.get("encoding");
        return config;
      }
      const hostname = dummyHost ? "" : result.hostname;
      if (!config.host) {
        config.host = decodeURIComponent(hostname);
      } else if (hostname && /^%2f/i.test(hostname)) {
        result.pathname = hostname + result.pathname;
      }
      if (!config.port) {
        config.port = result.port;
      }
      const pathname = result.pathname.slice(1) || null;
      config.database = pathname ? decodeURI(pathname) : null;
      if (config.ssl === "true" || config.ssl === "1") {
        config.ssl = true;
      }
      if (config.ssl === "0") {
        config.ssl = false;
      }
      if (config.sslcert || config.sslkey || config.sslrootcert || config.sslmode) {
        config.ssl = {};
      }
      if (config.sslnegotiation === "direct" && config.ssl === void 0) {
        config.ssl = true;
      }
      const fs2 = config.sslcert || config.sslkey || config.sslrootcert ? require("fs") : null;
      if (config.sslcert) {
        config.ssl.cert = fs2.readFileSync(config.sslcert).toString();
      }
      if (config.sslkey) {
        config.ssl.key = fs2.readFileSync(config.sslkey).toString();
      }
      if (config.sslrootcert) {
        config.ssl.ca = fs2.readFileSync(config.sslrootcert).toString();
      }
      if (options.useLibpqCompat && config.uselibpqcompat) {
        throw new Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");
      }
      if (config.uselibpqcompat === "true" || options.useLibpqCompat) {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
          case "require": {
            if (config.sslrootcert) {
              config.ssl.checkServerIdentity = function() {
              };
            } else {
              config.ssl.rejectUnauthorized = false;
            }
            break;
          }
          case "verify-ca": {
            if (!config.ssl.ca) {
              throw new Error(
                "SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security."
              );
            }
            config.ssl.checkServerIdentity = function() {
            };
            break;
          }
          case "verify-full": {
            break;
          }
        }
      } else {
        switch (config.sslmode) {
          case "disable": {
            config.ssl = false;
            break;
          }
          case "prefer":
          case "require":
          case "verify-ca":
          case "verify-full": {
            if (config.sslmode !== "verify-full") {
              deprecatedSslModeWarning(config.sslmode);
            }
            break;
          }
          case "no-verify": {
            config.ssl.rejectUnauthorized = false;
            break;
          }
        }
      }
      return config;
    }
    function toConnectionOptions(sslConfig) {
      const connectionOptions = Object.entries(sslConfig).reduce((c, [key, value]) => {
        if (value !== void 0 && value !== null) {
          c[key] = value;
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return connectionOptions;
    }
    function toClientConfig(config) {
      const poolConfig = Object.entries(config).reduce((c, [key, value]) => {
        if (key === "ssl") {
          const sslConfig = value;
          if (typeof sslConfig === "boolean") {
            c[key] = sslConfig;
          }
          if (typeof sslConfig === "object") {
            c[key] = toConnectionOptions(sslConfig);
          }
        } else if (value !== void 0 && value !== null) {
          if (key === "port") {
            if (value !== "") {
              const v = parseInt(value, 10);
              if (isNaN(v)) {
                throw new Error(`Invalid ${key}: ${value}`);
              }
              c[key] = v;
            }
          } else {
            c[key] = value;
          }
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return poolConfig;
    }
    function parseIntoClientConfig(str) {
      return toClientConfig(parse(str));
    }
    function deprecatedSslModeWarning(sslmode) {
      if (!deprecatedSslModeWarning.warned && typeof process !== "undefined" && process.emitWarning) {
        deprecatedSslModeWarning.warned = true;
        process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${sslmode}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`);
      }
    }
    module2.exports = parse;
    parse.parse = parse;
    parse.toClientConfig = toClientConfig;
    parse.parseIntoClientConfig = parseIntoClientConfig;
  }
});

// node_modules/pg/lib/connection-parameters.js
var require_connection_parameters = __commonJS({
  "node_modules/pg/lib/connection-parameters.js"(exports2, module2) {
    "use strict";
    var dns = require("dns");
    var defaults2 = require_defaults();
    var parse = require_pg_connection_string().parse;
    var val = function(key, config, envVar) {
      if (config[key]) {
        return config[key];
      }
      if (envVar === void 0) {
        envVar = process.env["PG" + key.toUpperCase()];
      } else if (envVar === false) {
      } else {
        envVar = process.env[envVar];
      }
      return envVar || defaults2[key];
    };
    var readSSLConfigFromEnvironment = function() {
      switch (process.env.PGSSLMODE) {
        case "disable":
          return false;
        case "prefer":
        case "require":
        case "verify-ca":
        case "verify-full":
          return true;
        case "no-verify":
          return { rejectUnauthorized: false };
      }
      return defaults2.ssl;
    };
    var quoteParamValue = function(value) {
      return "'" + ("" + value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
    };
    var add = function(params, config, paramName) {
      const value = config[paramName];
      if (value !== void 0 && value !== null) {
        params.push(paramName + "=" + quoteParamValue(value));
      }
    };
    var ConnectionParameters = class {
      constructor(config) {
        config = typeof config === "string" ? parse(config) : config || {};
        if (config.connectionString) {
          config = Object.assign({}, config, parse(config.connectionString));
        }
        this.user = val("user", config);
        this.database = val("database", config);
        if (this.database === void 0) {
          this.database = this.user;
        }
        this.port = parseInt(val("port", config), 10);
        this.host = val("host", config);
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: val("password", config)
        });
        this.binary = val("binary", config);
        this.options = val("options", config);
        this.ssl = typeof config.ssl === "undefined" ? readSSLConfigFromEnvironment() : config.ssl;
        if (typeof this.ssl === "string") {
          if (this.ssl === "true") {
            this.ssl = true;
          }
        }
        if (this.ssl === "no-verify") {
          this.ssl = { rejectUnauthorized: false };
        }
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this.sslnegotiation = val("sslnegotiation", config, "PGSSLNEGOTIATION");
        if (this.sslnegotiation !== void 0 && this.sslnegotiation !== "postgres" && this.sslnegotiation !== "direct") {
          throw new Error(
            `Invalid sslnegotiation value: "${this.sslnegotiation}". Valid values are "postgres" and "direct".`
          );
        }
        if (this.sslnegotiation === "direct" && !this.ssl) {
          throw new Error("sslnegotiation=direct requires SSL to be enabled");
        }
        this.client_encoding = val("client_encoding", config);
        this.replication = val("replication", config);
        this.isDomainSocket = !(this.host || "").indexOf("/");
        this.application_name = val("application_name", config, "PGAPPNAME");
        this.fallback_application_name = val("fallback_application_name", config, false);
        this.statement_timeout = val("statement_timeout", config, false);
        this.lock_timeout = val("lock_timeout", config, false);
        this.idle_in_transaction_session_timeout = val("idle_in_transaction_session_timeout", config, false);
        this.query_timeout = val("query_timeout", config, false);
        if (config.connectionTimeoutMillis === void 0) {
          this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0;
        } else {
          this.connect_timeout = Math.floor(config.connectionTimeoutMillis / 1e3);
        }
        if (config.keepAlive === false) {
          this.keepalives = 0;
        } else if (config.keepAlive === true) {
          this.keepalives = 1;
        }
        if (typeof config.keepAliveInitialDelayMillis === "number") {
          this.keepalives_idle = Math.floor(config.keepAliveInitialDelayMillis / 1e3);
        }
      }
      getLibpqConnectionString(cb) {
        const params = [];
        add(params, this, "user");
        add(params, this, "password");
        add(params, this, "port");
        add(params, this, "application_name");
        add(params, this, "fallback_application_name");
        add(params, this, "connect_timeout");
        add(params, this, "options");
        const ssl = typeof this.ssl === "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
        add(params, ssl, "sslmode");
        add(params, ssl, "sslca");
        add(params, ssl, "sslkey");
        add(params, ssl, "sslcert");
        add(params, ssl, "sslrootcert");
        add(params, this, "sslnegotiation");
        if (this.database) {
          params.push("dbname=" + quoteParamValue(this.database));
        }
        if (this.replication) {
          params.push("replication=" + quoteParamValue(this.replication));
        }
        if (this.host) {
          params.push("host=" + quoteParamValue(this.host));
        }
        if (this.isDomainSocket) {
          return cb(null, params.join(" "));
        }
        if (this.client_encoding) {
          params.push("client_encoding=" + quoteParamValue(this.client_encoding));
        }
        dns.lookup(this.host, function(err, address) {
          if (err) return cb(err, null);
          params.push("hostaddr=" + quoteParamValue(address));
          return cb(null, params.join(" "));
        });
      }
    };
    module2.exports = ConnectionParameters;
  }
});

// node_modules/pg/lib/result.js
var require_result = __commonJS({
  "node_modules/pg/lib/result.js"(exports2, module2) {
    "use strict";
    var types2 = require_pg_types();
    var matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
    var Result2 = class {
      constructor(rowMode, types3) {
        this.command = null;
        this.rowCount = null;
        this.oid = null;
        this.rows = [];
        this.fields = [];
        this._parsers = void 0;
        this._types = types3;
        this.RowCtor = null;
        this.rowAsArray = rowMode === "array";
        if (this.rowAsArray) {
          this.parseRow = this._parseRowAsArray;
        }
        this._prebuiltEmptyResultObject = null;
      }
      // adds a command complete message
      addCommandComplete(msg) {
        let match;
        if (msg.text) {
          match = matchRegexp.exec(msg.text);
        } else {
          match = matchRegexp.exec(msg.command);
        }
        if (match) {
          this.command = match[1];
          if (match[3]) {
            this.oid = parseInt(match[2], 10);
            this.rowCount = parseInt(match[3], 10);
          } else if (match[2]) {
            this.rowCount = parseInt(match[2], 10);
          }
        }
      }
      _parseRowAsArray(rowData) {
        const row = new Array(rowData.length);
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          if (rawValue !== null) {
            row[i] = this._parsers[i](rawValue);
          } else {
            row[i] = null;
          }
        }
        return row;
      }
      parseRow(rowData) {
        const row = { ...this._prebuiltEmptyResultObject };
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          const field = this.fields[i].name;
          if (rawValue !== null) {
            const v = this.fields[i].format === "binary" ? Buffer.from(rawValue) : rawValue;
            row[field] = this._parsers[i](v);
          } else {
            row[field] = null;
          }
        }
        return row;
      }
      addRow(row) {
        this.rows.push(row);
      }
      addFields(fieldDescriptions) {
        this.fields = fieldDescriptions;
        if (this.fields.length) {
          this._parsers = new Array(fieldDescriptions.length);
        }
        const row = /* @__PURE__ */ Object.create(null);
        for (let i = 0; i < fieldDescriptions.length; i++) {
          const desc = fieldDescriptions[i];
          row[desc.name] = null;
          if (this._types) {
            this._parsers[i] = this._types.getTypeParser(desc.dataTypeID, desc.format || "text");
          } else {
            this._parsers[i] = types2.getTypeParser(desc.dataTypeID, desc.format || "text");
          }
        }
        this._prebuiltEmptyResultObject = { ...row };
      }
    };
    module2.exports = Result2;
  }
});

// node_modules/pg/lib/query.js
var require_query = __commonJS({
  "node_modules/pg/lib/query.js"(exports2, module2) {
    "use strict";
    var { EventEmitter } = require("events");
    var Result2 = require_result();
    var utils = require_utils();
    var Query2 = class extends EventEmitter {
      constructor(config, values, callback) {
        super();
        config = utils.normalizeQueryConfig(config, values, callback);
        this.text = config.text;
        this.values = config.values;
        this.rows = config.rows;
        this.types = config.types;
        this.name = config.name;
        this.queryMode = config.queryMode;
        this.binary = config.binary;
        this.portal = config.portal || "";
        this.callback = config.callback;
        this._rowMode = config.rowMode;
        if (process.domain && config.callback) {
          this.callback = process.domain.bind(config.callback);
        }
        this._result = new Result2(this._rowMode, this.types);
        this._results = this._result;
        this._canceledDueToError = false;
      }
      requiresPreparation() {
        if (this.queryMode === "extended") {
          return true;
        }
        if (this.name) {
          return true;
        }
        if (this.rows) {
          return true;
        }
        if (!this.text) {
          return false;
        }
        if (!this.values) {
          return false;
        }
        return this.values.length > 0;
      }
      _checkForMultirow() {
        if (this._result.command) {
          if (!Array.isArray(this._results)) {
            this._results = [this._result];
          }
          this._result = new Result2(this._rowMode, this._result._types);
          this._results.push(this._result);
        }
      }
      // associates row metadata from the supplied
      // message with this query object
      // metadata used when parsing row results
      handleRowDescription(msg) {
        this._checkForMultirow();
        this._result.addFields(msg.fields);
        this._accumulateRows = this.callback || !this.listeners("row").length;
      }
      handleDataRow(msg) {
        let row;
        if (this._canceledDueToError) {
          return;
        }
        try {
          row = this._result.parseRow(msg.fields);
        } catch (err) {
          this._canceledDueToError = err;
          return;
        }
        this.emit("row", row, this._result);
        if (this._accumulateRows) {
          this._result.addRow(row);
        }
      }
      handleCommandComplete(msg, connection) {
        this._checkForMultirow();
        this._result.addCommandComplete(msg);
        if (this.rows) {
          connection.sync();
        }
      }
      // if a named prepared statement is created with empty query text
      // the backend will send an emptyQuery message but *not* a command complete message
      // since we pipeline sync immediately after execute we don't need to do anything here
      // unless we have rows specified, in which case we did not pipeline the initial sync call
      handleEmptyQuery(connection) {
        if (this.rows) {
          connection.sync();
        }
      }
      handleError(err, connection) {
        if (this._canceledDueToError) {
          err = this._canceledDueToError;
          this._canceledDueToError = false;
        }
        if (this.callback) {
          return this.callback(err);
        }
        this.emit("error", err);
      }
      handleReadyForQuery(con) {
        if (this._canceledDueToError) {
          return this.handleError(this._canceledDueToError, con);
        }
        if (this.callback) {
          try {
            this.callback(null, this._results);
          } catch (err) {
            process.nextTick(() => {
              throw err;
            });
          }
        }
        this.emit("end", this._results);
      }
      submit(connection) {
        if (typeof this.text !== "string" && typeof this.name !== "string") {
          return new Error("A query must have either text or a name. Supplying neither is unsupported.");
        }
        const previous = connection.parsedStatements[this.name] || connection.submittedNamedStatements[this.name];
        if (this.text && previous && this.text !== previous) {
          return new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
        }
        if (this.values && !Array.isArray(this.values)) {
          return new Error("Query values must be an array");
        }
        if (this.requiresPreparation()) {
          connection.stream.cork && connection.stream.cork();
          try {
            this.prepare(connection);
          } finally {
            connection.stream.uncork && connection.stream.uncork();
          }
        } else {
          connection.query(this.text);
        }
        return null;
      }
      hasBeenParsed(connection) {
        return this.name && (connection.parsedStatements[this.name] || connection.submittedNamedStatements[this.name]);
      }
      handlePortalSuspended(connection) {
        this._getRows(connection, this.rows);
      }
      _getRows(connection, rows) {
        connection.execute({
          portal: this.portal,
          rows
        });
        if (!rows) {
          connection.sync();
        } else {
          connection.flush();
        }
      }
      // http://developer.postgresql.org/pgdocs/postgres/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY
      prepare(connection) {
        if (!this.hasBeenParsed(connection)) {
          connection.parse({
            text: this.text,
            name: this.name,
            types: this.types
          });
          if (this.name) {
            connection.submittedNamedStatements[this.name] = this.text;
          }
        }
        try {
          connection.bind({
            portal: this.portal,
            statement: this.name,
            values: this.values,
            binary: this.binary,
            valueMapper: utils.prepareValue
          });
        } catch (err) {
          connection.close({ type: "S", name: this.name });
          connection.sync();
          this.handleError(err, connection);
          return;
        }
        connection.describe({
          type: "P",
          name: this.portal || ""
        });
        this._getRows(connection, this.rows);
      }
      handleCopyInResponse(connection) {
        connection.sendCopyFail("No source stream defined");
      }
      handleCopyData(msg, connection) {
      }
    };
    module2.exports = Query2;
  }
});

// node_modules/pg-protocol/dist/messages.js
var require_messages = __commonJS({
  "node_modules/pg-protocol/dist/messages.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.NoticeMessage = exports2.DataRowMessage = exports2.CommandCompleteMessage = exports2.ReadyForQueryMessage = exports2.NotificationResponseMessage = exports2.BackendKeyDataMessage = exports2.AuthenticationMD5Password = exports2.ParameterStatusMessage = exports2.ParameterDescriptionMessage = exports2.RowDescriptionMessage = exports2.Field = exports2.CopyResponse = exports2.CopyDataMessage = exports2.DatabaseError = exports2.copyDone = exports2.emptyQuery = exports2.replicationStart = exports2.portalSuspended = exports2.noData = exports2.closeComplete = exports2.bindComplete = exports2.parseComplete = void 0;
    exports2.parseComplete = {
      name: "parseComplete",
      length: 5
    };
    exports2.bindComplete = {
      name: "bindComplete",
      length: 5
    };
    exports2.closeComplete = {
      name: "closeComplete",
      length: 5
    };
    exports2.noData = {
      name: "noData",
      length: 5
    };
    exports2.portalSuspended = {
      name: "portalSuspended",
      length: 5
    };
    exports2.replicationStart = {
      name: "replicationStart",
      length: 4
    };
    exports2.emptyQuery = {
      name: "emptyQuery",
      length: 4
    };
    exports2.copyDone = {
      name: "copyDone",
      length: 4
    };
    var DatabaseError2 = class extends Error {
      constructor(message, length, name) {
        super(message);
        this.length = length;
        this.name = name;
      }
    };
    exports2.DatabaseError = DatabaseError2;
    var CopyDataMessage = class {
      constructor(length, chunk) {
        this.length = length;
        this.chunk = chunk;
        this.name = "copyData";
      }
    };
    exports2.CopyDataMessage = CopyDataMessage;
    var CopyResponse = class {
      constructor(length, name, binary, columnCount) {
        this.length = length;
        this.name = name;
        this.binary = binary;
        this.columnTypes = new Array(columnCount);
      }
    };
    exports2.CopyResponse = CopyResponse;
    var Field = class {
      constructor(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, format) {
        this.name = name;
        this.tableID = tableID;
        this.columnID = columnID;
        this.dataTypeID = dataTypeID;
        this.dataTypeSize = dataTypeSize;
        this.dataTypeModifier = dataTypeModifier;
        this.format = format;
      }
    };
    exports2.Field = Field;
    var RowDescriptionMessage = class {
      constructor(length, fieldCount) {
        this.length = length;
        this.fieldCount = fieldCount;
        this.name = "rowDescription";
        this.fields = new Array(this.fieldCount);
      }
    };
    exports2.RowDescriptionMessage = RowDescriptionMessage;
    var ParameterDescriptionMessage = class {
      constructor(length, parameterCount) {
        this.length = length;
        this.parameterCount = parameterCount;
        this.name = "parameterDescription";
        this.dataTypeIDs = new Array(this.parameterCount);
      }
    };
    exports2.ParameterDescriptionMessage = ParameterDescriptionMessage;
    var ParameterStatusMessage = class {
      constructor(length, parameterName, parameterValue) {
        this.length = length;
        this.parameterName = parameterName;
        this.parameterValue = parameterValue;
        this.name = "parameterStatus";
      }
    };
    exports2.ParameterStatusMessage = ParameterStatusMessage;
    var AuthenticationMD5Password = class {
      constructor(length, salt) {
        this.length = length;
        this.salt = salt;
        this.name = "authenticationMD5Password";
      }
    };
    exports2.AuthenticationMD5Password = AuthenticationMD5Password;
    var BackendKeyDataMessage = class {
      constructor(length, processID, secretKey) {
        this.length = length;
        this.processID = processID;
        this.secretKey = secretKey;
        this.name = "backendKeyData";
      }
    };
    exports2.BackendKeyDataMessage = BackendKeyDataMessage;
    var NotificationResponseMessage = class {
      constructor(length, processId, channel, payload) {
        this.length = length;
        this.processId = processId;
        this.channel = channel;
        this.payload = payload;
        this.name = "notification";
      }
    };
    exports2.NotificationResponseMessage = NotificationResponseMessage;
    var ReadyForQueryMessage = class {
      constructor(length, status) {
        this.length = length;
        this.status = status;
        this.name = "readyForQuery";
      }
    };
    exports2.ReadyForQueryMessage = ReadyForQueryMessage;
    var CommandCompleteMessage = class {
      constructor(length, text) {
        this.length = length;
        this.text = text;
        this.name = "commandComplete";
      }
    };
    exports2.CommandCompleteMessage = CommandCompleteMessage;
    var DataRowMessage = class {
      constructor(length, fields) {
        this.length = length;
        this.fields = fields;
        this.name = "dataRow";
        this.fieldCount = fields.length;
      }
    };
    exports2.DataRowMessage = DataRowMessage;
    var NoticeMessage = class {
      constructor(length, message) {
        this.length = length;
        this.message = message;
        this.name = "notice";
      }
    };
    exports2.NoticeMessage = NoticeMessage;
  }
});

// node_modules/pg-protocol/dist/buffer-writer.js
var require_buffer_writer = __commonJS({
  "node_modules/pg-protocol/dist/buffer-writer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Writer = void 0;
    var Writer = class {
      constructor(size = 256) {
        this.size = size;
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(size);
      }
      ensure(size) {
        const remaining = this.buffer.length - this.offset;
        if (remaining < size) {
          const oldBuffer = this.buffer;
          const newSize = oldBuffer.length + (oldBuffer.length >> 1) + size;
          this.buffer = Buffer.allocUnsafe(newSize);
          oldBuffer.copy(this.buffer);
        }
      }
      addInt32(num) {
        this.ensure(4);
        this.buffer[this.offset++] = num >>> 24 & 255;
        this.buffer[this.offset++] = num >>> 16 & 255;
        this.buffer[this.offset++] = num >>> 8 & 255;
        this.buffer[this.offset++] = num >>> 0 & 255;
        return this;
      }
      addInt16(num) {
        this.ensure(2);
        this.buffer[this.offset++] = num >>> 8 & 255;
        this.buffer[this.offset++] = num >>> 0 & 255;
        return this;
      }
      addCString(string) {
        if (!string) {
          this.ensure(1);
        } else {
          const len = Buffer.byteLength(string);
          this.ensure(len + 1);
          this.buffer.write(string, this.offset, "utf-8");
          this.offset += len;
        }
        this.buffer[this.offset++] = 0;
        return this;
      }
      addString(string = "") {
        const len = Buffer.byteLength(string);
        this.ensure(len);
        this.buffer.write(string, this.offset);
        this.offset += len;
        return this;
      }
      // Write an Int32 byte-length prefix immediately followed by the string's UTF-8
      // bytes. Postgres' Bind wire format prefixes every parameter with its length,
      // and doing it in one method computes Buffer.byteLength ONCE — the previous
      // `addInt32(Buffer.byteLength(s)).addString(s)` pairing scanned the string
      // three times (byteLength for the prefix, byteLength again inside addString,
      // then the encode), which is costly for large text parameters.
      addInt32PrefixedString(string) {
        const len = Buffer.byteLength(string);
        this.ensure(4 + len);
        const buffer = this.buffer;
        let offset = this.offset;
        buffer[offset++] = len >>> 24 & 255;
        buffer[offset++] = len >>> 16 & 255;
        buffer[offset++] = len >>> 8 & 255;
        buffer[offset++] = len >>> 0 & 255;
        buffer.write(string, offset, "utf-8");
        this.offset = offset + len;
        return this;
      }
      add(otherBuffer) {
        this.ensure(otherBuffer.length);
        otherBuffer.copy(this.buffer, this.offset);
        this.offset += otherBuffer.length;
        return this;
      }
      join(code) {
        if (code) {
          this.buffer[this.headerPosition] = code;
          const length = this.offset - (this.headerPosition + 1);
          this.buffer.writeInt32BE(length, this.headerPosition + 1);
        }
        return this.buffer.slice(code ? 0 : 5, this.offset);
      }
      flush(code) {
        const result = this.join(code);
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(this.size);
        return result;
      }
      clear() {
        this.offset = 5;
        this.headerPosition = 0;
      }
    };
    exports2.Writer = Writer;
  }
});

// node_modules/pg-protocol/dist/serializer.js
var require_serializer = __commonJS({
  "node_modules/pg-protocol/dist/serializer.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.serialize = void 0;
    var buffer_writer_1 = require_buffer_writer();
    var writer = new buffer_writer_1.Writer();
    var startup = (opts) => {
      writer.addInt16(3).addInt16(0);
      for (const key of Object.keys(opts)) {
        writer.addCString(key).addCString(opts[key]);
      }
      writer.addCString("client_encoding").addCString("UTF8");
      const bodyBuffer = writer.addCString("").flush();
      const length = bodyBuffer.length + 4;
      return new buffer_writer_1.Writer().addInt32(length).add(bodyBuffer).flush();
    };
    var requestSsl = () => {
      const response = Buffer.allocUnsafe(8);
      response.writeInt32BE(8, 0);
      response.writeInt32BE(80877103, 4);
      return response;
    };
    var password = (password2) => {
      return writer.addCString(password2).flush(
        112
        /* code.startup */
      );
    };
    var sendSASLInitialResponseMessage = function(mechanism, initialResponse) {
      writer.addCString(mechanism).addInt32PrefixedString(initialResponse);
      return writer.flush(
        112
        /* code.startup */
      );
    };
    var sendSCRAMClientFinalMessage = function(additionalData) {
      return writer.addString(additionalData).flush(
        112
        /* code.startup */
      );
    };
    var query = (text) => {
      return writer.addCString(text).flush(
        81
        /* code.query */
      );
    };
    var emptyArray = [];
    var parse = (query2) => {
      const name = query2.name || "";
      if (name.length > 63) {
        console.error("Warning! Postgres only supports 63 characters for query names.");
        console.error("You supplied %s (%s)", name, name.length);
        console.error("This can cause conflicts and silent errors executing queries");
      }
      const types2 = query2.types || emptyArray;
      const len = types2.length;
      const buffer = writer.addCString(name).addCString(query2.text).addInt16(len);
      for (let i = 0; i < len; i++) {
        buffer.addInt32(types2[i]);
      }
      return writer.flush(
        80
        /* code.parse */
      );
    };
    var paramWriter = new buffer_writer_1.Writer();
    var writeValues = function(values, valueMapper) {
      for (let i = 0; i < values.length; i++) {
        const mappedVal = valueMapper ? valueMapper(values[i], i) : values[i];
        if (mappedVal == null) {
          writer.addInt16(
            0
            /* ParamType.STRING */
          );
          paramWriter.addInt32(-1);
        } else if (mappedVal instanceof Buffer) {
          writer.addInt16(
            1
            /* ParamType.BINARY */
          );
          paramWriter.addInt32(mappedVal.length);
          paramWriter.add(mappedVal);
        } else {
          writer.addInt16(
            0
            /* ParamType.STRING */
          );
          paramWriter.addInt32PrefixedString(mappedVal);
        }
      }
    };
    var bind = (config = {}) => {
      const portal = config.portal || "";
      const statement = config.statement || "";
      const binary = config.binary || false;
      const values = config.values || emptyArray;
      const len = values.length;
      writer.addCString(portal).addCString(statement);
      writer.addInt16(len);
      try {
        writeValues(values, config.valueMapper);
      } catch (err) {
        writer.clear();
        paramWriter.clear();
        throw err;
      }
      writer.addInt16(len);
      writer.add(paramWriter.flush());
      writer.addInt16(1);
      writer.addInt16(
        binary ? 1 : 0
        /* ParamType.STRING */
      );
      return writer.flush(
        66
        /* code.bind */
      );
    };
    var emptyExecute = Buffer.from([69, 0, 0, 0, 9, 0, 0, 0, 0, 0]);
    var execute = (config) => {
      if (!config || !config.portal && !config.rows) {
        return emptyExecute;
      }
      const portal = config.portal || "";
      const rows = config.rows || 0;
      const portalLength = Buffer.byteLength(portal);
      const len = 4 + portalLength + 1 + 4;
      const buff = Buffer.allocUnsafe(1 + len);
      buff[0] = 69;
      buff.writeInt32BE(len, 1);
      buff.write(portal, 5, "utf-8");
      buff[portalLength + 5] = 0;
      buff.writeUInt32BE(rows, buff.length - 4);
      return buff;
    };
    var cancel = (processID, secretKey) => {
      const buffer = Buffer.allocUnsafe(16);
      buffer.writeInt32BE(16, 0);
      buffer.writeInt16BE(1234, 4);
      buffer.writeInt16BE(5678, 6);
      buffer.writeInt32BE(processID, 8);
      buffer.writeInt32BE(secretKey, 12);
      return buffer;
    };
    var cstringMessage = (code, string) => {
      const stringLen = Buffer.byteLength(string);
      const len = 4 + stringLen + 1;
      const buffer = Buffer.allocUnsafe(1 + len);
      buffer[0] = code;
      buffer.writeInt32BE(len, 1);
      buffer.write(string, 5, "utf-8");
      buffer[len] = 0;
      return buffer;
    };
    var emptyDescribePortal = writer.addCString("P").flush(
      68
      /* code.describe */
    );
    var emptyDescribeStatement = writer.addCString("S").flush(
      68
      /* code.describe */
    );
    var describe = (msg) => {
      return msg.name ? cstringMessage(68, `${msg.type}${msg.name || ""}`) : msg.type === "P" ? emptyDescribePortal : emptyDescribeStatement;
    };
    var close = (msg) => {
      const text = `${msg.type}${msg.name || ""}`;
      return cstringMessage(67, text);
    };
    var copyData = (chunk) => {
      return writer.add(chunk).flush(
        100
        /* code.copyFromChunk */
      );
    };
    var copyFail = (message) => {
      return cstringMessage(102, message);
    };
    var codeOnlyBuffer = (code) => Buffer.from([code, 0, 0, 0, 4]);
    var flushBuffer = codeOnlyBuffer(
      72
      /* code.flush */
    );
    var syncBuffer = codeOnlyBuffer(
      83
      /* code.sync */
    );
    var endBuffer = codeOnlyBuffer(
      88
      /* code.end */
    );
    var copyDoneBuffer = codeOnlyBuffer(
      99
      /* code.copyDone */
    );
    var serialize = {
      startup,
      password,
      requestSsl,
      sendSASLInitialResponseMessage,
      sendSCRAMClientFinalMessage,
      query,
      parse,
      bind,
      execute,
      describe,
      close,
      flush: () => flushBuffer,
      sync: () => syncBuffer,
      end: () => endBuffer,
      copyData,
      copyDone: () => copyDoneBuffer,
      copyFail,
      cancel
    };
    exports2.serialize = serialize;
  }
});

// node_modules/pg-protocol/dist/buffer-reader.js
var require_buffer_reader = __commonJS({
  "node_modules/pg-protocol/dist/buffer-reader.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.BufferReader = void 0;
    var BufferReader = class {
      constructor(offset = 0) {
        this.offset = offset;
        this.buffer = Buffer.allocUnsafe(0);
        this.encoding = "utf-8";
      }
      setBuffer(offset, buffer) {
        this.offset = offset;
        this.buffer = buffer;
      }
      int16() {
        const result = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return result;
      }
      byte() {
        const result = this.buffer[this.offset];
        this.offset++;
        return result;
      }
      int32() {
        const result = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      uint32() {
        const result = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      string(length) {
        const result = this.buffer.toString(this.encoding, this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
      cstring() {
        const start = this.offset;
        let end = start;
        while (this.buffer[end++]) {
        }
        this.offset = end;
        return this.buffer.toString(this.encoding, start, end - 1);
      }
      bytes(length) {
        const result = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
    };
    exports2.BufferReader = BufferReader;
  }
});

// node_modules/pg-protocol/dist/parser.js
var require_parser = __commonJS({
  "node_modules/pg-protocol/dist/parser.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Parser = void 0;
    var messages_1 = require_messages();
    var buffer_reader_1 = require_buffer_reader();
    var CODE_LENGTH = 1;
    var LEN_LENGTH = 4;
    var HEADER_LENGTH = CODE_LENGTH + LEN_LENGTH;
    var LATEINIT_LENGTH = -1;
    var emptyBuffer = Buffer.allocUnsafe(0);
    var Parser = class {
      constructor(opts) {
        this.buffer = emptyBuffer;
        this.bufferLength = 0;
        this.bufferOffset = 0;
        this.reader = new buffer_reader_1.BufferReader();
        if ((opts === null || opts === void 0 ? void 0 : opts.mode) === "binary") {
          throw new Error("Binary mode not supported yet");
        }
        this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || "text";
      }
      parse(buffer, callback) {
        this.mergeBuffer(buffer);
        const bufferFullLength = this.bufferOffset + this.bufferLength;
        let offset = this.bufferOffset;
        while (offset + HEADER_LENGTH <= bufferFullLength) {
          const code = this.buffer[offset];
          const length = this.buffer.readUInt32BE(offset + CODE_LENGTH);
          const fullMessageLength = CODE_LENGTH + length;
          if (fullMessageLength + offset <= bufferFullLength) {
            const message = this.handlePacket(offset + HEADER_LENGTH, code, length, this.buffer);
            callback(message);
            offset += fullMessageLength;
          } else {
            break;
          }
        }
        if (offset === bufferFullLength) {
          this.buffer = emptyBuffer;
          this.bufferLength = 0;
          this.bufferOffset = 0;
        } else {
          this.bufferLength = bufferFullLength - offset;
          this.bufferOffset = offset;
        }
      }
      mergeBuffer(buffer) {
        if (this.bufferLength > 0) {
          const newLength = this.bufferLength + buffer.byteLength;
          const newFullLength = newLength + this.bufferOffset;
          if (newFullLength > this.buffer.byteLength) {
            let newBuffer;
            if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) {
              newBuffer = this.buffer;
            } else {
              let newBufferLength = this.buffer.byteLength * 2;
              while (newLength >= newBufferLength) {
                newBufferLength *= 2;
              }
              newBuffer = Buffer.allocUnsafe(newBufferLength);
            }
            this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
            this.buffer = newBuffer;
            this.bufferOffset = 0;
          }
          buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
          this.bufferLength = newLength;
        } else {
          this.buffer = buffer;
          this.bufferOffset = 0;
          this.bufferLength = buffer.byteLength;
        }
      }
      handlePacket(offset, code, length, bytes) {
        const { reader } = this;
        reader.setBuffer(offset, bytes);
        let message;
        switch (code) {
          case 50:
            message = messages_1.bindComplete;
            break;
          case 49:
            message = messages_1.parseComplete;
            break;
          case 51:
            message = messages_1.closeComplete;
            break;
          case 110:
            message = messages_1.noData;
            break;
          case 115:
            message = messages_1.portalSuspended;
            break;
          case 99:
            message = messages_1.copyDone;
            break;
          case 87:
            message = messages_1.replicationStart;
            break;
          case 73:
            message = messages_1.emptyQuery;
            break;
          case 68:
            message = parseDataRowMessage(reader);
            break;
          case 67:
            message = parseCommandCompleteMessage(reader);
            break;
          case 90:
            message = parseReadyForQueryMessage(reader);
            break;
          case 65:
            message = parseNotificationMessage(reader);
            break;
          case 82:
            message = parseAuthenticationResponse(reader, length);
            break;
          case 83:
            message = parseParameterStatusMessage(reader);
            break;
          case 75:
            message = parseBackendKeyData(reader);
            break;
          case 69:
            message = parseErrorMessage(reader, "error");
            break;
          case 78:
            message = parseErrorMessage(reader, "notice");
            break;
          case 84:
            message = parseRowDescriptionMessage(reader);
            break;
          case 116:
            message = parseParameterDescriptionMessage(reader);
            break;
          case 71:
            message = parseCopyInMessage(reader);
            break;
          case 72:
            message = parseCopyOutMessage(reader);
            break;
          case 100:
            message = parseCopyData(reader, length);
            break;
          default:
            return new messages_1.DatabaseError("received invalid response: " + code.toString(16), length, "error");
        }
        reader.setBuffer(0, emptyBuffer);
        message.length = length;
        return message;
      }
    };
    exports2.Parser = Parser;
    var parseReadyForQueryMessage = (reader) => {
      const status = reader.string(1);
      return new messages_1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
    };
    var parseCommandCompleteMessage = (reader) => {
      const text = reader.cstring();
      return new messages_1.CommandCompleteMessage(LATEINIT_LENGTH, text);
    };
    var parseCopyData = (reader, length) => {
      const chunk = reader.bytes(length - 4);
      return new messages_1.CopyDataMessage(LATEINIT_LENGTH, chunk);
    };
    var parseCopyInMessage = (reader) => parseCopyMessage(reader, "copyInResponse");
    var parseCopyOutMessage = (reader) => parseCopyMessage(reader, "copyOutResponse");
    var parseCopyMessage = (reader, messageName) => {
      const isBinary = reader.byte() !== 0;
      const columnCount = reader.int16();
      const message = new messages_1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
      for (let i = 0; i < columnCount; i++) {
        message.columnTypes[i] = reader.int16();
      }
      return message;
    };
    var parseNotificationMessage = (reader) => {
      const processId = reader.int32();
      const channel = reader.cstring();
      const payload = reader.cstring();
      return new messages_1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
    };
    var parseRowDescriptionMessage = (reader) => {
      const fieldCount = reader.int16();
      const message = new messages_1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        message.fields[i] = parseField(reader);
      }
      return message;
    };
    var parseField = (reader) => {
      const name = reader.cstring();
      const tableID = reader.uint32();
      const columnID = reader.int16();
      const dataTypeID = reader.uint32();
      const dataTypeSize = reader.int16();
      const dataTypeModifier = reader.int32();
      const mode = reader.int16() === 0 ? "text" : "binary";
      return new messages_1.Field(name, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
    };
    var parseParameterDescriptionMessage = (reader) => {
      const parameterCount = reader.int16();
      const message = new messages_1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
      for (let i = 0; i < parameterCount; i++) {
        message.dataTypeIDs[i] = reader.uint32();
      }
      return message;
    };
    var parseDataRowMessage = (reader) => {
      const fieldCount = reader.int16();
      const fields = new Array(fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        const len = reader.int32();
        fields[i] = len === -1 ? null : reader.string(len);
      }
      return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
    };
    var parseParameterStatusMessage = (reader) => {
      const name = reader.cstring();
      const value = reader.cstring();
      return new messages_1.ParameterStatusMessage(LATEINIT_LENGTH, name, value);
    };
    var parseBackendKeyData = (reader) => {
      const processID = reader.int32();
      const secretKey = reader.int32();
      return new messages_1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
    };
    var parseAuthenticationResponse = (reader, length) => {
      const code = reader.int32();
      const message = {
        name: "authenticationOk",
        length
      };
      switch (code) {
        case 0:
          break;
        case 3:
          if (message.length === 8) {
            message.name = "authenticationCleartextPassword";
          }
          break;
        case 5:
          if (message.length === 12) {
            message.name = "authenticationMD5Password";
            const salt = reader.bytes(4);
            return new messages_1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
          }
          break;
        case 10:
          {
            message.name = "authenticationSASL";
            message.mechanisms = [];
            let mechanism;
            do {
              mechanism = reader.cstring();
              if (mechanism) {
                message.mechanisms.push(mechanism);
              }
            } while (mechanism);
          }
          break;
        case 11:
          message.name = "authenticationSASLContinue";
          message.data = reader.string(length - 8);
          break;
        case 12:
          message.name = "authenticationSASLFinal";
          message.data = reader.string(length - 8);
          break;
        default:
          throw new Error("Unknown authenticationOk message type " + code);
      }
      return message;
    };
    var parseErrorMessage = (reader, name) => {
      const fields = {};
      let fieldType = reader.string(1);
      while (fieldType !== "\0") {
        fields[fieldType] = reader.cstring();
        fieldType = reader.string(1);
      }
      const messageValue = fields.M;
      const message = name === "notice" ? new messages_1.NoticeMessage(LATEINIT_LENGTH, messageValue) : new messages_1.DatabaseError(messageValue, LATEINIT_LENGTH, name);
      message.severity = fields.S;
      message.code = fields.C;
      message.detail = fields.D;
      message.hint = fields.H;
      message.position = fields.P;
      message.internalPosition = fields.p;
      message.internalQuery = fields.q;
      message.where = fields.W;
      message.schema = fields.s;
      message.table = fields.t;
      message.column = fields.c;
      message.dataType = fields.d;
      message.constraint = fields.n;
      message.file = fields.F;
      message.line = fields.L;
      message.routine = fields.R;
      return message;
    };
  }
});

// node_modules/pg-protocol/dist/index.js
var require_dist = __commonJS({
  "node_modules/pg-protocol/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DatabaseError = exports2.serialize = void 0;
    exports2.parse = parse;
    var messages_1 = require_messages();
    Object.defineProperty(exports2, "DatabaseError", { enumerable: true, get: function() {
      return messages_1.DatabaseError;
    } });
    var serializer_1 = require_serializer();
    Object.defineProperty(exports2, "serialize", { enumerable: true, get: function() {
      return serializer_1.serialize;
    } });
    var parser_1 = require_parser();
    function parse(stream, callback) {
      const parser = new parser_1.Parser();
      stream.on("data", (buffer) => parser.parse(buffer, callback));
      return new Promise((resolve) => stream.on("end", () => resolve()));
    }
  }
});

// node_modules/pg-cloudflare/dist/empty.js
var require_empty = __commonJS({
  "node_modules/pg-cloudflare/dist/empty.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = {};
  }
});

// node_modules/pg/lib/stream.js
var require_stream = __commonJS({
  "node_modules/pg/lib/stream.js"(exports2, module2) {
    var { getStream, getSecureStream } = getStreamFuncs();
    module2.exports = {
      /**
       * Get a socket stream compatible with the current runtime environment.
       * @returns {Duplex}
       */
      getStream,
      /**
       * Get a TLS secured socket, compatible with the current environment,
       * using the socket and other settings given in `options`.
       * @returns {Duplex}
       */
      getSecureStream
    };
    function getNodejsStreamFuncs() {
      function getStream2(ssl) {
        const net3 = require("net");
        return new net3.Socket();
      }
      function getSecureStream2(options) {
        const tls = require("tls");
        return tls.connect(options);
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function getCloudflareStreamFuncs() {
      function getStream2(ssl) {
        const { CloudflareSocket } = require_empty();
        return new CloudflareSocket(ssl);
      }
      function getSecureStream2(options) {
        options.socket.startTls(options);
        return options.socket;
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function isCloudflareRuntime() {
      if (typeof navigator === "object" && navigator !== null && typeof navigator.userAgent === "string") {
        return navigator.userAgent === "Cloudflare-Workers";
      }
      if (typeof Response === "function") {
        const resp = new Response(null, { cf: { thing: true } });
        if (typeof resp.cf === "object" && resp.cf !== null && resp.cf.thing) {
          return true;
        }
      }
      return false;
    }
    function getStreamFuncs() {
      if (isCloudflareRuntime()) {
        return getCloudflareStreamFuncs();
      }
      return getNodejsStreamFuncs();
    }
  }
});

// node_modules/pg/lib/connection.js
var require_connection = __commonJS({
  "node_modules/pg/lib/connection.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events").EventEmitter;
    var { parse, serialize } = require_dist();
    var stream = require_stream();
    var { getStream } = stream;
    var flushBuffer = serialize.flush();
    var syncBuffer = serialize.sync();
    var endBuffer = serialize.end();
    var Connection2 = class extends EventEmitter {
      constructor(config) {
        super();
        config = config || {};
        this.stream = config.stream || getStream(config.ssl);
        if (typeof this.stream === "function") {
          this.stream = this.stream(config);
        }
        this._keepAlive = config.keepAlive;
        this._keepAliveInitialDelayMillis = config.keepAliveInitialDelayMillis;
        this.parsedStatements = {};
        this.submittedNamedStatements = {};
        this.ssl = config.ssl || false;
        this.sslNegotiation = config.sslNegotiation || "postgres";
        this._ending = false;
        this._emitMessage = false;
        const self = this;
        this.on("newListener", function(eventName) {
          if (eventName === "message") {
            self._emitMessage = true;
          }
        });
      }
      connect(port, host2) {
        const self = this;
        this._connecting = true;
        this.stream.setNoDelay(true);
        this.stream.connect(port, host2);
        this.stream.once("connect", function() {
          if (self._keepAlive) {
            self.stream.setKeepAlive(true, self._keepAliveInitialDelayMillis);
          }
          self.emit("connect");
        });
        const reportStreamError = function(error) {
          if (self._ending && (error.code === "ECONNRESET" || error.code === "EPIPE")) {
            return;
          }
          self.emit("error", error);
        };
        this.stream.on("error", reportStreamError);
        this.stream.on("close", function() {
          self.emit("end");
        });
        if (!this.ssl) {
          return this.attachListeners(this.stream);
        }
        if (this.sslNegotiation === "direct") {
          return this.stream.once("connect", function() {
            self.upgradeToSSL(host2, reportStreamError);
          });
        }
        this.stream.once("data", function(buffer) {
          const responseCode = buffer.toString("utf8");
          switch (responseCode) {
            case "S":
              break;
            case "N":
              self.stream.end();
              return self.emit("error", new Error("The server does not support SSL connections"));
            default:
              self.stream.end();
              return self.emit("error", new Error("There was an error establishing an SSL connection"));
          }
          self.upgradeToSSL(host2, reportStreamError);
        });
      }
      upgradeToSSL(host2, reportStreamError) {
        const self = this;
        const options = {
          socket: self.stream
        };
        if (self.ssl !== true) {
          Object.assign(options, self.ssl);
          if ("key" in self.ssl) {
            options.key = self.ssl.key;
          }
        }
        if (self.sslNegotiation === "direct") {
          options.ALPNProtocols = ["postgresql"];
        }
        const net3 = require("net");
        if (net3.isIP && net3.isIP(host2) === 0) {
          options.servername = host2;
        }
        try {
          self.stream = stream.getSecureStream(options);
        } catch (err) {
          return self.emit("error", err);
        }
        self.attachListeners(self.stream);
        self.stream.on("error", reportStreamError);
        self.emit("sslconnect");
      }
      attachListeners(stream2) {
        parse(stream2, (msg) => {
          const eventName = msg.name === "error" ? "errorMessage" : msg.name;
          if (this._emitMessage) {
            this.emit("message", msg);
          }
          this.emit(eventName, msg);
        });
      }
      requestSsl() {
        this.stream.write(serialize.requestSsl());
      }
      startup(config) {
        this.stream.write(serialize.startup(config));
      }
      cancel(processID, secretKey) {
        this._send(serialize.cancel(processID, secretKey));
      }
      password(password) {
        this._send(serialize.password(password));
      }
      sendSASLInitialResponseMessage(mechanism, initialResponse) {
        this._send(serialize.sendSASLInitialResponseMessage(mechanism, initialResponse));
      }
      sendSCRAMClientFinalMessage(additionalData) {
        this._send(serialize.sendSCRAMClientFinalMessage(additionalData));
      }
      _send(buffer) {
        if (!this.stream.writable) {
          return false;
        }
        return this.stream.write(buffer);
      }
      query(text) {
        this._send(serialize.query(text));
      }
      // send parse message
      parse(query) {
        this._send(serialize.parse(query));
      }
      // send bind message
      bind(config) {
        this._send(serialize.bind(config));
      }
      // send execute message
      execute(config) {
        this._send(serialize.execute(config));
      }
      flush() {
        if (this.stream.writable) {
          this.stream.write(flushBuffer);
        }
      }
      sync() {
        this._ending = true;
        this._send(syncBuffer);
      }
      ref() {
        this.stream.ref();
      }
      unref() {
        this.stream.unref();
      }
      end() {
        this._ending = true;
        if (!this._connecting || !this.stream.writable) {
          this.stream.end();
          return;
        }
        return this.stream.write(endBuffer, () => {
          this.stream.end();
        });
      }
      close(msg) {
        this._send(serialize.close(msg));
      }
      describe(msg) {
        this._send(serialize.describe(msg));
      }
      sendCopyFromChunk(chunk) {
        this._send(serialize.copyData(chunk));
      }
      endCopyFrom() {
        this._send(serialize.copyDone());
      }
      sendCopyFail(msg) {
        this._send(serialize.copyFail(msg));
      }
    };
    module2.exports = Connection2;
  }
});

// node_modules/split2/index.js
var require_split2 = __commonJS({
  "node_modules/split2/index.js"(exports2, module2) {
    "use strict";
    var { Transform } = require("stream");
    var { StringDecoder } = require("string_decoder");
    var kLast = Symbol("last");
    var kDecoder = Symbol("decoder");
    function transform(chunk, enc, cb) {
      let list;
      if (this.overflow) {
        const buf = this[kDecoder].write(chunk);
        list = buf.split(this.matcher);
        if (list.length === 1) return cb();
        list.shift();
        this.overflow = false;
      } else {
        this[kLast] += this[kDecoder].write(chunk);
        list = this[kLast].split(this.matcher);
      }
      this[kLast] = list.pop();
      for (let i = 0; i < list.length; i++) {
        try {
          push(this, this.mapper(list[i]));
        } catch (error) {
          return cb(error);
        }
      }
      this.overflow = this[kLast].length > this.maxLength;
      if (this.overflow && !this.skipOverflow) {
        cb(new Error("maximum buffer reached"));
        return;
      }
      cb();
    }
    function flush(cb) {
      this[kLast] += this[kDecoder].end();
      if (this[kLast]) {
        try {
          push(this, this.mapper(this[kLast]));
        } catch (error) {
          return cb(error);
        }
      }
      cb();
    }
    function push(self, val) {
      if (val !== void 0) {
        self.push(val);
      }
    }
    function noop(incoming) {
      return incoming;
    }
    function split(matcher, mapper, options) {
      matcher = matcher || /\r?\n/;
      mapper = mapper || noop;
      options = options || {};
      switch (arguments.length) {
        case 1:
          if (typeof matcher === "function") {
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof matcher === "object" && !(matcher instanceof RegExp) && !matcher[Symbol.split]) {
            options = matcher;
            matcher = /\r?\n/;
          }
          break;
        case 2:
          if (typeof matcher === "function") {
            options = mapper;
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof mapper === "object") {
            options = mapper;
            mapper = noop;
          }
      }
      options = Object.assign({}, options);
      options.autoDestroy = true;
      options.transform = transform;
      options.flush = flush;
      options.readableObjectMode = true;
      const stream = new Transform(options);
      stream[kLast] = "";
      stream[kDecoder] = new StringDecoder("utf8");
      stream.matcher = matcher;
      stream.mapper = mapper;
      stream.maxLength = options.maxLength;
      stream.skipOverflow = options.skipOverflow || false;
      stream.overflow = false;
      stream._destroy = function(err, cb) {
        this._writableState.errorEmitted = false;
        cb(err);
      };
      return stream;
    }
    module2.exports = split;
  }
});

// node_modules/pgpass/lib/helper.js
var require_helper = __commonJS({
  "node_modules/pgpass/lib/helper.js"(exports2, module2) {
    "use strict";
    var path3 = require("path");
    var Stream = require("stream").Stream;
    var split = require_split2();
    var util = require("util");
    var defaultPort = 5432;
    var isWin = process.platform === "win32";
    var warnStream = process.stderr;
    var S_IRWXG = 56;
    var S_IRWXO = 7;
    var S_IFMT = 61440;
    var S_IFREG = 32768;
    function isRegFile(mode) {
      return (mode & S_IFMT) == S_IFREG;
    }
    var fieldNames = ["host", "port", "database", "user", "password"];
    var nrOfFields = fieldNames.length;
    var passKey = fieldNames[nrOfFields - 1];
    function warn() {
      var isWritable = warnStream instanceof Stream && true === warnStream.writable;
      if (isWritable) {
        var args = Array.prototype.slice.call(arguments).concat("\n");
        warnStream.write(util.format.apply(util, args));
      }
    }
    Object.defineProperty(module2.exports, "isWin", {
      get: function() {
        return isWin;
      },
      set: function(val) {
        isWin = val;
      }
    });
    module2.exports.warnTo = function(stream) {
      var old = warnStream;
      warnStream = stream;
      return old;
    };
    module2.exports.getFileName = function(rawEnv) {
      var env = rawEnv || process.env;
      var file = env.PGPASSFILE || (isWin ? path3.join(env.APPDATA || "./", "postgresql", "pgpass.conf") : path3.join(env.HOME || "./", ".pgpass"));
      return file;
    };
    module2.exports.usePgPass = function(stats, fname) {
      if (Object.prototype.hasOwnProperty.call(process.env, "PGPASSWORD")) {
        return false;
      }
      if (isWin) {
        return true;
      }
      fname = fname || "<unkn>";
      if (!isRegFile(stats.mode)) {
        warn('WARNING: password file "%s" is not a plain file', fname);
        return false;
      }
      if (stats.mode & (S_IRWXG | S_IRWXO)) {
        warn('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', fname);
        return false;
      }
      return true;
    };
    var matcher = module2.exports.match = function(connInfo, entry) {
      return fieldNames.slice(0, -1).reduce(function(prev, field, idx) {
        if (idx == 1) {
          if (Number(connInfo[field] || defaultPort) === Number(entry[field])) {
            return prev && true;
          }
        }
        return prev && (entry[field] === "*" || entry[field] === connInfo[field]);
      }, true);
    };
    module2.exports.getPassword = function(connInfo, stream, cb) {
      var pass;
      var lineStream = stream.pipe(split());
      function onLine(line2) {
        var entry = parseLine(line2);
        if (entry && isValidEntry(entry) && matcher(connInfo, entry)) {
          pass = entry[passKey];
          lineStream.end();
        }
      }
      var onEnd = function() {
        stream.destroy();
        cb(pass);
      };
      var onErr = function(err) {
        stream.destroy();
        warn("WARNING: error on reading file: %s", err);
        cb(void 0);
      };
      stream.on("error", onErr);
      lineStream.on("data", onLine).on("end", onEnd).on("error", onErr);
    };
    var parseLine = module2.exports.parseLine = function(line2) {
      if (line2.length < 11 || line2.match(/^\s+#/)) {
        return null;
      }
      var curChar = "";
      var prevChar = "";
      var fieldIdx = 0;
      var startIdx = 0;
      var endIdx = 0;
      var obj = {};
      var isLastField = false;
      var addToObj = function(idx, i0, i1) {
        var field = line2.substring(i0, i1);
        if (!Object.hasOwnProperty.call(process.env, "PGPASS_NO_DEESCAPE")) {
          field = field.replace(/\\([:\\])/g, "$1");
        }
        obj[fieldNames[idx]] = field;
      };
      for (var i = 0; i < line2.length - 1; i += 1) {
        curChar = line2.charAt(i + 1);
        prevChar = line2.charAt(i);
        isLastField = fieldIdx == nrOfFields - 1;
        if (isLastField) {
          addToObj(fieldIdx, startIdx);
          break;
        }
        if (i >= 0 && curChar == ":" && prevChar !== "\\") {
          addToObj(fieldIdx, startIdx, i + 1);
          startIdx = i + 2;
          fieldIdx += 1;
        }
      }
      obj = Object.keys(obj).length === nrOfFields ? obj : null;
      return obj;
    };
    var isValidEntry = module2.exports.isValidEntry = function(entry) {
      var rules = {
        // host
        0: function(x) {
          return x.length > 0;
        },
        // port
        1: function(x) {
          if (x === "*") {
            return true;
          }
          x = Number(x);
          return isFinite(x) && x > 0 && x < 9007199254740992 && Math.floor(x) === x;
        },
        // database
        2: function(x) {
          return x.length > 0;
        },
        // username
        3: function(x) {
          return x.length > 0;
        },
        // password
        4: function(x) {
          return x.length > 0;
        }
      };
      for (var idx = 0; idx < fieldNames.length; idx += 1) {
        var rule = rules[idx];
        var value = entry[fieldNames[idx]] || "";
        var res = rule(value);
        if (!res) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/pgpass/lib/index.js
var require_lib = __commonJS({
  "node_modules/pgpass/lib/index.js"(exports2, module2) {
    "use strict";
    var path3 = require("path");
    var fs2 = require("fs");
    var helper = require_helper();
    module2.exports = function(connInfo, cb) {
      var file = helper.getFileName();
      fs2.stat(file, function(err, stat) {
        if (err || !helper.usePgPass(stat, file)) {
          return cb(void 0);
        }
        var st = fs2.createReadStream(file);
        helper.getPassword(connInfo, st, cb);
      });
    };
    module2.exports.warnTo = helper.warnTo;
  }
});

// node_modules/pg/lib/client.js
var require_client = __commonJS({
  "node_modules/pg/lib/client.js"(exports2, module2) {
    var EventEmitter = require("events").EventEmitter;
    var utils = require_utils();
    var nodeUtils = require("util");
    var sasl = require_sasl();
    var TypeOverrides2 = require_type_overrides();
    var ConnectionParameters = require_connection_parameters();
    var Query2 = require_query();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var crypto2 = require_utils2();
    var activeQueryDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.activeQuery is deprecated and will be removed in pg@9.0"
    );
    var queryQueueDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.queryQueue is deprecated and will be removed in pg@9.0."
    );
    var pgPassDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "pgpass support is deprecated and will be removed in pg@9.0. You can provide an async function as the password property to the Client/Pool constructor that returns a password instead. Within this function you can call the pgpass module in your own code."
    );
    var byoPromiseDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Passing a custom Promise implementation to the Client/Pool constructor is deprecated and will be removed in pg@9.0."
    );
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    function coerceNumberOrDefault(value, defaultValue) {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : defaultValue;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
      }
      return defaultValue;
    }
    var Client2 = class extends EventEmitter {
      constructor(config) {
        super();
        this.connectionParameters = new ConnectionParameters(config);
        this.user = this.connectionParameters.user;
        this.database = this.connectionParameters.database;
        this.port = this.connectionParameters.port;
        this.host = this.connectionParameters.host;
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: this.connectionParameters.password
        });
        this.replication = this.connectionParameters.replication;
        const c = config || {};
        if (c.Promise) {
          byoPromiseDeprecationNotice();
        }
        this._Promise = c.Promise || global.Promise;
        this._types = new TypeOverrides2(c.types);
        this._ending = false;
        this._ended = false;
        this._connecting = false;
        this._connected = false;
        this._connectionError = false;
        this._queryable = true;
        this._activeQuery = null;
        this._txStatus = null;
        this.enableChannelBinding = Boolean(c.enableChannelBinding);
        this.scramMaxIterations = coerceNumberOrDefault(c.scramMaxIterations, sasl.DEFAULT_MAX_SCRAM_ITERATIONS);
        this.connection = c.connection || new Connection2({
          stream: c.stream,
          ssl: this.connectionParameters.ssl,
          sslNegotiation: this.connectionParameters.sslnegotiation,
          keepAlive: c.keepAlive || false,
          keepAliveInitialDelayMillis: c.keepAliveInitialDelayMillis || 0,
          encoding: this.connectionParameters.client_encoding || "utf8"
        });
        this._queryQueue = [];
        this._sentQueryQueue = [];
        this.pipeline = Boolean(c.pipeline);
        this.binary = c.binary || defaults2.binary;
        this.processID = null;
        this.secretKey = null;
        this.ssl = this.connectionParameters.ssl || false;
        this.sslNegotiation = this.connectionParameters.sslnegotiation || "postgres";
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this._connectionTimeoutMillis = c.connectionTimeoutMillis || 0;
      }
      get activeQuery() {
        activeQueryDeprecationNotice();
        return this._activeQuery;
      }
      set activeQuery(val) {
        activeQueryDeprecationNotice();
        this._activeQuery = val;
      }
      _getActiveQuery() {
        return this._activeQuery;
      }
      _errorAllQueries(err) {
        const enqueueError = (query) => {
          process.nextTick(() => {
            query.handleError(err, this.connection);
          });
        };
        const activeQuery = this._getActiveQuery();
        if (activeQuery) {
          enqueueError(activeQuery);
          this._activeQuery = null;
        }
        this._sentQueryQueue.forEach(enqueueError);
        this._sentQueryQueue.length = 0;
        this._queryQueue.forEach(enqueueError);
        this._queryQueue.length = 0;
      }
      _connect(callback) {
        const self = this;
        const con = this.connection;
        this._connectionCallback = callback;
        if (this._connecting || this._connected) {
          const err = new Error("Client has already been connected. You cannot reuse a client.");
          process.nextTick(() => {
            callback(err);
          });
          return;
        }
        this._connecting = true;
        if (this._connectionTimeoutMillis > 0) {
          this.connectionTimeoutHandle = setTimeout(() => {
            con._ending = true;
            con.stream.destroy(new Error("timeout expired"));
          }, this._connectionTimeoutMillis);
          if (this.connectionTimeoutHandle.unref) {
            this.connectionTimeoutHandle.unref();
          }
        }
        if (this.host && this.host.indexOf("/") === 0) {
          con.connect(this.host + "/.s.PGSQL." + this.port);
        } else {
          con.connect(this.port, this.host);
        }
        con.on("connect", function() {
          if (self.ssl) {
            if (self.sslNegotiation !== "direct") {
              con.requestSsl();
            }
          } else {
            con.startup(self.getStartupConf());
          }
        });
        con.on("sslconnect", function() {
          con.startup(self.getStartupConf());
        });
        this._attachListeners(con);
        con.once("end", () => {
          const error = this._ending ? new Error("Connection terminated") : new Error("Connection terminated unexpectedly");
          clearTimeout(this.connectionTimeoutHandle);
          this._errorAllQueries(error);
          this._ended = true;
          if (!this._ending) {
            if (this._connecting && !this._connectionError) {
              if (this._connectionCallback) {
                this._connectionCallback(error);
              } else {
                this._handleErrorEvent(error);
              }
            } else if (!this._connectionError) {
              this._handleErrorEvent(error);
            }
          }
          process.nextTick(() => {
            this.emit("end");
          });
        });
      }
      connect(callback) {
        if (callback) {
          this._connect(callback);
          return;
        }
        return new this._Promise((resolve, reject) => {
          this._connect((error) => {
            if (error) {
              reject(error);
            } else {
              resolve(this);
            }
          });
        });
      }
      _attachListeners(con) {
        con.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this));
        con.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this));
        con.on("authenticationSASL", this._handleAuthSASL.bind(this));
        con.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this));
        con.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this));
        con.on("backendKeyData", this._handleBackendKeyData.bind(this));
        con.on("error", this._handleErrorEvent.bind(this));
        con.on("errorMessage", this._handleErrorMessage.bind(this));
        con.on("readyForQuery", this._handleReadyForQuery.bind(this));
        con.on("notice", this._handleNotice.bind(this));
        con.on("rowDescription", this._handleRowDescription.bind(this));
        con.on("dataRow", this._handleDataRow.bind(this));
        con.on("portalSuspended", this._handlePortalSuspended.bind(this));
        con.on("emptyQuery", this._handleEmptyQuery.bind(this));
        con.on("commandComplete", this._handleCommandComplete.bind(this));
        con.on("parseComplete", this._handleParseComplete.bind(this));
        con.on("copyInResponse", this._handleCopyInResponse.bind(this));
        con.on("copyData", this._handleCopyData.bind(this));
        con.on("notification", this._handleNotification.bind(this));
      }
      _getPassword(cb) {
        const con = this.connection;
        if (typeof this.password === "function") {
          this._Promise.resolve().then(() => this.password(this.connectionParameters)).then((pass) => {
            if (pass !== void 0) {
              if (typeof pass !== "string") {
                con.emit("error", new TypeError("Password must be a string"));
                return;
              }
              this.connectionParameters.password = this.password = pass;
            } else {
              this.connectionParameters.password = this.password = null;
            }
            cb();
          }).catch((err) => {
            con.emit("error", err);
          });
        } else if (this.password !== null) {
          cb();
        } else {
          try {
            const pgPass = require_lib();
            pgPass(this.connectionParameters, (pass) => {
              if (void 0 !== pass) {
                pgPassDeprecationNotice();
                this.connectionParameters.password = this.password = pass;
              }
              cb();
            });
          } catch (e) {
            this.emit("error", e);
          }
        }
      }
      _handleAuthCleartextPassword(msg) {
        this._getPassword(() => {
          this.connection.password(this.password);
        });
      }
      _handleAuthMD5Password(msg) {
        this._getPassword(async () => {
          try {
            const hashedPassword = await crypto2.postgresMd5PasswordHash(this.user, this.password, msg.salt);
            this.connection.password(hashedPassword);
          } catch (e) {
            this.emit("error", e);
          }
        });
      }
      _handleAuthSASL(msg) {
        this._getPassword(() => {
          try {
            this.saslSession = sasl.startSession(
              msg.mechanisms,
              this.enableChannelBinding && this.connection.stream,
              this.scramMaxIterations
            );
            this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response);
          } catch (err) {
            this.connection.emit("error", err);
          }
        });
      }
      async _handleAuthSASLContinue(msg) {
        try {
          await sasl.continueSession(
            this.saslSession,
            this.password,
            msg.data,
            this.enableChannelBinding && this.connection.stream
          );
          this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleAuthSASLFinal(msg) {
        try {
          sasl.finalizeSession(this.saslSession, msg.data);
          this.saslSession = null;
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleBackendKeyData(msg) {
        this.processID = msg.processID;
        this.secretKey = msg.secretKey;
      }
      _handleReadyForQuery(msg) {
        if (this._connecting) {
          this._connecting = false;
          this._connected = true;
          clearTimeout(this.connectionTimeoutHandle);
          if (this._connectionCallback) {
            this._connectionCallback(null, this);
            this._connectionCallback = null;
          }
          this.emit("connect");
        }
        const activeQuery = this._getActiveQuery();
        this._activeQuery = null;
        this._txStatus = msg?.status ?? null;
        this.readyForQuery = true;
        if (activeQuery) {
          activeQuery.handleReadyForQuery(this.connection);
        }
        this._pulseQueryQueue();
      }
      // if we receive an error event or error message
      // during the connection process we handle it here
      _handleErrorWhileConnecting(err) {
        if (this._connectionError) {
          return;
        }
        this._connectionError = true;
        clearTimeout(this.connectionTimeoutHandle);
        if (this._connectionCallback) {
          return this._connectionCallback(err);
        }
        this.emit("error", err);
      }
      // if we're connected and we receive an error event from the connection
      // this means the socket is dead - do a hard abort of all queries and emit
      // the socket error on the client as well
      _handleErrorEvent(err) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(err);
        }
        this._queryable = false;
        this._errorAllQueries(err);
        this.emit("error", err);
      }
      // handle error messages from the postgres backend
      _handleErrorMessage(msg) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(msg);
        }
        const activeQuery = this._getActiveQuery();
        if (!activeQuery) {
          this._handleErrorEvent(msg);
          return;
        }
        this._activeQuery = null;
        if (activeQuery.name) {
          delete this.connection.submittedNamedStatements[activeQuery.name];
        }
        activeQuery.handleError(msg, this.connection);
      }
      _handleRowDescription(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected rowDescription message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleRowDescription(msg);
      }
      _handleDataRow(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected dataRow message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleDataRow(msg);
      }
      _handlePortalSuspended(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected portalSuspended message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handlePortalSuspended(this.connection);
      }
      _handleEmptyQuery(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected emptyQuery message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleEmptyQuery(this.connection);
      }
      _handleCommandComplete(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected commandComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCommandComplete(msg, this.connection);
      }
      _handleParseComplete() {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected parseComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        if (activeQuery.name) {
          this.connection.parsedStatements[activeQuery.name] = activeQuery.text;
          delete this.connection.submittedNamedStatements[activeQuery.name];
        }
      }
      _handleCopyInResponse(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyInResponse message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyInResponse(this.connection);
      }
      _handleCopyData(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyData message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyData(msg, this.connection);
      }
      _handleNotification(msg) {
        this.emit("notification", msg);
      }
      _handleNotice(msg) {
        this.emit("notice", msg);
      }
      getStartupConf() {
        const params = this.connectionParameters;
        const data = {
          user: params.user,
          database: params.database
        };
        const appName = params.application_name || params.fallback_application_name;
        if (appName) {
          data.application_name = appName;
        }
        if (params.replication) {
          data.replication = "" + params.replication;
        }
        if (params.statement_timeout) {
          data.statement_timeout = String(parseInt(params.statement_timeout, 10));
        }
        if (params.lock_timeout) {
          data.lock_timeout = String(parseInt(params.lock_timeout, 10));
        }
        if (params.idle_in_transaction_session_timeout) {
          data.idle_in_transaction_session_timeout = String(parseInt(params.idle_in_transaction_session_timeout, 10));
        }
        if (params.options) {
          data.options = params.options;
        }
        return data;
      }
      cancel(client, query) {
        if (client.activeQuery === query) {
          const con = this.connection;
          if (this.host && this.host.indexOf("/") === 0) {
            con.connect(this.host + "/.s.PGSQL." + this.port);
          } else {
            con.connect(this.port, this.host);
          }
          con.on("connect", function() {
            con.cancel(client.processID, client.secretKey);
          });
        } else if (client._queryQueue.indexOf(query) !== -1) {
          client._queryQueue.splice(client._queryQueue.indexOf(query), 1);
        } else if (client._sentQueryQueue.indexOf(query) !== -1) {
          query.callback = () => {
          };
        }
      }
      setTypeParser(oid, format, parseFn) {
        return this._types.setTypeParser(oid, format, parseFn);
      }
      getTypeParser(oid, format) {
        return this._types.getTypeParser(oid, format);
      }
      // escapeIdentifier and escapeLiteral moved to utility functions & exported
      // on PG
      // re-exported here for backwards compatibility
      escapeIdentifier(str) {
        return utils.escapeIdentifier(str);
      }
      escapeLiteral(str) {
        return utils.escapeLiteral(str);
      }
      _pulseQueryQueue() {
        if (this.pipeline) {
          this._pulsePipelinedQueryQueue();
          return;
        }
        if (this.readyForQuery === true) {
          this._activeQuery = this._queryQueue.shift();
          const activeQuery = this._getActiveQuery();
          if (activeQuery) {
            this.readyForQuery = false;
            this.hasExecuted = true;
            const queryError = activeQuery.submit(this.connection);
            if (queryError) {
              process.nextTick(() => {
                activeQuery.handleError(queryError, this.connection);
                this.readyForQuery = true;
                this._pulseQueryQueue();
              });
            }
          } else if (this.hasExecuted) {
            this._activeQuery = null;
            this.emit("drain");
          }
        }
      }
      _pulsePipelinedQueryQueue() {
        if (!this._connected || !this._queryable) {
          return;
        }
        while (this._queryQueue.length > 0) {
          const query = this._queryQueue.shift();
          this.hasExecuted = true;
          const queryError = query.submit(this.connection);
          if (queryError) {
            process.nextTick(() => {
              query.handleError(queryError, this.connection);
            });
            continue;
          }
          this._sentQueryQueue.push(query);
        }
        if (this.readyForQuery && !this._activeQuery && this._sentQueryQueue.length > 0) {
          this._activeQuery = this._sentQueryQueue.shift();
          this.readyForQuery = false;
        }
        if (!this._activeQuery && this._sentQueryQueue.length === 0 && this._queryQueue.length === 0 && this.hasExecuted) {
          this.emit("drain");
        }
      }
      query(config, values, callback) {
        let query;
        let result;
        if (config == null) {
          throw new TypeError("Client was passed a null or undefined query");
        }
        if (typeof config.submit === "function") {
          result = query = config;
          if (!query.callback) {
            if (typeof values === "function") {
              query.callback = values;
            } else if (callback) {
              query.callback = callback;
            }
          }
        } else {
          query = new Query2(config, values, callback);
          if (!query.callback) {
            result = new this._Promise((resolve, reject) => {
              query.callback = (err, res) => err ? reject(err) : resolve(res);
            }).catch((err) => {
              Error.captureStackTrace(err);
              throw err;
            });
          } else if (typeof query.callback !== "function") {
            throw new TypeError("callback is not a function");
          }
        }
        const readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        if (readTimeout) {
          const queryCallback = query.callback || (() => {
          });
          const readTimeoutTimer = setTimeout(() => {
            const error = new Error("Query read timeout");
            process.nextTick(() => {
              query.handleError(error, this.connection);
            });
            queryCallback(error);
            query.callback = () => {
            };
            const index = this._queryQueue.indexOf(query);
            if (index > -1) {
              this._queryQueue.splice(index, 1);
            } else if (this.pipeline) {
              this.connection.stream.destroy();
              return;
            }
            this._pulseQueryQueue();
          }, readTimeout);
          query.callback = (err, res) => {
            clearTimeout(readTimeoutTimer);
            queryCallback(err, res);
          };
        }
        if (this.binary && !query.binary) {
          query.binary = true;
        }
        if (query._result && !query._result._types) {
          query._result._types = this._types;
        }
        if (!this._queryable) {
          process.nextTick(() => {
            query.handleError(new Error("Client has encountered a connection error and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._ending) {
          process.nextTick(() => {
            query.handleError(new Error("Client was closed and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._queryQueue.length > 0 && !this.pipeline) {
          queryQueueLengthDeprecationNotice();
        }
        this._queryQueue.push(query);
        this._pulseQueryQueue();
        return result;
      }
      ref() {
        this.connection.ref();
      }
      unref() {
        this.connection.unref();
      }
      getTransactionStatus() {
        return this._txStatus;
      }
      end(cb) {
        this._ending = true;
        if (!this.connection._connecting || this._ended) {
          if (cb) {
            cb();
            return;
          } else {
            return this._Promise.resolve();
          }
        }
        if (!this._queryable) {
          this.connection.stream.destroy();
        } else if (this.pipeline && (this._getActiveQuery() || this._sentQueryQueue.length > 0 || this._queryQueue.length > 0)) {
          this.once("drain", () => this.connection.end());
        } else if (this._getActiveQuery()) {
          this.connection.stream.destroy();
        } else {
          this.connection.end();
        }
        if (cb) {
          this.connection.once("end", cb);
        } else {
          return new this._Promise((resolve) => {
            this.connection.once("end", resolve);
          });
        }
      }
      get queryQueue() {
        queryQueueDeprecationNotice();
        return this._queryQueue;
      }
    };
    Client2.Query = Query2;
    module2.exports = Client2;
  }
});

// node_modules/pg-pool/index.js
var require_pg_pool = __commonJS({
  "node_modules/pg-pool/index.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events").EventEmitter;
    var NOOP = function() {
    };
    var removeWhere = (list, predicate) => {
      const i = list.findIndex(predicate);
      return i === -1 ? void 0 : list.splice(i, 1)[0];
    };
    var IdleItem = class {
      constructor(client, idleListener, timeoutId) {
        this.client = client;
        this.idleListener = idleListener;
        this.timeoutId = timeoutId;
      }
    };
    var PendingItem = class {
      constructor(callback) {
        this.callback = callback;
      }
    };
    function throwOnDoubleRelease() {
      throw new Error("Release called on client which has already been released to the pool.");
    }
    function promisify(Promise2, callback) {
      if (callback) {
        return { callback, result: void 0 };
      }
      let rej;
      let res;
      const cb = function(err, client) {
        err ? rej(err) : res(client);
      };
      const result = new Promise2(function(resolve, reject) {
        res = resolve;
        rej = reject;
      }).catch((err) => {
        Error.captureStackTrace(err);
        throw err;
      });
      return { callback: cb, result };
    }
    function makeIdleListener(pool, client) {
      return function idleListener(err) {
        err.client = client;
        client.removeListener("error", idleListener);
        client.on("error", () => {
          pool.log("additional client error after disconnection due to error", err);
        });
        pool._remove(client);
        pool.emit("error", err, client);
      };
    }
    var Pool2 = class extends EventEmitter {
      constructor(options, Client2) {
        super();
        this.options = Object.assign({}, options);
        if (options != null && "password" in options) {
          Object.defineProperty(this.options, "password", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: options.password
          });
        }
        if (options != null && options.ssl && options.ssl.key) {
          Object.defineProperty(this.options.ssl, "key", {
            enumerable: false
          });
        }
        this.options.max = this.options.max || this.options.poolSize || 10;
        this.options.min = this.options.min || 0;
        this.options.maxUses = this.options.maxUses || Infinity;
        this.options.allowExitOnIdle = this.options.allowExitOnIdle || false;
        this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0;
        this.log = this.options.log || function() {
        };
        this.Client = this.options.Client || Client2 || require_lib2().Client;
        this.Promise = this.options.Promise || global.Promise;
        if (typeof this.options.idleTimeoutMillis === "undefined") {
          this.options.idleTimeoutMillis = 1e4;
        }
        this._clients = [];
        this._idle = [];
        this._expired = /* @__PURE__ */ new WeakSet();
        this._pendingQueue = [];
        this._endCallback = void 0;
        this.ending = false;
        this.ended = false;
      }
      _promiseTry(f) {
        const Promise2 = this.Promise;
        if (typeof Promise2.try === "function") {
          return Promise2.try(f);
        }
        return new Promise2((resolve) => resolve(f()));
      }
      _isFull() {
        return this._clients.length >= this.options.max;
      }
      _isAboveMin() {
        return this._clients.length > this.options.min;
      }
      _pulseQueue() {
        this.log("pulse queue");
        if (this.ended) {
          this.log("pulse queue ended");
          return;
        }
        if (this.ending) {
          this.log("pulse queue on ending");
          if (this._idle.length) {
            this._idle.slice().map((item) => {
              this._remove(item.client);
            });
          }
          if (!this._clients.length) {
            this.ended = true;
            this._endCallback();
          }
          return;
        }
        if (!this._pendingQueue.length) {
          this.log("no queued requests");
          return;
        }
        if (!this._idle.length && this._isFull()) {
          return;
        }
        const pendingItem = this._pendingQueue.shift();
        if (this._idle.length) {
          const idleItem = this._idle.pop();
          clearTimeout(idleItem.timeoutId);
          const client = idleItem.client;
          client.ref && client.ref();
          const idleListener = idleItem.idleListener;
          return this._acquireClient(client, pendingItem, idleListener, false);
        }
        if (!this._isFull()) {
          return this.newClient(pendingItem);
        }
        throw new Error("unexpected condition");
      }
      _remove(client, callback) {
        const removed = removeWhere(this._idle, (item) => item.client === client);
        if (removed !== void 0) {
          clearTimeout(removed.timeoutId);
        }
        this._clients = this._clients.filter((c) => c !== client);
        const context = this;
        client.end(() => {
          context.emit("remove", client);
          if (typeof callback === "function") {
            callback();
          }
        });
      }
      connect(cb) {
        if (this.ending) {
          const err = new Error("Cannot use a pool after calling end on the pool");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        const response = promisify(this.Promise, cb);
        const result = response.result;
        if (this._isFull() || this._idle.length) {
          if (this._idle.length) {
            process.nextTick(() => this._pulseQueue());
          }
          if (!this.options.connectionTimeoutMillis) {
            this._pendingQueue.push(new PendingItem(response.callback));
            return result;
          }
          const queueCallback = (err, res, done) => {
            clearTimeout(tid);
            response.callback(err, res, done);
          };
          const pendingItem = new PendingItem(queueCallback);
          const tid = setTimeout(() => {
            removeWhere(this._pendingQueue, (i) => i.callback === queueCallback);
            pendingItem.timedOut = true;
            response.callback(new Error("timeout exceeded when trying to connect"));
          }, this.options.connectionTimeoutMillis);
          if (tid.unref) {
            tid.unref();
          }
          this._pendingQueue.push(pendingItem);
          return result;
        }
        this.newClient(new PendingItem(response.callback));
        return result;
      }
      newClient(pendingItem) {
        const client = new this.Client(this.options);
        this._clients.push(client);
        const idleListener = makeIdleListener(this, client);
        this.log("checking client timeout");
        let tid;
        let timeoutHit = false;
        if (this.options.connectionTimeoutMillis) {
          tid = setTimeout(() => {
            if (client.connection) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.connection.stream.destroy();
            } else if (!client.isConnected()) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client.end();
            }
          }, this.options.connectionTimeoutMillis);
        }
        this.log("connecting new client");
        client.connect((err) => {
          if (tid) {
            clearTimeout(tid);
          }
          client.on("error", idleListener);
          if (err) {
            this.log("client failed to connect", err);
            this._clients = this._clients.filter((c) => c !== client);
            if (timeoutHit) {
              err = new Error("Connection terminated due to connection timeout", { cause: err });
            }
            this._pulseQueue();
            if (!pendingItem.timedOut) {
              pendingItem.callback(err, void 0, NOOP);
            }
          } else {
            this.log("new client connected");
            if (this.options.onConnect) {
              this._promiseTry(() => this.options.onConnect(client)).then(
                () => {
                  this._afterConnect(client, pendingItem, idleListener);
                },
                (hookErr) => {
                  this._clients = this._clients.filter((c) => c !== client);
                  client.end(() => {
                    this._pulseQueue();
                    if (!pendingItem.timedOut) {
                      pendingItem.callback(hookErr, void 0, NOOP);
                    }
                  });
                }
              );
              return;
            }
            return this._afterConnect(client, pendingItem, idleListener);
          }
        });
      }
      _afterConnect(client, pendingItem, idleListener) {
        if (this.options.maxLifetimeSeconds !== 0) {
          const maxLifetimeTimeout = setTimeout(() => {
            this.log("ending client due to expired lifetime");
            this._expired.add(client);
            const idleIndex = this._idle.findIndex((idleItem) => idleItem.client === client);
            if (idleIndex !== -1) {
              this._acquireClient(
                client,
                new PendingItem((err, client2, clientRelease) => clientRelease()),
                idleListener,
                false
              );
            }
          }, this.options.maxLifetimeSeconds * 1e3);
          maxLifetimeTimeout.unref();
          client.once("end", () => clearTimeout(maxLifetimeTimeout));
        }
        return this._acquireClient(client, pendingItem, idleListener, true);
      }
      // acquire a client for a pending work item
      _acquireClient(client, pendingItem, idleListener, isNew) {
        if (isNew) {
          this.emit("connect", client);
        }
        this.emit("acquire", client);
        client.release = this._releaseOnce(client, idleListener);
        client.removeListener("error", idleListener);
        if (!pendingItem.timedOut) {
          if (isNew && this.options.verify) {
            this.options.verify(client, (err) => {
              if (err) {
                client.release(err);
                return pendingItem.callback(err, void 0, NOOP);
              }
              pendingItem.callback(void 0, client, client.release);
            });
          } else {
            pendingItem.callback(void 0, client, client.release);
          }
        } else {
          if (isNew && this.options.verify) {
            this.options.verify(client, client.release);
          } else {
            client.release();
          }
        }
      }
      // returns a function that wraps _release and throws if called more than once
      _releaseOnce(client, idleListener) {
        let released = false;
        return (err) => {
          if (released) {
            throwOnDoubleRelease();
          }
          released = true;
          this._release(client, idleListener, err);
        };
      }
      // release a client back to the poll, include an error
      // to remove it from the pool
      _release(client, idleListener, err) {
        client.on("error", idleListener);
        client._poolUseCount = (client._poolUseCount || 0) + 1;
        this.emit("release", err, client);
        if (err || this.ending || !client._queryable || client._ending || client._poolUseCount >= this.options.maxUses) {
          if (client._poolUseCount >= this.options.maxUses) {
            this.log("remove expended client");
          }
          return this._remove(client, this._pulseQueue.bind(this));
        }
        const isExpired = this._expired.has(client);
        if (isExpired) {
          this.log("remove expired client");
          this._expired.delete(client);
          return this._remove(client, this._pulseQueue.bind(this));
        }
        let tid;
        if (this.options.idleTimeoutMillis && this._isAboveMin()) {
          tid = setTimeout(() => {
            if (this._isAboveMin()) {
              this.log("remove idle client");
              this._remove(client, this._pulseQueue.bind(this));
            }
          }, this.options.idleTimeoutMillis);
          if (this.options.allowExitOnIdle) {
            tid.unref();
          }
        }
        if (this.options.allowExitOnIdle) {
          client.unref();
        }
        this._idle.push(new IdleItem(client, idleListener, tid));
        this._pulseQueue();
      }
      query(text, values, cb) {
        if (typeof text === "function") {
          const response2 = promisify(this.Promise, text);
          setImmediate(function() {
            return response2.callback(new Error("Passing a function as the first parameter to pool.query is not supported"));
          });
          return response2.result;
        }
        if (typeof values === "function") {
          cb = values;
          values = void 0;
        }
        const response = promisify(this.Promise, cb);
        cb = response.callback;
        this.connect((err, client) => {
          if (err) {
            return cb(err);
          }
          let clientReleased = false;
          const onError = (err2) => {
            if (clientReleased) {
              return;
            }
            clientReleased = true;
            client.release(err2);
            cb(err2);
          };
          client.once("error", onError);
          this.log("dispatching query");
          try {
            client.query(text, values, (err2, res) => {
              this.log("query dispatched");
              client.removeListener("error", onError);
              if (clientReleased) {
                return;
              }
              clientReleased = true;
              client.release(err2);
              if (err2) {
                return cb(err2);
              }
              return cb(void 0, res);
            });
          } catch (err2) {
            client.release(err2);
            return cb(err2);
          }
        });
        return response.result;
      }
      end(cb) {
        this.log("ending");
        if (this.ending) {
          const err = new Error("Called end on pool more than once");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        this.ending = true;
        const promised = promisify(this.Promise, cb);
        this._endCallback = promised.callback;
        this._pulseQueue();
        return promised.result;
      }
      get waitingCount() {
        return this._pendingQueue.length;
      }
      get idleCount() {
        return this._idle.length;
      }
      get expiredCount() {
        return this._clients.reduce((acc, client) => acc + (this._expired.has(client) ? 1 : 0), 0);
      }
      get totalCount() {
        return this._clients.length;
      }
    };
    module2.exports = Pool2;
  }
});

// node_modules/pg/lib/native/query.js
var require_query2 = __commonJS({
  "node_modules/pg/lib/native/query.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events").EventEmitter;
    var util = require("util");
    var utils = require_utils();
    var NativeQuery = module2.exports = function(config, values, callback) {
      EventEmitter.call(this);
      config = utils.normalizeQueryConfig(config, values, callback);
      this.text = config.text;
      this.values = config.values;
      this.name = config.name;
      this.queryMode = config.queryMode;
      this.callback = config.callback;
      this.state = "new";
      this._arrayMode = config.rowMode === "array";
      this._emitRowEvents = false;
      this.on(
        "newListener",
        function(event) {
          if (event === "row") this._emitRowEvents = true;
        }.bind(this)
      );
    };
    util.inherits(NativeQuery, EventEmitter);
    var errorFieldMap = {
      sqlState: "code",
      statementPosition: "position",
      messagePrimary: "message",
      context: "where",
      schemaName: "schema",
      tableName: "table",
      columnName: "column",
      dataTypeName: "dataType",
      constraintName: "constraint",
      sourceFile: "file",
      sourceLine: "line",
      sourceFunction: "routine"
    };
    NativeQuery.prototype.handleError = function(err) {
      const fields = this.native && this.native.pq.resultErrorFields();
      if (fields) {
        for (const key in fields) {
          const normalizedFieldName = errorFieldMap[key] || key;
          err[normalizedFieldName] = fields[key];
        }
      }
      if (this.callback) {
        this.callback(err);
      } else {
        this.emit("error", err);
      }
      this.state = "error";
    };
    NativeQuery.prototype.then = function(onSuccess, onFailure) {
      return this._getPromise().then(onSuccess, onFailure);
    };
    NativeQuery.prototype.catch = function(callback) {
      return this._getPromise().catch(callback);
    };
    NativeQuery.prototype._getPromise = function() {
      if (this._promise) return this._promise;
      this._promise = new Promise(
        function(resolve, reject) {
          this._once("end", resolve);
          this._once("error", reject);
        }.bind(this)
      );
      return this._promise;
    };
    NativeQuery.prototype.submit = function(client) {
      this.state = "running";
      const self = this;
      this.native = client.native;
      client.native.arrayMode = this._arrayMode;
      let after = function(err, rows, results) {
        client.native.arrayMode = false;
        setImmediate(function() {
          self.emit("_done");
        });
        if (err) {
          return self.handleError(err);
        }
        if (self._emitRowEvents) {
          if (results.length > 1) {
            rows.forEach((rowOfRows, i) => {
              rowOfRows.forEach((row) => {
                self.emit("row", row, results[i]);
              });
            });
          } else {
            rows.forEach(function(row) {
              self.emit("row", row, results);
            });
          }
        }
        self.state = "end";
        self.emit("end", results);
        if (self.callback) {
          self.callback(null, results);
        }
      };
      if (process.domain) {
        after = process.domain.bind(after);
      }
      if (this.name) {
        if (this.name.length > 63) {
          console.error("Warning! Postgres only supports 63 characters for query names.");
          console.error("You supplied %s (%s)", this.name, this.name.length);
          console.error("This can cause conflicts and silent errors executing queries");
        }
        const values = (this.values || []).map(utils.prepareValue);
        if (client.namedQueries[this.name]) {
          if (this.text && client.namedQueries[this.name] !== this.text) {
            const err = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
            return after(err);
          }
          return client.native.execute(this.name, values, after);
        }
        return client.native.prepare(this.name, this.text, values.length, function(err) {
          if (err) return after(err);
          client.namedQueries[self.name] = self.text;
          return self.native.execute(self.name, values, after);
        });
      } else if (this.values) {
        if (!Array.isArray(this.values)) {
          const err = new Error("Query values must be an array");
          return after(err);
        }
        const vals = this.values.map(utils.prepareValue);
        client.native.query(this.text, vals, after);
      } else if (this.queryMode === "extended") {
        client.native.query(this.text, [], after);
      } else {
        client.native.query(this.text, after);
      }
    };
  }
});

// node_modules/pg/lib/native/client.js
var require_client2 = __commonJS({
  "node_modules/pg/lib/native/client.js"(exports2, module2) {
    var nodeUtils = require("util");
    var Native;
    try {
      Native = require("pg-native");
    } catch (e) {
      throw e;
    }
    var TypeOverrides2 = require_type_overrides();
    var EventEmitter = require("events").EventEmitter;
    var util = require("util");
    var ConnectionParameters = require_connection_parameters();
    var NativeQuery = require_query2();
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    var Client2 = module2.exports = function(config) {
      EventEmitter.call(this);
      config = config || {};
      this._Promise = config.Promise || global.Promise;
      this._types = new TypeOverrides2(config.types);
      this.native = new Native({
        types: this._types
      });
      this._queryQueue = [];
      this._ending = false;
      this._connecting = false;
      this._connected = false;
      this._queryable = true;
      this.pipeline = Boolean(config.pipeline);
      this._pipelineInFlight = false;
      const cp = this.connectionParameters = new ConnectionParameters(config);
      if (config.nativeConnectionString) cp.nativeConnectionString = config.nativeConnectionString;
      this.user = cp.user;
      Object.defineProperty(this, "password", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: cp.password
      });
      this.database = cp.database;
      this.host = cp.host;
      this.port = cp.port;
      this.namedQueries = {};
    };
    Client2.Query = NativeQuery;
    util.inherits(Client2, EventEmitter);
    Client2.prototype._errorAllQueries = function(err) {
      const enqueueError = (query) => {
        process.nextTick(() => {
          query.native = this.native;
          query.handleError(err);
        });
      };
      if (this._hasActiveQuery()) {
        enqueueError(this._activeQuery);
        this._activeQuery = null;
      }
      this._queryQueue.forEach(enqueueError);
      this._queryQueue.length = 0;
    };
    Client2.prototype._connect = function(cb) {
      const self = this;
      if (this._connecting) {
        process.nextTick(() => cb(new Error("Client has already been connected. You cannot reuse a client.")));
        return;
      }
      this._connecting = true;
      this.connectionParameters.getLibpqConnectionString(function(err, conString) {
        if (self.connectionParameters.nativeConnectionString) conString = self.connectionParameters.nativeConnectionString;
        if (err) return cb(err);
        self.native.connect(conString, function(err2) {
          if (err2) {
            self.native.end();
            return cb(err2);
          }
          self._connected = true;
          self.native.on("error", function(err3) {
            self._queryable = false;
            self._errorAllQueries(err3);
            self.emit("error", err3);
          });
          self.native.on("notification", function(msg) {
            self.emit("notification", {
              channel: msg.relname,
              payload: msg.extra
            });
          });
          self.emit("connect");
          self._pulseQueryQueue(true);
          cb(null, this);
        });
      });
    };
    Client2.prototype.connect = function(callback) {
      if (callback) {
        this._connect(callback);
        return;
      }
      return new this._Promise((resolve, reject) => {
        this._connect((error) => {
          if (error) {
            reject(error);
          } else {
            resolve(this);
          }
        });
      });
    };
    Client2.prototype.query = function(config, values, callback) {
      let query;
      let result;
      let readTimeout;
      let readTimeoutTimer;
      let queryCallback;
      if (config === null || config === void 0) {
        throw new TypeError("Client was passed a null or undefined query");
      } else if (typeof config.submit === "function") {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        result = query = config;
        if (typeof values === "function") {
          config.callback = values;
        }
      } else {
        readTimeout = config.query_timeout || this.connectionParameters.query_timeout;
        query = new NativeQuery(config, values, callback);
        if (!query.callback) {
          let resolveOut, rejectOut;
          result = new this._Promise((resolve, reject) => {
            resolveOut = resolve;
            rejectOut = reject;
          }).catch((err) => {
            Error.captureStackTrace(err);
            throw err;
          });
          query.callback = (err, res) => err ? rejectOut(err) : resolveOut(res);
        }
      }
      if (readTimeout) {
        queryCallback = query.callback || (() => {
        });
        readTimeoutTimer = setTimeout(() => {
          const error = new Error("Query read timeout");
          process.nextTick(() => {
            query.handleError(error, this.connection);
          });
          queryCallback(error);
          query.callback = () => {
          };
          const index = this._queryQueue.indexOf(query);
          if (index > -1) {
            this._queryQueue.splice(index, 1);
          }
          this._pulseQueryQueue();
        }, readTimeout);
        query.callback = (err, res) => {
          clearTimeout(readTimeoutTimer);
          queryCallback(err, res);
        };
      }
      if (!this._queryable) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client has encountered a connection error and is not queryable"));
        });
        return result;
      }
      if (this._ending) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client was closed and is not queryable"));
        });
        return result;
      }
      if (this._queryQueue.length > 0 && !this.pipeline) {
        queryQueueLengthDeprecationNotice();
      }
      this._queryQueue.push(query);
      this._pulseQueryQueue();
      return result;
    };
    Client2.prototype.end = function(cb) {
      const self = this;
      this._ending = true;
      if (this._connecting && !this._connected) {
        this.once("connect", () => {
          this.end(() => {
          });
        });
      }
      let result;
      if (!cb) {
        result = new this._Promise(function(resolve, reject) {
          cb = (err) => err ? reject(err) : resolve();
        });
      }
      const doEnd = function() {
        self.native.end(function() {
          self._connected = false;
          self._errorAllQueries(new Error("Connection terminated"));
          process.nextTick(() => {
            self.emit("end");
            if (cb) cb();
          });
        });
      };
      if (this.pipeline && (this._pipelineInFlight || this._queryQueue.length > 0)) {
        this.once("drain", doEnd);
      } else {
        doEnd();
      }
      return result;
    };
    Client2.prototype._hasActiveQuery = function() {
      return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
    };
    Client2.prototype._pulseQueryQueue = function(initialConnection) {
      if (!this._connected) {
        return;
      }
      if (this.pipeline && !initialConnection) {
        return this._pulsePipelinedQueryQueue();
      }
      if (this._hasActiveQuery()) {
        return;
      }
      const query = this._queryQueue.shift();
      if (!query) {
        if (!initialConnection) {
          this.emit("drain");
        }
        return;
      }
      this._activeQuery = query;
      query.submit(this);
      const self = this;
      query.once("_done", function() {
        self._pulseQueryQueue();
      });
    };
    Client2.prototype._pulsePipelinedQueryQueue = function() {
      if (!this._connected || this._pipelineInFlight) {
        return;
      }
      if (this._queryQueue.length === 0) {
        if (this.hasExecuted) {
          this.emit("drain");
        }
        return;
      }
      this._pipelineInFlight = true;
      const self = this;
      const queries = [];
      const nativeQueries = [];
      const utils = require_utils();
      while (this._queryQueue.length > 0) {
        const query = this._queryQueue.shift();
        this.hasExecuted = true;
        nativeQueries.push(query);
        const values = query.values ? query.values.map(utils.prepareValue) : null;
        const pipelineEntry = { text: query.text, name: query.name };
        if (values) {
          pipelineEntry.values = values;
        }
        if (query.name && this.namedQueries[query.name]) {
          pipelineEntry._alreadyPrepared = true;
        }
        queries.push(pipelineEntry);
      }
      this.native.pipeline(queries, function(err, results) {
        self._pipelineInFlight = false;
        if (err) {
          for (let i = 0; i < nativeQueries.length; i++) {
            const q = nativeQueries[i];
            q.native = self.native;
            q.handleError(err);
          }
          self._pulsePipelinedQueryQueue();
          return;
        }
        for (let i = 0; i < nativeQueries.length; i++) {
          const q = nativeQueries[i];
          const r = results[i];
          q.native = self.native;
          if (r.err) {
            q.handleError(r.err);
          } else {
            if (q.name) {
              self.namedQueries[q.name] = q.text;
            }
            q.state = "end";
            q.emit("end", r.result);
            if (q.callback) {
              q.callback(null, r.result);
            }
          }
          setImmediate(function() {
            q.emit("_done");
          });
        }
        self._pulsePipelinedQueryQueue();
      });
    };
    Client2.prototype.cancel = function(query) {
      if (this._activeQuery === query) {
        this.native.cancel(function() {
        });
      } else if (this._queryQueue.indexOf(query) !== -1) {
        this._queryQueue.splice(this._queryQueue.indexOf(query), 1);
      }
    };
    Client2.prototype.ref = function() {
    };
    Client2.prototype.unref = function() {
    };
    Client2.prototype.setTypeParser = function(oid, format, parseFn) {
      return this._types.setTypeParser(oid, format, parseFn);
    };
    Client2.prototype.getTypeParser = function(oid, format) {
      return this._types.getTypeParser(oid, format);
    };
    Client2.prototype.isConnected = function() {
      return this._connected;
    };
    Client2.prototype.getTransactionStatus = function() {
      return this.native.getTransactionStatus();
    };
  }
});

// node_modules/pg/lib/native/index.js
var require_native = __commonJS({
  "node_modules/pg/lib/native/index.js"(exports2, module2) {
    "use strict";
    module2.exports = require_client2();
  }
});

// node_modules/pg/lib/index.js
var require_lib2 = __commonJS({
  "node_modules/pg/lib/index.js"(exports2, module2) {
    "use strict";
    var Client2 = require_client();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var Result2 = require_result();
    var utils = require_utils();
    var Pool2 = require_pg_pool();
    var TypeOverrides2 = require_type_overrides();
    var { DatabaseError: DatabaseError2 } = require_dist();
    var { escapeIdentifier: escapeIdentifier2, escapeLiteral: escapeLiteral2 } = require_utils();
    var poolFactory = (Client3) => {
      return class BoundPool extends Pool2 {
        constructor(options) {
          super(options, Client3);
        }
      };
    };
    var PG = function(clientConstructor2) {
      this.defaults = defaults2;
      this.Client = clientConstructor2;
      this.Query = this.Client.Query;
      this.Pool = poolFactory(this.Client);
      this._pools = [];
      this.Connection = Connection2;
      this.types = require_pg_types();
      this.DatabaseError = DatabaseError2;
      this.TypeOverrides = TypeOverrides2;
      this.escapeIdentifier = escapeIdentifier2;
      this.escapeLiteral = escapeLiteral2;
      this.Result = Result2;
      this.utils = utils;
    };
    var clientConstructor = Client2;
    var forceNative = false;
    try {
      forceNative = !!process.env.NODE_PG_FORCE_NATIVE;
    } catch {
    }
    if (forceNative) {
      clientConstructor = require_native();
    }
    module2.exports = new PG(clientConstructor);
    Object.defineProperty(module2.exports, "native", {
      configurable: true,
      enumerable: false,
      get() {
        let native = null;
        try {
          native = new PG(require_native());
        } catch (err) {
          if (err.code !== "MODULE_NOT_FOUND") {
            throw err;
          }
        }
        Object.defineProperty(module2.exports, "native", {
          value: native
        });
        return native;
      }
    });
  }
});

// src/plugin.ts
var plugin_exports = {};
__export(plugin_exports, {
  appGraph: () => appGraph,
  repositories: () => repositories
});
module.exports = __toCommonJS(plugin_exports);
var net2 = __toESM(require("net"));
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/protocol.ts
var MAX_FRAME_BYTES = 4 * 1024 * 1024;
var ProtocolViolationError = class extends Error {
  constructor(reason) {
    super(reason);
    this.name = "ProtocolViolationError";
  }
};
function encodeFrame(frame) {
  return Buffer.from(JSON.stringify(frame) + "\n", "utf8");
}
var FrameReader = class {
  pending = Buffer.alloc(0);
  push(chunk) {
    const combined = this.pending.length > 0 ? Buffer.concat([this.pending, chunk]) : chunk;
    const lines = [];
    let start = 0;
    for (; ; ) {
      const nl = combined.indexOf(10, start);
      if (nl === -1) break;
      if (nl - start > MAX_FRAME_BYTES) {
        throw new ProtocolViolationError(`frame exceeds ${MAX_FRAME_BYTES} bytes`);
      }
      lines.push(combined.subarray(start, nl).toString("utf8"));
      start = nl + 1;
    }
    const rest = combined.subarray(start);
    if (rest.length > MAX_FRAME_BYTES) {
      throw new ProtocolViolationError(`frame exceeds ${MAX_FRAME_BYTES} bytes`);
    }
    this.pending = rest;
    return lines;
  }
};
function parseFrame(line2) {
  let parsed;
  try {
    parsed = JSON.parse(line2);
  } catch {
    throw new ProtocolViolationError("malformed JSON line");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new ProtocolViolationError("frame is not a JSON object");
  }
  return parsed;
}
function isReq(f) {
  return typeof f.i === "number" && typeof f.m === "string";
}
function isNote(f) {
  return typeof f.m === "string" && !("i" in f);
}

// src/log.ts
function redact(msg) {
  return msg.replace(/:\/\/[^\s/@]+:[^\s/@]+@/g, "://***:***@");
}
function line(stream, level, msg) {
  stream.write(`[${(/* @__PURE__ */ new Date()).toISOString()}] ${level} ${redact(msg).replace(/\n/g, " ")}
`);
}
var log = {
  info: (msg) => line(process.stdout, "INFO", msg),
  warn: (msg) => line(process.stderr, "WARN", msg),
  error: (msg) => line(process.stderr, "ERROR", msg)
};

// src/dispatcher.ts
function attachDispatcher(socket, requestHandlers2, noteHandlers2) {
  const reader = new FrameReader();
  socket.on("data", (chunk) => {
    let lines;
    try {
      lines = reader.push(chunk);
    } catch (err) {
      log.error(`protocol violation from core: ${err.message}`);
      socket.destroy();
      return;
    }
    for (const line2 of lines) {
      let frame;
      try {
        frame = parseFrame(line2);
      } catch (err) {
        log.error(`protocol violation from core: ${err.message}`);
        socket.destroy();
        return;
      }
      if (isReq(frame)) {
        const handler = requestHandlers2[frame.m];
        if (!handler) {
          socket.write(encodeFrame({ i: frame.i, e: { c: "ERR_NO_METHOD", m: `no handler for "${frame.m}"` } }));
          continue;
        }
        handler(frame.p).then((r) => socket.write(encodeFrame({ i: frame.i, r }))).catch((err) => socket.write(encodeFrame({ i: frame.i, e: { c: "ERR", m: err.message } })));
      } else if (isNote(frame)) {
        const noteFrame = frame;
        noteHandlers2[noteFrame.m]?.(noteFrame.p);
      }
    }
  });
  socket.on("error", () => {
  });
}

// src/host-client.ts
var net = __toESM(require("net"));
var DEFAULT_CALL_TIMEOUT_MS = 1e4;
var MAX_OUTSTANDING_CALLS = 256;
var HostCallError = class extends Error {
};
var HostClient = class {
  constructor(sockPath) {
    this.sockPath = sockPath;
  }
  socket = null;
  reader = new FrameReader();
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  connected = false;
  connect() {
    const socket = net.connect(this.sockPath);
    this.socket = socket;
    socket.on("connect", () => {
      this.connected = true;
    });
    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (err) => this.onFatal(new Error(`core socket error: ${err.message}`)));
    socket.on("close", () => {
      this.connected = false;
      this.onFatal(new Error("core socket closed"));
    });
  }
  get isConnected() {
    return this.connected;
  }
  /** Every call carries a deadline and rejects — never hangs — once it elapses. */
  call(method, payload, timeoutMs = DEFAULT_CALL_TIMEOUT_MS) {
    if (!this.socket || !this.connected) {
      return Promise.reject(new HostCallError(`not connected to core (method "${method}")`));
    }
    if (this.pending.size >= MAX_OUTSTANDING_CALLS) {
      return Promise.reject(new HostCallError(`too many outstanding core calls (>= ${MAX_OUTSTANDING_CALLS})`));
    }
    const i = this.nextId++;
    const req = { i, m: method, p: payload };
    const socket = this.socket;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(i);
        reject(new HostCallError(`"${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(i, {
        resolve,
        reject,
        timer
      });
      socket.write(encodeFrame(req));
    });
  }
  /** Fails every outstanding call and stops tracking new replies — never leaves one hanging. */
  close() {
    this.socket?.destroy();
    this.onFatal(new Error("client closed"));
  }
  onData(chunk) {
    let lines;
    try {
      lines = this.reader.push(chunk);
    } catch (err) {
      this.onFatal(err);
      return;
    }
    for (const line2 of lines) {
      let frame;
      try {
        frame = parseFrame(line2);
      } catch (err) {
        this.onFatal(err);
        return;
      }
      if (isReq(frame)) continue;
      const res = frame;
      if (typeof res.i !== "number") continue;
      const pending = this.pending.get(res.i);
      if (!pending) continue;
      this.pending.delete(res.i);
      clearTimeout(pending.timer);
      if (res.e) pending.reject(new HostCallError(`${res.e.c}: ${res.e.m}`));
      else pending.resolve(res.r);
    }
  }
  /** A protocol violation or socket loss fails every outstanding call rather than
   *  wedging the client — the caller gets a rejection, not a hang. */
  onFatal(err) {
    if (this.connected) log.error(err.message);
    this.connected = false;
    this.socket?.destroy();
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
      this.pending.delete(id);
    }
  }
};

// node_modules/pg/esm/index.mjs
var import_lib = __toESM(require_lib2(), 1);
var Client = import_lib.default.Client;
var Pool = import_lib.default.Pool;
var Connection = import_lib.default.Connection;
var types = import_lib.default.types;
var Query = import_lib.default.Query;
var DatabaseError = import_lib.default.DatabaseError;
var escapeIdentifier = import_lib.default.escapeIdentifier;
var escapeLiteral = import_lib.default.escapeLiteral;
var Result = import_lib.default.Result;
var TypeOverrides = import_lib.default.TypeOverrides;
var defaults = import_lib.default.defaults;

// src/db/pool.ts
function pluginSchemaName(pluginId2) {
  return `plugin_${pluginId2.replace(/\./g, "_")}`;
}
function withSearchPath(dsn, schema) {
  const url = new URL(dsn);
  url.searchParams.set("options", `-c search_path=${schema}`);
  return url.toString();
}
function customTypes() {
  return {
    getTypeParser(oid, format) {
      if (oid === types.builtins.INT8) return (val) => Number(val);
      if (oid === types.builtins.TIMESTAMPTZ) return (val) => new Date(val).toISOString();
      return types.getTypeParser(oid, format);
    }
  };
}
function createPluginPool(config) {
  const schema = pluginSchemaName(config.pluginId);
  return new Pool({
    connectionString: withSearchPath(config.dsn, schema),
    types: customTypes()
  });
}

// migrations/0001_initial_schema.ts
var up = `
CREATE TABLE "indexers" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "name" varchar NOT NULL,
  "implementation" varchar NOT NULL,
  "settings" jsonb NOT NULL DEFAULT '{}',
  "enableRss" boolean NOT NULL DEFAULT true,
  "enableSearch" boolean NOT NULL DEFAULT true,
  "priority" integer NOT NULL DEFAULT 25,
  "enabled" boolean NOT NULL DEFAULT true,
  "capsMovieSearch" boolean NOT NULL DEFAULT false,
  "capsTvSearch" boolean NOT NULL DEFAULT false,
  "capsSearchFallback" boolean NOT NULL DEFAULT false,
  "requestDelay" integer NOT NULL DEFAULT 2
);

CREATE TABLE "download_clients" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "name" varchar NOT NULL,
  "implementation" varchar NOT NULL,
  "settings" jsonb NOT NULL DEFAULT '{}',
  "enabled" boolean NOT NULL DEFAULT true,
  "priority" integer NOT NULL DEFAULT 1
);

CREATE TABLE "indexer_stats" (
  "id" SERIAL PRIMARY KEY,
  "indexerId" integer REFERENCES "indexers"("id") ON DELETE CASCADE,
  "queryDate" timestamptz NOT NULL DEFAULT now(),
  "queryType" varchar NOT NULL DEFAULT 'search',
  "responseTimeMs" integer NOT NULL DEFAULT 0,
  "resultCount" integer NOT NULL DEFAULT 0,
  "errorMessage" text
);

CREATE TABLE "download_history" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "sourceTitle" varchar NOT NULL,
  "quality" varchar NOT NULL,
  "language" varchar,
  "torrentHash" varchar,
  "status" varchar NOT NULL DEFAULT 'grabbed',
  "statusMessage" text,
  "grabSource" varchar(8) NOT NULL DEFAULT 'auto',
  "mediaId" integer REFERENCES public."media"("id") ON DELETE CASCADE,
  "episodeId" integer REFERENCES public."episodes"("id") ON DELETE SET NULL,
  "seasonId" integer REFERENCES public."seasons"("id") ON DELETE SET NULL,
  "indexerId" integer REFERENCES "indexers"("id") ON DELETE SET NULL,
  "downloadClientId" integer REFERENCES "download_clients"("id") ON DELETE SET NULL
);
CREATE INDEX "idx_download_history_torrent_hash_lower" ON "download_history" (LOWER("torrentHash")) WHERE "torrentHash" IS NOT NULL;

CREATE TABLE "blocklist" (
  "id" SERIAL PRIMARY KEY,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "sourceTitle" varchar NOT NULL,
  "indexerId" integer,
  "indexerName" varchar,
  "downloadUrl" varchar,
  "quality" varchar,
  "note" varchar,
  "mediaId" integer REFERENCES public."media"("id") ON DELETE SET NULL,
  "userId" integer REFERENCES public."users"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "uq_blocklist_source_title_lower" ON "blocklist" (LOWER("sourceTitle"));

CREATE TABLE "stalled_checks" (
  "id" SERIAL PRIMARY KEY,
  "torrentHash" varchar(64) NOT NULL,
  "downloadedBytes" bigint NOT NULL,
  "checkedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_stalled_checks_hash_checked_at" ON "stalled_checks" ("torrentHash", "checkedAt");
`;
var down = `
DROP TABLE IF EXISTS "stalled_checks";
DROP TABLE IF EXISTS "blocklist";
DROP TABLE IF EXISTS "download_history";
DROP TABLE IF EXISTS "indexer_stats";
DROP TABLE IF EXISTS "download_clients";
DROP TABLE IF EXISTS "indexers";
`;
var migration_0001_initial_schema = {
  name: "0001_initial_schema",
  up,
  down
};

// migrations/0002_indexer_caps_probed_at.ts
var up2 = `
  ALTER TABLE "indexers" ADD COLUMN IF NOT EXISTS "capsProbedAt" timestamptz
`;
var down2 = `
  ALTER TABLE "indexers" DROP COLUMN IF EXISTS "capsProbedAt"
`;
var migration_0002_indexer_caps_probed_at = {
  name: "0002_indexer_caps_probed_at",
  up: up2,
  down: down2
};

// migrations/index.ts
var MIGRATIONS = [migration_0001_initial_schema, migration_0002_indexer_caps_probed_at];

// src/db/migrate.ts
var TRACKING_TABLE = "_migrations";
async function ensureTrackingTable(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "${TRACKING_TABLE}" (
       "name" text PRIMARY KEY,
       "appliedAt" timestamptz NOT NULL DEFAULT now()
     )`
  );
}
async function withTransaction(pool, run) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await run(client);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
async function migrateUp(pool) {
  await ensureTrackingTable(pool);
  const { rows } = await pool.query(`SELECT "name" FROM "${TRACKING_TABLE}"`);
  const applied = new Set(rows.map((r) => r.name));
  const ran = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    await withTransaction(pool, async (client) => {
      await client.query(migration.up);
      await client.query(`INSERT INTO "${TRACKING_TABLE}" ("name") VALUES ($1)`, [migration.name]);
    });
    ran.push(migration.name);
  }
  return ran;
}

// src/db/repositories/indexers.repository.ts
var COLUMNS = `"id", "name", "implementation", "settings", "enableRss", "enableSearch",
  "priority", "enabled", "capsSearchFallback", "capsMovieSearch", "capsTvSearch", "capsProbedAt",
  "requestDelay", "createdAt", "updatedAt"`;
var IndexersRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /** Enabled indexers by priority — the search fan-out order.
   *  `acquisition-scheduler.service.ts:178,447`, `episode-download.service.ts:157,495,682`,
   *  `movie-download.service.ts:183,405`. */
  async listEnabled() {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM "indexers" WHERE "enabled" = true ORDER BY "priority" ASC, "id" ASC`
    );
    return rows;
  }
  /** Enabled + RSS-enabled indexers by priority — `acquisition-scheduler.service.ts:447` (RssSync). */
  async listEnabledForRss() {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM "indexers" WHERE "enabled" = true AND "enableRss" = true ORDER BY "priority" ASC, "id" ASC`
    );
    return rows;
  }
  /** Every indexer, enabled or not — `indexers.service.ts:103` (admin list),
   *  `completion.service.ts:1154` (settings lookup for cleanSeededTorrents). */
  async listAll() {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM "indexers" ORDER BY "priority" ASC, "id" ASC`
    );
    return rows;
  }
  /** `download-bundle.module.ts:139` — setup-checklist gate. */
  async countEnabled() {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::text AS "count" FROM "indexers" WHERE "enabled" = true`
    );
    return Number(rows[0]?.count ?? 0);
  }
  /** `indexers.service.ts:134`, `blocklist/blocklist.service.ts:24`. */
  async findById(id) {
    const { rows } = await this.pool.query(`SELECT ${COLUMNS} FROM "indexers" WHERE "id" = $1`, [id]);
    return rows[0] ?? null;
  }
  /** `indexers.service.ts:82-93`. */
  async insert(input) {
    const { rows } = await this.pool.query(
      `INSERT INTO "indexers"
         ("name", "implementation", "settings", "enableRss", "enableSearch", "priority", "requestDelay", "enabled")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUMNS}`,
      [
        input.name,
        input.implementation,
        input.settings,
        input.enableRss,
        input.enableSearch,
        input.priority,
        input.requestDelay,
        input.enabled
      ]
    );
    const row = rows[0];
    if (!row) throw new Error('insert into "indexers" returned no row');
    return row;
  }
  /** `indexers.service.ts:161` — full-entity save. */
  async update(id, input) {
    const { rows } = await this.pool.query(
      `UPDATE "indexers" SET
         "name" = $2, "implementation" = $3, "enableRss" = $4, "enableSearch" = $5,
         "priority" = $6, "requestDelay" = $7, "enabled" = $8, "settings" = $9, "updatedAt" = now()
       WHERE "id" = $1
       RETURNING ${COLUMNS}`,
      [
        id,
        input.name,
        input.implementation,
        input.enableRss,
        input.enableSearch,
        input.priority,
        input.requestDelay,
        input.enabled,
        input.settings
      ]
    );
    const row = rows[0];
    if (!row) throw new Error(`"indexers" row ${id} not found`);
    return row;
  }
  /** `indexers/torznab.service.ts:256` — caps refresh after a `t=caps` probe. */
  async refreshCaps(id, caps) {
    await this.pool.query(
      `UPDATE "indexers" SET "capsMovieSearch" = $2, "capsTvSearch" = $3, "capsSearchFallback" = $4,
              "capsProbedAt" = NOW() WHERE "id" = $1`,
      [id, caps.capsMovieSearch, caps.capsTvSearch, caps.capsSearchFallback]
    );
  }
  /** `indexers/torznab.service.ts:386` — a typed search failed, the untyped retry succeeded. */
  async markSearchFallback(id) {
    await this.pool.query(`UPDATE "indexers" SET "capsSearchFallback" = true WHERE "id" = $1`, [id]);
  }
  /** `indexers.service.ts:168`. */
  async remove(id) {
    await this.pool.query(`DELETE FROM "indexers" WHERE "id" = $1`, [id]);
  }
};

// src/db/repositories/indexer-stats.repository.ts
var COLUMNS2 = `"id", "indexerId", "queryDate", "queryType", "responseTimeMs", "resultCount", "errorMessage"`;
var IndexerStatsRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /** `torznab.service.ts:326,339,356,453,466`. */
  async insert(input) {
    const { rows } = await this.pool.query(
      `INSERT INTO "indexer_stats" ("indexerId", "queryType", "responseTimeMs", "resultCount", "errorMessage")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS2}`,
      [input.indexerId, input.queryType, input.responseTimeMs, input.resultCount, input.errorMessage]
    );
    const row = rows[0];
    if (!row) throw new Error('insert into "indexer_stats" returned no row');
    return row;
  }
  /** `indexers.controller.ts:88-102` — daily query count/latency/results/errors since a cutoff. */
  async dailyStats(indexerId, since) {
    const { rows } = await this.pool.query(
      `SELECT DATE("queryDate")::text AS "date",
              COUNT(*)::int AS "queries",
              AVG("responseTimeMs")::int AS "avgResponseMs",
              SUM("resultCount")::int AS "totalResults",
              SUM(CASE WHEN "errorMessage" IS NOT NULL THEN 1 ELSE 0 END)::int AS "errors"
         FROM "indexer_stats"
        WHERE "indexerId" = $1 AND "queryDate" >= $2
        GROUP BY DATE("queryDate")
        ORDER BY "date" DESC`,
      [indexerId, since]
    );
    return rows;
  }
};

// src/db/repositories/download-clients.repository.ts
var COLUMNS3 = `"id", "name", "implementation", "settings", "enabled", "priority", "createdAt", "updatedAt"`;
var DownloadClientsRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /** `acquisition-scheduler.service.ts:182,482`, `completion.service.ts:295,950,1120`,
   *  `download-clients.service.ts:251,281,334,379`. */
  async listEnabled() {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS3} FROM "download_clients" WHERE "enabled" = true ORDER BY "priority" ASC, "id" ASC`
    );
    return rows;
  }
  /** `episode-download.service.ts:340,620`, `movie-download.service.ts:313,552`,
   *  `download-clients.service.ts:150` (admin list, no `enabled` filter). */
  async listAll() {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS3} FROM "download_clients" ORDER BY "priority" ASC, "id" ASC`
    );
    return rows;
  }
  /** `download-bundle.module.ts:146` — setup-checklist gate. */
  async countEnabled() {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::text AS "count" FROM "download_clients" WHERE "enabled" = true`
    );
    return Number(rows[0]?.count ?? 0);
  }
  /** `download-clients.service.ts:155`. */
  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS3} FROM "download_clients" WHERE "id" = $1`,
      [id]
    );
    return rows[0] ?? null;
  }
  /** `download-clients.service.ts:138-145`. */
  async insert(input) {
    const { rows } = await this.pool.query(
      `INSERT INTO "download_clients" ("name", "implementation", "settings", "enabled", "priority")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS3}`,
      [input.name, input.implementation, input.settings, input.enabled, input.priority]
    );
    const row = rows[0];
    if (!row) throw new Error('insert into "download_clients" returned no row');
    return row;
  }
  /** `download-clients.service.ts:173`. */
  async update(id, input) {
    const { rows } = await this.pool.query(
      `UPDATE "download_clients" SET
         "name" = $2, "implementation" = $3, "settings" = $4, "enabled" = $5, "priority" = $6, "updatedAt" = now()
       WHERE "id" = $1
       RETURNING ${COLUMNS3}`,
      [id, input.name, input.implementation, input.settings, input.enabled, input.priority]
    );
    const row = rows[0];
    if (!row) throw new Error(`"download_clients" row ${id} not found`);
    return row;
  }
  /** `download-clients.service.ts:179`. */
  async remove(id) {
    await this.pool.query(`DELETE FROM "download_clients" WHERE "id" = $1`, [id]);
  }
};

// src/db/repositories/download-history.repository.ts
var COLUMNS4 = `"id", "sourceTitle", "quality", "language", "torrentHash", "status", "statusMessage",
  "grabSource", "mediaId", "episodeId", "seasonId", "indexerId", "downloadClientId", "createdAt", "updatedAt"`;
var DownloadHistoryRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /** `acquisition-events.service.ts:76` — the queue-active sidebar badge. */
  async countActive() {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::text AS "count" FROM "download_history" WHERE "status" IN ('grabbed', 'importing')`
    );
    return Number(rows[0]?.count ?? 0);
  }
  /** `acquisition-scheduler.service.ts:257,544` — "is a grab already pending for this media". */
  async findPendingGrabForMedia(mediaId) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history" WHERE "mediaId" = $1 AND "status" = 'grabbed' LIMIT 1`,
      [mediaId]
    );
    return rows[0] ?? null;
  }
  /** `acquisition-scheduler.service.ts:344,636,625` — dedup by episode-tag substring in
   *  `sourceTitle` (caller builds the ILIKE pattern, e.g. `%S01E03%`). */
  async findPendingEpisodeGrab(mediaId, sourceTitlePattern) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history"
        WHERE "mediaId" = $1 AND "status" = 'grabbed' AND "sourceTitle" ILIKE $2
        LIMIT 1`,
      [mediaId, sourceTitlePattern]
    );
    return rows[0] ?? null;
  }
  /** `acquisition-scheduler.service.ts:394` — "is a season-pack grab already pending for this season". */
  async findPendingSeasonPackGrab(mediaId, seasonId) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history"
        WHERE "mediaId" = $1 AND "status" = 'grabbed' AND "seasonId" = $2 AND "episodeId" IS NULL
        LIMIT 1`,
      [mediaId, seasonId]
    );
    return rows[0] ?? null;
  }
  /** `acquisition-scheduler.service.ts:737` — RSS dedup, exact title match, any status. */
  async findBySourceTitleForMedia(mediaId, sourceTitle) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history" WHERE "mediaId" = $1 AND "sourceTitle" = $2 LIMIT 1`,
      [mediaId, sourceTitle]
    );
    return rows[0] ?? null;
  }
  /** `acquisition-scheduler.service.ts:761` — recent grabbed rows for a media, to detect a
   *  recent season-pack grab client-side. */
  async findRecentGrabbedForMedia(mediaId, since) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history" WHERE "mediaId" = $1 AND "status" = 'grabbed' AND "createdAt" >= $2`,
      [mediaId, since]
    );
    return rows;
  }
  /** `completion.service.ts:165` — unfiltered, for orphan-torrent auto-matching. */
  async findAll() {
    const { rows } = await this.pool.query(`SELECT ${COLUMNS4} FROM "download_history"`);
    return rows;
  }
  /** `completion.service.ts:330,340,444,959`, `download-clients.service.ts:398` — every
   *  "rows in status X or Y or Z" read collapses to one status-list filter. */
  async findByStatuses(statuses) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history" WHERE "status" = ANY($1::text[])`,
      [statuses]
    );
    return rows;
  }
  /** `completion.service.ts:1145` — completed rows whose hash is among the ones a client currently holds. */
  async findCompletedByHashes(hashes) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history"
        WHERE "status" = 'completed' AND LOWER("torrentHash") = ANY($1::text[])`,
      [hashes.map((h) => h.toLowerCase())]
    );
    return rows;
  }
  /** `download-clients.service.ts:245,327` — latest row for an exact hash. */
  async findLatestByTorrentHash(torrentHash) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history" WHERE "torrentHash" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [torrentHash]
    );
    return rows[0] ?? null;
  }
  /** `download-clients.service.ts:260,343` — latest row for an exact source title, hash-lookup fallback. */
  async findLatestBySourceTitle(sourceTitle) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS4} FROM "download_history" WHERE "sourceTitle" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [sourceTitle]
    );
    return rows[0] ?? null;
  }
  /** `auto-grab-pipeline.service.ts:268`, `completion.service.ts:249`, `movie-download.service.ts:331,574`,
   *  `episode-download.service.ts:358,651,756,874`, `download-clients.service.ts:297` — every grab/link
   *  INSERT funnels through the same column set (`grab-history.util.ts`'s `buildGrabHistoryRow` shape). */
  async insertGrab(input) {
    const { rows } = await this.pool.query(
      `INSERT INTO "download_history"
         ("sourceTitle", "quality", "language", "torrentHash", "grabSource",
          "mediaId", "episodeId", "seasonId", "indexerId", "downloadClientId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${COLUMNS4}`,
      [
        input.sourceTitle,
        input.quality,
        input.language ?? null,
        input.torrentHash ?? null,
        input.grabSource,
        input.mediaId,
        input.episodeId ?? null,
        input.seasonId ?? null,
        input.indexerId ?? null,
        input.downloadClientId ?? null
      ]
    );
    const row = rows[0];
    if (!row) throw new Error('insert into "download_history" returned no row');
    return row;
  }
  /** `completion.service.ts:389` — mark import started; leaves `statusMessage` untouched. */
  async markImporting(id) {
    await this.pool.query(`UPDATE "download_history" SET "status" = 'importing', "updatedAt" = now() WHERE "id" = $1`, [
      id
    ]);
  }
  /** `completion.service.ts:402,607,655,675,743`, `download-clients.service.ts:223`. */
  async markFailed(id, statusMessage) {
    await this.pool.query(
      `UPDATE "download_history" SET "status" = 'failed', "statusMessage" = $2, "updatedAt" = now() WHERE "id" = $1`,
      [id, statusMessage]
    );
  }
  /** `completion.service.ts:517,534,552` — bulk re-arm/flip by id array. */
  async updateStatusByIds(ids, status, statusMessage) {
    await this.pool.query(
      `UPDATE "download_history" SET "status" = $2, "statusMessage" = $3, "updatedAt" = now() WHERE "id" = ANY($1::int[])`,
      [ids, status, statusMessage]
    );
  }
  /** `completion.service.ts:113` — boot re-arm of every stranded `importing` row. */
  async resetStatus(fromStatus, toStatus) {
    await this.pool.query(`UPDATE "download_history" SET "status" = $2 WHERE "status" = $1`, [fromStatus, toStatus]);
  }
  /** `completion.service.ts:786` — 3 variants (bare, episode+season, season-only) collapse to one
   *  optional patch: omit it for a plain movie import, pass it (with `episodeId: null` for a season
   *  pack) once the imported files resolve to a season/episode. */
  async completeImport(id, patch) {
    if (!patch) {
      await this.pool.query(
        `UPDATE "download_history" SET "status" = 'completed', "updatedAt" = now() WHERE "id" = $1`,
        [id]
      );
      return;
    }
    await this.pool.query(
      `UPDATE "download_history"
         SET "status" = 'completed', "episodeId" = $2, "seasonId" = $3, "updatedAt" = now()
       WHERE "id" = $1`,
      [id, patch.episodeId, patch.seasonId]
    );
  }
  /** `download-clients.service.ts:364` — re-arm + optionally heal the torrent hash. */
  async reimport(id, torrentHash) {
    await this.pool.query(
      `UPDATE "download_history"
         SET "torrentHash" = $2, "status" = 'grabbed', "statusMessage" = NULL, "updatedAt" = now()
       WHERE "id" = $1`,
      [id, torrentHash]
    );
  }
  /** `torrent-history-matcher.service.ts:138` (`healHash`) — self-heal a name-matched row's hash. */
  async updateTorrentHash(id, torrentHash) {
    await this.pool.query(`UPDATE "download_history" SET "torrentHash" = $2, "updatedAt" = now() WHERE "id" = $1`, [
      id,
      torrentHash
    ]);
  }
  /** `completion.service.ts:246` — heal an orphan row once its real media/episode/season/quality is known. */
  async healMatch(id, patch) {
    await this.pool.query(
      `UPDATE "download_history"
         SET "mediaId" = $2, "episodeId" = $3, "seasonId" = $4, "quality" = $5, "updatedAt" = now()
       WHERE "id" = $1`,
      [id, patch.mediaId, patch.episodeId, patch.seasonId, patch.quality]
    );
  }
};

// src/db/repositories/blocklist.repository.ts
var COLUMNS5 = `"id", "sourceTitle", "indexerName", "downloadUrl", "quality", "note",
  "indexerId", "mediaId", "userId", "createdAt", "updatedAt"`;
var BlocklistRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /** `blocklist.service.ts:20-35` (`create`) and `:40-51` (`createFromHistory`) — same INSERT shape. */
  async insert(input) {
    const { rows } = await this.pool.query(
      `INSERT INTO "blocklist"
         ("sourceTitle", "indexerId", "indexerName", "downloadUrl", "quality", "mediaId", "note", "userId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${COLUMNS5}`,
      [
        input.sourceTitle,
        input.indexerId ?? null,
        input.indexerName ?? null,
        input.downloadUrl ?? null,
        input.quality ?? null,
        input.mediaId ?? null,
        input.note ?? null,
        input.userId ?? null
      ]
    );
    const row = rows[0];
    if (!row) throw new Error('insert into "blocklist" returned no row');
    return row;
  }
  /** `blocklist.service.ts:57` (`findAll`) — paginated admin list, newest first. */
  async list(limit, offset) {
    const [itemsResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT ${COLUMNS5} FROM "blocklist" ORDER BY "createdAt" DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      this.pool.query(`SELECT COUNT(*)::text AS "count" FROM "blocklist"`)
    ]);
    return { items: itemsResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
  }
  /** `blocklist.service.ts:65-70` (`isBlocked`) — case-insensitive exact match, not a substring search. */
  async isBlocked(sourceTitle) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::text AS "count" FROM "blocklist" WHERE LOWER("sourceTitle") = LOWER($1)`,
      [sourceTitle]
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }
  /** `blocklist.service.ts:73` — looked up before `remove` to 404 on a missing id. */
  async findById(id) {
    const { rows } = await this.pool.query(`SELECT ${COLUMNS5} FROM "blocklist" WHERE "id" = $1`, [id]);
    return rows[0] ?? null;
  }
  /** `blocklist.service.ts:73-76`. */
  async remove(id) {
    await this.pool.query(`DELETE FROM "blocklist" WHERE "id" = $1`, [id]);
  }
  /** `blocklist.service.ts:79-81` (`clear`) — admin "clear all". */
  async clear() {
    await this.pool.query(`DELETE FROM "blocklist"`);
  }
};

// src/db/repositories/stalled-checks.repository.ts
var COLUMNS6 = `"id", "torrentHash", "downloadedBytes", "checkedAt"`;
var StalledChecksRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /** `completion.service.ts:1080` — one byte-count snapshot per check tick.
   *  `downloadedBytes` is a JS `number`; see `pool.ts` for the OID 20 (`bigint`) type parser
   *  that makes the round trip lossless above 2^31. */
  async insert(torrentHash, downloadedBytes) {
    const { rows } = await this.pool.query(
      `INSERT INTO "stalled_checks" ("torrentHash", "downloadedBytes") VALUES ($1, $2) RETURNING ${COLUMNS6}`,
      [torrentHash, downloadedBytes]
    );
    const row = rows[0];
    if (!row) throw new Error('insert into "stalled_checks" returned no row');
    return row;
  }
  /** `completion.service.ts:1070` — latest snapshot, to gate on the configured check interval. */
  async findLatest(torrentHash) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS6} FROM "stalled_checks" WHERE "torrentHash" = $1 ORDER BY "checkedAt" DESC LIMIT 1`,
      [torrentHash]
    );
    return rows[0] ?? null;
  }
  /** `completion.service.ts:1088` — last N snapshots for one hash, newest first, feeds the stall-strike count. */
  async findRecent(torrentHash, limit) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS6} FROM "stalled_checks" WHERE "torrentHash" = $1 ORDER BY "checkedAt" DESC LIMIT $2`,
      [torrentHash, limit]
    );
    return rows;
  }
  /** `download-clients.service.ts:509` (`annotateStalledStrikes`) — bulk fetch across many hashes at once. */
  async findRecentForHashes(hashes) {
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS6} FROM "stalled_checks" WHERE "torrentHash" = ANY($1::text[]) ORDER BY "checkedAt" DESC`,
      [hashes]
    );
    return rows;
  }
  /** `completion.service.ts:1012` — right after the torrent is removed from the client + blocklisted. */
  async deleteByHash(torrentHash) {
    await this.pool.query(`DELETE FROM "stalled_checks" WHERE "torrentHash" = $1`, [torrentHash]);
  }
  /** `completion.service.ts:1109` (`pruneOldStalledChecks`) — deletes rows older than the cutoff,
   *  returns how many. */
  async pruneOlderThan(cutoff) {
    const result = await this.pool.query(`DELETE FROM "stalled_checks" WHERE "checkedAt" < $1`, [cutoff]);
    return result.rowCount ?? 0;
  }
};

// src/db/repositories/index.ts
function createRepositories(pool) {
  return {
    indexers: new IndexersRepository(pool),
    indexerStats: new IndexerStatsRepository(pool),
    downloadClients: new DownloadClientsRepository(pool),
    downloadHistory: new DownloadHistoryRepository(pool),
    blocklist: new BlocklistRepository(pool),
    stalledChecks: new StalledChecksRepository(pool)
  };
}

// src/indexers/decode-html-entities.ts
var HTML_NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  quot: '"',
  nbsp: " ",
  iexcl: "\xA1",
  cent: "\xA2",
  pound: "\xA3",
  yen: "\xA5",
  sect: "\xA7",
  copy: "\xA9",
  reg: "\xAE",
  deg: "\xB0",
  plusmn: "\xB1",
  sup2: "\xB2",
  sup3: "\xB3",
  micro: "\xB5",
  para: "\xB6",
  middot: "\xB7",
  sup1: "\xB9",
  frac14: "\xBC",
  frac12: "\xBD",
  frac34: "\xBE",
  iquest: "\xBF",
  Agrave: "\xC0",
  Aacute: "\xC1",
  Acirc: "\xC2",
  Atilde: "\xC3",
  Auml: "\xC4",
  Aring: "\xC5",
  AElig: "\xC6",
  Ccedil: "\xC7",
  Egrave: "\xC8",
  Eacute: "\xC9",
  Ecirc: "\xCA",
  Euml: "\xCB",
  Igrave: "\xCC",
  Iacute: "\xCD",
  Icirc: "\xCE",
  Iuml: "\xCF",
  ETH: "\xD0",
  Ntilde: "\xD1",
  Ograve: "\xD2",
  Oacute: "\xD3",
  Ocirc: "\xD4",
  Otilde: "\xD5",
  Ouml: "\xD6",
  Oslash: "\xD8",
  Ugrave: "\xD9",
  Uacute: "\xDA",
  Ucirc: "\xDB",
  Uuml: "\xDC",
  Yacute: "\xDD",
  THORN: "\xDE",
  szlig: "\xDF",
  agrave: "\xE0",
  aacute: "\xE1",
  acirc: "\xE2",
  atilde: "\xE3",
  auml: "\xE4",
  aring: "\xE5",
  aelig: "\xE6",
  ccedil: "\xE7",
  egrave: "\xE8",
  eacute: "\xE9",
  ecirc: "\xEA",
  euml: "\xEB",
  igrave: "\xEC",
  iacute: "\xED",
  icirc: "\xEE",
  iuml: "\xEF",
  eth: "\xF0",
  ntilde: "\xF1",
  ograve: "\xF2",
  oacute: "\xF3",
  ocirc: "\xF4",
  otilde: "\xF5",
  ouml: "\xF6",
  oslash: "\xF8",
  ugrave: "\xF9",
  uacute: "\xFA",
  ucirc: "\xFB",
  uuml: "\xFC",
  yacute: "\xFD",
  thorn: "\xFE",
  yuml: "\xFF",
  OElig: "\u0152",
  oelig: "\u0153",
  Scaron: "\u0160",
  scaron: "\u0161",
  Yuml: "\u0178",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquo: "\u2018",
  rsquo: "\u2019",
  bdquo: "\u201E",
  hellip: "\u2026",
  ndash: "\u2013",
  mdash: "\u2014",
  trade: "\u2122",
  euro: "\u20AC"
};
function decodeHtmlEntities(s) {
  return s.replace(/&(?:#(x?)([0-9a-fA-F]+)|([a-zA-Z]+));/g, (raw, hex, num, name) => {
    if (num) {
      const code = parseInt(num, hex === "x" ? 16 : 10);
      if (isFinite(code) && code > 0) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return raw;
        }
      }
      return raw;
    }
    return HTML_NAMED_ENTITIES[name] ?? raw;
  });
}

// src/indexers/torznab-parse.ts
function buildTorznabQuery(opts) {
  const parts = [`t=${opts.t}`];
  if (opts.q) parts.push(`q=${encodeURIComponent(opts.q)}`);
  if (opts.season != null) parts.push(`season=${opts.season}`);
  if (opts.ep != null) parts.push(`ep=${opts.ep}`);
  parts.push(`cat=${opts.cat}`);
  parts.push(`apikey=${encodeURIComponent(opts.apiKey)}`);
  if (opts.tvdbId) parts.push(`tvdbid=${opts.tvdbId}`);
  if (opts.imdbId) {
    const stripped = opts.imdbId.replace(/^tt/i, "");
    if (stripped) parts.push(`imdbid=${stripped}`);
  }
  if (opts.tmdbId) parts.push(`tmdbid=${opts.tmdbId}`);
  return parts.join("&");
}
function describeTorznabQuery(url) {
  let params;
  try {
    params = new URL(url).searchParams;
  } catch {
    return "search";
  }
  const parts = [params.get("t") ?? "search"];
  const q = params.get("q");
  if (q) parts.push(`q="${q}"`);
  for (const key of ["season", "ep", "cat", "tvdbid", "imdbid", "tmdbid"]) {
    const value = params.get(key);
    if (value) parts.push(`${key}=${value}`);
  }
  return parts.join(" ");
}
function extractInnerXml(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const inner = block.match(re)?.[1];
  if (inner === void 0) return null;
  return decodeHtmlEntities(inner.replace(/<!\[CDATA\[|\]\]>/g, "").trim());
}
function torznabAttr(block, name) {
  const re = new RegExp(`<torznab:attr[^>]+name="${name}"[^>]+value="([^"]*)"`, "i");
  return block.match(re)?.[1]?.trim() ?? null;
}
function ensureApiKey(url, apiKey) {
  if (!apiKey || url.startsWith("magnet:")) return url;
  try {
    const u = new URL(decodeHtmlEntities(url));
    u.searchParams.set("apikey", apiKey);
    return u.toString();
  } catch {
    return url;
  }
}
function parseTorznabItems(xml, indexer) {
  const settings = indexer.settings;
  const apiKey = String(settings.apiKey || "");
  const out = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1] ?? "";
    const title = extractInnerXml(block, "title");
    const link = extractInnerXml(block, "link");
    const magnetMatch = block.match(/name="magneturl"\s+value="([^"]*)"/i) ?? block.match(/name='magneturl'\s+value='([^']*)'/i);
    const magnetRaw = magnetMatch?.[1];
    const magnet = magnetRaw ? decodeHtmlEntities(magnetRaw.trim()) : void 0;
    const enc = block.match(/<enclosure[^>]*\surl="([^"]+)"/i);
    const encUrlRaw = enc?.[1];
    const encUrl = encUrlRaw ? decodeHtmlEntities(encUrlRaw.trim()) : void 0;
    const url = magnet || (link?.startsWith("magnet:") ? link : null) || encUrl || (link && !link.startsWith("http://localhost") ? link : null);
    if (!title || !url) continue;
    const encLen = enc?.[0]?.match(/\blength="(\d+)"/i)?.[1];
    const sizeStr = encLen ?? torznabAttr(block, "size") ?? extractInnerXml(block, "size");
    const size = sizeStr ? parseInt(sizeStr, 10) || 0 : 0;
    const seeders = parseInt(torznabAttr(block, "seeders") ?? "0", 10) || 0;
    const leechers = parseInt(torznabAttr(block, "leechers") ?? torznabAttr(block, "peers") ?? "0", 10) || 0;
    const dvfStr = torznabAttr(block, "downloadvolumefactor");
    const downloadVolumeFactor = dvfStr !== null ? parseFloat(dvfStr) : 1;
    const freeleech = downloadVolumeFactor === 0;
    const pubDateRaw = extractInnerXml(block, "pubDate");
    let publishDate = null;
    if (pubDateRaw) {
      const d = new Date(pubDateRaw);
      if (!isNaN(d.getTime())) publishDate = d.toISOString();
    }
    out.push({
      title,
      downloadUrl: ensureApiKey(url, apiKey),
      indexerId: indexer.id,
      indexerName: indexer.name,
      size,
      seeders,
      leechers,
      publishDate,
      freeleech,
      downloadVolumeFactor
    });
  }
  return out;
}

// src/indexers/torznab.ts
var USER_AGENT = "Fliks/1.0";
var TorznabHttpError = class extends Error {
  constructor(status, retryAfter) {
    super(`HTTP ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
};
async function fetchText(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": USER_AGENT } });
    const body = await res.text();
    if (opts.validateStatus && !opts.validateStatus(res.status)) {
      throw new TorznabHttpError(res.status, res.headers.get("retry-after"));
    }
    return { status: res.status, body, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}
var TorznabClient = class {
  constructor(deps) {
    this.deps = deps;
  }
  /** Drops indexers currently serving a failure / Retry-After cooldown from a
   *  search fan-out. Without this, the throttle would sleep the next queued
   *  call out for the full backoff (up to 6h) before firing — stalling a whole
   *  `Promise.all`/`Promise.allSettled` fan-out, and an interactive search with
   *  it, behind one broken host. A cooled indexer rejoins automatically once
   *  its cooldown lapses; a healthy one queried seconds ago is never skipped. */
  filterReadyIndexers(indexers) {
    const ready = [];
    const skipped = [];
    for (const ix of indexers) {
      const remainingMs = this.deps.throttle.cooldownRemainingMs(ix.id);
      if (remainingMs > 0) {
        skipped.push(`${ix.name} (${Math.ceil(remainingMs / 1e3)}s)`);
      } else {
        ready.push(ix);
      }
    }
    if (skipped.length) {
      log.info(`skipping ${skipped.length} indexer(s) in cooldown: ${skipped.join(", ")}`);
    }
    return ready;
  }
  /** Detects Retry-After-bearing statuses (429, 503) and feeds the header to
   *  the throttle. Returns true when the failure was rate-limit-shaped. */
  maybeHandleRateLimit(indexer, e) {
    if (!(e instanceof TorznabHttpError)) return false;
    if (e.status === 429 || e.status === 503) {
      this.deps.throttle.setRetryAfter(indexer, e.retryAfter ?? void 0);
      return true;
    }
    return false;
  }
  /** Calls `t=caps` and persists the result, resetting `capsSearchFallback` so a
   *  reconfigured indexer gets a clean slate. Runs regardless of enabled/enableSearch
   *  so a freshly (re)configured indexer always gets caps before an admin flips it on. */
  async refreshCaps(indexer) {
    const target = this.resolveEndpoint(indexer);
    if (!target) return;
    const { baseUrl, apiKey } = target;
    let res;
    try {
      res = await this.deps.throttle.run(
        indexer,
        () => fetchText(`${baseUrl}?t=caps&apikey=${encodeURIComponent(apiKey)}`, {
          timeoutMs: 1e4,
          // Without this a 429 or a 5xx reads as a valid answer, and the probe records
          // "supports neither" from a body the tracker never sent.
          validateStatus: (status) => status >= 200 && status < 400
        })
      );
    } catch (e) {
      this.maybeHandleRateLimit(indexer, e);
      this.deps.throttle.notifyFailure(indexer, e.message);
      log.warn(`[${indexer.name}] caps fetch failed: ${e.message}`);
      return;
    }
    const torznabError = this.torznabError(res.body);
    if (torznabError) {
      this.deps.throttle.notifyFailure(indexer, torznabError);
      log.warn(`[${indexer.name}] caps refused: ${torznabError}`);
      return;
    }
    const capsMovieSearch = /<movie-search\s[^>]*available="yes"/i.test(res.body);
    const capsTvSearch = /<tv-search\s[^>]*available="yes"/i.test(res.body);
    log.info(`[${indexer.name}] caps refreshed \u2014 movieSearch=${capsMovieSearch}, tvSearch=${capsTvSearch}`);
    await this.deps.repo.refreshCaps(indexer.id, { capsMovieSearch, capsTvSearch, capsSearchFallback: false });
    indexer.capsMovieSearch = capsMovieSearch;
    indexer.capsTvSearch = capsTvSearch;
    indexer.capsSearchFallback = false;
    indexer.capsProbedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  /**
   * Probes on first use: an indexer whose only probe failed would otherwise stay on
   * text-only search for good, since nothing else ever asks again. False means the probe
   * left it cooling down — searching now would just sleep out the cooldown.
   */
  async ensureCapsProbed(indexer) {
    if (indexer.capsProbedAt) return true;
    if (this.deps.throttle.cooldownRemainingMs(indexer.id) > 0) return true;
    await this.refreshCaps(indexer);
    return this.deps.throttle.cooldownRemainingMs(indexer.id) === 0;
  }
  /** The endpoint for this indexer, independent of enabled/enableRss/enableSearch —
   *  each caller applies its own gate. Null means unresolvable. */
  resolveEndpoint(indexer) {
    const settings = indexer.settings;
    const implementation = indexer.implementation || "";
    if (!implementation.toLowerCase().includes("torznab")) {
      log.info(`[${indexer.name}] skipped \u2014 implementation "${indexer.implementation}" is not Torznab`);
      return null;
    }
    const baseUrl = String(settings.baseUrl || "").replace(/\/$/, "");
    if (!baseUrl) {
      log.warn(`Indexer "${indexer.name}" has no baseUrl`);
      return null;
    }
    return { baseUrl, apiKey: String(settings.apiKey || "") };
  }
  /** Gates a search call on enabled/enableSearch, then resolves the endpoint. */
  resolveSearchTarget(indexer) {
    if (!indexer.enabled) {
      log.info(`[${indexer.name}] skipped \u2014 indexer disabled`);
      return null;
    }
    if (!indexer.enableSearch) {
      log.info(`[${indexer.name}] skipped \u2014 search disabled`);
      return null;
    }
    return this.resolveEndpoint(indexer);
  }
  /** A Torznab error arrives as a 200 with an `<error>` element — an invalid key looks
   *  exactly like a successful empty response otherwise. */
  torznabError(body) {
    if (!/<error\s+code=/i.test(body)) return null;
    return body.match(/description="([^"]*)"/i)?.[1]?.trim() || "Torznab error";
  }
  /** Executes a Torznab search URL. Returns results and the Torznab error message, if any. */
  async execSearch(url, queryType, indexer) {
    const query = describeTorznabQuery(url);
    const start = Date.now();
    try {
      const res = await this.deps.throttle.run(
        indexer,
        () => fetchText(url, { timeoutMs: 9e4, validateStatus: (s) => s >= 200 && s < 400 })
      );
      const torznabError = this.torznabError(res.body);
      if (torznabError) {
        const msg = torznabError;
        void this.deps.stats.record({
          indexerId: indexer.id,
          queryType,
          responseTimeMs: Date.now() - start,
          resultCount: 0,
          errorMessage: msg
        });
        log.warn(`[${indexer.name}] ${query} \u2192 ${msg}`);
        return { results: [], torznabError: msg };
      }
      const results = parseTorznabItems(res.body, indexer);
      void this.deps.stats.record({
        indexerId: indexer.id,
        queryType,
        responseTimeMs: Date.now() - start,
        resultCount: results.length,
        errorMessage: null
      });
      log.info(`[${indexer.name}] ${query} \u2192 ${results.length} result(s) in ${Date.now() - start}ms`);
      return { results, torznabError: null };
    } catch (e) {
      this.maybeHandleRateLimit(indexer, e);
      this.deps.throttle.notifyFailure(indexer, e.message);
      const msg = e.message;
      void this.deps.stats.record({
        indexerId: indexer.id,
        queryType,
        responseTimeMs: Date.now() - start,
        resultCount: 0,
        errorMessage: msg
      });
      log.warn(`[${indexer.name}] ${query} failed: ${msg}`);
      return { results: [], torznabError: msg };
    }
  }
  /** If caps claimed typed-search support but it failed, retry with `t=search`. On
   *  success, persists `capsSearchFallback=true` so future calls skip the caps check. */
  async retryWithSearchFallback(indexer, fallbackUrl, queryType) {
    const { results, torznabError } = await this.execSearch(fallbackUrl, queryType, indexer);
    if (torznabError) return [];
    log.info(`[${indexer.name}] t=search fallback succeeded \u2014 saving capsSearchFallback=true`);
    void this.deps.repo.markSearchFallback(indexer.id).catch((e) => {
      log.warn(`[${indexer.name}] could not persist the search fallback: ${String(e)}`);
    });
    indexer.capsSearchFallback = true;
    return results;
  }
  /** Calls `t=caps` to validate a URL/API key pair before an indexer row exists. No
   *  throttle key to use yet — fired sporadically from the UI, safe to bypass the queue. */
  async testConnection(baseUrl, apiKey) {
    const base = String(baseUrl || "").replace(/\/$/, "");
    if (!base) {
      return { ok: false, messageKey: "download.indexers.test.base_url_missing" };
    }
    const url = `${base}?t=caps&apikey=${encodeURIComponent(apiKey || "")}`;
    try {
      const res = await fetchText(url, { timeoutMs: 3e4 });
      if (res.status >= 400) {
        return { ok: false, messageKey: "download.indexers.test.http_error", detail: String(res.status) };
      }
      if (/<error\s+code=/i.test(res.body)) {
        const detail = res.body.match(/description="([^"]*)"/i)?.[1]?.trim();
        return { ok: false, messageKey: "download.indexers.test.torznab_error", detail };
      }
      if (!/<caps/i.test(res.body)) {
        return { ok: false, messageKey: "download.indexers.test.unexpected_response" };
      }
      return { ok: true, messageKey: "download.indexers.test.ok" };
    } catch (e) {
      return { ok: false, messageKey: "download.indexers.test.network_error", detail: e.message };
    }
  }
  /** RSS feed fetch — `t=search` with no query returns recent releases. */
  async rssSearch(indexer) {
    if (!indexer.enabled || !indexer.enableRss) return [];
    const target = this.resolveEndpoint(indexer);
    if (!target) return [];
    const { baseUrl, apiKey } = target;
    const url = `${baseUrl}?t=search&q=&cat=2000&apikey=${encodeURIComponent(apiKey)}`;
    const start = Date.now();
    try {
      const res = await this.deps.throttle.run(
        indexer,
        () => fetchText(url, { timeoutMs: 6e4, validateStatus: (s) => s >= 200 && s < 400 })
      );
      const results = parseTorznabItems(res.body, indexer);
      void this.deps.stats.record({
        indexerId: indexer.id,
        queryType: "rss",
        responseTimeMs: Date.now() - start,
        resultCount: results.length,
        errorMessage: null
      });
      return results;
    } catch (e) {
      this.maybeHandleRateLimit(indexer, e);
      this.deps.throttle.notifyFailure(indexer, e.message);
      void this.deps.stats.record({
        indexerId: indexer.id,
        queryType: "rss",
        responseTimeMs: Date.now() - start,
        resultCount: 0,
        errorMessage: e.message
      });
      log.warn(`RSS sync failed for "${indexer.name}": ${e.message}`);
      return [];
    }
  }
  /** Searches for a season pack (no episode number → indexer returns whole-season packs). */
  async searchSeasonPack(indexer, showTitle, season, externalIds) {
    const target = this.resolveSearchTarget(indexer);
    if (!target) return [];
    const { baseUrl, apiKey } = target;
    if (!await this.ensureCapsProbed(indexer)) return [];
    const useTvSearch = indexer.capsTvSearch && !indexer.capsSearchFallback;
    const searchQ = useTvSearch ? showTitle : `${showTitle} S${String(season).padStart(2, "0")}`;
    const typedUrl = `${baseUrl}?${buildTorznabQuery({
      t: useTvSearch ? "tvsearch" : "search",
      q: searchQ,
      season: useTvSearch ? season : void 0,
      cat: "5000",
      apiKey,
      tvdbId: useTvSearch ? externalIds?.tvdbId : void 0,
      imdbId: useTvSearch ? externalIds?.imdbId : void 0
    })}`;
    const { results, torznabError } = await this.execSearch(typedUrl, "season", indexer);
    if (!torznabError) return results;
    if (useTvSearch) {
      log.warn(`[${indexer.name}] tvsearch failed (${torznabError}), falling back to t=search`);
      const fallbackQ = `${showTitle} S${String(season).padStart(2, "0")}`;
      return this.retryWithSearchFallback(
        indexer,
        `${baseUrl}?${buildTorznabQuery({ t: "search", q: fallbackQ, cat: "5000", apiKey })}`,
        "season"
      );
    }
    return [];
  }
  async searchSeries(indexer, showTitle, season, episode, externalIds) {
    const target = this.resolveSearchTarget(indexer);
    if (!target) return [];
    const { baseUrl, apiKey } = target;
    if (!await this.ensureCapsProbed(indexer)) return [];
    const useTvSearch = indexer.capsTvSearch && !indexer.capsSearchFallback;
    const searchQ = useTvSearch ? showTitle : `${showTitle} S${String(season).padStart(2, "0")}`;
    const typedUrl = `${baseUrl}?${buildTorznabQuery({
      t: useTvSearch ? "tvsearch" : "search",
      q: searchQ,
      season: useTvSearch ? season : void 0,
      ep: useTvSearch ? episode : void 0,
      cat: "5000",
      apiKey,
      tvdbId: useTvSearch ? externalIds?.tvdbId : void 0,
      imdbId: useTvSearch ? externalIds?.imdbId : void 0
    })}`;
    const { results, torznabError } = await this.execSearch(typedUrl, "tvsearch", indexer);
    if (!torznabError) return results;
    if (useTvSearch) {
      log.warn(`[${indexer.name}] tvsearch failed (${torznabError}), falling back to t=search`);
      const fallbackQ = `${showTitle} S${String(season).padStart(2, "0")}`;
      return this.retryWithSearchFallback(
        indexer,
        `${baseUrl}?${buildTorznabQuery({ t: "search", q: fallbackQ, cat: "5000", apiKey })}`,
        "tvsearch"
      );
    }
    return [];
  }
  async searchMovie(indexer, query, externalIds) {
    const target = this.resolveSearchTarget(indexer);
    if (!target) return [];
    const { baseUrl, apiKey } = target;
    if (!await this.ensureCapsProbed(indexer)) return [];
    const useMovieSearch = indexer.capsMovieSearch && !indexer.capsSearchFallback && !!(externalIds?.imdbId || externalIds?.tmdbId);
    const typedUrl = `${baseUrl}?${buildTorznabQuery({
      t: useMovieSearch ? "movie" : "search",
      q: query,
      cat: "2000",
      apiKey,
      imdbId: useMovieSearch ? externalIds?.imdbId : void 0,
      tmdbId: useMovieSearch ? externalIds?.tmdbId : void 0
    })}`;
    const { results, torznabError } = await this.execSearch(typedUrl, "search", indexer);
    if (!torznabError) return results;
    if (useMovieSearch) {
      log.warn(`[${indexer.name}] t=movie failed (${torznabError}), falling back to t=search`);
      return this.retryWithSearchFallback(
        indexer,
        `${baseUrl}?${buildTorznabQuery({ t: "search", q: query, cat: "2000", apiKey })}`,
        "search"
      );
    }
    log.warn(`[${indexer.name}] search failed: ${torznabError}`);
    return [];
  }
};

// src/indexers/throttle.ts
var IndexerThrottle = class {
  /** Tail of the per-indexer promise chain. Awaiting it serialises the next
   *  operation behind all currently-queued ones. */
  chains = /* @__PURE__ */ new Map();
  /** Earliest wall-clock ms a new request to this indexer may start. Updated
   *  post-request (current + delay) AND on Retry-After (current + window). */
  nextAllowedAt = /* @__PURE__ */ new Map();
  /** Consecutive failure count — drives progressive cooldown. */
  failureCount = /* @__PURE__ */ new Map();
  /** Earliest ms a *penalised* indexer may be retried — written only by
   *  failure backoff and Retry-After, never by routine spacing. Lets a
   *  caller skip a backing-off indexer instead of queueing behind it. */
  cooldownUntil = /* @__PURE__ */ new Map();
  /** Queue `fn` against `indexer`. Rejections propagate untouched to the
   *  caller; failure metadata is still recorded for backoff. */
  async run(indexer, fn) {
    const prev = this.chains.get(indexer.id) ?? Promise.resolve();
    const current = prev.then(() => this.runOne(indexer, fn));
    this.chains.set(indexer.id, current.catch(() => void 0));
    return current;
  }
  async runOne(indexer, fn) {
    const delayMs = Math.max(0, indexer.requestDelay ?? 2) * 1e3;
    const earliest = this.nextAllowedAt.get(indexer.id) ?? 0;
    const wait = earliest - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const result = await fn();
      this.notifySuccess(indexer.id);
      this.nextAllowedAt.set(indexer.id, Date.now() + delayMs);
      return result;
    } catch (e) {
      this.nextAllowedAt.set(indexer.id, Date.now() + delayMs);
      throw e;
    }
  }
  /** Honour a `Retry-After` value (seconds OR an absolute date). */
  setRetryAfter(indexer, headerValue) {
    const ms = parseRetryAfter(headerValue);
    if (ms <= 0) return;
    this.bumpCooldown(indexer.id, Date.now() + ms, {
      reason: "rate-limit",
      detail: headerValue?.trim()
    });
    log.warn(`[${indexer.name}] Retry-After honoured \u2014 next request in ${Math.round(ms / 1e3)}s`);
  }
  /** Caller signals a transport-level failure. Escalates one step per elapsed
   *  window: failures inside an open cooldown belong to the outage that
   *  opened it, so the ladder tracks downtime, not request volume. */
  notifyFailure(indexer, detail) {
    if (this.cooldownRemainingMs(indexer.id) > 0) return;
    const n = (this.failureCount.get(indexer.id) ?? 0) + 1;
    this.failureCount.set(indexer.id, n);
    const cooldownMs = backoffFor(n);
    if (cooldownMs <= 0) return;
    this.bumpCooldown(indexer.id, Date.now() + cooldownMs, {
      reason: "failures",
      failureCount: n,
      detail
    });
    log.warn(`[${indexer.name}] consecutive failure #${n} \u2014 cooldown ${Math.round(cooldownMs / 1e3)}s`);
  }
  /** Reset the backoff state for an indexer on confirmed success. */
  notifySuccess(indexerId) {
    this.failureCount.delete(indexerId);
    this.cooldownUntil.delete(indexerId);
  }
  /** Remaining failure / Retry-After cooldown, in ms (0 when ready). Routine
   *  request-delay spacing is excluded — a healthy indexer queried seconds
   *  ago still reads as ready. */
  cooldownRemainingMs(indexerId) {
    const until = this.cooldownUntil.get(indexerId)?.until ?? 0;
    return Math.max(0, until - Date.now());
  }
  /** The live cooldown for an indexer, or null when it's ready. */
  getCooldown(indexerId) {
    const entry = this.cooldownUntil.get(indexerId);
    if (!entry || entry.until <= Date.now()) return null;
    return entry;
  }
  /** Lift a penalty window, including the queue gate `bumpCooldown` also
   *  pushed — otherwise the next request would sleep out the window this
   *  claims to have cancelled. Returns false when there was nothing to lift. */
  clearCooldown(indexerId) {
    const had = this.cooldownRemainingMs(indexerId) > 0;
    this.cooldownUntil.delete(indexerId);
    this.failureCount.delete(indexerId);
    this.nextAllowedAt.delete(indexerId);
    return had;
  }
  /** Lift every penalty window. Returns how many indexers were in cooldown. */
  clearAllCooldowns() {
    let cleared = 0;
    for (const id of [...this.cooldownUntil.keys()]) {
      if (this.clearCooldown(id)) cleared++;
    }
    return cleared;
  }
  /** Bumps both the queue's earliest-start gate and the skip gate.
   *  Monotonic — only ever extends the window, never shortens it. */
  bumpCooldown(indexerId, until, info) {
    const curNext = this.nextAllowedAt.get(indexerId) ?? 0;
    if (until > curNext) this.nextAllowedAt.set(indexerId, until);
    const curCooldown = this.cooldownUntil.get(indexerId)?.until ?? 0;
    if (until > curCooldown) {
      this.cooldownUntil.set(indexerId, { until, ...info });
    }
  }
};
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms).unref());
}
function parseRetryAfter(value) {
  if (!value) return 0;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) * 1e3;
  }
  const ts = Date.parse(trimmed);
  if (!isNaN(ts)) {
    return Math.max(0, ts - Date.now());
  }
  return 0;
}
function backoffFor(failureCount) {
  const steps = [
    3e4,
    // 1st failure → 30s
    2 * 6e4,
    // 2nd → 2 min
    15 * 6e4,
    // 3rd → 15 min
    60 * 6e4,
    // 4th → 1 h
    6 * 60 * 6e4
    // 5th+ → 6 h
  ];
  return steps[Math.min(failureCount, steps.length) - 1] ?? 0;
}

// src/indexers/types.ts
var IndexerNotFoundError = class extends Error {
};
var UnknownIndexerImplementationError = class extends Error {
};

// src/indexers/service.ts
function redactApiKey(ix) {
  const settings = { ...ix.settings ?? {} };
  delete settings.apiKey;
  return { ...ix, settings };
}
var IndexerService = class {
  constructor(deps) {
    this.deps = deps;
  }
  /** `"torznab"` is the only implementation this plugin runs. Throws, naming the
   *  value, otherwise — reused by both create() and update(). */
  assertKnownImplementation(implementation) {
    if (implementation !== "torznab") {
      throw new UnknownIndexerImplementationError(`Unknown indexer implementation "${implementation}"`);
    }
  }
  async testConnection(input) {
    if (input.implementation !== "torznab") {
      return {
        ok: false,
        messageKey: "download.indexers.test.unknown_implementation",
        detail: input.implementation
      };
    }
    const baseUrl = String(input.settings?.baseUrl ?? "").trim();
    const apiKey = String(input.settings?.apiKey ?? "").trim();
    return this.deps.torznab.testConnection(baseUrl, apiKey);
  }
  sanitizeSettings(settings) {
    const out = { ...settings ?? {} };
    if ("minSeeders" in out) {
      out["minSeeders"] = Math.max(0, Math.floor(Number(out["minSeeders"]) || 0));
    }
    return out;
  }
  async create(input) {
    this.assertKnownImplementation(input.implementation);
    const saved = await this.deps.repo.insert({
      name: input.name,
      implementation: input.implementation,
      settings: this.sanitizeSettings(input.settings),
      enableRss: input.enableRss ?? true,
      enableSearch: input.enableSearch ?? true,
      priority: input.priority ?? 25,
      requestDelay: input.requestDelay ?? 2,
      enabled: input.enabled ?? true,
      capsMovieSearch: false,
      capsTvSearch: false,
      capsSearchFallback: false,
      capsProbedAt: null
    });
    void this.deps.torznab.refreshCaps(saved).catch((e) => log.warn(`caps refresh failed: ${String(e)}`));
    return this.redact(saved);
  }
  redact(ix) {
    return redactApiKey(ix);
  }
  /** Relies on the repository returning rows ordered by `priority ASC, id ASC`. */
  async findAll() {
    const rows = await this.deps.repo.findAll();
    return rows.map((ix) => {
      const cd = this.deps.throttle.getCooldown(ix.id);
      return {
        ...this.redact(ix),
        cooldown: cd ? {
          reason: cd.reason,
          remainingMs: Math.max(0, cd.until - Date.now()),
          until: new Date(cd.until).toISOString(),
          failureCount: cd.failureCount,
          detail: cd.detail
        } : null
      };
    });
  }
  /** Lifts the throttle window on one indexer. */
  async clearCooldown(id) {
    await this.findOne(id);
    return { cleared: this.deps.throttle.clearCooldown(id) };
  }
  /** Lifts every throttle window. */
  clearAllCooldowns() {
    return { cleared: this.deps.throttle.clearAllCooldowns() };
  }
  async findOne(id) {
    const ix = await this.deps.repo.findOne(id);
    if (!ix) throw new IndexerNotFoundError(`Indexer #${id} not found`);
    return ix;
  }
  async update(id, input) {
    const existing = await this.findOne(id);
    const patch = {};
    if (input.name !== void 0) patch.name = input.name;
    if (input.implementation !== void 0) {
      this.assertKnownImplementation(input.implementation);
      patch.implementation = input.implementation;
    }
    if (input.enableRss !== void 0) patch.enableRss = input.enableRss;
    if (input.enableSearch !== void 0) patch.enableSearch = input.enableSearch;
    if (input.priority !== void 0) patch.priority = input.priority;
    if (input.requestDelay !== void 0) patch.requestDelay = input.requestDelay;
    if (input.enabled !== void 0) patch.enabled = input.enabled;
    if (input.settings !== void 0) {
      const incoming = this.sanitizeSettings(input.settings);
      const existingApiKey = existing.settings?.apiKey;
      patch.settings = { ...incoming, apiKey: incoming.apiKey || existingApiKey };
    }
    const saved = await this.deps.repo.update(id, patch);
    void this.deps.torznab.refreshCaps(saved).catch((e) => log.warn(`caps refresh failed: ${String(e)}`));
    return this.redact(saved);
  }
  async remove(id) {
    await this.findOne(id);
    await this.deps.repo.remove(id);
  }
};

// src/download-clients/torrent-hash.ts
var crypto = __toESM(require("crypto"));
function extractMagnetInfoHash(magnet) {
  const hex = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})/)?.[1];
  if (hex) return hex.toLowerCase();
  const b32 = magnet.match(/xt=urn:btih:([A-Z2-7]{32})/i)?.[1];
  if (!b32) return void 0;
  const upper = b32.toUpperCase();
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out = Buffer.alloc(20);
  let idx = 0;
  for (const ch of upper) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return void 0;
    value = value << 5 | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out[idx++] = value >>> bits & 255;
    }
  }
  return out.toString("hex");
}
function bencodedEnd(buf, pos) {
  if (pos >= buf.length) return -1;
  const ch = buf[pos];
  if (ch === 105) {
    const e = buf.indexOf(101, pos + 1);
    return e === -1 ? -1 : e + 1;
  }
  if (ch === 108 || ch === 100) {
    let cur = pos + 1;
    while (cur < buf.length && buf[cur] !== 101) {
      cur = bencodedEnd(buf, cur);
      if (cur === -1) return -1;
    }
    return cur < buf.length ? cur + 1 : -1;
  }
  if (ch !== void 0 && ch >= 48 && ch <= 57) {
    const colon = buf.indexOf(58, pos);
    if (colon === -1) return -1;
    const len = parseInt(buf.subarray(pos, colon).toString("ascii"), 10);
    return colon + 1 + len;
  }
  return -1;
}
function computeInfoHash(buf) {
  const marker = Buffer.from("4:info");
  const idx = buf.indexOf(marker);
  if (idx === -1) return void 0;
  const start = idx + marker.length;
  if (start >= buf.length || buf[start] !== 100) return void 0;
  const end = bencodedEnd(buf, start);
  if (end === -1) return void 0;
  return crypto.createHash("sha1").update(buf.subarray(start, end)).digest("hex");
}

// src/download-clients/types.ts
var DownloadClientNotFoundError = class extends Error {
};
var UnsupportedDownloadClientError = class extends Error {
};
var DownloadClientUnreachableError = class extends Error {
};
var DownloadClientAuthError = class extends Error {
};
var DownloadClientHttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var TorrentAlreadyPresentError = class extends Error {
};
var TorrentHashUnresolvedError = class extends Error {
};
var BLOCK_REASON_KEY = "download.download_clients.block.reason";

// src/download-clients/qbittorrent-driver.ts
var USER_AGENT2 = "Fliks/1.0";
var sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
function buildBaseUrl(s) {
  let host2 = String(s.host || "").replace(/\/$/, "");
  if (!host2) return null;
  const protocol = s.useSsl ? "https" : "http";
  host2 = host2.replace(/^https?:\/\//i, "");
  const portFromHost = host2.match(/:(\d+)$/);
  if (portFromHost) host2 = host2.replace(/:\d+$/, "");
  const port = s.port || (portFromHost ? Number(portFromHost[1]) : void 0);
  return `${protocol}://${host2}${port ? `:${port}` : ""}`;
}
function sanitizeUrl(url) {
  return url.replace(/&amp;/g, "&");
}
async function httpRequest(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    return await fetch(url, {
      method: opts.method ?? "GET",
      headers: { "User-Agent": USER_AGENT2, ...opts.headers },
      body: opts.body,
      redirect: opts.redirect,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}
async function login(base, s, timeoutMs) {
  const form = new URLSearchParams({ username: s.username ?? "", password: s.password ?? "" });
  let res;
  try {
    res = await httpRequest(`${base}/api/v2/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      timeoutMs
    });
  } catch (e) {
    const cause = e.cause;
    throw new DownloadClientUnreachableError(`could not reach the download client: ${cause?.message ?? e.message}`);
  }
  const cookies = res.headers.getSetCookie();
  const body = await res.text();
  if (!cookies.length || body === "Fails.") {
    throw new DownloadClientAuthError("download client authentication failed");
  }
  return cookies.map((c) => c.split(";")[0]).join("; ");
}
async function parseJsonArray(res) {
  if (res.status !== 200) return null;
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return Array.isArray(parsed) ? parsed : null;
}
async function snapshotHashes(base, cookie) {
  try {
    const res = await httpRequest(`${base}/api/v2/torrents/info`, { headers: { Cookie: cookie }, timeoutMs: 6e4 });
    const parsed = await parseJsonArray(res);
    if (!parsed) return /* @__PURE__ */ new Set();
    return new Set(
      parsed.map((t) => t.hash?.toLowerCase()).filter((h) => !!h)
    );
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function recoverNewlyAddedHash(base, cookie, before) {
  const ATTEMPTS = 6;
  const DELAY_MS = 500;
  for (let i = 0; i < ATTEMPTS; i++) {
    await sleep2(DELAY_MS);
    const res = await httpRequest(`${base}/api/v2/torrents/info`, { headers: { Cookie: cookie }, timeoutMs: 6e4 });
    const parsed = await parseJsonArray(res);
    if (!parsed) continue;
    const after = parsed;
    const fresh = after.filter((t) => t.hash && !before.has(t.hash.toLowerCase()));
    if (fresh.length === 1) return fresh[0].hash.toLowerCase();
    if (fresh.length > 1) {
      fresh.sort((a, b) => (b.added_on ?? 0) - (a.added_on ?? 0));
      return fresh[0].hash.toLowerCase();
    }
  }
  return void 0;
}
async function fetchTorrentOrMagnet(startUrl, maxHops = 5) {
  let url = startUrl;
  for (let hop = 0; hop <= maxHops; hop++) {
    let res;
    try {
      res = await httpRequest(url, { timeoutMs: 3e4, redirect: "manual" });
    } catch (e) {
      const cause = e.cause;
      throw new DownloadClientUnreachableError(`could not fetch the torrent from the indexer: ${cause?.message ?? e.message}`);
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new DownloadClientHttpError(res.status, `indexer redirected without a Location header (HTTP ${res.status})`);
      if (location.startsWith("magnet:")) return { magnet: location };
      url = new URL(location, url).toString();
      continue;
    }
    if (res.status !== 200) {
      throw new DownloadClientHttpError(res.status, `indexer returned HTTP ${res.status} for the torrent download`);
    }
    return { buffer: Buffer.from(await res.arrayBuffer()) };
  }
  throw new Error(`indexer redirect chain exceeded ${maxHops} hops`);
}
async function addMagnet(base, cookie, magnetUrl, category) {
  const form = new URLSearchParams({ urls: magnetUrl });
  if (category) form.set("category", category);
  return httpRequest(`${base}/api/v2/torrents/add`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
    body: form,
    timeoutMs: 6e4
  });
}
async function addTorrentFile(base, cookie, buffer, category) {
  const fd = new FormData();
  fd.append("torrents", new Blob([buffer], { type: "application/x-bittorrent" }), "download.torrent");
  if (category) fd.append("category", category);
  return httpRequest(`${base}/api/v2/torrents/add`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: fd,
    timeoutMs: 6e4
  });
}
var QbittorrentDriver = class {
  supports(client) {
    if (!client.enabled) return false;
    return (client.implementation || "").toLowerCase().includes("qbittorrent");
  }
  async testConnection(settings) {
    const s = settings;
    const base = buildBaseUrl(s);
    if (!base) return { ok: false, messageKey: "download.download_clients.test.host_missing" };
    try {
      await login(base, s, 1e4);
      return { ok: true, messageKey: "download.download_clients.test.ok" };
    } catch (e) {
      if (e instanceof DownloadClientAuthError) {
        return { ok: false, messageKey: "download.download_clients.test.auth_failed" };
      }
      return { ok: false, messageKey: "download.download_clients.test.network_error", detail: e.message };
    }
  }
  async getTorrents(client) {
    return (await this.getTorrentsResult(client)).torrents;
  }
  async getTorrentsResult(client) {
    const s = client.settings;
    const base = buildBaseUrl(s);
    if (!base) return { ok: false, torrents: [] };
    let cookie;
    try {
      cookie = await login(base, s, 15e3);
    } catch (e) {
      log.warn(`getTorrentsResult: auth failed for client "${client.name}": ${e.message}`);
      return { ok: false, torrents: [] };
    }
    try {
      const category = String(s.category ?? "").trim();
      const qs = category ? `?category=${encodeURIComponent(category)}` : "";
      const res = await httpRequest(`${base}/api/v2/torrents/info${qs}`, { headers: { Cookie: cookie }, timeoutMs: 15e3 });
      const parsed = await parseJsonArray(res);
      if (!parsed) {
        log.warn(`getTorrentsResult: unexpected response from "${client.name}" (HTTP ${res.status})`);
        return { ok: false, torrents: [] };
      }
      const torrents = parsed.map((t) => ({
        ...t,
        name: t.name ? decodeHtmlEntities(t.name) : t.name,
        completion_on: Number.isFinite(Number(t.completion_on)) ? Number(t.completion_on) : void 0
      }));
      return { ok: true, torrents };
    } catch (e) {
      log.warn(`getTorrentsResult: error fetching torrents from "${client.name}": ${e.message}`);
      return { ok: false, torrents: [] };
    }
  }
  async getTorrentFiles(client, hash) {
    const s = client.settings;
    const base = buildBaseUrl(s);
    if (!base) return [];
    let cookie;
    try {
      cookie = await login(base, s, 15e3);
    } catch {
      return [];
    }
    try {
      const res = await httpRequest(`${base}/api/v2/torrents/files?hash=${encodeURIComponent(hash)}`, {
        headers: { Cookie: cookie },
        timeoutMs: 15e3
      });
      const parsed = await parseJsonArray(res);
      return parsed ?? [];
    } catch (e) {
      log.warn(`getTorrentFiles: error for hash ${hash}: ${e.message}`);
      return [];
    }
  }
  async deleteTorrent(client, hash, deleteFiles = false) {
    const s = client.settings;
    const base = buildBaseUrl(s);
    if (!base) throw new DownloadClientUnreachableError("download client has no host configured");
    const cookie = await login(base, s, 15e3);
    const params = new URLSearchParams({ hashes: hash, deleteFiles: String(deleteFiles) });
    const res = await httpRequest(`${base}/api/v2/torrents/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body: params,
      timeoutMs: 15e3
    });
    if (res.status !== 200) {
      throw new DownloadClientHttpError(res.status, `the download client refused the deletion (HTTP ${res.status})`);
    }
  }
  async addTorrentUrl(client, torrentUrl, mediaType, rejectIfAlreadyPresent = false) {
    const url = sanitizeUrl(torrentUrl);
    const s = client.settings;
    const base = buildBaseUrl(s);
    if (!base) throw new DownloadClientUnreachableError("download client has no host configured");
    let category = String(s.category ?? "").trim();
    if (mediaType === "movie" && s.movieCategory) category = String(s.movieCategory).trim();
    if (mediaType === "series" && s.seriesCategory) category = String(s.seriesCategory).trim();
    const cookie = await login(base, s, 6e4);
    const beforeHashes = await snapshotHashes(base, cookie);
    let infoHash;
    let addRes;
    if (url.startsWith("magnet:")) {
      infoHash = extractMagnetInfoHash(url);
      addRes = await addMagnet(base, cookie, url, category);
    } else {
      const fetched = await fetchTorrentOrMagnet(url);
      if ("magnet" in fetched) {
        infoHash = extractMagnetInfoHash(fetched.magnet);
        addRes = await addMagnet(base, cookie, fetched.magnet, category);
      } else {
        infoHash = computeInfoHash(fetched.buffer);
        addRes = await addTorrentFile(base, cookie, fetched.buffer, category);
      }
    }
    if (addRes.status !== 200) {
      throw new DownloadClientHttpError(addRes.status, `the download client refused the torrent (HTTP ${addRes.status})`);
    }
    if (!infoHash) {
      infoHash = await recoverNewlyAddedHash(base, cookie, beforeHashes);
    }
    if (!infoHash) {
      throw new TorrentHashUnresolvedError("could not determine the hash of the torrent that was just added");
    }
    if (rejectIfAlreadyPresent && beforeHashes.has(infoHash.toLowerCase())) {
      throw new TorrentAlreadyPresentError(`torrent ${infoHash} is already in the download client`);
    }
    return infoHash;
  }
};

// src/download-clients/stalled-progress.ts
var STALL_ELIGIBLE_STATES = /* @__PURE__ */ new Set([
  "downloading",
  "forcedDL",
  "stalledDL",
  "metaDL",
  "forcedMetaDL",
  "error",
  "missingFiles"
]);
var STALL_PROGRESS_TOLERANCE_BYTES = 30 * 1024 * 1024;
function isNoProgress(olderBytes, newerBytes) {
  const delta = newerBytes - olderBytes;
  if (delta < 0) return false;
  return delta < STALL_PROGRESS_TOLERANCE_BYTES;
}
function countStalledStrikes(samplesDescByCheckedAt) {
  if (!samplesDescByCheckedAt.length) return 0;
  let strikes = 1;
  for (let i = 0; i + 1 < samplesDescByCheckedAt.length; i++) {
    const newer = samplesDescByCheckedAt[i].downloadedBytes;
    const older = samplesDescByCheckedAt[i + 1].downloadedBytes;
    if (!isNoProgress(older, newer)) break;
    strikes++;
  }
  return strikes;
}

// src/download-clients/service.ts
var SECRET_SETTING_KEY = "password";
var DownloadClientsService = class {
  constructor(deps) {
    this.deps = deps;
  }
  assertKnownImplementation(implementation) {
    if (!this.deps.drivers[implementation]) {
      throw new UnsupportedDownloadClientError(`Unknown download client implementation "${implementation}"`);
    }
  }
  resolveDriver(client) {
    const driver = this.deps.drivers[client.implementation];
    if (!driver || !driver.supports(client)) {
      throw new UnsupportedDownloadClientError(`Download client #${client.id} does not support this operation`);
    }
    return driver;
  }
  /** Strips the stored credential so it never reaches an HTTP response. */
  redact(client) {
    const settings = { ...client.settings ?? {} };
    delete settings[SECRET_SETTING_KEY];
    return { ...client, settings };
  }
  async testConnection(input) {
    const driver = this.deps.drivers[input.implementation];
    if (!driver) {
      const messageKey = "download.download_clients.test.unsupported_implementation";
      return { ok: false, messageKey, detail: input.implementation };
    }
    return driver.testConnection(input.settings);
  }
  async create(input) {
    this.assertKnownImplementation(input.implementation);
    const saved = await this.deps.repo.insert({
      name: input.name,
      implementation: input.implementation,
      settings: input.settings ?? {},
      enabled: input.enabled ?? true,
      priority: input.priority ?? 1
    });
    return this.redact(saved);
  }
  async findAll() {
    const rows = await this.deps.repo.listAll();
    return rows.map((r) => this.redact(r));
  }
  /** Unredacted, same asymmetry as `IndexerService.findOne` — the HTTP boundary
   *  (not wired yet, see `src/seams/http-routes.ts`) redacts a single-row read,
   *  not the service. */
  async findOne(id) {
    const row = await this.deps.repo.findById(id);
    if (!row) throw new DownloadClientNotFoundError(`Download client #${id} not found`);
    return row;
  }
  async update(id, input) {
    const existing = await this.findOne(id);
    if (input.implementation !== void 0) this.assertKnownImplementation(input.implementation);
    let settings = existing.settings;
    if (input.settings !== void 0) {
      const incoming = { ...input.settings };
      const existingSecret = existing.settings?.[SECRET_SETTING_KEY];
      settings = { ...incoming, [SECRET_SETTING_KEY]: incoming[SECRET_SETTING_KEY] || existingSecret };
    }
    const saved = await this.deps.repo.update(id, {
      name: input.name ?? existing.name,
      implementation: input.implementation ?? existing.implementation,
      settings,
      enabled: input.enabled ?? existing.enabled,
      priority: input.priority ?? existing.priority
    });
    return this.redact(saved);
  }
  async remove(id) {
    await this.findOne(id);
    await this.deps.repo.remove(id);
  }
  async removeTorrent(clientId, hash, deleteFiles) {
    const client = await this.findOne(clientId);
    const driver = this.resolveDriver(client);
    await driver.deleteTorrent(client, hash, deleteFiles);
  }
  /**
   * Blocklist the release behind this torrent so it can't be grabbed again,
   * remove it (with its files) from the client, and mark the history row
   * failed. Ported from `download-clients.service.ts`'s `blockTorrent`; the
   * re-search trigger it fired (`EventsService.emitDomain`) has no host-method
   * equivalent yet (see the port report) — `onMediaBlocklisted` is the seam
   * for whoever wires that later.
   */
  async blockTorrent(clientId, hash) {
    const client = await this.findOne(clientId);
    const driver = this.resolveDriver(client);
    const entry = await this.findHistoryForHash(hash);
    if (entry) {
      try {
        await this.deps.blocklist.insert({
          sourceTitle: entry.sourceTitle,
          quality: entry.quality,
          mediaId: entry.mediaId,
          indexerId: entry.indexerId,
          note: BLOCK_REASON_KEY
        });
      } catch {
      }
    }
    await driver.deleteTorrent(client, hash, true);
    if (entry) {
      await this.deps.history.markFailed(entry.id, BLOCK_REASON_KEY);
    }
    if (entry?.mediaId != null) {
      this.deps.onMediaBlocklisted?.(entry.mediaId);
    }
  }
  /** Resolve a `download_history` row from a torrent hash, falling back to a
   *  name match across enabled clients when the hash isn't stored yet. */
  async findHistoryForHash(hash) {
    const byHash = await this.deps.history.findLatestByTorrentHash(hash);
    if (byHash) return byHash;
    const clients = await this.deps.repo.listEnabled();
    for (const client of clients) {
      const driver = this.deps.drivers[client.implementation];
      if (!driver || !driver.supports(client)) continue;
      try {
        const torrents = await driver.getTorrents(client);
        const t = torrents.find((t2) => t2.hash.toLowerCase() === hash.toLowerCase());
        if (t) return this.deps.history.findLatestBySourceTitle(t.name);
      } catch {
        continue;
      }
    }
    return null;
  }
  /**
   * Fills `stalledStrikes` / `stalledStrikesRequired` on eligible queue items, using
   * the same no-progress tolerance and run-length logic as the stalled cleanup. The
   * count is clamped to the configured sample target so the display stays "x/N" even
   * when a torrent outlives the firing threshold. `stallConfig` is the caller's own —
   * this method has no settings access of its own, unlike the Fliks original which
   * read `SettingsService` directly (see the port report).
   */
  async annotateStalledStrikes(items, stallConfig) {
    const eligible = items.filter((it) => it.hash && it.progress < 1 && STALL_ELIGIBLE_STATES.has(it.state));
    if (!eligible.length || !stallConfig) return;
    const hashes = eligible.map((it) => it.hash);
    const rows = await this.deps.stalledSnapshots.findRecentForHashes(hashes);
    const snapsByHash = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const key = row.torrentHash.toLowerCase();
      const list = snapsByHash.get(key);
      if (list) list.push(row);
      else snapsByHash.set(key, [row]);
    }
    for (const it of eligible) {
      const snaps = snapsByHash.get(it.hash.toLowerCase()) ?? [];
      it.stalledStrikes = Math.min(countStalledStrikes(snaps), stallConfig.samples);
      it.stalledStrikesRequired = stallConfig.samples;
    }
  }
};

// src/seams/download-clients.ts
var DOWNLOAD_CLIENT_DRIVERS = {
  qbittorrent: new QbittorrentDriver()
};

// src/grab/release-scoring.ts
async function buildScoreRequest(releases, indexers, blocklistRepo) {
  const byIndexer = new Map(indexers.map((ix) => [ix.id, ix]));
  return Promise.all(
    releases.map(async (r, i) => {
      const settings = byIndexer.get(r.indexerId)?.settings ?? {};
      const minSeeders = Number(settings["minSeeders"]);
      return {
        id: String(i),
        title: r.title,
        size: r.size,
        seeders: r.seeders,
        leechers: r.leechers,
        publishDate: r.publishDate ?? (/* @__PURE__ */ new Date(0)).toISOString(),
        freeleech: r.freeleech,
        downloadVolumeFactor: r.downloadVolumeFactor,
        sourceRef: r.downloadUrl,
        minSeeders: Number.isFinite(minSeeders) && minSeeders > 0 ? minSeeders : void 0,
        unknownLanguageIsoCode: settings["unknownLanguageIsoCode"],
        blocked: await blocklistRepo.isBlocked(r.title)
      };
    })
  );
}
function joinScored(raw, scored) {
  return scored.flatMap((s) => {
    const r = raw[Number(s.id)];
    return r ? [{ ...r, ...s }] : [];
  });
}
function pickRelease(sorted, want) {
  if (!want) return void 0;
  return sorted.find((r) => {
    if (r.rejections.length > 0) return false;
    if (r.rank <= want.minRankExclusive || r.rank > want.maxRankInclusive) return false;
    return true;
  });
}

// src/grab/release-search.ts
function readyIndexersOrNone(indexer, indexers, context) {
  const ready = indexer.filterReadyIndexers(indexers);
  if (!ready.length && indexers.length) {
    log.warn(`${context}: every indexer is in cooldown \u2014 skipping this run`);
  }
  return ready;
}
async function fanOut(ready, run) {
  const batches = await Promise.allSettled(ready.map(run));
  return batches.flatMap((b) => b.status === "fulfilled" ? b.value : []);
}
async function searchMovieAcrossIndexers(indexer, indexers, query, externalIds, context = "search") {
  const ready = readyIndexersOrNone(indexer, indexers, context);
  if (!ready.length) return [];
  return fanOut(ready, (ix) => indexer.searchMovie(ix, query, externalIds));
}
async function searchSeriesAcrossIndexers(indexer, indexers, query, season, episode, externalIds, context = "search") {
  const ready = readyIndexersOrNone(indexer, indexers, context);
  if (!ready.length) return [];
  return fanOut(ready, (ix) => indexer.searchSeries(ix, query, season, episode, externalIds));
}
async function searchSeasonPackAcrossIndexers(indexer, indexers, query, season, externalIds, context = "search") {
  const ready = readyIndexersOrNone(indexer, indexers, context);
  if (!ready.length) return [];
  return fanOut(ready, (ix) => indexer.searchSeasonPack(ix, query, season, externalIds));
}
async function rssAcrossIndexers(indexer, indexers, context = "RssSync") {
  const ready = readyIndexersOrNone(indexer, indexers, context);
  const out = [];
  for (const ix of ready) {
    try {
      out.push({ indexer: ix, releases: await indexer.rssSearch(ix) });
    } catch (e) {
      log.warn(`RssSync: indexer "${ix.name}" failed: ${e.message}`);
    }
  }
  return out;
}

// src/grab/grab-history.ts
function buildGrabHistoryRow(args) {
  return {
    mediaId: args.mediaId,
    downloadClientId: args.downloadClientId,
    // Decode HTML entities ahead of persistence so the stored title matches
    // what the client renders (it decodes on display) — otherwise the
    // matcher's name-fallback comparison drifts and the orphan sweep
    // eventually flips the row to failed.
    sourceTitle: decodeHtmlEntities(args.sourceTitle),
    torrentHash: args.torrentHash || null,
    quality: args.quality,
    grabSource: args.grabSource,
    indexerId: args.indexerId ?? null,
    episodeId: args.episodeId ?? null,
    seasonId: args.seasonId ?? null
  };
}

// src/grab/grab-executor.ts
async function grabAndRecord(deps, args) {
  log.info(`AutoGrab[${args.mediaType}]: sending "${args.sourceTitle}" to the download client \u2014 ${args.downloadUrl}`);
  const torrentHash = await deps.driver.addTorrentUrl(
    args.client,
    args.downloadUrl,
    args.mediaType,
    args.rejectIfAlreadyPresent
  );
  await deps.historyRepo.insertGrab(
    buildGrabHistoryRow({
      mediaId: args.mediaId,
      downloadClientId: args.client.id,
      sourceTitle: args.sourceTitle,
      torrentHash,
      quality: args.quality,
      grabSource: args.grabSource,
      indexerId: args.indexerId,
      seasonId: args.seasonId,
      episodeId: args.episodeId
    })
  );
  await deps.host.call("events.publish", [
    {
      type: "acquisition.grabbed",
      mediaId: args.mediaId,
      seasonNumber: args.seasonNumber,
      episodeNumber: args.episodeNumber
    }
  ]);
  void deps.host.call("notifications.dispatch", {
    event: "grab.started",
    payload: { title: args.label, quality: args.quality, sourceTitle: args.sourceTitle }
  }).catch((e) => log.warn(`AutoGrab: notifications.dispatch failed: ${e.message}`));
  log.info(`AutoGrab[${args.mediaType}]: grabbed "${args.sourceTitle}" for "${args.label}"`);
  return { torrentHash };
}
async function tryGrabAndRecord(deps, args) {
  try {
    await grabAndRecord(deps, args);
    return true;
  } catch (e) {
    log.warn(`AutoGrab[${args.mediaType}]: grab failed for "${args.label}": ${e.message}`);
    return false;
  }
}

// src/grab/release-pipeline.ts
var GrabError = class extends Error {
  constructor(messageKey, detail) {
    super(detail ? `${messageKey}: ${detail}` : messageKey);
    this.messageKey = messageKey;
    this.detail = detail;
  }
};
function execDeps(deps) {
  return { host: deps.host, driver: deps.driver, historyRepo: deps.historyRepo };
}
function inferTitleFromTorrentUrl(url) {
  if (url.startsWith("magnet:")) {
    const m = url.match(/[?&]dn=([^&]+)/i);
    if (m) {
      try {
        return decodeURIComponent(m[1].replace(/\+/g, " "));
      } catch {
        return m[1];
      }
    }
  }
  return url.slice(0, 240);
}
async function loadTarget(deps, mediaId, seasonId, episodeId) {
  const target = await deps.host.call("media.acquisitionContext", { mediaId, seasonId, episodeId });
  if (!target) throw new GrabError("download.grab.errors.media_not_found", String(mediaId));
  return target;
}
function pickClient(deps, clients) {
  const client = clients.find((c) => deps.driver.supports(c));
  if (!client) throw new GrabError("download.grab.errors.no_download_client");
  return client;
}
function searchQuery(target, customQuery) {
  const trimmed = customQuery?.trim();
  if (trimmed) return trimmed;
  if (!target.season && !target.episode && target.year) return `${target.searchTitle} ${target.year}`;
  return target.searchTitle;
}
async function searchScored(deps, target, customQuery) {
  const indexers = await deps.indexersRepo.listEnabled();
  if (!indexers.length) return [];
  const externalIds = { imdbId: target.imdbId, tmdbId: target.tmdbId, tvdbId: target.tvdbId };
  const query = searchQuery(target, customQuery);
  const context = target.title;
  let raw;
  if (target.episode) {
    raw = await searchSeriesAcrossIndexers(deps.indexer, indexers, query, target.season.number, target.episode.number, externalIds, context);
  } else if (target.season) {
    raw = await searchSeasonPackAcrossIndexers(deps.indexer, indexers, query, target.season.number, externalIds, context);
  } else {
    raw = await searchMovieAcrossIndexers(deps.indexer, indexers, query, externalIds, context);
  }
  if (!raw.length) return [];
  const scored = await deps.host.call("releases.score", {
    mediaId: target.mediaId,
    seasonNumber: target.season?.number,
    episodeNumber: target.episode?.number,
    releases: await buildScoreRequest(raw, indexers, deps.blocklistRepo)
  });
  return joinScored(raw, scored);
}
async function searchReleases(deps, mediaId, seasonId, episodeId, customQuery) {
  const target = await loadTarget(deps, mediaId, seasonId, episodeId);
  if (!target.want) return [];
  return searchScored(deps, target, customQuery);
}
async function scoreSingleRelease(deps, target, sourceTitle, downloadUrl) {
  const fabricated = {
    title: sourceTitle,
    downloadUrl,
    indexerId: 0,
    indexerName: "",
    size: 0,
    seeders: 0,
    leechers: 0,
    publishDate: (/* @__PURE__ */ new Date()).toISOString(),
    freeleech: false,
    downloadVolumeFactor: 1
  };
  const scored = await deps.host.call("releases.score", {
    mediaId: target.mediaId,
    seasonNumber: target.season?.number,
    episodeNumber: target.episode?.number,
    releases: await buildScoreRequest([fabricated], [], deps.blocklistRepo)
  });
  const joined = joinScored([fabricated], scored)[0];
  if (!joined) throw new GrabError("download.grab.errors.no_eligible_release");
  return joined;
}
async function grabRelease(deps, mediaId, seasonId, episodeId, manual) {
  const target = await loadTarget(deps, mediaId, seasonId, episodeId);
  const clients = await deps.clientsRepo.listEnabled();
  const client = pickClient(deps, clients);
  if (!target.want) throw new GrabError("download.grab.errors.unprofiled");
  const grabCommon = {
    mediaId,
    client,
    mediaType: target.kind,
    label: target.title,
    seasonNumber: target.season?.number,
    episodeNumber: target.episode?.number,
    seasonId: target.season?.id ?? null,
    episodeId: target.episode?.id ?? null
  };
  if (manual?.downloadUrl) {
    const sourceTitle = manual.sourceTitle?.trim() || inferTitleFromTorrentUrl(manual.downloadUrl);
    const scored2 = await scoreSingleRelease(deps, target, sourceTitle, manual.downloadUrl);
    if (scored2.blocklisted) throw new GrabError("download.grab.errors.blocklisted", sourceTitle);
    if (!scored2.allowed) throw new GrabError("download.grab.errors.quality_not_allowed", scored2.qualityName);
    log.info(`Grab #${mediaId} "${target.title}" \u2014 manual URL`);
    return grabAndRecord(execDeps(deps), {
      ...grabCommon,
      sourceTitle,
      downloadUrl: manual.downloadUrl,
      quality: scored2.qualityName,
      indexerId: manual.indexerId,
      grabSource: "manual"
    });
  }
  log.info(`Grab #${mediaId} "${target.title}" \u2014 auto-pick`);
  const scored = await searchScored(deps, target);
  const pick = pickRelease(scored, target.want);
  if (!pick) throw new GrabError("download.grab.errors.no_eligible_release");
  return grabAndRecord(execDeps(deps), {
    ...grabCommon,
    sourceTitle: pick.title,
    downloadUrl: pick.downloadUrl,
    quality: pick.qualityName,
    indexerId: pick.indexerId,
    grabSource: "auto"
  });
}

// src/grab/auto-grab.ts
function execDeps2(deps) {
  return { host: deps.host, driver: deps.driver, historyRepo: deps.historyRepo };
}
async function tryAutoGrab(deps, target, client, searchScored2, pendingCheck2) {
  const logSkip = (reason) => {
    log.info(`AutoGrab[${target.kind}]: "${target.title}" skipped \u2014 ${reason}`);
    return false;
  };
  if (!target.want) return logSkip("no quality/language profile on media, or already satisfied");
  if (pendingCheck2 && await pendingCheck2()) return logSkip("a grab is already pending");
  const scored = await searchScored2(target);
  if (!scored.length) return logSkip("no releases returned by indexers");
  const pick = pickRelease(scored, target.want);
  if (!pick) {
    const sample = scored.slice(0, 3).map((r) => `"${r.title}" \u2192 rank ${r.rank}${r.rejections.length ? ` [${r.rejections.map((x) => x.code).join(", ")}]` : ""}`).join(" | ");
    return logSkip(`no eligible release (${scored.length} checked)${sample ? ` \u2014 top: ${sample}` : ""}`);
  }
  return tryGrabAndRecord(execDeps2(deps), {
    mediaId: target.mediaId,
    client,
    mediaType: target.kind,
    label: target.title,
    sourceTitle: pick.title,
    downloadUrl: pick.downloadUrl,
    quality: pick.qualityName,
    indexerId: pick.indexerId,
    grabSource: "auto",
    seasonNumber: target.season?.number,
    episodeNumber: target.episode?.number,
    seasonId: target.season?.id ?? null,
    episodeId: target.episode?.id ?? null,
    // Only the scheduler/RSS path rejects a hash the client already holds —
    // interactive grabs (`release-pipeline.ts`) leave this off.
    rejectIfAlreadyPresent: true
  });
}

// src/grab/orphan-matcher.ts
async function identifyOrphans(host2, titles) {
  const out = /* @__PURE__ */ new Map();
  if (!titles.length) return out;
  const results = await host2.call("releases.match", {
    titles: titles.map((title, i) => ({ id: String(i), title, publishDate: (/* @__PURE__ */ new Date()).toISOString() }))
  });
  for (const r of results) {
    const title = titles[Number(r.id)];
    if (title === void 0) continue;
    out.set(title, r.mediaId == null ? null : { mediaId: r.mediaId, seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber, isFullSeason: r.isFullSeason });
  }
  return out;
}
async function resolveSeasonEpisodeIds(host2, mediaId, seasonNumber, episodeNumber) {
  if (seasonNumber == null) return { seasonId: null, episodeId: null };
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const { items } = await host2.call("acquisition.candidates", { mediaIds: [mediaId], availableOn: today, limit: 100 });
  const bySeason = items.filter((it) => it.season?.number === seasonNumber);
  if (episodeNumber != null) {
    const withEpisode = bySeason.find((it) => it.episode?.number === episodeNumber);
    if (withEpisode?.season && withEpisode.episode) return { seasonId: withEpisode.season.id, episodeId: withEpisode.episode.id };
  }
  const anySeason = bySeason.find((it) => it.season);
  return anySeason?.season ? { seasonId: anySeason.season.id, episodeId: null } : { seasonId: null, episodeId: null };
}

// src/grab/scheduler.ts
function pickClient2(deps, clients) {
  return clients.find((c) => deps.driver.supports(c)) ?? null;
}
async function searchMissing(deps, mediaIds) {
  const clients = await deps.clientsRepo.listEnabled();
  const client = pickClient2(deps, clients);
  if (!client) {
    log.warn("SearchMissing: no enabled download client configured");
    return;
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  let cursor;
  let count = 0;
  do {
    const page = await deps.host.call("acquisition.candidates", { mediaIds, availableOn: today, limit: 200, cursor: cursor ?? void 0 });
    for (const target of page.items) {
      count++;
      if (!target.want) continue;
      await tryAutoGrab(deps, target, client, (t) => searchScored(deps, t), () => pendingCheck(deps.historyRepo, target));
    }
    cursor = page.cursor;
  } while (cursor);
  log.info(`SearchMissing: ${count} candidate(s) checked`);
}
async function pendingCheck(historyRepo, target) {
  if (target.season && !target.episode) {
    const pending2 = await historyRepo.findPendingSeasonPackGrab(target.mediaId, target.season.id);
    return !!pending2;
  }
  if (target.season && target.episode) {
    const epLabel = `S${String(target.season.number).padStart(2, "0")}E${String(target.episode.number).padStart(2, "0")}`;
    const pending2 = await historyRepo.findPendingEpisodeGrab(target.mediaId, `%${epLabel}%`);
    return !!pending2;
  }
  const pending = await historyRepo.findPendingGrabForMedia(target.mediaId);
  return !!pending;
}
async function rssSync(deps) {
  const indexers = await deps.indexersRepo.listEnabled();
  const clients = await deps.clientsRepo.listEnabled();
  const client = pickClient2(deps, clients);
  if (!client) {
    log.warn("RssSync: no enabled download client configured");
    return;
  }
  const ready = readyIndexersOrNone(deps.indexer, indexers, "RssSync");
  if (!ready.length) return;
  const feeds = await rssAcrossIndexers(deps.indexer, ready, "RssSync");
  for (const { releases } of feeds) {
    if (!releases.length) continue;
    const matched = await identifyOrphans(
      deps.host,
      releases.map((r) => r.title)
    );
    for (const release of releases) {
      const m = matched.get(release.title);
      if (!m || m.mediaId == null) continue;
      const page = await deps.host.call("acquisition.candidates", {
        mediaIds: [m.mediaId],
        availableOn: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        limit: 100
      });
      const target = page.items.find((it) => (m.seasonNumber == null ? !it.season : it.season?.number === m.seasonNumber) && (m.episodeNumber == null ? !it.episode : it.episode?.number === m.episodeNumber));
      if (!target || !target.want) continue;
      await tryAutoGrab(deps, target, client, (t) => searchScored(deps, t), () => pendingCheck(deps.historyRepo, target));
    }
  }
}

// src/grab/pipeline.ts
var DownloadGrabPipeline = class {
  constructor(deps) {
    this.deps = deps;
  }
  searchReleases(mediaId, seasonId, episodeId, customQuery) {
    return searchReleases(this.deps, mediaId, seasonId, episodeId, customQuery);
  }
  grabRelease(mediaId, seasonId, episodeId, manual) {
    return grabRelease(this.deps, mediaId, seasonId, episodeId, manual);
  }
  /** `GrabPipeline.searchAndGrab` — auto-pick and grab one target. Backs the
   *  inbound `media.acquisition.requested` note's targeted-restart use case
   *  and the manifest's `POST /:id/grab`-family routes when called without a
   *  manual URL. */
  async searchAndGrab(mediaId, seasonId, episodeId) {
    await grabRelease(this.deps, mediaId, seasonId, episodeId);
  }
  /** `GrabPipeline.searchMissing` — the `SearchMissing` job. */
  searchMissing(mediaIds) {
    return searchMissing(this.deps, mediaIds);
  }
  /** `GrabPipeline.rssSync` — the `RssSync` job. */
  rssSync() {
    return rssSync(this.deps);
  }
};
function createGrabPipeline(deps) {
  return new DownloadGrabPipeline(deps);
}

// src/grab/completion-poller.ts
var path = __toESM(require("path"));

// src/grab/torrent-name-matcher.ts
var LIVE_STATUSES = /* @__PURE__ */ new Set(["grabbed", "importing"]);
function authorityRank(h) {
  return (h.mediaId ? 2 : 0) + (LIVE_STATUSES.has(h.status) ? 1 : 0);
}
function outranksForTorrent(candidate, current) {
  const delta = authorityRank(candidate) - authorityRank(current);
  return delta > 0 || delta === 0 && candidate.id > current.id;
}
function pickAuthoritative(rows) {
  let best = null;
  for (const h of rows) {
    if (!best || outranksForTorrent(h, best)) best = h;
  }
  return best;
}
function normaliseTorrentName(raw) {
  if (!raw) return "";
  let s = decodeHtmlEntities(raw);
  s = s.replace(/\.torrent$/i, "");
  s = s.replace(/[._\s]+/g, " ").trim();
  return s.toLowerCase();
}
var TorrentHistoryMatcher = class {
  constructor(repo) {
    this.repo = repo;
  }
  findMatch(torrent, histories) {
    const hash = torrent.hash?.toLowerCase() ?? null;
    const name = normaliseTorrentName(torrent.name);
    if (hash) {
      const byHash = pickAuthoritative(histories.filter((h) => h.torrentHash && h.torrentHash.toLowerCase() === hash));
      if (byHash) return { history: byHash, matchedBy: "hash" };
    }
    const byName = pickAuthoritative(histories.filter((h) => normaliseTorrentName(h.sourceTitle ?? "") === name));
    if (byName) return { history: byName, matchedBy: "exact-name" };
    const prefix = histories.filter((h) => {
      if (!h.sourceTitle) return false;
      const s = normaliseTorrentName(h.sourceTitle);
      if (!s) return false;
      return name.startsWith(s) || s.startsWith(name);
    });
    if (prefix.length === 1) return { history: prefix[0], matchedBy: "unique-prefix" };
    if (prefix.length > 1) {
      log.warn(`TorrentHistoryMatcher: ${prefix.length} histories with prefix overlap on "${torrent.name}" \u2014 skipped`);
    }
    return null;
  }
  /** Persist the torrent hash on a history row when the matcher resolved it by
   *  name. Cheap idempotent UPDATE — safe to call on every match. */
  async healHash(history, hash) {
    if (!hash || history.torrentHash) return;
    await this.repo.updateTorrentHash(history.id, hash);
    history.torrentHash = hash;
  }
  /** Convenience: match + self-heal in one call. */
  async matchAndHeal(torrent, histories) {
    const match = this.findMatch(torrent, histories);
    if (!match) return null;
    if (match.matchedBy !== "hash" && torrent.hash) {
      await this.healHash(match.history, torrent.hash.toLowerCase());
    }
    return match.history;
  }
};

// src/grab/stall-config.ts
var STALL_SAMPLES_KEY = "stall_samples";
var STALL_INTERVAL_MINUTES_KEY = "stall_interval_minutes";
var STALL_AUTO_RESTART_KEY = "stall_auto_restart";
var STALL_INCLUDE_MANUAL_GRABS_KEY = "stall_include_manual_grabs";
async function getStallConfig(host2) {
  const values = await host2.call("config.get", {
    keys: [STALL_SAMPLES_KEY, STALL_INTERVAL_MINUTES_KEY, STALL_AUTO_RESTART_KEY, STALL_INCLUDE_MANUAL_GRABS_KEY]
  });
  const samples = parseInt(values[STALL_SAMPLES_KEY] ?? "", 10);
  if (!Number.isFinite(samples) || samples < 2) return null;
  const intervalMinutes = parseInt(values[STALL_INTERVAL_MINUTES_KEY] ?? "", 10);
  return {
    samples,
    intervalMinutes: Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 60,
    autoRestart: values[STALL_AUTO_RESTART_KEY] === "true",
    includeManualGrabs: values[STALL_INCLUDE_MANUAL_GRABS_KEY] === "true"
  };
}

// src/grab/progress-state.ts
function mapClientStateToProgress(state) {
  switch (state) {
    case "queuedDL":
      return "queued";
    case "stalledDL":
    case "error":
    case "missingFiles":
      return "stalled";
    case "pausedDL":
    case "pausedUP":
    case "stoppedDL":
    case "stoppedUP":
      return "paused";
    case "moving":
      return "importing";
    case "downloading":
    case "forcedDL":
    case "metaDL":
    case "forcedMetaDL":
    case "allocating":
    case "checkingDL":
    case "checkingResumeData":
    default:
      return "active";
  }
}
function torrentProgressState(t) {
  return mapClientStateToProgress(t.state);
}

// src/grab/completion-poller.ts
var INGEST_CALL_TIMEOUT_MS = 31 * 6e4;
var VIDEO_EXTS = /* @__PURE__ */ new Set([".mkv", ".mp4", ".avi", ".mov", ".ts", ".m2ts", ".wmv", ".flv"]);
var ORPHAN_GRACE_MS = 5 * 6e4;
var ORPHAN_STATUS_MESSAGE = "Torrent no longer present in download client";
var DownloadCompletionPoller = class {
  constructor(deps) {
    this.deps = deps;
  }
  /** Torrent hashes the auto-matcher could not identify on the previous
   *  tick — rebuilt wholesale each run. */
  unidentifiedHashes = /* @__PURE__ */ new Set();
  /** Boot re-arm of every stranded `importing` row — nothing is in flight
   *  right after a fresh process start. Call once at startup. */
  async init() {
    await this.deps.historyRepo.resetStatus("importing", "grabbed");
  }
  // ---------------------------------------------------------------------------
  // ImportCompleted job
  // ---------------------------------------------------------------------------
  async poll() {
    const clients = await this.deps.clientsRepo.listEnabled();
    const qbitClients = clients.filter((c) => this.deps.driver.supports(c));
    if (!qbitClients.length) {
      log.warn("Import: no enabled download client found");
      return;
    }
    const fetches = await Promise.all(
      qbitClients.map(async (c) => {
        const { ok, torrents } = await this.deps.driver.getTorrentsResult(c);
        return { ok, torrents: torrents.map((t) => ({ ...t, _clientId: c.id })) };
      })
    );
    const allClientsResponded = fetches.every((f) => f.ok);
    const allTorrents = fetches.flatMap((f) => f.torrents);
    const torrentClient = new Map(qbitClients.map((c) => [c.id, c]));
    await this.autoMatchOrphanTorrents(allTorrents);
    const grabbed = await this.deps.historyRepo.findByStatuses(["grabbed", "failed", "warning"]);
    const importing = await this.deps.historyRepo.findByStatuses(["importing"]);
    if (allClientsResponded) {
      await this.reconcileOrphanHistory(allTorrents, grabbed, importing);
    }
    await this.emitDownloadProgress(allTorrents);
    const completedTorrents = allTorrents.filter(
      (t) => t.progress >= 1 || t.state === "seeding" || t.state === "stalledUP" || t.state === "stoppedUP"
    );
    if (!completedTorrents.length) return;
    let imported = 0;
    for (const torrent of completedTorrents) {
      const history = await this.deps.historyMatcher.matchAndHeal(torrent, grabbed);
      if (!history) continue;
      if (history.status !== "grabbed" && history.status !== "failed" && history.status !== "warning") continue;
      const client = torrentClient.get(torrent._clientId);
      log.info(`Import: torrent "${torrent.name}" -> history #${history.id} (mediaId=${history.mediaId}, status=${history.status})`);
      try {
        await this.deps.historyRepo.markImporting(history.id);
        if (!client) throw new Error("download client for this torrent is no longer enabled");
        await this.processOne(history, torrent, client);
        imported++;
      } catch (e) {
        const message = e.message;
        log.error(`Import: FAILED for "${history.sourceTitle}": ${message}`);
        await this.deps.historyRepo.markFailed(history.id, message);
        await this.publishFailed(history, message);
        await this.autoBlocklist(history, `Auto-blocklist: import failed \u2014 ${message}`);
      }
    }
    if (imported > 0) log.info(`Import: processed ${imported}/${completedTorrents.length} completed torrent(s)`);
  }
  /**
   * Ported from `autoMatchOrphanTorrents`. Identification is delegated to
   * `releases.match` (see `orphan-matcher.ts`) instead of the original's
   * direct-SQL `TorrentAutoMatcher` — a real behavioural swap, not a
   * like-for-like port (flagged in the port report).
   */
  async autoMatchOrphanTorrents(allTorrents) {
    if (!allTorrents.length) return;
    const allHistory = await this.deps.historyRepo.findAll();
    const rowByHash = /* @__PURE__ */ new Map();
    for (const h of allHistory) {
      if (!h.torrentHash) continue;
      const key = h.torrentHash.toLowerCase();
      const kept = rowByHash.get(key);
      if (!kept || outranksForTorrent(h, kept)) rowByHash.set(key, h);
    }
    const linkedTitles = new Set(allHistory.filter((h) => h.mediaId && h.sourceTitle).map((h) => normaliseTorrentName(h.sourceTitle)));
    const candidates = allTorrents.filter((t) => {
      if (!t.hash) return false;
      const existing = rowByHash.get(t.hash.toLowerCase());
      if (!existing) return true;
      if (!existing.mediaId) return true;
      return false;
    });
    if (!candidates.length) {
      this.unidentifiedHashes = /* @__PURE__ */ new Set();
      return;
    }
    const toIdentify = candidates.filter((t) => !linkedTitles.has(normaliseTorrentName(t.name)));
    if (!toIdentify.length) return;
    const matches = await identifyOrphans(this.deps.host, toIdentify.map((t) => t.name));
    const stillUnidentified = /* @__PURE__ */ new Set();
    let bound = 0;
    let rebound = 0;
    for (const torrent of toIdentify) {
      const hash = torrent.hash.toLowerCase();
      const match = matches.get(torrent.name);
      if (!match || match.mediaId == null) {
        stillUnidentified.add(hash);
        const message = `Auto-match: "${torrent.name}" \u2014 releases.match found no media for it`;
        if (this.unidentifiedHashes.has(hash)) log.info(message);
        else log.info(message);
        continue;
      }
      const { seasonId, episodeId } = await resolveSeasonEpisodeIds(this.deps.host, match.mediaId, match.seasonNumber, match.episodeNumber);
      const existingRow = rowByHash.get(hash);
      if (existingRow) {
        await this.deps.historyRepo.healMatch(existingRow.id, {
          mediaId: match.mediaId,
          episodeId,
          seasonId,
          quality: existingRow.quality
        });
        rebound++;
      } else {
        await this.deps.historyRepo.insertGrab(
          buildGrabHistoryRow({
            mediaId: match.mediaId,
            downloadClientId: torrent._clientId,
            sourceTitle: torrent.name,
            torrentHash: torrent.hash,
            // Orphan binding has no release object to derive a quality from —
            // flagged gap, see the port report.
            quality: "unknown",
            grabSource: "manual",
            episodeId,
            seasonId
          })
        );
        bound++;
      }
    }
    this.unidentifiedHashes = stillUnidentified;
    if (bound || rebound) log.info(`Auto-match: done \u2014 ${bound} created, ${rebound} healed`);
  }
  /** Ported from `reconcileOrphanHistory` — verbatim rule set. */
  async reconcileOrphanHistory(allTorrents, grabbed, importing) {
    if (!grabbed.length && !importing.length) return;
    const candidates = [...grabbed, ...importing];
    const torrentByHistoryId = /* @__PURE__ */ new Map();
    for (const t of allTorrents) {
      const m = this.deps.historyMatcher.findMatch(t, candidates);
      if (m) torrentByHistoryId.set(m.history.id, t);
    }
    const matchedHistoryIds = new Set(torrentByHistoryId.keys());
    let changed = false;
    const restarted = importing.filter((h) => {
      const t = torrentByHistoryId.get(h.id);
      return t != null && t.progress < 1;
    });
    if (restarted.length) {
      await this.deps.historyRepo.updateStatusByIds(restarted.map((h) => h.id), "grabbed", null);
      changed = true;
      log.warn(`Import: ${restarted.length} importing entries whose torrent is no longer complete \u2014 re-armed as grabbed`);
    }
    const revived = grabbed.filter((h) => h.status === "failed" && h.statusMessage === ORPHAN_STATUS_MESSAGE && matchedHistoryIds.has(h.id));
    if (revived.length) {
      await this.deps.historyRepo.updateStatusByIds(revived.map((h) => h.id), "grabbed", null);
      changed = true;
      log.info(`Import: ${revived.length} entries reappeared in the download client \u2014 cleared the orphan stamp`);
    }
    const cutoff = Date.now() - ORPHAN_GRACE_MS;
    const expired = candidates.filter(
      (h) => (h.status === "grabbed" || h.status === "importing") && !matchedHistoryIds.has(h.id) && new Date(h.updatedAt).getTime() < cutoff
    );
    if (expired.length) {
      await this.deps.historyRepo.updateStatusByIds(expired.map((h) => h.id), "failed", ORPHAN_STATUS_MESSAGE);
      changed = true;
      log.warn(`Import: ${expired.length} grabbed/importing entries lost their torrent for > ${ORPHAN_GRACE_MS / 6e4}min \u2014 marked failed`);
    }
    if (changed) await this.deps.host.call("events.publish", [{ type: "acquisition.queue.changed" }]);
  }
  /**
   * Ported from `emitDownloadProgress`. Season/episode number is omitted from
   * the `progress.set` call: the row only carries season/episode **ids**, and
   * resolving numbers would need `media.resolve`, whose response-key format
   * for a mixed media/season/episode-id batch is unspecified in
   * `src/host-methods.ts`. Taking the smaller option per the brief: whole-media
   * progress still works, series just lose per-episode progress-clearing
   * granularity — flagged in the port report, not guessed at.
   */
  async emitDownloadProgress(allTorrents) {
    const downloading = allTorrents.filter((t) => t.progress < 1);
    if (!downloading.length) return;
    const rows = await this.deps.historyRepo.findByStatuses(["grabbed", "importing"]);
    if (!rows.length) return;
    for (const t of downloading) {
      const history = await this.deps.historyMatcher.matchAndHeal(t, rows);
      if (!history?.mediaId) continue;
      await this.deps.host.call("progress.set", {
        mediaId: history.mediaId,
        ref: t.hash,
        progress: t.progress,
        bytesPerSecond: t.dlspeed,
        etaSeconds: t.eta > 0 && t.eta < 864e4 ? t.eta : void 0,
        state: torrentProgressState(t)
      });
    }
  }
  /**
   * Ported from `processOne`. Everything past "which files are video" —
   * destination resolution, the ingest-root allowlist, folder naming,
   * post-import markers/thumbnails/scripts — is core's job now via
   * `library.ingest`; this plugin only decides which files are candidates and
   * records the outcome. Marker detection / thumbnail generation / the
   * post-import shell script are assumed to be core's responsibility inside
   * `library.ingest` now (side effects of "a file landed in the library",
   * which core alone performs) — not re-invoked here, and not verified
   * against core source (out of scope, read-only).
   */
  async processOne(history, torrent, client) {
    const files = await this.deps.driver.getTorrentFiles(client, torrent.hash);
    const videoFiles = files.filter((f) => f.progress >= 1 && VIDEO_EXTS.has(path.extname(f.name).toLowerCase())).map((f) => path.join(torrent.save_path ?? "", f.name));
    if (!videoFiles.length) {
      const statusMessage = `Import failed: no valid video file in the download "${torrent.name}"`;
      log.warn(`Import[${history.sourceTitle}]: ${statusMessage}`);
      await this.deps.historyRepo.markFailed(history.id, statusMessage);
      await this.autoBlocklist(history, "Auto-blocklist: no valid video file in the download");
      try {
        await this.deps.driver.deleteTorrent(client, torrent.hash, true);
      } catch (e) {
        log.warn(`Import[${history.sourceTitle}]: failed to remove dud torrent: ${e.message}`);
      }
      await this.publishFailed(history, statusMessage);
      return;
    }
    if (history.mediaId == null) {
      await this.deps.historyRepo.markFailed(history.id, "Import failed: no media linked to this download");
      return;
    }
    const result = await this.deps.host.call(
      "library.ingest",
      {
        idempotencyKey: `download-history:${history.id}`,
        mediaId: history.mediaId,
        paths: videoFiles,
        transfer: "copy",
        sourceLabel: history.sourceTitle
      },
      // Longer than core's own deadline for this method: copying a release is not a lookup, and
      // giving up first would record a failure while core is still writing.
      INGEST_CALL_TIMEOUT_MS
    );
    if (!result.imported.length && result.alreadyPresent.length) {
      log.info(`Import[${history.sourceTitle}]: already in the library \u2014 completing the row`);
      await this.deps.historyRepo.completeImport(history.id);
      return;
    }
    if (!result.imported.length) {
      const statusMessage = `Import failed: no file could be placed under the library root for "${torrent.name}"`;
      log.error(`Import[${history.sourceTitle}]: ${statusMessage}`);
      await this.deps.historyRepo.markFailed(history.id, statusMessage);
      await this.publishFailed(history, statusMessage);
      return;
    }
    await this.deps.historyRepo.completeImport(history.id);
    log.info(`Import[${history.sourceTitle}]: completed successfully (${result.imported.length} file(s))`);
    await this.deps.host.call("events.publish", [
      {
        type: "acquisition.imported",
        mediaId: history.mediaId,
        seasonNumber: result.seasonNumber,
        episodeNumber: result.episodeNumber,
        quality: history.quality,
        sourceTitle: history.sourceTitle
      }
    ]);
  }
  // ---------------------------------------------------------------------------
  // CleanStalled job
  // ---------------------------------------------------------------------------
  /**
   * Ported from `cleanStalledTorrents`. Gated by {@link getStallConfig} —
   * `samples` unset (every fresh install, and every install today: no
   * manifest config field exists for it yet) returns before touching any
   * client. Every `getTorrentsResult` call below is gated on `ok`: an
   * unreachable client must never be treated as "holds nothing", which is
   * exactly the destructive-path risk this job carries (it deletes torrents
   * and their files).
   */
  async cleanStalled() {
    await this.pruneOldStalledChecks();
    const stallConfig = await getStallConfig(this.deps.host);
    if (!stallConfig) return;
    const clients = await this.deps.clientsRepo.listEnabled();
    const qbitClients = clients.filter((c) => this.deps.driver.supports(c));
    if (!qbitClients.length) return;
    const histories = await this.deps.historyRepo.findByStatuses(["grabbed", "failed", "warning", "importing"]);
    const mediaToResearch = /* @__PURE__ */ new Set();
    const now = Date.now();
    for (const client of qbitClients) {
      const { ok, torrents } = await this.deps.driver.getTorrentsResult(client);
      if (!ok) continue;
      const downloading = torrents.filter((t) => t.progress < 1 && t.hash && t.hash.length > 0 && STALL_ELIGIBLE_STATES.has(t.state));
      if (!downloading.length) continue;
      for (const t of downloading) {
        const history = await this.deps.historyMatcher.matchAndHeal(t, histories);
        if (!history) continue;
        const stalled = await this.evaluateStalled(t, stallConfig, now);
        if (!stalled) continue;
        log.warn(`StalledCleanup: "${t.name}" stalled (samples=${stallConfig.samples}, interval=${stallConfig.intervalMinutes}m)`);
        try {
          await this.deps.driver.deleteTorrent(client, t.hash, true);
        } catch (e) {
          log.error(`StalledCleanup: failed to delete "${t.name}": ${e.message}`);
          continue;
        }
        await this.deps.stalledChecksRepo.deleteByHash(t.hash);
        await this.deps.host.call("events.publish", [{ type: "acquisition.queue.changed" }]);
        await this.autoBlocklist(history, "Auto-blocklist: stalled torrent");
        await this.deps.historyRepo.markFailed(history.id, "Stalled \u2014 removed by stalled-download cleanup");
        const shouldRestart = stallConfig.autoRestart && (history.grabSource === "auto" || stallConfig.includeManualGrabs);
        if (shouldRestart && history.mediaId != null) mediaToResearch.add(history.mediaId);
      }
    }
    if (mediaToResearch.size > 0) {
      log.info(`StalledCleanup: searching for a replacement for ${mediaToResearch.size} media(s)`);
      await this.deps.searchMissing(Array.from(mediaToResearch));
    }
  }
  async evaluateStalled(torrent, config, now) {
    const hash = torrent.hash;
    const currentBytes = torrent.downloaded ?? 0;
    const latest = await this.deps.stalledChecksRepo.findLatest(hash);
    const intervalMs = config.intervalMinutes * 6e4;
    const shouldSnapshot = !latest || now - new Date(latest.checkedAt).getTime() >= intervalMs;
    if (shouldSnapshot) await this.deps.stalledChecksRepo.insert(hash, currentBytes);
    const recent = await this.deps.stalledChecksRepo.findRecent(hash, config.samples);
    if (recent.length < config.samples) return false;
    return countStalledStrikes(recent) >= config.samples;
  }
  /** Deletes stalled-check rows older than 24h. Assumes every profile's
   *  detection window (`(samples - 1) x interval`) stays under 24h. */
  async pruneOldStalledChecks() {
    const cutoff = new Date(Date.now() - 24 * 60 * 6e4).toISOString();
    await this.deps.stalledChecksRepo.pruneOlderThan(cutoff);
  }
  // ---------------------------------------------------------------------------
  // CleanSeeded job
  // ---------------------------------------------------------------------------
  /**
   * Removes a finished torrent once its indexer's seed target is met: either
   * `maxRetentionDays` since the download completed, or `seedRatio` reached. Retention is
   * checked first so a long-seeding torrent leaves on time rather than waiting for a ratio
   * it may never reach.
   */
  async cleanSeeded() {
    const clients = await this.deps.clientsRepo.listEnabled();
    const qbitClients = clients.filter((c) => this.deps.driver.supports(c));
    if (!qbitClients.length) return;
    const allTorrents = [];
    for (const client of qbitClients) {
      const { ok, torrents } = await this.deps.driver.getTorrentsResult(client);
      if (!ok) continue;
      for (const torrent of torrents) allTorrents.push({ client, torrent });
    }
    if (!allTorrents.length) return;
    const torrentMap = new Map(allTorrents.map((e) => [e.torrent.hash.toLowerCase(), e]));
    const completed = await this.deps.historyRepo.findCompletedByHashes([...torrentMap.keys()]);
    if (!completed.length) return;
    const indexers = await this.deps.indexersRepo.listAll();
    const indexerMap = new Map(indexers.map((ix) => [ix.id, ix]));
    let deleted = false;
    for (const history of completed) {
      const entry = torrentMap.get(history.torrentHash.toLowerCase());
      if (!entry) continue;
      const { client, torrent } = entry;
      const indexer = history.indexerId ? indexerMap.get(history.indexerId) : void 0;
      const settings = indexer?.settings ?? {};
      const reason = this.seedCleanupReason(torrent, settings);
      if (!reason) continue;
      log.info(`SeedCleanup: removing "${torrent.name}" (${reason})`);
      try {
        await this.deps.driver.deleteTorrent(client, torrent.hash, true);
        deleted = true;
      } catch (e) {
        log.error(`SeedCleanup: failed to delete "${torrent.name}": ${e.message}`);
      }
    }
    if (deleted) await this.deps.host.call("events.publish", [{ type: "acquisition.queue.changed" }]);
  }
  /** Empty means keep seeding. A torrent whose client reports no completion time is judged on
   *  ratio alone: the age of an unknown finish is unknowable, not zero. */
  seedCleanupReason(torrent, settings) {
    const maxRetentionDays = settings["maxRetentionDays"] != null ? Number(settings["maxRetentionDays"]) : null;
    const completedAt = Number(torrent.completion_on ?? 0);
    if (maxRetentionDays != null && maxRetentionDays > 0 && completedAt > 0) {
      const ageDays = (Date.now() / 1e3 - completedAt) / 86400;
      if (ageDays >= maxRetentionDays) return `retention ${Math.round(ageDays)}d >= ${maxRetentionDays}d`;
    }
    const targetRatio = Number(settings["seedRatio"] ?? 1);
    if (torrent.ratio >= targetRatio) return `ratio ${torrent.ratio.toFixed(2)} >= ${targetRatio}`;
    return "";
  }
  // ---------------------------------------------------------------------------
  async publishFailed(history, reason) {
    if (history.mediaId == null) return;
    await this.deps.host.call("events.publish", [
      { type: "acquisition.failed", mediaId: history.mediaId, title: history.sourceTitle, reason }
    ]);
  }
  /**
   * The plugin owns the `blocklist` table outright (`src/host-methods.ts` has
   * no blocklist host method — core deleted `blocklist.add`/`blocklist.check`
   * when the table moved here), so this is a single local write, simpler than
   * the host round trip it replaces: no RPC, no idempotency key, no scope.
   * `BlocklistRepository.insert`'s own doc-comment names this exact call
   * site. Swallows a failure exactly like upstream's own
   * `try { createFromHistory(...) } catch { /* already blocklisted *\/ }`.
   */
  async autoBlocklist(history, note) {
    const indexer = history.indexerId != null ? await this.deps.indexersRepo.findById(history.indexerId).catch(() => null) : null;
    try {
      await this.deps.blocklistRepo.insert({
        sourceTitle: history.sourceTitle,
        quality: history.quality ?? null,
        mediaId: history.mediaId ?? null,
        indexerId: history.indexerId ?? null,
        indexerName: indexer?.name ?? null,
        note
      });
    } catch {
    }
  }
};

// src/seams/jobs.ts
function mediaIdsArg(args) {
  const raw = args?.mediaIds;
  return Array.isArray(raw) && raw.every((x) => typeof x === "number") ? raw : void 0;
}
function createJobHandlers(deps) {
  return {
    SearchMissing: async (_jobId, args) => {
      await deps.grabPipeline.searchMissing(mediaIdsArg(args));
    },
    RssSync: async () => {
      await deps.grabPipeline.rssSync();
    },
    ImportCompleted: async () => {
      await deps.completionPoller.poll();
    },
    CleanStalled: async () => {
      await deps.completionPoller.cleanStalled();
    },
    CleanSeeded: async () => {
      await deps.completionPoller.cleanSeeded();
    }
  };
}

// scripts/manifest-template.ts
var PLUGIN_ID = "fliks.download";
var PERMISSIONS = {
  releases: "releases",
  indexers: "indexers",
  downloadClients: "download-clients",
  delayProfiles: "delay-profiles",
  queue: "queue",
  blocklist: "blocklist"
};
function subjectFor(name) {
  return `plugin:${PLUGIN_ID}:${name}`;
}
var POLICY = {
  releasesRead: `read:${subjectFor(PERMISSIONS.releases)}`,
  releasesGrab: `grab:${subjectFor(PERMISSIONS.releases)}`,
  indexersRead: `read:${subjectFor(PERMISSIONS.indexers)}`,
  indexersManage: `manage:${subjectFor(PERMISSIONS.indexers)}`,
  downloadClientsRead: `read:${subjectFor(PERMISSIONS.downloadClients)}`,
  downloadClientsManage: `manage:${subjectFor(PERMISSIONS.downloadClients)}`,
  delayProfilesRead: `read:${subjectFor(PERMISSIONS.delayProfiles)}`,
  queueRead: `read:${subjectFor(PERMISSIONS.queue)}`,
  blocklistRead: `read:${subjectFor(PERMISSIONS.blocklist)}`,
  blocklistManage: `manage:${subjectFor(PERMISSIONS.blocklist)}`
};
var ROUTES = [
  { method: "GET", path: "/:id/releases", policy: POLICY.releasesRead, objectGuard: "mediaAccessible:id" },
  { method: "POST", path: "/:id/grab", policy: POLICY.releasesGrab, objectGuard: "mediaAccessible:id" },
  {
    method: "GET",
    path: "/:id/seasons/:seasonId/releases",
    policy: POLICY.releasesRead,
    objectGuard: "mediaAccessible:id"
  },
  {
    method: "POST",
    path: "/:id/seasons/:seasonId/grab",
    policy: POLICY.releasesGrab,
    objectGuard: "mediaAccessible:id"
  },
  {
    method: "GET",
    path: "/:id/episodes/:episodeId/releases",
    policy: POLICY.releasesRead,
    objectGuard: "mediaAccessible:id"
  },
  {
    method: "POST",
    path: "/:id/episodes/:episodeId/grab",
    policy: POLICY.releasesGrab,
    objectGuard: "mediaAccessible:id"
  },
  { method: "GET", path: "/queue", policy: POLICY.queueRead },
  { method: "GET", path: "/indexers", policy: POLICY.indexersRead },
  { method: "POST", path: "/indexers", policy: POLICY.indexersManage },
  { method: "POST", path: "/indexers/test-connection", policy: POLICY.indexersManage },
  { method: "DELETE", path: "/indexers/cooldowns", policy: POLICY.indexersManage },
  { method: "GET", path: "/indexers/implementations", policy: POLICY.indexersRead },
  { method: "PUT", path: "/indexers/:id", policy: POLICY.indexersManage },
  { method: "DELETE", path: "/indexers/:id", policy: POLICY.indexersManage },
  { method: "DELETE", path: "/indexers/:id/cooldown", policy: POLICY.indexersManage },
  { method: "GET", path: "/indexers/:id/stats", policy: POLICY.indexersRead },
  { method: "GET", path: "/download-clients", policy: POLICY.downloadClientsRead },
  { method: "POST", path: "/download-clients", policy: POLICY.downloadClientsManage },
  { method: "POST", path: "/download-clients/test-connection", policy: POLICY.downloadClientsManage },
  { method: "GET", path: "/download-clients/implementations", policy: POLICY.downloadClientsRead },
  { method: "PUT", path: "/download-clients/:id", policy: POLICY.downloadClientsManage },
  { method: "DELETE", path: "/download-clients/:id", policy: POLICY.downloadClientsManage },
  { method: "GET", path: "/blocklist", policy: POLICY.blocklistRead },
  { method: "DELETE", path: "/blocklist/all", policy: POLICY.blocklistManage },
  { method: "DELETE", path: "/blocklist/:id", policy: POLICY.blocklistManage }
];
var RELEASE_PICKER = {
  movie: { search: "/:id/releases", grab: "/:id/grab" },
  season: { search: "/:id/seasons/:seasonId/releases", grab: "/:id/seasons/:seasonId/grab" },
  episode: { search: "/:id/episodes/:episodeId/releases", grab: "/:id/episodes/:episodeId/grab" }
};
var JOBS = [
  { name: "SearchMissing", cron: "0 0-23/6 * * *", triggerable: true, labelKey: "download.jobs.search_missing" },
  { name: "RssSync", cron: "*/15 * * * *", triggerable: true, labelKey: "download.jobs.rss_sync" },
  { name: "ImportCompleted", cron: "*/1 * * * *", triggerable: true, labelKey: "download.jobs.import_completed" },
  { name: "CleanStalled", cron: "0 */5 * * * *", triggerable: true, labelKey: "download.jobs.clean_stalled" },
  { name: "CleanSeeded", cron: "0 */5 * * * *", triggerable: true, labelKey: "download.jobs.clean_seeded" }
];
var CORE_REFS = ["episodes", "media", "seasons", "users"];
var SCOPES = [
  "media:read",
  "acquisition:candidates",
  "releases:score",
  "requests:progress",
  "ingest:write",
  "events:emit",
  "config:rw"
];
var INGEST_ROOTS = ["/downloads"];
function settingsPagePath(view) {
  return `/admin/settings/plugins/${PLUGIN_ID}/${view}`;
}
var UI_CONTRIBUTIONS = [
  {
    id: "fliks-download.settings.general",
    slot: "settings.page",
    weight: 100,
    labelKey: "download.config.general.title",
    icon: "download",
    action: { kind: "route", path: settingsPagePath("general") }
  },
  {
    id: "fliks-download.settings.indexers",
    slot: "settings.page",
    weight: 110,
    labelKey: "download.config.indexers.title",
    icon: "search",
    action: { kind: "route", path: settingsPagePath("indexers") }
  },
  {
    id: "fliks-download.settings.download-clients",
    slot: "settings.page",
    weight: 120,
    labelKey: "download.config.download_clients.title",
    icon: "server",
    action: { kind: "route", path: settingsPagePath("download-clients") }
  },
  {
    // Main-navigation page, not a settings one — stays top-level, outside the admin shell.
    id: "fliks-download.nav.queue",
    slot: "nav.acquisition",
    weight: 100,
    labelKey: "download.config.queue.title",
    icon: "download",
    action: { kind: "route", path: `/plugins/${PLUGIN_ID}/queue` }
  },
  {
    // Core owns the release picker and declares these two action ids; this plugin only
    // contributes the entries that open it, so nothing about grabbing shows without it.
    id: "fliks-download.media.grab-best",
    slot: "media.actions",
    weight: 500,
    labelKey: "download.media.grab_best",
    icon: "download",
    when: ["hasPermission:media.grab", "!mediaType:series", "hasQualityProfile"],
    action: { kind: "action", actionId: "media.grab-best" }
  },
  {
    id: "fliks-download.media.search-releases",
    slot: "media.actions",
    weight: 600,
    labelKey: "download.media.search_releases",
    icon: "search",
    when: ["hasPermission:media.grab", "!mediaType:series", "hasQualityProfile"],
    action: { kind: "action", actionId: "media.search-releases" }
  },
  {
    id: "fliks-download.season.search-releases",
    slot: "media.season.actions",
    weight: 500,
    labelKey: "download.season.search_releases",
    icon: "package",
    when: ["hasPermission:media.grab", "hasQualityProfile"],
    action: { kind: "action", actionId: "season.search-releases" }
  },
  {
    id: "fliks-download.season.grab-best",
    slot: "media.season.actions",
    weight: 600,
    labelKey: "download.season.grab_best",
    icon: "download",
    when: ["hasPermission:media.grab", "hasQualityProfile"],
    action: { kind: "action", actionId: "season.grab-best" }
  }
];
var CONFIG_PAGES = [
  {
    id: "general",
    labelKey: "download.config.general.title",
    icon: "download",
    fields: [
      {
        key: "requestsAutoGrabOnApproval",
        type: "toggle",
        labelKey: "download.config.general.auto_grab_on_approval",
        hint: "download.config.general.auto_grab_on_approval_hint",
        default: true
      },
      // No default: an unset sample count means no cleanup, and this path deletes
      // torrents along with their files.
      {
        key: "stall_samples",
        type: "number",
        labelKey: "download.config.stall.samples",
        hint: "download.config.stall.samples_hint"
      },
      {
        key: "stall_interval_minutes",
        type: "number",
        labelKey: "download.config.stall.interval_minutes",
        hint: "download.config.stall.interval_minutes_hint",
        default: 60
      },
      {
        key: "stall_auto_restart",
        type: "toggle",
        labelKey: "download.config.stall.auto_restart",
        hint: "download.config.stall.auto_restart_hint",
        default: true
      },
      {
        key: "stall_include_manual_grabs",
        type: "toggle",
        labelKey: "download.config.stall.include_manual_grabs",
        hint: "download.config.stall.include_manual_grabs_hint",
        default: false
      }
    ]
  },
  {
    id: "indexers",
    kind: "providers",
    labelKey: "download.config.indexers.title",
    icon: "search",
    list: "/indexers",
    implementations: "/indexers/implementations",
    testConnection: { route: "/indexers/test-connection" },
    showPriority: true,
    defaultPriority: 25,
    labels: {
      newKey: "download.config.indexers.labels.new",
      emptyKey: "download.config.indexers.labels.empty",
      testKey: "download.config.indexers.labels.test",
      deleteConfirmKey: "download.config.indexers.labels.delete_confirm",
      createTitleKey: "download.config.indexers.labels.create_title",
      editTitleKey: "download.config.indexers.labels.edit_title"
    },
    actions: [
      {
        id: "stats",
        labelKey: "download.config.indexers.actions.stats",
        method: "GET",
        route: "/indexers/:id/stats",
        scope: "row",
        // Columns of `dailyStats` — a `GET` without them renders no button at all.
        result: {
          kind: "table",
          emptyKey: "download.config.indexers.stats.empty",
          columns: [
            { key: "date", labelKey: "download.config.indexers.stats.date" },
            { key: "queries", labelKey: "download.config.indexers.stats.queries" },
            { key: "avgResponseMs", labelKey: "download.config.indexers.stats.avg_response" },
            { key: "totalResults", labelKey: "download.config.indexers.stats.results" },
            { key: "errors", labelKey: "download.config.indexers.stats.errors" }
          ]
        }
      },
      {
        id: "clear-cooldown",
        labelKey: "download.config.indexers.actions.clear_cooldown",
        method: "DELETE",
        route: "/indexers/:id/cooldown",
        scope: "row"
      },
      {
        id: "clear-all-cooldowns",
        labelKey: "download.config.indexers.actions.clear_all_cooldowns",
        method: "DELETE",
        route: "/indexers/cooldowns",
        scope: "list"
      }
    ]
  },
  {
    id: "download-clients",
    kind: "providers",
    labelKey: "download.config.download_clients.title",
    icon: "server",
    list: "/download-clients",
    implementations: "/download-clients/implementations",
    testConnection: { route: "/download-clients/test-connection" },
    // Unlike the old core page (`showPriority: false`), priority genuinely gates
    // behaviour here — `pickClient` grabs to the first enabled client in priority order.
    showPriority: true,
    defaultPriority: 1,
    labels: {
      newKey: "download.config.download_clients.labels.new",
      emptyKey: "download.config.download_clients.labels.empty",
      testKey: "download.config.download_clients.labels.test",
      deleteConfirmKey: "download.config.download_clients.labels.delete_confirm",
      createTitleKey: "download.config.download_clients.labels.create_title",
      editTitleKey: "download.config.download_clients.labels.edit_title"
    }
  },
  {
    id: "queue",
    kind: "table",
    labelKey: "download.config.queue.title",
    icon: "download",
    list: "/queue",
    paged: true,
    pageSize: 25,
    columns: [
      { key: "title", labelKey: "download.config.queue.columns.title" },
      { key: "state", labelKey: "download.config.queue.columns.state" },
      { key: "progress", labelKey: "download.config.queue.columns.progress", format: "percent" },
      { key: "bytesPerSecond", labelKey: "download.config.queue.columns.speed", format: "bytes" }
    ],
    // Reads mediaId/mediaType straight off each row — core's own resolver renders no
    // button when either is null, so an unresolved row is simply inert, not broken.
    rowActions: [
      { kind: "action", labelKey: "download.config.queue.actions.open_media", actionId: "table.open-media" }
    ]
  }
];
var I18N = {
  en: {
    "download.config.indexers.fields.max_retention_days": "Maximum seeding days",
    "download.config.indexers.fields.max_retention_days_hint": "Remove a finished torrent this many days after it completed, even if the share ratio is not reached. Leave empty to wait for the ratio alone.",
    "download.config.indexers.labels.create_title": "New indexer",
    "download.config.indexers.labels.edit_title": "Edit indexer",
    "download.config.download_clients.labels.create_title": "New download client",
    "download.config.download_clients.labels.edit_title": "Edit download client",
    "download.season.search_releases": "View packs",
    "download.season.grab_best": "Download the season",
    "download.media.grab_best": "Grab the best release",
    "download.media.search_releases": "Search releases",
    "download.config.stall.samples": "Stalled-download checks before cleanup",
    "download.config.stall.samples_hint": "Leave empty to never clean up stalled downloads. Removing one deletes the torrent and its files.",
    "download.config.stall.interval_minutes": "Minutes between checks",
    "download.config.stall.interval_minutes_hint": "How long to wait before sampling a download\u2019s progress again.",
    "download.config.stall.auto_restart": "Search again after cleanup",
    "download.config.stall.auto_restart_hint": "Look for another release once a stalled download has been removed.",
    "download.config.stall.include_manual_grabs": "Include downloads you started yourself",
    "download.config.stall.include_manual_grabs_hint": "By default only downloads the scheduler grabbed are cleaned up.",
    "download.config.general.title": "General",
    "download.config.general.auto_grab_on_approval": "Auto-grab on request approval",
    "download.config.general.auto_grab_on_approval_hint": "Start a search automatically when an admin approves a request.",
    "download.jobs.search_missing": "Search missing",
    "download.jobs.rss_sync": "RSS sync",
    "download.jobs.import_completed": "Import completed downloads",
    "download.jobs.clean_stalled": "Clean stalled downloads",
    "download.jobs.clean_seeded": "Clean seeded downloads",
    // Connection-test outcomes: the key names the reason, `detail` carries the
    // indexer's own text or an HTTP status — the `rejections[].code` split.
    "download.indexers.test.ok": "Capabilities read, connection OK",
    "download.indexers.test.base_url_missing": "Base URL is empty",
    "download.indexers.test.http_error": "The indexer answered with an HTTP error",
    "download.indexers.test.torznab_error": "The indexer reported an error",
    "download.indexers.test.unexpected_response": "Unexpected response \u2014 not a Torznab capabilities document",
    "download.indexers.test.network_error": "Could not reach the indexer",
    "download.indexers.test.unknown_implementation": "This indexer type is not supported",
    "download.download_clients.test.ok": "Connected successfully",
    "download.download_clients.test.host_missing": "Host is required",
    "download.download_clients.test.auth_failed": "Authentication failed \u2014 check the credentials",
    "download.download_clients.test.network_error": "Could not reach the download client",
    "download.download_clients.test.unsupported_implementation": "This download client type is not supported",
    // Persisted as the value of `blocklist.note` and `statusMessage`, so a row
    // written today still renders in whatever language the reader picked.
    "download.download_clients.block.reason": "Blocked from the activity queue",
    // Thrown by the grab pipeline (`GrabError.messageKey`), surfaced verbatim as the
    // `error.key` of an HTTP route's error response — see `src/seams/http-routes.ts`.
    "download.grab.errors.media_not_found": "No media found for this request",
    "download.grab.errors.no_download_client": "No enabled download client is configured",
    "download.grab.errors.unprofiled": "This title has no quality profile \u2014 nothing to grab",
    "download.grab.errors.blocklisted": "This release is blocklisted",
    "download.grab.errors.quality_not_allowed": "This release's quality is not allowed by the profile",
    "download.grab.errors.no_eligible_release": "No eligible release was found",
    // The HTTP route table's own errors — unmatched path/resource, a malformed param or
    // body field, not-yet-ready, unexpected failure.
    "download.http.errors.not_found": "Not found",
    "download.http.errors.not_ready": "The plugin is still starting up",
    "download.http.errors.bad_param": "Invalid or missing path parameter",
    "download.http.errors.bad_body": "Invalid or missing field in the request body",
    "download.http.errors.internal": "Something went wrong handling this request",
    "download.config.indexers.title": "Indexers",
    "download.config.indexers.implementations.torznab": "Torznab",
    "download.config.indexers.fields.base_url": "Base URL",
    "download.config.indexers.fields.api_key": "API key",
    "download.config.indexers.fields.request_delay": "Request delay (seconds)",
    "download.config.indexers.fields.request_delay_hint": "Minimum time between two search requests sent to this indexer.",
    "download.config.indexers.fields.enable_search": "Enable in search",
    "download.config.indexers.fields.min_seeders": "Minimum seeders",
    "download.config.indexers.fields.seed_ratio": "Seed ratio target",
    "download.config.indexers.fields.seed_ratio_hint": "A completed download is removed from the client once it reaches this ratio.",
    "download.config.indexers.fields.unknown_language": "Unknown-language code",
    "download.config.indexers.fields.unknown_language_hint": "ISO 639-1 code to assume when a release does not name its language.",
    "download.config.indexers.labels.new": "New indexer",
    "download.config.indexers.labels.empty": "No indexers configured",
    "download.config.indexers.labels.test": "Test connection",
    "download.config.indexers.labels.delete_confirm": "Delete this indexer?",
    "download.config.indexers.actions.stats": "Stats",
    "download.config.indexers.stats.date": "Date",
    "download.config.indexers.stats.queries": "Queries",
    "download.config.indexers.stats.avg_response": "Avg response (ms)",
    "download.config.indexers.stats.results": "Results",
    "download.config.indexers.stats.errors": "Errors",
    "download.config.indexers.stats.empty": "No query recorded in the last 30 days.",
    "download.config.indexers.actions.clear_cooldown": "Clear cooldown",
    "download.config.indexers.actions.clear_all_cooldowns": "Clear all cooldowns",
    "download.config.download_clients.title": "Download clients",
    "download.config.download_clients.implementations.qbittorrent": "qBittorrent",
    "download.config.download_clients.fields.host": "Host",
    "download.config.download_clients.fields.port": "Port",
    "download.config.download_clients.fields.use_ssl": "Use HTTPS",
    "download.config.download_clients.fields.username": "Username",
    "download.config.download_clients.fields.password": "Password",
    "download.config.download_clients.fields.category": "Category",
    "download.config.download_clients.fields.movie_category": "Movie category",
    "download.config.download_clients.fields.series_category": "Series category",
    "download.config.download_clients.labels.new": "New download client",
    "download.config.download_clients.labels.empty": "No download clients configured",
    "download.config.download_clients.labels.test": "Test connection",
    "download.config.download_clients.labels.delete_confirm": "Delete this download client?",
    "download.config.queue.title": "Queue",
    "download.config.queue.columns.title": "Title",
    "download.config.queue.columns.state": "State",
    "download.config.queue.columns.progress": "Progress",
    "download.config.queue.columns.speed": "Speed",
    "download.config.queue.actions.open_media": "Open"
  },
  // Vocabulary matches Fliks' own fr.json for the same ideas (priorité, tester la connexion,
  // clé API, client de téléchargement, profil de qualité) rather than inventing new terms.
  fr: {
    "download.config.indexers.fields.max_retention_days": "Jours de partage maximum",
    "download.config.indexers.fields.max_retention_days_hint": "Supprime un torrent termin\xE9 ce nombre de jours apr\xE8s sa fin, m\xEAme si le ratio de partage n'est pas atteint. Laisser vide pour n'attendre que le ratio.",
    "download.config.indexers.labels.create_title": "Nouvel indexeur",
    "download.config.indexers.labels.edit_title": "Modifier l'indexeur",
    "download.config.download_clients.labels.create_title": "Nouveau client de t\xE9l\xE9chargement",
    "download.config.download_clients.labels.edit_title": "Modifier le client de t\xE9l\xE9chargement",
    "download.season.search_releases": "Voir les packs",
    "download.season.grab_best": "T\xE9l\xE9charger la saison",
    "download.media.grab_best": "R\xE9cup\xE9rer la meilleure release",
    "download.media.search_releases": "Rechercher des releases",
    "download.config.stall.samples": "V\xE9rifications avant nettoyage d\u2019un t\xE9l\xE9chargement bloqu\xE9",
    "download.config.stall.samples_hint": "Laissez vide pour ne jamais nettoyer les t\xE9l\xE9chargements bloqu\xE9s. Supprimer un torrent efface aussi ses fichiers.",
    "download.config.stall.interval_minutes": "Minutes entre deux v\xE9rifications",
    "download.config.stall.interval_minutes_hint": "D\xE9lai d\u2019attente avant de v\xE9rifier \xE0 nouveau la progression d\u2019un t\xE9l\xE9chargement.",
    "download.config.stall.auto_restart": "Relancer une recherche apr\xE8s nettoyage",
    "download.config.stall.auto_restart_hint": "Cherche une autre release une fois le t\xE9l\xE9chargement bloqu\xE9 supprim\xE9.",
    "download.config.stall.include_manual_grabs": "Inclure les t\xE9l\xE9chargements que vous avez lanc\xE9s vous-m\xEAme",
    "download.config.stall.include_manual_grabs_hint": "Par d\xE9faut, seuls les t\xE9l\xE9chargements lanc\xE9s par la planification sont nettoy\xE9s.",
    "download.config.general.title": "G\xE9n\xE9ral",
    "download.config.general.auto_grab_on_approval": "T\xE9l\xE9charger automatiquement apr\xE8s l\u2019approbation d\u2019une demande",
    "download.config.general.auto_grab_on_approval_hint": "Lance une recherche automatiquement quand un administrateur approuve une demande.",
    "download.jobs.search_missing": "Recherche des m\xE9dias manquants",
    "download.jobs.rss_sync": "Synchronisation RSS",
    "download.jobs.import_completed": "Import des t\xE9l\xE9chargements termin\xE9s",
    "download.jobs.clean_stalled": "Nettoyage des torrents bloqu\xE9s",
    "download.jobs.clean_seeded": "Nettoyage des torrents seed\xE9s",
    "download.indexers.test.ok": "Capacit\xE9s lues, connexion OK",
    "download.indexers.test.base_url_missing": "L\u2019URL de base est vide",
    "download.indexers.test.http_error": "L\u2019indexeur a r\xE9pondu avec une erreur HTTP",
    "download.indexers.test.torznab_error": "L\u2019indexeur a signal\xE9 une erreur",
    "download.indexers.test.unexpected_response": "R\xE9ponse inattendue \u2014 pas un document de capacit\xE9s Torznab",
    "download.indexers.test.network_error": "Impossible de contacter l\u2019indexeur",
    "download.indexers.test.unknown_implementation": "Ce type d\u2019indexeur n\u2019est pas pris en charge",
    "download.download_clients.test.ok": "Connexion r\xE9ussie",
    "download.download_clients.test.host_missing": "L\u2019h\xF4te est obligatoire",
    "download.download_clients.test.auth_failed": "Authentification \xE9chou\xE9e \u2014 v\xE9rifiez les identifiants",
    "download.download_clients.test.network_error": "Impossible de contacter le client de t\xE9l\xE9chargement",
    "download.download_clients.test.unsupported_implementation": "Ce type de client de t\xE9l\xE9chargement n\u2019est pas pris en charge",
    "download.download_clients.block.reason": "Bloqu\xE9 depuis la file d\u2019activit\xE9",
    "download.grab.errors.media_not_found": "Aucun m\xE9dia trouv\xE9 pour cette demande",
    "download.grab.errors.no_download_client": "Aucun client de t\xE9l\xE9chargement actif n\u2019est configur\xE9",
    "download.grab.errors.unprofiled": "Ce titre n\u2019a pas de profil de qualit\xE9 \u2014 rien \xE0 t\xE9l\xE9charger",
    "download.grab.errors.blocklisted": "Cette release est sur liste de blocage",
    "download.grab.errors.quality_not_allowed": "La qualit\xE9 de cette release n\u2019est pas autoris\xE9e par le profil",
    "download.grab.errors.no_eligible_release": "Aucune release \xE9ligible n\u2019a \xE9t\xE9 trouv\xE9e",
    "download.http.errors.not_found": "Introuvable",
    "download.http.errors.not_ready": "Le plugin est encore en cours de d\xE9marrage",
    "download.http.errors.bad_param": "Param\xE8tre d\u2019URL invalide ou manquant",
    "download.http.errors.bad_body": "Champ invalide ou manquant dans le corps de la requ\xEAte",
    "download.http.errors.internal": "Une erreur est survenue lors du traitement de cette requ\xEAte",
    "download.config.indexers.title": "Indexeurs",
    "download.config.indexers.implementations.torznab": "Torznab",
    "download.config.indexers.fields.base_url": "URL de base",
    "download.config.indexers.fields.api_key": "Cl\xE9 API",
    "download.config.indexers.fields.request_delay": "D\xE9lai entre requ\xEAtes (secondes)",
    "download.config.indexers.fields.request_delay_hint": "D\xE9lai minimum entre deux requ\xEAtes de recherche envoy\xE9es \xE0 cet indexeur.",
    "download.config.indexers.fields.enable_search": "Activer dans la recherche",
    "download.config.indexers.fields.min_seeders": "Nombre minimum de seeders",
    "download.config.indexers.fields.seed_ratio": "Ratio de partage cible",
    "download.config.indexers.fields.seed_ratio_hint": "Un t\xE9l\xE9chargement termin\xE9 est retir\xE9 du client une fois ce ratio atteint.",
    "download.config.indexers.fields.unknown_language": "Code de langue par d\xE9faut",
    "download.config.indexers.fields.unknown_language_hint": "Code ISO 639-1 \xE0 utiliser quand une release ne pr\xE9cise pas sa langue.",
    "download.config.indexers.labels.new": "Nouvel indexeur",
    "download.config.indexers.labels.empty": "Aucun indexeur configur\xE9",
    "download.config.indexers.labels.test": "Tester la connexion",
    "download.config.indexers.labels.delete_confirm": "Supprimer cet indexeur ?",
    "download.config.indexers.actions.stats": "Stats",
    "download.config.indexers.stats.date": "Date",
    "download.config.indexers.stats.queries": "Requ\xEAtes",
    "download.config.indexers.stats.avg_response": "R\xE9ponse moy. (ms)",
    "download.config.indexers.stats.results": "R\xE9sultats",
    "download.config.indexers.stats.errors": "Erreurs",
    "download.config.indexers.stats.empty": "Aucune requ\xEAte enregistr\xE9e sur les 30 derniers jours.",
    "download.config.indexers.actions.clear_cooldown": "R\xE9initialiser le cooldown",
    "download.config.indexers.actions.clear_all_cooldowns": "R\xE9initialiser tous les cooldowns",
    "download.config.download_clients.title": "Clients de t\xE9l\xE9chargement",
    "download.config.download_clients.implementations.qbittorrent": "qBittorrent",
    "download.config.download_clients.fields.host": "H\xF4te",
    "download.config.download_clients.fields.port": "Port",
    "download.config.download_clients.fields.use_ssl": "Utiliser HTTPS",
    "download.config.download_clients.fields.username": "Nom d\u2019utilisateur",
    "download.config.download_clients.fields.password": "Mot de passe",
    "download.config.download_clients.fields.category": "Cat\xE9gorie",
    "download.config.download_clients.fields.movie_category": "Cat\xE9gorie films",
    "download.config.download_clients.fields.series_category": "Cat\xE9gorie s\xE9ries",
    "download.config.download_clients.labels.new": "Nouveau client de t\xE9l\xE9chargement",
    "download.config.download_clients.labels.empty": "Aucun client de t\xE9l\xE9chargement configur\xE9",
    "download.config.download_clients.labels.test": "Tester la connexion",
    "download.config.download_clients.labels.delete_confirm": "Supprimer ce client de t\xE9l\xE9chargement ?",
    "download.config.queue.title": "File d\u2019attente",
    "download.config.queue.columns.title": "Titre",
    "download.config.queue.columns.state": "\xC9tat",
    "download.config.queue.columns.progress": "Progression",
    "download.config.queue.columns.speed": "Vitesse",
    "download.config.queue.actions.open_media": "Ouvrir"
  }
};
var MANIFEST_TEMPLATE = {
  id: PLUGIN_ID,
  pluginApi: 0,
  name: "Download",
  fliks: ">=2.0.0 <3.0.0",
  author: "Fliks",
  description: "Indexer search, download-client management and the acquisition grab pipeline for Fliks.",
  license: "AGPL-3.0-or-later",
  logo: "logo.svg",
  kind: "process",
  runtime: "node",
  memoryMb: 256,
  database: { schema: true, coreRefs: [...CORE_REFS] },
  routes: ROUTES,
  scopes: [...SCOPES],
  ingestRoots: INGEST_ROOTS,
  jobs: JOBS,
  permissions: Object.values(PERMISSIONS),
  ui: {
    contributions: UI_CONTRIBUTIONS,
    configPages: CONFIG_PAGES,
    releasePicker: RELEASE_PICKER
  },
  i18n: I18N
};

// src/seams/http-routes.ts
function jsonResponse(status, body) {
  return { status, headers: { "content-type": "application/json" }, body };
}
function badRequest(param) {
  return jsonResponse(400, { error: { key: "download.http.errors.bad_param", detail: param } });
}
function badBody(field) {
  return jsonResponse(400, { error: { key: "download.http.errors.bad_body", detail: field } });
}
function notFoundResponse(detail) {
  return jsonResponse(404, { error: { key: "download.http.errors.not_found", detail } });
}
function grabErrorResponse(err) {
  const status = err.messageKey === "download.grab.errors.media_not_found" ? 404 : 409;
  return jsonResponse(status, { error: { key: err.messageKey, detail: err.detail } });
}
function describePrincipal(p) {
  return p.kind === "delegated" ? `user #${p.userId}` : "system";
}
function requireIntParam(params, name) {
  return /^[1-9]\d*$/.test(params[name] ?? "") ? Number(params[name]) : null;
}
function optionalIntParam(params, name) {
  if (!(name in params)) return void 0;
  const n = /^[1-9]\d*$/.test(params[name]) ? Number(params[name]) : null;
  return n;
}
function readCreateIndexerInput(body) {
  const b = body ?? {};
  if (typeof b.name !== "string" || !b.name.trim()) return "name";
  if (typeof b.implementation !== "string" || !b.implementation) return "implementation";
  return {
    name: b.name,
    implementation: b.implementation,
    settings: typeof b.settings === "object" && b.settings !== null ? b.settings : void 0,
    enableRss: typeof b.enableRss === "boolean" ? b.enableRss : void 0,
    enableSearch: typeof b.enableSearch === "boolean" ? b.enableSearch : void 0,
    priority: typeof b.priority === "number" ? b.priority : void 0,
    requestDelay: typeof b.requestDelay === "number" ? b.requestDelay : void 0,
    enabled: typeof b.enabled === "boolean" ? b.enabled : void 0
  };
}
function readUpdateIndexerInput(body) {
  const b = body ?? {};
  return {
    name: typeof b.name === "string" ? b.name : void 0,
    implementation: typeof b.implementation === "string" ? b.implementation : void 0,
    settings: typeof b.settings === "object" && b.settings !== null ? b.settings : void 0,
    enableRss: typeof b.enableRss === "boolean" ? b.enableRss : void 0,
    enableSearch: typeof b.enableSearch === "boolean" ? b.enableSearch : void 0,
    priority: typeof b.priority === "number" ? b.priority : void 0,
    requestDelay: typeof b.requestDelay === "number" ? b.requestDelay : void 0,
    enabled: typeof b.enabled === "boolean" ? b.enabled : void 0
  };
}
function readTestIndexerConnectionInput(body) {
  const b = body ?? {};
  if (typeof b.implementation !== "string") return null;
  const settings = typeof b.settings === "object" && b.settings !== null ? b.settings : {};
  return { implementation: b.implementation, settings };
}
function readCreateDownloadClientInput(body) {
  const b = body ?? {};
  if (typeof b.name !== "string" || !b.name.trim()) return "name";
  if (typeof b.implementation !== "string" || !b.implementation) return "implementation";
  return {
    name: b.name,
    implementation: b.implementation,
    settings: typeof b.settings === "object" && b.settings !== null ? b.settings : void 0,
    enabled: typeof b.enabled === "boolean" ? b.enabled : void 0,
    priority: typeof b.priority === "number" ? b.priority : void 0
  };
}
function readUpdateDownloadClientInput(body) {
  const b = body ?? {};
  return {
    name: typeof b.name === "string" ? b.name : void 0,
    implementation: typeof b.implementation === "string" ? b.implementation : void 0,
    settings: typeof b.settings === "object" && b.settings !== null ? b.settings : void 0,
    enabled: typeof b.enabled === "boolean" ? b.enabled : void 0,
    priority: typeof b.priority === "number" ? b.priority : void 0
  };
}
function readTestDownloadClientInput(body) {
  const b = body ?? {};
  if (typeof b.implementation !== "string") return null;
  const settings = typeof b.settings === "object" && b.settings !== null ? b.settings : {};
  return { implementation: b.implementation, settings };
}
async function handleSearchReleases(deps, params, req) {
  const mediaId = requireIntParam(params, "id");
  if (mediaId === null) return badRequest("id");
  const seasonId = optionalIntParam(params, "seasonId");
  if (seasonId === null) return badRequest("seasonId");
  const episodeId = optionalIntParam(params, "episodeId");
  if (episodeId === null) return badRequest("episodeId");
  const customQuery = typeof req.query?.["q"] === "string" ? req.query["q"] : void 0;
  const releases = await deps.grabPipeline.searchReleases(mediaId, seasonId, episodeId, customQuery);
  return jsonResponse(200, releases.map(toWireRelease));
}
function toWireRelease({ indexerId, indexerName, ...rest }) {
  return { ...rest, sourceId: indexerId, sourceName: indexerName };
}
function readManualGrabInput(body) {
  const b = body ?? {};
  const downloadUrl = b["downloadUrl"];
  if (typeof downloadUrl !== "string" || !downloadUrl) return void 0;
  return {
    downloadUrl,
    sourceTitle: typeof b["sourceTitle"] === "string" ? b["sourceTitle"] : void 0,
    indexerId: typeof b["sourceId"] === "number" ? b["sourceId"] : void 0
  };
}
async function handleGrab(deps, params, req) {
  const mediaId = requireIntParam(params, "id");
  if (mediaId === null) return badRequest("id");
  const seasonId = optionalIntParam(params, "seasonId");
  if (seasonId === null) return badRequest("seasonId");
  const episodeId = optionalIntParam(params, "episodeId");
  if (episodeId === null) return badRequest("episodeId");
  log.info(`grab http request for media #${mediaId} by ${describePrincipal(req.principal)}`);
  const result = await deps.grabPipeline.grabRelease(mediaId, seasonId, episodeId, readManualGrabInput(req.body));
  return jsonResponse(200, result);
}
async function handleListIndexers(deps) {
  return jsonResponse(200, await deps.indexerService.findAll());
}
async function handleListDownloadClients(deps) {
  return jsonResponse(200, await deps.downloadClientsService.findAll());
}
async function handleCreateIndexer(deps, req) {
  const input = readCreateIndexerInput(req.body);
  if (typeof input === "string") return badBody(input);
  return jsonResponse(201, await deps.indexerService.create(input));
}
async function handleUpdateIndexer(deps, params, req) {
  const id = requireIntParam(params, "id");
  if (id === null) return badRequest("id");
  return jsonResponse(200, await deps.indexerService.update(id, readUpdateIndexerInput(req.body)));
}
async function handleDeleteIndexer(deps, params) {
  const id = requireIntParam(params, "id");
  if (id === null) return badRequest("id");
  await deps.indexerService.remove(id);
  return jsonResponse(200, {});
}
async function handleTestIndexerConnection(deps, req) {
  const input = readTestIndexerConnectionInput(req.body);
  if (!input) return badBody("implementation");
  return jsonResponse(200, await deps.indexerService.testConnection(input));
}
async function handleIndexerStats(deps, params) {
  const id = requireIntParam(params, "id");
  if (id === null) return badRequest("id");
  const since = /* @__PURE__ */ new Date();
  since.setDate(since.getDate() - 30);
  return jsonResponse(200, await deps.indexerStats.dailyStats(id, since.toISOString()));
}
async function handleClearIndexerCooldown(deps, params) {
  const id = requireIntParam(params, "id");
  if (id === null) return badRequest("id");
  return jsonResponse(200, await deps.indexerService.clearCooldown(id));
}
async function handleClearAllIndexerCooldowns(deps) {
  return jsonResponse(200, deps.indexerService.clearAllCooldowns());
}
async function handleCreateDownloadClient(deps, req) {
  const input = readCreateDownloadClientInput(req.body);
  if (typeof input === "string") return badBody(input);
  return jsonResponse(201, await deps.downloadClientsService.create(input));
}
async function handleUpdateDownloadClient(deps, params, req) {
  const id = requireIntParam(params, "id");
  if (id === null) return badRequest("id");
  return jsonResponse(200, await deps.downloadClientsService.update(id, readUpdateDownloadClientInput(req.body)));
}
async function handleDeleteDownloadClient(deps, params) {
  const id = requireIntParam(params, "id");
  if (id === null) return badRequest("id");
  await deps.downloadClientsService.remove(id);
  return jsonResponse(200, {});
}
async function handleTestDownloadClientConnection(deps, req) {
  const input = readTestDownloadClientInput(req.body);
  if (!input) return badBody("implementation");
  return jsonResponse(200, await deps.downloadClientsService.testConnection(input));
}
async function handleListBlocklist(deps, req) {
  const page = Math.max(1, Math.trunc(Number(req.query["page"])) || 1);
  const pageSize = Math.max(1, Math.trunc(Number(req.query["pageSize"])) || 25);
  const { items, total } = await deps.blocklist.list(pageSize, (page - 1) * pageSize);
  return jsonResponse(200, { data: items, total, page, pageSize });
}
async function handleClearBlocklist(deps) {
  await deps.blocklist.clear();
  return jsonResponse(200, {});
}
async function handleRemoveBlocklistEntry(deps, params) {
  const id = requireIntParam(params, "id");
  if (id === null) return badRequest("id");
  const existing = await deps.blocklist.findById(id);
  if (!existing) return notFoundResponse(String(id));
  await deps.blocklist.remove(id);
  return jsonResponse(200, {});
}
var QUEUE_STATUSES = ["grabbed", "importing"];
async function indexClientTorrents(deps) {
  const clients = await deps.downloadClientsRepo.listEnabled();
  const byClientId = /* @__PURE__ */ new Map();
  let anyUnreachable = false;
  await Promise.all(
    clients.map(async (client) => {
      const driver = deps.downloadClientDrivers[client.implementation];
      if (!driver || !driver.supports(client)) return;
      const result = await driver.getTorrentsResult(client);
      if (!result.ok) anyUnreachable = true;
      byClientId.set(client.id, {
        ok: result.ok,
        byHash: new Map(result.torrents.map((t) => [t.hash.toLowerCase(), t]))
      });
    })
  );
  return { byClientId, anyUnreachable };
}
function toQueueItem(row, byClientId) {
  const base = { id: row.id, title: row.sourceTitle, quality: row.quality, mediaId: row.mediaId, mediaType: null };
  if (row.status === "importing") {
    return { ...base, state: "importing", progress: 1, bytesPerSecond: null, clientReachable: true };
  }
  const index = row.downloadClientId != null ? byClientId.get(row.downloadClientId) : void 0;
  const torrent = index && row.torrentHash ? index.byHash.get(row.torrentHash.toLowerCase()) : void 0;
  if (torrent) {
    return {
      ...base,
      state: torrentProgressState(torrent),
      progress: torrent.progress,
      bytesPerSecond: torrent.dlspeed,
      clientReachable: true
    };
  }
  return { ...base, state: "queued", progress: null, bytesPerSecond: null, clientReachable: index?.ok ?? false };
}
async function attachMediaTypes(deps, pageItems) {
  const mediaIds = [...new Set(pageItems.map((item) => item.mediaId).filter((id) => id != null))];
  if (!mediaIds.length) return pageItems;
  const resolved = await deps.host.call("media.resolve", { mediaIds });
  return pageItems.map((item) => {
    if (item.mediaId == null) return item;
    const hit = resolved[`media:${item.mediaId}`];
    return hit ? { ...item, mediaType: hit.kind } : item;
  });
}
async function handleQueue(deps, req) {
  const page = Math.max(1, Math.trunc(Number(req.query["page"])) || 1);
  const pageSize = Math.max(1, Math.trunc(Number(req.query["pageSize"])) || 25);
  const [rows, { byClientId, anyUnreachable }] = await Promise.all([
    deps.downloadHistory.findByStatuses(QUEUE_STATUSES),
    indexClientTorrents(deps)
  ]);
  const items = rows.map((row) => toQueueItem(row, byClientId)).sort((a, b) => b.id - a.id);
  const start = (page - 1) * pageSize;
  const data = await attachMediaTypes(deps, items.slice(start, start + pageSize));
  return jsonResponse(200, {
    data,
    total: items.length,
    page,
    pageSize,
    clientsUnreachable: anyUnreachable
  });
}
var INDEXER_IMPLEMENTATIONS = [
  {
    implementation: "torznab",
    labelKey: "download.config.indexers.implementations.torznab",
    fields: [
      { key: "baseUrl", type: "url", labelKey: "download.config.indexers.fields.base_url", required: true },
      { key: "apiKey", type: "password", labelKey: "download.config.indexers.fields.api_key", secret: true },
      {
        key: "requestDelay",
        type: "number",
        labelKey: "download.config.indexers.fields.request_delay",
        hint: "download.config.indexers.fields.request_delay_hint",
        default: 2,
        topLevel: true
      },
      {
        key: "enableSearch",
        type: "toggle",
        labelKey: "download.config.indexers.fields.enable_search",
        default: true,
        topLevel: true
      },
      { key: "minSeeders", type: "number", labelKey: "download.config.indexers.fields.min_seeders", default: 0 },
      {
        key: "seedRatio",
        type: "number",
        labelKey: "download.config.indexers.fields.seed_ratio",
        hint: "download.config.indexers.fields.seed_ratio_hint",
        default: 1
      },
      {
        key: "maxRetentionDays",
        type: "number",
        labelKey: "download.config.indexers.fields.max_retention_days",
        hint: "download.config.indexers.fields.max_retention_days_hint"
      },
      {
        key: "unknownLanguageIsoCode",
        type: "text",
        labelKey: "download.config.indexers.fields.unknown_language",
        hint: "download.config.indexers.fields.unknown_language_hint"
      }
    ]
  }
];
var DOWNLOAD_CLIENT_IMPLEMENTATIONS = [
  {
    implementation: "qbittorrent",
    labelKey: "download.config.download_clients.implementations.qbittorrent",
    fields: [
      {
        key: "host",
        type: "text",
        labelKey: "download.config.download_clients.fields.host",
        required: true,
        default: "localhost"
      },
      { key: "port", type: "number", labelKey: "download.config.download_clients.fields.port", default: 8080 },
      { key: "useSsl", type: "toggle", labelKey: "download.config.download_clients.fields.use_ssl", default: false },
      { key: "username", type: "text", labelKey: "download.config.download_clients.fields.username" },
      { key: "password", type: "password", labelKey: "download.config.download_clients.fields.password", secret: true },
      { key: "category", type: "text", labelKey: "download.config.download_clients.fields.category", default: "fliks" },
      { key: "movieCategory", type: "text", labelKey: "download.config.download_clients.fields.movie_category" },
      { key: "seriesCategory", type: "text", labelKey: "download.config.download_clients.fields.series_category" }
    ]
  }
];
async function handleIndexerImplementations() {
  return jsonResponse(200, INDEXER_IMPLEMENTATIONS);
}
async function handleDownloadClientImplementations() {
  return jsonResponse(200, DOWNLOAD_CLIENT_IMPLEMENTATIONS);
}
function wrap(handler) {
  return async (req, params) => {
    try {
      return await handler(req, params);
    } catch (err) {
      if (err instanceof GrabError) return grabErrorResponse(err);
      if (err instanceof IndexerNotFoundError || err instanceof DownloadClientNotFoundError) {
        return notFoundResponse(err.message);
      }
      if (err instanceof UnknownIndexerImplementationError || err instanceof UnsupportedDownloadClientError) {
        return badBody("implementation");
      }
      log.error(`http handler failed: ${err.message}`);
      return jsonResponse(500, { error: { key: "download.http.errors.internal", detail: err.message } });
    }
  };
}
function canonicalRoutes(deps) {
  const releases = (req, params) => handleSearchReleases(deps, params, req);
  const grab = (req, params) => handleGrab(deps, params, req);
  return [
    { method: "GET", path: "/:id/releases", handler: releases },
    { method: "POST", path: "/:id/grab", handler: grab },
    { method: "GET", path: "/:id/seasons/:seasonId/releases", handler: releases },
    { method: "POST", path: "/:id/seasons/:seasonId/grab", handler: grab },
    { method: "GET", path: "/:id/episodes/:episodeId/releases", handler: releases },
    { method: "POST", path: "/:id/episodes/:episodeId/grab", handler: grab },
    { method: "GET", path: "/queue", handler: (req) => handleQueue(deps, req) },
    { method: "GET", path: "/indexers", handler: () => handleListIndexers(deps) },
    { method: "POST", path: "/indexers", handler: (req) => handleCreateIndexer(deps, req) },
    { method: "POST", path: "/indexers/test-connection", handler: (req) => handleTestIndexerConnection(deps, req) },
    { method: "DELETE", path: "/indexers/cooldowns", handler: () => handleClearAllIndexerCooldowns(deps) },
    { method: "GET", path: "/indexers/implementations", handler: () => handleIndexerImplementations() },
    { method: "PUT", path: "/indexers/:id", handler: (req, params) => handleUpdateIndexer(deps, params, req) },
    { method: "DELETE", path: "/indexers/:id", handler: (_req, params) => handleDeleteIndexer(deps, params) },
    { method: "DELETE", path: "/indexers/:id/cooldown", handler: (_req, params) => handleClearIndexerCooldown(deps, params) },
    { method: "GET", path: "/indexers/:id/stats", handler: (_req, params) => handleIndexerStats(deps, params) },
    { method: "GET", path: "/download-clients", handler: () => handleListDownloadClients(deps) },
    { method: "POST", path: "/download-clients", handler: (req) => handleCreateDownloadClient(deps, req) },
    {
      method: "POST",
      path: "/download-clients/test-connection",
      handler: (req) => handleTestDownloadClientConnection(deps, req)
    },
    { method: "GET", path: "/download-clients/implementations", handler: () => handleDownloadClientImplementations() },
    { method: "PUT", path: "/download-clients/:id", handler: (req, params) => handleUpdateDownloadClient(deps, params, req) },
    { method: "DELETE", path: "/download-clients/:id", handler: (_req, params) => handleDeleteDownloadClient(deps, params) },
    { method: "GET", path: "/blocklist", handler: (req) => handleListBlocklist(deps, req) },
    { method: "DELETE", path: "/blocklist/all", handler: () => handleClearBlocklist(deps) },
    { method: "DELETE", path: "/blocklist/:id", handler: (_req, params) => handleRemoveBlocklistEntry(deps, params) }
  ];
}
function compileTemplate(path3) {
  return path3.split("/").map((seg) => seg.startsWith(":") ? { param: seg.slice(1) } : seg);
}
function safeDecode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
function matchOne(route, method, rawSegments) {
  if (route.method !== method) return null;
  if (route.segments.length !== rawSegments.length) return null;
  const params = {};
  for (let i = 0; i < route.segments.length; i++) {
    const tmpl = route.segments[i];
    const decoded = safeDecode(rawSegments[i]);
    if (decoded === null) return null;
    if (typeof tmpl === "string") {
      if (tmpl !== decoded) return null;
    } else {
      params[tmpl.param] = decoded;
    }
  }
  return params;
}
function buildCompiledRoutes(deps) {
  return canonicalRoutes(deps).map((r) => ({
    method: r.method,
    segments: compileTemplate(r.path),
    handler: wrap(r.handler)
  }));
}
function createRouteTable(deps) {
  const routes = buildCompiledRoutes(deps);
  return {
    resolve(method, path3) {
      const rawSegments = path3.split("/");
      for (const route of routes) {
        const params = matchOne(route, method, rawSegments);
        if (params) return { handler: route.handler, params };
      }
      return null;
    }
  };
}

// src/composition-root.ts
function toIndexerRepository(repo) {
  return {
    findAll: () => repo.listAll(),
    findOne: (id) => repo.findById(id),
    insert: (row) => repo.insert(row),
    async update(id, patch) {
      const existing = await repo.findById(id);
      if (!existing) throw new IndexerNotFoundError(`Indexer #${id} not found`);
      return repo.update(id, { ...existing, ...patch });
    },
    refreshCaps: (id, caps) => repo.refreshCaps(id, caps),
    markSearchFallback: (id) => repo.markSearchFallback(id),
    remove: (id) => repo.remove(id)
  };
}
function toIndexerStatsRecorder(repo) {
  return {
    async record(stat) {
      await repo.insert(stat);
    }
  };
}
function createAppGraph(repositories2, host2) {
  const throttle = new IndexerThrottle();
  const indexerRepo = toIndexerRepository(repositories2.indexers);
  const torznabClient = new TorznabClient({ stats: toIndexerStatsRecorder(repositories2.indexerStats), repo: indexerRepo, throttle });
  const indexerService = new IndexerService({ repo: indexerRepo, torznab: torznabClient, throttle });
  const driver = DOWNLOAD_CLIENT_DRIVERS["qbittorrent"];
  const grabPipeline = createGrabPipeline({
    host: host2,
    indexer: torznabClient,
    driver,
    indexersRepo: repositories2.indexers,
    clientsRepo: repositories2.downloadClients,
    historyRepo: repositories2.downloadHistory,
    blocklistRepo: repositories2.blocklist
  });
  const completionPoller = new DownloadCompletionPoller({
    host: host2,
    driver,
    clientsRepo: repositories2.downloadClients,
    indexersRepo: repositories2.indexers,
    historyRepo: repositories2.downloadHistory,
    stalledChecksRepo: repositories2.stalledChecks,
    blocklistRepo: repositories2.blocklist,
    historyMatcher: new TorrentHistoryMatcher(repositories2.downloadHistory),
    // The deferred cross-link: the poller re-searches after a stalled-cleanup removal
    // by calling straight back into the pipeline that owns `SearchMissing`.
    searchMissing: (mediaIds) => grabPipeline.searchMissing(mediaIds)
  });
  const downloadClientsService = new DownloadClientsService({
    repo: repositories2.downloadClients,
    drivers: DOWNLOAD_CLIENT_DRIVERS,
    history: repositories2.downloadHistory,
    blocklist: repositories2.blocklist,
    stalledSnapshots: repositories2.stalledChecks,
    // Same cross-link as the poller's, fired after a manual blocklist-and-remove.
    onMediaBlocklisted: (mediaId) => {
      grabPipeline.searchMissing([mediaId]).catch((e) => log.error(`re-search after blocklist failed: ${e.message}`));
    }
  });
  return {
    indexerService,
    downloadClientsService,
    grabPipeline,
    completionPoller,
    jobHandlers: createJobHandlers({ grabPipeline, completionPoller }),
    routeTable: createRouteTable({
      indexerService,
      downloadClientsService,
      grabPipeline,
      indexerStats: repositories2.indexerStats,
      blocklist: repositories2.blocklist,
      downloadHistory: repositories2.downloadHistory,
      downloadClientsRepo: repositories2.downloadClients,
      downloadClientDrivers: DOWNLOAD_CLIENT_DRIVERS,
      host: host2
    })
  };
}

// src/plugin.ts
var token = process.env.FLIKS_PLUGIN_TOKEN ?? "";
var pluginSockPath = process.env.FLIKS_PLUGIN_SOCK;
var coreSockPath = process.env.FLIKS_CORE_SOCK;
var dbUrl = process.env.FLIKS_DB_URL;
var pluginId = process.env.FLIKS_PLUGIN_ID;
var host = coreSockPath ? new HostClient(coreSockPath) : null;
var repositories = null;
var appGraph = null;
async function initDb() {
  if (!dbUrl || !pluginId) {
    return { ok: false, reason: "FLIKS_DB_URL or FLIKS_PLUGIN_ID is not set" };
  }
  if (!host) {
    return { ok: false, reason: "FLIKS_CORE_SOCK is not set" };
  }
  try {
    const pool = createPluginPool({ dsn: dbUrl, pluginId });
    pool.on("error", (err) => log.error(`pool error: ${err.message}`));
    await migrateUp(pool);
    repositories = createRepositories(pool);
    appGraph = createAppGraph(repositories, host);
    await appGraph.completionPoller.init();
    return { ok: true };
  } catch (err) {
    log.error(`startup failed: ${err.message}`);
    return { ok: false, reason: "startup did not complete \u2014 see plugin logs" };
  }
}
var dbInit = initDb();
function loadManifest() {
  const raw = fs.readFileSync(path2.join(__dirname, "plugin.json"), "utf8");
  return JSON.parse(raw);
}
var requestHandlers = {
  hello: async () => {
    const db = await dbInit;
    if (!db.ok) throw new Error(`database not ready: ${db.reason}`);
    return { manifest: loadManifest(), token };
  },
  health: async () => {
    return { ok: true, detail: `core=${host?.isConnected ? "connected" : "disconnected"}` };
  },
  job: async (payload) => {
    const p = payload;
    if (!appGraph) throw new Error("plugin not ready \u2014 database not initialised, see plugin logs");
    const handler = appGraph.jobHandlers[p.name];
    if (!handler) throw new Error(`no handler registered for job "${p.name}"`);
    await handler(p.jobId, p.args);
    return { ok: true };
  },
  http: async (payload) => {
    const p = payload;
    if (!appGraph) {
      return { status: 503, headers: { "content-type": "application/json" }, body: { error: { key: "download.http.errors.not_ready" } } };
    }
    const resolved = appGraph.routeTable.resolve(p.method, p.path);
    if (!resolved) {
      return { status: 404, headers: { "content-type": "application/json" }, body: { error: { key: "download.http.errors.not_found" } } };
    }
    return resolved.handler(p, resolved.params);
  },
  shutdown: async () => {
    setTimeout(() => process.exit(0), 10);
    return { ok: true };
  }
};
var noteHandlers = {
  event: (payload) => {
    const p = payload;
    log.info(`event "${p.name}" received (no subscriber registered yet)`);
  },
  config: (payload) => {
    const p = payload;
    log.info(`config changed: ${p.changed.join(", ")} (takes effect on next restart)`);
  }
};
function main() {
  if (!pluginSockPath) {
    log.error("FLIKS_PLUGIN_SOCK is not set; cannot start");
    process.exit(1);
  }
  if (!coreSockPath) {
    log.error("FLIKS_CORE_SOCK is not set; cannot start");
    process.exit(1);
  }
  host?.connect();
  const socket = net2.connect(pluginSockPath);
  socket.on("connect", () => log.info(`connected to ${pluginSockPath}`));
  socket.on("error", (err) => log.error(`plugin socket error: ${err.message}`));
  attachDispatcher(socket, requestHandlers, noteHandlers);
  log.info("fliks.download started");
}
main();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  appGraph,
  repositories
});
