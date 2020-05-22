const net = require("net");

class Request {
  constructor(option) {
    this.method = option.method || "GET";
    this.host = option.host;
    this.path = option.path || "/";
    this.port = option.port || "80";
    this.header = option.header || {};
    this.body = option.body || {};

    if (!this.header["Content-Type"]) {
      this.header["Content-Type"] = "application/x-www-from-urlencoded";
    }

    if (this.header["Content-Type"] === "application/x-www-from-urlencoded") {
      this.bodyText = Object.keys(this.body)
        .map((key) => `${key}=${encodeURIComponent(this.body[key])}`)
        .join("&");
    } else if (this.header["Content-Type"] === "application/json") {
      this.bodyText = JSON.stringify(this.body);
    }

    this.header["Content-Length"] = this.bodyText.length;
  }

  toString() {
    return `${this.method} ${this.path} HTTP/1.1\r\n${Object.keys(this.header)
      .map((key) => `${key}: ${this.header[key]}`)
      .join("\r\n")}\r\n\r\n${this.bodyText}`;
  }

  send(connection) {
    return new Promise((resolve, reject) => {
      let parser = new ResponseParser();
      if (connection) {
        connection.write(this.toString());
      } else {
        connection = net.createConnection(
          {
            host: this.host,
            port: this.port,
          },
          () => {
            connection.write(this.toString());
          }
        );
      }
      connection.on("data", (data) => {
        parser.receive(data.toString());
        resolve(parser.response);
        connection.end();
      });
      connection.on("err", (err) => {
        reject(err);
        connection.end();
      });
    });
  }
}

class ResponseParser {
  constructor() {
    this.statusLine = ""; // 响应行
    this.headerName = "";
    this.headerValue = "";
    this.headers = {};
    this.body = {};

    this.bodyParser = null;
  }

  get isFinished() {
    return this.bodyParser && this.bodyParser.isFinished;
  }

  get response() {
    this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
    return {
      statusCode: RegExp.$1,
      statusText: RegExp.$2,
      headers: this.headers,
      body: this.bodyParser.content.join(""),
    };
  }

  receive(string) {
    const waitingStatusLine = (c) => {
      if (c === "\r") {
        return waitingStatusLineEnd;
      } else {
        this.statusLine += c;
        return waitingStatusLine;
      }
    };

    const waitingStatusLineEnd = (c) => {
      if (c === "\n") {
        return waitingHeaderName;
      } else {
        throw new Error("The format of the response message is incorrect");
      }
    };

    const waitingHeaderName = (c) => {
      if (c === ":") {
        return waitingHeaderSpace;
      } else if (c === "\r") {
        return waitingHeaderBlockEnd;
      } else {
        this.headerName += c;
        return waitingHeaderName;
      }
    };

    const waitingHeaderSpace = (c) => {
      if (c === " ") {
        return waitingHeaderValue;
      } else {
        throw new Error("The format of the response message is incorrect");
      }
    };

    const waitingHeaderValue = (c) => {
      if (c === "\r") {
        this.headers[this.headerName] = this.headerValue;
        this.headerName = "";
        this.headerValue = "";
        return waitingHeaderLineEnd;
      } else {
        this.headerValue += c;
        return waitingHeaderValue;
      }
    };

    const waitingHeaderLineEnd = (c) => {
      if (c === "\n") {
        return waitingHeaderName;
      } else {
        throw new Error("The format of the response message is incorrect");
      }
    };

    const waitingHeaderBlockEnd = (c) => {
      if (c === "\n") {
        // 丢给 ChunkedBodyParser 处理
        this.bodyParser = new ChunkedBodyParser();
        return waitingBody;
      } else {
        throw new Error("The format of the response message is incorrect");
      }
    };

    const waitingBody = (c) => {
      this.bodyParser.receiveChar(c);
      return waitingBody;
    };

    let state = waitingStatusLine;
    for (let char of string) {
      state = state(char);
    }
  }
}

class ChunkedBodyParser {
  constructor() {
    this.content = [];
    this.length = 0;
    this.state = this.waitingLength;
    this.isFinished = false;
  }

  receiveChar(char) {
    this.state = this.state(char);
  }

  waitingLength(c) {
    if (c === "\r") {
      if (this.length === 0) {
        this.isFinished = true;
      }
      return this.waitingLengthEnd;
    } else {
      this.length *= 16;
      this.length += parseInt(c, 16);
      return this.waitingLength;
    }
  }

  waitingLengthEnd(c) {
    if (c === "\n") {
      return this.readChunked;
    } else {
      throw new Error("The format of the response message is incorrect");
    }
  }

  readChunked(c) {
    if (this.length === 0) {
      return this.waitingNewLine(c); // 将 "\r" 代理给下一个状态
    } else {
      this.content.push(c);
      this.length--;
      return this.readChunked;
    }
  }

  waitingNewLine(c) {
    if (c === "\r") {
      return this.waitingNewLineEnd;
    } else {
      throw new Error("The format of the response message is incorrect");
    }
  }

  waitingNewLineEnd(c) {
    if (c === "\n") {
      return this.waitingLength;
    } else {
      throw new Error("The format of the response message is incorrect");
    }
  }
}

void (async function () {
  let request = new Request({
    host: "127.0.0.1",
    path: "/",
    port: 8088,
    method: "GET",
    body: {
      name: "wendraw",
    },
  });
  let response = await request.send();
  console.log(response);
})();
