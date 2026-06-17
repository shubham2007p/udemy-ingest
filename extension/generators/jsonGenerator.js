/**
 * JSON Generator
 * Generates structured JSON representation of course/playlist data.
 */
const JsonGenerator = {
  generate(data) {
    if (!data) return "";
    return JSON.stringify(data, null, 2);
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = JsonGenerator;
}
