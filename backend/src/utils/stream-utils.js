const { Readable } = require("stream");

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

module.exports = {
  bufferToStream,
};
