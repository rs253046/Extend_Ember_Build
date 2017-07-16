/*jshint node:true*/
/* global require, module */
var EmberApp = require('ember-cli/lib/broccoli/ember-app');
var mergeTrees  = require('ember-cli/lib/broccoli/merge-trees');
var JSHinter = require('broccoli-jshint');
var chalk = require('chalk');
var buildAddon = require('ember-cli/lib/models/addon');
var existsSync = require('exists-sync');
var Funnel = require('broccoli-funnel');
var config = require(process.env.PWD + '/config/environment');

function isProductionBuild() {
  return (process.argv.includes('--prod') || process.argv.includes('--environment=production') || process.argv.includes('production'))  &&
  (process.argv.includes('build') || process.argv.includes('b')) && config(process.env.EMBER_ENV).failBuildOnJshint;
}

function isDevelopmentBuild() {
  return process.argv.includes('build') || process.argv.includes('b') && config(process.env.EMBER_ENV).failBuildOnJshint;
}

//Production build setup
//
//

if (isProductionBuild()) {
  buildAddon.prototype.treeFor = function(name) {
    this._requireBuildPackages();

    var trees = this.eachAddonInvoke('treeFor', [name]);
    var tree = this._treeFor(name);

    if (tree) {
      trees.push(tree);
    }

    if (name === 'app') {
      trees.push(this.jshintAddonTree());
    }

    return mergeTrees(trees.filter(Boolean), {
      overwrite: true,
      annotation: 'Addon#treeFor (' + this.name + ' - ' + name + ')'
    });
  }

  buildAddon.prototype.jshintAddonTree = function() {
    this._requireBuildPackages();

    var addonPath = process.env.PWD + '/app';

    if (!existsSync(addonPath)) {
      return;
    }

    var addonJs = this.addonJsFiles(addonPath);
    var addonTemplates = this._addonTemplateFiles(addonPath);
    var lintJsTrees = this._eachProjectAddonInvoke('lintTree', ['addon', addonJs]);
    var lintTemplateTrees = this._eachProjectAddonInvoke('lintTree', ['templates', addonTemplates]);
    var lintTrees = [].concat(lintJsTrees, lintTemplateTrees).filter(Boolean);
    var lintedAddon = mergeTrees(lintTrees, {
      overwrite: true,
      annotation: 'TreeMerger (addon-lint)'
    });

    return new Funnel(lintedAddon, {
      srcDir: '/',
      destDir: this.name + '/tests/'
    });
  }

  buildAddon.prototype.addonJsFiles = function(tree) {
    this._requireBuildPackages();

    var includePatterns = this.registry.extensionsForType('js').map(function(extension) {
      return new RegExp(extension + '$');
    });

    return new Funnel(tree, {
      include: includePatterns,
      destDir: 'modules/' + this.moduleName(),
      description: 'Funnel: Addon JS'
    });
  }
}

// Development build setup
//
//

if (isProductionBuild() || isDevelopmentBuild())  {
  EmberApp.prototype.addonLintTree = function(type, tree) {
    var output = this.project.addons.map(function(addon) {
      if (addon.lintTree) {
        return addon.lintTree(type, tree);
      }
    }).filter(Boolean);

    //Enable failOnAnyError flag on broccoli-jshint.
    this.failOnAnyError = false;
    if (isDevelopmentBuild()) {
      output[0].failOnAnyError = true;
    }

    return mergeTrees(output, {
      overwrite: true,
      annotation: 'TreeMerger (lint ' + type + ')'
    });
  };

  //Dev Build check eshint throw custom Error

  JSHinter.prototype.postProcess = function(results) {
    var errors = results.errors;
    var passed = results.passed;

    if (isProductionBuild()) {
      this.failOnAnyError = true;
      errors = errors.split('/');
      errors.shift();
      errors.shift();
      errors = errors.join('/');
    }

    if (this.failOnAnyError && errors.length > 0){
        var errorText =
          '\n\nBuild Failed - JSHint Error:\n' +
          '============================\n' +
          errors;
        throw chalk.red(errorText);
    }

    if (!passed && this.log) {
      this.logError(errors);
    }

    return results;
  };
}

module.exports = function(defaults) {
  var app = new EmberApp(defaults, {
    hinting: true
    // Add options here
  });

  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.

  return app.toTree();
};
