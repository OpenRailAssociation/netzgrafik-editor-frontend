// @ts-check
// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const {SpecReporter} = require("jasmine-spec-reporter");
const browserstack = require("browserstack-local");

/**
 * @type { import("protractor").Config }
 */
exports.config = {
  allScriptsTimeout: 11000,
  specs: ["./src/**/*.e2e-spec.ts"],
  capabilities: {
    build: "protractor-browserstack",
    browserName: "chrome",
    "browserstack.local": true,
    "browserstack.debug": "true",
    "browserstack.user": process.env.BROWSERSTACK_USERNAME,
    "browserstack.key": process.env.BROWSERSTACK_ACCESS_KEY,
  },
  framework: "jasmine",
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
    print: function () {},
  },

  // Code to start browserstack local before start of test
  beforeLaunch: function () {
    console.log("Connecting local");
    return new Promise(function (resolve, reject) {
      exports.bs_local = new browserstack.Local();
      exports.bs_local.start(
        {
          key: process.env.BROWSERSTACK_ACCESS_KEY,
        },
        function (error) {
          if (error) {
            return reject(error);
          }

          console.log("Connected to browserstack. Now testing...");
          resolve();
        },
      );
    });
  },

  // Code to stop browserstack local after end of test
  afterLaunch: function () {
    return new Promise(function (resolve) {
      console.log("Stopping browserstack-local connection");
      exports.bs_local.stop(resolve);
    });
  },

  onPrepare() {
    require("ts-node").register({
      project: require("path").join(__dirname, "./tsconfig.json"),
    });
    jasmine.getEnv().addReporter(new SpecReporter({spec: {displayStacktrace: true}}));
  },
};
