// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

if (process.env.BUILD_NUMBER) {
  process.env.CHROME_BIN = require("puppeteer").executablePath();
}

module.exports = function (config) {
  config.set({
    basePath: "",
    frameworks: ["jasmine", "@angular-devkit/build-angular"],
    plugins: [
      require("karma-jasmine"),
      require("karma-chrome-launcher"),
      require("karma-browserstack-launcher"),
      require("karma-jasmine-html-reporter"),
      require("karma-sonarqube-reporter"),
      require("karma-coverage"),
      require("@angular-devkit/build-angular/plugins/karma"),
    ],
    client: {
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
    },
    sonarqubeReporter: {
      basePath: require("path").join(__dirname, "./src"),
      outputFolder: require("path").join(__dirname, "./coverage/netzgrafik-frontend"),
      reportName: () => "sonarqube.xml",
    },
    coverageIstanbulReporter: {
      dir: require("path").join(__dirname, "./coverage/netzgrafik-frontend"),
      reports: ["html", "lcovonly", "cobertura"],
      fixWebpackSourcePaths: true,
    },
    reporters: ["progress", "kjhtml"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ["Chrome"],
    customLaunchers: {
      // See https://www.browserstack.com/automate/capabilities
      // To use these browsers add the key to angular.json under test => browsers
      // (Look for ChromeHeadless for an example)
      BsChrome: {
        base: "BrowserStack",
        browser: "chrome",
        os: "OS X",
      },
    },
    singleRun: false,
    restartOnFileChange: true,
  });
};
