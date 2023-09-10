import { SourceMapConsumer } from "source-map";

export class ErrorMapper {
  // Cache consumer
  static _consumer;

  static get consumer() {
    if (this._consumer == null) {
      this._consumer = new SourceMapConsumer(require("main.js.map"));
    }

    return this._consumer;
  }

  // Cache previously mapped traces to improve performance
  static cache = {};

  /**
   * Generates a stack trace using a source map generate original symbol names.
   *
   * WARNING - EXTREMELY high CPU cost for the first call after reset - >30 CPU! Use sparingly!
   * (Consecutive calls after a reset are more reasonable, ~0.1 CPU/ea)
   *
   * @param {Error | string} error The error or original stack trace
   * @returns {string} The source-mapped stack trace
   */
  static sourceMappedStackTrace(error) {
    const stack = error instanceof Error ? error.stack : error;
    if (Object.prototype.hasOwnProperty.call(this.cache, stack)) {
      return this.cache[stack];
    }

    // eslint-disable-next-line no-useless-escape
    const re = /^\s+at\s+(.+?\s+)?\(?([0-z._\-\\\/]+):(\d+):(\d+)\)?$/gm;
    let match;
    let outStack = error.toString();

    while ((match = re.exec(stack))) {
      if (match[2] === "main") {
        const pos = this.consumer.originalPositionFor({
          column: parseInt(match[4], 10),
          line: parseInt(match[3], 10)
        });

        if (pos.line != null) {
          if (pos.name) {
            outStack += `\n    at ${pos.name} (${pos.source}:${pos.line}:${pos.column})`;
          } else {
            if (match[1]) {
              // no original source file name known - use the file name from the given trace
              outStack += `\n    at ${match[1]} (${pos.source}:${pos.line}:${pos.column})`;
            } else {
              // no original source file name known or in the given trace - omit name
              outStack += `\n    at ${pos.source}:${pos.line}:${pos.column}`;
            }
          }
        } else {
          // no known position
          break;
        }
      } else {
        // no more parseable lines
        break;
      }
    }

    this.cache[stack] = outStack;
    return outStack;
  }

  static wrapLoop(loop) {
    return () => {
      try {
        loop();
      } catch (e) {
        if (e instanceof Error) {
          if ("sim" in Game.rooms) {
            const message = `Source maps don't work in the simulator - displaying the original error`;
            console.log(`<span style='color:red'>${message}<br>${_.escape(e.stack)}</span>`);
          } else {
            console.log(`<span style='color:red'>${_.escape(this.sourceMappedStackTrace(e))}</span>`);
          }
        } else {
          // can't handle it
          throw e;
        }
      }
    };
  }
}

// Export the ErrorMapper class if needed
// module.exports = ErrorMapper;
