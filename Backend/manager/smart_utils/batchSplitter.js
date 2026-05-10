const { DELIMITER, DELIMITER_TOKEN } = require("./constantsSmart");
const { toSafeString, escapeRegExp } = require("../shared_utils/textUtils");

function appendWithDelimiter(currentText, nextText) {
  return currentText === "" ? nextText : `${currentText}${DELIMITER}${nextText}`;
}

function splitTranslatedBatch(resultText) {
  const normalizedText = toSafeString(resultText).replace(/\r\n?/g, "\n");
  const exactSplit = normalizedText.split(DELIMITER);

  if (exactSplit.length > 1) {
    return exactSplit;
  }

  const tolerantDelimiter = new RegExp(`\\s*${escapeRegExp(DELIMITER_TOKEN)}\\s*`, "g");
  const tolerantSplit = normalizedText.split(tolerantDelimiter);

  if (tolerantSplit.length > 1) {
    return tolerantSplit;
  }

  return exactSplit;
}

module.exports = {
  appendWithDelimiter,
  splitTranslatedBatch,
};
