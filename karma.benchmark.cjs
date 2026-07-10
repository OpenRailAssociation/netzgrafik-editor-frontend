const base = require("./karma.conf.cjs");

module.exports = function (config) {
  base(config);
  config.set({
    reporters: ["progress"],
    browserNoActivityTimeout: 600000,
    browserDisconnectTimeout: 600000,
    browserDisconnectTolerance: 3,
    pingTimeout: 600000,
  });
};
