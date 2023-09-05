'use strict';var _slicedToArray = function () {function sliceIterator(arr, i) {var _arr = [];var _n = true;var _d = false;var _e = undefined;try {for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {_arr.push(_s.value);if (i && _arr.length === i) break;}} catch (err) {_d = true;_e = err;} finally {try {if (!_n && _i["return"]) _i["return"]();} finally {if (_d) throw _e;}}return _arr;}return function (arr, i) {if (Array.isArray(arr)) {return arr;} else if (Symbol.iterator in Object(arr)) {return sliceIterator(arr, i);} else {throw new TypeError("Invalid attempt to destructure non-iterable instance");}};}();

var _minimatch = require('minimatch');var _minimatch2 = _interopRequireDefault(_minimatch);

var _importType = require('../core/importType');var _importType2 = _interopRequireDefault(_importType);
var _staticRequire = require('../core/staticRequire');var _staticRequire2 = _interopRequireDefault(_staticRequire);
var _docsUrl = require('../docsUrl');var _docsUrl2 = _interopRequireDefault(_docsUrl);function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { 'default': obj };}

var includes = Function.bind.bind(Function.prototype.call)(Array.prototype.includes);
// This is a **non-spec compliant** but works in practice replacement of `object.groupby` package.
var groupBy = function groupBy(array, grouper) {return array.reduce(function (acc, curr, index) {
    var key = grouper(curr, index);
    (acc[key] = acc[key] || []).push(curr);
    return acc;
  }, {});};

var defaultGroups = ['builtin', 'external', 'parent', 'sibling', 'index'];

// REPORTING AND FIXING

function reverse(array) {
  return array.map(function (v) {
    return Object.assign({}, v, { rank: -v.rank });
  }).reverse();
}

function getTokensOrCommentsAfter(sourceCode, node, count) {
  var currentNodeOrToken = node;
  var result = [];
  for (var i = 0; i < count; i++) {
    currentNodeOrToken = sourceCode.getTokenOrCommentAfter(currentNodeOrToken);
    if (currentNodeOrToken == null) {
      break;
    }
    result.push(currentNodeOrToken);
  }
  return result;
}

function getTokensOrCommentsBefore(sourceCode, node, count) {
  var currentNodeOrToken = node;
  var result = [];
  for (var i = 0; i < count; i++) {
    currentNodeOrToken = sourceCode.getTokenOrCommentBefore(currentNodeOrToken);
    if (currentNodeOrToken == null) {
      break;
    }
    result.push(currentNodeOrToken);
  }
  return result.reverse();
}

function takeTokensAfterWhile(sourceCode, node, condition) {
  var tokens = getTokensOrCommentsAfter(sourceCode, node, 100);
  var result = [];
  for (var i = 0; i < tokens.length; i++) {
    if (condition(tokens[i])) {
      result.push(tokens[i]);
    } else {
      break;
    }
  }
  return result;
}

function takeTokensBeforeWhile(sourceCode, node, condition) {
  var tokens = getTokensOrCommentsBefore(sourceCode, node, 100);
  var result = [];
  for (var i = tokens.length - 1; i >= 0; i--) {
    if (condition(tokens[i])) {
      result.push(tokens[i]);
    } else {
      break;
    }
  }
  return result.reverse();
}

function findOutOfOrder(imported) {
  if (imported.length === 0) {
    return [];
  }
  var maxSeenRankNode = imported[0];
  return imported.filter(function (importedModule) {
    var res = importedModule.rank < maxSeenRankNode.rank;
    if (maxSeenRankNode.rank < importedModule.rank) {
      maxSeenRankNode = importedModule;
    }
    return res;
  });
}

function findRootNode(node) {
  var parent = node;
  while (parent.parent != null && parent.parent.body == null) {
    parent = parent.parent;
  }
  return parent;
}

function findEndOfLineWithComments(sourceCode, node) {
  var tokensToEndOfLine = takeTokensAfterWhile(sourceCode, node, commentOnSameLineAs(node));
  var endOfTokens = tokensToEndOfLine.length > 0 ?
  tokensToEndOfLine[tokensToEndOfLine.length - 1].range[1] :
  node.range[1];
  var result = endOfTokens;
  for (var i = endOfTokens; i < sourceCode.text.length; i++) {
    if (sourceCode.text[i] === '\n') {
      result = i + 1;
      break;
    }
    if (sourceCode.text[i] !== ' ' && sourceCode.text[i] !== '\t' && sourceCode.text[i] !== '\r') {
      break;
    }
    result = i + 1;
  }
  return result;
}

function commentOnSameLineAs(node) {
  return function (token) {return (token.type === 'Block' || token.type === 'Line') &&
    token.loc.start.line === token.loc.end.line &&
    token.loc.end.line === node.loc.end.line;};
}

function findStartOfLineWithComments(sourceCode, node) {
  var tokensToEndOfLine = takeTokensBeforeWhile(sourceCode, node, commentOnSameLineAs(node));
  var startOfTokens = tokensToEndOfLine.length > 0 ? tokensToEndOfLine[0].range[0] : node.range[0];
  var result = startOfTokens;
  for (var i = startOfTokens - 1; i > 0; i--) {
    if (sourceCode.text[i] !== ' ' && sourceCode.text[i] !== '\t') {
      break;
    }
    result = i;
  }
  return result;
}

function isRequireExpression(expr) {
  return expr != null &&
  expr.type === 'CallExpression' &&
  expr.callee != null &&
  expr.callee.name === 'require' &&
  expr.arguments != null &&
  expr.arguments.length === 1 &&
  expr.arguments[0].type === 'Literal';
}

function isSupportedRequireModule(node) {
  if (node.type !== 'VariableDeclaration') {
    return false;
  }
  if (node.declarations.length !== 1) {
    return false;
  }
  var decl = node.declarations[0];
  var isPlainRequire = decl.id && (
  decl.id.type === 'Identifier' || decl.id.type === 'ObjectPattern') &&
  isRequireExpression(decl.init);
  var isRequireWithMemberExpression = decl.id && (
  decl.id.type === 'Identifier' || decl.id.type === 'ObjectPattern') &&
  decl.init != null &&
  decl.init.type === 'CallExpression' &&
  decl.init.callee != null &&
  decl.init.callee.type === 'MemberExpression' &&
  isRequireExpression(decl.init.callee.object);
  return isPlainRequire || isRequireWithMemberExpression;
}

function isPlainImportModule(node) {
  return node.type === 'ImportDeclaration' && node.specifiers != null && node.specifiers.length > 0;
}

function isPlainImportEquals(node) {
  return node.type === 'TSImportEqualsDeclaration' && node.moduleReference.expression;
}

function canCrossNodeWhileReorder(node) {
  return isSupportedRequireModule(node) || isPlainImportModule(node) || isPlainImportEquals(node);
}

function canReorderItems(firstNode, secondNode) {
  var parent = firstNode.parent;var _sort =
  [
  parent.body.indexOf(firstNode),
  parent.body.indexOf(secondNode)].
  sort(),_sort2 = _slicedToArray(_sort, 2),firstIndex = _sort2[0],secondIndex = _sort2[1];
  var nodesBetween = parent.body.slice(firstIndex, secondIndex + 1);var _iteratorNormalCompletion = true;var _didIteratorError = false;var _iteratorError = undefined;try {
    for (var _iterator = nodesBetween[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {var nodeBetween = _step.value;
      if (!canCrossNodeWhileReorder(nodeBetween)) {
        return false;
      }
    }} catch (err) {_didIteratorError = true;_iteratorError = err;} finally {try {if (!_iteratorNormalCompletion && _iterator['return']) {_iterator['return']();}} finally {if (_didIteratorError) {throw _iteratorError;}}}
  return true;
}

function makeImportDescription(node) {
  if (node.node.importKind === 'type') {
    return 'type import';
  }
  if (node.node.importKind === 'typeof') {
    return 'typeof import';
  }
  return 'import';
}

function fixOutOfOrder(context, firstNode, secondNode, order) {
  var sourceCode = context.getSourceCode();

  var firstRoot = findRootNode(firstNode.node);
  var firstRootStart = findStartOfLineWithComments(sourceCode, firstRoot);
  var firstRootEnd = findEndOfLineWithComments(sourceCode, firstRoot);

  var secondRoot = findRootNode(secondNode.node);
  var secondRootStart = findStartOfLineWithComments(sourceCode, secondRoot);
  var secondRootEnd = findEndOfLineWithComments(sourceCode, secondRoot);
  var canFix = canReorderItems(firstRoot, secondRoot);

  var newCode = sourceCode.text.substring(secondRootStart, secondRootEnd);
  if (newCode[newCode.length - 1] !== '\n') {
    newCode = String(newCode) + '\n';
  }

  var firstImport = String(makeImportDescription(firstNode)) + ' of `' + String(firstNode.displayName) + '`';
  var secondImport = '`' + String(secondNode.displayName) + '` ' + String(makeImportDescription(secondNode));
  var message = secondImport + ' should occur ' + String(order) + ' ' + firstImport;

  if (order === 'before') {
    context.report({
      node: secondNode.node,
      message: message,
      fix: canFix && function (fixer) {return fixer.replaceTextRange(
        [firstRootStart, secondRootEnd],
        newCode + sourceCode.text.substring(firstRootStart, secondRootStart));} });


  } else if (order === 'after') {
    context.report({
      node: secondNode.node,
      message: message,
      fix: canFix && function (fixer) {return fixer.replaceTextRange(
        [secondRootStart, firstRootEnd],
        sourceCode.text.substring(secondRootEnd, firstRootEnd) + newCode);} });


  }
}

function reportOutOfOrder(context, imported, outOfOrder, order) {
  outOfOrder.forEach(function (imp) {
    var found = imported.find(function () {function hasHigherRank(importedItem) {
        return importedItem.rank > imp.rank;
      }return hasHigherRank;}());
    fixOutOfOrder(context, found, imp, order);
  });
}

function makeOutOfOrderReport(context, imported) {
  var outOfOrder = findOutOfOrder(imported);
  if (!outOfOrder.length) {
    return;
  }

  // There are things to report. Try to minimize the number of reported errors.
  var reversedImported = reverse(imported);
  var reversedOrder = findOutOfOrder(reversedImported);
  if (reversedOrder.length < outOfOrder.length) {
    reportOutOfOrder(context, reversedImported, reversedOrder, 'after');
    return;
  }
  reportOutOfOrder(context, imported, outOfOrder, 'before');
}

var compareString = function compareString(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

/** Some parsers (languages without types) don't provide ImportKind */
var DEAFULT_IMPORT_KIND = 'value';
var getNormalizedValue = function getNormalizedValue(node, toLowerCase) {
  var value = node.value;
  return toLowerCase ? String(value).toLowerCase() : value;
};

function getSorter(alphabetizeOptions) {
  var multiplier = alphabetizeOptions.order === 'asc' ? 1 : -1;
  var orderImportKind = alphabetizeOptions.orderImportKind;
  var multiplierImportKind = orderImportKind !== 'ignore' && (
  alphabetizeOptions.orderImportKind === 'asc' ? 1 : -1);

  return function () {function importsSorter(nodeA, nodeB) {
      var importA = getNormalizedValue(nodeA, alphabetizeOptions.caseInsensitive);
      var importB = getNormalizedValue(nodeB, alphabetizeOptions.caseInsensitive);
      var result = 0;

      if (!includes(importA, '/') && !includes(importB, '/')) {
        result = compareString(importA, importB);
      } else {
        var A = importA.split('/');
        var B = importB.split('/');
        var a = A.length;
        var b = B.length;

        for (var i = 0; i < Math.min(a, b); i++) {
          result = compareString(A[i], B[i]);
          if (result) {break;}
        }

        if (!result && a !== b) {
          result = a < b ? -1 : 1;
        }
      }

      result = result * multiplier;

      // In case the paths are equal (result === 0), sort them by importKind
      if (!result && multiplierImportKind) {
        result = multiplierImportKind * compareString(
        nodeA.node.importKind || DEAFULT_IMPORT_KIND,
        nodeB.node.importKind || DEAFULT_IMPORT_KIND);

      }

      return result;
    }return importsSorter;}();
}

function mutateRanksToAlphabetize(imported, alphabetizeOptions) {
  var groupedByRanks = groupBy(imported, function (item) {return item.rank;});

  var sorterFn = getSorter(alphabetizeOptions);

  // sort group keys so that they can be iterated on in order
  var groupRanks = Object.keys(groupedByRanks).sort(function (a, b) {
    return a - b;
  });

  // sort imports locally within their group
  groupRanks.forEach(function (groupRank) {
    groupedByRanks[groupRank].sort(sorterFn);
  });

  // assign globally unique rank to each import
  var newRank = 0;
  var alphabetizedRanks = groupRanks.reduce(function (acc, groupRank) {
    groupedByRanks[groupRank].forEach(function (importedItem) {
      acc[String(importedItem.value) + '|' + String(importedItem.node.importKind)] = parseInt(groupRank, 10) + newRank;
      newRank += 1;
    });
    return acc;
  }, {});

  // mutate the original group-rank with alphabetized-rank
  imported.forEach(function (importedItem) {
    importedItem.rank = alphabetizedRanks[String(importedItem.value) + '|' + String(importedItem.node.importKind)];
  });
}

// DETECTING

function computePathRank(ranks, pathGroups, path, maxPosition) {
  for (var i = 0, l = pathGroups.length; i < l; i++) {var _pathGroups$i =
    pathGroups[i],pattern = _pathGroups$i.pattern,patternOptions = _pathGroups$i.patternOptions,group = _pathGroups$i.group,_pathGroups$i$positio = _pathGroups$i.position,position = _pathGroups$i$positio === undefined ? 1 : _pathGroups$i$positio;
    if ((0, _minimatch2['default'])(path, pattern, patternOptions || { nocomment: true })) {
      return ranks[group] + position / maxPosition;
    }
  }
}

function computeRank(context, ranks, importEntry, excludedImportTypes) {
  var impType = void 0;
  var rank = void 0;
  if (importEntry.type === 'import:object') {
    impType = 'object';
  } else if (importEntry.node.importKind === 'type' && ranks.omittedTypes.indexOf('type') === -1) {
    impType = 'type';
  } else {
    impType = (0, _importType2['default'])(importEntry.value, context);
  }
  if (!excludedImportTypes.has(impType)) {
    rank = computePathRank(ranks.groups, ranks.pathGroups, importEntry.value, ranks.maxPosition);
  }
  if (typeof rank === 'undefined') {
    rank = ranks.groups[impType];
  }
  if (importEntry.type !== 'import' && !importEntry.type.startsWith('import:')) {
    rank += 100;
  }

  return rank;
}

function registerNode(context, importEntry, ranks, imported, excludedImportTypes) {
  var rank = computeRank(context, ranks, importEntry, excludedImportTypes);
  if (rank !== -1) {
    imported.push(Object.assign({}, importEntry, { rank: rank }));
  }
}

function getRequireBlock(node) {
  var n = node;
  // Handle cases like `const baz = require('foo').bar.baz`
  // and `const foo = require('foo')()`
  while (
  n.parent.type === 'MemberExpression' && n.parent.object === n ||
  n.parent.type === 'CallExpression' && n.parent.callee === n)
  {
    n = n.parent;
  }
  if (
  n.parent.type === 'VariableDeclarator' &&
  n.parent.parent.type === 'VariableDeclaration' &&
  n.parent.parent.parent.type === 'Program')
  {
    return n.parent.parent.parent;
  }
}

var types = ['builtin', 'external', 'internal', 'unknown', 'parent', 'sibling', 'index', 'object', 'type'];

// Creates an object with type-rank pairs.
// Example: { index: 0, sibling: 1, parent: 1, external: 1, builtin: 2, internal: 2 }
// Will throw an error if it contains a type that does not exist, or has a duplicate
function convertGroupsToRanks(groups) {
  if (groups.length === 1) {
    // TODO: remove this `if` and fix the bug
    return convertGroupsToRanks(groups[0]);
  }
  var rankObject = groups.reduce(function (res, group, index) {
    [].concat(group).forEach(function (groupItem) {
      if (types.indexOf(groupItem) === -1) {
        throw new Error('Incorrect configuration of the rule: Unknown type `' + String(JSON.stringify(groupItem)) + '`');
      }
      if (res[groupItem] !== undefined) {
        throw new Error('Incorrect configuration of the rule: `' + String(groupItem) + '` is duplicated');
      }
      res[groupItem] = index * 2;
    });
    return res;
  }, {});

  var omittedTypes = types.filter(function (type) {
    return typeof rankObject[type] === 'undefined';
  });

  var ranks = omittedTypes.reduce(function (res, type) {
    res[type] = groups.length * 2;
    return res;
  }, rankObject);

  return { groups: ranks, omittedTypes: omittedTypes };
}

function convertPathGroupsForRanks(pathGroups) {
  var after = {};
  var before = {};

  var transformed = pathGroups.map(function (pathGroup, index) {var
    group = pathGroup.group,positionString = pathGroup.position;
    var position = 0;
    if (positionString === 'after') {
      if (!after[group]) {
        after[group] = 1;
      }
      position = after[group]++;
    } else if (positionString === 'before') {
      if (!before[group]) {
        before[group] = [];
      }
      before[group].push(index);
    }

    return Object.assign({}, pathGroup, { position: position });
  });

  var maxPosition = 1;

  Object.keys(before).forEach(function (group) {
    var groupLength = before[group].length;
    before[group].forEach(function (groupIndex, index) {
      transformed[groupIndex].position = -1 * (groupLength - index);
    });
    maxPosition = Math.max(maxPosition, groupLength);
  });

  Object.keys(after).forEach(function (key) {
    var groupNextPosition = after[key];
    maxPosition = Math.max(maxPosition, groupNextPosition - 1);
  });

  return {
    pathGroups: transformed,
    maxPosition: maxPosition > 10 ? Math.pow(10, Math.ceil(Math.log10(maxPosition))) : 10 };

}

function fixNewLineAfterImport(context, previousImport) {
  var prevRoot = findRootNode(previousImport.node);
  var tokensToEndOfLine = takeTokensAfterWhile(
  context.getSourceCode(), prevRoot, commentOnSameLineAs(prevRoot));

  var endOfLine = prevRoot.range[1];
  if (tokensToEndOfLine.length > 0) {
    endOfLine = tokensToEndOfLine[tokensToEndOfLine.length - 1].range[1];
  }
  return function (fixer) {return fixer.insertTextAfterRange([prevRoot.range[0], endOfLine], '\n');};
}

function removeNewLineAfterImport(context, currentImport, previousImport) {
  var sourceCode = context.getSourceCode();
  var prevRoot = findRootNode(previousImport.node);
  var currRoot = findRootNode(currentImport.node);
  var rangeToRemove = [
  findEndOfLineWithComments(sourceCode, prevRoot),
  findStartOfLineWithComments(sourceCode, currRoot)];

  if (/^\s*$/.test(sourceCode.text.substring(rangeToRemove[0], rangeToRemove[1]))) {
    return function (fixer) {return fixer.removeRange(rangeToRemove);};
  }
  return undefined;
}

function makeNewlinesBetweenReport(context, imported, newlinesBetweenImports, distinctGroup) {
  var getNumberOfEmptyLinesBetween = function getNumberOfEmptyLinesBetween(currentImport, previousImport) {
    var linesBetweenImports = context.getSourceCode().lines.slice(
    previousImport.node.loc.end.line,
    currentImport.node.loc.start.line - 1);


    return linesBetweenImports.filter(function (line) {return !line.trim().length;}).length;
  };
  var getIsStartOfDistinctGroup = function getIsStartOfDistinctGroup(currentImport, previousImport) {return currentImport.rank - 1 >= previousImport.rank;};
  var previousImport = imported[0];

  imported.slice(1).forEach(function (currentImport) {
    var emptyLinesBetween = getNumberOfEmptyLinesBetween(currentImport, previousImport);
    var isStartOfDistinctGroup = getIsStartOfDistinctGroup(currentImport, previousImport);

    if (newlinesBetweenImports === 'always' ||
    newlinesBetweenImports === 'always-and-inside-groups') {
      if (currentImport.rank !== previousImport.rank && emptyLinesBetween === 0) {
        if (distinctGroup || !distinctGroup && isStartOfDistinctGroup) {
          context.report({
            node: previousImport.node,
            message: 'There should be at least one empty line between import groups',
            fix: fixNewLineAfterImport(context, previousImport) });

        }
      } else if (emptyLinesBetween > 0 &&
      newlinesBetweenImports !== 'always-and-inside-groups') {
        if (distinctGroup && currentImport.rank === previousImport.rank || !distinctGroup && !isStartOfDistinctGroup) {
          context.report({
            node: previousImport.node,
            message: 'There should be no empty line within import group',
            fix: removeNewLineAfterImport(context, currentImport, previousImport) });

        }
      }
    } else if (emptyLinesBetween > 0) {
      context.report({
        node: previousImport.node,
        message: 'There should be no empty line between import groups',
        fix: removeNewLineAfterImport(context, currentImport, previousImport) });

    }

    previousImport = currentImport;
  });
}

function getAlphabetizeConfig(options) {
  var alphabetize = options.alphabetize || {};
  var order = alphabetize.order || 'ignore';
  var orderImportKind = alphabetize.orderImportKind || 'ignore';
  var caseInsensitive = alphabetize.caseInsensitive || false;

  return { order: order, orderImportKind: orderImportKind, caseInsensitive: caseInsensitive };
}

// TODO, semver-major: Change the default of "distinctGroup" from true to false
var defaultDistinctGroup = true;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      category: 'Style guide',
      description: 'Enforce a convention in module import order.',
      url: (0, _docsUrl2['default'])('order') },


    fixable: 'code',
    schema: [
    {
      type: 'object',
      properties: {
        groups: {
          type: 'array' },

        pathGroupsExcludedImportTypes: {
          type: 'array' },

        distinctGroup: {
          type: 'boolean',
          'default': defaultDistinctGroup },

        pathGroups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string' },

              patternOptions: {
                type: 'object' },

              group: {
                type: 'string',
                'enum': types },

              position: {
                type: 'string',
                'enum': ['after', 'before'] } },


            additionalProperties: false,
            required: ['pattern', 'group'] } },


        'newlines-between': {
          'enum': [
          'ignore',
          'always',
          'always-and-inside-groups',
          'never'] },


        alphabetize: {
          type: 'object',
          properties: {
            caseInsensitive: {
              type: 'boolean',
              'default': false },

            order: {
              'enum': ['ignore', 'asc', 'desc'],
              'default': 'ignore' },

            orderImportKind: {
              'enum': ['ignore', 'asc', 'desc'],
              'default': 'ignore' } },


          additionalProperties: false },

        warnOnUnassignedImports: {
          type: 'boolean',
          'default': false } },


      additionalProperties: false }] },




  create: function () {function importOrderRule(context) {
      var options = context.options[0] || {};
      var newlinesBetweenImports = options['newlines-between'] || 'ignore';
      var pathGroupsExcludedImportTypes = new Set(options.pathGroupsExcludedImportTypes || ['builtin', 'external', 'object']);
      var alphabetize = getAlphabetizeConfig(options);
      var distinctGroup = options.distinctGroup == null ? defaultDistinctGroup : !!options.distinctGroup;
      var ranks = void 0;

      try {var _convertPathGroupsFor =
        convertPathGroupsForRanks(options.pathGroups || []),pathGroups = _convertPathGroupsFor.pathGroups,maxPosition = _convertPathGroupsFor.maxPosition;var _convertGroupsToRanks =
        convertGroupsToRanks(options.groups || defaultGroups),groups = _convertGroupsToRanks.groups,omittedTypes = _convertGroupsToRanks.omittedTypes;
        ranks = {
          groups: groups,
          omittedTypes: omittedTypes,
          pathGroups: pathGroups,
          maxPosition: maxPosition };

      } catch (error) {
        // Malformed configuration
        return {
          Program: function () {function Program(node) {
              context.report(node, error.message);
            }return Program;}() };

      }
      var importMap = new Map();

      function getBlockImports(node) {
        if (!importMap.has(node)) {
          importMap.set(node, []);
        }
        return importMap.get(node);
      }

      return {
        ImportDeclaration: function () {function handleImports(node) {
            // Ignoring unassigned imports unless warnOnUnassignedImports is set
            if (node.specifiers.length || options.warnOnUnassignedImports) {
              var name = node.source.value;
              registerNode(
              context,
              {
                node: node,
                value: name,
                displayName: name,
                type: 'import' },

              ranks,
              getBlockImports(node.parent),
              pathGroupsExcludedImportTypes);

            }
          }return handleImports;}(),
        TSImportEqualsDeclaration: function () {function handleImports(node) {
            var displayName = void 0;
            var value = void 0;
            var type = void 0;
            // skip "export import"s
            if (node.isExport) {
              return;
            }
            if (node.moduleReference.type === 'TSExternalModuleReference') {
              value = node.moduleReference.expression.value;
              displayName = value;
              type = 'import';
            } else {
              value = '';
              displayName = context.getSourceCode().getText(node.moduleReference);
              type = 'import:object';
            }
            registerNode(
            context,
            {
              node: node,
              value: value,
              displayName: displayName,
              type: type },

            ranks,
            getBlockImports(node.parent),
            pathGroupsExcludedImportTypes);

          }return handleImports;}(),
        CallExpression: function () {function handleRequires(node) {
            if (!(0, _staticRequire2['default'])(node)) {
              return;
            }
            var block = getRequireBlock(node);
            if (!block) {
              return;
            }
            var name = node.arguments[0].value;
            registerNode(
            context,
            {
              node: node,
              value: name,
              displayName: name,
              type: 'require' },

            ranks,
            getBlockImports(block),
            pathGroupsExcludedImportTypes);

          }return handleRequires;}(),
        'Program:exit': function () {function reportAndReset() {
            importMap.forEach(function (imported) {
              if (newlinesBetweenImports !== 'ignore') {
                makeNewlinesBetweenReport(context, imported, newlinesBetweenImports, distinctGroup);
              }

              if (alphabetize.order !== 'ignore') {
                mutateRanksToAlphabetize(imported, alphabetize);
              }

              makeOutOfOrderReport(context, imported);
            });

            importMap.clear();
          }return reportAndReset;}() };

    }return importOrderRule;}() };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9vcmRlci5qcyJdLCJuYW1lcyI6WyJpbmNsdWRlcyIsIkZ1bmN0aW9uIiwiYmluZCIsInByb3RvdHlwZSIsImNhbGwiLCJBcnJheSIsImdyb3VwQnkiLCJhcnJheSIsImdyb3VwZXIiLCJyZWR1Y2UiLCJhY2MiLCJjdXJyIiwiaW5kZXgiLCJrZXkiLCJwdXNoIiwiZGVmYXVsdEdyb3VwcyIsInJldmVyc2UiLCJtYXAiLCJ2IiwicmFuayIsImdldFRva2Vuc09yQ29tbWVudHNBZnRlciIsInNvdXJjZUNvZGUiLCJub2RlIiwiY291bnQiLCJjdXJyZW50Tm9kZU9yVG9rZW4iLCJyZXN1bHQiLCJpIiwiZ2V0VG9rZW5PckNvbW1lbnRBZnRlciIsImdldFRva2Vuc09yQ29tbWVudHNCZWZvcmUiLCJnZXRUb2tlbk9yQ29tbWVudEJlZm9yZSIsInRha2VUb2tlbnNBZnRlcldoaWxlIiwiY29uZGl0aW9uIiwidG9rZW5zIiwibGVuZ3RoIiwidGFrZVRva2Vuc0JlZm9yZVdoaWxlIiwiZmluZE91dE9mT3JkZXIiLCJpbXBvcnRlZCIsIm1heFNlZW5SYW5rTm9kZSIsImZpbHRlciIsImltcG9ydGVkTW9kdWxlIiwicmVzIiwiZmluZFJvb3ROb2RlIiwicGFyZW50IiwiYm9keSIsImZpbmRFbmRPZkxpbmVXaXRoQ29tbWVudHMiLCJ0b2tlbnNUb0VuZE9mTGluZSIsImNvbW1lbnRPblNhbWVMaW5lQXMiLCJlbmRPZlRva2VucyIsInJhbmdlIiwidGV4dCIsInRva2VuIiwidHlwZSIsImxvYyIsInN0YXJ0IiwibGluZSIsImVuZCIsImZpbmRTdGFydE9mTGluZVdpdGhDb21tZW50cyIsInN0YXJ0T2ZUb2tlbnMiLCJpc1JlcXVpcmVFeHByZXNzaW9uIiwiZXhwciIsImNhbGxlZSIsIm5hbWUiLCJhcmd1bWVudHMiLCJpc1N1cHBvcnRlZFJlcXVpcmVNb2R1bGUiLCJkZWNsYXJhdGlvbnMiLCJkZWNsIiwiaXNQbGFpblJlcXVpcmUiLCJpZCIsImluaXQiLCJpc1JlcXVpcmVXaXRoTWVtYmVyRXhwcmVzc2lvbiIsIm9iamVjdCIsImlzUGxhaW5JbXBvcnRNb2R1bGUiLCJzcGVjaWZpZXJzIiwiaXNQbGFpbkltcG9ydEVxdWFscyIsIm1vZHVsZVJlZmVyZW5jZSIsImV4cHJlc3Npb24iLCJjYW5Dcm9zc05vZGVXaGlsZVJlb3JkZXIiLCJjYW5SZW9yZGVySXRlbXMiLCJmaXJzdE5vZGUiLCJzZWNvbmROb2RlIiwiaW5kZXhPZiIsInNvcnQiLCJmaXJzdEluZGV4Iiwic2Vjb25kSW5kZXgiLCJub2Rlc0JldHdlZW4iLCJzbGljZSIsIm5vZGVCZXR3ZWVuIiwibWFrZUltcG9ydERlc2NyaXB0aW9uIiwiaW1wb3J0S2luZCIsImZpeE91dE9mT3JkZXIiLCJjb250ZXh0Iiwib3JkZXIiLCJnZXRTb3VyY2VDb2RlIiwiZmlyc3RSb290IiwiZmlyc3RSb290U3RhcnQiLCJmaXJzdFJvb3RFbmQiLCJzZWNvbmRSb290Iiwic2Vjb25kUm9vdFN0YXJ0Iiwic2Vjb25kUm9vdEVuZCIsImNhbkZpeCIsIm5ld0NvZGUiLCJzdWJzdHJpbmciLCJmaXJzdEltcG9ydCIsImRpc3BsYXlOYW1lIiwic2Vjb25kSW1wb3J0IiwibWVzc2FnZSIsInJlcG9ydCIsImZpeCIsImZpeGVyIiwicmVwbGFjZVRleHRSYW5nZSIsInJlcG9ydE91dE9mT3JkZXIiLCJvdXRPZk9yZGVyIiwiZm9yRWFjaCIsImltcCIsImZvdW5kIiwiZmluZCIsImhhc0hpZ2hlclJhbmsiLCJpbXBvcnRlZEl0ZW0iLCJtYWtlT3V0T2ZPcmRlclJlcG9ydCIsInJldmVyc2VkSW1wb3J0ZWQiLCJyZXZlcnNlZE9yZGVyIiwiY29tcGFyZVN0cmluZyIsImEiLCJiIiwiREVBRlVMVF9JTVBPUlRfS0lORCIsImdldE5vcm1hbGl6ZWRWYWx1ZSIsInRvTG93ZXJDYXNlIiwidmFsdWUiLCJTdHJpbmciLCJnZXRTb3J0ZXIiLCJhbHBoYWJldGl6ZU9wdGlvbnMiLCJtdWx0aXBsaWVyIiwib3JkZXJJbXBvcnRLaW5kIiwibXVsdGlwbGllckltcG9ydEtpbmQiLCJpbXBvcnRzU29ydGVyIiwibm9kZUEiLCJub2RlQiIsImltcG9ydEEiLCJjYXNlSW5zZW5zaXRpdmUiLCJpbXBvcnRCIiwiQSIsInNwbGl0IiwiQiIsIk1hdGgiLCJtaW4iLCJtdXRhdGVSYW5rc1RvQWxwaGFiZXRpemUiLCJncm91cGVkQnlSYW5rcyIsIml0ZW0iLCJzb3J0ZXJGbiIsImdyb3VwUmFua3MiLCJPYmplY3QiLCJrZXlzIiwiZ3JvdXBSYW5rIiwibmV3UmFuayIsImFscGhhYmV0aXplZFJhbmtzIiwicGFyc2VJbnQiLCJjb21wdXRlUGF0aFJhbmsiLCJyYW5rcyIsInBhdGhHcm91cHMiLCJwYXRoIiwibWF4UG9zaXRpb24iLCJsIiwicGF0dGVybiIsInBhdHRlcm5PcHRpb25zIiwiZ3JvdXAiLCJwb3NpdGlvbiIsIm5vY29tbWVudCIsImNvbXB1dGVSYW5rIiwiaW1wb3J0RW50cnkiLCJleGNsdWRlZEltcG9ydFR5cGVzIiwiaW1wVHlwZSIsIm9taXR0ZWRUeXBlcyIsImhhcyIsImdyb3VwcyIsInN0YXJ0c1dpdGgiLCJyZWdpc3Rlck5vZGUiLCJnZXRSZXF1aXJlQmxvY2siLCJuIiwidHlwZXMiLCJjb252ZXJ0R3JvdXBzVG9SYW5rcyIsInJhbmtPYmplY3QiLCJjb25jYXQiLCJncm91cEl0ZW0iLCJFcnJvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJ1bmRlZmluZWQiLCJjb252ZXJ0UGF0aEdyb3Vwc0ZvclJhbmtzIiwiYWZ0ZXIiLCJiZWZvcmUiLCJ0cmFuc2Zvcm1lZCIsInBhdGhHcm91cCIsInBvc2l0aW9uU3RyaW5nIiwiZ3JvdXBMZW5ndGgiLCJncm91cEluZGV4IiwibWF4IiwiZ3JvdXBOZXh0UG9zaXRpb24iLCJwb3ciLCJjZWlsIiwibG9nMTAiLCJmaXhOZXdMaW5lQWZ0ZXJJbXBvcnQiLCJwcmV2aW91c0ltcG9ydCIsInByZXZSb290IiwiZW5kT2ZMaW5lIiwiaW5zZXJ0VGV4dEFmdGVyUmFuZ2UiLCJyZW1vdmVOZXdMaW5lQWZ0ZXJJbXBvcnQiLCJjdXJyZW50SW1wb3J0IiwiY3VyclJvb3QiLCJyYW5nZVRvUmVtb3ZlIiwidGVzdCIsInJlbW92ZVJhbmdlIiwibWFrZU5ld2xpbmVzQmV0d2VlblJlcG9ydCIsIm5ld2xpbmVzQmV0d2VlbkltcG9ydHMiLCJkaXN0aW5jdEdyb3VwIiwiZ2V0TnVtYmVyT2ZFbXB0eUxpbmVzQmV0d2VlbiIsImxpbmVzQmV0d2VlbkltcG9ydHMiLCJsaW5lcyIsInRyaW0iLCJnZXRJc1N0YXJ0T2ZEaXN0aW5jdEdyb3VwIiwiZW1wdHlMaW5lc0JldHdlZW4iLCJpc1N0YXJ0T2ZEaXN0aW5jdEdyb3VwIiwiZ2V0QWxwaGFiZXRpemVDb25maWciLCJvcHRpb25zIiwiYWxwaGFiZXRpemUiLCJkZWZhdWx0RGlzdGluY3RHcm91cCIsIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwiZG9jcyIsImNhdGVnb3J5IiwiZGVzY3JpcHRpb24iLCJ1cmwiLCJmaXhhYmxlIiwic2NoZW1hIiwicHJvcGVydGllcyIsInBhdGhHcm91cHNFeGNsdWRlZEltcG9ydFR5cGVzIiwiaXRlbXMiLCJhZGRpdGlvbmFsUHJvcGVydGllcyIsInJlcXVpcmVkIiwid2Fybk9uVW5hc3NpZ25lZEltcG9ydHMiLCJjcmVhdGUiLCJpbXBvcnRPcmRlclJ1bGUiLCJTZXQiLCJlcnJvciIsIlByb2dyYW0iLCJpbXBvcnRNYXAiLCJNYXAiLCJnZXRCbG9ja0ltcG9ydHMiLCJzZXQiLCJnZXQiLCJJbXBvcnREZWNsYXJhdGlvbiIsImhhbmRsZUltcG9ydHMiLCJzb3VyY2UiLCJUU0ltcG9ydEVxdWFsc0RlY2xhcmF0aW9uIiwiaXNFeHBvcnQiLCJnZXRUZXh0IiwiQ2FsbEV4cHJlc3Npb24iLCJoYW5kbGVSZXF1aXJlcyIsImJsb2NrIiwicmVwb3J0QW5kUmVzZXQiLCJjbGVhciJdLCJtYXBwaW5ncyI6IkFBQUEsYTs7QUFFQSxzQzs7QUFFQSxnRDtBQUNBLHNEO0FBQ0EscUM7O0FBRUEsSUFBTUEsV0FBV0MsU0FBU0MsSUFBVCxDQUFj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UixFQUZGOztBQVFFMEcsaUJBUkY7QUFTRTBGLDRCQUFnQlcsS0FBaEIsQ0FURjtBQVVFdkIseUNBVkY7O0FBWUQsV0FyQkQsT0FBeUJzQixjQUF6QixJQWpESztBQXVFTCxxQ0FBZ0IsU0FBU0UsY0FBVCxHQUEwQjtBQUN4Q2Qsc0JBQVVySSxPQUFWLENBQWtCLFVBQUM1RSxRQUFELEVBQWM7QUFDOUIsa0JBQUlnTCwyQkFBMkIsUUFBL0IsRUFBeUM7QUFDdkNELDBDQUEwQnpILE9BQTFCLEVBQW1DdEQsUUFBbkMsRUFBNkNnTCxzQkFBN0MsRUFBcUVDLGFBQXJFO0FBQ0Q7O0FBRUQsa0JBQUlVLFlBQVlwSSxLQUFaLEtBQXNCLFFBQTFCLEVBQW9DO0FBQ2xDc0QseUNBQXlCN0csUUFBekIsRUFBbUMyTCxXQUFuQztBQUNEOztBQUVEekcsbUNBQXFCNUIsT0FBckIsRUFBOEJ0RCxRQUE5QjtBQUNELGFBVkQ7O0FBWUFpTixzQkFBVWUsS0FBVjtBQUNELFdBZEQsT0FBeUJELGNBQXpCLElBdkVLLEVBQVA7O0FBdUZELEtBekhELE9BQWlCbEIsZUFBakIsSUFwRmUsRUFBakIiLCJmaWxlIjoib3JkZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmltcG9ydCBtaW5pbWF0Y2ggZnJvbSAnbWluaW1hdGNoJztcblxuaW1wb3J0IGltcG9ydFR5cGUgZnJvbSAnLi4vY29yZS9pbXBvcnRUeXBlJztcbmltcG9ydCBpc1N0YXRpY1JlcXVpcmUgZnJvbSAnLi4vY29yZS9zdGF0aWNSZXF1aXJlJztcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnO1xuXG5jb25zdCBpbmNsdWRlcyA9IEZ1bmN0aW9uLmJpbmQuYmluZChGdW5jdGlvbi5wcm90b3R5cGUuY2FsbCkoQXJyYXkucHJvdG90eXBlLmluY2x1ZGVzKTtcbi8vIFRoaXMgaXMgYSAqKm5vbi1zcGVjIGNvbXBsaWFudCoqIGJ1dCB3b3JrcyBpbiBwcmFjdGljZSByZXBsYWNlbWVudCBvZiBgb2JqZWN0Lmdyb3VwYnlgIHBhY2thZ2UuXG5jb25zdCBncm91cEJ5ID0gKGFycmF5LCBncm91cGVyKSA9PiBhcnJheS5yZWR1Y2UoKGFjYywgY3VyciwgaW5kZXgpID0+IHtcbiAgY29uc3Qga2V5ID0gZ3JvdXBlcihjdXJyLCBpbmRleCk7XG4gIChhY2Nba2V5XSA9IGFjY1trZXldIHx8IFtdKS5wdXNoKGN1cnIpO1xuICByZXR1cm4gYWNjO1xufSwge30pO1xuXG5jb25zdCBkZWZhdWx0R3JvdXBzID0gWydidWlsdGluJywgJ2V4dGVybmFsJywgJ3BhcmVudCcsICdzaWJsaW5nJywgJ2luZGV4J107XG5cbi8vIFJFUE9SVElORyBBTkQgRklYSU5HXG5cbmZ1bmN0aW9uIHJldmVyc2UoYXJyYXkpIHtcbiAgcmV0dXJuIGFycmF5Lm1hcChmdW5jdGlvbiAodikge1xuICAgIHJldHVybiB7IC4uLnYsIHJhbms6IC12LnJhbmsgfTtcbiAgfSkucmV2ZXJzZSgpO1xufVxuXG5mdW5jdGlvbiBnZXRUb2tlbnNPckNvbW1lbnRzQWZ0ZXIoc291cmNlQ29kZSwgbm9kZSwgY291bnQpIHtcbiAgbGV0IGN1cnJlbnROb2RlT3JUb2tlbiA9IG5vZGU7XG4gIGNvbnN0IHJlc3VsdCA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICBjdXJyZW50Tm9kZU9yVG9rZW4gPSBzb3VyY2VDb2RlLmdldFRva2VuT3JDb21tZW50QWZ0ZXIoY3VycmVudE5vZGVPclRva2VuKTtcbiAgICBpZiAoY3VycmVudE5vZGVPclRva2VuID09IG51bGwpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXN1bHQucHVzaChjdXJyZW50Tm9kZU9yVG9rZW4pO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGdldFRva2Vuc09yQ29tbWVudHNCZWZvcmUoc291cmNlQ29kZSwgbm9kZSwgY291bnQpIHtcbiAgbGV0IGN1cnJlbnROb2RlT3JUb2tlbiA9IG5vZGU7XG4gIGNvbnN0IHJlc3VsdCA9IFtdO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICBjdXJyZW50Tm9kZU9yVG9rZW4gPSBzb3VyY2VDb2RlLmdldFRva2VuT3JDb21tZW50QmVmb3JlKGN1cnJlbnROb2RlT3JUb2tlbik7XG4gICAgaWYgKGN1cnJlbnROb2RlT3JUb2tlbiA9PSBudWxsKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmVzdWx0LnB1c2goY3VycmVudE5vZGVPclRva2VuKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0LnJldmVyc2UoKTtcbn1cblxuZnVuY3Rpb24gdGFrZVRva2Vuc0FmdGVyV2hpbGUoc291cmNlQ29kZSwgbm9kZSwgY29uZGl0aW9uKSB7XG4gIGNvbnN0IHRva2VucyA9IGdldFRva2Vuc09yQ29tbWVudHNBZnRlcihzb3VyY2VDb2RlLCBub2RlLCAxMDApO1xuICBjb25zdCByZXN1bHQgPSBbXTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoY29uZGl0aW9uKHRva2Vuc1tpXSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHRva2Vuc1tpXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiB0YWtlVG9rZW5zQmVmb3JlV2hpbGUoc291cmNlQ29kZSwgbm9kZSwgY29uZGl0aW9uKSB7XG4gIGNvbnN0IHRva2VucyA9IGdldFRva2Vuc09yQ29tbWVudHNCZWZvcmUoc291cmNlQ29kZSwgbm9kZSwgMTAwKTtcbiAgY29uc3QgcmVzdWx0ID0gW107XG4gIGZvciAobGV0IGkgPSB0b2tlbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoY29uZGl0aW9uKHRva2Vuc1tpXSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHRva2Vuc1tpXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0LnJldmVyc2UoKTtcbn1cblxuZnVuY3Rpb24gZmluZE91dE9mT3JkZXIoaW1wb3J0ZWQpIHtcbiAgaWYgKGltcG9ydGVkLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICBsZXQgbWF4U2VlblJhbmtOb2RlID0gaW1wb3J0ZWRbMF07XG4gIHJldHVybiBpbXBvcnRlZC5maWx0ZXIoZnVuY3Rpb24gKGltcG9ydGVkTW9kdWxlKSB7XG4gICAgY29uc3QgcmVzID0gaW1wb3J0ZWRNb2R1bGUucmFuayA8IG1heFNlZW5SYW5rTm9kZS5yYW5rO1xuICAgIGlmIChtYXhTZWVuUmFua05vZGUucmFuayA8IGltcG9ydGVkTW9kdWxlLnJhbmspIHtcbiAgICAgIG1heFNlZW5SYW5rTm9kZSA9IGltcG9ydGVkTW9kdWxlO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZmluZFJvb3ROb2RlKG5vZGUpIHtcbiAgbGV0IHBhcmVudCA9IG5vZGU7XG4gIHdoaWxlIChwYXJlbnQucGFyZW50ICE9IG51bGwgJiYgcGFyZW50LnBhcmVudC5ib2R5ID09IG51bGwpIHtcbiAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICB9XG4gIHJldHVybiBwYXJlbnQ7XG59XG5cbmZ1bmN0aW9uIGZpbmRFbmRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgbm9kZSkge1xuICBjb25zdCB0b2tlbnNUb0VuZE9mTGluZSA9IHRha2VUb2tlbnNBZnRlcldoaWxlKHNvdXJjZUNvZGUsIG5vZGUsIGNvbW1lbnRPblNhbWVMaW5lQXMobm9kZSkpO1xuICBjb25zdCBlbmRPZlRva2VucyA9IHRva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCA+IDBcbiAgICA/IHRva2Vuc1RvRW5kT2ZMaW5lW3Rva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCAtIDFdLnJhbmdlWzFdXG4gICAgOiBub2RlLnJhbmdlWzFdO1xuICBsZXQgcmVzdWx0ID0gZW5kT2ZUb2tlbnM7XG4gIGZvciAobGV0IGkgPSBlbmRPZlRva2VuczsgaSA8IHNvdXJjZUNvZGUudGV4dC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChzb3VyY2VDb2RlLnRleHRbaV0gPT09ICdcXG4nKSB7XG4gICAgICByZXN1bHQgPSBpICsgMTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBpZiAoc291cmNlQ29kZS50ZXh0W2ldICE9PSAnICcgJiYgc291cmNlQ29kZS50ZXh0W2ldICE9PSAnXFx0JyAmJiBzb3VyY2VDb2RlLnRleHRbaV0gIT09ICdcXHInKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgcmVzdWx0ID0gaSArIDE7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY29tbWVudE9uU2FtZUxpbmVBcyhub2RlKSB7XG4gIHJldHVybiAodG9rZW4pID0+ICh0b2tlbi50eXBlID09PSAnQmxvY2snIHx8ICB0b2tlbi50eXBlID09PSAnTGluZScpXG4gICAgICAmJiB0b2tlbi5sb2Muc3RhcnQubGluZSA9PT0gdG9rZW4ubG9jLmVuZC5saW5lXG4gICAgICAmJiB0b2tlbi5sb2MuZW5kLmxpbmUgPT09IG5vZGUubG9jLmVuZC5saW5lO1xufVxuXG5mdW5jdGlvbiBmaW5kU3RhcnRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgbm9kZSkge1xuICBjb25zdCB0b2tlbnNUb0VuZE9mTGluZSA9IHRha2VUb2tlbnNCZWZvcmVXaGlsZShzb3VyY2VDb2RlLCBub2RlLCBjb21tZW50T25TYW1lTGluZUFzKG5vZGUpKTtcbiAgY29uc3Qgc3RhcnRPZlRva2VucyA9IHRva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCA+IDAgPyB0b2tlbnNUb0VuZE9mTGluZVswXS5yYW5nZVswXSA6IG5vZGUucmFuZ2VbMF07XG4gIGxldCByZXN1bHQgPSBzdGFydE9mVG9rZW5zO1xuICBmb3IgKGxldCBpID0gc3RhcnRPZlRva2VucyAtIDE7IGkgPiAwOyBpLS0pIHtcbiAgICBpZiAoc291cmNlQ29kZS50ZXh0W2ldICE9PSAnICcgJiYgc291cmNlQ29kZS50ZXh0W2ldICE9PSAnXFx0Jykge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJlc3VsdCA9IGk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gaXNSZXF1aXJlRXhwcmVzc2lvbihleHByKSB7XG4gIHJldHVybiBleHByICE9IG51bGxcbiAgICAmJiBleHByLnR5cGUgPT09ICdDYWxsRXhwcmVzc2lvbidcbiAgICAmJiBleHByLmNhbGxlZSAhPSBudWxsXG4gICAgJiYgZXhwci5jYWxsZWUubmFtZSA9PT0gJ3JlcXVpcmUnXG4gICAgJiYgZXhwci5hcmd1bWVudHMgIT0gbnVsbFxuICAgICYmIGV4cHIuYXJndW1lbnRzLmxlbmd0aCA9PT0gMVxuICAgICYmIGV4cHIuYXJndW1lbnRzWzBdLnR5cGUgPT09ICdMaXRlcmFsJztcbn1cblxuZnVuY3Rpb24gaXNTdXBwb3J0ZWRSZXF1aXJlTW9kdWxlKG5vZGUpIHtcbiAgaWYgKG5vZGUudHlwZSAhPT0gJ1ZhcmlhYmxlRGVjbGFyYXRpb24nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChub2RlLmRlY2xhcmF0aW9ucy5sZW5ndGggIT09IDEpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgZGVjbCA9IG5vZGUuZGVjbGFyYXRpb25zWzBdO1xuICBjb25zdCBpc1BsYWluUmVxdWlyZSA9IGRlY2wuaWRcbiAgICAmJiAoZGVjbC5pZC50eXBlID09PSAnSWRlbnRpZmllcicgfHwgZGVjbC5pZC50eXBlID09PSAnT2JqZWN0UGF0dGVybicpXG4gICAgJiYgaXNSZXF1aXJlRXhwcmVzc2lvbihkZWNsLmluaXQpO1xuICBjb25zdCBpc1JlcXVpcmVXaXRoTWVtYmVyRXhwcmVzc2lvbiA9IGRlY2wuaWRcbiAgICAmJiAoZGVjbC5pZC50eXBlID09PSAnSWRlbnRpZmllcicgfHwgZGVjbC5pZC50eXBlID09PSAnT2JqZWN0UGF0dGVybicpXG4gICAgJiYgZGVjbC5pbml0ICE9IG51bGxcbiAgICAmJiBkZWNsLmluaXQudHlwZSA9PT0gJ0NhbGxFeHByZXNzaW9uJ1xuICAgICYmIGRlY2wuaW5pdC5jYWxsZWUgIT0gbnVsbFxuICAgICYmIGRlY2wuaW5pdC5jYWxsZWUudHlwZSA9PT0gJ01lbWJlckV4cHJlc3Npb24nXG4gICAgJiYgaXNSZXF1aXJlRXhwcmVzc2lvbihkZWNsLmluaXQuY2FsbGVlLm9iamVjdCk7XG4gIHJldHVybiBpc1BsYWluUmVxdWlyZSB8fCBpc1JlcXVpcmVXaXRoTWVtYmVyRXhwcmVzc2lvbjtcbn1cblxuZnVuY3Rpb24gaXNQbGFpbkltcG9ydE1vZHVsZShub2RlKSB7XG4gIHJldHVybiBub2RlLnR5cGUgPT09ICdJbXBvcnREZWNsYXJhdGlvbicgJiYgbm9kZS5zcGVjaWZpZXJzICE9IG51bGwgJiYgbm9kZS5zcGVjaWZpZXJzLmxlbmd0aCA+IDA7XG59XG5cbmZ1bmN0aW9uIGlzUGxhaW5JbXBvcnRFcXVhbHMobm9kZSkge1xuICByZXR1cm4gbm9kZS50eXBlID09PSAnVFNJbXBvcnRFcXVhbHNEZWNsYXJhdGlvbicgJiYgbm9kZS5tb2R1bGVSZWZlcmVuY2UuZXhwcmVzc2lvbjtcbn1cblxuZnVuY3Rpb24gY2FuQ3Jvc3NOb2RlV2hpbGVSZW9yZGVyKG5vZGUpIHtcbiAgcmV0dXJuIGlzU3VwcG9ydGVkUmVxdWlyZU1vZHVsZShub2RlKSB8fCBpc1BsYWluSW1wb3J0TW9kdWxlKG5vZGUpIHx8IGlzUGxhaW5JbXBvcnRFcXVhbHMobm9kZSk7XG59XG5cbmZ1bmN0aW9uIGNhblJlb3JkZXJJdGVtcyhmaXJzdE5vZGUsIHNlY29uZE5vZGUpIHtcbiAgY29uc3QgcGFyZW50ID0gZmlyc3ROb2RlLnBhcmVudDtcbiAgY29uc3QgW2ZpcnN0SW5kZXgsIHNlY29uZEluZGV4XSA9IFtcbiAgICBwYXJlbnQuYm9keS5pbmRleE9mKGZpcnN0Tm9kZSksXG4gICAgcGFyZW50LmJvZHkuaW5kZXhPZihzZWNvbmROb2RlKSxcbiAgXS5zb3J0KCk7XG4gIGNvbnN0IG5vZGVzQmV0d2VlbiA9IHBhcmVudC5ib2R5LnNsaWNlKGZpcnN0SW5kZXgsIHNlY29uZEluZGV4ICsgMSk7XG4gIGZvciAoY29uc3Qgbm9kZUJldHdlZW4gb2Ygbm9kZXNCZXR3ZWVuKSB7XG4gICAgaWYgKCFjYW5Dcm9zc05vZGVXaGlsZVJlb3JkZXIobm9kZUJldHdlZW4pKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBtYWtlSW1wb3J0RGVzY3JpcHRpb24obm9kZSkge1xuICBpZiAobm9kZS5ub2RlLmltcG9ydEtpbmQgPT09ICd0eXBlJykge1xuICAgIHJldHVybiAndHlwZSBpbXBvcnQnO1xuICB9XG4gIGlmIChub2RlLm5vZGUuaW1wb3J0S2luZCA9PT0gJ3R5cGVvZicpIHtcbiAgICByZXR1cm4gJ3R5cGVvZiBpbXBvcnQnO1xuICB9XG4gIHJldHVybiAnaW1wb3J0Jztcbn1cblxuZnVuY3Rpb24gZml4T3V0T2ZPcmRlcihjb250ZXh0LCBmaXJzdE5vZGUsIHNlY29uZE5vZGUsIG9yZGVyKSB7XG4gIGNvbnN0IHNvdXJjZUNvZGUgPSBjb250ZXh0LmdldFNvdXJjZUNvZGUoKTtcblxuICBjb25zdCBmaXJzdFJvb3QgPSBmaW5kUm9vdE5vZGUoZmlyc3ROb2RlLm5vZGUpO1xuICBjb25zdCBmaXJzdFJvb3RTdGFydCA9IGZpbmRTdGFydE9mTGluZVdpdGhDb21tZW50cyhzb3VyY2VDb2RlLCBmaXJzdFJvb3QpO1xuICBjb25zdCBmaXJzdFJvb3RFbmQgPSBmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIGZpcnN0Um9vdCk7XG5cbiAgY29uc3Qgc2Vjb25kUm9vdCA9IGZpbmRSb290Tm9kZShzZWNvbmROb2RlLm5vZGUpO1xuICBjb25zdCBzZWNvbmRSb290U3RhcnQgPSBmaW5kU3RhcnRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgc2Vjb25kUm9vdCk7XG4gIGNvbnN0IHNlY29uZFJvb3RFbmQgPSBmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIHNlY29uZFJvb3QpO1xuICBjb25zdCBjYW5GaXggPSBjYW5SZW9yZGVySXRlbXMoZmlyc3RSb290LCBzZWNvbmRSb290KTtcblxuICBsZXQgbmV3Q29kZSA9IHNvdXJjZUNvZGUudGV4dC5zdWJzdHJpbmcoc2Vjb25kUm9vdFN0YXJ0LCBzZWNvbmRSb290RW5kKTtcbiAgaWYgKG5ld0NvZGVbbmV3Q29kZS5sZW5ndGggLSAxXSAhPT0gJ1xcbicpIHtcbiAgICBuZXdDb2RlID0gYCR7bmV3Q29kZX1cXG5gO1xuICB9XG5cbiAgY29uc3QgZmlyc3RJbXBvcnQgPSBgJHttYWtlSW1wb3J0RGVzY3JpcHRpb24oZmlyc3ROb2RlKX0gb2YgXFxgJHtmaXJzdE5vZGUuZGlzcGxheU5hbWV9XFxgYDtcbiAgY29uc3Qgc2Vjb25kSW1wb3J0ID0gYFxcYCR7c2Vjb25kTm9kZS5kaXNwbGF5TmFtZX1cXGAgJHttYWtlSW1wb3J0RGVzY3JpcHRpb24oc2Vjb25kTm9kZSl9YDtcbiAgY29uc3QgbWVzc2FnZSA9IGAke3NlY29uZEltcG9ydH0gc2hvdWxkIG9jY3VyICR7b3JkZXJ9ICR7Zmlyc3RJbXBvcnR9YDtcblxuICBpZiAob3JkZXIgPT09ICdiZWZvcmUnKSB7XG4gICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgbm9kZTogc2Vjb25kTm9kZS5ub2RlLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIGZpeDogY2FuRml4ICYmICgoZml4ZXIpID0+IGZpeGVyLnJlcGxhY2VUZXh0UmFuZ2UoXG4gICAgICAgIFtmaXJzdFJvb3RTdGFydCwgc2Vjb25kUm9vdEVuZF0sXG4gICAgICAgIG5ld0NvZGUgKyBzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKGZpcnN0Um9vdFN0YXJ0LCBzZWNvbmRSb290U3RhcnQpLFxuICAgICAgKSksXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAob3JkZXIgPT09ICdhZnRlcicpIHtcbiAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICBub2RlOiBzZWNvbmROb2RlLm5vZGUsXG4gICAgICBtZXNzYWdlLFxuICAgICAgZml4OiBjYW5GaXggJiYgKChmaXhlcikgPT4gZml4ZXIucmVwbGFjZVRleHRSYW5nZShcbiAgICAgICAgW3NlY29uZFJvb3RTdGFydCwgZmlyc3RSb290RW5kXSxcbiAgICAgICAgc291cmNlQ29kZS50ZXh0LnN1YnN0cmluZyhzZWNvbmRSb290RW5kLCBmaXJzdFJvb3RFbmQpICsgbmV3Q29kZSxcbiAgICAgICkpLFxuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlcG9ydE91dE9mT3JkZXIoY29udGV4dCwgaW1wb3J0ZWQsIG91dE9mT3JkZXIsIG9yZGVyKSB7XG4gIG91dE9mT3JkZXIuZm9yRWFjaChmdW5jdGlvbiAoaW1wKSB7XG4gICAgY29uc3QgZm91bmQgPSBpbXBvcnRlZC5maW5kKGZ1bmN0aW9uIGhhc0hpZ2hlclJhbmsoaW1wb3J0ZWRJdGVtKSB7XG4gICAgICByZXR1cm4gaW1wb3J0ZWRJdGVtLnJhbmsgPiBpbXAucmFuaztcbiAgICB9KTtcbiAgICBmaXhPdXRPZk9yZGVyKGNvbnRleHQsIGZvdW5kLCBpbXAsIG9yZGVyKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1ha2VPdXRPZk9yZGVyUmVwb3J0KGNvbnRleHQsIGltcG9ydGVkKSB7XG4gIGNvbnN0IG91dE9mT3JkZXIgPSBmaW5kT3V0T2ZPcmRlcihpbXBvcnRlZCk7XG4gIGlmICghb3V0T2ZPcmRlci5sZW5ndGgpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBUaGVyZSBhcmUgdGhpbmdzIHRvIHJlcG9ydC4gVHJ5IHRvIG1pbmltaXplIHRoZSBudW1iZXIgb2YgcmVwb3J0ZWQgZXJyb3JzLlxuICBjb25zdCByZXZlcnNlZEltcG9ydGVkID0gcmV2ZXJzZShpbXBvcnRlZCk7XG4gIGNvbnN0IHJldmVyc2VkT3JkZXIgPSBmaW5kT3V0T2ZPcmRlcihyZXZlcnNlZEltcG9ydGVkKTtcbiAgaWYgKHJldmVyc2VkT3JkZXIubGVuZ3RoIDwgb3V0T2ZPcmRlci5sZW5ndGgpIHtcbiAgICByZXBvcnRPdXRPZk9yZGVyKGNvbnRleHQsIHJldmVyc2VkSW1wb3J0ZWQsIHJldmVyc2VkT3JkZXIsICdhZnRlcicpO1xuICAgIHJldHVybjtcbiAgfVxuICByZXBvcnRPdXRPZk9yZGVyKGNvbnRleHQsIGltcG9ydGVkLCBvdXRPZk9yZGVyLCAnYmVmb3JlJyk7XG59XG5cbmNvbnN0IGNvbXBhcmVTdHJpbmcgPSAoYSwgYikgPT4ge1xuICBpZiAoYSA8IGIpIHtcbiAgICByZXR1cm4gLTE7XG4gIH1cbiAgaWYgKGEgPiBiKSB7XG4gICAgcmV0dXJuIDE7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG4vKiogU29tZSBwYXJzZXJzIChsYW5ndWFnZXMgd2l0aG91dCB0eXBlcykgZG9uJ3QgcHJvdmlkZSBJbXBvcnRLaW5kICovXG5jb25zdCBERUFGVUxUX0lNUE9SVF9LSU5EID0gJ3ZhbHVlJztcbmNvbnN0IGdldE5vcm1hbGl6ZWRWYWx1ZSA9IChub2RlLCB0b0xvd2VyQ2FzZSkgPT4ge1xuICBjb25zdCB2YWx1ZSA9IG5vZGUudmFsdWU7XG4gIHJldHVybiB0b0xvd2VyQ2FzZSA/IFN0cmluZyh2YWx1ZSkudG9Mb3dlckNhc2UoKSA6IHZhbHVlO1xufTtcblxuZnVuY3Rpb24gZ2V0U29ydGVyKGFscGhhYmV0aXplT3B0aW9ucykge1xuICBjb25zdCBtdWx0aXBsaWVyID0gYWxwaGFiZXRpemVPcHRpb25zLm9yZGVyID09PSAnYXNjJyA/IDEgOiAtMTtcbiAgY29uc3Qgb3JkZXJJbXBvcnRLaW5kID0gYWxwaGFiZXRpemVPcHRpb25zLm9yZGVySW1wb3J0S2luZDtcbiAgY29uc3QgbXVsdGlwbGllckltcG9ydEtpbmQgPSBvcmRlckltcG9ydEtpbmQgIT09ICdpZ25vcmUnXG4gICAgJiYgKGFscGhhYmV0aXplT3B0aW9ucy5vcmRlckltcG9ydEtpbmQgPT09ICdhc2MnID8gMSA6IC0xKTtcblxuICByZXR1cm4gZnVuY3Rpb24gaW1wb3J0c1NvcnRlcihub2RlQSwgbm9kZUIpIHtcbiAgICBjb25zdCBpbXBvcnRBID0gZ2V0Tm9ybWFsaXplZFZhbHVlKG5vZGVBLCBhbHBoYWJldGl6ZU9wdGlvbnMuY2FzZUluc2Vuc2l0aXZlKTtcbiAgICBjb25zdCBpbXBvcnRCID0gZ2V0Tm9ybWFsaXplZFZhbHVlKG5vZGVCLCBhbHBoYWJldGl6ZU9wdGlvbnMuY2FzZUluc2Vuc2l0aXZlKTtcbiAgICBsZXQgcmVzdWx0ID0gMDtcblxuICAgIGlmICghaW5jbHVkZXMoaW1wb3J0QSwgJy8nKSAmJiAhaW5jbHVkZXMoaW1wb3J0QiwgJy8nKSkge1xuICAgICAgcmVzdWx0ID0gY29tcGFyZVN0cmluZyhpbXBvcnRBLCBpbXBvcnRCKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgQSA9IGltcG9ydEEuc3BsaXQoJy8nKTtcbiAgICAgIGNvbnN0IEIgPSBpbXBvcnRCLnNwbGl0KCcvJyk7XG4gICAgICBjb25zdCBhID0gQS5sZW5ndGg7XG4gICAgICBjb25zdCBiID0gQi5sZW5ndGg7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTWF0aC5taW4oYSwgYik7IGkrKykge1xuICAgICAgICByZXN1bHQgPSBjb21wYXJlU3RyaW5nKEFbaV0sIEJbaV0pO1xuICAgICAgICBpZiAocmVzdWx0KSB7IGJyZWFrOyB9XG4gICAgICB9XG5cbiAgICAgIGlmICghcmVzdWx0ICYmIGEgIT09IGIpIHtcbiAgICAgICAgcmVzdWx0ID0gYSA8IGIgPyAtMSA6IDE7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmVzdWx0ID0gcmVzdWx0ICogbXVsdGlwbGllcjtcblxuICAgIC8vIEluIGNhc2UgdGhlIHBhdGhzIGFyZSBlcXVhbCAocmVzdWx0ID09PSAwKSwgc29ydCB0aGVtIGJ5IGltcG9ydEtpbmRcbiAgICBpZiAoIXJlc3VsdCAmJiBtdWx0aXBsaWVySW1wb3J0S2luZCkge1xuICAgICAgcmVzdWx0ID0gbXVsdGlwbGllckltcG9ydEtpbmQgKiBjb21wYXJlU3RyaW5nKFxuICAgICAgICBub2RlQS5ub2RlLmltcG9ydEtpbmQgfHwgREVBRlVMVF9JTVBPUlRfS0lORCxcbiAgICAgICAgbm9kZUIubm9kZS5pbXBvcnRLaW5kIHx8IERFQUZVTFRfSU1QT1JUX0tJTkQsXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5cbmZ1bmN0aW9uIG11dGF0ZVJhbmtzVG9BbHBoYWJldGl6ZShpbXBvcnRlZCwgYWxwaGFiZXRpemVPcHRpb25zKSB7XG4gIGNvbnN0IGdyb3VwZWRCeVJhbmtzID0gZ3JvdXBCeShpbXBvcnRlZCwgKGl0ZW0pID0+IGl0ZW0ucmFuayk7XG5cbiAgY29uc3Qgc29ydGVyRm4gPSBnZXRTb3J0ZXIoYWxwaGFiZXRpemVPcHRpb25zKTtcblxuICAvLyBzb3J0IGdyb3VwIGtleXMgc28gdGhhdCB0aGV5IGNhbiBiZSBpdGVyYXRlZCBvbiBpbiBvcmRlclxuICBjb25zdCBncm91cFJhbmtzID0gT2JqZWN0LmtleXMoZ3JvdXBlZEJ5UmFua3MpLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICByZXR1cm4gYSAtIGI7XG4gIH0pO1xuXG4gIC8vIHNvcnQgaW1wb3J0cyBsb2NhbGx5IHdpdGhpbiB0aGVpciBncm91cFxuICBncm91cFJhbmtzLmZvckVhY2goZnVuY3Rpb24gKGdyb3VwUmFuaykge1xuICAgIGdyb3VwZWRCeVJhbmtzW2dyb3VwUmFua10uc29ydChzb3J0ZXJGbik7XG4gIH0pO1xuXG4gIC8vIGFzc2lnbiBnbG9iYWxseSB1bmlxdWUgcmFuayB0byBlYWNoIGltcG9ydFxuICBsZXQgbmV3UmFuayA9IDA7XG4gIGNvbnN0IGFscGhhYmV0aXplZFJhbmtzID0gZ3JvdXBSYW5rcy5yZWR1Y2UoZnVuY3Rpb24gKGFjYywgZ3JvdXBSYW5rKSB7XG4gICAgZ3JvdXBlZEJ5UmFua3NbZ3JvdXBSYW5rXS5mb3JFYWNoKGZ1bmN0aW9uIChpbXBvcnRlZEl0ZW0pIHtcbiAgICAgIGFjY1tgJHtpbXBvcnRlZEl0ZW0udmFsdWV9fCR7aW1wb3J0ZWRJdGVtLm5vZGUuaW1wb3J0S2luZH1gXSA9IHBhcnNlSW50KGdyb3VwUmFuaywgMTApICsgbmV3UmFuaztcbiAgICAgIG5ld1JhbmsgKz0gMTtcbiAgICB9KTtcbiAgICByZXR1cm4gYWNjO1xuICB9LCB7fSk7XG5cbiAgLy8gbXV0YXRlIHRoZSBvcmlnaW5hbCBncm91cC1yYW5rIHdpdGggYWxwaGFiZXRpemVkLXJhbmtcbiAgaW1wb3J0ZWQuZm9yRWFjaChmdW5jdGlvbiAoaW1wb3J0ZWRJdGVtKSB7XG4gICAgaW1wb3J0ZWRJdGVtLnJhbmsgPSBhbHBoYWJldGl6ZWRSYW5rc1tgJHtpbXBvcnRlZEl0ZW0udmFsdWV9fCR7aW1wb3J0ZWRJdGVtLm5vZGUuaW1wb3J0S2luZH1gXTtcbiAgfSk7XG59XG5cbi8vIERFVEVDVElOR1xuXG5mdW5jdGlvbiBjb21wdXRlUGF0aFJhbmsocmFua3MsIHBhdGhHcm91cHMsIHBhdGgsIG1heFBvc2l0aW9uKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsID0gcGF0aEdyb3Vwcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBjb25zdCB7IHBhdHRlcm4sIHBhdHRlcm5PcHRpb25zLCBncm91cCwgcG9zaXRpb24gPSAxIH0gPSBwYXRoR3JvdXBzW2ldO1xuICAgIGlmIChtaW5pbWF0Y2gocGF0aCwgcGF0dGVybiwgcGF0dGVybk9wdGlvbnMgfHwgeyBub2NvbW1lbnQ6IHRydWUgfSkpIHtcbiAgICAgIHJldHVybiByYW5rc1tncm91cF0gKyBwb3NpdGlvbiAvIG1heFBvc2l0aW9uO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjb21wdXRlUmFuayhjb250ZXh0LCByYW5rcywgaW1wb3J0RW50cnksIGV4Y2x1ZGVkSW1wb3J0VHlwZXMpIHtcbiAgbGV0IGltcFR5cGU7XG4gIGxldCByYW5rO1xuICBpZiAoaW1wb3J0RW50cnkudHlwZSA9PT0gJ2ltcG9ydDpvYmplY3QnKSB7XG4gICAgaW1wVHlwZSA9ICdvYmplY3QnO1xuICB9IGVsc2UgaWYgKGltcG9ydEVudHJ5Lm5vZGUuaW1wb3J0S2luZCA9PT0gJ3R5cGUnICYmIHJhbmtzLm9taXR0ZWRUeXBlcy5pbmRleE9mKCd0eXBlJykgPT09IC0xKSB7XG4gICAgaW1wVHlwZSA9ICd0eXBlJztcbiAgfSBlbHNlIHtcbiAgICBpbXBUeXBlID0gaW1wb3J0VHlwZShpbXBvcnRFbnRyeS52YWx1ZSwgY29udGV4dCk7XG4gIH1cbiAgaWYgKCFleGNsdWRlZEltcG9ydFR5cGVzLmhhcyhpbXBUeXBlKSkge1xuICAgIHJhbmsgPSBjb21wdXRlUGF0aFJhbmsocmFua3MuZ3JvdXBzLCByYW5rcy5wYXRoR3JvdXBzLCBpbXBvcnRFbnRyeS52YWx1ZSwgcmFua3MubWF4UG9zaXRpb24pO1xuICB9XG4gIGlmICh0eXBlb2YgcmFuayA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByYW5rID0gcmFua3MuZ3JvdXBzW2ltcFR5cGVdO1xuICB9XG4gIGlmIChpbXBvcnRFbnRyeS50eXBlICE9PSAnaW1wb3J0JyAmJiAhaW1wb3J0RW50cnkudHlwZS5zdGFydHNXaXRoKCdpbXBvcnQ6JykpIHtcbiAgICByYW5rICs9IDEwMDtcbiAgfVxuXG4gIHJldHVybiByYW5rO1xufVxuXG5mdW5jdGlvbiByZWdpc3Rlck5vZGUoY29udGV4dCwgaW1wb3J0RW50cnksIHJhbmtzLCBpbXBvcnRlZCwgZXhjbHVkZWRJbXBvcnRUeXBlcykge1xuICBjb25zdCByYW5rID0gY29tcHV0ZVJhbmsoY29udGV4dCwgcmFua3MsIGltcG9ydEVudHJ5LCBleGNsdWRlZEltcG9ydFR5cGVzKTtcbiAgaWYgKHJhbmsgIT09IC0xKSB7XG4gICAgaW1wb3J0ZWQucHVzaCh7IC4uLmltcG9ydEVudHJ5LCByYW5rIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldFJlcXVpcmVCbG9jayhub2RlKSB7XG4gIGxldCBuID0gbm9kZTtcbiAgLy8gSGFuZGxlIGNhc2VzIGxpa2UgYGNvbnN0IGJheiA9IHJlcXVpcmUoJ2ZvbycpLmJhci5iYXpgXG4gIC8vIGFuZCBgY29uc3QgZm9vID0gcmVxdWlyZSgnZm9vJykoKWBcbiAgd2hpbGUgKFxuICAgIG4ucGFyZW50LnR5cGUgPT09ICdNZW1iZXJFeHByZXNzaW9uJyAmJiBuLnBhcmVudC5vYmplY3QgPT09IG5cbiAgICB8fCBuLnBhcmVudC50eXBlID09PSAnQ2FsbEV4cHJlc3Npb24nICYmIG4ucGFyZW50LmNhbGxlZSA9PT0gblxuICApIHtcbiAgICBuID0gbi5wYXJlbnQ7XG4gIH1cbiAgaWYgKFxuICAgIG4ucGFyZW50LnR5cGUgPT09ICdWYXJpYWJsZURlY2xhcmF0b3InXG4gICAgJiYgbi5wYXJlbnQucGFyZW50LnR5cGUgPT09ICdWYXJpYWJsZURlY2xhcmF0aW9uJ1xuICAgICYmIG4ucGFyZW50LnBhcmVudC5wYXJlbnQudHlwZSA9PT0gJ1Byb2dyYW0nXG4gICkge1xuICAgIHJldHVybiBuLnBhcmVudC5wYXJlbnQucGFyZW50O1xuICB9XG59XG5cbmNvbnN0IHR5cGVzID0gWydidWlsdGluJywgJ2V4dGVybmFsJywgJ2ludGVybmFsJywgJ3Vua25vd24nLCAncGFyZW50JywgJ3NpYmxpbmcnLCAnaW5kZXgnLCAnb2JqZWN0JywgJ3R5cGUnXTtcblxuLy8gQ3JlYXRlcyBhbiBvYmplY3Qgd2l0aCB0eXBlLXJhbmsgcGFpcnMuXG4vLyBFeGFtcGxlOiB7IGluZGV4OiAwLCBzaWJsaW5nOiAxLCBwYXJlbnQ6IDEsIGV4dGVybmFsOiAxLCBidWlsdGluOiAyLCBpbnRlcm5hbDogMiB9XG4vLyBXaWxsIHRocm93IGFuIGVycm9yIGlmIGl0IGNvbnRhaW5zIGEgdHlwZSB0aGF0IGRvZXMgbm90IGV4aXN0LCBvciBoYXMgYSBkdXBsaWNhdGVcbmZ1bmN0aW9uIGNvbnZlcnRHcm91cHNUb1JhbmtzKGdyb3Vwcykge1xuICBpZiAoZ3JvdXBzLmxlbmd0aCA9PT0gMSkge1xuICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIGBpZmAgYW5kIGZpeCB0aGUgYnVnXG4gICAgcmV0dXJuIGNvbnZlcnRHcm91cHNUb1JhbmtzKGdyb3Vwc1swXSk7XG4gIH1cbiAgY29uc3QgcmFua09iamVjdCA9IGdyb3Vwcy5yZWR1Y2UoZnVuY3Rpb24gKHJlcywgZ3JvdXAsIGluZGV4KSB7XG4gICAgW10uY29uY2F0KGdyb3VwKS5mb3JFYWNoKGZ1bmN0aW9uIChncm91cEl0ZW0pIHtcbiAgICAgIGlmICh0eXBlcy5pbmRleE9mKGdyb3VwSXRlbSkgPT09IC0xKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSW5jb3JyZWN0IGNvbmZpZ3VyYXRpb24gb2YgdGhlIHJ1bGU6IFVua25vd24gdHlwZSBcXGAke0pTT04uc3RyaW5naWZ5KGdyb3VwSXRlbSl9XFxgYCk7XG4gICAgICB9XG4gICAgICBpZiAocmVzW2dyb3VwSXRlbV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEluY29ycmVjdCBjb25maWd1cmF0aW9uIG9mIHRoZSBydWxlOiBcXGAke2dyb3VwSXRlbX1cXGAgaXMgZHVwbGljYXRlZGApO1xuICAgICAgfVxuICAgICAgcmVzW2dyb3VwSXRlbV0gPSBpbmRleCAqIDI7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwge30pO1xuXG4gIGNvbnN0IG9taXR0ZWRUeXBlcyA9IHR5cGVzLmZpbHRlcihmdW5jdGlvbiAodHlwZSkge1xuICAgIHJldHVybiB0eXBlb2YgcmFua09iamVjdFt0eXBlXSA9PT0gJ3VuZGVmaW5lZCc7XG4gIH0pO1xuXG4gIGNvbnN0IHJhbmtzID0gb21pdHRlZFR5cGVzLnJlZHVjZShmdW5jdGlvbiAocmVzLCB0eXBlKSB7XG4gICAgcmVzW3R5cGVdID0gZ3JvdXBzLmxlbmd0aCAqIDI7XG4gICAgcmV0dXJuIHJlcztcbiAgfSwgcmFua09iamVjdCk7XG5cbiAgcmV0dXJuIHsgZ3JvdXBzOiByYW5rcywgb21pdHRlZFR5cGVzIH07XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRQYXRoR3JvdXBzRm9yUmFua3MocGF0aEdyb3Vwcykge1xuICBjb25zdCBhZnRlciA9IHt9O1xuICBjb25zdCBiZWZvcmUgPSB7fTtcblxuICBjb25zdCB0cmFuc2Zvcm1lZCA9IHBhdGhHcm91cHMubWFwKChwYXRoR3JvdXAsIGluZGV4KSA9PiB7XG4gICAgY29uc3QgeyBncm91cCwgcG9zaXRpb246IHBvc2l0aW9uU3RyaW5nIH0gPSBwYXRoR3JvdXA7XG4gICAgbGV0IHBvc2l0aW9uID0gMDtcbiAgICBpZiAocG9zaXRpb25TdHJpbmcgPT09ICdhZnRlcicpIHtcbiAgICAgIGlmICghYWZ0ZXJbZ3JvdXBdKSB7XG4gICAgICAgIGFmdGVyW2dyb3VwXSA9IDE7XG4gICAgICB9XG4gICAgICBwb3NpdGlvbiA9IGFmdGVyW2dyb3VwXSsrO1xuICAgIH0gZWxzZSBpZiAocG9zaXRpb25TdHJpbmcgPT09ICdiZWZvcmUnKSB7XG4gICAgICBpZiAoIWJlZm9yZVtncm91cF0pIHtcbiAgICAgICAgYmVmb3JlW2dyb3VwXSA9IFtdO1xuICAgICAgfVxuICAgICAgYmVmb3JlW2dyb3VwXS5wdXNoKGluZGV4KTtcbiAgICB9XG5cbiAgICByZXR1cm4geyAuLi5wYXRoR3JvdXAsIHBvc2l0aW9uIH07XG4gIH0pO1xuXG4gIGxldCBtYXhQb3NpdGlvbiA9IDE7XG5cbiAgT2JqZWN0LmtleXMoYmVmb3JlKS5mb3JFYWNoKChncm91cCkgPT4ge1xuICAgIGNvbnN0IGdyb3VwTGVuZ3RoID0gYmVmb3JlW2dyb3VwXS5sZW5ndGg7XG4gICAgYmVmb3JlW2dyb3VwXS5mb3JFYWNoKChncm91cEluZGV4LCBpbmRleCkgPT4ge1xuICAgICAgdHJhbnNmb3JtZWRbZ3JvdXBJbmRleF0ucG9zaXRpb24gPSAtMSAqIChncm91cExlbmd0aCAtIGluZGV4KTtcbiAgICB9KTtcbiAgICBtYXhQb3NpdGlvbiA9IE1hdGgubWF4KG1heFBvc2l0aW9uLCBncm91cExlbmd0aCk7XG4gIH0pO1xuXG4gIE9iamVjdC5rZXlzKGFmdGVyKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBjb25zdCBncm91cE5leHRQb3NpdGlvbiA9IGFmdGVyW2tleV07XG4gICAgbWF4UG9zaXRpb24gPSBNYXRoLm1heChtYXhQb3NpdGlvbiwgZ3JvdXBOZXh0UG9zaXRpb24gLSAxKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBwYXRoR3JvdXBzOiB0cmFuc2Zvcm1lZCxcbiAgICBtYXhQb3NpdGlvbjogbWF4UG9zaXRpb24gPiAxMCA/IE1hdGgucG93KDEwLCBNYXRoLmNlaWwoTWF0aC5sb2cxMChtYXhQb3NpdGlvbikpKSA6IDEwLFxuICB9O1xufVxuXG5mdW5jdGlvbiBmaXhOZXdMaW5lQWZ0ZXJJbXBvcnQoY29udGV4dCwgcHJldmlvdXNJbXBvcnQpIHtcbiAgY29uc3QgcHJldlJvb3QgPSBmaW5kUm9vdE5vZGUocHJldmlvdXNJbXBvcnQubm9kZSk7XG4gIGNvbnN0IHRva2Vuc1RvRW5kT2ZMaW5lID0gdGFrZVRva2Vuc0FmdGVyV2hpbGUoXG4gICAgY29udGV4dC5nZXRTb3VyY2VDb2RlKCksIHByZXZSb290LCBjb21tZW50T25TYW1lTGluZUFzKHByZXZSb290KSk7XG5cbiAgbGV0IGVuZE9mTGluZSA9IHByZXZSb290LnJhbmdlWzFdO1xuICBpZiAodG9rZW5zVG9FbmRPZkxpbmUubGVuZ3RoID4gMCkge1xuICAgIGVuZE9mTGluZSA9IHRva2Vuc1RvRW5kT2ZMaW5lW3Rva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCAtIDFdLnJhbmdlWzFdO1xuICB9XG4gIHJldHVybiAoZml4ZXIpID0+IGZpeGVyLmluc2VydFRleHRBZnRlclJhbmdlKFtwcmV2Um9vdC5yYW5nZVswXSwgZW5kT2ZMaW5lXSwgJ1xcbicpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVOZXdMaW5lQWZ0ZXJJbXBvcnQoY29udGV4dCwgY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpIHtcbiAgY29uc3Qgc291cmNlQ29kZSA9IGNvbnRleHQuZ2V0U291cmNlQ29kZSgpO1xuICBjb25zdCBwcmV2Um9vdCA9IGZpbmRSb290Tm9kZShwcmV2aW91c0ltcG9ydC5ub2RlKTtcbiAgY29uc3QgY3VyclJvb3QgPSBmaW5kUm9vdE5vZGUoY3VycmVudEltcG9ydC5ub2RlKTtcbiAgY29uc3QgcmFuZ2VUb1JlbW92ZSA9IFtcbiAgICBmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIHByZXZSb290KSxcbiAgICBmaW5kU3RhcnRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgY3VyclJvb3QpLFxuICBdO1xuICBpZiAoKC9eXFxzKiQvKS50ZXN0KHNvdXJjZUNvZGUudGV4dC5zdWJzdHJpbmcocmFuZ2VUb1JlbW92ZVswXSwgcmFuZ2VUb1JlbW92ZVsxXSkpKSB7XG4gICAgcmV0dXJuIChmaXhlcikgPT4gZml4ZXIucmVtb3ZlUmFuZ2UocmFuZ2VUb1JlbW92ZSk7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gbWFrZU5ld2xpbmVzQmV0d2VlblJlcG9ydChjb250ZXh0LCBpbXBvcnRlZCwgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cywgZGlzdGluY3RHcm91cCkge1xuICBjb25zdCBnZXROdW1iZXJPZkVtcHR5TGluZXNCZXR3ZWVuID0gKGN1cnJlbnRJbXBvcnQsIHByZXZpb3VzSW1wb3J0KSA9PiB7XG4gICAgY29uc3QgbGluZXNCZXR3ZWVuSW1wb3J0cyA9IGNvbnRleHQuZ2V0U291cmNlQ29kZSgpLmxpbmVzLnNsaWNlKFxuICAgICAgcHJldmlvdXNJbXBvcnQubm9kZS5sb2MuZW5kLmxpbmUsXG4gICAgICBjdXJyZW50SW1wb3J0Lm5vZGUubG9jLnN0YXJ0LmxpbmUgLSAxLFxuICAgICk7XG5cbiAgICByZXR1cm4gbGluZXNCZXR3ZWVuSW1wb3J0cy5maWx0ZXIoKGxpbmUpID0+ICFsaW5lLnRyaW0oKS5sZW5ndGgpLmxlbmd0aDtcbiAgfTtcbiAgY29uc3QgZ2V0SXNTdGFydE9mRGlzdGluY3RHcm91cCA9IChjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCkgPT4gY3VycmVudEltcG9ydC5yYW5rIC0gMSA+PSBwcmV2aW91c0ltcG9ydC5yYW5rO1xuICBsZXQgcHJldmlvdXNJbXBvcnQgPSBpbXBvcnRlZFswXTtcblxuICBpbXBvcnRlZC5zbGljZSgxKS5mb3JFYWNoKGZ1bmN0aW9uIChjdXJyZW50SW1wb3J0KSB7XG4gICAgY29uc3QgZW1wdHlMaW5lc0JldHdlZW4gPSBnZXROdW1iZXJPZkVtcHR5TGluZXNCZXR3ZWVuKGN1cnJlbnRJbXBvcnQsIHByZXZpb3VzSW1wb3J0KTtcbiAgICBjb25zdCBpc1N0YXJ0T2ZEaXN0aW5jdEdyb3VwID0gZ2V0SXNTdGFydE9mRGlzdGluY3RHcm91cChjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCk7XG5cbiAgICBpZiAobmV3bGluZXNCZXR3ZWVuSW1wb3J0cyA9PT0gJ2Fsd2F5cydcbiAgICAgICAgfHwgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cyA9PT0gJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3VwcycpIHtcbiAgICAgIGlmIChjdXJyZW50SW1wb3J0LnJhbmsgIT09IHByZXZpb3VzSW1wb3J0LnJhbmsgJiYgZW1wdHlMaW5lc0JldHdlZW4gPT09IDApIHtcbiAgICAgICAgaWYgKGRpc3RpbmN0R3JvdXAgfHwgIWRpc3RpbmN0R3JvdXAgJiYgaXNTdGFydE9mRGlzdGluY3RHcm91cCkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGU6IHByZXZpb3VzSW1wb3J0Lm5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiAnVGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBlbXB0eSBsaW5lIGJldHdlZW4gaW1wb3J0IGdyb3VwcycsXG4gICAgICAgICAgICBmaXg6IGZpeE5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBwcmV2aW91c0ltcG9ydCksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZW1wdHlMaW5lc0JldHdlZW4gPiAwXG4gICAgICAgICYmIG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgIT09ICdhbHdheXMtYW5kLWluc2lkZS1ncm91cHMnKSB7XG4gICAgICAgIGlmIChkaXN0aW5jdEdyb3VwICYmIGN1cnJlbnRJbXBvcnQucmFuayA9PT0gcHJldmlvdXNJbXBvcnQucmFuayB8fCAhZGlzdGluY3RHcm91cCAmJiAhaXNTdGFydE9mRGlzdGluY3RHcm91cCkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICAgIG5vZGU6IHByZXZpb3VzSW1wb3J0Lm5vZGUsXG4gICAgICAgICAgICBtZXNzYWdlOiAnVGhlcmUgc2hvdWxkIGJlIG5vIGVtcHR5IGxpbmUgd2l0aGluIGltcG9ydCBncm91cCcsXG4gICAgICAgICAgICBmaXg6IHJlbW92ZU5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCksXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVtcHR5TGluZXNCZXR3ZWVuID4gMCkge1xuICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICBub2RlOiBwcmV2aW91c0ltcG9ydC5ub2RlLFxuICAgICAgICBtZXNzYWdlOiAnVGhlcmUgc2hvdWxkIGJlIG5vIGVtcHR5IGxpbmUgYmV0d2VlbiBpbXBvcnQgZ3JvdXBzJyxcbiAgICAgICAgZml4OiByZW1vdmVOZXdMaW5lQWZ0ZXJJbXBvcnQoY29udGV4dCwgY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJldmlvdXNJbXBvcnQgPSBjdXJyZW50SW1wb3J0O1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0QWxwaGFiZXRpemVDb25maWcob3B0aW9ucykge1xuICBjb25zdCBhbHBoYWJldGl6ZSA9IG9wdGlvbnMuYWxwaGFiZXRpemUgfHwge307XG4gIGNvbnN0IG9yZGVyID0gYWxwaGFiZXRpemUub3JkZXIgfHwgJ2lnbm9yZSc7XG4gIGNvbnN0IG9yZGVySW1wb3J0S2luZCA9IGFscGhhYmV0aXplLm9yZGVySW1wb3J0S2luZCB8fCAnaWdub3JlJztcbiAgY29uc3QgY2FzZUluc2Vuc2l0aXZlID0gYWxwaGFiZXRpemUuY2FzZUluc2Vuc2l0aXZlIHx8IGZhbHNlO1xuXG4gIHJldHVybiB7IG9yZGVyLCBvcmRlckltcG9ydEtpbmQsIGNhc2VJbnNlbnNpdGl2ZSB9O1xufVxuXG4vLyBUT0RPLCBzZW12ZXItbWFqb3I6IENoYW5nZSB0aGUgZGVmYXVsdCBvZiBcImRpc3RpbmN0R3JvdXBcIiBmcm9tIHRydWUgdG8gZmFsc2VcbmNvbnN0IGRlZmF1bHREaXN0aW5jdEdyb3VwID0gdHJ1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICB0eXBlOiAnc3VnZ2VzdGlvbicsXG4gICAgZG9jczoge1xuICAgICAgY2F0ZWdvcnk6ICdTdHlsZSBndWlkZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VuZm9yY2UgYSBjb252ZW50aW9uIGluIG1vZHVsZSBpbXBvcnQgb3JkZXIuJyxcbiAgICAgIHVybDogZG9jc1VybCgnb3JkZXInKSxcbiAgICB9LFxuXG4gICAgZml4YWJsZTogJ2NvZGUnLFxuICAgIHNjaGVtYTogW1xuICAgICAge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIGdyb3Vwczoge1xuICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBhdGhHcm91cHNFeGNsdWRlZEltcG9ydFR5cGVzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgZGlzdGluY3RHcm91cDoge1xuICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgZGVmYXVsdDogZGVmYXVsdERpc3RpbmN0R3JvdXAsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwYXRoR3JvdXBzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBwYXR0ZXJuOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBhdHRlcm5PcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdyb3VwOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgIGVudW06IHR5cGVzLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgZW51bTogWydhZnRlcicsICdiZWZvcmUnXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3BhdHRlcm4nLCAnZ3JvdXAnXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICAnbmV3bGluZXMtYmV0d2Vlbic6IHtcbiAgICAgICAgICAgIGVudW06IFtcbiAgICAgICAgICAgICAgJ2lnbm9yZScsXG4gICAgICAgICAgICAgICdhbHdheXMnLFxuICAgICAgICAgICAgICAnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJyxcbiAgICAgICAgICAgICAgJ25ldmVyJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhbHBoYWJldGl6ZToge1xuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIGNhc2VJbnNlbnNpdGl2ZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgb3JkZXI6IHtcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2lnbm9yZScsICdhc2MnLCAnZGVzYyddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdpZ25vcmUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBvcmRlckltcG9ydEtpbmQ6IHtcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2lnbm9yZScsICdhc2MnLCAnZGVzYyddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdpZ25vcmUnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHdhcm5PblVuYXNzaWduZWRJbXBvcnRzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbiBpbXBvcnRPcmRlclJ1bGUoY29udGV4dCkge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBjb250ZXh0Lm9wdGlvbnNbMF0gfHwge307XG4gICAgY29uc3QgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cyA9IG9wdGlvbnNbJ25ld2xpbmVzLWJldHdlZW4nXSB8fCAnaWdub3JlJztcbiAgICBjb25zdCBwYXRoR3JvdXBzRXhjbHVkZWRJbXBvcnRUeXBlcyA9IG5ldyBTZXQob3B0aW9ucy5wYXRoR3JvdXBzRXhjbHVkZWRJbXBvcnRUeXBlcyB8fCBbJ2J1aWx0aW4nLCAnZXh0ZXJuYWwnLCAnb2JqZWN0J10pO1xuICAgIGNvbnN0IGFscGhhYmV0aXplID0gZ2V0QWxwaGFiZXRpemVDb25maWcob3B0aW9ucyk7XG4gICAgY29uc3QgZGlzdGluY3RHcm91cCA9IG9wdGlvbnMuZGlzdGluY3RHcm91cCA9PSBudWxsID8gZGVmYXVsdERpc3RpbmN0R3JvdXAgOiAhIW9wdGlvbnMuZGlzdGluY3RHcm91cDtcbiAgICBsZXQgcmFua3M7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBwYXRoR3JvdXBzLCBtYXhQb3NpdGlvbiB9ID0gY29udmVydFBhdGhHcm91cHNGb3JSYW5rcyhvcHRpb25zLnBhdGhHcm91cHMgfHwgW10pO1xuICAgICAgY29uc3QgeyBncm91cHMsIG9taXR0ZWRUeXBlcyB9ID0gY29udmVydEdyb3Vwc1RvUmFua3Mob3B0aW9ucy5ncm91cHMgfHwgZGVmYXVsdEdyb3Vwcyk7XG4gICAgICByYW5rcyA9IHtcbiAgICAgICAgZ3JvdXBzLFxuICAgICAgICBvbWl0dGVkVHlwZXMsXG4gICAgICAgIHBhdGhHcm91cHMsXG4gICAgICAgIG1heFBvc2l0aW9uLFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gTWFsZm9ybWVkIGNvbmZpZ3VyYXRpb25cbiAgICAgIHJldHVybiB7XG4gICAgICAgIFByb2dyYW0obm9kZSkge1xuICAgICAgICAgIGNvbnRleHQucmVwb3J0KG5vZGUsIGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9XG4gICAgY29uc3QgaW1wb3J0TWFwID0gbmV3IE1hcCgpO1xuXG4gICAgZnVuY3Rpb24gZ2V0QmxvY2tJbXBvcnRzKG5vZGUpIHtcbiAgICAgIGlmICghaW1wb3J0TWFwLmhhcyhub2RlKSkge1xuICAgICAgICBpbXBvcnRNYXAuc2V0KG5vZGUsIFtdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbXBvcnRNYXAuZ2V0KG5vZGUpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBJbXBvcnREZWNsYXJhdGlvbjogZnVuY3Rpb24gaGFuZGxlSW1wb3J0cyhub2RlKSB7XG4gICAgICAgIC8vIElnbm9yaW5nIHVuYXNzaWduZWQgaW1wb3J0cyB1bmxlc3Mgd2Fybk9uVW5hc3NpZ25lZEltcG9ydHMgaXMgc2V0XG4gICAgICAgIGlmIChub2RlLnNwZWNpZmllcnMubGVuZ3RoIHx8IG9wdGlvbnMud2Fybk9uVW5hc3NpZ25lZEltcG9ydHMpIHtcbiAgICAgICAgICBjb25zdCBuYW1lID0gbm9kZS5zb3VyY2UudmFsdWU7XG4gICAgICAgICAgcmVnaXN0ZXJOb2RlKFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgICAgdmFsdWU6IG5hbWUsXG4gICAgICAgICAgICAgIGRpc3BsYXlOYW1lOiBuYW1lLFxuICAgICAgICAgICAgICB0eXBlOiAnaW1wb3J0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByYW5rcyxcbiAgICAgICAgICAgIGdldEJsb2NrSW1wb3J0cyhub2RlLnBhcmVudCksXG4gICAgICAgICAgICBwYXRoR3JvdXBzRXhjbHVkZWRJbXBvcnRUeXBlcyxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgVFNJbXBvcnRFcXVhbHNEZWNsYXJhdGlvbjogZnVuY3Rpb24gaGFuZGxlSW1wb3J0cyhub2RlKSB7XG4gICAgICAgIGxldCBkaXNwbGF5TmFtZTtcbiAgICAgICAgbGV0IHZhbHVlO1xuICAgICAgICBsZXQgdHlwZTtcbiAgICAgICAgLy8gc2tpcCBcImV4cG9ydCBpbXBvcnRcInNcbiAgICAgICAgaWYgKG5vZGUuaXNFeHBvcnQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUubW9kdWxlUmVmZXJlbmNlLnR5cGUgPT09ICdUU0V4dGVybmFsTW9kdWxlUmVmZXJlbmNlJykge1xuICAgICAgICAgIHZhbHVlID0gbm9kZS5tb2R1bGVSZWZlcmVuY2UuZXhwcmVzc2lvbi52YWx1ZTtcbiAgICAgICAgICBkaXNwbGF5TmFtZSA9IHZhbHVlO1xuICAgICAgICAgIHR5cGUgPSAnaW1wb3J0JztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9ICcnO1xuICAgICAgICAgIGRpc3BsYXlOYW1lID0gY29udGV4dC5nZXRTb3VyY2VDb2RlKCkuZ2V0VGV4dChub2RlLm1vZHVsZVJlZmVyZW5jZSk7XG4gICAgICAgICAgdHlwZSA9ICdpbXBvcnQ6b2JqZWN0JztcbiAgICAgICAgfVxuICAgICAgICByZWdpc3Rlck5vZGUoXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByYW5rcyxcbiAgICAgICAgICBnZXRCbG9ja0ltcG9ydHMobm9kZS5wYXJlbnQpLFxuICAgICAgICAgIHBhdGhHcm91cHNFeGNsdWRlZEltcG9ydFR5cGVzLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIENhbGxFeHByZXNzaW9uOiBmdW5jdGlvbiBoYW5kbGVSZXF1aXJlcyhub2RlKSB7XG4gICAgICAgIGlmICghaXNTdGF0aWNSZXF1aXJlKG5vZGUpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJsb2NrID0gZ2V0UmVxdWlyZUJsb2NrKG5vZGUpO1xuICAgICAgICBpZiAoIWJsb2NrKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5hbWUgPSBub2RlLmFyZ3VtZW50c1swXS52YWx1ZTtcbiAgICAgICAgcmVnaXN0ZXJOb2RlKFxuICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAge1xuICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgIHZhbHVlOiBuYW1lLFxuICAgICAgICAgICAgZGlzcGxheU5hbWU6IG5hbWUsXG4gICAgICAgICAgICB0eXBlOiAncmVxdWlyZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICByYW5rcyxcbiAgICAgICAgICBnZXRCbG9ja0ltcG9ydHMoYmxvY2spLFxuICAgICAgICAgIHBhdGhHcm91cHNFeGNsdWRlZEltcG9ydFR5cGVzLFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgICdQcm9ncmFtOmV4aXQnOiBmdW5jdGlvbiByZXBvcnRBbmRSZXNldCgpIHtcbiAgICAgICAgaW1wb3J0TWFwLmZvckVhY2goKGltcG9ydGVkKSA9PiB7XG4gICAgICAgICAgaWYgKG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgIT09ICdpZ25vcmUnKSB7XG4gICAgICAgICAgICBtYWtlTmV3bGluZXNCZXR3ZWVuUmVwb3J0KGNvbnRleHQsIGltcG9ydGVkLCBuZXdsaW5lc0JldHdlZW5JbXBvcnRzLCBkaXN0aW5jdEdyb3VwKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoYWxwaGFiZXRpemUub3JkZXIgIT09ICdpZ25vcmUnKSB7XG4gICAgICAgICAgICBtdXRhdGVSYW5rc1RvQWxwaGFiZXRpemUoaW1wb3J0ZWQsIGFscGhhYmV0aXplKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBtYWtlT3V0T2ZPcmRlclJlcG9ydChjb250ZXh0LCBpbXBvcnRlZCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGltcG9ydE1hcC5jbGVhcigpO1xuICAgICAgfSxcbiAgICB9O1xuICB9LFxufTtcbiJdfQ==